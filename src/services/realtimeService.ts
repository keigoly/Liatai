// src/services/realtimeService.ts

export interface Tweet {
  id: string;
  text: string;
  url: string;
  timestamp: string;
  author: string;
  handle: string;
  iconUrl: string;
  mediaUrl?: string;
  retweetCount?: string;
  likeCount?: string;
}

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

// バックアップ用のID生成
const generateHashId = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `hash-${Math.abs(hash)}`;
};

// ツイート要素の解析ロジック
const parseTweetElement = (el: Element): Tweet | null => {
  try {
    let bodyContainer = el.querySelector('[class*="Tweet_bodyContainer__"]');
    let bodyEl = bodyContainer?.querySelector('[class*="Tweet_body__"]');
    if (!bodyEl) bodyEl = el.querySelector('[class*="Tweet_body__"]');
    if (!bodyEl) return null;

    const iconImg = el.querySelector('[class*="Tweet_icon__"] img') as HTMLImageElement;
    let iconUrl = iconImg ? iconImg.src : "";

    let text = bodyEl.textContent || "";
    const replySpan = bodyEl.querySelector('[class*="Tweet__reply"]');
    if (replySpan && replySpan.textContent) {
      text = text.replace(replySpan.textContent, '');
    }
    text = text.trim();

    const nameEl = el.querySelector('[class*="Tweet_authorName__"]');
    const idEl = el.querySelector('[class*="Tweet_authorID__"]');
    const author = nameEl?.textContent?.trim() || "Unknown";
    const handle = idEl?.textContent?.trim() || "";

    const timeEl = el.querySelector('[class*="Tweet_time__"]');
    const timestamp = timeEl?.textContent?.trim() || "";
    
    // IDとURLの特定（ここが重要：HTML内の固有IDを優先）
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
        // IDが取れない場合は、内容からハッシュを生成して固定化
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
      id: tweetId, // 絶対に変わらないID
      text, url, timestamp, author, handle, iconUrl, mediaUrl, retweetCount, likeCount
    };
  } catch (e) {
    return null;
  }
};

// ★修正: 戻り値を単一の Tweet[] に戻す
export const fetchRealtimeTweets = async (keyword: string): Promise<Tweet[]> => {
  if (!keyword) return [];
  
  try {
    const targetUrl = `https://search.yahoo.co.jp/realtime/search?p=${encodeURIComponent(keyword)}&ei=UTF-8&ord=new`;
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    
    const results: Tweet[] = [];
    const idSet = new Set<string>();

    // 1. ベストポストエリア(#bt)を取得
    const btContainer = doc.getElementById('bt');
    if (btContainer) {
      const wrappers = btContainer.querySelectorAll('[class*="Tweet_TweetContainer__"]');
      wrappers.forEach(el => {
        const t = parseTweetElement(el);
        if (t && !idSet.has(t.id)) {
          results.push(t);
          idSet.add(t.id);
        }
      });
    }

    // 2. 新着エリア(#sr)を取得
    const srContainer = doc.getElementById('sr');
    if (srContainer) {
      const wrappers = srContainer.querySelectorAll('[class*="Tweet_TweetContainer__"]');
      wrappers.forEach(el => {
        const t = parseTweetElement(el);
        if (t && !idSet.has(t.id)) {
          results.push(t);
          idSet.add(t.id);
        }
      });
    }

    return results;

  } catch (error) {
    console.error('[Service] Fetch tweets failed:', error);
    return [];
  }
};

export const fetchRealtimeTrends = async (): Promise<TrendResult> => {
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