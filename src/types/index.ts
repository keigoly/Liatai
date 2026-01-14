// src/types/index.ts
// 全ての型定義を一元管理

// ========== 設定関連 ==========
export type ThemeColor = string;
export type BgMode = 'default' | 'black' | 'darkblue';
export type FontSize = number;

// ========== NG設定関連 ==========
export interface NgItem {
  id: string;
  text: string;
  isRegExp: boolean;
}

export type NgUser = NgItem;
export type NgComment = NgItem;
export type NgWord = NgItem;

export interface NgSettings {
  comments: NgComment[];
  userIds: NgUser[];
}

// ========== 登録ワード・フォルダ関連 ==========
export interface RegisteredItem {
  id: string;
  text: string;
  isPinned?: boolean;
}

export interface FolderItem {
  id: string;
  name: string;
  color: string;
  items: RegisteredItem[];
  isPinned?: boolean;
}

// ========== ツイート関連 ==========
export interface Tweet {
  id: string;
  text: string;
  url: string;
  timestamp: string;
  createdAt: number;
  author: string;
  handle: string;
  iconUrl: string;
  mediaUrl?: string;
  retweetCount?: string;
  likeCount?: string;
  isBest: boolean;
  replyTo?: string;
}

// ========== トレンド関連 ==========
export type TrendState = 'up' | 'down' | 'new' | 'keep';

export interface TrendItem {
  rank: number;
  keyword: string;
  state: TrendState;
  imageUrl?: string;
  description?: string;
}

export interface TrendResult {
  updateTime: string;
  items: TrendItem[];
}

export interface FetchTweetsResult {
  best: Tweet | null;
  timeline: Tweet[];
}

// ========== ビュー関連 ==========
export type TabType = 'all' | 'text' | 'media';
export type ViewType = 'home' | 'search';
export type HomeTabType = 'trends' | 'registered' | 'settings';
