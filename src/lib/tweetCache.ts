// src/lib/tweetCache.ts
// TV放送リプレイ用ツイートのIndexedDBキャッシュレイヤー
// 外部ライブラリ不使用、生のIndexedDB APIで実装

import type { Tweet } from '../types/index';

// ========== 定数 ==========
const DB_NAME = 'riatai-tweet-cache';
const DB_VERSION = 1;
const STORE_NAME = 'replay-tweets';

// ========== キャッシュエントリの型定義 ==========
interface CacheEntry {
  cacheKey: string;        // `${keyword}|${programStartMs}`
  tweets: Tweet[];         // createdAt昇順でソート済みの全ツイート
  cachedAt: number;        // キャッシュ保存時刻（Date.now()）
  keyword: string;
  programStartMs: number;
  programEndMs: number;
}

// ========== IDBリクエストをPromise化するヘルパー ==========

/** IDBRequestをPromiseでラップする */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** IDBTransactionの完了をPromiseで待つ */
function promisifyTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

// ========== DB操作関数 ==========

/**
 * IndexedDBを開く（なければ作成）
 * バージョンアップグレード時にオブジェクトストアを自動作成する
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // バージョンアップグレード: ストアが未作成なら作成
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * キャッシュ済みツイートを取得する
 * @param keyword - 検索キーワード
 * @param programStartMs - 番組開始時刻（ミリ秒）
 * @returns ツイート配列、キャッシュが無ければnull
 */
export async function getCachedTweets(
  keyword: string,
  programStartMs: number,
): Promise<Tweet[] | null> {
  try {
    const db = await openDB();
    const cacheKey = `${keyword}|${programStartMs}`;

    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const entry = await promisifyRequest<CacheEntry | undefined>(store.get(cacheKey));

    db.close();

    if (!entry) return null;
    return entry.tweets;
  } catch (err) {
    console.warn('[tweetCache] キャッシュ読み取りに失敗しました:', err);
    return null;
  }
}

/**
 * ツイートをキャッシュに保存する
 * 保存後、古いエントリを自動削除してストレージ肥大化を防止する
 * @param keyword - 検索キーワード
 * @param programStartMs - 番組開始時刻（ミリ秒）
 * @param programEndMs - 番組終了時刻（ミリ秒）
 * @param tweets - 保存するツイート配列
 */
export async function saveCachedTweets(
  keyword: string,
  programStartMs: number,
  programEndMs: number,
  tweets: Tweet[],
): Promise<void> {
  try {
    const db = await openDB();
    const cacheKey = `${keyword}|${programStartMs}`;

    const entry: CacheEntry = {
      cacheKey,
      tweets,
      cachedAt: Date.now(),
      keyword,
      programStartMs,
      programEndMs,
    };

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(entry);
    await promisifyTransaction(transaction);

    db.close();

    // 古いキャッシュを削除（最大20件に制限）
    await clearOldCache(20);
  } catch (err) {
    console.warn('[tweetCache] キャッシュ保存に失敗しました:', err);
  }
}

/**
 * 古いキャッシュエントリを削除する
 * cachedAtが古い順に、maxEntriesを超えた分を削除する
 * @param maxEntries - 保持する最大エントリ数
 */
export async function clearOldCache(maxEntries: number): Promise<void> {
  try {
    const db = await openDB();

    // 全エントリを取得
    const readTx = db.transaction(STORE_NAME, 'readonly');
    const readStore = readTx.objectStore(STORE_NAME);
    const allEntries = await promisifyRequest<CacheEntry[]>(readStore.getAll());

    // maxEntries以下なら削除不要
    if (allEntries.length <= maxEntries) {
      db.close();
      return;
    }

    // cachedAt昇順でソート（古い順）
    allEntries.sort((a, b) => a.cachedAt - b.cachedAt);

    // 削除対象: 古い方から超過分
    const deleteCount = allEntries.length - maxEntries;
    const toDelete = allEntries.slice(0, deleteCount);

    // 削除実行
    const deleteTx = db.transaction(STORE_NAME, 'readwrite');
    const deleteStore = deleteTx.objectStore(STORE_NAME);
    for (const entry of toDelete) {
      deleteStore.delete(entry.cacheKey);
    }
    await promisifyTransaction(deleteTx);

    db.close();
  } catch (err) {
    console.warn('[tweetCache] 古いキャッシュの削除に失敗しました:', err);
  }
}
