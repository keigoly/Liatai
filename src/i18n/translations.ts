// src/i18n/translations.ts
// 多言語対応のための翻訳データ

export type Language = 'ja' | 'en';

export const translations = {
    ja: {
        // ========== ヘッダー ==========
        search: '検索',
        searchPlaceholder: '検索ワード',
        trends: 'トレンド',
        registered: '登録',
        settings: '設定',
        autoRefresh: '自動更新',
        openInNewWindow: '新しいウィンドウで開く',

        // ========== 検索タブ ==========
        all: 'すべて',
        postsOnly: 'ポストのみ',
        media: '画像・動画',
        noTweetsFound: 'ツイートが見つかりませんでした。',
        loadMore: 'もっと見る',
        loading: '読み込み中...',
        noMorePosts: 'これ以上のポストはありません',

        // ========== トレンド ==========
        updated: '更新',
        new: 'NEW',

        // ========== 登録パネル ==========
        words: 'ワード',
        folders: 'フォルダ',
        addWord: 'ワードを追加',
        addFolder: 'フォルダを追加',
        folderName: 'フォルダ名',
        noRegisteredWords: '登録されたワードはありません',
        noFolders: 'フォルダはありません',
        delete: '削除',
        edit: '編集',
        save: '保存',
        cancel: 'キャンセル',
        pin: '固定',
        unpin: '固定解除',
        add: '追加',
        createNewFolder: '新規フォルダ作成',
        editFolder: 'フォルダを編集',
        enterFolderName: 'フォルダ名を入力',
        addWordOrTag: 'ワード/タグを追加...',
        enterWordOrTag: 'ワード/タグを入力...',
        maxWordsNote: '※最大100件まで登録可能（リスト表示は上位10件のみ）',
        noRegisteredWordsShort: '登録ワードなし',
        createNewFolderButton: '新規フォルダを追加',
        youCanCreateFolders: 'フォルダを作成できます',
        currentLabel: '現在',

        // ========== 設定画面 ==========
        language: '言語',
        languageDescription: 'アプリの表示言語を選択',
        japanese: '日本語',
        english: 'English',

        trendAutoRefreshInterval: 'トレンドの自動更新の間隔',
        searchAutoRefreshInterval: '検索ワード時の自動更新の間隔',
        autoRefreshNote: '※自動更新スイッチがONの場合に有効です。',

        latestUpdate: '最新のアップデート情報',
        viewOnGitHub: 'GitHubで詳細を見る',
        noUpdateDetails: '更新内容の詳細はありません。',

        ngSettings: 'NG設定',
        ngWord: 'ワード',
        ngUserId: 'ユーザーID',
        ngSettingsNote: '※ここに登録したワードを含むポストは表示されなくなります。',
        items: '件',
        noNgWords: '登録されたワードはありません',
        noNgUserIds: '登録されたIDはありません',
        addWithPlusButton: '右上の「＋」ボタンで追加できます',
        enterIdStartingWithAt: '@から始まるIDを登録してください',
        regex: '正規表現',
        text: 'テキスト',

        design: 'デザイン',
        fontSizeThemeBackground: 'フォントサイズ・色・背景',
        fontSize: 'フォントサイズ',
        color: '色',
        background: '背景',
        default: 'デフォルト',
        darkBlue: 'ダークブルー',
        black: 'ブラック',

        storage: 'ストレージ',
        total: '全体',
        settingsData: '設定',
        other: 'その他',
        importSettings: '設定をインポート',
        exportSettings: '設定をエクスポート',
        resetSettings: '設定をリセット',
        resetSettingsDesc: '設定を初期値に戻します。',
        initializeStorage: 'ストレージを初期化',
        initializeStorageDesc: 'データを全て消去します。',
        import: 'インポート',
        export: 'エクスポート',
        reset: 'リセット',
        initialize: '初期化',
        confirmReset: '設定を初期値に戻しますか？\nトレンド間隔、検索間隔、テーマ、NG設定がリセットされます。',
        confirmInitialize: '全てのデータを削除しますか？\n登録ワード、フォルダ、検索履歴も全て削除されます。',
        importSuccess: '設定をインポートしました。ページを再読み込みしてください。',
        importFailed: 'インポートに失敗しました。',

        helpAndSupport: 'その他・問い合わせ',
        reportBug: '不具合の報告',
        reportBugDesc: 'バグ報告や機能要望はこちら',
        privacyPolicy: 'プライバシーポリシー',
        privacyPolicyDesc: '個人情報の取り扱いについて',
        sourceCode: 'ソースコード',
        sourceCodeDesc: 'GitHubでコードを見る',
        supportDeveloper: '開発者を支援する',
        supportDeveloperDesc: 'Amazon 欲しいものリスト',
        developerSite: '開発者のオフィシャルサイト',
        developerSiteDesc: 'KEIGOLY Official',

        // ========== 時間表示 ==========
        secondsAgo: '秒前',
        minutesAgo: '分前',
        hoursAgo: '時間前',
        daysAgo: '日前',
        now: 'たった今',

        // ========== 更新間隔 ==========
        oneMinute: '1分',
        threeMinutes: '3分',
        fiveMinutes: '5分',
        tenMinutes: '10分',
        oneSecond: '1秒',
        threeSeconds: '3秒',
        fiveSeconds: '5秒',
        tenSeconds: '10秒',

        // ========== 検索履歴 ==========
        searchHistory: '検索履歴',
        deleteAll: 'すべて削除',

        // ========== ツイートメニュー ==========
        blockUser: 'このユーザーをNG',
        openOriginal: '元のポストを開く',
    },

    en: {
        // ========== Header ==========
        search: 'Search',
        searchPlaceholder: 'Search word',
        trends: 'Trends',
        registered: 'Saved',
        settings: 'Settings',
        autoRefresh: 'Auto-refresh',
        openInNewWindow: 'Open in new window',

        // ========== Search Tabs ==========
        all: 'All',
        postsOnly: 'Posts',
        media: 'Media',
        noTweetsFound: 'No posts found.',
        loadMore: 'Load more',
        loading: 'Loading...',
        noMorePosts: 'No more posts',

        // ========== Trends ==========
        updated: 'Updated',
        new: 'NEW',

        // ========== Registered Panel ==========
        words: 'Words',
        folders: 'Folders',
        addWord: 'Add word',
        addFolder: 'Add folder',
        folderName: 'Folder name',
        noRegisteredWords: 'No saved words',
        noFolders: 'No folders',
        delete: 'Delete',
        edit: 'Edit',
        save: 'Save',
        cancel: 'Cancel',
        pin: 'Pin',
        unpin: 'Unpin',
        add: 'Add',
        createNewFolder: 'Create New Folder',
        editFolder: 'Edit Folder',
        enterFolderName: 'Enter folder name',
        addWordOrTag: 'Add word/tag...',
        enterWordOrTag: 'Enter word/tag...',
        maxWordsNote: '* Max 100 words (list shows top 10)',
        noRegisteredWordsShort: 'No words',
        createNewFolderButton: 'Create New Folder',
        youCanCreateFolders: 'You can create folders',
        currentLabel: 'Current',

        // ========== Settings ==========
        language: 'Language',
        languageDescription: 'Select app display language',
        japanese: '日本語',
        english: 'English',

        trendAutoRefreshInterval: 'Trend auto-refresh interval',
        searchAutoRefreshInterval: 'Search auto-refresh interval',
        autoRefreshNote: '* Applies when auto-refresh is ON.',

        latestUpdate: 'Latest Update',
        viewOnGitHub: 'View on GitHub',
        noUpdateDetails: 'No update details available.',

        ngSettings: 'Block Settings',
        ngWord: 'Words',
        ngUserId: 'User IDs',
        ngSettingsNote: '* Posts containing blocked words will be hidden.',
        items: '',
        noNgWords: 'No blocked words',
        noNgUserIds: 'No blocked user IDs',
        addWithPlusButton: 'Tap + to add',
        enterIdStartingWithAt: 'Enter ID starting with @',
        regex: 'Regex',
        text: 'Text',

        design: 'Appearance',
        fontSizeThemeBackground: 'Font size, color & background',
        fontSize: 'Font size',
        color: 'Color',
        background: 'Background',
        default: 'Default',
        darkBlue: 'Dark Blue',
        black: 'Black',

        storage: 'Storage',
        total: 'Total',
        settingsData: 'Settings',
        other: 'Other',
        importSettings: 'Import settings',
        exportSettings: 'Export settings',
        resetSettings: 'Reset settings',
        resetSettingsDesc: 'Reset to default values.',
        initializeStorage: 'Clear storage',
        initializeStorageDesc: 'Delete all data.',
        import: 'Import',
        export: 'Export',
        reset: 'Reset',
        initialize: 'Clear',
        confirmReset: 'Reset settings to defaults?\nThis will reset intervals, theme, and block settings.',
        confirmInitialize: 'Delete all data?\nThis includes saved words, folders, and search history.',
        importSuccess: 'Settings imported. Please reload the page.',
        importFailed: 'Import failed.',

        helpAndSupport: 'Help & Support',
        reportBug: 'Report a Bug',
        reportBugDesc: 'Bug reports and feature requests',
        privacyPolicy: 'Privacy Policy',
        privacyPolicyDesc: 'How we handle your data',
        sourceCode: 'Source Code',
        sourceCodeDesc: 'View code on GitHub',
        supportDeveloper: 'Support Developer',
        supportDeveloperDesc: 'Amazon Wishlist',
        developerSite: "Developer's Official Site",
        developerSiteDesc: 'KEIGOLY Official',

        // ========== Time Display ==========
        secondsAgo: 's ago',
        minutesAgo: 'm ago',
        hoursAgo: 'h ago',
        daysAgo: 'd ago',
        now: 'Just now',

        // ========== Intervals ==========
        oneMinute: '1 min',
        threeMinutes: '3 min',
        fiveMinutes: '5 min',
        tenMinutes: '10 min',
        oneSecond: '1 sec',
        threeSeconds: '3 sec',
        fiveSeconds: '5 sec',
        tenSeconds: '10 sec',

        // ========== Search History ==========
        searchHistory: 'Search History',
        deleteAll: 'Delete all',

        // ========== Tweet Menu ==========
        blockUser: 'Block this user',
        openOriginal: 'Open original post',
    },
} as const;

export type TranslationKey = keyof typeof translations.ja;
