// src/hooks/useSyncedStorage.ts
// Firestore同期付きストレージフック（useLocalStorageのドロップイン置換）

import { useState, useEffect, useRef } from 'react';
import { loadStorage, saveStorage } from '../utils/storage';
import { useAuthContext } from '../contexts/AuthContext';
import { pushToRemote, onSyncChange, setLocalChangeTimestamp, addTombstones } from '../services/syncService';
import { collectIds, diffDeleted, isTombstoneDoc } from '../utils/tombstones';
import { SYNC_KEY_MAP } from '../constants/index';

/**
 * ローカルストレージ + Firestore同期付きの状態管理フック
 * useLocalStorageと同じシグネチャ — ドロップイン置換可能
 * 未サインイン時はuseLocalStorageと完全同一の動作
 */
export function useSyncedStorage<T>(
  key: string,
  defaultValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => loadStorage(key, defaultValue));
  const { user, isSignedIn } = useAuthContext();
  const lastRemoteValueRef = useRef<string>('');
  const syncMapping = SYNC_KEY_MAP[key];
  // 直前の値に含まれていた id。push 直前に差分を取って「このデバイスで消えたもの」を墓標にする。
  // リモート適用の経路でも更新するので、リモート由来の消滅を二重に墓標化しない。
  const prevIdsRef = useRef<string[]>(
    syncMapping && isTombstoneDoc(syncMapping.doc) ? collectIds(syncMapping.doc, value) : []
  );

  // ローカルストレージへの保存
  useEffect(() => {
    saveStorage(key, value);
  }, [key, value]);

  // Firestoreへのプッシュ（サインイン中 & ローカル起因の変更のみ）
  useEffect(() => {
    if (!isSignedIn || !user || !syncMapping) return;

    // リモート起因の変更ならスキップ
    if (JSON.stringify(value) === lastRemoteValueRef.current) {
      return;
    }

    // ローカル起因で消えた id を墓標にする（＝相手に「消した」を伝える）。
    if (isTombstoneDoc(syncMapping.doc)) {
      const nextIds = collectIds(syncMapping.doc, value);
      const gone = diffDeleted(prevIdsRef.current, nextIds, Date.now());
      if (gone.length > 0) addTombstones(syncMapping.doc, gone);
      prevIdsRef.current = nextIds;
    }

    setLocalChangeTimestamp(syncMapping.doc);

    if (syncMapping.field) {
      // 設定ドキュメントの1フィールド（フィールド名を渡して蓄積）
      pushToRemote(user.uid, syncMapping.doc, value, syncMapping.field);
    } else {
      // ドキュメント全体
      pushToRemote(user.uid, syncMapping.doc, value);
    }
  }, [value, isSignedIn, user, syncMapping]);

  // リモートからの変更を監視
  useEffect(() => {
    if (!isSignedIn || !syncMapping) return;

    const unsubscribe = onSyncChange((docName) => {
      if (docName !== syncMapping.doc) return;

      // localStorageから最新値を再読み込み（syncServiceが既にマージ済み）
      const updated = loadStorage(key, defaultValue);
      lastRemoteValueRef.current = JSON.stringify(updated);
      // リモート適用の結果を基準に更新する（この消滅は相手発なので墓標を作り直さない）。
      if (isTombstoneDoc(syncMapping.doc)) {
        prevIdsRef.current = collectIds(syncMapping.doc, updated);
      }
      setValue(updated);
    });

    return unsubscribe;
  }, [isSignedIn, syncMapping, key, defaultValue]);

  return [value, setValue];
}
