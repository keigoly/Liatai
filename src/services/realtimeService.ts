// src/services/realtimeService.ts

export interface Tweet {
  id: string;
  text: string;
  url: string;
  timestamp: string;
  createdAt: number;
  author: string;
  handle: string;
  iconUrl: string;
  mediaUrl?: string;
  retweetCount?: string;
  likeCount?: string;
  isBest: boolean;
  replyTo?: string; // ★追加: 返信先のハンドル名 (@user)
}

// ... (TrendState, TrendItem, TrendResult, FetchTweetsResult, generateHashId, parseRelativeTime は変更なし) ...

export type TrendState = 'up' | 'down' | 'new' | 'keep';

export interface TrendItem {
  rank: number;
  keyword: string;
  state: TrendState;
  imageUrl?: string;
  description?: string;
}

export interface TrendResult {
  updateTime: string;
  items: TrendItem[];
}

export interface FetchTweetsResult {
  best: Tweet | null;
  timeline: Tweet[];
}

const generateHashId = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `hash-${Math.abs(hash)}`;
};

const parseRelativeTime = (timeStr: string): number => {
  const now = Date.now();
  if (timeStr === 'Now') return now; 
  const secMatch = timeStr.match(/(\d+)秒/);
  if (secMatch) return now - (parseInt(secMatch[1], 10) * 1000);
  const minMatch = timeStr.match(/(\d+)分/);
  if (minMatch) return now - (parseInt(minMatch[1], 10) * 60000);
  return now;
};

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
    const isReply = !!replySpan;

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
    
    if (isReply) {
      timestamp = "Now";
    }

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
export const fetchRealtimeTweets = async (keyword: string): Promise<FetchTweetsResult> => {
  if (!keyword) return { best: null, timeline: [] };
  
  try {
    const targetUrl = `https://search.yahoo.co.jp/realtime/search?p=${encodeURIComponent(keyword)}&ei=UTF-8&ord=new`;
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    
    let bestTweet: Tweet | null = null;
    const timelineTweets: Tweet[] = [];
    const idSet = new Set<string>();

    const btContainer = doc.getElementById('bt');
    if (btContainer) {
      const bestWrapper = btContainer.querySelector('[class*="Tweet_TweetContainer__"]');
      if (bestWrapper) {
        const t = parseTweetElement(bestWrapper);
        if (t) {
          bestTweet = { ...t, isBest: true };
          idSet.add(t.id);
        }
      }
    }

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

    return { best: bestTweet, timeline: timelineTweets };

  } catch (error) {
    console.error('[Service] Fetch tweets failed:', error);
    return { best: null, timeline: [] };
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