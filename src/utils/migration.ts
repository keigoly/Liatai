// src/utils/migration.ts
// v1.0.1 → v1.1.0 のストレージマイグレーション処理

import { STORAGE_KEYS } from '../constants/index';

/**
 * 古いストレージキーから新しいキーへのマッピング
 */
const STORAGE_KEY_MIGRATIONS: Record<string, string> = {
    // v1.0.x → v1.1.0 のキー変更
    'sidestream_trend_interval': STORAGE_KEYS.TREND_INTERVAL,
    'sidestream_search_interval': STORAGE_KEYS.SEARCH_INTERVAL,
    'sidestream_theme_color': STORAGE_KEYS.THEME_COLOR,
    'sidestream_bg_mode': STORAGE_KEYS.BG_MODE,
    'sidestream_font_size': STORAGE_KEYS.FONT_SIZE,
    'sidestream_ng_settings': STORAGE_KEYS.NG_SETTINGS,
    'sidestream_ng_settings_v4': STORAGE_KEYS.NG_SETTINGS,
    'sidestream_auto_refresh': STORAGE_KEYS.AUTO_REFRESH,
};

/**
 * マイグレーションが完了したことを示すフラグのキー
 */
const MIGRATION_FLAG_KEY = 'sidestream_migration_v1_1_0_completed';
const MIGRATION_V1_3_0_FLAG = 'sidestream_migration_v1_3_0_completed';

/**
 * v1.2.x → v1.3.0 マイグレーション
 * 既存データにupdatedAtタイムスタンプを付与し、同期機能に備える
 */
function runMigrationV130(): void {
    try {
        if (localStorage.getItem(MIGRATION_V1_3_0_FLAG) === 'true') {
            return;
        }

        console.log('[Migration] Starting v1.2.x → v1.3.0 migration...');

        // 既存データがあればupdatedAtタイムスタンプを付与（同期準備）
        const hasExistingData = Object.keys(localStorage).some(key => key.startsWith('sidestream_'));
        if (hasExistingData) {
            // 同期用の初期タイムスタンプを設定
            localStorage.setItem(STORAGE_KEYS.AUTH_LAST_SYNC, JSON.stringify(Date.now()));
            console.log('[Migration] Set initial sync timestamp for existing data');
        }

        localStorage.setItem(MIGRATION_V1_3_0_FLAG, 'true');
        console.log('[Migration] v1.3.0 migration completed.');
    } catch (e) {
        console.error('[Migration] v1.3.0 migration error:', e);
    }
}

/**
 * マイグレーションを実行する
 * 古いキーに保存されたデータを新しいキーに移行し、古いキーを削除する
 */
export function runMigration(): void {
    // v1.3.0 マイグレーション（独自のフラグで管理、v1.1.0とは独立）
    runMigrationV130();

    // v1.0.x → v1.1.0 マイグレーション
    try {
        // 既にマイグレーション済みの場合はスキップ
        if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
            return;
        }

        console.log('[Migration] Starting v1.0.x → v1.1.0 migration...');
        let migratedCount = 0;

        for (const [oldKey, newKey] of Object.entries(STORAGE_KEY_MIGRATIONS)) {
            const oldValue = localStorage.getItem(oldKey);

            // 古いキーにデータが存在し、新しいキーにデータがない場合のみ移行
            if (oldValue !== null && localStorage.getItem(newKey) === null) {
                try {
                    localStorage.setItem(newKey, oldValue);
                    localStorage.removeItem(oldKey);
                    console.log(`[Migration] Migrated: ${oldKey} → ${newKey}`);
                    migratedCount++;
                } catch (e) {
                    console.error(`[Migration] Failed to migrate ${oldKey}:`, e);
                }
            } else if (oldValue !== null) {
                // 新しいキーに既にデータがある場合は古いキーを削除するだけ
                localStorage.removeItem(oldKey);
                console.log(`[Migration] Removed old key (new key exists): ${oldKey}`);
            }
        }

        // マイグレーション完了フラグを設定
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        console.log(`[Migration] Completed. Migrated ${migratedCount} items.`);

    } catch (e) {
        console.error('[Migration] Error during migration:', e);
    }
}
