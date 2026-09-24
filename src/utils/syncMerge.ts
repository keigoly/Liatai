// src/utils/syncMerge.ts
// クロスデバイス同期のコンフリクト解決ユーティリティ（純粋関数）

import type { NgSettings, RegisteredItem, FolderItem } from '../types/index';

/**
 * 墓標（tombstone）で消された id の集合。
 * mergeArrayById は union なので「リモートに無い＝削除」を表現できない。削除は
 * この集合で明示的に伝える（utils/tombstones.ts が真実源）。省略時は従来どおりの挙動。
 */
export type DeletedIds = ReadonlySet<string> | undefined;

/**
 * 設定値のマージ（last-writer-wins）
 * リモートのupdatedAtがローカルより新しければリモートを採用
 */
export function mergeSettings<T>(
  local: T,
  remote: T,
  localUpdatedAt: number,
  remoteUpdatedAt: number
): T {
  return remoteUpdatedAt > localUpdatedAt ? remote : local;
}

/**
 * ID付き配列のマージ（union by id）
 * 同じIDのアイテムはupdatedAtが新しい側を採用
 * 片方にしかないアイテムはそのまま追加
 */
export function mergeArrayById<T extends { id: string }>(
  localItems: T[],
  remoteItems: T[],
  localUpdatedAt: number,
  remoteUpdatedAt: number,
  deleted?: DeletedIds
): T[] {
  const merged = new Map<string, T>();

  // ローカルのアイテムを全て追加
  for (const item of localItems) {
    merged.set(item.id, item);
  }

  // リモートのアイテムをマージ
  for (const item of remoteItems) {
    if (!merged.has(item.id)) {
      // ローカルにないアイテムは追加
      merged.set(item.id, item);
    } else if (remoteUpdatedAt > localUpdatedAt) {
      // 同じIDが両方にある場合、新しい方を採用
      merged.set(item.id, item);
    }
    // localUpdatedAt >= remoteUpdatedAt の場合はローカルを維持
  }

  if (deleted && deleted.size > 0) {
    for (const id of merged.keys()) {
      if (deleted.has(id)) merged.delete(id);
    }
  }

  return Array.from(merged.values());
}

/**
 * NG設定のマージ
 * comments と userIds をそれぞれ mergeArrayById でマージ
 */
export function mergeNgSettings(
  local: NgSettings,
  remote: NgSettings,
  localUpdatedAt: number,
  remoteUpdatedAt: number,
  deleted?: DeletedIds
): NgSettings {
  return {
    comments: mergeArrayById(local.comments, remote.comments, localUpdatedAt, remoteUpdatedAt, deleted),
    userIds: mergeArrayById(local.userIds, remote.userIds, localUpdatedAt, remoteUpdatedAt, deleted),
  };
}

/**
 * 登録ワードのマージ
 */
export function mergeRegisteredWords(
  local: RegisteredItem[],
  remote: RegisteredItem[],
  localUpdatedAt: number,
  remoteUpdatedAt: number,
  deleted?: DeletedIds
): RegisteredItem[] {
  return mergeArrayById(local, remote, localUpdatedAt, remoteUpdatedAt, deleted);
}

/**
 * フォルダのマージ
 * フォルダ自体を mergeArrayById でマージし、
 * 同じIDのフォルダ内の items も mergeArrayById でマージ
 */
export function mergeFolders(
  local: FolderItem[],
  remote: FolderItem[],
  localUpdatedAt: number,
  remoteUpdatedAt: number,
  deleted?: DeletedIds
): FolderItem[] {
  const localMap = new Map(local.map(f => [f.id, f]));
  const merged = new Map<string, FolderItem>();

  // ローカルのフォルダを全て追加
  for (const folder of local) {
    merged.set(folder.id, folder);
  }

  // リモートのフォルダをマージ
  for (const remoteFolder of remote) {
    const localFolder = localMap.get(remoteFolder.id);
    if (!localFolder) {
      // ローカルにないフォルダは追加
      merged.set(remoteFolder.id, remoteFolder);
    } else {
      // 両方にあるフォルダ: フォルダメタデータは新しい方を採用、中のitemsはマージ
      const baseFolder = remoteUpdatedAt > localUpdatedAt ? remoteFolder : localFolder;
      const mergedItems = mergeArrayById(
        localFolder.items,
        remoteFolder.items,
        localUpdatedAt,
        remoteUpdatedAt,
        deleted
      );
      merged.set(remoteFolder.id, { ...baseFolder, items: mergedItems });
    }
  }

  if (deleted && deleted.size > 0) {
    for (const [id, folder] of merged) {
      // フォルダ自体の削除 → まるごと落とす
      if (deleted.has(id)) {
        merged.delete(id);
        continue;
      }
      // ローカルにしか無かったフォルダは items がマージを通っていないのでここで引く
      const items = (folder.items ?? []).filter(i => !deleted.has(i.id));
      if (items.length !== (folder.items ?? []).length) {
        merged.set(id, { ...folder, items });
      }
    }
  }

  return Array.from(merged.values());
}

// ========== 3-way マージ（登録ワード / フォルダ）==========
//
// なぜ必要か:
//   union（mergeArrayById）は「足した」しか表現できない。削除は墓標で補ったが、
//   **別フォルダへの移動**や**フォルダから外す**では id が消えないので墓標が作られず、
//   union が元フォルダ側にワードを残し続けた。この端末が次に push すると相手側でも
//   元フォルダに戻る（＝この端末が「正」のように振る舞う）。
//
// 方式:
//   同期の基準（base＝最後にサーバと一致していた値）を持ち、ローカルとリモートそれぞれの
//   「base からの変更」を合わせる。ローカルに未送信の変更が無ければ結果はリモートそのもの
//   （移動・外す・並べ替え・名前変更がそのまま届く）。両方に変更があれば両方を生かす。

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** 片側だけが変えたならその側、両方変えたならローカル（直後にこちらが push して収束する）。 */
export function pickChanged<T>(base: T | undefined, local: T, remote: T): T {
  if (base === undefined) return remote;
  if (sameJson(local, base)) return remote;
  if (sameJson(remote, base)) return local;
  return local;
}

/** base と比べて、共通の id の並び順が変わったか。 */
function orderChanged<T extends { id: string }>(base: T[], arr: T[]): boolean {
  const inArr = new Set(arr.map(x => x.id));
  const inBase = new Set(base.map(x => x.id));
  const a = base.filter(x => inArr.has(x.id)).map(x => x.id);
  const b = arr.filter(x => inBase.has(x.id)).map(x => x.id);
  return a.length !== b.length || a.some((id, i) => id !== b[i]);
}

/**
 * ID 付き配列の 3-way マージ。
 * - base に在ってどちらかから消えた id は消える（削除・移動元・外した）
 * - base に無く片側にだけ在る id は残る（追加・移動先）
 * - 両側に在る id は mergeItem で合わせる
 * - 並びは「ローカルだけが並べ替えた」ならローカル、それ以外はリモートを骨格にし、
 *   もう片側で足された id を直前の隣の後ろへ差し込む
 */
export function merge3ArrayById<T extends { id: string }>(
  base: T[],
  local: T[],
  remote: T[],
  mergeItem: (b: T | undefined, l: T, r: T) => T = pickChanged,
  deleted?: DeletedIds
): T[] {
  const B = new Map(base.map(x => [x.id, x]));
  const L = new Map(local.map(x => [x.id, x]));
  const R = new Map(remote.map(x => [x.id, x]));

  const keep = (id: string): boolean => {
    if (deleted?.has(id)) return false;
    if (B.has(id) && (!L.has(id) || !R.has(id))) return false;
    return L.has(id) || R.has(id);
  };

  const [primary, secondary] =
    orderChanged(base, local) && !orderChanged(base, remote) ? [local, remote] : [remote, local];

  const order = primary.map(x => x.id).filter(keep);
  const placed = new Set(order);
  secondary.forEach((x, i) => {
    if (placed.has(x.id) || !keep(x.id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = order.indexOf(secondary[j].id);
      if (k >= 0) { at = k + 1; break; }
    }
    order.splice(at, 0, x.id);
    placed.add(x.id);
  });

  return order.map(id => {
    const l = L.get(id);
    const r = R.get(id);
    if (l && r) return mergeItem(B.get(id), l, r);
    return (l ?? r) as T;
  });
}

/** 登録ワードの 3-way マージ。 */
export function merge3RegisteredWords(
  base: RegisteredItem[],
  local: RegisteredItem[],
  remote: RegisteredItem[],
  deleted?: DeletedIds
): RegisteredItem[] {
  return merge3ArrayById(base, local, remote, pickChanged, deleted);
}

const withoutItems = (folder: FolderItem): Omit<FolderItem, 'items'> => {
  const meta: Partial<FolderItem> = { ...folder };
  delete meta.items;
  return meta as Omit<FolderItem, 'items'>;
};

const dropDeletedItems = (folder: FolderItem, deleted?: DeletedIds): FolderItem =>
  deleted && deleted.size > 0 && (folder.items ?? []).some(i => deleted.has(i.id))
    ? { ...folder, items: folder.items.filter(i => !deleted.has(i.id)) }
    : folder;

/**
 * フォルダの 3-way マージ。フォルダ自体（名前・色・固定・並び）と中のワード（所属・並び）を
 * それぞれ base からの変更で合わせる。ワードの移動は「元フォルダから消えた＋先フォルダに増えた」
 * として両方が伝わる。
 */
export function merge3Folders(
  base: FolderItem[],
  local: FolderItem[],
  remote: FolderItem[],
  deleted?: DeletedIds
): FolderItem[] {
  const merged = merge3ArrayById(base, local, remote, (b, l, r) => {
    const meta = pickChanged(b ? withoutItems(b) : undefined, withoutItems(l), withoutItems(r));
    const items = b
      ? merge3ArrayById(b.items ?? [], l.items ?? [], r.items ?? [], pickChanged, deleted)
      : mergeArrayById(l.items ?? [], r.items ?? [], 0, 1, deleted);
    return { ...meta, items } as FolderItem;
  }, deleted);
  return merged.map(f => dropDeletedItems(f, deleted));
}

/** 墓標にあるフォルダと、フォルダ内の墓標にあるワードを取り除く。 */
export function dropDeletedFolders(folders: FolderItem[], deleted?: DeletedIds): FolderItem[] {
  if (!deleted || deleted.size === 0) return folders;
  return folders.filter(f => !deleted.has(f.id)).map(f => dropDeletedItems(f, deleted));
}

/**
 * base が無い（この版で初めて同期する／新しい端末で初めてサインインした）ときのフォルダ合成。
 * フォルダ単位は union（この端末にしか無いフォルダは残す）、**両方に在るフォルダの中身と見た目は
 * リモートに合わせる**。旧版の union が元フォルダに残していた移動済みワードはここで消える。
 */
export function mergeFoldersWithoutBase(
  local: FolderItem[],
  remote: FolderItem[],
  deleted?: DeletedIds
): FolderItem[] {
  const remoteIds = new Set(remote.map(f => f.id));
  return dropDeletedFolders([...remote, ...local.filter(f => !remoteIds.has(f.id))], deleted);
}

/**
 * 検索履歴のマージ
 * 両方の履歴をunionし、重複を除去、最大件数で切り詰め
 */
export function mergeSearchHistory(
  local: string[],
  remote: string[],
  localUpdatedAt: number,
  remoteUpdatedAt: number,
  maxHistory: number = 20
): string[] {
  // 新しい方を優先順にする
  const primary = remoteUpdatedAt > localUpdatedAt ? remote : local;
  const secondary = remoteUpdatedAt > localUpdatedAt ? local : remote;

  const seen = new Set<string>();
  const result: string[] = [];

  // 優先側を先に追加
  for (const item of primary) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  // 副側を追加（重複除外）
  for (const item of secondary) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result.slice(0, maxHistory);
}
