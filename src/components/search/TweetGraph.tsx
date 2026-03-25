// src/components/search/TweetGraph.tsx
// ポスト数グラフ（開閉式パネル）

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTransitionGraph } from '../../services/realtimeService';
import type { TransitionResult, GraphPeriod } from '../../types/index';

interface TweetGraphProps {
  keyword: string;
  defaultPeriod?: GraphPeriod;
  refreshTrigger?: number;
}

const PERIOD_LABELS: { key: GraphPeriod; label: string }[] = [
  { key: '6h', label: '6時間' },
  { key: '24h', label: '24時間' },
  { key: '7d', label: '7日' },
  { key: '30d', label: '30日' },
];

// 時間フォーマット
const formatTime = (ts: number, period: GraphPeriod): string => {
  const d = new Date(ts * 1000);
  if (period === '7d' || period === '30d') {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// SVG折れ線グラフ
const LineChart = ({ data, period }: { data: TransitionResult; period: GraphPeriod }) => {
  const entries = data.entries;
  if (entries.length === 0) return null;

  const W = 320;
  const H = 120;
  const PAD = { top: 20, right: 10, bottom: 28, left: 5 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxCount = Math.max(...entries.map(e => e.count), 1);
  const divisor = Math.max(entries.length - 1, 1);
  const points = entries.map((e, i) => ({
    x: PAD.left + (i / divisor) * chartW,
    y: PAD.top + chartH - (e.count / maxCount) * chartH,
    count: e.count,
    from: e.from,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + chartH} L${points[0].x},${PAD.top + chartH} Z`;

  // ピーク地点
  const peak = points.reduce((max, p) => p.count > max.count ? p : max, points[0]);

  // X軸ラベル（5つ程度）
  const labelStep = Math.max(1, Math.floor(entries.length / 5));
  const xLabels = entries.filter((_, i) => i % labelStep === 0 || i === entries.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* グリッド線 */}
      {[0, 0.25, 0.5, 0.75, 1].map(r => (
        <line key={r} x1={PAD.left} y1={PAD.top + chartH * (1 - r)} x2={W - PAD.right} y2={PAD.top + chartH * (1 - r)}
          stroke="var(--border-color)" strokeWidth="0.5" opacity="0.3" />
      ))}

      {/* 塗りつぶし */}
      <path d={areaPath} fill="var(--theme-color)" opacity="0.1" />
      {/* ライン */}
      <path d={linePath} fill="none" stroke="var(--theme-color)" strokeWidth="1.5" />

      {/* ピーク表示 */}
      {peak.count > 0 && (
        <>
          <circle cx={peak.x} cy={peak.y} r="3" fill="var(--theme-color)" />
          <text x={peak.x} y={peak.y - 8} textAnchor="middle" fontSize="8" fill="#e7e9ea" fontWeight="bold">
            {peak.count}件
          </text>
          <text x={peak.x} y={peak.y - 16} textAnchor="middle" fontSize="7" fill="#8b98a5">
            {formatTime(peak.from, period)}
          </text>
        </>
      )}

      {/* X軸ラベル */}
      {xLabels.map((e, i) => {
        const idx = entries.indexOf(e);
        const x = PAD.left + (idx / divisor) * chartW;
        return (
          <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="7" fill="#8b98a5">
            {formatTime(e.from, period)}
          </text>
        );
      })}
    </svg>
  );
};

// 感情円グラフ
const SentimentChart = ({ positive, negative }: { positive: number; negative: number }) => {
  if (positive === 0 && negative === 0) return null;
  const total = positive + negative;
  const posRatio = total > 0 ? positive / total : 0;
  const angle = posRatio * 360;

  const r = 22;
  const cx = 26;
  const cy = 26;
  const rad = (angle - 90) * (Math.PI / 180);
  const largeArc = angle > 180 ? 1 : 0;
  const endX = cx + r * Math.cos(rad);
  const endY = cy + r * Math.sin(rad);

  const posPath = angle >= 360
    ? `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx - 0.01},${cy - r} Z`
    : `M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${largeArc},1 ${endX},${endY} Z`;

  return (
    <div className="flex items-center justify-center gap-3 mt-2">
      <span className="text-green-400 font-bold text-sm">{Math.round(posRatio * 100)}%</span>
      <span className="text-xs text-[#e7e9ea]">ポジティブ</span>
      <svg viewBox="0 0 52 52" className="w-12 h-12">
        <circle cx={cx} cy={cy} r={r} fill="#e24949" />
        {posRatio > 0 && <path d={posPath} fill="#4caf50" />}
      </svg>
      <span className="text-xs text-[#e7e9ea]">ネガティブ</span>
      <span className="text-red-400 font-bold text-sm">{Math.round((1 - posRatio) * 100)}%</span>
    </div>
  );
};

export const TweetGraph = ({ keyword, defaultPeriod = '6h', refreshTrigger = 0 }: TweetGraphProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [period, setPeriod] = useState<GraphPeriod>(defaultPeriod);
  const [cache, setCache] = useState<Partial<Record<GraphPeriod, TransitionResult>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const data = cache[period] || null;
  const summaryData = cache[defaultPeriod] || null;

  const loadGraph = useCallback(async (p: GraphPeriod) => {
    if (!keyword) return;
    setIsLoading(true);
    try {
      const result = await fetchTransitionGraph(keyword, p);
      setCache(prev => ({ ...prev, [p]: result }));
    } finally {
      setIsLoading(false);
    }
  }, [keyword]);

  // キーワード変更時: リセット + デフォルト期間を自動取得（件数表示用）
  useEffect(() => {
    setCache({});
    setIsOpen(false);
    setPeriod(defaultPeriod);
    if (keyword) {
      fetchTransitionGraph(keyword, defaultPeriod).then(result => {
        setCache({ [defaultPeriod]: result });
      });
    }
  }, [keyword, defaultPeriod]);

  // ベストポスト更新時にグラフも再取得
  const lastRefreshTrigger = useRef(0);
  useEffect(() => {
    if (refreshTrigger > lastRefreshTrigger.current && keyword) {
      lastRefreshTrigger.current = refreshTrigger;
      fetchTransitionGraph(keyword, defaultPeriod).then(result => {
        setCache(prev => ({ ...prev, [defaultPeriod]: result }));
      });
      // グラフが開いていて別の期間を表示中ならそちらも更新
      if (isOpen && period !== defaultPeriod) {
        fetchTransitionGraph(keyword, period).then(result => {
          setCache(prev => ({ ...prev, [period]: result }));
        });
      }
    }
  }, [refreshTrigger, keyword, defaultPeriod, isOpen, period]);

  // パネルを開いた時、キャッシュになければ取得
  useEffect(() => {
    if (isOpen && !cache[period]) loadGraph(period);
  }, [isOpen, period, cache, loadGraph]);

  // コンテンツ変更時に max-height を再計算
  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.style.maxHeight = `${contentRef.current.scrollHeight}px`;
    }
  }, [isOpen, data, isLoading]);

  return (
    <div className="border-b border-[var(--border-color)]">
      {/* 開閉ボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-[#8b98a5] hover:bg-[var(--card-bg-color)] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
          </svg>
          ポスト数グラフ
          {summaryData && !isOpen && <span className="text-[var(--theme-color)] font-bold ml-1">{summaryData.totalCount}件</span>}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {/* パネル内容（アニメーション付き開閉） */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: isOpen ? contentRef.current?.scrollHeight ? `${contentRef.current.scrollHeight + 20}px` : '500px' : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="px-4 pb-3">
          {/* 期間タブ */}
          <div className="flex border border-[var(--border-color)] rounded overflow-hidden mb-2">
            {PERIOD_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`flex-1 text-[10px] py-1 transition-colors ${
                  period === key
                    ? 'bg-[var(--theme-color)] text-white font-bold'
                    : 'text-[#8b98a5] hover:bg-[var(--card-bg-color)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin h-5 w-5 border-2 border-[var(--theme-color)] rounded-full border-t-transparent" />
            </div>
          ) : data ? (
            <>
              {/* 総ポスト数 */}
              <div className="mb-1">
                <span className="text-lg font-bold text-[#e7e9ea]">{data.totalCount}件</span>
                <span className="text-xs ml-1 text-[#8b98a5]">のポスト</span>
              </div>

              {/* グラフ */}
              <div className="text-xs mb-1 text-[#8b98a5]">ポスト数の推移</div>
              <LineChart data={data} period={period} />

              {/* 感情グラフ */}
              {(data.positive > 0 || data.negative > 0) && (
                <>
                  <div className="text-xs mt-2 mb-1 text-[#8b98a5]">感情の割合</div>
                  <SentimentChart positive={data.positive} negative={data.negative} />
                </>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-xs text-[#8b98a5]">
              データを取得できませんでした
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
