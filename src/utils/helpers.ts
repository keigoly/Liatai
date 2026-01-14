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
 * @param timeStr 相対時間文字列（例: "5秒", "3分"）
 * @returns ミリ秒単位のタイムスタンプ
 */
export const parseRelativeTime = (timeStr: string): number => {
    const now = Date.now();
    if (timeStr === 'Now') return now;

    const secMatch = timeStr.match(/(\d+)秒/);
    if (secMatch) return now - (parseInt(secMatch[1], 10) * 1000);

    const minMatch = timeStr.match(/(\d+)分/);
    if (minMatch) return now - (parseInt(minMatch[1], 10) * 60000);

    return now;
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
