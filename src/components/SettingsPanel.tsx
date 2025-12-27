// src/components/SettingsPanel.tsx
import React, { useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import type { ThemeColor, BgMode, FontSize, NgSettings, NgWord } from '../types';

// ... (RegExpSwitch, SettingsAccordion コンポーネントはそのまま) ...
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
    // 修正: コメント → ワード に変更
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
              // 修正: コメント → ワード
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
          <div className="p-4 text-center text-gray-500 text-sm border-t border-[var(--border-color)]">
            （機能準備中）
          </div>
        </SettingsAccordion>

      </div>

      {renderNgEditorModal()}
    </>
  );
};