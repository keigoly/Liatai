// src/App.tsx
import { useState, useEffect, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { fetchRealtimeTweets, fetchRealtimeTrends } from './services/realtimeService';
import type { Tweet, TrendItem } from './services/realtimeService';
import { Header } from './components/Header';
import { SettingsPanel } from './components/SettingsPanel';
import { RegisteredPanel } from './components/RegisteredPanel';
import { RelativeTime } from './components/RelativeTime';
import type { ThemeColor, BgMode, FontSize, NgSettings } from './types';

// ... (TweetText コンポーネントは変更なしのため省略) ...
const TweetText = ({ text, onHashtagClick }: { text: string, onHashtagClick: (tag: string) => void }) => {
  const parts = text.split(/((?:https?|ftp):\/\/[^\s\u3000]+|(?:pic\.(?:x|twitter)\.com\/[^\s\u3000]+)|[#＃][^\s\u3000]+)/gi);
  return (
    <p className="text-[1em] text-white leading-snug whitespace-pre-wrap break-words cursor-text">
      {parts.map((part, i) => {
        if (part.match(/^(https?|ftp):\/\//i)) {
          return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#1d9bf0] hover:underline z-10 relative">{part}</a>;
        } else if (part.match(/^pic\.(?:x|twitter)\.com\//i)) {
          return <a key={i} href={`https://${part}`} target="_blank" rel="noopener noreferrer" className="text-[#1d9bf0] hover:underline z-10 relative">{part}</a>;
        } else if (part.match(/^[#＃]/)) {
          return <span key={i} onClick={(e) => { e.stopPropagation(); onHashtagClick(part); }} className="text-[#1d9bf0] hover:underline cursor-pointer z-10 relative">{part}</span>;
        }
        return part;
      })}
    </p>
  );
};

type TabType = 'all' | 'text' | 'media';
type ViewType = 'home' | 'search';
type HomeTabType = 'trends' | 'registered' | 'settings';

function App() {
  const [inputValue, setInputValue] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [pendingTweets, setPendingTweets] = useState<Tweet[]>([]);
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [trendUpdateTime, setTrendUpdateTime] = useState<string>('');
  
  const [isTweetLoading, setIsTweetLoading] = useState(false);
  const [isTrendLoading, setIsTrendLoading] = useState(false);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trendRefreshInterval, setTrendRefreshInterval] = useState<number>(60000);
  const [searchRefreshInterval, setSearchRefreshInterval] = useState<number>(5000);
  const [themeColor, setThemeColor] = useState<ThemeColor>('#1d9bf0');
  const [bgMode, setBgMode] = useState<BgMode>('default');
  const [fontSize, setFontSize] = useState<FontSize>(15);

  const [ngSettings, setNgSettingsState] = useState<NgSettings>(() => {
    try {
      const saved = localStorage.getItem('sidestream_ng_settings_v5');
      return saved ? JSON.parse(saved) : { comments: [], userIds: [] };
    } catch { return { comments: [], userIds: [] }; }
  });

  const setNgSettings = (newSettings: NgSettings | ((prev: NgSettings) => NgSettings)) => {
    setNgSettingsState(prev => {
      const updated = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
      localStorage.setItem('sidestream_ng_settings_v5', JSON.stringify(updated));
      return updated;
    });
  };

  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sidestream_search_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [homeTab, setHomeTab] = useState<HomeTabType>('trends');
  
  const intervalRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [tweetListRef] = useAutoAnimate<HTMLDivElement>({ duration: 500, easing: 'ease-out' });

  useEffect(() => {
    localStorage.setItem('sidestream_ng_settings_v5', JSON.stringify(ngSettings));
  }, [ngSettings]);

  useEffect(() => {
    localStorage.setItem('sidestream_search_history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  const addToHistory = (keyword: string) => {
    if (!keyword.trim()) return;
    setSearchHistory(prev => {
      const newHistory = [keyword, ...prev.filter(w => w !== keyword)];
      return newHistory.slice(0, 20);
    });
  };

  const removeFromHistory = (keyword: string) => {
    setSearchHistory(prev => prev.filter(w => w !== keyword));
  };

  const clearAllHistory = () => {
    if (window.confirm('検索履歴をすべて消去しますか？')) {
      setSearchHistory([]);
    }
  };

  const getThemeStyles = () => {
    let bgColor = '#15202b';
    let cardBgColor = '#192734';
    let borderColor = '#38444d';
    if (bgMode === 'black') {
      bgColor = '#000000'; cardBgColor = '#16181c'; borderColor = '#2f3336';
    } else if (bgMode === 'darkblue') {
      bgColor = '#1e2732'; cardBgColor = '#273340'; borderColor = '#3e4c5a';
    }
    return {
      '--theme-color': themeColor,
      '--bg-color': bgColor,
      '--card-bg-color': cardBgColor,
      '--border-color': borderColor,
      fontSize: `${fontSize}px` 
    } as React.CSSProperties;
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const isNowScrolled = scrollContainerRef.current.scrollTop > 50;
    setIsScrolled(isNowScrolled);
  };

  // ★修正: ベストポスト固定を廃止し、純粋な時系列ソートに変更
  // これにより、新しいポストが来ればベストポストも下に流れます
  const sortTweets = (tweets: Tweet[]) => {
    return tweets.sort((a, b) => b.createdAt - a.createdAt);
  };

  const mergePendingTweets = () => {
    if (pendingTweets.length === 0 && !isScrolled) return;
    setTweets(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const uniquePending = pendingTweets.filter(t => !existingIds.has(t.id));
      const combined = [...uniquePending, ...prev];
      return sortTweets(combined).slice(0, 50);
    });
    setPendingTweets([]);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsScrolled(false);
  };

  const loadTweets = async (isBackground = false, targetKeyword?: string) => {
    const query = targetKeyword || searchKeyword;
    if (!query) return;
    if (!isBackground) setIsTweetLoading(true);
    
    try {
      const fetchedTweets = await fetchRealtimeTweets(query);
      
      if (isBackground && isScrolled) {
        setPendingTweets(prevPending => {
          const currentIds = new Set(tweets.map(t => t.id));
          const pendingIds = new Set(prevPending.map(t => t.id));
          const uniqueNew = fetchedTweets.filter(t => !currentIds.has(t.id) && !pendingIds.has(t.id));
          
          if (uniqueNew.length === 0) return prevPending;
          return sortTweets([...uniqueNew, ...prevPending]);
        });
      } else {
        setTweets(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const uniqueNew = fetchedTweets.filter(t => !existingIds.has(t.id));
          
          if (uniqueNew.length === 0) return prev;
          
          const combined = [...uniqueNew, ...prev];
          return sortTweets(combined).slice(0, 50);
        });
        if (!isBackground) setPendingTweets([]);
      }
    } catch (err) { 
      console.error(err); 
    } finally { 
      if (!isBackground) setIsTweetLoading(false); 
    }
  };

  // ... (以降、loadTrends, handleSearch, その他イベントハンドラ等は変更なしのため省略。全体の構成は維持してください) ...
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
    addToHistory(inputValue);
    setTweets([]); 
    setPendingTweets([]); 
    setSearchKeyword(inputValue);
    setCurrentView('search'); 
    loadTweets(false, inputValue);
  };

  const handleTrendClick = (keyword: string) => {
    setInputValue(keyword);
    addToHistory(keyword);
    setSearchKeyword(keyword); 
    setTweets([]); 
    setPendingTweets([]); 
    setCurrentView('search'); 
    loadTweets(false, keyword);
  };

  const goHome = () => {
    setInputValue(''); setSearchKeyword(''); setPendingTweets([]);
    setCurrentView('home'); setIsTweetLoading(false); loadTrends();
  };

  const addNgUser = (handle: string) => {
    const exists = ngSettings.userIds.some(u => u.text === handle);
    if (!exists) {
      setNgSettings(prev => ({
        ...prev,
        userIds: [...prev.userIds, { id: crypto.randomUUID(), text: handle, isRegExp: false }]
      }));
    }
    setOpenMenuId(null);
  };

  useEffect(() => {
    loadTrends();
    if (searchKeyword) loadTweets(false, searchKeyword);
  }, []);

  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (autoRefresh) {
      const currentInterval = (currentView === 'home') ? trendRefreshInterval : searchRefreshInterval;
      intervalRef.current = window.setInterval(() => {
        if (currentView === 'home' && homeTab === 'trends') loadTrends();
        else if (currentView === 'search' && searchKeyword) loadTweets(true);
      }, currentInterval);
    }
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, [autoRefresh, searchKeyword, currentView, homeTab, trendRefreshInterval, searchRefreshInterval, isScrolled, tweets]);

  const filteredTweets = tweets.filter(tweet => {
    if (activeTab === 'media' && !tweet.mediaUrl) return false;
    if (activeTab === 'text' && tweet.mediaUrl) return false;
    const isNgUser = ngSettings.userIds.some(ng => {
      if (!ng.text) return false;
      const target = ng.text.trim();
      if (ng.isRegExp) { try { return new RegExp(target, 'i').test(tweet.handle); } catch { return false; } } 
      else { return tweet.handle.replace('@', '') === target.replace('@', ''); }
    });
    if (isNgUser) return false;
    const isNgComment = ngSettings.comments.some(ng => {
      if (!ng.text) return false;
      if (ng.isRegExp) { try { return new RegExp(ng.text, 'i').test(tweet.text); } catch { return false; } } 
      else { return tweet.text.includes(ng.text); }
    });
    if (isNgComment) return false;
    return true;
  });

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-[#FFD700]'; case 2: return 'text-[#C0C0C0]'; case 3: return 'text-[#C49C48]'; default: return 'text-gray-500';
    }
  };

  const renderTrendStatus = (state: string) => {
    switch (state) {
      case 'up': return <div className="flex justify-center pt-1"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div>;
      case 'down': return <div className="flex justify-center pt-1"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg></div>;
      case 'new': return <span className="text-[0.6em] font-bold text-orange-400 border border-orange-400 px-1 rounded">NEW</span>;
      default: return <span className="text-gray-600 text-[1.2em] leading-none">-</span>;
    }
  };

  return (
    <div className="w-full h-screen bg-[var(--bg-color)] flex overflow-hidden transition-colors duration-300" style={getThemeStyles()}>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes rank-in { 0% { opacity: 0; transform: translateY(-20px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-rank-in { opacity: 0; animation: rank-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>

      {openMenuId && <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setOpenMenuId(null)}></div>}

      <div className="w-full max-w-[450px] flex flex-col h-full border-r border-[var(--border-color)] bg-[var(--bg-color)] relative transition-colors duration-300">
        
        <Header 
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
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          searchHistory={searchHistory}
          onRemoveHistory={removeFromHistory}
          onSuggestionClick={handleTrendClick}
          onClearAllHistory={clearAllHistory}
        />

        {currentView === 'search' && (isScrolled || pendingTweets.length > 0) && (
          <div className="absolute top-[120px] left-0 w-full flex justify-center z-30 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
            <button onClick={mergePendingTweets} className="pointer-events-auto bg-[var(--theme-color)] text-white font-bold text-sm px-4 py-2 rounded-full shadow-lg hover:brightness-110 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              <span>最新のポストへ {pendingTweets.length > 0 ? `(${pendingTweets.length}件)` : ''}</span>
            </button>
          </div>
        )}

        <main ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-hide text-[1em]">
          
          {currentView === 'home' && (
            <div key="home-view" className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-full flex flex-col">
              {homeTab === 'trends' && (
                <div className="pb-10 pt-2">
                  {isTrendLoading ? (
                     <div className="text-center py-10 text-gray-500"><div className="animate-spin h-6 w-6 border-4 border-gray-500 rounded-full border-t-transparent mx-auto mb-2"></div>トレンド取得中...</div>
                  ) : trends.length === 0 ? (
                     <div className="text-center py-10 text-gray-500">トレンドを取得できませんでした。</div>
                  ) : (
                    trends.map((item, index) => (
                      <div 
                        key={item.rank} 
                        onClick={() => handleTrendClick(item.keyword)} 
                        className="flex p-3 border-b border-[var(--border-color)] hover:bg-[var(--card-bg-color)] cursor-pointer transition-colors animate-rank-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex flex-col items-center w-10 mr-3 pt-1">
                          <span className={`text-[1.3em] font-bold leading-none mb-1 ${getRankColor(item.rank)}`}>{item.rank}</span>
                          {renderTrendStatus(item.state)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[1em] text-white leading-snug mb-1">{item.keyword}</div>
                          {item.description && <p className="text-[0.8em] text-gray-400 line-clamp-2 leading-relaxed mb-1">{item.description}</p>}
                        </div>
                        {item.imageUrl && (
                          <div className="ml-3 w-16 h-16 flex-shrink-0">
                            <img src={item.imageUrl} alt="Trend" className="w-full h-full object-cover rounded-lg border border-gray-700"/>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {homeTab === 'registered' && (
                <RegisteredPanel onSearch={handleTrendClick} />
              )}

              {homeTab === 'settings' && (
                <SettingsPanel 
                  trendRefreshInterval={trendRefreshInterval}
                  setTrendRefreshInterval={setTrendRefreshInterval}
                  searchRefreshInterval={searchRefreshInterval}
                  setSearchRefreshInterval={setSearchRefreshInterval}
                  themeColor={themeColor}
                  setThemeColor={setThemeColor}
                  bgMode={bgMode}
                  setBgMode={setBgMode}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                  ngSettings={ngSettings}
                  setNgSettings={setNgSettings}
                />
              )}
            </div>
          )}

          {currentView === 'search' && (
            <div key="search-view" className="animate-in fade-in duration-300">
              {isTweetLoading && (
                <div className="flex justify-center py-10"><div className="animate-spin h-6 w-6 border-4 border-[var(--theme-color)] rounded-full border-t-transparent"></div></div>
              )}
              
              <div className="flex flex-col" ref={tweetListRef}>
                {filteredTweets.map((tweet) => (
                  <div key={tweet.id} className="border-b border-[var(--border-color)] hover:bg-[var(--card-bg-color)] transition-colors relative">
                    <div className="p-4 flex gap-3">
                      <a href={`https://x.com/${tweet.handle.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 group">
                        {tweet.iconUrl ? (
                          <img src={tweet.iconUrl} alt={tweet.author} className="w-10 h-10 rounded-full object-cover bg-gray-700 group-hover:brightness-90 transition-all" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                        ) : null}
                        <div className={`w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-[1.1em] font-bold text-white overflow-hidden group-hover:brightness-90 transition-all ${tweet.iconUrl ? 'hidden' : ''}`}>{tweet.author.charAt(0)}</div>
                      </a>
                      <div className="flex-1 min-w-0 relative">
                        <div className="flex items-baseline justify-between mb-0.5">
                          <div className="flex flex-wrap gap-1 items-baseline min-w-0 pr-6">
                            <a href={`https://x.com/${tweet.handle.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="group flex items-baseline gap-1 min-w-0">
                              <span className="font-bold text-[1em] text-white truncate max-w-[120px] group-hover:underline decoration-white">{tweet.author}</span>
                              <span className="text-[0.9em] text-[#1d9bf0] truncate hover:underline">{tweet.handle}</span>
                            </a>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === tweet.id ? null : tweet.id); }} className="text-gray-500 hover:text-[var(--theme-color)] p-1 rounded-full hover:bg-[var(--card-bg-color)] transition-colors absolute right-0 top-[-4px] z-50">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2" /><circle cx="12" cy="4" r="2" /><circle cx="12" cy="20" r="2" /></svg>
                          </button>
                          {openMenuId === tweet.id && (
                            <div className="absolute right-0 top-6 w-48 bg-[#000000] border border-[var(--border-color)] rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                              <button onClick={(e) => { e.stopPropagation(); addNgUser(tweet.handle); }} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-[var(--theme-color)] transition-colors font-bold flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>このユーザーをNGにする
                              </button>
                            </div>
                          )}
                        </div>
                        <TweetText text={tweet.text} onHashtagClick={handleTrendClick} />
                        {activeTab !== 'text' && tweet.mediaUrl && (
                          <div className="mt-3"><img src={tweet.mediaUrl} alt="Attached media" className="rounded-lg border border-gray-700 max-h-60 w-auto object-contain"/></div>
                        )}
                        <div className="flex items-center mt-3 text-gray-500 text-[0.85em]">
                          <div className="flex gap-8">
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-[var(--theme-color)] transition-colors"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg></div>
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-green-400 transition-colors"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>{tweet.retweetCount && <span className="text-xs ml-1">{tweet.retweetCount}</span>}</div>
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-pink-400 transition-colors"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>{tweet.likeCount && <span className="text-xs ml-1">{tweet.likeCount}</span>}</div>
                          </div>
                          {/* ★修正: 返信ポストなどで時刻が「Now」など固定文字の場合はそのまま、そうでなければRelativeTime */}
                          <a href={tweet.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[#1d9bf0] hover:underline cursor-pointer">
                            {tweet.timestamp === 'Now' ? 'Now' : <RelativeTime initialText={tweet.timestamp} createdAt={tweet.createdAt} />}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {!isTweetLoading && filteredTweets.length === 0 && <div className="text-center py-20 text-gray-500 text-sm">ツイートが見つかりませんでした。</div>}
            </div>
          )}
        </main>
      </div>
      <div className="flex-1 bg-[var(--bg-color)] hidden sm:block transition-colors duration-300"></div>
    </div>
  );
}

export default App;