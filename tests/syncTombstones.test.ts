// 削除同期（墓標）の回帰テスト。
//
// 背景: mergeArrayById は **id による和集合**なので「リモートに無い＝削除」を表現できない。
// そのため他デバイス（超TV!）で消したフォルダ/ワードがこの拡張に残り続け、次にこちらが
// push した瞬間に相手側へ復活していた。ここで「union の利点は保ったまま削除だけ伝わる」
// ことを固定する。
//
// 実行: npm test （Node の型ストリップ・依存追加なし）

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeArrayById, mergeFolders, mergeNgSettings, mergeRegisteredWords,
} from '../src/utils/syncMerge.ts';
import {
  collectIds, diffDeleted, mergeTombstones, tombstoneIdSet,
  TOMBSTONE_TTL_MS, isTombstoneDoc,
} from '../src/utils/tombstones.ts';
import type { FolderItem, RegisteredItem } from '../src/types/index.ts';

const w = (id: string): RegisteredItem => ({ id, text: `t-${id}` });
const f = (id: string, items: string[]): FolderItem =>
  ({ id, name: `F-${id}`, color: '#FF0000', items: items.map(w) });

// ── 既存挙動（union）は変えない ───────────────────────────────

test('墓標を渡さなければ従来どおりの union', () => {
  const merged = mergeArrayById([w('a')], [w('b')], 0, 1);
  assert.deepEqual(merged.map(x => x.id).sort(), ['a', 'b']);
});

test('両方がオフラインで足した分は両方残る（union の利点は保つ）', () => {
  const merged = mergeRegisteredWords([w('local')], [w('remote')], 0, 1, new Set());
  assert.deepEqual(merged.map(x => x.id).sort(), ['local', 'remote']);
});

// ── 削除が伝わる ────────────────────────────────────────────

test('墓標にある id は union の結果から引かれる', () => {
  const merged = mergeArrayById([w('a'), w('gone')], [w('b')], 0, 1, new Set(['gone']));
  assert.deepEqual(merged.map(x => x.id).sort(), ['a', 'b']);
});

test('相手がフォルダを消した: ローカルにしか無くても消える', () => {
  // 超TV! が f2 を削除 → remote には f2 が無く、deleted に f2 が載って届く。
  const local = [f('f1', ['a']), f('f2', ['c'])];
  const remote = [f('f1', ['a'])];
  const merged = mergeFolders(local, remote, 0, 1, new Set(['f2']));
  assert.deepEqual(merged.map(x => x.id), ['f1']);
});

test('相手がフォルダ内のワードを消した: 中身だけ消える', () => {
  const local = [f('f1', ['a', 'b'])];
  const remote = [f('f1', ['a'])];
  const merged = mergeFolders(local, remote, 0, 1, new Set(['b']));
  assert.deepEqual(merged[0].items.map(i => i.id), ['a']);
});

test('リモートに無いローカル専用フォルダの中身にも墓標が効く', () => {
  const local = [f('only-local', ['a', 'b'])];
  const merged = mergeFolders(local, [], 0, 1, new Set(['b']));
  assert.deepEqual(merged[0].items.map(i => i.id), ['a']);
});

test('NG 設定も comments / userIds の両方で削除が伝わる', () => {
  const local = { comments: [w('c1'), w('c2')], userIds: [w('u1')] } as never;
  const remote = { comments: [w('c1')], userIds: [w('u1')] } as never;
  const merged = mergeNgSettings(local, remote, 0, 1, new Set(['c2']));
  assert.deepEqual(merged.comments.map(x => x.id), ['c1']);
  assert.deepEqual(merged.userIds.map(x => x.id), ['u1']);
});

// ── 墓標そのもの ────────────────────────────────────────────

test('collectIds: folders はフォルダ id と中のワード id の両方', () => {
  assert.deepEqual(collectIds('folders', [f('f1', ['a', 'b'])]).sort(), ['a', 'b', 'f1']);
  assert.deepEqual(collectIds('registeredWords', [w('x')]), ['x']);
  assert.deepEqual(collectIds('searchHistory', ['a']), []);
});

test('diffDeleted: 消えた id だけを拾う（増えた分は拾わない）', () => {
  const got = diffDeleted(['a', 'b'], ['a', 'c'], 111);
  assert.deepEqual(got, [{ id: 'b', at: 111 }]);
});

test('mergeTombstones: 同じ id は at の大きい方', () => {
  const now = Date.now();
  const got = mergeTombstones([{ id: 'x', at: now - 5000 }], [{ id: 'x', at: now }], now);
  assert.equal(got.length, 1);
  assert.equal(got[0].at, now);
});

test('mergeTombstones: 保存済みの TTL 超過は剪定する', () => {
  const now = Date.now();
  const got = mergeTombstones(
    [{ id: 'keep', at: now }, { id: 'old', at: now - TOMBSTONE_TTL_MS - 1 }],
    [],
    now,
  );
  assert.deepEqual(got.map(t => t.id), ['keep']);
});

test('保存済みは若返らせない（毎回マージしても TTL でいつか消える）', () => {
  const now = Date.now();
  // 期限内の古い墓標は at を保ったまま持ち越される（＝いつか TTL に到達する）。
  const carried = mergeTombstones([{ id: 'x', at: now - TOMBSTONE_TTL_MS + 1000 }], [], now);
  assert.equal(carried[0].at, now - TOMBSTONE_TTL_MS + 1000);
});

test('mergeTombstones: 壊れた at（0/秒単位/未来/NaN）は「今」に倒す＝送った瞬間に消えない', () => {
  const now = Date.now();
  for (const bad of [0, 1, Math.floor(now / 1000), now + 400 * 24 * 3600 * 1000, NaN]) {
    const got = mergeTombstones([], [{ id: 'x', at: bad as number }], now);
    assert.equal(got.length, 1, `at=${bad} で墓標が消えた`);
    assert.equal(got[0].at, now);
  }
});

test('mergeTombstones: id の無いゴミは落とす', () => {
  const now = Date.now();
  assert.deepEqual(mergeTombstones([], [{ id: '', at: now }, null as never], now), []);
});

test('isTombstoneDoc: settings と searchHistory は対象外', () => {
  assert.equal(isTombstoneDoc('folders'), true);
  assert.equal(isTombstoneDoc('registeredWords'), true);
  assert.equal(isTombstoneDoc('ngSettings'), true);
  assert.equal(isTombstoneDoc('settings'), false);
  assert.equal(isTombstoneDoc('searchHistory'), false);
});

// ── #201 のシナリオそのもの ─────────────────────────────────

test('#201: 超TV! で消したフォルダが拡張で復活しない（そして復活 push もしない）', () => {
  const now = Date.now();
  // 拡張のローカル（まだ f2 を持っている）。
  let local = [f('f1', ['a']), f('f2', ['c'])];
  // 超TV! が f2 を削除して push した doc。
  const remote = [f('f1', ['a'])];
  const remoteDeleted = [{ id: 'f2', at: now }, { id: 'c', at: now }];

  const tombs = mergeTombstones([], remoteDeleted, now);
  local = mergeFolders(local, remote, 0, now, tombstoneIdSet(tombs));
  assert.deepEqual(local.map(x => x.id), ['f1'], '拡張のローカルから消えていない');

  // このあと拡張側で別のフォルダを足して push しても、f2 は載らない＝相手へ復活しない。
  local = [...local, f('f3', ['z'])];
  const pushed = mergeFolders(local, remote, now, 0, tombstoneIdSet(tombs));
  assert.deepEqual(pushed.map(x => x.id).sort(), ['f1', 'f3']);
});
