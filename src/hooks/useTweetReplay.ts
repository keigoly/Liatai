// src/hooks/useTweetReplay.ts
// ツイートリプレイフック: 放送時間帯のツイートを事前取得し、映像再生に同期して1件ずつ表示する

import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchTweetsAtTime, fetchMoreTweets, fetchCachedTweets } from '../services/realtimeService';
import { getCachedTweets, saveCachedTweets } from '../lib/tweetCache';
import { REPLAY } from '../constants/index';
import type { Tweet } from '../types/index';

const MAX_PRELOAD_CALLS = 2000;

// ========== インターフェース ==========

interface UseTweetReplayProps {
  keyword: string;
  programStartMs: number;    // 放送開始時刻（ms）。不明時は 0
  programEndMs: number;      // 放送終了時刻（ms）。不明時は 0
  broadcastTs: number;       // 現在の放送タイムスタンプ（ms）。映像再生位置に連動して毎秒更新
  isSyncMode: boolean;       // リプレイを有効にするかどうか
  ngFilterFn: (tweets: Tweet[]) => Tweet[];  // NG ワードフィルター関数
}

interface UseTweetReplayState {
  visibleTweets: Tweet[];
  isPreloading: boolean;
  preloadProgress: number;   // 0.0 〜 1.0
  bufferSize: number;
  isReplayActive: boolean;
}

// ========== 二分探索ヘルパー ==========
// bufferRef 内で createdAt <= targetTs を満たす最後のインデックスを返す。
// 該当なしの場合は -1。配列は createdAt 昇順でソート済みであること。
function binarySearchLastIndex(arr: Tweet[], targetTs: number): number {
  let lo = 0, hi = arr.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].createdAt <= targetTs) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

// ========== フック本体 ==========

export function useTweetReplay({
  keyword,
  programStartMs,
  programEndMs,
  broadcastTs,
  isSyncMode,
  ngFilterFn,
}: UseTweetReplayProps): UseTweetReplayState {

  // --- State ---
  const [visibleTweets, setVisibleTweets] = useState<Tweet[]>([]);
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [bufferSize, setBufferSize] = useState(0);
  const [isReplayActive, setIsReplayActive] = useState(false);

  // --- Refs ---
  // プリロード済みツイートバッファ（createdAt 昇順ソート済み）
  const bufferRef = useRef<Tweet[]>([]);
  // 現在の表示位置（bufferRef 内のインデックス）
  const revealIndexRef = useRef(-1);
  // ドリップ表示用タイマー
  const dripTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // プリロード中断フラグ
  const cancelledRef = useRef(false);
  // 前回の broadcastTs（シーク検出用）
  const prevBroadcastTsRef = useRef(broadcastTs);

  // --- ドリップタイマーのクリーンアップ ---
  const clearDripTimer = useCallback(() => {
    if (dripTimerRef.current !== null) {
      clearInterval(dripTimerRef.current);
      dripTimerRef.current = null;
    }
  }, []);

  // --- 全状態リセット ---
  const resetAll = useCallback(() => {
    clearDripTimer();
    bufferRef.current = [];
    revealIndexRef.current = -1;
    cancelledRef.current = true; // 実行中のプリロードを中断
    setVisibleTweets([]);
    setIsPreloading(false);
    setPreloadProgress(0);
    setBufferSize(0);
    setIsReplayActive(false);
  }, [clearDripTimer]);

  // --- バッファからvisibleTweetsを更新するユーティリティ ---
  const updateVisibleFromBuffer = useCallback((newRevealIndex: number) => {
    if (newRevealIndex < 0) {
      setVisibleTweets([]);
      return;
    }
    // buffer[0..newRevealIndex] を逆順（新しい順）にして MAX_VISIBLE 件に切り詰め、NGフィルター適用
    const revealed = bufferRef.current.slice(0, newRevealIndex + 1);
    const reversed = [...revealed].reverse();
    const trimmed = reversed.slice(0, REPLAY.MAX_VISIBLE);
    setVisibleTweets(ngFilterFn(trimmed));
  }, [ngFilterFn]);

  // ========== プリロード ==========
  // isSyncMode が true になったとき、放送時間帯のツイートを全取得する（IndexedDB キャッシュ対応）
  useEffect(() => {
    if (!isSyncMode) {
      resetAll();
      return;
    }

    // 番組情報が不十分な場合はスキップ
    if (!keyword || programStartMs <= 0 || programEndMs <= 0 || programEndMs <= programStartMs) {
      console.warn('[useTweetReplay] Invalid program time range, skipping preload');
      return;
    }

    // プリロード開始
    cancelledRef.current = false;
    setIsPreloading(true);
    setPreloadProgress(0);
    setIsReplayActive(true);

    const runPreload = async () => {
      try {
        console.log(
          '[useTweetReplay] Preload start:',
          keyword,
          'range:', new Date(programStartMs).toISOString(), '→', new Date(programEndMs).toISOString(),
        );

        // Step 1: IndexedDB キャッシュを確認
        const cached = await getCachedTweets(keyword, programStartMs);
        if (cached && cached.length > 0) {
          if (cancelledRef.current) return;
          // Cache HIT
          bufferRef.current = cached;
          revealIndexRef.current = -1;
          setBufferSize(cached.length);
          setPreloadProgress(1.0);
          setIsPreloading(false);
          console.log('[useTweetReplay] Cache HIT:', cached.length, 'tweets');
          return;
        }

        // Step 1.5: サーバーキャッシュを確認（ライブ視聴時にサーバーが自動収集したデータ）
        console.log('[useTweetReplay] Checking server cache...');
        const serverResult = await fetchCachedTweets(keyword, programStartMs, programEndMs);
        if (cancelledRef.current) return;

        if (serverResult.tweets.length > 0) {
          // サーバーキャッシュ HIT
          const serverTweets = serverResult.tweets.sort((a, b) => a.createdAt - b.createdAt);
          bufferRef.current = serverTweets;
          revealIndexRef.current = -1;
          setBufferSize(serverTweets.length);
          setPreloadProgress(1.0);
          setIsPreloading(false);

          // IndexedDB にも保存（次回はローカルキャッシュから即座にロード）
          await saveCachedTweets(keyword, programStartMs, programEndMs, serverTweets);

          console.log('[useTweetReplay] Server cache HIT:', serverTweets.length, 'tweets');
          return;
        }
        console.log('[useTweetReplay] Server cache MISS, falling back to Yahoo API...');

        // Step 2: Full fetch from Yahoo API (cache MISS)
        console.log('[useTweetReplay] Cache MISS, fetching from API...');

        const accumulated: Tweet[] = [];
        const seenIds = new Set<string>();
        let callCount = 0;

        // 番組終了時点から初回取得
        const initialBatch = await fetchTweetsAtTime(keyword, programEndMs);
        if (cancelledRef.current) return;
        callCount++;

        for (const tweet of initialBatch) {
          if (!seenIds.has(tweet.id)) { seenIds.add(tweet.id); accumulated.push(tweet); }
        }

        const totalRange = programEndMs - programStartMs;
        const targetStartMs = programStartMs - REPLAY.BUFFER_MARGIN_MS;

        // 後方へページングしながら全量取得
        while (!cancelledRef.current && callCount < MAX_PRELOAD_CALLS) {
          // 最も古いツイートが番組開始前（マージン込み）に達したら終了
          if (accumulated.length > 0) {
            const oldestTweet = accumulated[accumulated.length - 1];
            if (oldestTweet.createdAt < targetStartMs) {
              console.log('[useTweetReplay] Reached target start time, stopping fetch');
              break;
            }
          }

          if (accumulated.length === 0) break;

          await new Promise(resolve => setTimeout(resolve, REPLAY.PRELOAD_BATCH_DELAY_MS));
          if (cancelledRef.current) return;

          const oldestId = accumulated[accumulated.length - 1].id;
          const more = await fetchMoreTweets(keyword, oldestId, 0);
          if (cancelledRef.current) return;
          callCount++;

          if (more.length === 0) {
            console.log('[useTweetReplay] No more tweets returned, stopping fetch');
            break;
          }

          for (const tweet of more) {
            if (!seenIds.has(tweet.id)) { seenIds.add(tweet.id); accumulated.push(tweet); }
          }

          // 時間ベースの進捗計算
          const oldestInBuffer = accumulated[accumulated.length - 1];
          const covered = programEndMs - oldestInBuffer.createdAt;
          setPreloadProgress(Math.min(covered / totalRange, 0.99));

          if (callCount % 50 === 0) {
            console.log(`[useTweetReplay] Fetching... calls: ${callCount}, tweets: ${accumulated.length}`);
          }
        }

        if (cancelledRef.current) return;

        // Step 3: createdAt 昇順にソートしてバッファに格納し、IndexedDB にキャッシュ
        accumulated.sort((a, b) => a.createdAt - b.createdAt);

        // IndexedDB にキャッシュ保存（保存中にキャンセルされた場合は状態更新しない）
        await saveCachedTweets(keyword, programStartMs, programEndMs, accumulated);
        if (cancelledRef.current) return;

        bufferRef.current = accumulated;
        revealIndexRef.current = -1;
        setBufferSize(accumulated.length);
        setPreloadProgress(1.0);
        setIsPreloading(false);

        console.log('[useTweetReplay] Preload complete:', accumulated.length, 'tweets buffered,', callCount, 'API calls');

      } catch (error) {
        if (!cancelledRef.current) {
          console.error('[useTweetReplay] Preload error:', error);
          setIsPreloading(false);
          setPreloadProgress(0);
        }
      }
    };

    runPreload();

    // クリーンアップ: コンポーネントアンマウントまたは依存値変更時
    return () => {
      cancelledRef.current = true;
    };
    // keyword / 番組時間 / isSyncMode が変わったときだけ再実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, programStartMs, programEndMs, isSyncMode]);

  // ========== 表示同期（broadcastTs 変化に反応） ==========
  useEffect(() => {
    // リプレイが非アクティブ、またはバッファが空なら何もしない
    if (!isReplayActive || bufferRef.current.length === 0) return;
    // プリロード中でもバッファにデータがあれば部分的に表示を開始する

    const prevTs = prevBroadcastTsRef.current;
    prevBroadcastTsRef.current = broadcastTs;

    // シーク検出: broadcastTs が大きくジャンプした場合はドリップをキャンセルして即座に再計算
    const isSeek = Math.abs(broadcastTs - prevTs) > 3000; // 3秒以上の変化はシークとみなす
    if (isSeek) {
      clearDripTimer();
    }

    // 二分探索で broadcastTs 以前の最新ツイートのインデックスを特定
    const targetIndex = binarySearchLastIndex(bufferRef.current, broadcastTs);
    const currentIndex = revealIndexRef.current;

    // 再生位置以前のツイートがない場合（番組冒頭など）:
    // バッファ内の最も古いツイートから MAX_VISIBLE 件を表示する（方針A）。
    // これにより番組冒頭でも「ツイートがありません」にならず、
    // 再生が進めば通常の時間同期表示に自然に切り替わる。
    if (targetIndex < 0 && bufferRef.current.length > 0) {
      // 既にフォールバック表示済み（revealIndex が FALLBACK_MARKER）なら再計算しない
      if (currentIndex === -1) {
        const fallbackCount = Math.min(bufferRef.current.length, REPLAY.MAX_VISIBLE);
        const oldest = bufferRef.current.slice(0, fallbackCount);
        const reversed = [...oldest].reverse();
        setVisibleTweets(ngFilterFn(reversed));
        // revealIndexRef は -1 のまま維持:
        // broadcastTs が進んでバッファ内ツイートの時間帯に入った時点で
        // targetIndex >= 0 となり、通常フローに自然に切り替わる
      }
      return;
    }

    // 表示すべき新規ツイートがない場合はスキップ
    if (targetIndex <= currentIndex) return;

    const newCount = targetIndex - currentIndex;

    if (isSeek || newCount <= REPLAY.DRIP_THRESHOLD) {
      // 少量 or シーク: 一括表示
      clearDripTimer();
      revealIndexRef.current = targetIndex;
      updateVisibleFromBuffer(targetIndex);
    } else {
      // 大量: ドリップ表示（既存タイマーがあれば新しい目標に切り替え）
      clearDripTimer();

      let dripIndex = currentIndex;
      const dripTarget = targetIndex;

      dripTimerRef.current = setInterval(() => {
        dripIndex = Math.min(dripIndex + 1, bufferRef.current.length - 1);
        revealIndexRef.current = dripIndex;
        updateVisibleFromBuffer(dripIndex);

        if (dripIndex >= dripTarget || dripIndex >= bufferRef.current.length - 1) {
          clearDripTimer();
        }
      }, REPLAY.DRIP_INTERVAL_MS);
    }
  }, [broadcastTs, isReplayActive, clearDripTimer, updateVisibleFromBuffer, ngFilterFn]);

  // ========== ngFilterFn 変更時にvisibleTweetsを再フィルター ==========
  useEffect(() => {
    if (!isReplayActive || revealIndexRef.current < 0) return;
    updateVisibleFromBuffer(revealIndexRef.current);
  }, [ngFilterFn, isReplayActive, updateVisibleFromBuffer]);

  // ========== アンマウント時クリーンアップ ==========
  useEffect(() => {
    return () => {
      clearDripTimer();
      cancelledRef.current = true;
    };
  }, [clearDripTimer]);

  return {
    visibleTweets,
    isPreloading,
    preloadProgress,
    bufferSize,
    isReplayActive,
  };
}

export default useTweetReplay;
