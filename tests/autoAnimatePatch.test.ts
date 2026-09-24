// auto-animate のリーク修正（patches/@formkit+auto-animate+0.9.0.patch）が当たっていることの確認。
//
// 背景: auto-animate は後始末（destroy）の後に遅れて動く位置確認タイマー／監視を、
// 切り離された要素にも作り直していた。入れ子の親では位置確認タイマーが 2 本付き、
// 登録簿が 1 本しか覚えないためもう 1 本が永久に残った。いずれも外れた DOM を握り続け、
// 検索 1 回ごとに DOM ノード約 4,000、タブ切り替え 1 往復ごとに約 137 が溜まっていた。
// 版を上げたり postinstall が走らなかったりしてパッチが外れると黙って再発するので、ここで止める。
//
// 実行: npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../node_modules/@formkit/auto-animate/index.mjs', import.meta.url), 'utf8');

test('切り離された要素の監視とタイマーを外す forget がある', () => {
  assert.match(src, /function forget\(el\)/);
});

test('遅れて来た位置確認は切り離された要素に監視を作らない', () => {
  assert.match(src, /if \(!el\.isConnected\)\s*return forget\(el\);\s*coords\.set\(el, getCoords\(el\)\);/);
});

test('位置確認タイマーは付け替え前に前の 1 本を止め、切り離されたら自分自身を止める', () => {
  assert.match(src, /const prev = intervals\.get\(el\);\s*if \(prev\)\s*clearInterval\(prev\);/);
  assert.match(src, /clearInterval\(id\);\s*return forget\(el\);/);
});
