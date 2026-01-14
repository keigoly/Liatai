// src/hooks/useTweets.ts
// ツイート取得・管理フック

import { useState, useRef, useCallback } from 'react';
import { fetchRealtimeTweets } from '../services/realtimeService';
import { sortNewestFirst } from '../utils/helpers';
import { DEFAULTS } from '../constants/index';
import type { Tweet, NgSettings } from '../types/index';

export interface UseTweetsState {
    tweets: Tweet[];
    pendingTweets: Tweet[];
    isTweetLoading: boolean;
    isLoadingMore: boolean;
    hasMoreTweets: boolean;
    loadTweets: (isBackground?: boolean, targetKeyword?: string) => Promise<void>;
    loadMoreTweets: () => Promise<void>;
    mergePendingTweets: () => void;
    filterTweets: (tweets: Tweet[], activeTab: 'all' | 'text' | 'media', ngSettings: NgSettings) => Tweet[];
    resetTweets: () => void;
}

interface UseTweetsProps {
    searchKeyword: string;
    isScrolled: boolean;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    setIsScrolled: (value: boolean) => void;
}

export function useTweets({
    searchKeyword,
    isScrolled,
    scrollContainerRef,
    setIsScrolled,
}: UseTweetsProps): UseTweetsState {
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [pendingTweets, setPendingTweets] = useState<Tweet[]>([]);
    const [isTweetLoading, setIsTweetLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreTweets, setHasMoreTweets] = useState(true);
    const lastBestPostTime = useRef<number>(0);
    const currentPage = useRef<number>(1); // 現在のページ（1 = 最初の20件）

    const loadTweets = useCallback(async (isBackground = false, targetKeyword?: string) => {
        const query = targetKeyword || searchKeyword;
        if (!query) return;
        if (!isBackground) setIsTweetLoading(true);

        try {
            const { best, timeline } = await fetchRealtimeTweets(query);
            const sortedTimeline = sortNewestFirst([...timeline]);

            const now = Date.now();
            let effectiveBest = best;

            if (isBackground) {
                if (best && (now - lastBestPostTime.current < 5 * 60 * 1000)) {
                    effectiveBest = null;
                } else if (best) {
                    lastBestPostTime.current = now;
                }
            } else {
                if (best) lastBestPostTime.current = now;
            }

            if (isBackground) {
                const incoming = effectiveBest ? [effectiveBest, ...sortedTimeline] : sortedTimeline;
                if (isScrolled) {
                    setPendingTweets(prevPending => {
                        const currentIds = new Set(tweets.map(t => t.id));
                        const pendingIds = new Set(prevPending.map(t => t.id));
                        const uniqueNew = incoming.filter(t => !currentIds.has(t.id) && !pendingIds.has(t.id));
                        if (uniqueNew.length === 0) return prevPending;
                        return sortNewestFirst([...uniqueNew, ...prevPending]);
                    });
                } else {
                    setTweets(prev => {
                        const existingIds = new Set(prev.map(t => t.id));
                        const uniqueNew = incoming.filter(t => !existingIds.has(t.id));
                        if (uniqueNew.length === 0) return prev;
                        const combined = [...uniqueNew, ...prev];
                        return combined.slice(0, DEFAULTS.MAX_TWEETS);
                    });
                    setPendingTweets([]);
                }
            } else {
                const initialList = effectiveBest ? [effectiveBest, ...sortedTimeline] : sortedTimeline;
                setTweets(initialList.slice(0, DEFAULTS.MAX_TWEETS));
                setPendingTweets([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!isBackground) setIsTweetLoading(false);
        }
    }, [searchKeyword, isScrolled, tweets]);

    const mergePendingTweets = useCallback(() => {
        if (pendingTweets.length === 0 && !isScrolled) return;
        setTweets(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const uniquePending = pendingTweets.filter(t => !existingIds.has(t.id));
            const combined = [...uniquePending, ...prev];
            return combined.slice(0, DEFAULTS.MAX_TWEETS);
        });
        setPendingTweets([]);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setIsScrolled(false);
    }, [pendingTweets, isScrolled, scrollContainerRef, setIsScrolled]);

    const filterTweets = useCallback((
        tweetsToFilter: Tweet[],
        activeTab: 'all' | 'text' | 'media',
        ngSettings: NgSettings
    ): Tweet[] => {
        return tweetsToFilter.filter(tweet => {
            if (activeTab === 'media' && !tweet.mediaUrl) return false;
            if (activeTab === 'text' && tweet.mediaUrl) return false;

            const isNgUser = ngSettings.userIds.some(ng => {
                if (!ng.text) return false;
                const target = ng.text.trim();
                if (ng.isRegExp) {
                    try { return new RegExp(target, 'i').test(tweet.handle); } catch { return false; }
                } else {
                    return tweet.handle.replace('@', '') === target.replace('@', '');
                }
            });
            if (isNgUser) return false;

            const isNgComment = ngSettings.comments.some(ng => {
                if (!ng.text) return false;
                if (ng.isRegExp) {
                    try { return new RegExp(ng.text, 'i').test(tweet.text); } catch { return false; }
                } else {
                    return tweet.text.includes(ng.text);
                }
            });
            if (isNgComment) return false;

            return true;
        });
    }, []);

    const resetTweets = useCallback(() => {
        setTweets([]);
        setPendingTweets([]);
        lastBestPostTime.current = 0;
        currentPage.current = 1;
        setHasMoreTweets(true);
    }, []);

    // もっと見る機能（JSON APIを使用）
    const loadMoreTweets = useCallback(async () => {
        if (!searchKeyword || isLoadingMore || tweets.length === 0) return;
        setIsLoadingMore(true);

        try {
            // 現在表示されているリストの最後（最古）のポストのIDを取得
            const oldestTweet = tweets[tweets.length - 1];
            const oldestTweetId = oldestTweet?.id || '';

            if (!oldestTweetId) {
                console.log('[loadMoreTweets] No oldest tweet ID found');
                setHasMoreTweets(false);
                setIsLoadingMore(false);
                return;
            }

            console.log('[loadMoreTweets] Loading more with oldestTweetId:', oldestTweetId, 'pageIndex:', currentPage.current);

            // JSON APIを使用して追加のポストを取得
            const { fetchMoreTweets } = await import('../services/realtimeService');
            const newTweets = await fetchMoreTweets(searchKeyword, oldestTweetId, currentPage.current);

            console.log('[loadMoreTweets] Received:', newTweets.length, 'items');

            if (newTweets.length === 0) {
                console.log('[loadMoreTweets] No more tweets, setting hasMoreTweets to false');
                setHasMoreTweets(false);
            } else {
                setTweets(prev => {
                    const existingIds = new Set(prev.map(t => t.id));
                    const uniqueNew = newTweets.filter(t => !existingIds.has(t.id));
                    console.log('[loadMoreTweets] Unique new tweets:', uniqueNew.length);
                    if (uniqueNew.length === 0) {
                        // 重複ばかりの場合、次のページを試みる
                        currentPage.current += 1;
                        return prev;
                    }
                    return [...prev, ...uniqueNew];
                });
                currentPage.current += 1;
            }
        } catch (err) {
            console.error('Failed to load more tweets:', err);
        } finally {
            setIsLoadingMore(false);
        }
    }, [searchKeyword, isLoadingMore, tweets]);

    return {
        tweets,
        pendingTweets,
        isTweetLoading,
        isLoadingMore,
        hasMoreTweets,
        loadTweets,
        loadMoreTweets,
        mergePendingTweets,
        filterTweets,
        resetTweets,
    };
}
