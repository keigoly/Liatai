// src/services/syncService.ts
// Firestoreとの同期サービス

import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SYNC_DEBOUNCE_MS, STORAGE_KEYS, DEFAULTS, SYNC_KEY_MAP } from '../constants/index';
import { loadStorage, saveStorage } from '../utils/storage';
import {
  mergeSettings, mergeNgSettings, mergeRegisteredWords,
  mergeFolders, mergeSearchHistory,
} from '../utils/syncMerge';
import {
  isTombstoneDoc, mergeTombstones, tombstoneIdSet, type Tombstone,
} from '../utils/tombstones';
import type { NgSettings, RegisteredItem, FolderItem } from '../types/index';

// ========== 墓標（tombstone）==========
// mergeArrayById は union なので「リモートに無い＝削除」を表現できない。削除を明示的な事実
// として doc の `deleted` フィールドで運ぶ。ローカルにも持って push のたびに載せ直す
// （相手が deleted 未対応でも、こちらの push で書き戻るので収束する）。

const TOMBSTONE_STORAGE_KEY = 'sidestream_sync_tombstones';

function loadTombstones(): Record<string, Tombstone[]> {
  try {
    const raw = localStorage.getItem(TOMBSTONE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Tombstone[]>) : {};
  } catch {
    return {};
  }
}

function saveTombstones(all: Record<string, Tombstone[]>): void {
  try {
    localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // 保存できない環境でも同期そのものは続ける
  }
}

export function getTombstones(docName: string): Tombstone[] {
  return loadTombstones()[docName] ?? [];
}

/** 墓標を積む（既存へマージして保存し、マージ後の全量を返す）。 */
export function addTombstones(docName: string, tombs: Tombstone[]): Tombstone[] {
  if (!isTombstoneDoc(docName) || tombs.length === 0) return getTombstones(docName);
  const all = loadTombstones();
  const merged = mergeTombstones(all[docName] ?? [], tombs, Date.now());
  all[docName] = merged;
  saveTombstones(all);
  return merged;
}

// settingsドキュメントのリモートフィールド名 → ローカルストレージキーのマッピング（モジュール定数）
const SETTINGS_FIELD_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(SYNC_KEY_MAP)
    .filter(([, v]) => v.doc === 'settings' && v.field)
    .map(([storageKey, v]) => [v.field!, storageKey])
);

// デバイスIDの取得（なければ生成）
function getDeviceId(): string {
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  }
  return deviceId;
}

const deviceId = getDeviceId();

// デバウンス用タイマー管理
const debounceTimers: Record<string, number> = {};

// アクティブなスナップショットリスナーのunsubscribe関数群
let activeUnsubscribes: Unsubscribe[] = [];

// 自デバイスからの書き込みを無視するためのタイムスタンプ
const recentWrites: Record<string, number> = {};
const WRITE_IGNORE_WINDOW_MS = 1000;

// フィールドレベル更新の蓄積バッファ
const pendingFields: Record<string, Record<string, unknown>> = {};

/**
 * Firestoreにデータを書き込み（デバウンス付き）
 * field指定時はフィールドレベルで蓄積し、デバウンス後にまとめてupdateDoc
 */
export function pushToRemote(uid: string, docName: string, data: unknown, field?: string): void {
  if (debounceTimers[docName]) {
    window.clearTimeout(debounceTimers[docName]);
  }

  // フィールドレベルの場合は蓄積
  if (field) {
    if (!pendingFields[docName]) pendingFields[docName] = {};
    pendingFields[docName][field] = data;
  }

  debounceTimers[docName] = window.setTimeout(async () => {
    try {
      const docRef = doc(db, 'users', uid, 'sync', docName);
      const now = Date.now();

      if (field && pendingFields[docName]) {
        // フィールドレベル更新：蓄積したフィールドをまとめてupdateDoc
        const updates: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(pendingFields[docName])) {
          updates[`data.${k}`] = v;
        }
        updates.updatedAt = now;
        updates.sourceDeviceId = deviceId;
        updates.serverUpdatedAt = serverTimestamp();
        delete pendingFields[docName];

        try {
          await updateDoc(docRef, updates);
        } catch {
          // ドキュメントが存在しない場合はsetDocでフル作成
          const fullData: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(updates)) {
            if (k.startsWith('data.')) {
              fullData[k.slice(5)] = v;
            }
          }
          await setDoc(docRef, {
            data: fullData,
            updatedAt: now,
            sourceDeviceId: deviceId,
            serverUpdatedAt: serverTimestamp(),
          });
        }
      } else {
        // ドキュメント全体の書き込み。削除を伝えるため墓標を常に載せる
        // （相手が未対応なら無視されるだけ。相手の push で落ちても次のこちらの push で戻る）。
        await setDoc(docRef, {
          data,
          deleted: getTombstones(docName),
          updatedAt: now,
          sourceDeviceId: deviceId,
          serverUpdatedAt: serverTimestamp(),
        });
      }
      recentWrites[docName] = now;
    } catch (err) {
      console.error(`[Sync] Failed to push ${docName}:`, err);
    }
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Firestoreからデータを読み込み（一回限り）
 */
export async function pullFromRemote<T>(uid: string, docName: string): Promise<{ data: T; updatedAt: number; deleted: Tombstone[] } | null> {
  try {
    const docRef = doc(db, 'users', uid, 'sync', docName);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const docData = snapshot.data();
      return {
        data: docData.data as T,
        updatedAt: docData.updatedAt as number,
        deleted: Array.isArray(docData.deleted) ? (docData.deleted as Tombstone[]) : [],
      };
    }
    return null;
  } catch (err) {
    console.error(`[Sync] Failed to pull ${docName}:`, err);
    return null;
  }
}

/**
 * 初回サインイン時のデータアップロード
 * ローカルの全データをFirestoreにアップロード
 */
export async function uploadInitialData(uid: string): Promise<void> {
  const settings = {
    language: loadStorage(STORAGE_KEYS.LANGUAGE, DEFAULTS.LANGUAGE),
    autoRefresh: loadStorage(STORAGE_KEYS.AUTO_REFRESH, DEFAULTS.AUTO_REFRESH),
    trendInterval: loadStorage(STORAGE_KEYS.TREND_INTERVAL, DEFAULTS.TREND_INTERVAL),
    searchInterval: loadStorage(STORAGE_KEYS.SEARCH_INTERVAL, DEFAULTS.SEARCH_INTERVAL),
    themeColor: loadStorage(STORAGE_KEYS.THEME_COLOR, DEFAULTS.THEME_COLOR),
    bgMode: loadStorage(STORAGE_KEYS.BG_MODE, DEFAULTS.BG_MODE),
    fontSize: loadStorage(STORAGE_KEYS.FONT_SIZE, DEFAULTS.FONT_SIZE),
    graphDefaultPeriod: loadStorage(STORAGE_KEYS.GRAPH_DEFAULT_PERIOD, DEFAULTS.GRAPH_DEFAULT_PERIOD),
    bestPostInterval: loadStorage(STORAGE_KEYS.BEST_POST_INTERVAL, DEFAULTS.BEST_POST_INTERVAL),
  };

  const ngSettings = loadStorage(STORAGE_KEYS.NG_SETTINGS, { comments: [], userIds: [] });
  const registeredWords = loadStorage(STORAGE_KEYS.REGISTERED_WORDS, []);
  const folders = loadStorage(STORAGE_KEYS.FOLDERS, []);
  const searchHistory = loadStorage(STORAGE_KEYS.SEARCH_HISTORY, []);

  const now = Date.now();
  const base = { updatedAt: now, sourceDeviceId: deviceId, serverUpdatedAt: serverTimestamp() };

  await Promise.all([
    setDoc(doc(db, 'users', uid, 'sync', 'settings'), { data: settings, ...base }),
    setDoc(doc(db, 'users', uid, 'sync', 'ngSettings'), { data: ngSettings, deleted: getTombstones('ngSettings'), ...base }),
    setDoc(doc(db, 'users', uid, 'sync', 'registeredWords'), { data: registeredWords, deleted: getTombstones('registeredWords'), ...base }),
    setDoc(doc(db, 'users', uid, 'sync', 'folders'), { data: folders, deleted: getTombstones('folders'), ...base }),
    setDoc(doc(db, 'users', uid, 'sync', 'searchHistory'), { data: searchHistory, ...base }),
  ]);

  saveStorage(STORAGE_KEYS.AUTH_LAST_SYNC, now);
}

// ドキュメントごとのローカル変更タイムスタンプ
const localChangeTimestamps: Record<string, number> = {};

export function setLocalChangeTimestamp(docName: string): void {
  localChangeTimestamps[docName] = Date.now();
}

function getLocalChangeTimestamp(docName: string): number {
  return localChangeTimestamps[docName] || 0;
}

/**
 * リモートからローカルへのマージ処理
 */
function mergeRemoteToLocal(
  docName: string,
  remoteData: unknown,
  remoteUpdatedAt: number,
  remoteDeleted: Tombstone[] = []
): void {
  const localUpdatedAt = getLocalChangeTimestamp(docName);
  // リモートの墓標を自分の墓標へ取り込み、合算した集合でマージ結果から削除分を引く。
  const deleted = tombstoneIdSet(
    isTombstoneDoc(docName) ? addTombstones(docName, remoteDeleted) : []
  );

  switch (docName) {
    case 'settings': {
      const remote = remoteData as Record<string, unknown>;
      for (const [remoteKey, storageKey] of Object.entries(SETTINGS_FIELD_TO_KEY)) {
        if (remoteKey in remote) {
          const localVal = loadStorage(storageKey, null);
          const merged = mergeSettings(localVal, remote[remoteKey], localUpdatedAt, remoteUpdatedAt);
          saveStorage(storageKey, merged);
        }
      }
      break;
    }
    case 'ngSettings': {
      const local = loadStorage<NgSettings>(STORAGE_KEYS.NG_SETTINGS, { comments: [], userIds: [] });
      const remote = remoteData as NgSettings;
      const merged = mergeNgSettings(local, remote, localUpdatedAt, remoteUpdatedAt, deleted);
      saveStorage(STORAGE_KEYS.NG_SETTINGS, merged);
      break;
    }
    case 'registeredWords': {
      const local = loadStorage<RegisteredItem[]>(STORAGE_KEYS.REGISTERED_WORDS, []);
      const remote = remoteData as RegisteredItem[];
      const merged = mergeRegisteredWords(local, remote, localUpdatedAt, remoteUpdatedAt, deleted);
      saveStorage(STORAGE_KEYS.REGISTERED_WORDS, merged);
      break;
    }
    case 'folders': {
      const local = loadStorage<FolderItem[]>(STORAGE_KEYS.FOLDERS, []);
      const remote = remoteData as FolderItem[];
      const merged = mergeFolders(local, remote, localUpdatedAt, remoteUpdatedAt, deleted);
      saveStorage(STORAGE_KEYS.FOLDERS, merged);
      break;
    }
    case 'searchHistory': {
      const local = loadStorage<string[]>(STORAGE_KEYS.SEARCH_HISTORY, []);
      const remote = remoteData as string[];
      const merged = mergeSearchHistory(local, remote, localUpdatedAt, remoteUpdatedAt);
      saveStorage(STORAGE_KEYS.SEARCH_HISTORY, merged);
      break;
    }
  }

}

// スナップショットコールバックの登録用
type SyncCallback = (docName: string) => void;
let syncCallbacks: SyncCallback[] = [];

/**
 * 同期変更のコールバックを登録
 * リモートからの変更が適用された後に呼ばれる
 */
export function onSyncChange(callback: SyncCallback): () => void {
  syncCallbacks.push(callback);
  return () => {
    syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * スナップショットリスナーを開始
 * リモートの変更をリアルタイムで監視し、ローカルにマージ
 */
export function startSyncListeners(uid: string): void {
  stopSyncListeners(); // 既存リスナーをクリア

  const docNames = ['settings', 'ngSettings', 'registeredWords', 'folders', 'searchHistory'];

  for (const docName of docNames) {
    const docRef = doc(db, 'users', uid, 'sync', docName);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const docData = snapshot.data();
      const sourceDeviceId = docData.sourceDeviceId as string;

      // 自デバイスからの変更は無視
      if (sourceDeviceId === deviceId) {
        // ただし、最近の書き込みでなければ処理する（別セッションの可能性）
        const lastWrite = recentWrites[docName] || 0;
        if (Date.now() - lastWrite < WRITE_IGNORE_WINDOW_MS) {
          return;
        }
      }

      const remoteData = docData.data;
      const remoteUpdatedAt = docData.updatedAt as number;
      const remoteDeleted = Array.isArray(docData.deleted) ? (docData.deleted as Tombstone[]) : [];

      // リモートデータをローカルにマージ（削除は墓標で引く）
      mergeRemoteToLocal(docName, remoteData, remoteUpdatedAt, remoteDeleted);

      // コールバック通知
      for (const cb of syncCallbacks) {
        cb(docName);
      }
    }, (err) => {
      console.error(`[Sync] Snapshot error for ${docName}:`, err);
    });

    activeUnsubscribes.push(unsubscribe);
  }
}

/**
 * スナップショットリスナーを停止
 * syncCallbacks は React フックが管理するため、ここではクリアしない
 */
export function stopSyncListeners(): void {
  for (const unsub of activeUnsubscribes) {
    unsub();
  }
  activeUnsubscribes = [];

  // デバウンス中の書き込みをキャンセル（サインアウト後のstale writeを防止）
  for (const timerId of Object.values(debounceTimers)) {
    window.clearTimeout(timerId);
  }
  Object.keys(debounceTimers).forEach(k => delete debounceTimers[k]);
  Object.keys(pendingFields).forEach(k => delete pendingFields[k]);
}

/**
 * 同期コールバックを全クリア（アンマウント時のみ呼び出す）
 */
export function clearSyncCallbacks(): void {
  syncCallbacks = [];
}

/**
 * ユーザープロフィールの作成/更新
 */
export async function createUserProfile(uid: string, user: { email: string | null; displayName: string | null; photoURL: string | null }): Promise<void> {
  try {
    const docRef = doc(db, 'users', uid, 'profile', 'info');
    await setDoc(docRef, {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastSyncAt: serverTimestamp(),
      planTier: 'free',
    }, { merge: true });
  } catch (err) {
    console.error('[Sync] Failed to create user profile:', err);
  }
}
