// src/utils/tombstones.ts
// 削除の墓標（tombstone）— クロスデバイス同期で「消した」を伝えるための純粋関数群。
//
// なぜ必要か:
//   syncMerge の mergeArrayById は **id による和集合**なので、「リモートに無い＝削除された」を
//   構造的に表現できない。そのため他デバイスで消したフォルダ/ワードが
//   この拡張に残り続け、次にこちらが push した瞬間に相手側へ復活していた。
//   union の利点（両方がオフラインで足しても消えない）は保ったまま、削除だけを表現するために
//   「消した事実」を doc に載せる。
//
// 後方互換:
//   deleted を知らない版は無視するだけ（＝従来どおり）。ただしその setDoc で deleted が落ちるので、
//   知っている側が次の push で書き戻して収束させる。
//
// id は crypto.randomUUID() なので、消した id が正当に復活することはない（作り直しは新しい id）。

import type { NgSettings, RegisteredItem, FolderItem } from '../types/index';

export interface Tombstone {
  id: string;
  at: number;
}

/** 墓標の保持期間。全デバイスが収束するのに十分長く取る。 */
export const TOMBSTONE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** 保持する墓標の上限（超えたら古い方から落とす）。 */
export const TOMBSTONE_MAX = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 墓標を持つドキュメント（settings はスカラー LWW・searchHistory は id を持たないので対象外）。 */
export const TOMBSTONE_DOCS = ['ngSettings', 'registeredWords', 'folders'] as const;
export type TombstoneDoc = (typeof TOMBSTONE_DOCS)[number];

export function isTombstoneDoc(docName: string): docName is TombstoneDoc {
  return (TOMBSTONE_DOCS as readonly string[]).includes(docName);
}

/**
 * ドキュメント値に含まれる全 id を集める。
 * folders は**フォルダ自身と中のワードの両方**（フォルダ内ワードの削除も伝えるため）。
 */
export function collectIds(docName: string, value: unknown): string[] {
  if (!value) return [];
  switch (docName) {
    case 'registeredWords':
      return (value as RegisteredItem[]).map((w) => w.id);
    case 'folders':
      return (value as FolderItem[]).flatMap((f) => [f.id, ...(f.items ?? []).map((i) => i.id)]);
    case 'ngSettings': {
      const ng = value as NgSettings;
      return [...(ng.comments ?? []), ...(ng.userIds ?? [])].map((i) => i.id);
    }
    default:
      return [];
  }
}

/** prev には在ったが next には無い id ＝ このデバイスで消えたもの。 */
export function diffDeleted(prev: string[], next: string[], at: number): Tombstone[] {
  const alive = new Set(next);
  return prev.filter((id) => !alive.has(id)).map((id) => ({ id, at }));
}

/**
 * 墓標のマージ（id 単位で at の大きい方）＋剪定。
 *
 * `stored`（自分が保存していた分）と `incoming`（相手から届いた分）を**区別する**のが要点:
 *   - stored は健全化しない。しないと TTL を超えた墓標が毎回「今」に若返って永久に消えない。
 *   - incoming は健全化する。0・秒単位の取り違え・時計ずれ・未来値をそのまま入れると、
 *     送った瞬間に TTL 剪定で消えて墓標が効かない。
 */
export function mergeTombstones(stored: Tombstone[], incoming: Tombstone[], now: number): Tombstone[] {
  const map = new Map<string, number>();
  const put = (id: string, at: number) => {
    const cur = map.get(id);
    if (cur === undefined || at > cur) map.set(id, at);
  };
  for (const t of stored ?? []) {
    if (!t || typeof t.id !== 'string' || !t.id) continue;
    const at = Number(t.at);
    if (Number.isFinite(at)) put(t.id, at);
  }
  for (const t of incoming ?? []) {
    if (!t || typeof t.id !== 'string' || !t.id) continue;
    const raw = Number(t.at);
    const at = Number.isFinite(raw) && raw > now - TOMBSTONE_TTL_MS && raw <= now + DAY_MS ? raw : now;
    put(t.id, at);
  }
  let list = [...map].map(([id, at]) => ({ id, at })).filter((t) => now - t.at <= TOMBSTONE_TTL_MS);
  if (list.length > TOMBSTONE_MAX) {
    list = list.sort((x, y) => y.at - x.at || (x.id < y.id ? -1 : 1)).slice(0, TOMBSTONE_MAX);
  }
  return list.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

export function tombstoneIdSet(tombs: Tombstone[]): Set<string> {
  return new Set((tombs ?? []).map((t) => t.id));
}
