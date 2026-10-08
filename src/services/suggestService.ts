// src/services/suggestService.ts
// 検索欄の入力補完（サジェスト）の取得と、その取得先への権限。
//
// 取得先は Yahoo!リアルタイム検索のページ自身が使う入力補完 API（`src=realtime`）。
// 検索本体（search.yahoo.co.jp）とは別ホストなので、**任意の権限（optional_host_permissions）**にしてある。
// 必須権限に足すと、更新した時点で Chrome が拡張を止めて再許可を求めてしまうため。
// 初めて使うときにドロップダウンの「許可する」から 1 回だけ許可をもらう。

import { parseSuggestResponse } from '../utils/searchAssist';

export const SUGGEST_ORIGIN = 'https://assist-search.yahooapis.jp/*';
const SUGGEST_URL = 'https://assist-search.yahooapis.jp/SuggestSearchService/V3/webassistSearch';
// Yahoo!リアルタイム検索のページの JS に埋め込まれている公開 appid。
const SUGGEST_APPID = 'dj0zaiZpPVU5MGlSOUZ4cHVLbCZzPWNvbnN1bWVyc2VjcmV0Jng9ZGQ-';

const hasPermissionsApi = (): boolean =>
  typeof chrome !== 'undefined' && !!chrome.permissions && typeof chrome.permissions.contains === 'function';

/** 入力補完の取得先へアクセスできるか。拡張でない環境（開発サーバ等）では true 扱い（取れなければ空になるだけ）。 */
export const hasSuggestPermission = async (): Promise<boolean> => {
  if (!hasPermissionsApi()) return true;
  try {
    return await chrome.permissions.contains({ origins: [SUGGEST_ORIGIN] });
  } catch {
    return false;
  }
};

/** 権限を求める（ボタンのクリックから呼ぶこと。ユーザー操作の中でしか許可ダイアログは出せない）。 */
export const requestSuggestPermission = async (): Promise<boolean> => {
  if (!hasPermissionsApi()) return true;
  try {
    return await chrome.permissions.request({ origins: [SUGGEST_ORIGIN] });
  } catch {
    return false;
  }
};

/** 入力に対する候補（最大 10 件）。失敗は空配列。 */
export const fetchSuggestions = async (query: string, signal?: AbortSignal): Promise<string[]> => {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({ src: 'realtime', query: q, appid: SUGGEST_APPID });
  try {
    const response = await fetch(`${SUGGEST_URL}?${params.toString()}`, { signal });
    if (!response.ok) return [];
    return parseSuggestResponse(await response.json());
  } catch {
    return [];
  }
};
