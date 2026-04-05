// src/contexts/AuthContext.tsx
// 認証コンテキストプロバイダー

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuth, type UseAuthReturn } from '../hooks/useAuth';
import {
  uploadInitialData,
  startSyncListeners,
  stopSyncListeners,
  createUserProfile,
  pullFromRemote,
} from '../services/syncService';

const AuthContext = createContext<UseAuthReturn | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  // 同期ライフサイクル管理
  useEffect(() => {
    if (!auth.user) {
      stopSyncListeners();
      return;
    }

    const uid = auth.user.uid;

    // ユーザープロフィール作成/更新
    createUserProfile(uid, {
      email: auth.user.email,
      displayName: auth.user.displayName,
      photoURL: auth.user.photoURL,
    });

    // 初回同期: リモートにデータがなければローカルデータをアップロード
    const initSync = async () => {
      try {
        const remoteSettings = await pullFromRemote(uid, 'settings');
        if (!remoteSettings) {
          // リモートにデータがない = 初回サインイン → ローカルデータをアップロード
          await uploadInitialData(uid);
        }
        // リアルタイム同期リスナーを開始
        startSyncListeners(uid);
      } catch (err) {
        console.error('[Sync] Failed to initialize sync:', err);
        // エラーでもリスナーは開始（オフラインキャッシュが利用可能）
        startSyncListeners(uid);
      }
    };

    initSync();

    return () => {
      stopSyncListeners();
    };
  }, [auth.user]);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): UseAuthReturn {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
