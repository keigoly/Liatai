// フォルダ／登録ワードの 3-way マージ（同期の基準＝base 付き）の回帰テスト。
//
// 背景: union（mergeFolders）は「足した」しか表現できない。削除は墓標で補ったが、
// **別フォルダへの移動**や**フォルダから外す**では id が消えないので墓標が作られず、
// 他デバイスで移動しても、この拡張が元フォルダにワードを残し続け、次の push で
// 相手側でも元フォルダに戻っていた。base からの変更同士を合わせる方式でこれを直す。
//
// 実行: npm test （Node の型ストリップ・依存追加なし）

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeFolders, merge3Folders, merge3RegisteredWords, mergeFoldersWithoutBase, dropDeletedFolders,
} from '../src/utils/syncMerge.ts';
import type { FolderItem, RegisteredItem } from '../src/types/index.ts';

const w = (id: string, extra: Partial<RegisteredItem> = {}): RegisteredItem => ({ id, text: `t-${id}`, ...extra });
const f = (id: string, items: string[], extra: Partial<FolderItem> = {}): FolderItem =>
  ({ id, name: `F-${id}`, color: '#1d9bf0', isPinned: false, items: items.map(i => w(i)), ...extra });
const shape = (folders: FolderItem[]) => folders.map(x => `${x.id}:[${x.items.map(i => i.id).join(',')}]`);

// ── ご報告の症状そのもの ─────────────────────────────────────

test('旧実装（union）: 相手が別フォルダへ移したワードが元フォルダにも残る（＝不具合の再現）', () => {
  const local = [f('A', ['w1', 'w2']), f('B', [])];
  const remote = [f('A', ['w2']), f('B', ['w1'])]; // 相手が w1 を A→B へ移動
  assert.deepEqual(shape(mergeFolders(local, remote, 0, 1)), ['A:[w1,w2]', 'B:[w1]']);
});

test('3-way: 相手が別フォルダへ移したワードは元フォルダから消えて移動先にだけ在る', () => {
  const base = [f('A', ['w1', 'w2']), f('B', [])];
  const local = base; // こちらは何も変えていない
  const remote = [f('A', ['w2']), f('B', ['w1'])];
  assert.deepEqual(shape(merge3Folders(base, local, remote)), ['A:[w2]', 'B:[w1]']);
});

test('3-way: 相手がフォルダから外した（墓標が無い）ワードもこちらから消える', () => {
  const base = [f('A', ['w1', 'w2'])];
  const remote = [f('A', ['w2'])];
  assert.deepEqual(shape(merge3Folders(base, base, remote)), ['A:[w2]']);
});

test('3-way: こちらで移動したものは、相手が変えていなければそのまま残る（押し戻されない）', () => {
  const base = [f('A', ['w1', 'w2']), f('B', [])];
  const local = [f('A', ['w2']), f('B', ['w1'])];
  const remote = base; // 相手はまだ古い（こちらの push 前の値）
  assert.deepEqual(shape(merge3Folders(base, local, remote)), ['A:[w2]', 'B:[w1]']);
});

// ── 両側に変更がある ─────────────────────────────────────────

test('こちらの移動と相手の追加は両方生きる', () => {
  const base = [f('A', ['w1', 'w2']), f('B', [])];
  const local = [f('A', ['w2']), f('B', ['w1'])]; // こちら: w1 を A→B
  const remote = [f('A', ['w1', 'w2', 'w3']), f('B', [])]; // 相手: A に w3 を追加
  assert.deepEqual(shape(merge3Folders(base, local, remote)), ['A:[w2,w3]', 'B:[w1]']);
});

test('相手の名前変更とこちらのワード追加は両方生きる', () => {
  const base = [f('A', ['w1'])];
  const local = [f('A', ['w1', 'w9'])];
  const remote = [f('A', ['w1'], { name: '新しい名前' })];
  const merged = merge3Folders(base, local, remote);
  assert.equal(merged[0].name, '新しい名前');
  assert.deepEqual(merged[0].items.map(i => i.id), ['w1', 'w9']);
});

test('フォルダの並べ替え: 相手の並べ替えは届き、こちらだけの並べ替えは残る', () => {
  const base = [f('A', []), f('B', []), f('C', [])];
  const reordered = [f('C', []), f('A', []), f('B', [])];
  assert.deepEqual(merge3Folders(base, base, reordered).map(x => x.id), ['C', 'A', 'B']);
  assert.deepEqual(merge3Folders(base, reordered, base).map(x => x.id), ['C', 'A', 'B']);
});

test('相手が消したフォルダは、こちらが中身を触っていても消える／こちらの新規フォルダは残る', () => {
  const base = [f('A', ['w1']), f('B', ['w2'])];
  const local = [f('A', ['w1']), f('B', ['w2', 'w3']), f('N', ['w4'])];
  const remote = [f('A', ['w1'])];
  assert.deepEqual(shape(merge3Folders(base, local, remote)), ['A:[w1]', 'N:[w4]']);
});

test('墓標は 3-way の結果からも引かれる', () => {
  const base = [f('A', ['w1', 'w2'])];
  const merged = merge3Folders(base, base, [f('A', ['w1', 'w2'])], new Set(['w1']));
  assert.deepEqual(shape(merged), ['A:[w2]']);
});

// ── 冪等性・収束 ─────────────────────────────────────────────

test('同じ値同士なら何も変わらない（冪等）', () => {
  const x = [f('A', ['w1', 'w2']), f('B', ['w3'])];
  assert.deepEqual(merge3Folders(x, x, x), x);
  const once = merge3Folders(x, [f('A', ['w2']), f('B', ['w3', 'w1'])], x);
  assert.deepEqual(merge3Folders(x, once, x), once);
});

test('2 台のやりとりを模擬: 移動が相手に届き、相手の次の push でも戻らない', () => {
  // 端末 E と他デバイス T（どちらも base を持つ）。T で w1 を A→B へ移動して push。
  let cloud = [f('A', ['w1', 'w2']), f('B', [])];
  let eLocal = cloud, eBase = cloud;
  const tMoved = [f('A', ['w2']), f('B', ['w1'])];
  cloud = tMoved; // T の push
  // E が受信（E 側に未送信の変更なし）
  eLocal = merge3Folders(eBase, eLocal, cloud);
  eBase = cloud;
  assert.deepEqual(shape(eLocal), ['A:[w2]', 'B:[w1]']);
  // その後 E で別の操作（C を作る）→ push。w1 は A に戻らない。
  eLocal = [...eLocal, f('C', [])];
  cloud = eLocal;
  assert.deepEqual(shape(cloud), ['A:[w2]', 'B:[w1]', 'C:[]']);
});

// ── base が無い（この版で初めて同期する）とき ────────────────

test('base 無し: 両方に在るフォルダの中身はリモートに合わせ、この端末だけのフォルダは残す', () => {
  const local = [f('A', ['w1', 'w2']), f('B', ['w1']), f('L', ['w5'])]; // 旧版の union で A に w1 が残っている
  const remote = [f('A', ['w2']), f('B', ['w1'])];
  assert.deepEqual(shape(mergeFoldersWithoutBase(local, remote)), ['A:[w2]', 'B:[w1]', 'L:[w5]']);
});

test('dropDeletedFolders: フォルダとフォルダ内ワードの墓標を引く', () => {
  const folders = [f('A', ['w1', 'w2']), f('B', ['w3'])];
  assert.deepEqual(shape(dropDeletedFolders(folders, new Set(['B', 'w1']))), ['A:[w2]']);
});

// ── 登録ワード ───────────────────────────────────────────────

test('登録ワード: 相手の削除（墓標なし）・固定・並べ替えが届き、こちらの追加は固定群の直後に残る', () => {
  const base = [w('p', { isPinned: true }), w('a'), w('b'), w('c')];
  const local = [w('p', { isPinned: true }), w('n'), w('a'), w('b'), w('c')]; // こちら: n を追加
  const remote = [w('p', { isPinned: true }), w('c'), w('a')]; // 相手: b を削除・c を先頭へ
  assert.deepEqual(merge3RegisteredWords(base, local, remote).map(x => x.id), ['p', 'n', 'c', 'a']);
});

test('登録ワード: 同じワードを両方が書き換えたらこちら（直後に push して収束）', () => {
  const base = [w('a')];
  const merged = merge3RegisteredWords(base, [w('a', { text: 'local' })], [w('a', { text: 'remote' })]);
  assert.equal(merged[0].text, 'local');
});
