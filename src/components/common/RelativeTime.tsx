// src/components/common/RelativeTime.tsx
// 相対時間表示コンポーネント（既存ファイルを移動）

import { useState, useEffect } from 'react';

interface Props {
    initialText: string;
    createdAt: number;
}

export const RelativeTime = ({ initialText, createdAt }: Props) => {
    const [displayTime, setDisplayTime] = useState(initialText);

    useEffect(() => {
        // 1秒ごとに時間を再計算して表示を更新する関数
        const updateTime = () => {
            // そもそも「秒」「分」が含まれていない（絶対時刻など）場合は更新しない
            if (!initialText.match(/秒|分/)) return;

            const now = Date.now();
            const diffMs = now - createdAt; // 経過時間(ミリ秒)
            const diffSec = Math.floor(diffMs / 1000);

            // 時間のフォーマット処理
            if (diffSec < 60) {
                // 60秒未満なら「〇秒」
                setDisplayTime(`${Math.max(1, diffSec)}秒`);
            } else if (diffSec < 3600) {
                // 1時間未満なら「〇分」
                setDisplayTime(`${Math.floor(diffSec / 60)}分`);
            } else {
                // それ以上は元の表示（または絶対時刻）のままにする
                setDisplayTime(initialText);
            }
        };

        // 初回実行
        updateTime();

        // 5秒ごとに更新（秒単位の変化を見せるため）
        const intervalId = setInterval(updateTime, 5000);

        return () => clearInterval(intervalId);
    }, [initialText, createdAt]);

    return <span>{displayTime}</span>;
};
