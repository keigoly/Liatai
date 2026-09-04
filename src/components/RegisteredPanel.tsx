// src/components/RegisteredPanel.tsx
import { useState, useEffect, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import type { RegisteredItem, FolderItem } from '../types';
import { useSyncedStorage } from '../hooks/useSyncedStorage';
import { STORAGE_KEYS } from '../constants/index';
import type { TranslationKey } from '../i18n/translations';
import { SnsShare } from './SnsShare';

interface Props {
  t: (key: TranslationKey) => string;
  onSearch: (keyword: string) => void;
}

type SubTab = 'words' | 'folders';

const FOLDER_COLORS = [
  '#FF0000', // 赤 (0°)
  '#FF8000', // オレンジ (30°)
  '#FFD700', // 黄 (45°)
  '#80FF00', // 黄緑 (90°)
  '#00FF00', // 緑 (120°)
  '#00FF80', // エメラルド (150°)
  '#00FFFF', // シアン (180°)
  '#0080FF', // スカイブルー (210°)
  '#0000FF', // 青 (240°)
  '#8000FF', // 紫 (270°)
  '#FF00FF', // マゼンタ (300°)
  '#FF0080', // ローズ (330°)
];

export const RegisteredPanel = ({ t, onSearch }: Props) => {
  const [activeTab, setActiveTab] = useState<SubTab>(() => {
    try {
      const saved = localStorage.getItem('sidestream_registered_panel_tab');
      return (saved === 'words' || saved === 'folders') ? saved : 'words';
    } catch { return 'words'; }
  });

  // --- 登録ワード ---
  // useState + localStorage 直書きだと **クラウドへ push されない**（SYNC_KEY_MAP に載っていても、
  // 実際に push/購読を行うのは useSyncedStorage）。そのため拡張で足した/消したワードが
  // 他デバイスへ伝わらず、逆にクラウド発の変更も再マウントするまで画面に出なかった。
  const [words, setWords] = useSyncedStorage<RegisteredItem[]>(STORAGE_KEYS.REGISTERED_WORDS, []);
  const [wordInput, setWordInput] = useState('');

  const [openWordMenuId, setOpenWordMenuId] = useState<string | null>(null);

  // --- フォルダ ---
  // ダミーフォルダ（テストフォルダ1〜6）は削除した。同期に載せると「フォルダが空の端末」で
  // 既定値として生成され、そのままクラウドへ push されて他デバイスへ流出するため
  // （元から `// TODO: リリース時にダミーデータを削除` が付いていた）。
  const [folders, setFolders] = useSyncedStorage<FolderItem[]>(STORAGE_KEYS.FOLDERS, []);

  const [selectedFolderId, _setSelectedFolderId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sidestream_selected_folder_id') || null;
    } catch { return null; }
  });
  const setSelectedFolderId = (value: string | null | ((prev: string | null) => string | null)) => {
    _setSelectedFolderId(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      try { if (next) localStorage.setItem('sidestream_selected_folder_id', next); else localStorage.removeItem('sidestream_selected_folder_id'); } catch { /* ignore */ }
      return next;
    });
  };
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [modalData, setModalData] = useState<FolderItem | null>(null);
  const [modalWordInput, setModalWordInput] = useState('');

  // ドラッグ用（フォルダ一覧のみ）
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // 移動アニメーション用
  const [movedWordId, setMovedWordId] = useState<string | null>(null);
  // モーダル内ワードの3点メニュー
  const [modalWordMenuId, setModalWordMenuId] = useState<string | null>(null);
  // モーダル内ワード編集
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editingWordText, setEditingWordText] = useState('');
  // フォルダ移動確認ポップアップ
  const [moveConfirm, setMoveConfirm] = useState<{
    word: RegisteredItem;
    targetFolder: { id: string; name: string; color: string };
  } | null>(null);

  // アニメーション
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  useEffect(() => {
    localStorage.setItem('sidestream_registered_panel_tab', activeTab);
  }, [activeTab]);

  // 旧データの正規化（isPinned/items の欠落）。**変化が無ければ同じ配列を返す**ので、
  // 余計な state 更新＝余計な push を起こさない。初回マウントで 1 回だけ走る。
  const normalized = useRef(false);
  useEffect(() => {
    if (normalized.current) return;
    normalized.current = true;
    setWords(prev => prev.some(w => w.isPinned === undefined)
      ? prev.map(w => ({ ...w, isPinned: w.isPinned || false }))
      : prev);
    setFolders(prev => prev.some(f => f.items === undefined || f.isPinned === undefined)
      ? prev.map(f => ({ ...f, items: f.items || [], isPinned: f.isPinned || false }))
      : prev);
  }, [setWords, setFolders]);

  // --- ワード操作 ---
  const addWord = () => {
    if (!wordInput.trim()) return;
    const newWord: RegisteredItem = { id: crypto.randomUUID(), text: wordInput.trim(), isPinned: false };

    setWords(prev => {
      const pinned = prev.filter(w => w.isPinned);
      const unpinned = prev.filter(w => !w.isPinned);
      return [...pinned, newWord, ...unpinned];
    });
    setWordInput('');
  };

  const removeWord = (id: string) => {
    setWords(prev => prev.filter(w => w.id !== id));
    setOpenWordMenuId(null);
  };

  const toggleWordPin = (id: string) => {
    setWords(prev => {
      const target = prev.find(w => w.id === id);
      if (!target) return prev;

      const newIsPinned = !target.isPinned;
      const updatedList = prev.map(w => w.id === id ? { ...w, isPinned: newIsPinned } : w);

      const pinned = updatedList.filter(w => w.isPinned);
      const unpinned = updatedList.filter(w => !w.isPinned);
      return [...pinned, ...unpinned];
    });
    setOpenWordMenuId(null);
  };

  // --- フォルダ操作 ---
  const handleOpenCreateModal = () => {
    setModalData({ id: '', name: '', color: FOLDER_COLORS[0], items: [], isPinned: false });
    setModalWordInput('');
    setOpenMenuId(null);
  };

  const handleOpenEditModal = (folder: FolderItem) => {
    setModalData({ ...folder });
    setModalWordInput('');
    setOpenMenuId(null);
  };

  // ★修正: フォルダ追加時、固定フォルダの下（通常フォルダの先頭）に追加
  const addFolder = () => {
    if (!modalData || !modalData.name.trim()) return;

    if (modalData.id === '') {
      // 新規作成
      const newFolder = { ...modalData, id: crypto.randomUUID(), name: modalData.name.trim() };
      setFolders(prev => {
        const pinned = prev.filter(f => f.isPinned);
        const unpinned = prev.filter(f => !f.isPinned);
        return [...pinned, newFolder, ...unpinned];
      });
    } else {
      // 編集保存
      setFolders(prev => prev.map(f => f.id === modalData.id ? modalData : f));
    }
    setModalData(null);
  };

  const addModalWord = () => {
    if (!modalData || !modalWordInput.trim()) return;
    if (modalData.items.length >= 100) {
      alert('1つのフォルダに登録できるワードは最大100件までです。');
      return;
    }
    const newWord: RegisteredItem = { id: crypto.randomUUID(), text: modalWordInput.trim() };
    setModalData(prev => prev ? { ...prev, items: [...prev.items, newWord] } : null);
    setModalWordInput('');
  };

  const removeModalWord = (wordId: string) => {
    if (!modalData) return;
    setModalData(prev => prev ? { ...prev, items: prev.items.filter(w => w.id !== wordId) } : null);
    setModalWordMenuId(null);
  };

  // ワード変更: インライン編集を開始
  const startEditModalWord = (word: RegisteredItem) => {
    setEditingWordId(word.id);
    setEditingWordText(word.text);
    setModalWordMenuId(null);
  };

  // ワード変更: 確定
  const confirmEditModalWord = () => {
    if (!editingWordId || !editingWordText.trim() || !modalData) return;
    setModalData(prev => prev ? {
      ...prev,
      items: prev.items.map(w => w.id === editingWordId ? { ...w, text: editingWordText.trim() } : w),
    } : null);
    setEditingWordId(null);
    setEditingWordText('');
  };

  // ワード変更: キャンセル
  const cancelEditModalWord = () => {
    setEditingWordId(null);
    setEditingWordText('');
  };

  // 別のフォルダに移動: 移動先選択を表示
  const startMoveModalWord = (wordId: string) => {
    if (!modalData) return;
    const word = modalData.items.find(w => w.id === wordId);
    if (!word) return;
    // 3点メニューを閉じて移動先選択リストを直接表示
    setModalWordMenuId(null);
    // movingWordId に該当ワードIDをセット（移動先リストの表示に使用）
    setMoveConfirm({ word, targetFolder: { id: '', name: '', color: '' } });
  };

  // 別のフォルダに移動: 移動先を選択 → 確認ポップアップ表示
  const selectMoveTarget = (targetFolder: FolderItem) => {
    if (!moveConfirm) return;
    setMoveConfirm({ ...moveConfirm, targetFolder: { id: targetFolder.id, name: targetFolder.name, color: targetFolder.color } });
  };

  // 別のフォルダに移動: 確定（folders と modalData の両方を同時更新）
  const confirmMoveWord = () => {
    if (!moveConfirm || !moveConfirm.targetFolder.id || !modalData) return;
    const { word, targetFolder } = moveConfirm;
    // 1. 元フォルダ（保存済み）からワードを削除 & 移動先フォルダに追加（アトミック更新）
    setFolders(prev => prev.map(f => {
      if (f.id === modalData.id) return { ...f, items: f.items.filter(w => w.id !== word.id) };
      if (f.id === targetFolder.id) return { ...f, items: [word, ...f.items] };
      return f;
    }));
    // 2. モーダル（編集中コピー）からもワードを削除
    setModalData(prev => prev ? { ...prev, items: prev.items.filter(w => w.id !== word.id) } : null);
    setMoveConfirm(null);
  };

  // 別のフォルダに移動: キャンセル
  const cancelMoveWord = () => {
    setMoveConfirm(null);
  };

  const removeFolder = (id: string) => {
    if (confirm('フォルダを削除しますか？')) {
      setFolders(prev => prev.filter(f => f.id !== id));
      if (selectedFolderId === id) setSelectedFolderId(null);
      setOpenMenuId(null);
    }
  };

  // ★修正: フォルダのピン留め切り替え（ソート処理を追加）
  const togglePin = (id: string) => {
    setFolders(prev => {
      const target = prev.find(f => f.id === id);
      if (!target) return prev;

      const newIsPinned = !target.isPinned;
      const updatedList = prev.map(f => f.id === id ? { ...f, isPinned: newIsPinned } : f);

      // 固定が上、未固定が下になるように並び替え
      const pinned = updatedList.filter(f => f.isPinned);
      const unpinned = updatedList.filter(f => !f.isPinned);
      return [...pinned, ...unpinned];
    });
    setOpenMenuId(null);
  };

  const toggleFolder = (id: string) => {
    if (draggedItemIndex !== null) return;
    setSelectedFolderId(prev => prev === id ? null : id);
  };

  // --- フォルダドラッグ (単純な並び替え) ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    // 固定フォルダはドラッグ不可
    if (folders[index].isPinned) {
      e.preventDefault();
      return;
    }
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
    setOpenMenuId(null);
  };

  const handleDragEnter = (index: number) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    // 固定フォルダゾーン（上部）にはドロップ不可（壁にする）
    if (folders[index].isPinned) return;

    setFolders(prev => {
      const newFolders = [...prev];
      const item = newFolders[draggedItemIndex];
      newFolders.splice(draggedItemIndex, 1);
      newFolders.splice(index, 0, item);
      return newFolders;
    });
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  // --- モーダル内ワード移動（上下ボタン） ---
  const moveModalWordUp = (index: number) => {
    if (index <= 0 || !modalData) return;
    const movedId = modalData.items[index].id;
    setModalData(prev => {
      if (!prev) return null;
      const newItems = [...prev.items];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      return { ...prev, items: newItems };
    });
    setMovedWordId(movedId);
    setTimeout(() => setMovedWordId(null), 400);
  };

  const moveModalWordDown = (index: number) => {
    if (!modalData || index >= modalData.items.length - 1) return;
    const movedId = modalData.items[index].id;
    setModalData(prev => {
      if (!prev) return null;
      const newItems = [...prev.items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      return { ...prev, items: newItems };
    });
    setMovedWordId(movedId);
    setTimeout(() => setMovedWordId(null), 400);
  };

  return (
    <div className="flex flex-col h-full text-white relative">
      <style>{`
        @keyframes accordion-open {
          0% { opacity: 0; transform: translateY(-10px); max-height: 0; }
          100% { opacity: 1; transform: translateY(0); max-height: 500px; }
        }
        .animate-accordion {
          animation: accordion-open 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          transform-origin: top;
        }
        @keyframes modalPopup {
          0% { opacity: 0; transform: scale(0.95) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes word-highlight {
          0% { background-color: rgba(29, 155, 240, 0.4); transform: scale(1.02); }
          100% { background-color: transparent; transform: scale(1); }
        }
        .animate-word-move {
          animation: word-highlight 0.4s ease-out;
        }
      `}</style>

      {/* 共通モーダル */}
      {modalData && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setModalData(null)}>
          <div
            className="bg-[#16181c] border border-gray-700 rounded-xl p-5 w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'modalPopup 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <h3 className="font-bold text-lg mb-4 text-center">
              {modalData.id === '' ? t('createNewFolder') : t('editFolder')}
            </h3>

            <input
              type="text"
              value={modalData.name}
              onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
              className="w-full bg-[#202327] border border-gray-600 rounded px-3 py-2 text-white mb-4 focus:border-[var(--theme-color)] outline-none"
              placeholder={t('enterFolderName')}
            />

            <div className="grid grid-cols-6 gap-3 mb-5 px-2">
              {FOLDER_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setModalData({ ...modalData, color: color })}
                  className={`w-8 h-8 rounded-full transition-all mx-auto ${modalData.color === color ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <hr className="border-gray-700 mb-4" />

            <div className="flex gap-2 mb-1">
              <input
                type="text"
                value={modalWordInput}
                onChange={(e) => setModalWordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addModalWord()}
                placeholder={t('addWordOrTag')}
                className="flex-1 bg-[#202327] border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:border-[var(--theme-color)] outline-none placeholder-gray-500"
              />
              <button
                onClick={addModalWord}
                className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm font-bold"
              >
                ＋
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mb-3 text-right">
              {t('maxWordsNote')}
            </p>

            <div className="flex-1 overflow-y-auto mb-4 min-h-[150px] scrollbar-hide relative">
              {/* モーダル内メニュー閉じる用オーバーレイ */}
              {modalWordMenuId && (
                <div className="fixed inset-0 z-[65]" onClick={() => setModalWordMenuId(null)} />
              )}
              {modalData.items.length === 0 ? (
                <div className="text-center text-gray-500 text-xs py-10">{t('noRegisteredWordsShort')}</div>
              ) : (
                modalData.items.map((w, index) => (
                  <div
                    key={w.id}
                    className={`relative flex justify-between items-center p-3 border-b border-[var(--border-color)] hover:bg-[var(--card-bg-color)] transition-colors ${movedWordId === w.id ? 'animate-word-move' : ''}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* 上下移動ボタン */}
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => moveModalWordUp(index)}
                          disabled={index === 0}
                          className={`p-0.5 rounded hover:bg-gray-700 transition-colors ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-white'}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 15l-6-6-6 6" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveModalWordDown(index)}
                          disabled={index === modalData.items.length - 1}
                          className={`p-0.5 rounded hover:bg-gray-700 transition-colors ${index === modalData.items.length - 1 ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-white'}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      </div>
                      {editingWordId === w.id ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <input
                            type="text"
                            value={editingWordText}
                            onChange={(e) => setEditingWordText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmEditModalWord(); if (e.key === 'Escape') cancelEditModalWord(); }}
                            autoFocus
                            className="flex-1 min-w-0 bg-[#202327] border border-[var(--theme-color)] rounded px-2 py-1 text-sm text-white outline-none"
                          />
                          <button onClick={confirmEditModalWord} className="text-green-400 hover:text-green-300 p-1 flex-shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </button>
                          <button onClick={cancelEditModalWord} className="text-gray-500 hover:text-gray-300 p-1 flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm font-bold truncate">{w.text}</span>
                      )}
                    </div>

                    {/* 3点メニュー */}
                    {editingWordId !== w.id && (
                      <button
                        onClick={() => setModalWordMenuId(prev => prev === w.id ? null : w.id)}
                        className="text-gray-500 hover:text-white p-1 flex-shrink-0"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                    )}

                    {/* メニューポップアップ（下部のアイテムは上方向に開く） */}
                    {modalWordMenuId === w.id && (
                      <div className={`absolute right-2 z-[70] bg-[#202327] border border-gray-600 rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-150 ${index >= modalData.items.length - 3 ? 'bottom-10' : 'top-10'}`} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => startEditModalWord(w)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                          ワード変更
                        </button>
                        {/* 別のフォルダに移動（新規作成中は非表示、移動先がない場合も非表示） */}
                        {modalData.id !== '' && folders.filter(f => f.id !== modalData.id).length > 0 && (
                          <button
                            onClick={() => startMoveModalWord(w.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                            別のフォルダに移動
                          </button>
                        )}
                        <button
                          onClick={() => removeModalWord(w.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          削除
                        </button>
                      </div>
                    )}

                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3 mt-auto">
              <button onClick={() => setModalData(null)} className="flex-1 py-2 rounded-full border border-gray-600 hover:bg-gray-800 transition-colors text-sm font-bold">{t('cancel')}</button>
              <button onClick={addFolder} className="flex-1 py-2 rounded-full bg-[var(--theme-color)] text-white font-bold hover:opacity-90 transition-opacity text-sm">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* フォルダ移動確認ポップアップ */}
      {moveConfirm && modalData && (
        <div className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={cancelMoveWord}>
          <div
            className="bg-[#16181c] border border-gray-700 rounded-xl p-5 w-full max-w-xs shadow-2xl"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'modalPopup 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {!moveConfirm.targetFolder.id ? (
              <>
                {/* Step 1: 移動先フォルダを選択 */}
                <h3 className="font-bold text-base text-center text-white mb-1">ワードを移動</h3>
                <p className="text-center text-xs text-gray-400 mb-4">
                  <span className="text-[var(--theme-color)] font-bold">{moveConfirm.word.text}</span> の移動先を選択
                </p>
                <div className="max-h-[250px] overflow-y-auto scrollbar-hide mb-4">
                  {folders.filter(f => f.id !== modalData.id).map(f => (
                    <button
                      key={f.id}
                      onClick={() => selectMoveTarget(f)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-[var(--card-bg-color)] transition-colors border-b border-[var(--border-color)]"
                    >
                      <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                      <span className="truncate font-medium">{f.name}</span>
                      <span className="ml-auto text-[10px] text-gray-500">{f.items.length}件</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={cancelMoveWord}
                  className="w-full py-2 rounded-full border border-gray-600 hover:bg-gray-800 transition-colors text-sm font-bold text-white"
                >
                  キャンセル
                </button>
              </>
            ) : (
              <>
                {/* Step 2: 移動の確認 */}
                <div className="flex justify-center mb-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--theme-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                </div>
                <h3 className="font-bold text-base text-center text-white mb-3">移動の確認</h3>
                <div className="bg-[#202327] rounded-lg p-3 mb-4 text-sm">
                  <p className="text-gray-400 mb-2">
                    <span className="text-white font-bold">{moveConfirm.word.text}</span> を移動します
                  </p>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: modalData.color }} />
                    <span className="truncate">{modalData.name}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--theme-color)]"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: moveConfirm.targetFolder.color }} />
                    <span className="truncate text-white font-bold">{moveConfirm.targetFolder.name}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setMoveConfirm({ ...moveConfirm, targetFolder: { id: '', name: '', color: '' } })}
                    className="flex-1 py-2 rounded-full border border-gray-600 hover:bg-gray-800 transition-colors text-sm font-bold text-white"
                  >
                    戻る
                  </button>
                  <button
                    onClick={confirmMoveWord}
                    className="flex-1 py-2 rounded-full bg-[var(--theme-color)] text-white font-bold hover:opacity-90 transition-opacity text-sm"
                  >
                    移動する
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* メニュー閉じる用 */}
      {(openMenuId || openWordMenuId) && (
        <div className="fixed inset-0 z-30 bg-transparent" onClick={() => { setOpenMenuId(null); setOpenWordMenuId(null); }}></div>
      )}

      <div className="flex border-b border-[var(--border-color)]">
        <button
          onClick={() => setActiveTab('words')}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'words' ? 'text-[var(--theme-color)] border-b-2 border-[var(--theme-color)]' : 'text-gray-500 hover:bg-[var(--card-bg-color)]'}`}
        >
          {t('words')}
        </button>
        <button
          onClick={() => setActiveTab('folders')}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'folders' ? 'text-[var(--theme-color)] border-b-2 border-[var(--theme-color)]' : 'text-gray-500 hover:bg-[var(--card-bg-color)]'}`}
        >
          {t('folders')}
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'words' && (
          <div className="flex flex-col h-full animate-in fade-in duration-300">
            <div className="p-4 border-b border-[var(--border-color)]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={wordInput}
                  onChange={(e) => setWordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addWord()}
                  placeholder={t('enterWordOrTag')}
                  className="flex-1 bg-[var(--card-bg-color)] border border-transparent focus:border-[var(--theme-color)] rounded-full px-4 py-2 text-white placeholder-gray-500 outline-none transition-all"
                />
                <button
                  onClick={addWord}
                  className="bg-[var(--theme-color)] text-white px-5 py-2 rounded-full font-bold hover:opacity-90 transition-opacity text-sm whitespace-nowrap"
                >
                  {t('add')}
                </button>
              </div>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-hide pb-20">
              {words.length === 0 ? (
                <div className="text-center text-gray-500 py-10 text-sm">{t('noRegisteredWords')}</div>
              ) : (
                words.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSearch(item.text)}
                    className={`
                      flex justify-between items-center p-4 border-b border-[var(--border-color)] hover:bg-[var(--card-bg-color)] cursor-pointer transition-colors relative
                      ${openWordMenuId === item.id ? 'z-40' : 'z-0'}
                    `}
                  >
                    <div className="flex items-center gap-3">

                      {/* 固定ピンアイコン */}
                      {item.isPinned && (
                        <div className="text-white transform rotate-45 flex-shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
                          </svg>
                        </div>
                      )}
                      <span className="font-bold text-[1em]">{item.text}</span>
                    </div>

                    {/* ケバブメニュー */}
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenWordMenuId(openWordMenuId === item.id ? null : item.id); }}
                        className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-black/20 transition-colors"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2" /><circle cx="12" cy="6" r="2" /><circle cx="12" cy="18" r="2" /></svg>
                      </button>

                      {openWordMenuId === item.id && (
                        <div className="absolute right-0 top-full mt-1 w-28 bg-[#16181c] border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleWordPin(item.id); }}
                            className="w-full text-center px-4 py-2 text-sm text-white hover:bg-[#2f3336] transition-colors font-bold border-b border-gray-800"
                          >
                            {item.isPinned ? t('unpin') : t('pin')}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeWord(item.id); }}
                            className="w-full text-center px-4 py-2 text-sm text-red-400 hover:bg-[#2f3336] transition-colors font-bold"
                          >
                            {t('delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'folders' && (
          <div className="flex flex-col h-full animate-in fade-in duration-300">
            <div className="p-4 border-b border-[var(--border-color)]">
              <button
                onClick={handleOpenCreateModal}
                className="w-full py-3 rounded-full border border-[var(--border-color)] hover:bg-[var(--card-bg-color)] text-[var(--theme-color)] font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <span>＋</span> {t('createNewFolderButton')}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3 pb-32">
              {folders.length === 0 ? (
                <div className="text-center text-gray-500 py-10 text-sm">{t('youCanCreateFolders')}</div>
              ) : (
                folders.map((folder, index) => (
                  <div
                    key={folder.id}
                    className={`
                      relative rounded-2xl shadow-md transition-all
                      ${draggedItemIndex === index ? 'opacity-50' : 'opacity-100'}
                    `}
                    onDragOver={handleDragOver}
                    onDragEnter={() => handleDragEnter(index)}
                  >
                    <div
                      draggable={false}
                      onClick={() => toggleFolder(folder.id)}
                      style={{ backgroundColor: folder.color || FOLDER_COLORS[0] }}
                      className={`
                        flex justify-between items-center px-4 py-3 cursor-default select-none relative transition-all duration-300
                        ${selectedFolderId === folder.id ? 'rounded-t-2xl' : 'rounded-2xl'}
                        ${openMenuId === folder.id ? 'z-[100]' : 'z-10'}
                      `}
                    >
                      {/* グリップアイコン: 固定時は opacity-0 & cursor-default で表示なし・禁止マークなし */}
                      <div
                        className={`absolute left-3 top-1/2 transform -translate-y-1/2 p-2 z-20 ${folder.isPinned ? 'opacity-0 cursor-default' : 'cursor-move text-white/50 hover:text-white'}`}
                        draggable={!folder.isPinned}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        title={folder.isPinned ? "" : "ドラッグして移動"}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                      </div>

                      <span className="font-bold text-white text-[1.1em] truncate drop-shadow-md w-full text-center pointer-events-none px-10">
                        {folder.name}
                      </span>

                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-30 flex items-center">
                        {folder.isPinned && (
                          <div className="mr-2 text-white drop-shadow-md animate-in fade-in zoom-in transform rotate-45">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
                            </svg>
                          </div>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === folder.id ? null : folder.id); }}
                          className="text-white/80 hover:text-white p-2 rounded-full hover:bg-black/20 transition-colors"
                          title="メニュー"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2" /><circle cx="12" cy="6" r="2" /><circle cx="12" cy="18" r="2" /></svg>
                        </button>

                        {openMenuId === folder.id && (
                          <div
                            className="absolute right-0 top-full mt-2 w-28 bg-[#16181c] border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                            style={{ zIndex: 999 }}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenEditModal(folder); }}
                              className="w-full text-center px-4 py-3 text-sm text-white hover:bg-[#2f3336] transition-colors font-bold border-b border-gray-800"
                            >
                              {t('edit')}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); togglePin(folder.id); }}
                              className="w-full text-center px-4 py-3 text-sm text-white hover:bg-[#2f3336] transition-colors font-bold border-b border-gray-800"
                            >
                              {folder.isPinned ? t('unpin') : t('pin')}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFolder(folder.id); }}
                              className="w-full text-center px-4 py-3 text-sm text-red-400 hover:bg-[#2f3336] transition-colors font-bold"
                            >
                              {t('delete')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className={`
                        grid transition-[grid-template-rows,opacity] duration-300 ease-in-out
                        ${selectedFolderId === folder.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
                      `}
                    >
                      <div className="overflow-hidden">
                        <div className="bg-[#16181c] border-t border-gray-700 rounded-b-2xl">
                          {folder.items.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-xs">{t('noRegisteredWordsShort')}</div>
                          ) : (
                            <div className={folder.items.length > 10 ? 'max-h-[440px] overflow-y-auto scrollbar-hide' : ''}>
                              {folder.items.map(item => (
                                <div
                                  key={item.id}
                                  onClick={() => onSearch(item.text)}
                                  className="flex items-center px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-[#1d1f23] cursor-pointer transition-colors"
                                >
                                  <div className="w-6 flex justify-center flex-shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                                  </div>
                                  <span className="text-white text-sm font-bold">{item.text}</span>
                                </div>
                              ))}
                              {folder.items.length > 10 && (
                                <div className="sticky bottom-0 bg-gradient-to-t from-[#16181c] to-transparent h-6 pointer-events-none" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
      <SnsShare compact />
    </div>
  );
};