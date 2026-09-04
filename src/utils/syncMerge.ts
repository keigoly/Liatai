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
