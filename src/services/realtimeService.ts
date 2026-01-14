// src/services/realtimeService.ts

import type { Tweet, TrendItem, TrendResult, FetchTweetsResult, TrendState } from '../types/index';
import { generateHashId, parseRelativeTime } from '../utils/helpers';

// Re-export types for backward compatibility
export type { Tweet, TrendItem, TrendResult, FetchTweetsResult, TrendState };


const parseTweetElement = (el: Element): Omit<Tweet, 'isBest'> | null => {
  try {
    let bodyContainer = el.querySelector('[class*="Tweet_bodyContainer__"]');
    let bodyEl = bodyContainer?.querySelector('[class*="Tweet_body__"]');
    if (!bodyEl) bodyEl = el.querySelector('[class*="Tweet_body__"]');
    if (!bodyEl) return null;

    const iconImg = el.querySelector('[class*="Tweet_icon__"] img') as HTMLImageElement;
    let iconUrl = iconImg ? iconImg.src : "";

    // ★修正: 返信先情報の分離処理
    let replyTo: string | undefined = undefined;

    // bodyElをクローンして、HTML構造を破壊せずに操作
    const bodyClone = bodyEl.cloneNode(true) as HTMLElement;

    // 返信先を示す要素（class名に "Tweet__reply" を含むspan等）を探す
    const replySpan = bodyClone.querySelector('[class*="Tweet__reply"]');

    if (replySpan) {
      // "返信先: @username" のようなテキストから @username を抽出
      const replyText = replySpan.textContent || "";
      const match = replyText.match(/@([a-zA-Z0-9_]+)/);
      if (match) {
        replyTo = "@" + match[1];
      }
      // 本文から返信先表示を削除して、純粋なメッセージだけにする
      replySpan.remove();
    }

    let text = bodyClone.textContent || "";
    text = text.trim();

    const nameEl = el.querySelector('[class*="Tweet_authorName__"]');
    const idEl = el.querySelector('[class*="Tweet_authorID__"]');
    const author = nameEl?.textContent?.trim() || "Unknown";
    let handle = idEl?.textContent?.trim() || "";

    const timeEl = el.querySelector('[class*="Tweet_time__"]');
    let timestamp = timeEl?.textContent?.trim() || "";

    // 返信の場合でも実際の時間を表示（Nowに上書きしない）

    const createdAt = parseRelativeTime(timestamp);

    let tweetId = "";
    let url = "";

    const overallLink = el.querySelector('a[href*="/realtime/search/tweet/"]');
    if (overallLink) {
      const href = overallLink.getAttribute('href') || "";
      url = href.startsWith('http') ? href : `https://search.yahoo.co.jp${href}`;
      const match = href.match(/\/tweet\/(\d+)/);
      if (match && match[1]) tweetId = match[1];
    }

    if (!tweetId) {
      const timeLink = timeEl?.querySelector('a');
      if (timeLink) {
        const href = timeLink.getAttribute('href') || "";
        if (!url) url = href;
        const match = href.match(/status\/(\d+)/);
        if (match && match[1]) tweetId = match[1];
      }
    }

    if (!tweetId) {
      tweetId = generateHashId(handle + text);
    }

    const searchScope = bodyContainer || el;
    const potentialImages = Array.from(searchScope.querySelectorAll('img'));
    let mediaUrl: string | undefined = undefined;
    for (const img of potentialImages) {
      if (img.src !== iconUrl && !img.className.includes('emoji')) {
        mediaUrl = img.src;
        break;
      }
    }

    let retweetCount = "", likeCount = "";
    const actionList = el.querySelector('[class*="Tweet_action__"]');
    if (actionList) {
      const items = actionList.querySelectorAll('li');
      items.forEach(item => {
        const link = item.querySelector('a');
        const countSpan = item.querySelector('span');
        if (link && countSpan && countSpan.textContent) {
          const href = link.getAttribute('href') || "";
          if (href.includes('intent/retweet')) retweetCount = countSpan.textContent.trim();
          else if (href.includes('intent/like')) likeCount = countSpan.textContent.trim();
        }
      });
    }

    return {
      id: tweetId,
      text, url, timestamp, createdAt,
      author, handle, iconUrl, mediaUrl, retweetCount, likeCount, replyTo
    };
  } catch (e) {
    return null;
  }
};

// ... (fetchRealtimeTweets, fetchRealtimeTrends は変更なしですが、contextとして必要なら維持してください) ...
// start: 1 = 最初のページ、21 = 2ページ目、41 = 3ページ目...（20件単位のオフセット）
export const fetchRealtimeTweets = async (keyword: string, start: number = 1): Promise<FetchTweetsResult> => {
  if (!keyword) return { best: null, timeline: [] };

  try {
    // start=1が最初のページ、start=21が2ページ目（20件単位のオフセット）
    const targetUrl = `https://search.yahoo.co.jp/realtime/search?p=${encodeURIComponent(keyword)}&ei=UTF-8&ord=new${start > 1 ? `&b=${start}` : ''}`;
    console.log('[fetchRealtimeTweets] URL:', targetUrl, 'start:', start);
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    let bestTweet: Tweet | null = null;
    const autoRefreshTweets: Tweet[] = []; // 自動更新エリアのツイート（最新）
    const timelineTweets: Tweet[] = [];
    const idSet = new Set<string>();

    // 1. まず #autosr（自動更新エリア）からツイートを取得（最新の投稿）
    const autosrContainer = doc.getElementById('autosr');
    if (autosrContainer) {
      const wrappers = autosrContainer.querySelectorAll('[class*="Tweet_TweetContainer__"]');
      wrappers.forEach(el => {
        const t = parseTweetElement(el);
        if (t && !idSet.has(t.id)) {
          autoRefreshTweets.push({ ...t, isBest: false });
          idSet.add(t.id);
        }
      });
    }

    // 2. #bt（ベストポスト）を取得
    const btContainer = doc.getElementById('bt');
    if (btContainer) {
      const bestWrapper = btContainer.querySelector('[class*="Tweet_TweetContainer__"]');
      if (bestWrapper) {
        const t = parseTweetElement(bestWrapper);
        if (t && !idSet.has(t.id)) {
          bestTweet = { ...t, isBest: true };
          idSet.add(t.id);
        }
      }
    }

    // 3. #sr（タイムライン）からツイートを取得
    const srContainer = doc.getElementById('sr');
    if (srContainer) {
      const wrappers = srContainer.querySelectorAll('[class*="Tweet_TweetContainer__"]');
      wrappers.forEach(el => {
        const t = parseTweetElement(el);
        if (t && !idSet.has(t.id)) {
          timelineTweets.push({ ...t, isBest: false });
          idSet.add(t.id);
        }
      });
    }

    // 本家と同じ順序：自動更新ツイート → ベストポスト → タイムライン
    // ただし、ベストポストは別途返すので、タイムラインに自動更新ツイートを先頭に追加
    const combinedTimeline = [...autoRefreshTweets, ...timelineTweets];

    console.log('[fetchRealtimeTweets] Results - autosr:', autoRefreshTweets.length, 'sr:', timelineTweets.length, 'total:', combinedTimeline.length);

    return { best: bestTweet, timeline: combinedTimeline };

  } catch (error) {
    console.error('[Service] Fetch tweets failed:', error);
    return { best: null, timeline: [] };
  }
};

// JSON APIを使用したページネーション（もっと見る機能用）
// oldestTweetId: 現在表示されているリストの最後（最古）のポストのID
// pageIndex: ページ番号（0から始まる）
export const fetchMoreTweets = async (keyword: string, oldestTweetId: string, pageIndex: number = 0): Promise<Tweet[]> => {
  if (!keyword || !oldestTweetId) return [];

  try {
    const targetUrl = `https://search.yahoo.co.jp/realtime/api/v1/pagination?p=${encodeURIComponent(keyword)}&rkf=3&b=${pageIndex}&oldestTweetId=${oldestTweetId}&start=`;
    console.log('[fetchMoreTweets] URL:', targetUrl);

    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const json = await response.json();
    const entries = json?.data?.timeline?.entry || [];

    console.log('[fetchMoreTweets] Received entries:', entries.length);

    // JSON APIのレスポンスをTweet型に変換
    const tweets: Tweet[] = entries.map((entry: {
      id: string;
      displayText?: string;
      displayTextBody?: string;
      name?: string;
      screenName?: string;
      createdAt?: number;
      profileImage?: string;
      url?: string;
      likesCount?: number;
      rtCount?: number;
      media?: Array<{ thumbnailUrl?: string }>;
      replyScreenName?: string;
    }) => {
      // 相対時間を計算
      const createdAtTimestamp = entry.createdAt ? entry.createdAt * 1000 : Date.now();
      const now = Date.now();
      const diffSec = Math.floor((now - createdAtTimestamp) / 1000);
      let timestamp = '';
      if (diffSec < 60) timestamp = `${diffSec}秒前`;
      else if (diffSec < 3600) timestamp = `${Math.floor(diffSec / 60)}分前`;
      else if (diffSec < 86400) timestamp = `${Math.floor(diffSec / 3600)}時間前`;
      else timestamp = `${Math.floor(diffSec / 86400)}日前`;

      return {
        id: entry.id,
        text: entry.displayTextBody || entry.displayText || '',
        url: entry.url || '',
        timestamp,
        createdAt: createdAtTimestamp,
        author: entry.name || 'Unknown',
        handle: entry.screenName ? `@${entry.screenName}` : '',
        iconUrl: entry.profileImage || '',
        mediaUrl: entry.media && entry.media.length > 0 ? entry.media[0].thumbnailUrl : undefined,
        retweetCount: entry.rtCount ? String(entry.rtCount) : undefined,
        likeCount: entry.likesCount ? String(entry.likesCount) : undefined,
        isBest: false,
        replyTo: entry.replyScreenName ? `@${entry.replyScreenName}` : undefined,
      };
    });

    return tweets;

  } catch (error) {
    console.error('[Service] Fetch more tweets failed:', error);
    return [];
  }
};

export const fetchRealtimeTrends = async (): Promise<TrendResult> => {
  // 省略 (変更なし)
  try {
    const targetUrl = 'https://search.yahoo.co.jp/realtime';
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    let updateTime = "";
    const pageText = doc.body.textContent || "";
    const timeMatch = pageText.match(/(\d{1,2}:\d{2})\s*更新/);
    if (timeMatch) updateTime = timeMatch[1] + "更新";

    const trends: TrendItem[] = [];
    const mobileItems = doc.querySelectorAll('[class*="TrendItem_BuzzWord"]');

    if (mobileItems.length > 0) {
      mobileItems.forEach((item) => {
        const el = item as HTMLElement;
        const rankEl = el.querySelector('[class*="TrendItem_rank"]');
        const rankText = rankEl?.childNodes[0]?.textContent?.trim() || "0";
        const titleEl = el.querySelector('h1');
        const keyword = titleEl?.textContent?.trim() || "";
        const descEl = el.querySelector('[class*="TrendItem_description"]');
        const description = descEl?.textContent?.trim() || "";
        const imgEl = el.querySelector('img');
        const imageUrl = imgEl ? imgEl.src : undefined;

        let state: TrendState = 'keep';
        if (el.querySelector('[class*="TrendItem_new"]')) state = 'new';
        else {
          if (el.querySelector('[class*="TrendItem_hot"]')) state = 'up';
          const svg = el.querySelector('svg');
          if (svg) {
            const fill = svg.getAttribute('fill') || "";
            if (fill.includes('006621') || fill.includes('#006621')) state = 'down';
            else if (fill.includes('e24949') || fill.includes('e60013')) state = 'up';
          }
        }
        if (keyword) trends.push({ rank: parseInt(rankText, 10), keyword, state, imageUrl, description });
      });
    } else {
      // Fallback logic
      const container = doc.querySelector('[class*="Trend_container"]');
      if (container) {
        const items = container.querySelectorAll('li');
        items.forEach((item) => {
          const anchor = item.querySelector('a');
          const spanRank = anchor?.querySelector('span');
          const articleH1 = anchor?.querySelector('article h1');
          let state: TrendState = 'keep';
          const svg = anchor?.querySelector('svg');
          if (svg) {
            const fill = svg.getAttribute('fill') || "";
            if (fill.includes('e60013')) state = 'up';
            else if (fill.includes('006621')) state = 'down';
          }
          if (spanRank && articleH1) {
            trends.push({
              rank: parseInt(spanRank.textContent?.trim() || "0", 10),
              keyword: articleH1.textContent?.trim() || "",
              state
            });
          }
        });
      }
    }

    return { updateTime: updateTime, items: trends.sort((a, b) => a.rank - b.rank) };
  } catch (error) {
    return { updateTime: "", items: [] };
  }
};