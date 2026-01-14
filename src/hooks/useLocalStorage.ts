// src/hooks/useLocalStorage.ts
// 汎用的なローカルストレージフック

import { useState, useEffect } from 'react';
import { loadStorage, saveStorage } from '../utils/storage';

/**
 * ローカルストレージと同期するstate管理フック
 * @param key ストレージキー
 * @param defaultValue デフォルト値
 * @returns [value, setValue] のタプル
 */
export function useLocalStorage<T>(
    key: string,
    defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => loadStorage(key, defaultValue));

    useEffect(() => {
        saveStorage(key, value);
    }, [key, value]);

    return [value, setValue];
}
