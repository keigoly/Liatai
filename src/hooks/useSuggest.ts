// src/hooks/useSuggest.ts
// 検索欄の入力補完。打鍵ごとには取りに行かず、入力が止まってから 1 回だけ取る。
// 同じ入力の候補は覚えておく（Yahoo!リアルタイム検索のページと同じ作法）。

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSuggestions, hasSuggestPermission, requestSuggestPermission } from '../services/suggestService';

const DEBOUNCE_MS = 150;
const DISMISS_KEY = 'sidestream_suggest_dismissed';

const loadDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

export interface SuggestState {
  /** いまの入力に対する候補（まだ届いていなければ空）。 */
  suggestions: string[];
  /** 取得先への権限があるか（null = 確認中）。 */
  permitted: boolean | null;
  /** 「許可する」を出すか（権限が無く、案内を閉じていない）。 */
  needsPermission: boolean;
  requestPermission: () => Promise<void>;
  dismissPermission: () => void;
}

export function useSuggest(query: string, enabled: boolean): SuggestState {
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(loadDismissed);
  const [result, setResult] = useState<{ q: string; list: string[] } | null>(null);
  const cacheRef = useRef(new Map<string, string[]>());
  const q = query.trim();

  useEffect(() => {
    let alive = true;
    const check = () => {
      hasSuggestPermission().then((ok) => {
        if (alive) setPermitted(ok);
      });
    };
    check();
    // 別のウィンドウ（サイドパネル⇔ポップアップ）で許可・取り消しされても追従する。
    const ev = typeof chrome !== 'undefined' ? chrome.permissions : undefined;
    ev?.onAdded?.addListener(check);
    ev?.onRemoved?.addListener(check);
    return () => {
      alive = false;
      ev?.onAdded?.removeListener(check);
      ev?.onRemoved?.removeListener(check);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !permitted || !q) return;
    const hit = cacheRef.current.get(q);
    const ac = new AbortController();
    const t = window.setTimeout(
      () => {
        if (hit) {
          setResult({ q, list: hit });
          return;
        }
        fetchSuggestions(q, ac.signal).then((list) => {
          if (ac.signal.aborted) return;
          cacheRef.current.set(q, list);
          setResult({ q, list });
        });
      },
      hit ? 0 : DEBOUNCE_MS,
    );
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [enabled, permitted, q]);

  const requestPermission = useCallback(async () => {
    const ok = await requestSuggestPermission();
    setPermitted(ok);
  }, []);

  const dismissPermission = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* 保存できなくてもこの画面では閉じる */
    }
    setDismissed(true);
  }, []);

  return {
    suggestions: result && result.q === q ? result.list : [],
    permitted,
    needsPermission: permitted === false && !dismissed,
    requestPermission,
    dismissPermission,
  };
}
