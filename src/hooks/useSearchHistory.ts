// src/hooks/useSearchHistory.ts
// 検索履歴管理フック

import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS, DEFAULTS } from '../constants/index';

export interface SearchHistoryState {
    searchHistory: string[];
    addToHistory: (keyword: string) => void;
    removeFromHistory: (keyword: string) => void;
    clearAllHistory: () => void;
}

/**
 * 検索履歴を管理するフック
 */
export function useSearchHistory(): SearchHistoryState {
    const [searchHistory, setSearchHistory] = useLocalStorage<string[]>(
        STORAGE_KEYS.SEARCH_HISTORY,
        DEFAULTS.SEARCH_HISTORY
    );

    const addToHistory = (keyword: string) => {
        if (!keyword.trim()) return;
        setSearchHistory(prev => {
            const newHistory = [keyword, ...prev.filter(w => w !== keyword)];
            return newHistory.slice(0, DEFAULTS.MAX_HISTORY);
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

    return {
        searchHistory,
        addToHistory,
        removeFromHistory,
        clearAllHistory,
    };
}
