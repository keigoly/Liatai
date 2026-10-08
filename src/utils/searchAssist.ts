// src/utils/searchAssist.ts
// 検索欄の入力補完（サジェスト）と検索履歴の並べ方。
//
// Yahoo!リアルタイム検索のページと同じ規則にそろえる:
//   - 入力が空 … 検索履歴（新しい順）
//   - 入力あり … 「入力で始まる履歴（入力と同じものは除く）」→「候補」の順で、合わせて最大 10 件
// 候補は Yahoo の入力補完 API（src=realtime）。応答は `["入力", ["候補", ...], [], []]`。

/** ドロップダウンに出す最大件数（Yahoo!リアルタイム検索と同じ）。 */
export const ASSIST_MAX = 10;

export type AssistItem = { kind: 'history' | 'suggest'; text: string };

/** 入力補完 API の応答から候補を取り出す。形が違えば空配列（履歴だけで続ける）。 */
export const parseSuggestResponse = (body: unknown): string[] => {
  if (!Array.isArray(body) || !Array.isArray(body[1])) return [];
  const out: string[] = [];
  for (const v of body[1]) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= ASSIST_MAX) break;
  }
  return out;
};

/** ドロップダウンの行を作る（入力が空なら履歴だけ・入力ありなら前方一致の履歴→候補）。 */
export const buildAssistItems = (query: string, history: string[], suggestions: string[]): AssistItem[] => {
  const q = query.trim();
  if (!q) return history.slice(0, ASSIST_MAX).map((text) => ({ kind: 'history', text }));
  const hist = history
    .filter((h) => h !== q && h.length >= q.length && h.startsWith(q))
    .slice(0, Math.max(0, ASSIST_MAX - suggestions.length));
  const out: AssistItem[] = hist.map((text) => ({ kind: 'history', text }));
  for (const text of suggestions) {
    if (out.length >= ASSIST_MAX) break;
    if (!out.some((o) => o.text === text)) out.push({ kind: 'suggest', text });
  }
  return out;
};
