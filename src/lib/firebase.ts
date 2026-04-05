// src/lib/firebase.ts
// Firebase初期化モジュール

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../constants/index';

// Firebase アプリの初期化
const app = initializeApp(FIREBASE_CONFIG);

// Firebase Auth
export const auth = getAuth(app);

// Firestore（オフライン永続化付き、iframe環境ではメモリキャッシュにフォールバック）
let db: ReturnType<typeof initializeFirestore>;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  // iframe環境（NextGenTV）ではIndexedDBが使えない場合がある
  console.warn('[Firebase] Persistent cache unavailable, using memory cache');
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
}

export { db };
