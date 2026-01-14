// src/hooks/useTheme.ts
// テーマスタイル関連のフック

import React from 'react';
import type { BgMode, ThemeColor, FontSize } from '../types/index';

interface ThemeStyles extends React.CSSProperties {
    '--theme-color': string;
    '--bg-color': string;
    '--card-bg-color': string;
    '--border-color': string;
}

interface UseThemeProps {
    themeColor: ThemeColor;
    bgMode: BgMode;
    fontSize: FontSize;
}

/**
 * テーマに基づくCSSカスタムプロパティを生成するフック
 */
export function useTheme({ themeColor, bgMode, fontSize }: UseThemeProps): ThemeStyles {
    let bgColor = '#15202b';
    let cardBgColor = '#192734';
    let borderColor = '#38444d';

    if (bgMode === 'black') {
        bgColor = '#000000';
        cardBgColor = '#16181c';
        borderColor = '#2f3336';
    } else if (bgMode === 'darkblue') {
        bgColor = '#1e2732';
        cardBgColor = '#273340';
        borderColor = '#3e4c5a';
    }

    return {
        '--theme-color': themeColor,
        '--bg-color': bgColor,
        '--card-bg-color': cardBgColor,
        '--border-color': borderColor,
        fontSize: `${fontSize}px`,
    };
}
