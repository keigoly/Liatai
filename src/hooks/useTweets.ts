// src/hooks/useTweets.ts
// ツイート取得・管理フック

import { useState, useRef, useCallback, useEffect } from 'react';
import { fetchRealtimeTweets, fetchMoreTweets, fetchTweetsAtTime } from '../services/realtimeService';
import { sortNewestFirst, isRelevantToKeyword } from '../utils/helpers';
import { DEFAULTS } from '../constants/index';
import type { Tweet, NgSettings } from '../types/index';

export interface UseTweetsState {
    tweets: Tweet[];
    pendingTweets: Tweet[];
    /** スクロール中に届いた新着の件数（pendingTweets は最新 MAX_TWEETS 件しか持たない）。 */
    pendingCount: number;
    isTweetLoading: boolean;
    isLoadingMore: boolean;
    hasMoreTweets: boolean;
    bestPostUpdatedAt: number;
    fullRefreshKey: number;
    loadTweets: (isBackground?: boolean, targetKeyword?: string) => Promise<void>;
    loadTweetsFromTime: (targetKeyword: string, timestampMs: number) => Promise<void>;
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
    bestPostInterval: number;
}

export function useTweets({
    searchKeyword,
    isScrolled,
    scrollContainerRef,
    setIsScrolled,
    bestPostInterval,
}: UseTweetsProps): UseTweetsState {
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [pendingTweets, setPendingTweets] = useState<Tweet[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [isTweetLoading, setIsTweetLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreTweets, setHasMoreTweets] = useState(true);
    const [bestPostUpdatedAt, setBestPostUpdatedAt] = useState<number>(0);
    const [fullRefreshKey, setFullRefreshKey] = useState(0);
    const lastBestPostTime = useRef<number>(0);
    const currentPage = useRef<number>(1); // 現在のページ（1 = 最初の20件）
    // tweets の最新IDセットを ref で追跡（setPendingTweets 内での stale closure 回避）
    const tweetIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        tweetIdsRef.current = new Set(tweets.map(t => t.id));
    }, [tweets]);
    const pendingIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        pendingIdsRef.current = new Set(pendingTweets.map(t => t.id));
    }, [pendingTweets]);

    const clearPending = useCallback(() => {
        setPendingTweets([]);
        setPendingCount(0);
    }, []);

    // スクロール中の新着を溜める。**持つのは最新 MAX_TWEETS 件だけ**（合流時にそれ以上は
    // 捨てられる）。件数は別に数えて表示する。上限なしで溜めると、スクロールしたまま
    // 置いておく間ずっと配列が伸び、毎回の重複判定とソートも全件に走ってメモリと CPU を
    // 食い続けていた（1 秒更新で 6 分放置すると 1 万件超・ヒープ約 3 倍）。
    const queuePending = useCallback((allNew: Tweet[]) => {
        const uniqueNew = allNew.filter(t => !tweetIdsRef.current.has(t.id) && !pendingIdsRef.current.has(t.id));
        if (uniqueNew.length === 0) return;
        for (const t of uniqueNew) pendingIdsRef.current.add(t.id);
        setPendingCount(c => c + uniqueNew.length);
        setPendingTweets(prevPending => {
            const pendingIds = new Set(prevPending.map(t => t.id));
            const add = uniqueNew.filter(t => !pendingIds.has(t.id));
            if (add.length === 0) return prevPending;
            return sortNewestFirst([...add, ...prevPending]).slice(0, DEFAULTS.MAX_TWEETS);
        });
    }, []);

    const loadTweets = useCallback(async (isBackground = false, targetKeyword?: string) => {
        const query = targetKeyword || searchKeyword;
        if (!query) return;
        if (!isBackground) setIsTweetLoading(true);

        try {
            const { best, timeline } = await fetchRealtimeTweets(query);
            const relevantTimeline = timeline.filter(t => isRelevantToKeyword(t.text, query));
            const sortedTimeline = sortNewestFirst([...relevantTimeline]);

            const now = Date.now();
            let effectiveBest = best;

            if (isBackground) {
                if (best && (now - lastBestPostTime.current < bestPostInterval)) {
                    effectiveBest = null;
                } else if (best) {
                    lastBestPostTime.current = now;
                    setBestPostUpdatedAt(now); // グラフ更新トリガー
                }
            } else {
                if (best) lastBestPostTime.current = now;
            }

            if (isBackground && effectiveBest) {
                // ベストポスト更新: リロードせず、他の新着と一緒に上から自然に流す
                const newBest = effectiveBest;
                const allNew = [newBest, ...sortedTimeline];

                if (isScrolled) {
                    queuePending(allNew);
                } else {
                    setTweets(prev => {
                        // 旧ベストポストの isBest フラグを解除 & 新ベストと同IDのツイートを除外
                        const cleaned = prev
                            .filter(t => t.id !== newBest.id)
                            .map(t => t.isBest ? { ...t, isBest: false } : t);
                        const existingIds = new Set(cleaned.map(t => t.id));
                        const newTimeline = sortedTimeline.filter(t => !existingIds.has(t.id) && t.id !== newBest.id);
                        const combined = [newBest, ...newTimeline, ...cleaned];
                        return combined.slice(0, DEFAULTS.MAX_TWEETS);
                    });
                    clearPending();
                }
            } else if (isBackground) {
                // 通常のバックグラウンド更新: 新着ツイートのみ追加
                const allNew = sortedTimeline;

                if (isScrolled) {
                    queuePending(allNew);
                } else {
                    setTweets(prev => {
                        const existingIds = new Set(prev.map(t => t.id));
                        const uniqueNew = allNew.filter(t => !existingIds.has(t.id));
                        if (uniqueNew.length === 0) return prev;
                        const combined = [...uniqueNew, ...prev];
                        return combined.slice(0, DEFAULTS.MAX_TWEETS);
                    });
                    clearPending();
                }
            } else {
                // 初回ロード: key変更でコンテナ再マウント → 全ツイート同時表示 + フェードインアニメーション
                setFullRefreshKey(k => k + 1);
                const initialList = effectiveBest ? [effectiveBest, ...sortedTimeline] : sortedTimeline;
                setTweets(initialList.slice(0, DEFAULTS.MAX_TWEETS));
                clearPending();
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!isBackground) setIsTweetLoading(false);
        }
    }, [searchKeyword, isScrolled, bestPostInterval, queuePending, clearPending]);

    // SYNC モード用: Snowflake ID で特定時刻のツイートを直接取得する
    // 放送時間帯にジャンプし、3ページ分（約60件）を連続取得して一括セットする
    const loadTweetsFromTime = useCallback(async (targetKeyword: string, timestampMs: number) => {
        setIsTweetLoading(true);
        try {
            console.log('[useTweets] loadTweetsFromTime:', targetKeyword, new Date(timestampMs).toISOString());
            const firstBatch = await fetchTweetsAtTime(targetKeyword, timestampMs);
            let allTweets = [...firstBatch];

            // 最初のバッチの最古ツイートIDから続けて2ページ追加取得
            for (let i = 0; i < 2 && allTweets.length > 0; i++) {
                const oldestId = allTweets[allTweets.length - 1].id;
                const more = await fetchMoreTweets(targetKeyword, oldestId, 0);
                if (more.length === 0) break;
                allTweets = [...allTweets, ...more];
            }

            console.log('[useTweets] loadTweetsFromTime result:', allTweets.length, 'tweets');
            setTweets(allTweets);
            setHasMoreTweets(allTweets.length > 0);
            clearPending();
            currentPage.current = 1;
            setFullRefreshKey(k => k + 1);
        } catch (err) {
            console.error('[useTweets] loadTweetsFromTime failed:', err);
        } finally {
            setIsTweetLoading(false);
        }
    }, [clearPending]);

    const mergePendingTweets = useCallback(() => {
        if (pendingTweets.length === 0 && !isScrolled) return;
        setTweets(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const uniquePending = pendingTweets.filter(t => !existingIds.has(t.id));
            const combined = [...uniquePending, ...prev];
            return combined.slice(0, DEFAULTS.MAX_TWEETS);
        });
        clearPending();
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setIsScrolled(false);
    }, [pendingTweets, isScrolled, scrollContainerRef, setIsScrolled, clearPending]);

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
        clearPending();
        lastBestPostTime.current = 0;
        currentPage.current = 1;
        setHasMoreTweets(true);
    }, [clearPending]);

    // もっと見る機能（JSON APIを使用）
    const loadMoreTweets = useCallback(async () => {
        if (!searchKeyword || isLoadingMore || tweets.length === 0) return;
        setIsLoadingMore(true);

        try {
            // ベストポストを除いた通常ツイートから最古のIDを取得
            const normalTweets = tweets.filter(t => !t.isBest);
            const oldestTweet = normalTweets[normalTweets.length - 1];
            const oldestTweetId = oldestTweet?.id || '';

            if (!oldestTweetId) {
                setHasMoreTweets(false);
                setIsLoadingMore(false);
                return;
            }

            const newTweets = await fetchMoreTweets(searchKeyword, oldestTweetId, 0);

            if (newTweets.length === 0) {
                setHasMoreTweets(false);
            } else {
                setTweets(prev => {
                    const existingIds = new Set(prev.map(t => t.id));
                    const uniqueNew = newTweets.filter(t => !existingIds.has(t.id));
                    if (uniqueNew.length === 0) {
                        setHasMoreTweets(false);
                        return prev;
                    }
                    return [...prev, ...uniqueNew];
                });
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
        pendingCount,
        isTweetLoading,
        isLoadingMore,
        hasMoreTweets,
        bestPostUpdatedAt,
        fullRefreshKey,
        loadTweets,
        loadTweetsFromTime,
        loadMoreTweets,
        mergePendingTweets,
        filterTweets,
        resetTweets,
    };
}
