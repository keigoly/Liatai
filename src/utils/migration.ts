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

/**
 * マイグレーションを実行する
 * 古いキーに保存されたデータを新しいキーに移行し、古いキーを削除する
 */
export function runMigration(): void {
    try {
        // 既にマイグレーション済みの場合はスキップ
        if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
            console.log('[Migration] Already completed, skipping.');
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
