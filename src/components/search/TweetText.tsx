// src/components/search/TweetText.tsx
// ツイート本文のテキスト表示コンポーネント（リンク、ハッシュタグの処理）

import { useMemo } from 'react';
import type { TweetHashtag } from '../../types/index';

interface TweetTextProps {
    text: string;
    onHashtagClick: (tag: string) => void;
    hashtags?: TweetHashtag[]; // Yahoo JSONから取得した正確なハッシュタグ情報
}

/**
 * Yahoo JSONのhashtags情報を使って正確にテキストを分割する
 * hashtagsがない場合は従来の正規表現フォールバックを使用
 */
const buildParts = (text: string, hashtags?: TweetHashtag[]): { type: 'text' | 'url' | 'pic' | 'hashtag'; value: string }[] => {
    // hashtagsデータがある場合: 正確な位置情報で分割
    if (hashtags && hashtags.length > 0) {
        // テキスト中の既知ハッシュタグ位置を特定
        // stripYahooMarkersでテキストが変わるため、indicesは使わずテキストマッチで探す
        const knownTags = hashtags.map(h => h.text); // #なしのテキスト
        const tagPatterns = knownTags.map(t => `[#＃]${escapeRegExp(t)}`);

        // URL + 既知ハッシュタグで分割
        const urlPattern = '(?:https?|ftp):\\/\\/[^\\s\\u3000\\u00A0]+';
        const picPattern = 'pic\\.(?:x|twitter)\\.com\\/[^\\s\\u3000\\u00A0]+';
        const splitRegex = new RegExp(`(${[urlPattern, picPattern, tagPatterns.join('|')].join('|')})`, 'gi');

        return text.split(splitRegex).filter(Boolean).map(part => {
            if (part.match(/^(https?|ftp):\/\//i)) return { type: 'url', value: part };
            if (part.match(/^pic\.(?:x|twitter)\.com\//i)) return { type: 'pic', value: part };
            // 既知ハッシュタグとマッチするか確認
            if (part.match(/^[#＃]/) && knownTags.some(t => part.replace(/^[#＃]/, '') === t)) {
                return { type: 'hashtag', value: part };
            }
            return { type: 'text', value: part };
        });
    }

    // フォールバック: 従来の正規表現ベース
    const fallbackRegex = /((?:https?|ftp):\/\/[^\s\u3000\u00A0]+|(?:pic\.(?:x|twitter)\.com\/[^\s\u3000\u00A0]+)|[#＃](?:(?!https?:\/\/|ftp:\/\/|pic\.)[^\s\u3000\u00A0#＃])+)/gi;
    return text.split(fallbackRegex).filter(Boolean).map(part => {
        if (part.match(/^(https?|ftp):\/\//i)) return { type: 'url', value: part };
        if (part.match(/^pic\.(?:x|twitter)\.com\//i)) return { type: 'pic', value: part };
        if (part.match(/^[#＃]/)) return { type: 'hashtag', value: part };
        return { type: 'text', value: part };
    });
};

// 正規表現の特殊文字をエスケープ
const escapeRegExp = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const TweetText = ({ text, onHashtagClick, hashtags }: TweetTextProps) => {
    const parts = useMemo(() => buildParts(text, hashtags), [text, hashtags]);

    return (
        <p className="text-[1em] text-white leading-snug whitespace-pre-wrap break-words cursor-text">
            {parts.map((part, i) => {
                if (part.type === 'url') {
                    return (
                        <a
                            key={i}
                            href={part.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1d9bf0] hover:underline z-10 relative"
                        >
                            {part.value}
                        </a>
                    );
                } else if (part.type === 'pic') {
                    return (
                        <a
                            key={i}
                            href={`https://${part.value}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1d9bf0] hover:underline z-10 relative"
                        >
                            {part.value}
                        </a>
                    );
                } else if (part.type === 'hashtag') {
                    return (
                        <span key={i}>
                            {' '}
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onHashtagClick(part.value);
                                }}
                                className="text-[#1d9bf0] hover:underline cursor-pointer z-10 relative"
                            >
                                {part.value}
                            </span>
                            {' '}
                        </span>
                    );
                }
                return part.value;
            })}
        </p>
    );
};
