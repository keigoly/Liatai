// src/components/home/TrendList.tsx
// トレンド一覧表示コンポーネント

import type { TrendItem } from '../../types/index';
import { RANK_COLORS } from '../../constants/index';

interface TrendListProps {
    trends: TrendItem[];
    isLoading: boolean;
    onTrendClick: (keyword: string) => void;
}

const getRankColor = (rank: number): string => {
    if (rank === 1) return RANK_COLORS[1];
    if (rank === 2) return RANK_COLORS[2];
    if (rank === 3) return RANK_COLORS[3];
    return RANK_COLORS.default;
};

const TrendStatus = ({ state }: { state: string }) => {
    switch (state) {
        case 'up':
            return (
                <div className="flex justify-center pt-1">
                    <svg
                        width="1em"
                        height="1em"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                </div>
            );
        case 'down':
            return (
                <div className="flex justify-center pt-1">
                    <svg
                        width="1em"
                        height="1em"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                </div>
            );
        case 'new':
            return (
                <span className="text-[0.6em] font-bold text-orange-400 border border-orange-400 px-1 rounded">
                    NEW
                </span>
            );
        default:
            return <span className="text-gray-600 text-[1.2em] leading-none">-</span>;
    }
};

export const TrendList = ({ trends, isLoading, onTrendClick }: TrendListProps) => {
    if (isLoading) {
        return (
            <div className="text-center py-10 text-gray-500">
                <div className="animate-spin h-6 w-6 border-4 border-gray-500 rounded-full border-t-transparent mx-auto mb-2"></div>
                トレンド取得中...
            </div>
        );
    }

    if (trends.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500">
                トレンドを取得できませんでした。
            </div>
        );
    }

    return (
        <div className="pb-10 pt-2">
            {trends.map((item, index) => (
                <div
                    key={item.rank}
                    onClick={() => onTrendClick(item.keyword)}
                    className="flex p-3 border-b border-[var(--border-color)] hover:bg-[var(--card-bg-color)] cursor-pointer transition-colors animate-rank-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                >
                    {/* ランク */}
                    <div className="flex flex-col items-center w-10 mr-3 pt-1">
                        <span className={`text-[1.3em] font-bold leading-none mb-1 ${getRankColor(item.rank)}`}>
                            {item.rank}
                        </span>
                        <TrendStatus state={item.state} />
                    </div>

                    {/* キーワード・説明 */}
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-[1em] text-white leading-snug mb-1">
                            {item.keyword}
                        </div>
                        {item.description && (
                            <p className="text-[0.8em] text-gray-400 line-clamp-2 leading-relaxed mb-1">
                                {item.description}
                            </p>
                        )}
                    </div>

                    {/* 画像 */}
                    {item.imageUrl && (
                        <div className="ml-3 w-16 h-16 flex-shrink-0">
                            <img
                                src={item.imageUrl}
                                alt="Trend"
                                className="w-full h-full object-cover rounded-lg border border-gray-700"
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
