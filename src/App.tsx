// src/App.tsx
// メインアプリケーションコンポーネント
// リファクタリング済み: 500行 → 約200行

import { useState, useEffect, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { fetchRealtimeTrends } from './services/realtimeService';
import type { TrendItem, TabType, ViewType, HomeTabType } from './types/index';

// フック
import { useSettings, useSearchHistory, useTheme, useTweets } from './hooks/index';
import { useLanguage } from './hooks/useLanguage';

// コンポーネント
import { Header } from './components/Header';
import { SettingsPanel } from './components/SettingsPanel';
import { RegisteredPanel } from './components/RegisteredPanel';
import { TweetCard } from './components/search/TweetCard';
import { TrendList } from './components/home/TrendList';

function App() {
  // ========== カスタムフックで状態管理 ==========
  const settings = useSettings();
  const { language, setLanguage, t } = useLanguage();
  const searchHistoryState = useSearchHistory();
  const themeStyles = useTheme({
    themeColor: settings.themeColor,
    bgMode: settings.bgMode,
    fontSize: settings.fontSize,
  });

  // ========== ローカル状態 ==========
  const [inputValue, setInputValue] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [trendUpdateTime, setTrendUpdateTime] = useState<string>('');
  const [isTrendLoading, setIsTrendLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [homeTab, setHomeTab] = useState<HomeTabType>('trends');

  // ========== Refs ==========
  const intervalRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [tweetListRef] = useAutoAnimate<HTMLDivElement>({ duration: 500, easing: 'ease-out' });

  // ========== useTweets フック ==========
  const tweetsState = useTweets({
    searchKeyword,
    isScrolled,
    scrollContainerRef,
    setIsScrolled,
  });

  // ========== イベントハンドラ ==========
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const isNowScrolled = scrollContainerRef.current.scrollTop > 50;
    setIsScrolled(isNowScrolled);
  };

  const loadTrends = async () => {
    setIsTrendLoading(true);
    try {
      const result = await fetchRealtimeTrends();
      setTrends(result.items.slice(0, 50));
      setTrendUpdateTime(result.updateTime);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTrendLoading(false);
    }
  };

  const handleSearch = () => {
    if (!inputValue.trim()) {
      goHome();
      return;
    }
    searchHistoryState.addToHistory(inputValue);
    tweetsState.resetTweets();
    setSearchKeyword(inputValue);
    setCurrentView('search');
    tweetsState.loadTweets(false, inputValue);
  };

  const handleTrendClick = (keyword: string) => {
    setInputValue(keyword);
    searchHistoryState.addToHistory(keyword);
    setSearchKeyword(keyword);
    tweetsState.resetTweets();
    setCurrentView('search');
    tweetsState.loadTweets(false, keyword);
  };

  const goHome = () => {
    setInputValue('');
    setSearchKeyword('');
    tweetsState.resetTweets();
    setCurrentView('home');
    loadTrends();
  };

  const addNgUser = (handle: string) => {
    const exists = settings.ngSettings.userIds.some(u => u.text === handle);
    if (!exists) {
      settings.setNgSettings(prev => ({
        ...prev,
        userIds: [...prev.userIds, { id: crypto.randomUUID(), text: handle, isRegExp: false }],
      }));
    }
    setOpenMenuId(null);
  };

  // ========== Effects ==========
  useEffect(() => {
    loadTrends();
    if (searchKeyword) tweetsState.loadTweets(false, searchKeyword);
  }, []);

  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (settings.autoRefresh) {
      const currentInterval = currentView === 'home'
        ? settings.trendRefreshInterval
        : settings.searchRefreshInterval;
      intervalRef.current = window.setInterval(() => {
        if (currentView === 'home' && homeTab === 'trends') loadTrends();
        else if (currentView === 'search' && searchKeyword) tweetsState.loadTweets(true);
      }, currentInterval);
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [settings.autoRefresh, searchKeyword, currentView, homeTab, settings.trendRefreshInterval, settings.searchRefreshInterval, isScrolled, tweetsState.tweets]);

  // ========== フィルタリング ==========
  const filteredTweets = tweetsState.filterTweets(tweetsState.tweets, activeTab, settings.ngSettings);

  // ========== レンダリング ==========
  return (
    <div className="w-full h-screen bg-[var(--bg-color)] flex overflow-hidden transition-colors duration-300" style={themeStyles}>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes rank-in { 0% { opacity: 0; transform: translateY(-20px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-rank-in { opacity: 0; animation: rank-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>

      {openMenuId && <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setOpenMenuId(null)}></div>}

      <div className="w-full max-w-[450px] flex flex-col h-full border-r border-[var(--border-color)] bg-[var(--bg-color)] relative transition-colors duration-300">
        <Header
          t={t}
          currentView={currentView}
          homeTab={homeTab}
          setHomeTab={setHomeTab}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          inputValue={inputValue}
          setInputValue={setInputValue}
          onSearch={handleSearch}
          onGoHome={goHome}
          trendUpdateTime={trendUpdateTime}
          autoRefresh={settings.autoRefresh}
          setAutoRefresh={settings.setAutoRefresh}
          searchHistory={searchHistoryState.searchHistory}
          onRemoveHistory={searchHistoryState.removeFromHistory}
          onSuggestionClick={handleTrendClick}
          onClearAllHistory={searchHistoryState.clearAllHistory}
        />

        {currentView === 'search' && (isScrolled || tweetsState.pendingTweets.length > 0) && (
          <div className="absolute top-[120px] left-0 w-full flex justify-center z-30 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
            <button onClick={tweetsState.mergePendingTweets} className="pointer-events-auto bg-[var(--theme-color)] text-white font-bold text-sm px-4 py-2 rounded-full shadow-lg hover:brightness-110 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              <span>最新のポストへ {tweetsState.pendingTweets.length > 0 ? `(${tweetsState.pendingTweets.length}件)` : ''}</span>
            </button>
          </div>
        )}

        <main ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-hide text-[1em]">
          {currentView === 'home' && (
            <div key="home-view" className="h-full flex flex-col">
              {homeTab === 'trends' && <TrendList trends={trends} isLoading={isTrendLoading} onTrendClick={handleTrendClick} />}
              {homeTab === 'registered' && <RegisteredPanel t={t} onSearch={handleTrendClick} />}
              {homeTab === 'settings' && (
                <SettingsPanel
                  language={language}
                  setLanguage={setLanguage}
                  t={t}
                  trendRefreshInterval={settings.trendRefreshInterval}
                  setTrendRefreshInterval={settings.setTrendRefreshInterval}
                  searchRefreshInterval={settings.searchRefreshInterval}
                  setSearchRefreshInterval={settings.setSearchRefreshInterval}
                  themeColor={settings.themeColor}
                  setThemeColor={settings.setThemeColor}
                  bgMode={settings.bgMode}
                  setBgMode={settings.setBgMode}
                  fontSize={settings.fontSize}
                  setFontSize={settings.setFontSize}
                  ngSettings={settings.ngSettings}
                  setNgSettings={settings.setNgSettings}
                />
              )}
            </div>
          )}

          {currentView === 'search' && (
            <div key="search-view" className="animate-in fade-in duration-300">
              {tweetsState.isTweetLoading && (
                <div className="flex justify-center py-10"><div className="animate-spin h-6 w-6 border-4 border-[var(--theme-color)] rounded-full border-t-transparent"></div></div>
              )}
              <div className="flex flex-col" ref={tweetListRef}>
                {filteredTweets.map((tweet) => (
                  <TweetCard
                    key={tweet.id}
                    tweet={tweet}
                    activeTab={activeTab}
                    isMenuOpen={openMenuId === tweet.id}
                    onMenuToggle={setOpenMenuId}
                    onHashtagClick={handleTrendClick}
                    onAddNgUser={addNgUser}
                  />
                ))}
              </div>
              {!tweetsState.isTweetLoading && filteredTweets.length === 0 && (
                <div className="text-center py-20 text-gray-500 text-sm">ツイートが見つかりませんでした。</div>
              )}
              {/* 
                =====================================
                「もっと見る」ボタン - 将来の実装のため保留
                JSON API (/realtime/api/v1/pagination) を使用した実装が必要
                useTweets.ts の loadMoreTweets と realtimeService.ts の fetchMoreTweets を使用
                =====================================
              {!tweetsState.isTweetLoading && filteredTweets.length > 0 && tweetsState.hasMoreTweets && (
                <div className="flex justify-center py-6">
                  <button
                    onClick={tweetsState.loadMoreTweets}
                    disabled={tweetsState.isLoadingMore}
                    className="px-16 py-3 border border-[rgb(47,51,54)] rounded-sm text-[rgb(113,118,123)] text-[15px] font-medium hover:bg-[rgba(255,255,255,0.03)] transition-colors disabled:opacity-50"
                  >
                    {tweetsState.isLoadingMore ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-[var(--theme-color)] rounded-full border-t-transparent"></div>
                        <span>読み込み中...</span>
                      </div>
                    ) : (
                      <span>もっと見る</span>
                    )}
                  </button>
                </div>
              )}
              {!tweetsState.hasMoreTweets && filteredTweets.length > 0 && (
                <div className="text-center py-6 text-gray-500 text-xs">これ以上のポストはありません</div>
              )}
              */}
            </div>
          )}
        </main>
      </div>
      <div className="flex-1 bg-[var(--bg-color)] hidden sm:block transition-colors duration-300"></div>
    </div>
  );
}

export default App;