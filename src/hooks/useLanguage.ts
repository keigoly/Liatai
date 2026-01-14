// src/hooks/useLanguage.ts
// 言語設定を管理するフック

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { translations, type Language, type TranslationKey } from '../i18n/translations';
import { STORAGE_KEYS, DEFAULTS } from '../constants/index';

export interface UseLanguageReturn {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey) => string;
}

export function useLanguage(): UseLanguageReturn {
    const [language, setLanguage] = useLocalStorage<Language>(
        STORAGE_KEYS.LANGUAGE,
        DEFAULTS.LANGUAGE
    );

    const t = useCallback((key: TranslationKey): string => {
        return translations[language][key] ?? translations.ja[key] ?? key;
    }, [language]);

    return useMemo(() => ({
        language,
        setLanguage,
        t,
    }), [language, setLanguage, t]);
}
