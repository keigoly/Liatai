// src/components/search/TweetCard.tsx
// 個々のツイートカードコンポーネント

import { TweetText } from './TweetText';
import { RelativeTime } from '../common/RelativeTime';
import type { Tweet } from '../../types/index';

interface TweetCardProps {
    tweet: Tweet;
    activeTab: 'all' | 'text' | 'media';
    isMenuOpen: boolean;
    onMenuToggle: (id: string | null) => void;
    onHashtagClick: (tag: string) => void;
    onAddNgUser: (handle: string) => void;
}

export const TweetCard = ({
    tweet,
    activeTab,
    isMenuOpen,
    onMenuToggle,
    onHashtagClick,
    onAddNgUser,
}: TweetCardProps) => {
    return (
        <div
            className={`border-b border-[var(--border-color)] hover:bg-[var(--card-bg-color)] transition-colors relative ${tweet.isBest ? 'bg-[rgba(29,155,240,0.1)]' : ''
                }`}
        >
            <div className="p-4 flex gap-3">
                {/* アイコン */}
                <a
                    href={`https://x.com/${tweet.handle.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 group"
                >
                    {tweet.iconUrl ? (
                        <img
                            src={tweet.iconUrl}
                            alt={tweet.author}
                            className="w-10 h-10 rounded-full object-cover bg-gray-700 group-hover:brightness-90 transition-all"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                    ) : null}
                    <div
                        className={`w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-[1.1em] font-bold text-white overflow-hidden group-hover:brightness-90 transition-all ${tweet.iconUrl ? 'hidden' : ''
                            }`}
                    >
                        {tweet.author.charAt(0)}
                    </div>
                </a>

                {/* コンテンツ */}
                <div className="flex-1 min-w-0 relative">
                    {/* ヘッダー */}
                    <div className="flex items-baseline justify-between mb-0.5">
                        <div className="flex flex-wrap gap-1 items-baseline min-w-0 pr-6">
                            <a
                                href={`https://x.com/${tweet.handle.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-baseline gap-1 min-w-0"
                            >
                                <span className="font-bold text-[1em] text-white truncate max-w-[120px] group-hover:underline decoration-white">
                                    {tweet.author}
                                </span>
                                <span className="text-[0.9em] text-[#1d9bf0] truncate hover:underline">
                                    {tweet.handle}
                                </span>
                            </a>
                            {tweet.isBest && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[0.7em] font-bold bg-[#FFD700] text-black">
                                    BEST
                                </span>
                            )}
                        </div>

                        {/* メニューボタン */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMenuToggle(isMenuOpen ? null : tweet.id);
                            }}
                            className="text-gray-500 hover:text-[var(--theme-color)] p-1 rounded-full hover:bg-[var(--card-bg-color)] transition-colors absolute right-0 top-[-4px] z-50"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="4" r="2" />
                                <circle cx="12" cy="20" r="2" />
                            </svg>
                        </button>

                        {/* ドロップダウンメニュー */}
                        {isMenuOpen && (
                            <div className="absolute right-0 top-6 w-48 bg-[#000000] border border-[var(--border-color)] rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddNgUser(tweet.handle);
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm text-white hover:bg-[var(--theme-color)] transition-colors font-bold flex items-center gap-2"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                    </svg>
                                    このユーザーをNGにする
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 返信先 */}
                    {tweet.replyTo && (
                        <div className="text-[0.9em] text-gray-500 mb-0.5">
                            返信先:{' '}
                            <a
                                href={`https://x.com/${tweet.replyTo.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#1d9bf0] hover:underline"
                            >
                                {tweet.replyTo}
                            </a>
                        </div>
                    )}

                    {/* テキスト */}
                    <TweetText text={tweet.text} onHashtagClick={onHashtagClick} />

                    {/* メディア */}
                    {activeTab !== 'text' && tweet.mediaUrl && (
                        <div className="mt-3">
                            <img
                                src={tweet.mediaUrl}
                                alt="Attached media"
                                className="rounded-lg border border-gray-700 max-h-60 w-auto object-contain"
                            />
                        </div>
                    )}

                    {/* フッター */}
                    <div className="flex items-center mt-3 text-gray-500 text-[0.85em]">
                        <div className="flex gap-8">
                            {/* リプライ */}
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-[var(--theme-color)] transition-colors">
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                </svg>
                            </div>

                            {/* リツイート */}
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-green-400 transition-colors">
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="17 1 21 5 17 9" />
                                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                    <polyline points="7 23 3 19 7 15" />
                                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                </svg>
                                {tweet.retweetCount && <span className="text-xs ml-1">{tweet.retweetCount}</span>}
                            </div>

                            {/* いいね */}
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-pink-400 transition-colors">
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                                {tweet.likeCount && <span className="text-xs ml-1">{tweet.likeCount}</span>}
                            </div>
                        </div>

                        {/* タイムスタンプ */}
                        <a
                            href={tweet.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-[#1d9bf0] hover:underline cursor-pointer"
                        >
                            {tweet.timestamp === 'Now' ? (
                                'Now'
                            ) : (
                                <RelativeTime initialText={tweet.timestamp} createdAt={tweet.createdAt} />
                            )}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
