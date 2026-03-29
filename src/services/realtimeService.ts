// src/services/realtimeService.ts

import type { Tweet, TrendItem, TrendResult, FetchTweetsResult, TrendState, TransitionResult, GraphPeriod } from '../types/index';
import { generateHashId, parseRelativeTime } from '../utils/helpers';

// Re-export types for backward compatibility
export type { Tweet, TrendItem, TrendResult, FetchTweetsResult, TrendState, TransitionResult, GraphPeriod };

// ========== JSON エントリ型 ==========
interface JsonEntry {
  id: string | number;
  url?: string;
  displayText?: string;
  displayTextBody?: string;
  name?: string;
  screenName?: string;
  createdAt?: number;
  profileImage?: string;
  likesCount?: number;
  rtCount?: number;
  qtCount?: number;
  replyCount?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  media?: Array<Record<string, any>>;
  replyScreenName?: string;
  badge?: { show?: boolean; type?: string; color?: string };
}

// ========== YahooのJSONキーワードハイライト用マーカー除去 ==========
// displayText/displayTextBody、name 等に "START keyword END" 形式で挿入される
// マーカー前後のスペースも消費し、CJK文脈では不要スペースを除去する
const stripYahooMarkers = (text: string): string => {
  // Step 1: マーカー除去（Yahoo実データはタブ区切り: \tSTART\tキーワード\tEND\t）
  let result = text.replace(/\s?START\s?(.*?)\s?END\s?/g, (match, captured, offset, fullStr) => {
    const charBefore = offset > 0 ? fullStr[offset - 1] : '';
    const charAfter = (offset + match.length) < fullStr.length ? fullStr[offset + match.length] : '';
    // ラテン文字/数字間のみスペースを保持（英単語の区切り）
    const needsLeading = /[a-zA-Z0-9]/.test(charBefore);
    const needsTrailing = /[a-zA-Z0-9]/.test(charAfter);
    const content = captured.trim();
    return (needsLeading ? ' ' : '') + content + (needsTrailing ? ' ' : '');
  });
  // Step 2: 不可視文字の正規化（\u3000=全角スペースを含む全Unicode空白を半角化）
  result = result
    .replace(/[\u200B\u200C\u200E\u200F\u2028\u2029\u2060\uFEFF]/g, '')  // ゼロ幅・制御文字除去
    .replace(/[^\S ]/g, ' ');                                             // 全特殊空白→半角スペース
  // Step 3: CJK文字に隣接する不要スペースを除去（\u3001〜: \u3000=全角スペースを除外）
  result = result
    .replace(/([\u3001-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]) +/g, '$1')
    .replace(/ +([\u3001-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF])/g, '$1');
  // Step 4: ハッシュタグ修復（半角・全角両対応: "# tag" → "#tag"）
  result = result.replace(/([#＃])\s+(?=\S)/g, '$1');
  // Step 5: 連続スペース除去
  return result.replace(/ {2,}/g, ' ').trim();
};

// ========== 共通: JSONエントリ → Tweet 変換 ==========
const mapEntryToTweet = (entry: JsonEntry): Tweet => {
  const createdAtMs = entry.createdAt ? entry.createdAt * 1000 : Date.now();
  const now = Date.now();
  const diffSec = Math.floor((now - createdAtMs) / 1000);
  let timestamp = '';
  if (diffSec < 60) timestamp = `${diffSec}秒前`;
  else if (diffSec < 3600) timestamp = `${Math.floor(diffSec / 60)}分前`;
  else if (diffSec < 86400) timestamp = `${Math.floor(diffSec / 3600)}時間前`;
  else timestamp = `${Math.floor(diffSec / 86400)}日前`;

  const rawText = entry.displayTextBody || entry.displayText || '';

  // メディアURL抽出（Yahoo JSON: media[].metaImageUrl がサムネイル）
  let mediaUrl: string | undefined;
  if (entry.media && entry.media.length > 0) {
    const m = entry.media[0];
    mediaUrl = m.metaImageUrl || m.thumbnailUrl || m.url || m.originalUrl;
  }

  return {
    id: String(entry.id),
    text: stripYahooMarkers(rawText),
    url: entry.url || '',
    timestamp,
    createdAt: createdAtMs,
    author: stripYahooMarkers(entry.name || 'Unknown'),
    handle: entry.screenName ? `@${entry.screenName}` : '',
    iconUrl: entry.profileImage || '',
    mediaUrl,
    retweetCount: entry.rtCount ? String(entry.rtCount) : undefined,
    likeCount: entry.likesCount ? String(entry.likesCount) : undefined,
    isBest: false,
    replyTo: entry.replyScreenName ? `@${entry.replyScreenName}` : undefined,
  };
};

// ========== 方式1: __NEXT_DATA__ JSON パース ==========
const parseFromJson = (doc: Document): FetchTweetsResult | null => {
  try {
    const scriptEl = doc.getElementById('__NEXT_DATA__');
    if (!scriptEl?.textContent) return null;

    const json = JSON.parse(scriptEl.textContent);
    const pageProps = json?.props?.pageProps;
    if (!pageProps) return null;

    // Yahoo のJSON構造: pageProps.pageData 内にデータがある場合と、pageProps 直下の場合がある
    const dataSource = pageProps.pageData || pageProps;

    // タイムライン
    const entries: JsonEntry[] = dataSource.timeline?.entry;
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const timeline = entries.map(entry => mapEntryToTweet(entry));

    // ベストポスト（Yahoo本家と同じ: 専用フィールドから取得）
    let bestTweet: Tweet | null = null;
    const bestEntry: JsonEntry | undefined = dataSource.bestTweet;
    if (bestEntry) {
      bestTweet = { ...mapEntryToTweet(bestEntry), isBest: true };
    }

    console.log('[parseFromJson] best:', bestTweet ? `${bestTweet.author} (${bestTweet.id})` : 'none', 'timeline:', timeline.length);
    return { best: bestTweet, timeline };
  } catch (e) {
    console.error('[parseFromJson] Parse error:', e);
    return null;
  }
};

// ========== 方式2: DOM パース（フォールバック） ==========
const parseTweetElement = (el: Element): Omit<Tweet, 'isBest'> | null => {
  try {
    const bodyContainer = el.querySelector('[class*="Tweet_bodyContainer__"]');
    let bodyEl = bodyContainer?.querySelector('[class*="Tweet_body__"]');
    if (!bodyEl) bodyEl = el.querySelector('[class*="Tweet_body__"]');
    if (!bodyEl) return null;

    const iconImg = el.querySelector('[class*="Tweet_icon__"] img') as HTMLImageElement;
    const iconUrl = iconImg ? iconImg.src : "";

    let replyTo: string | undefined = undefined;
    const bodyClone = bodyEl.cloneNode(true) as HTMLElement;
    const replySpan = bodyClone.querySelector('[class*="Tweet__reply"]');
    if (replySpan) {
      const replyText = replySpan.textContent || "";
      const match = replyText.match(/@([a-zA-Z0-9_]+)/);
      if (match) replyTo = "@" + match[1];
      replySpan.remove();
    }

    let text = bodyClone.textContent || "";
    text = text
      .replace(/[\u200B\u200C\u200E\u200F\u2028\u2029\u2060\uFEFF]/g, '')  // ゼロ幅・制御文字除去
      .replace(/[^\S ]/g, ' ')                                              // 全特殊空白→半角スペース（\u3000,\u00A0,\t,\n等すべて）
      .replace(/([\u3001-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]) +/g, '$1')    // CJK文字直後のスペース除去
      .replace(/ +([\u3001-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF])/g, '$1')    // CJK文字直前のスペース除去
      .replace(/([#＃])\s+(?=\S)/g, '$1')                                   // ハッシュタグ修復
      .replace(/ {2,}/g, ' ')                                               // 連続スペース→1つ
      .trim();

    const nameEl = el.querySelector('[class*="Tweet_authorName__"]');
    const idEl = el.querySelector('[class*="Tweet_authorID__"]');
    const author = nameEl?.textContent?.trim() || "Unknown";
    const handle = idEl?.textContent?.trim() || "";

    const timeEl = el.querySelector('[class*="Tweet_time__"]');
    const timestamp = timeEl?.textContent?.trim() || "";
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

    if (!tweetId) tweetId = generateHashId(handle + text);

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
  } catch {
    return null;
  }
};

// ========== #autosr から最新ツイートをDOM取得 ==========
const parseAutosrFromDom = (doc: Document): Tweet[] => {
  const tweets: Tweet[] = [];
  const container = doc.getElementById('autosr');
  if (!container) return tweets;

  const wrappers = container.querySelectorAll('[class*="Tweet_TweetContainer__"]');
  wrappers.forEach(el => {
    const t = parseTweetElement(el);
    if (t) tweets.push({ ...t, isBest: false });
  });

  console.log('[parseAutosrFromDom] Found', tweets.length, 'autosr tweets');
  return tweets;
};

const parseDomFallback = (doc: Document): FetchTweetsResult => {
  let bestTweet: Tweet | null = null;
  const timelineTweets: Tweet[] = [];
  const idSet = new Set<string>();

  // DOM構造のデバッグ
  const hasBt = !!doc.getElementById('bt');
  const hasAutosr = !!doc.getElementById('autosr');
  const hasSr = !!doc.getElementById('sr');
  const hasNextData = !!doc.getElementById('__NEXT_DATA__');
  console.log('[parseDomFallback] DOM sections: #bt:', hasBt, '#autosr:', hasAutosr, '#sr:', hasSr, '__NEXT_DATA__:', hasNextData);

  // BestTweet クラスで検出（Yahoo本家の構造）
  const bestTweetEl = doc.querySelector('[class*="BestTweet_BestTweet__"]');
  if (bestTweetEl) {
    const bestWrapper = bestTweetEl.querySelector('[class*="Tweet_TweetContainer__"]');
    if (bestWrapper) {
      const t = parseTweetElement(bestWrapper);
      if (t && !idSet.has(t.id)) {
        bestTweet = { ...t, isBest: true };
        idSet.add(t.id);
        console.log('[parseDomFallback] BEST (BestTweet class):', t.author, t.text.substring(0, 50));
      }
    }
  }

  // #bt フォールバック（BestTweet クラスが見つからない場合）
  if (!bestTweet) {
    const btContainer = doc.getElementById('bt');
    if (btContainer) {
      const bestWrapper = btContainer.querySelector('[class*="Tweet_TweetContainer__"]');
      if (bestWrapper) {
        const t = parseTweetElement(bestWrapper);
        if (t && !idSet.has(t.id)) {
          bestTweet = { ...t, isBest: true };
          idSet.add(t.id);
          console.log('[parseDomFallback] BEST (#bt):', t.author, t.text.substring(0, 50));
        }
      }
    }
  }

  // #autosr + #sr
  for (const sectionId of ['autosr', 'sr']) {
    const container = doc.getElementById(sectionId);
    if (container) {
      const wrappers = container.querySelectorAll('[class*="Tweet_TweetContainer__"]');
      const beforeCount = timelineTweets.length;
      wrappers.forEach(el => {
        const t = parseTweetElement(el);
        if (t && !idSet.has(t.id)) {
          timelineTweets.push({ ...t, isBest: false });
          idSet.add(t.id);
        }
      });
      console.log(`[parseDomFallback] #${sectionId}: ${timelineTweets.length - beforeCount} tweets`);
    }
  }

  // セクションIDが無い場合、ページ全体からツイートを取得
  if (timelineTweets.length === 0) {
    const allWrappers = doc.querySelectorAll('[class*="Tweet_TweetContainer__"]');
    console.log('[parseDomFallback] No sections found, scanning full page:', allWrappers.length, 'containers');
    allWrappers.forEach(el => {
      const t = parseTweetElement(el);
      if (t && !idSet.has(t.id)) {
        timelineTweets.push({ ...t, isBest: false });
        idSet.add(t.id);
      }
    });
  }

  console.log('[parseDomFallback] Result: best:', bestTweet?.author || 'none', 'timeline:', timelineTweets.length);
  if (timelineTweets.length > 0) {
    console.log('[parseDomFallback] First 3 timeline:', timelineTweets.slice(0, 3).map(t => `${t.author}: ${t.text.substring(0, 40)}`));
  }

  return { best: bestTweet, timeline: timelineTweets };
};

// ========== メイン: ツイート取得 ==========
export const fetchRealtimeTweets = async (keyword: string, start: number = 1): Promise<FetchTweetsResult> => {
  if (!keyword) return { best: null, timeline: [] };

  try {
    const targetUrl = `https://search.yahoo.co.jp/realtime/search?p=${encodeURIComponent(keyword)}&ei=UTF-8&ord=new${start > 1 ? `&b=${start}` : ''}`;
    console.log('[fetchRealtimeTweets] URL:', targetUrl, 'start:', start);
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // === 方式1: __NEXT_DATA__ JSON + DOM #autosr（Yahoo本家準拠） ===
    const jsonResult = parseFromJson(doc);

    if (jsonResult && jsonResult.timeline.length > 0) {
      // #autosr の最新ツイートをDOMから取得（JSONには含まれない）
      const autosrTweets = parseAutosrFromDom(doc);

      // autosr のツイートをタイムラインの先頭に追加（重複排除）
      const timelineIds = new Set(jsonResult.timeline.map(t => t.id));
      const bestId = jsonResult.best?.id;
      const uniqueAutosr = autosrTweets.filter(t => !timelineIds.has(t.id) && t.id !== bestId);
      const timeline = [...uniqueAutosr, ...jsonResult.timeline];

      console.log('[fetchRealtimeTweets] JSON+autosr: best:', jsonResult.best?.author, 'autosr:', uniqueAutosr.length, 'timeline:', timeline.length);
      return { best: jsonResult.best, timeline };
    }

    // === 方式2: DOM パース（フォールバック） ===
    console.log('[fetchRealtimeTweets] JSON not found, falling back to DOM');
    return parseDomFallback(doc);

  } catch (error) {
    console.error('[Service] Fetch tweets failed:', error);
    return { best: null, timeline: [] };
  }
};

// ========== Snowflake ID で特定時刻のツイートを取得（SYNC モード用） ==========
// Twitter Snowflake ID: (timestamp_ms - 1288834974657) << 22
// 放送終了時刻の Snowflake ID を生成し、その直前のツイートをページネーション API で取得する
const TWITTER_EPOCH = 1288834974657n;
export const timestampToSnowflakeId = (timestampMs: number): string => {
  const ts = BigInt(Math.floor(timestampMs));
  return ((ts - TWITTER_EPOCH) << 22n).toString();
};
export const fetchTweetsAtTime = async (keyword: string, timestampMs: number): Promise<Tweet[]> => {
  const syntheticId = timestampToSnowflakeId(timestampMs);
  return fetchMoreTweets(keyword, syntheticId, 0);
};

// ========== ページネーション（もっと見る機能用） ==========
export const fetchMoreTweets = async (keyword: string, oldestTweetId: string, pageIndex: number = 0): Promise<Tweet[]> => {
  if (!keyword || !oldestTweetId) return [];

  try {
    const targetUrl = `https://search.yahoo.co.jp/realtime/api/v1/pagination?p=${encodeURIComponent(keyword)}&rkf=3&b=${pageIndex}&oldestTweetId=${oldestTweetId}&start=`;

    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const json = await response.json();
    const entries: JsonEntry[] = json?.timeline?.entry || [];
    const total = json?.timeline?.head?.totalResultsAvailable || 0;

    console.log('[fetchMoreTweets] entries:', entries.length, 'total:', total);
    return entries.map(entry => mapEntryToTweet(entry));

  } catch (error) {
    console.error('[Service] Fetch more tweets failed:', error);
    return [];
  }
};

// ========== ポスト数グラフ（transition API） ==========
const GRAPH_PARAMS: Record<GraphPeriod, { span: number; interval: number }> = {
  '6h':  { span: 21600,   interval: 900 },
  '24h': { span: 86400,   interval: 3600 },
  '7d':  { span: 604800,  interval: 21600 },
  '30d': { span: 2592000, interval: 86400 },
};

export const fetchTransitionGraph = async (keyword: string, period: GraphPeriod = '6h'): Promise<TransitionResult> => {
  const empty: TransitionResult = { totalCount: 0, entries: [], positive: 0, negative: 0 };
  if (!keyword) return empty;

  try {
    const { span, interval } = GRAPH_PARAMS[period];
    const targetUrl = `https://search.yahoo.co.jp/realtime/api/v1/transition?p=${encodeURIComponent(keyword)}&interval=${interval}&span=${span}&samplingRate=100&rkf=3`;
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const json = await response.json();
    const head = json?.tweetTransition?.head;
    const entries = json?.tweetTransition?.entry || [];
    const sentiment = json?.sentimentPieChart;

    return {
      totalCount: head?.totalResultsAvailable || 0,
      entries: entries.map((e: { from: number; to: number; count: number }) => ({
        from: e.from,
        to: e.to,
        count: e.count,
      })),
      positive: sentiment?.positive || 0,
      negative: sentiment?.negative || 0,
    };
  } catch (error) {
    console.error('[Service] Fetch transition graph failed:', error);
    return empty;
  }
};

/**
 * NextGenTV サーバーのツイートキャッシュから録画番組のツイートを取得する。
 * サーバーがライブ放送中に自動収集したデータを返す。
 * not_found の場合は従来の Yahoo API フォールバックを使用する。
 */
export const fetchCachedTweets = async (
  keyword: string,
  programStartMs: number,
  programEndMs: number,
): Promise<{ status: string; tweets: Tweet[] }> => {
  try {
    const params = new URLSearchParams({
      keyword,
      program_start_ms: String(programStartMs),
      program_end_ms: String(programEndMs),
    });
    const response = await fetch(`/api/realtime/cached-tweets?${params}`);
    if (!response.ok) return { status: 'not_found', tweets: [] };
    const json = await response.json();
    return {
      status: json.status || 'not_found',
      tweets: (json.tweets || []).map((t: any) => ({
        ...t,
        // サーバーのcreatedAtはms形式なのでそのまま使用
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      })),
    };
  } catch {
    console.warn('[realtimeService] Server cache fetch failed, will use Yahoo API');
    return { status: 'not_found', tweets: [] };
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
  } catch {
    return { updateTime: "", items: [] };
  }
};