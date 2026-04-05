// src/services/authService.ts
// Google認証サービス

import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { AuthUser } from '../types/index';

// Chrome拡張環境かどうかを判定
const isChromeExtension = typeof chrome !== 'undefined' && !!chrome.identity;

/**
 * FirebaseユーザーをAuthUserに変換
 */
function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

/**
 * Chrome拡張環境でのGoogleサインイン
 * chrome.identity.getAuthToken → Firebase signInWithCredential
 */
async function signInWithChromeIdentity(): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (tokenResult) => {
      // @types/chrome v136+ では GetAuthTokenResult を返す
      const token = typeof tokenResult === 'string' ? tokenResult : tokenResult?.token;
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'Failed to get auth token'));
        return;
      }
      try {
        const credential = GoogleAuthProvider.credential(null, token);
        const result = await signInWithCredential(auth, credential);
        resolve(toAuthUser(result.user));
      } catch (err) {
        // トークンが無効な場合、キャッシュをクリアして再試行
        chrome.identity.removeCachedAuthToken({ token }, () => {
          reject(err);
        });
      }
    });
  });
}

/**
 * Chrome拡張環境でのGoogleサインイン（launchWebAuthFlow版）
 * chrome.identity.getAuthTokenが失敗した場合のフォールバック
 */
async function signInWithLaunchWebAuthFlow(): Promise<AuthUser> {
  // Firebase が自動生成したウェブクライアントID（Firebase Auth が認識する）
  const clientId = '635713763868-36t2t0783tov0kuug662kkdhnsijsj0h.apps.googleusercontent.com';

  const redirectUrl = chrome.identity.getRedirectURL();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('scope', 'openid email profile');

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (callbackUrl) => {
        if (chrome.runtime.lastError || !callbackUrl) {
          reject(new Error(chrome.runtime.lastError?.message || 'Auth flow cancelled'));
          return;
        }
        resolve(callbackUrl);
      }
    );
  });

  // レスポンスURLからアクセストークンを抽出
  const url = new URL(responseUrl.replace('#', '?'));
  const accessToken = url.searchParams.get('access_token');
  if (!accessToken) throw new Error('No access token in response');

  const credential = GoogleAuthProvider.credential(null, accessToken);
  const result = await signInWithCredential(auth, credential);
  return toAuthUser(result.user);
}

/**
 * Web環境でのGoogleサインイン（iframe等のフォールバック）
 */
async function signInWithPopupFallback(): Promise<AuthUser> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return toAuthUser(result.user);
}

/**
 * Googleサインイン（環境に応じて自動切り替え）
 * getAuthToken → launchWebAuthFlow → signInWithPopup の順にフォールバック
 */
export async function signInWithGoogle(): Promise<AuthUser> {
  if (isChromeExtension) {
    try {
      return await signInWithChromeIdentity();
    } catch (err) {
      console.warn('[Auth] getAuthToken failed, trying launchWebAuthFlow:', err);
      try {
        return await signInWithLaunchWebAuthFlow();
      } catch (err2) {
        console.warn('[Auth] launchWebAuthFlow failed, trying popup:', err2);
        return signInWithPopupFallback();
      }
    }
  }
  return signInWithPopupFallback();
}

/**
 * サインアウト
 */
export async function signOut(): Promise<void> {
  // Chrome拡張環境ではトークンキャッシュもクリア
  if (isChromeExtension) {
    const token = await new Promise<string | undefined>((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (tokenResult) => {
        resolve(typeof tokenResult === 'string' ? tokenResult : tokenResult?.token);
      });
    });
    if (token) {
      await new Promise<void>((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, resolve);
      });
    }
  }
  await firebaseSignOut(auth);
}

/**
 * 認証状態の監視
 */
export function onAuthChange(callback: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(auth, (firebaseUser) => {
    callback(firebaseUser ? toAuthUser(firebaseUser) : null);
  });
}
