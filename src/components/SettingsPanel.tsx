// src/components/SettingsPanel.tsx
import React, { useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import type { ThemeColor, BgMode, FontSize, NgSettings, NgWord } from '../types';

const RegExpSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={`w-11 h-6 rounded-full peer transition-colors duration-200 ease-in-out ${checked ? 'bg-[var(--theme-color)]' : 'bg-gray-600'}`}></div>
      <div className={`absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-transform duration-200 ease-in-out ${checked ? 'translate-x-full border-white' : ''}`}></div>
    </label>
  );
};

const SettingsAccordion: React.FC<AccordionProps> = ({ title, currentValueLabel, isOpen, onToggle, children }) => {
  const [animationParent] = useAutoAnimate({ duration: 300, easing: 'ease-in-out' });
  return (
    <div ref={animationParent} className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--card-bg-color)] transition-colors">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-left hover:brightness-110 transition-all z-10 relative bg-[var(--card-bg-color)]">
        <div>
          <div className="text-sm font-bold text-white">{title}</div>
          {currentValueLabel && <div className="text-xs text-gray-400 mt-0.5">現在: {currentValueLabel}</div>}
        </div>
        <div className={`text-gray-400 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180' : ''}`}>▼</div>
      </button>
      {isOpen && <div className="border-t border-[var(--border-color)] bg-[var(--bg-color)]">{children}</div>}
    </div>
  );
};

interface AccordionProps {
  title: string;
  currentValueLabel?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

interface SettingsPanelProps {
  trendRefreshInterval: number;
  setTrendRefreshInterval: (val: number) => void;
  searchRefreshInterval: number;
  setSearchRefreshInterval: (val: number) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  bgMode: BgMode;
  setBgMode: (mode: BgMode) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  ngSettings: NgSettings;
  setNgSettings: (settings: NgSettings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  trendRefreshInterval, setTrendRefreshInterval, searchRefreshInterval, setSearchRefreshInterval,
  themeColor, setThemeColor, bgMode, setBgMode, fontSize, setFontSize,
  ngSettings, setNgSettings
}) => {
  const [isTrendSettingOpen, setIsTrendSettingOpen] = useState(false);
  const [isSearchSettingOpen, setIsSearchSettingOpen] = useState(false);
  const [isNgSettingOpen, setIsNgSettingOpen] = useState(false);
  const [isDesignSettingOpen, setIsDesignSettingOpen] = useState(false);
  const [isOtherSettingOpen, setIsOtherSettingOpen] = useState(false);

  const [parent] = useAutoAnimate({ duration: 300, easing: 'ease-in-out' });

  type NgEditMode = 'none' | 'comments' | 'userIds';
  const [ngEditMode, setNgEditMode] = useState<NgEditMode>('none');
  const [tempNgSettings, setTempNgSettings] = useState<NgSettings>(ngSettings);
  
  const [isClosing, setIsClosing] = useState(false);
  const [ngListRef] = useAutoAnimate({ duration: 300, easing: 'ease-in-out' });

  const startEdit = (mode: 'comments' | 'userIds') => {
    setTempNgSettings(JSON.parse(JSON.stringify(ngSettings)));
    setNgEditMode(mode);
    setIsClosing(false);
  };

  const closeModal = (onComplete: () => void) => {
    setIsClosing(true);
    setTimeout(() => {
      onComplete();
      setNgEditMode('none');
      setIsClosing(false);
    }, 280);
  };

  const handleCancel = () => {
    closeModal(() => {
      setTempNgSettings(ngSettings);
    });
  };

  const handleSave = () => {
    closeModal(() => {
      const cleanedSettings: NgSettings = {
          comments: tempNgSettings.comments.filter(w => w.text.trim() !== ''),
          userIds: tempNgSettings.userIds.filter(w => w.text.trim() !== '')
      };
      setNgSettings(cleanedSettings);
    });
  };

  const addNgWord = () => {
    if (ngEditMode === 'none') return;
    const initialText = ngEditMode === 'userIds' ? '@' : '';
    const newWord: NgWord = { id: crypto.randomUUID(), text: initialText, isRegExp: false };
    
    setTempNgSettings(prev => ({
      ...prev,
      [ngEditMode]: [...prev[ngEditMode], newWord]
    }));
  };

  const updateNgWord = (id: string, updates: Partial<NgWord>) => {
    if (ngEditMode === 'none') return;
    
    if (ngEditMode === 'userIds' && updates.text !== undefined) {
      if (updates.text.length > 0 && !updates.text.startsWith('@')) {
        updates.text = '@' + updates.text;
      }
    }

    setTempNgSettings(prev => ({
      ...prev,
      [ngEditMode]: prev[ngEditMode].map(w => w.id === id ? { ...w, ...updates } : w)
    }));
  };

  const deleteNgWord = (id: string) => {
    if (ngEditMode === 'none') return;
    setTempNgSettings(prev => ({
      ...prev,
      [ngEditMode]: prev[ngEditMode].filter(w => w.id !== id)
    }));
  };

  const trendIntervalOptions = [
    { label: '1分', value: 60000 },
    { label: '3分', value: 180000 },
    { label: '5分', value: 300000 },
    { label: '10分', value: 600000 },
  ];

  const searchIntervalOptions = [
    { label: '1秒', value: 1000 },
    { label: '3秒', value: 3000 },
    { label: '5秒', value: 5000 },
    { label: '10秒', value: 10000 },
  ];

  const colors: ThemeColor[] = ['#1d9bf0', '#ffd400', '#f91880', '#7856ff', '#ff7a00', '#00ba7c'];
  const fontSizes: FontSize[] = [13, 14, 15, 16, 18];

  const renderNgEditorModal = () => {
    if (ngEditMode === 'none') return null;
    const currentList = tempNgSettings[ngEditMode];
    const title = ngEditMode === 'comments' ? 'ワード' : 'ユーザーID';
    
    const backdropClass = isClosing ? 'animate-fade-out' : 'animate-fade-in';
    const modalClass = isClosing ? 'animate-spring-out' : 'animate-spring-in';

    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[10px] ${backdropClass}`}>
        <div className={`w-[90%] max-w-[400px] max-h-[80vh] flex flex-col bg-[var(--card-bg-color)] rounded-xl shadow-2xl border border-[var(--border-color)] overflow-hidden ${modalClass}`}>
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--card-bg-color)]">
            <div className="flex items-center text-base font-bold text-white gap-2">
              <span className="text-gray-400">NG設定</span>
              <span className="text-gray-500">›</span>
              <span>{title}</span>
            </div>
            <button onClick={addNgWord} className="bg-[var(--theme-color)] hover:brightness-110 text-white p-2 rounded-lg transition-all shadow-lg flex items-center gap-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
          <div className="flex items-center px-4 py-2 text-xs font-bold text-gray-400 bg-[var(--bg-color)] border-b border-[var(--border-color)]">
            <div className="flex-1">テキスト</div>
            <div className="w-16 text-center">正規表現</div>
            <div className="w-10 text-center">削除</div>
          </div>
          <div ref={ngListRef} className="flex-1 overflow-y-auto scrollbar-hide bg-[var(--bg-color)] p-2 space-y-2 min-h-[200px]">
              {currentList.map((word) => (
                  <div key={word.id} className="flex items-center p-2 border border-[var(--border-color)] rounded-lg bg-[var(--card-bg-color)] shadow-sm">
                      <input 
                          type="text" 
                          value={word.text} 
                          onChange={(e) => updateNgWord(word.id, { text: e.target.value })}
                          placeholder={ngEditMode === 'userIds' ? "@user_id" : "NGワードを入力..."}
                          autoFocus={!word.text || word.text === '@'} 
                          className="flex-1 bg-transparent border-none focus:outline-none text-white text-sm placeholder-gray-600 px-2"
                      />
                      <div className="w-16 flex justify-center">
                          <RegExpSwitch checked={word.isRegExp} onChange={(checked) => updateNgWord(word.id, { isRegExp: checked })} />
                      </div>
                      <div className="w-10 flex justify-center">
                          <button onClick={() => deleteNgWord(word.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-800">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                      </div>
                  </div>
              ))}
              {currentList.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  {ngEditMode === 'userIds' ? (
                    <>
                      <p className="text-sm font-bold">登録されたIDはありません</p>
                      <p className="text-xs mt-1">@から始まるIDを登録してください</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">登録されたワードはありません</p>
                      <p className="text-xs mt-1">右上の「＋」ボタンで追加できます</p>
                    </>
                  )}
                </div>
              )}
          </div>
          <div className="flex justify-end gap-3 p-4 border-t border-[var(--border-color)] bg-[var(--card-bg-color)]">
            <button onClick={handleCancel} className="px-5 py-2 text-sm font-bold text-gray-300 hover:text-white transition-colors flex items-center gap-1">
              ✕ キャンセル
            </button>
            <button onClick={handleSave} className="px-6 py-2 text-sm font-bold text-white bg-[var(--theme-color)] rounded-lg hover:brightness-110 shadow-lg transition-all flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              保存
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes spring-in {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          50% { opacity: 1; transform: scale(1.03) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spring-out {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          20% { opacity: 1; transform: scale(1.02) translateY(0); }
          100% { opacity: 0; transform: scale(0.9) translateY(10px); }
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }

        .animate-spring-in { animation: spring-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-spring-out { animation: spring-out 0.3s ease-in forwards; }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-fade-out { animation: fade-out 0.3s ease-in forwards; }
      `}</style>

      <div className="p-4 space-y-4" ref={parent}>
        <SettingsAccordion
          title="トレンドの自動更新の間隔"
          currentValueLabel={trendIntervalOptions.find(o => o.value === trendRefreshInterval)?.label || `${trendRefreshInterval/60000}分`}
          isOpen={isTrendSettingOpen}
          onToggle={() => setIsTrendSettingOpen(!isTrendSettingOpen)}
        >
          <div className="space-y-2">
            {trendIntervalOptions.map((option) => (
              <label key={`trend-${option.value}`} className="flex items-center justify-between p-3 rounded-lg cursor-pointer border border-[var(--border-color)] hover:bg-[var(--card-bg-color)] transition-colors">
                <div className="flex items-center gap-3">
                  <input type="radio" name="trendRefreshInterval" value={option.value} checked={trendRefreshInterval === option.value} onChange={() => setTrendRefreshInterval(option.value)} className="accent-[var(--theme-color)] w-4 h-4" />
                  <span className="text-sm text-white">{option.label}</span>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3 px-1">※自動更新スイッチがONの場合に有効です。</p>
        </SettingsAccordion>

        <SettingsAccordion
          title="検索ワード時の自動更新の間隔"
          currentValueLabel={searchIntervalOptions.find(o => o.value === searchRefreshInterval)?.label || `${searchRefreshInterval/1000}秒`}
          isOpen={isSearchSettingOpen}
          onToggle={() => setIsSearchSettingOpen(!isSearchSettingOpen)}
        >
          <div className="space-y-2">
            {searchIntervalOptions.map((option, idx) => (
              <label key={`search-${option.value}-${idx}`} className="flex items-center justify-between p-3 rounded-lg cursor-pointer border border-[var(--border-color)] hover:bg-[var(--card-bg-color)] transition-colors">
                <div className="flex items-center gap-3">
                  <input type="radio" name="searchRefreshInterval" value={option.value} checked={searchRefreshInterval === option.value} onChange={() => setSearchRefreshInterval(option.value)} className="accent-[var(--theme-color)] w-4 h-4" />
                  <span className="text-sm text-white">{option.label}</span>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3 px-1">※自動更新スイッチがONの場合に有効です。</p>
        </SettingsAccordion>

        <SettingsAccordion
          title="NG設定"
          isOpen={isNgSettingOpen}
          onToggle={() => setIsNgSettingOpen(!isNgSettingOpen)}
        >
          <div className="p-2 space-y-2">
            {[
              { key: 'comments', label: 'ワード', count: ngSettings.comments.length },
              { key: 'userIds', label: 'ユーザーID', count: ngSettings.userIds.length },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 bg-[var(--card-bg-color)] rounded-lg border border-[var(--border-color)]">
                <div>
                  <div className="text-sm font-bold text-white">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.count}件</div>
                </div>
                <button onClick={() => startEdit(item.key as 'comments' | 'userIds')} className="px-4 py-2 text-sm font-bold text-white bg-[var(--card-bg-color)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-color)] transition-all flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                  編集
                </button>
              </div>
            ))}
            <p className="text-xs text-gray-500 px-1 mt-2">※ここに登録したワードを含むポストは表示されなくなります。</p>
          </div>
        </SettingsAccordion>

        <SettingsAccordion
          title="デザイン"
          currentValueLabel="フォントサイズ・色・背景"
          isOpen={isDesignSettingOpen}
          onToggle={() => setIsDesignSettingOpen(!isDesignSettingOpen)}
        >
          <div className="p-2 space-y-6">
            <div>
              <div className="text-xs text-gray-400 font-bold mb-3">フォントサイズ</div>
              <div className="flex items-center justify-between bg-[var(--card-bg-color)] rounded-full px-4 py-3 border border-[var(--border-color)]">
                <span className="text-xs text-gray-500">Aa</span>
                <div className="flex-1 mx-4 flex justify-between items-center relative">
                    <div className="absolute left-0 right-0 h-1 bg-gray-600 rounded-full z-0"></div>
                    {fontSizes.map((size) => (
                      <div key={size} onClick={() => setFontSize(size)} className={`w-4 h-4 rounded-full z-10 cursor-pointer transition-all duration-200 ${fontSize === size ? 'bg-[var(--theme-color)] scale-125 ring-2 ring-[var(--bg-color)]' : 'bg-gray-500 hover:bg-gray-400'}`}></div>
                    ))}
                </div>
                <span className="text-lg text-gray-500">Aa</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-bold mb-3">色</div>
              <div className="flex justify-between items-center bg-[var(--card-bg-color)] rounded-xl px-4 py-3 border border-[var(--border-color)]">
                {colors.map((color) => (
                  <div key={color} onClick={() => setThemeColor(color)} className="w-8 h-8 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-110" style={{ backgroundColor: color }}>
                    {themeColor === color && (<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>)}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-bold mb-3">背景</div>
              <div className="flex flex-col gap-2 bg-[var(--card-bg-color)] p-2 rounded-xl border border-[var(--border-color)]">
                {[ { mode: 'default', label: 'デフォルト', color: '#15202b' }, { mode: 'darkblue', label: 'ダークブルー', color: '#273340' }, { mode: 'black', label: 'ブラック', color: '#000000' } ].map((item) => (
                  <div key={item.mode} onClick={() => setBgMode(item.mode as BgMode)} className={`w-full p-3 rounded-lg cursor-pointer border-2 transition-all flex items-center gap-3 ${bgMode === item.mode ? 'border-[var(--theme-color)]' : 'border-transparent hover:brightness-110'}`} style={{ backgroundColor: item.color }}>
                      <div className={`w-4 h-4 rounded-full border border-gray-500 flex items-center justify-center flex-shrink-0 ${bgMode === item.mode ? 'bg-[var(--theme-color)] border-transparent' : ''}`}>
                        {bgMode === item.mode && <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                      </div>
                      <span className="text-sm text-white font-bold">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SettingsAccordion>

        <SettingsAccordion
          title="その他・問い合わせ"
          isOpen={isOtherSettingOpen}
          onToggle={() => setIsOtherSettingOpen(!isOtherSettingOpen)}
        >
          <div className="flex flex-col bg-[var(--card-bg-color)]">
            
            {/* 1. 不具合の報告 */}
            <a 
              href="https://docs.google.com/forms/d/e/1FAIpQLSeUlF5s7vgcG0RrISNrAwLKhMQTvJpndH8e31Z_WHF081McEA/viewform?usp=dialog"
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border-b border-[var(--border-color)] hover:bg-[var(--bg-color)] transition-colors group"
            >
              <div className="p-2 rounded-full bg-red-500/10 text-red-400 group-hover:bg-red-500/20 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">不具合の報告</div>
                <div className="text-xs text-gray-500">バグ報告や機能要望はこちら</div>
              </div>
              <svg className="text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>

            {/* 2. GitHub ソースコード */}
            <a 
              href="https://github.com/keigoly/Liatai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border-b border-[var(--border-color)] hover:bg-[var(--bg-color)] transition-colors group"
            >
              <div className="p-2 rounded-full bg-gray-700/30 text-white group-hover:bg-gray-700/50 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">ソースコード</div>
                <div className="text-xs text-gray-500">GitHubでコードを見る</div>
              </div>
              <svg className="text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>

            {/* 3. Amazon 欲しいものリスト */}
            <a 
              href="https://www.amazon.co.jp/hz/wishlist/ls/EB28J89CZWVI?ref_=list_d_wl_lfu_nav_5"
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 hover:bg-[var(--bg-color)] transition-colors group"
            >
              <div className="p-2 rounded-full bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">開発者を支援する</div>
                <div className="text-xs text-gray-500">Amazon 欲しいものリスト</div>
              </div>
              <svg className="text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>

          </div>
        </SettingsAccordion>

      </div>

      {renderNgEditorModal()}
    </>
  );
};