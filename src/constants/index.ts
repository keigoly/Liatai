// src/constants/index.ts
// アプリケーション全体で使用する定数を集約

import type { ThemeColor, FontSize, NgSettings } from '../types/index';

// ========== テーマカラー ==========
export const THEME_COLORS: ThemeColor[] = [
    '#1d9bf0', // Blue (default)
    '#ffd400', // Yellow
    '#f91880', // Pink
    '#7856ff', // Purple
    '#ff7a00', // Orange
    '#00ba7c', // Green
];

// ========== フォントサイズ ==========
export const FONT_SIZES: FontSize[] = [13, 14, 15, 16, 18];

// ========== 更新間隔オプション ==========
export const TREND_INTERVAL_OPTIONS = [
    { label: '1分', value: 60000 },
    { label: '3分', value: 180000 },
    { label: '5分', value: 300000 },
    { label: '10分', value: 600000 },
] as const;

export const SEARCH_INTERVAL_OPTIONS = [
    { label: '1秒', value: 1000 },
    { label: '3秒', value: 3000 },
    { label: '5秒', value: 5000 },
    { label: '10秒', value: 10000 },
] as const;

// ========== フォルダカラー ==========
export const FOLDER_COLORS = [
    '#1d9bf0', // Blue
    '#f91880', // Pink
    '#00ba7c', // Green
    '#ffd400', // Yellow
    '#71767b', // Gray
    '#794bc4', // Purple
    '#f97316', // Orange
    '#ef4444', // Red
    '#0ea5e9', // Sky
    '#8b5cf6', // Violet
    '#84cc16', // Lime
    '#a855f7', // Fuchsia
] as const;

// ========== 背景モード ==========
export const BG_MODE_OPTIONS = [
    { mode: 'default' as const, label: 'デフォルト', color: '#15202b' },
    { mode: 'darkblue' as const, label: 'ダークブルー', color: '#273340' },
    { mode: 'black' as const, label: 'ブラック', color: '#000000' },
] as const;

// ========== ストレージキー ==========
export const STORAGE_KEYS = {
    LANGUAGE: 'sidestream_settings_language',
    AUTO_REFRESH: 'sidestream_settings_autoRefresh',
    TREND_INTERVAL: 'sidestream_settings_trendInterval',
    SEARCH_INTERVAL: 'sidestream_settings_searchInterval',
    THEME_COLOR: 'sidestream_settings_themeColor',
    BG_MODE: 'sidestream_settings_bgMode',
    FONT_SIZE: 'sidestream_settings_fontSize',
    NG_SETTINGS: 'sidestream_ng_settings_v5',
    SEARCH_HISTORY: 'sidestream_search_history',
    REGISTERED_WORDS: 'sidestream_registered_words',
    FOLDERS: 'sidestream_folders',
    REGISTERED_PANEL_TAB: 'sidestream_registered_panel_tab',
} as const;

// ========== デフォルト値 ==========

export const DEFAULTS: {
    LANGUAGE: 'ja' | 'en';
    AUTO_REFRESH: boolean;
    TREND_INTERVAL: number;
    SEARCH_INTERVAL: number;
    THEME_COLOR: string;
    BG_MODE: 'default' | 'black' | 'darkblue';
    FONT_SIZE: number;
    NG_SETTINGS: NgSettings;
    SEARCH_HISTORY: string[];
    MAX_TWEETS: number;
    MAX_HISTORY: number;
} = {
    LANGUAGE: 'ja',
    AUTO_REFRESH: true,
    TREND_INTERVAL: 60000,
    SEARCH_INTERVAL: 5000,
    THEME_COLOR: '#1d9bf0',
    BG_MODE: 'default',
    FONT_SIZE: 15,
    NG_SETTINGS: { comments: [], userIds: [] },
    SEARCH_HISTORY: [],
    MAX_TWEETS: 50,
    MAX_HISTORY: 20,
};

// ========== ランクカラー ==========
export const RANK_COLORS = {
    1: 'text-[#FFD700]', // Gold
    2: 'text-[#C0C0C0]', // Silver
    3: 'text-[#C49C48]', // Bronze
    default: 'text-gray-500',
} as const;
