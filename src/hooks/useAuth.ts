// src/hooks/useAuth.ts
// 認証状態管理フック

import { useState, useEffect, useCallback } from 'react';
import { signInWithGoogle, signOut as authSignOut, onAuthChange } from '../services/authService';
import type { AuthUser } from '../types/index';

export interface UseAuthReturn {
  user: AuthUser | null;
  isSignedIn: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      setUser(authUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const authUser = await signInWithGoogle();
      setUser(authUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await authSignOut();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-out failed');
    }
  }, []);

  return {
    user,
    isSignedIn: !!user,
    isLoading,
    error,
    signIn,
    signOut,
  };
}
