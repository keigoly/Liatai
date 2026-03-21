// src/utils/helpers.ts
// 汎用ヘルパー関数

import type { Tweet } from '../types/index';

/**
 * ハッシュIDを生成する
 * @param str 入力文字列
 * @returns ハッシュID
 */
export const generateHashId = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return `hash-${Math.abs(hash)}`;
};

/**
 * 相対時間文字列をタイムスタンプに変換する
 * @param timeStr 相対時間文字列（例: "5秒", "3分", "2時間", "1日"）
 * @returns ミリ秒単位のタイムスタンプ
 */
export const parseRelativeTime = (timeStr: string): number => {
    const now = Date.now();
    if (timeStr === 'Now') return now;

    const secMatch = timeStr.match(/(\d+)秒/);
    if (secMatch) return now - (parseInt(secMatch[1], 10) * 1000);

    const minMatch = timeStr.match(/(\d+)分/);
    if (minMatch) return now - (parseInt(minMatch[1], 10) * 60000);

    const hourMatch = timeStr.match(/(\d+)時間/);
    if (hourMatch) return now - (parseInt(hourMatch[1], 10) * 3600000);

    const dayMatch = timeStr.match(/(\d+)日/);
    if (dayMatch) return now - (parseInt(dayMatch[1], 10) * 86400000);

    return now;
};

/**
 * ツイートのテキストが検索キーワードに関連しているか判定する
 * キーワードを文字種（カタカナ・ひらがな・漢字・英字・数字）の境界で分割し、
 * 有意なパーツの半数以上がテキストに含まれていれば関連ありと判定
 */
export const isRelevantToKeyword = (tweetText: string, keyword: string): boolean => {
    if (!keyword) return true;

    const text = tweetText.toLowerCase();
    const kw = keyword.toLowerCase();

    // 完全一致
    if (text.includes(kw)) return true;

    // キーワードを文字種境界で分割（カタカナ/ひらがな/漢字/英字/数字）
    const parts = kw.match(/[\u4e00-\u9faf]+|[\u30a0-\u30ff]+|[\u3040-\u309f]+|[a-z]+|\d+/gi) || [];
    const significantParts = parts.filter(p => p.length >= 2);

    if (significantParts.length === 0) return true;

    // 有意なパーツの半数以上が含まれていれば関連あり
    const matchCount = significantParts.filter(part => text.includes(part.toLowerCase())).length;
    return matchCount >= Math.ceil(significantParts.length / 2);
};

/**
 * ツイートを新しい順にソートする
 * 返信ツイート（replyToあり）は通常のツイートの後に配置
 * @param tweets ツイート配列
 * @returns ソートされたツイート配列
 */
export const sortNewestFirst = (tweets: Tweet[]): Tweet[] => {
    // 通常のツイートと返信ツイートを分離
    const normalTweets = tweets.filter(t => !t.replyTo);
    const replyTweets = tweets.filter(t => !!t.replyTo);

    // それぞれを時系列順でソート
    normalTweets.sort((a, b) => b.createdAt - a.createdAt);
    replyTweets.sort((a, b) => b.createdAt - a.createdAt);

    // 通常ツイートを先に、返信を後ろに
    return [...normalTweets, ...replyTweets];
};
