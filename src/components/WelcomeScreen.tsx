// src/components/WelcomeScreen.tsx
// 初回起動時のウェルカム画面

import { useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { STORAGE_KEYS } from '../constants/index';
import type { TranslationKey } from '../i18n/translations';

interface WelcomeScreenProps {
  t: (key: TranslationKey) => string;
  onComplete: () => void;
}

export const WelcomeScreen = ({ t, onComplete }: WelcomeScreenProps) => {
  const { signIn, isLoading, isSignedIn, error } = useAuthContext();

  // サインイン成功時にウェルカム完了
  useEffect(() => {
    if (isSignedIn) {
      localStorage.setItem(STORAGE_KEYS.WELCOME_COMPLETED, 'true');
      onComplete();
    }
  }, [isSignedIn, onComplete]);

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEYS.WELCOME_COMPLETED, 'true');
    onComplete();
  };

  return (
    <div className="w-full h-screen bg-[var(--bg-color)] flex items-center justify-center transition-colors duration-300">
      <div className="w-full max-w-[350px] px-6 flex flex-col items-center animate-welcome-in">

        {/* アイコン（パルスアニメーション付き） */}
        <div className="mb-8 animate-welcome-icon">
          <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl shadow-[var(--theme-color)]/20">
            <img
              src="/icon-128.png"
              alt="リアタイ！"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* タイトル */}
        <h1 className="text-2xl font-bold text-white mb-2 animate-welcome-text-1">
          {t('welcomeTitle')}
        </h1>

        {/* 説明 */}
        <p className="text-gray-400 text-sm text-center leading-relaxed mb-8 animate-welcome-text-2">
          {t('welcomeDescription')}
        </p>

        {/* 同期の説明 */}
        <div className="w-full rounded-xl p-4 mb-6 animate-welcome-card">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--theme-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed">
              {t('welcomeSyncFeature')}
            </p>
          </div>
        </div>

        {/* ボタン群 */}
        <div className="w-full space-y-3 animate-welcome-buttons">
          {/* Googleアカウント登録ボタン */}
          <button
            onClick={signIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[var(--bg-color)] hover:brightness-125 rounded-xl transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span className="text-white font-bold text-sm">{t('welcomeRegisterAccount')}</span>
          </button>

          {/* スキップボタン */}
          <button
            onClick={handleSkip}
            className="w-full py-3 px-4 rounded-xl text-gray-400 text-sm font-bold hover:bg-[var(--card-bg-color)] hover:text-white transition-all"
          >
            {t('welcomeSkip')}
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="w-full mt-4 p-3 bg-red-500/10 rounded-xl">
            <p className="text-red-400 text-xs text-center">{t('signInError')}: {error}</p>
          </div>
        )}
      </div>

      {/* アニメーション定義 */}
      <style>{`
        @keyframes welcome-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes welcome-icon {
          0% { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          60% { transform: scale(1.1) rotate(3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes welcome-text {
          0% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes welcome-card {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes welcome-icon-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(var(--theme-color-rgb, 29, 155, 240), 0.2); }
          50% { box-shadow: 0 0 40px rgba(var(--theme-color-rgb, 29, 155, 240), 0.4); }
        }
        .animate-welcome-in { animation: welcome-in 0.6s ease-out forwards; }
        .animate-welcome-icon { opacity: 0; animation: welcome-icon 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards; }
        .animate-welcome-text-1 { opacity: 0; animation: welcome-text 0.5s ease-out 0.5s forwards; }
        .animate-welcome-text-2 { opacity: 0; animation: welcome-text 0.5s ease-out 0.7s forwards; }
        .animate-welcome-card { opacity: 0; animation: welcome-card 0.6s ease-out 0.9s forwards; }
        .animate-welcome-buttons { opacity: 0; animation: welcome-text 0.5s ease-out 1.1s forwards; }
      `}</style>
    </div>
  );
};
