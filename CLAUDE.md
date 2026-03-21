# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイドです。

## プロジェクト概要

**Sidestream (リアタイ！)** は、ChromeのサイドパネルにリアルタイムのTwitter/Xトレンドとツイート検索結果を表示するChrome拡張機能（Manifest V3）です。Yahoo!リアルタイム検索（`search.yahoo.co.jp/realtime`）のHTMLを取得し、DOM要素をパースしてデータを取得しています（公式APIは使用していません）。

日本語メインのアプリで、英語のi18n対応あり（`src/i18n/translations.ts`）。

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

`realtimeService.ts` がYahoo!リアルタイム検索のHTMLを取得し、DOMParserでパース、CSSクラスセレクター（例: `Tweet_TweetContainer__`、`TrendItem_BuzzWord`）でツイート・トレンドを抽出します。データの流れ：

1. **Service**（`src/services/realtimeService.ts`）— fetch + DOMパース、型付きの `Tweet[]` / `TrendItem[]` を返す
2. **Hooks**（`src/hooks/`）— 状態管理、自動更新インターバル、フィルタリング（NG/ブロック）、localStorage永続化
3. **Components**（`src/components/`）— 表示レイヤー

### 状態管理

すべての永続化状態は `useLocalStorage` フック（`src/hooks/useLocalStorage.ts` → `src/utils/storage.ts`）経由で `localStorage` を使用。ストレージキーとデフォルト値は `src/constants/index.ts` に集約。外部の状態管理ライブラリは不使用。

ストレージマイグレーション（`src/utils/migration.ts`）がバージョン間のキー名変更を処理し、起動時に1回だけ実行（`main.tsx`）。

### 主要フック

| フック | 役割 |
|--------|------|
| `useSettings` | ユーザー設定全般（テーマ、更新間隔、NG/ブロックリスト） |
| `useTweets` | ツイート取得、バックグラウンド更新、保留ツイートキュー、NGフィルタリング |
| `useSearchHistory` | localStorageを使った検索履歴 |
| `useTheme` | 設定からCSSカスタムプロパティを生成 |
| `useLanguage` | 多言語対応（ja/en） |

### ビュー構成

`App.tsx` が `currentView` で2つのビューを管理：
- **ホーム**（`'home'`）：3つのサブタブ — トレンド、登録ワード/フォルダ、設定
- **検索**（`'search'`）：ツイート結果、タブ切り替え（すべて / ポストのみ / メディア）

### スクレイピングパターン

ツイートは3つのDOMセクションからパース：`#autosr`（自動更新エリア、最新）、`#bt`（ベストポスト）、`#sr`（タイムライン）。YahooのJSON Pagination APIを使った `fetchMoreTweets` 関数は実装済みだが、UIにはまだ接続されていない（App.tsxでコメントアウト中）。

## コーディング規約

- 全ての型定義は `src/types/index.ts` に集約
- 定数（カラー、更新間隔、ストレージキー、デフォルト値）は `src/constants/index.ts` に集約
- コンポーネントは `index.ts` でバレルエクスポート
- スタイリング: Tailwind CSS + CSSカスタムプロパティ（テーマカラーはインライン `style` で設定）
- アニメーション: `@formkit/auto-animate` でツイートリストのトランジション
- コードコメントは日本語で記述
