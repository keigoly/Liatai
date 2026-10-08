// 検索欄の入力補完（サジェスト）と検索履歴の並べ方の回帰テスト。
// 規則は Yahoo!リアルタイム検索のページにそろえる（履歴＋候補で最大 10 件）。
//
// 実行: npm test （Node の型ストリップ・依存追加なし）

import test from 'node:test';
import assert from 'node:assert/strict';

import { ASSIST_MAX, buildAssistItems, parseSuggestResponse } from '../src/utils/searchAssist.ts';

// 2026-10-08 に「あ」で取った実際の応答。
const REAL = ['あ', ['アジア大会', 'アムウェイ', '悪役会議室', '綾瀬はるか', '亜月ねね', 'あさイチ', 'あんスタ', 'あんしんフィルター', 'アイカツアンコール', 'aぇ'], [], []];

test('parseSuggestResponse: 実際の応答から候補 10 件', () => {
  const s = parseSuggestResponse(REAL);
  assert.equal(s.length, 10);
  assert.equal(s[0], 'アジア大会');
});

test('parseSuggestResponse: 形が違えば空・空白と重複は落とす', () => {
  assert.deepEqual(parseSuggestResponse({ a: 1 }), []);
  assert.deepEqual(parseSuggestResponse(['x']), []);
  assert.deepEqual(parseSuggestResponse(['x', ['a', ' ', 'a', 'b']]), ['a', 'b']);
});

test('buildAssistItems: 入力が空なら履歴を最大 10 件', () => {
  const hist = Array.from({ length: 12 }, (_, i) => `h${i}`);
  const items = buildAssistItems('', hist, ['x']);
  assert.equal(items.length, ASSIST_MAX);
  assert.ok(items.every((i) => i.kind === 'history'));
});

test('buildAssistItems: 前方一致の履歴 → 候補、合わせて 10 件', () => {
  const items = buildAssistItems('ひる', ['ひるおび', 'ひる', '大谷', 'ひるナンデス'], ['ひるおび', 'ひるおび 天気', 'ひるやすみ']);
  assert.deepEqual(items.map((i) => `${i.kind}:${i.text}`), [
    'history:ひるおび', 'history:ひるナンデス', 'suggest:ひるおび 天気', 'suggest:ひるやすみ',
  ]);
});

test('buildAssistItems: 候補が 10 件あれば履歴は出ない（Yahoo と同じ）', () => {
  const sug = parseSuggestResponse(REAL);
  const items = buildAssistItems('あ', ['あさイチ'], sug);
  assert.equal(items.length, 10);
  assert.ok(items.every((i) => i.kind === 'suggest'));
});
