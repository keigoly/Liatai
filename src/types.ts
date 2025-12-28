// src/types.ts

export type ThemeColor = string;
export type BgMode = 'default' | 'black' | 'darkblue';
export type FontSize = number;

export interface NgUser {
  id: string;
  text: string;
  isRegExp: boolean;
}

export interface NgComment {
  id: string;
  text: string;
  isRegExp: boolean;
}

export type NgWord = NgComment;

export interface NgSettings {
  comments: NgComment[];
  userIds: NgUser[];
}

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

export interface Post {
  id: string;
  name: string;
  username: string;
  time: string;
  content: string;
  image?: string;
  avatar: string;
  replies: string;
  retweets: string;
  likes: string;
  isBest?: boolean; // ★復活: ベストポスト判定用
}