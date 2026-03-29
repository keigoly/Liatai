// src/hooks/useLiveCollector.ts
// ライブ視聴時のバックグラウンドツイート収集フック
// トレンド画面を表示したまま、裏で定期的にツイートを取得しIndexedDBに蓄積する
// 録画再生時に useTweetReplay がこのキャッシュを利用する

import { useRef, useEffect, useCallback } from 'react';
import { fetchRealtimeTweets } from '../services/realtimeService';
import { getCachedTweets, saveCachedTweets } from '../lib/tweetCache';
import type { Tweet } from '../types/index';

// 収集間隔: 30秒ごとにYahoo検索して新着ツイートを蓄積
const COLLECT_INTERVAL_MS = 30_000;

interface UseLiveCollectorProps {
  keyword: string;
  programStartMs: number;
  programEndMs: number;
}

export function useLiveCollector({ keyword, programStartMs, programEndMs }: UseLiveCollectorProps) {
  const collectedRef = useRef<Map<string, Tweet>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  const stopCollecting = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    activeRef.current = false;
  }, []);

  // 1回の収集サイクル: Yahoo検索で最新ツイートを取得し、Mapに蓄積
  const collectOnce = useCallback(async () => {
    if (!keyword || !activeRef.current) return;
    try {
      const { timeline } = await fetchRealtimeTweets(keyword);
      let newCount = 0;
      for (const tweet of timeline) {
        if (!collectedRef.current.has(tweet.id)) {
          collectedRef.current.set(tweet.id, tweet);
          newCount++;
        }
      }
      if (newCount > 0) {
        console.log(`[LiveCollector] +${newCount} tweets (total: ${collectedRef.current.size})`);
      }
    } catch (err) {
      console.warn('[LiveCollector] Fetch failed:', err);
    }
  }, [keyword]);

  // IndexedDBに蓄積データを保存（5回の収集ごと = 約2.5分ごと）
  const saveToCache = useCallback(async () => {
    if (collectedRef.current.size === 0 || !keyword || programStartMs <= 0) return;
    try {
      const tweets = Array.from(collectedRef.current.values());
      tweets.sort((a, b) => a.createdAt - b.createdAt);

      // 既存キャッシュとマージ
      const existing = await getCachedTweets(keyword, programStartMs);
      if (existing && existing.length > 0) {
        const existingIds = new Set(existing.map(t => t.id));
        const newOnly = tweets.filter(t => !existingIds.has(t.id));
        if (newOnly.length > 0) {
          const merged = [...existing, ...newOnly].sort((a, b) => a.createdAt - b.createdAt);
          await saveCachedTweets(keyword, programStartMs, programEndMs, merged);
          console.log(`[LiveCollector] Saved ${merged.length} tweets to cache (+${newOnly.length} new)`);
        }
      } else {
        await saveCachedTweets(keyword, programStartMs, programEndMs, tweets);
        console.log(`[LiveCollector] Saved ${tweets.length} tweets to cache (new entry)`);
      }
    } catch (err) {
      console.warn('[LiveCollector] Save failed:', err);
    }
  }, [keyword, programStartMs, programEndMs]);

  useEffect(() => {
    if (!keyword || programStartMs <= 0 || programEndMs <= 0) {
      stopCollecting();
      return;
    }

    // 収集開始
    activeRef.current = true;
    collectedRef.current = new Map();
    console.log('[LiveCollector] Started:', keyword);

    // 即座に1回収集
    collectOnce();

    let cycleCount = 0;
    intervalRef.current = setInterval(async () => {
      await collectOnce();
      cycleCount++;
      // 5回ごとにキャッシュ保存（約2.5分ごと）
      if (cycleCount % 5 === 0) {
        await saveToCache();
      }
    }, COLLECT_INTERVAL_MS);

    return () => {
      // アンマウント時に最終保存
      stopCollecting();
      saveToCache();
      console.log('[LiveCollector] Stopped, final save done');
    };
  }, [keyword, programStartMs, programEndMs, collectOnce, saveToCache, stopCollecting]);
}

export default useLiveCollector;
