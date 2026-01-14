// src/utils/storage.ts
// ローカルストレージ操作のユーティリティ関数

/**
 * ローカルストレージから値を読み込む
 * @param key ストレージキー
 * @param defaultValue デフォルト値
 * @returns 保存された値またはデフォルト値
 */
export const loadStorage = <T>(key: string, defaultValue: T): T => {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
        console.error(`Failed to load ${key}`, e);
        return defaultValue;
    }
};

/**
 * ローカルストレージに値を保存する
 * @param key ストレージキー
 * @param value 保存する値
 */
export const saveStorage = <T>(key: string, value: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`Failed to save ${key}`, e);
    }
};
