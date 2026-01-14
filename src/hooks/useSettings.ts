// src/hooks/useSettings.ts
// 設定関連の状態管理フック

import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS, DEFAULTS } from '../constants/index';
import type { ThemeColor, BgMode, FontSize, NgSettings } from '../types/index';

export interface SettingsState {
    // 自動更新
    autoRefresh: boolean;
    setAutoRefresh: React.Dispatch<React.SetStateAction<boolean>>;

    // 更新間隔
    trendRefreshInterval: number;
    setTrendRefreshInterval: React.Dispatch<React.SetStateAction<number>>;
    searchRefreshInterval: number;
    setSearchRefreshInterval: React.Dispatch<React.SetStateAction<number>>;

    // テーマ
    themeColor: ThemeColor;
    setThemeColor: React.Dispatch<React.SetStateAction<ThemeColor>>;
    bgMode: BgMode;
    setBgMode: React.Dispatch<React.SetStateAction<BgMode>>;
    fontSize: FontSize;
    setFontSize: React.Dispatch<React.SetStateAction<FontSize>>;

    // NG設定
    ngSettings: NgSettings;
    setNgSettings: (settings: NgSettings | ((prev: NgSettings) => NgSettings)) => void;
}

export function useSettings(): SettingsState {
    const [autoRefresh, setAutoRefresh] = useLocalStorage<boolean>(
        STORAGE_KEYS.AUTO_REFRESH,
        DEFAULTS.AUTO_REFRESH
    );

    const [trendRefreshInterval, setTrendRefreshInterval] = useLocalStorage<number>(
        STORAGE_KEYS.TREND_INTERVAL,
        DEFAULTS.TREND_INTERVAL
    );

    const [searchRefreshInterval, setSearchRefreshInterval] = useLocalStorage<number>(
        STORAGE_KEYS.SEARCH_INTERVAL,
        DEFAULTS.SEARCH_INTERVAL
    );

    const [themeColor, setThemeColor] = useLocalStorage<ThemeColor>(
        STORAGE_KEYS.THEME_COLOR,
        DEFAULTS.THEME_COLOR
    );

    const [bgMode, setBgMode] = useLocalStorage<BgMode>(
        STORAGE_KEYS.BG_MODE,
        DEFAULTS.BG_MODE
    );

    const [fontSize, setFontSize] = useLocalStorage<FontSize>(
        STORAGE_KEYS.FONT_SIZE,
        DEFAULTS.FONT_SIZE
    );

    const [ngSettings, setNgSettingsState] = useLocalStorage<NgSettings>(
        STORAGE_KEYS.NG_SETTINGS,
        DEFAULTS.NG_SETTINGS
    );

    // NG設定用のラッパー関数
    const setNgSettings = (newSettings: NgSettings | ((prev: NgSettings) => NgSettings)) => {
        setNgSettingsState(prev => {
            return typeof newSettings === 'function' ? newSettings(prev) : newSettings;
        });
    };

    return {
        autoRefresh,
        setAutoRefresh,
        trendRefreshInterval,
        setTrendRefreshInterval,
        searchRefreshInterval,
        setSearchRefreshInterval,
        themeColor,
        setThemeColor,
        bgMode,
        setBgMode,
        fontSize,
        setFontSize,
        ngSettings,
        setNgSettings,
    };
}
