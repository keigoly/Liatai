// src/components/search/TweetText.tsx
// ツイート本文のテキスト表示コンポーネント（リンク、ハッシュタグの処理）

interface TweetTextProps {
    text: string;
    onHashtagClick: (tag: string) => void;
}

export const TweetText = ({ text, onHashtagClick }: TweetTextProps) => {
    const parts = text.split(/((?:https?|ftp):\/\/[^\s\u3000]+|(?:pic\.(?:x|twitter)\.com\/[^\s\u3000]+)|[#＃][^\s\u3000]+)/gi);

    return (
        <p className="text-[1em] text-white leading-snug whitespace-pre-wrap break-words cursor-text">
            {parts.map((part, i) => {
                if (part.match(/^(https?|ftp):\/\//i)) {
                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1d9bf0] hover:underline z-10 relative"
                        >
                            {part}
                        </a>
                    );
                } else if (part.match(/^pic\.(?:x|twitter)\.com\//i)) {
                    return (
                        <a
                            key={i}
                            href={`https://${part}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1d9bf0] hover:underline z-10 relative"
                        >
                            {part}
                        </a>
                    );
                } else if (part.match(/^[#＃]/)) {
                    return (
                        <span
                            key={i}
                            onClick={(e) => {
                                e.stopPropagation();
                                onHashtagClick(part);
                            }}
                            className="text-[#1d9bf0] hover:underline cursor-pointer z-10 relative"
                        >
                            {part}
                        </span>
                    );
                }
                return part;
            })}
        </p>
    );
};
