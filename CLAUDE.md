# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイドです。

## プロジェクト概要

**Sidestream (リアタイ！)** は、ChromeのサイドパネルにリアルタイムのTwitter/Xトレンドとツイート検索結果を表示するChrome拡張機能（Manifest V3）です。Yahoo!リアルタイム検索（`search.yahoo.co.jp/realtime`）からデータを取得しています。

## 秘匿事項

- **NextGenTV プロジェクトおよび `nextgentv` ブランチに関する情報は一切外部に公開しないこと**
- `nextgentv` ブランチはリモートリポジトリにpushしない（ローカル専用）
- コミットメッセージ、PR、リリースノート、README等にNextGenTV関連の記述を含めない
- NextGenTV との連携機能（postMessage ブリッジ、SYNC モード等）の存在を公開リポジトリに反映しない

## ブランチ構成と開発フロー

このリポジトリは2つの配布先に向けて開発されています。

| ブランチ | 配布先 | 説明 |
|---------|--------|------|
| `main` | Chrome Web Store | Chrome 拡張機能版。Yahoo に直接アクセス（host_permissions で CORS 回避） |
| `nextgentv` | NextGenTV プラグイン | NextGenTV の視聴画面に iframe で埋め込まれる版。将来的に録画連動・時間同期等の固有機能を追加 |

### 開発ルール

- **共通の改善**（UI修正、バグ修正、新機能）は `main` ブランチで行い、`nextgentv` に定期的にマージする
- **NextGenTV 固有機能**（録画連動、再生時間同期、NextGenTV API 連携）は `nextgentv` ブランチのみに追加
- Chrome Web Store の審査は `main` ブランチからのみ提出
- NextGenTV 版はビルド後に直接デプロイされるため、審査なしで即座に反映される

### NextGenTV へのデプロイ手順

`nextgentv` ブランチで作業後：

```bash
# 1. リアタイをビルド
npm run build

# 2. dist/ を NextGenTV にコピー
cp -r dist/* G:/Developments/NextGenerationTV/NextGenTV/client/public/realtime/

# 3. Yahoo URL をサーバー側プロキシ経由に置換（CORS 回避のため必須）
cd G:/Developments/NextGenerationTV/NextGenTV/client/public/realtime/assets/
sed -i 's|https://search.yahoo.co.jp|/api/realtime/yahoo-proxy|g' main-*.js

# 4. NextGenTV をビルド & 本番にデプロイ
cd G:/Developments/NextGenerationTV/NextGenTV/client
yarn build
cp -r dist/* C:/DTV/NextGenTV/client/dist/

# 5. NextGenTV サービスを再起動
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command \"Restart-Service \\\"NextGenTV Service\\\"\"' -Wait"
```

### NextGenTV 側の関連ファイル

- `server/app/routers/RealtimeRouter.py` — Yahoo! リアルタイム検索へのプロキシ API
- `client/src/components/Watch/Watch.vue` — リアタイ窓 (iframe) の表示
- `client/src/components/Watch/Player.vue` — リアタイトグルボタン
- `client/src/stores/PlayerStore.ts` — `is_realtime_display` 状態管理
- `client/src/stores/SettingsStore.ts` — `plugin_realtime_enabled` 設定
- `client/src/views/Settings/Plugins.vue` — プラグイン設定ページ

- **データ取得**: `__NEXT_DATA__` JSON（`pageProps.pageData`）を優先し、フォールバックとしてDOM パース（`#bt`, `#autosr`, `#sr`）
- **API連携**: Yahoo の `/realtime/api/v1/pagination`（もっと見る）、`/realtime/api/v1/transition`（ポスト数グラフ）
- **i18n**: アプリ内は `src/i18n/translations.ts`（ja/en）、Chrome Web Store は `public/_locales/`（ja/en）

## 開発ルール（Claude Code 向け）

- **コード変更後は必ず `npm run build` を実行し、ビルドが通ることを確認してから完了とする**
- ビルドエラーが出た場合はその場で修正し、再度ビルドが成功するまで繰り返す

## コマンド

```bash
npm run dev       # Vite開発サーバー（ローカル開発・テスト用）
npm run build     # TypeScriptチェック + Vite本番ビルド → dist/
npm run lint      # ESLint（フラットコンフィグ、TS + Reactルール）
npm run preview   # 本番ビルドのプレビュー
```

ビルドすると `dist/` に `manifest.json`、`service-worker.js`、Reactアプリのアセットが生成されます。テスト時は `chrome://extensions` で `dist/` をパッケージ化されていない拡張機能として読み込みます。

## アーキテクチャ

### 拡張機能のエントリーポイント

- **サイドパネルUI**: `index.html` → `src/main.tsx` → `src/App.tsx`（Chromeサイドパネルで描画されるReact SPA）
- **Service Worker**: `src/background.ts` → `dist/service-worker.js` としてビルド（アクションクリックやメッセージ経由での `sidePanel.open` を処理）

Vite設定（`vite.config.ts`）はマルチエントリーのrollupを使用：UIは `index.html`、`src/background.ts` は `service-worker.js` として出力。

### データフロー

`realtimeService.ts` がYahoo!リアルタイム検索からデータを取得。優先順位：

1. **`__NEXT_DATA__` JSON**（`pageProps.pageData.timeline.entry[]` + `pageProps.pageData.bestTweet`）
2. **DOM `#autosr`** から最新の自動更新ツイートを追加取得
3. **DOM フォールバック**（`#bt` + `#autosr` + `#sr`）— JSON が無い場合

データの流れ：
1. **Service**（`src/services/realtimeService.ts`）— fetch + JSON/DOMパース、型付きの `Tweet[]` / `TrendItem[]` / `TransitionResult` を返す
2. **Hooks**（`src/hooks/`）— 状態管理、自動更新インターバル、フィルタリング（NG/ブロック）、localStorage永続化
3. **Components**（`src/components/`）— 表示レイヤー

### 状態管理

すべての永続化状態は `useLocalStorage` フック（`src/hooks/useLocalStorage.ts` → `src/utils/storage.ts`）経由で `localStorage` を使用。ストレージキーとデフォルト値は `src/constants/index.ts` に集約。外部の状態管理ライブラリは不使用。

ストレージマイグレーション（`src/utils/migration.ts`）がバージョン間のキー名変更を処理し、起動時に1回だけ実行（`main.tsx`）。

### 主要フック

| フック | 役割 |
|--------|------|
| `useSettings` | ユーザー設定全般（テーマ、更新間隔、NG/ブロックリスト、グラフ期間） |
| `useTweets` | ツイート取得、バックグラウンド更新、保留ツイートキュー、NGフィルタリング、もっと見る |
| `useSearchHistory` | localStorageを使った検索履歴 |
| `useTheme` | 設定からCSSカスタムプロパティを生成 |
| `useLanguage` | 多言語対応（ja/en） |

### ビュー構成

`App.tsx` が `currentView` で2つのビューを管理：
- **ホーム**（`'home'`）：3つのサブタブ — トレンド、登録ワード/フォルダ、設定
- **検索**（`'search'`）：ポスト数グラフ（開閉式）、ツイート結果（タブ切り替え：すべて / ポストのみ / メディア）、もっと見る

### 主要コンポーネント

| コンポーネント | 役割 |
|----------------|------|
| `TweetGraph` | ポスト数グラフ（transition API、期間切替、感情分析円グラフ） |
| `TweetCard` | ツイート個別表示（メディア、リプライ、エンゲージメント） |
| `SnsShare` | SNSシェアボタン群（X, LINE, Facebook, Threads, Reddit, CWS） |

## コーディング規約

- 全ての型定義は `src/types/index.ts` に集約
- 定数（カラー、更新間隔、ストレージキー、デフォルト値）は `src/constants/index.ts` に集約
- コンポーネントは `index.ts` でバレルエクスポート
- スタイリング: Tailwind CSS + CSSカスタムプロパティ（テーマカラーはインライン `style` で設定）
- アニメーション: `@formkit/auto-animate` でツイートリストのトランジション
- コードコメントは日本語で記述
