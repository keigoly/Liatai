// src/components/Header.tsx
import { useState, useRef, useEffect } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import type { TranslationKey } from '../i18n/translations';
import type { ViewType, HomeTabType, TabType } from '../types/index';
import { useSuggest } from '../hooks/useSuggest';
import { buildAssistItems } from '../utils/searchAssist';

interface HeaderProps {
  t: (key: TranslationKey) => string;
  currentView: ViewType;
  homeTab: HomeTabType;
  setHomeTab: (tab: HomeTabType) => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  inputValue: string;
  setInputValue: (val: string) => void;
  onSearch: () => void;
  onGoHome: () => void;
  trendUpdateTime: string;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  searchHistory: string[];
  onRemoveHistory: (word: string) => void;
  onSuggestionClick: (word: string) => void;
  onClearAllHistory: () => void;
  isSyncMode?: boolean;  // 録画リプレイ中: ホーム非表示・検索ロック
}

export const Header = ({
  t,
  currentView,
  homeTab,
  setHomeTab,
  activeTab,
  setActiveTab,
  inputValue,
  setInputValue,
  onSearch,
  onGoHome,
  trendUpdateTime,
  autoRefresh,
  setAutoRefresh,
  searchHistory,
  onRemoveHistory,
  onSuggestionClick,
  onClearAllHistory,
  isSyncMode = false,
}: HeaderProps) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  // 入力中の候補（Yahoo!リアルタイム検索と同じ: 前方一致の履歴 → 候補・合わせて最大 10 件）。
  const assist = useSuggest(inputValue, isHistoryOpen && !isSyncMode && !!inputValue.trim());
  const assistItems = inputValue.trim() ? buildAssistItems(inputValue, searchHistory, assist.suggestions) : [];
  // キーボードで選んでいる候補（-1 = 選んでいない）。
  const [highlight, setHighlight] = useState(-1);
  const showAssist = isHistoryOpen && !isSyncMode && !!inputValue.trim() && (assistItems.length > 0 || assist.needsPermission);
  const pickAssist = (word: string) => {
    setInputValue(word);
    onSuggestionClick(word);
    setIsHistoryOpen(false);
    setHighlight(-1);
  };

  const [historyRef] = useAutoAnimate<HTMLUListElement>();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsHistoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showAutoRefresh = (currentView === 'home' && homeTab === 'trends') || currentView === 'search';

  return (
    <header className="flex-shrink-0 bg-[var(--bg-color)] border-b border-[var(--border-color)] z-20 relative transition-colors duration-300">

      {/* 上段: ホームアイコンと検索窓 */}
      <div className="flex items-center gap-3 p-3">

        {/* ホームボタン（録画リプレイ中は非表示） */}
        {!isSyncMode && (
          <button onClick={onGoHome} className="p-2 rounded-full hover:bg-[var(--card-bg-color)] transition-colors text-gray-400 hover:text-[var(--theme-color)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z" /></svg>
          </button>
        )}

        <div className="flex-1 relative" ref={searchContainerRef}>
          <div className="relative">
            <input
              type="text"
              className="w-full bg-[#202327] border border-gray-600 text-white rounded-full py-2 pl-4 pr-10 focus:outline-none focus:border-[var(--theme-color)] focus:bg-black transition-all"
              placeholder={t('searchPlaceholder')}
              value={inputValue}
              onChange={(e) => {
                if (isSyncMode) return;
                setInputValue(e.target.value);
                setIsHistoryOpen(true);
                setHighlight(-1);
              }}
              onKeyDown={(e) => {
                // 日本語入力の変換確定（Enter）は検索にしない。
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (showAssist && assistItems.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                  e.preventDefault();
                  const n = assistItems.length;
                  setHighlight((i) => (e.key === 'ArrowDown' ? (i + 1) % n : i <= 0 ? n - 1 : i - 1));
                  return;
                }
                if (e.key === 'Escape') {
                  setIsHistoryOpen(false);
                  setHighlight(-1);
                  return;
                }
                if (e.key === 'Enter' && !isSyncMode) {
                  if (showAssist && highlight >= 0 && assistItems[highlight]) {
                    pickAssist(assistItems[highlight].text);
                    return;
                  }
                  onSearch();
                  setIsHistoryOpen(false);
                }
              }}
              onFocus={() => !isSyncMode && setIsHistoryOpen(true)}
              readOnly={isSyncMode}
            />
            {inputValue && !isSyncMode && (
              <button
                onClick={() => { setInputValue(''); }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* 入力候補ポップアップ（入力中・最大 10 件） */}
          {showAssist && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-50">
              {assist.needsPermission && (
                <div className="flex items-center gap-3 px-4 py-2 bg-[var(--card-bg-color)] border-b border-[var(--border-color)] text-xs text-gray-400">
                  <span className="flex-1">{t('suggestPermissionNote')}</span>
                  <button onClick={() => void assist.requestPermission()} className="font-bold text-[var(--theme-color)] hover:underline">{t('suggestPermissionAllow')}</button>
                  <button onClick={assist.dismissPermission} className="text-gray-500 hover:text-white" aria-label={t('suggestPermissionDismiss')} title={t('suggestPermissionDismiss')}>✕</button>
                </div>
              )}
              <ul className="max-h-96 overflow-y-auto scrollbar-hide" role="listbox">
                {assistItems.map((item, index) => (
                  <li key={`${item.kind}:${item.text}`} className="border-b border-[var(--border-color)] last:border-0" role="option" aria-selected={index === highlight}>
                    <div
                      className={`flex items-center transition-colors cursor-pointer group ${index === highlight ? 'bg-[var(--card-bg-color)]' : 'hover:bg-[var(--card-bg-color)]'}`}
                      onMouseMove={() => { if (highlight !== index) setHighlight(index); }}
                    >
                      <div className="flex-1 min-w-0 px-4 py-3 flex items-center gap-3" onClick={() => pickAssist(item.text)}>
                        <span className="text-gray-500 flex-shrink-0">
                          {item.kind === 'history' ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
                          )}
                        </span>
                        <span className="text-white text-sm truncate">{item.text}</span>
                      </div>
                      {item.kind === 'history' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveHistory(item.text); }}
                          className="p-3 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 検索履歴ポップアップ */}
          {isHistoryOpen && !inputValue && searchHistory.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="flex justify-between items-center px-4 py-2 bg-[var(--card-bg-color)] border-b border-[var(--border-color)]">
                <span className="text-xs text-gray-400 font-bold">{t('searchHistory')}</span>
                <button onClick={onClearAllHistory} className="text-xs text-red-400 hover:underline">{t('deleteAll')}</button>
              </div>
              <ul ref={historyRef} className="max-h-60 overflow-y-auto scrollbar-hide">
                {searchHistory.map((word, index) => (
                  <li key={word + index} className="border-b border-[var(--border-color)] last:border-0">
                    <div className="flex items-center hover:bg-[var(--card-bg-color)] transition-colors cursor-pointer group">
                      <div
                        className="flex-1 px-4 py-3 flex items-center gap-3"
                        onClick={() => {
                          setInputValue(word);
                          onSuggestionClick(word);
                          setIsHistoryOpen(false);
                        }}
                      >
                        <span className="text-gray-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>
                        <span className="text-white text-sm">{word}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveHistory(word); }}
                        className="p-3 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {!isSyncMode && (
          <button onClick={onSearch} className="bg-[var(--theme-color)] text-white font-bold py-1.5 px-4 rounded-full hover:brightness-90 transition-all text-sm whitespace-nowrap">
            {t('search')}
          </button>
        )}
      </div>

      {/* 下段: タブ切り替え（録画リプレイ中は常にフィルタタブのみ表示） */}
      <div className="flex items-end px-2">
        {currentView === 'home' && !isSyncMode ? (
          <>
            <button onClick={() => setHomeTab('trends')} className={`flex-1 pb-3 pt-2 text-center text-sm font-bold border-b-4 transition-all ${homeTab === 'trends' ? 'border-[var(--theme-color)] text-white' : 'border-transparent text-gray-500 hover:bg-[var(--card-bg-color)]'}`}>{t('trends')}</button>
            <button onClick={() => setHomeTab('registered')} className={`flex-1 pb-3 pt-2 text-center text-sm font-bold border-b-4 transition-all ${homeTab === 'registered' ? 'border-[var(--theme-color)] text-white' : 'border-transparent text-gray-500 hover:bg-[var(--card-bg-color)]'}`}>{t('registered')}</button>
            <button onClick={() => setHomeTab('settings')} className={`flex-1 pb-3 pt-2 text-center text-sm font-bold border-b-4 transition-all ${homeTab === 'settings' ? 'border-[var(--theme-color)] text-white' : 'border-transparent text-gray-500 hover:bg-[var(--card-bg-color)]'}`}>{t('settings')}</button>
          </>
        ) : (
          <>
            <button onClick={() => setActiveTab('all')} className={`flex-1 pb-3 pt-2 text-center text-sm font-bold border-b-4 transition-all ${activeTab === 'all' ? 'border-[var(--theme-color)] text-white' : 'border-transparent text-gray-500 hover:bg-[var(--card-bg-color)]'}`}>{t('all')}</button>
            <button onClick={() => setActiveTab('text')} className={`flex-1 pb-3 pt-2 text-center text-sm font-bold border-b-4 transition-all ${activeTab === 'text' ? 'border-[var(--theme-color)] text-white' : 'border-transparent text-gray-500 hover:bg-[var(--card-bg-color)]'}`}>{t('postsOnly')}</button>
            <button onClick={() => setActiveTab('media')} className={`flex-1 pb-3 pt-2 text-center text-sm font-bold border-b-4 transition-all ${activeTab === 'media' ? 'border-[var(--theme-color)] text-white' : 'border-transparent text-gray-500 hover:bg-[var(--card-bg-color)]'}`}>{t('media')}</button>
          </>
        )}
      </div>

      {/* 更新情報バー（録画リプレイ中は非表示） */}
      {!isSyncMode && (
      <div className="flex justify-between items-center px-4 py-1 bg-[var(--card-bg-color)] border-b border-[var(--border-color)] text-xs text-gray-400">
        <span>{currentView === 'home' && homeTab === 'trends' ? trendUpdateTime : ''}</span>

        {showAutoRefresh && (
          <div className="flex items-center gap-3">
            {/* 新しいウィンドウで開くボタン（サイドパネルのみ表示） */}
            {!window.location.search.includes('popup=true') && (
              <button
                onClick={() => {
                  // 現在の検索キーワードをURLパラメータに含める
                  const params = new URLSearchParams({ popup: 'true' });
                  const currentInput = document.querySelector<HTMLInputElement>('input[type="text"]');
                  if (currentInput?.value) params.set('q', currentInput.value);
                  const popupHeight = Math.min(screen.availHeight - 40, 1200);

                  if (typeof chrome !== 'undefined' && chrome.windows) {
                    chrome.windows.create({
                      url: chrome.runtime.getURL(`index.html?${params.toString()}`),
                      type: 'popup',
                      width: 420,
                      height: popupHeight,
                    });
                    window.close();
                  } else {
                    window.open(`${window.location.pathname}?${params.toString()}`, '_blank', `width=420,height=${popupHeight},popup=true`);
                  }
                }}
                className="p-1.5 rounded-full hover:bg-[var(--bg-color)] transition-colors text-gray-400 hover:text-[var(--theme-color)]"
                title={t('openInNewWindow')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>
            )}

            {/* 自動更新スイッチ */}
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                <div className={`block w-8 h-5 rounded-full transition-colors ${autoRefresh ? 'bg-[var(--theme-color)]' : 'bg-gray-600'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${autoRefresh ? 'transform translate-x-3' : ''}`}></div>
              </div>
              <span className="ml-2">{t('autoRefresh')}</span>
            </label>
          </div>
        )}
      </div>
      )}
    </header>
  );
};