// NextGenTV から受信するメッセージの型
type NextGenTVMessage =
  | { type: 'NEXTGENTV_PING' }
  | { type: 'NEXTGENTV_INIT'; mode: 'live' | 'video'; keyword: string; programStartTime?: string; programEndTime?: string; recordingStartMargin?: number }
  | { type: 'NEXTGENTV_TIME_UPDATE'; currentTime: number; paused?: boolean };

// NEXTGENTV_INIT 受信時のコールバック型
type OnInitCallback = (keyword: string, mode: 'live' | 'video') => void;
let _onInitCallback: OnInitCallback | null = null;
// INIT がコールバック登録前に到着した場合のバッファ
let _pendingInit: { keyword: string; mode: 'live' | 'video' } | null = null;

// TIME_UPDATE 受信時のコールバック（SYNC モード用）
type OnTimeUpdateCallback = (currentTime: number) => void;
let _onTimeUpdateCallback: OnTimeUpdateCallback | null = null;

// コールバック登録（App.tsx から呼ぶ）
// 既に INIT を受信済みの場合は即座にコールバックを呼ぶ
export function setBridgeOnInit(cb: OnInitCallback) {
  _onInitCallback = cb;
  if (_pendingInit) {
    cb(_pendingInit.keyword, _pendingInit.mode);
    _pendingInit = null;
  }
}

// TIME_UPDATE コールバック登録（SYNC モード用）
export function setBridgeOnTimeUpdate(cb: OnTimeUpdateCallback) {
  _onTimeUpdateCallback = cb;
}

// 現在の再生位置に対応する放送時刻のタイムスタンプ（ミリ秒）を返す
// 録画再生時に使用: 放送開始時刻 + (再生位置 - 録画開始マージン)
export function getBroadcastTimestamp(): number {
  if (!bridgeState.programStartTime) return 0;
  const startMs = new Date(bridgeState.programStartTime).getTime();
  if (isNaN(startMs)) return 0;
  const offsetMs = (bridgeState.currentTime - bridgeState.recordingStartMargin) * 1000;
  return startMs + offsetMs;
}

// 放送終了時刻のタイムスタンプ（ミリ秒）を返す
// useTweetReplay でプリロード範囲の上限として使用
export function getBroadcastEndTimestamp(): number {
  if (!bridgeState.programEndTime) return 0;
  const endMs = new Date(bridgeState.programEndTime).getTime();
  return isNaN(endMs) ? 0 : endMs;
}

// 放送タイトルから検索に不要な部分を除去し、シリーズ名（作品名）を抽出する
// 「[終]メダリスト #22【ヌマニメーション】[字]」→「メダリスト」
// 「姫様"拷問"の時間です(第2期) #23」→「姫様"拷問"の時間です(第2期)」
export function cleanBroadcastKeyword(raw: string): string {
  let name = raw;
  // 放送記号を除去（[字] [新] [終] [再] [解] [デ] 等）
  name = name.replace(/\[[^\]]*\]/g, '').trim();
  // 【番組枠名】を除去（例: 【ヌマニメーション】【アニメリコ】）
  name = name.replace(/【[^】]*】/g, '').trim();
  // #N 以降のエピソード番号を除去
  name = name.replace(/\s*#\d+.*$/, '').trim();
  // 第N話 以降を除去
  name = name.replace(/\s*第\d+話.*$/, '').trim();
  return name || raw;
}

// NextGenTV から受信したデータを保持する
export const bridgeState = {
  isEmbedded: window.parent !== window,
  mode: null as 'live' | 'video' | null,
  keyword: '',
  currentTime: 0,
  paused: false,
  programStartTime: '',
  programEndTime: '',
  recordingStartMargin: 0,
  // デバッグ用: 受信メッセージログ
  _debugLog: [] as { type: string; ts: number }[],
};

// postMessage リスナーを設定し、準備完了を親に通知する
// 多重登録を防止するフラグ（React Strict Mode の二重マウントでも安全）
let _bridgeInitialized = false;
export function initBridge() {
  if (!bridgeState.isEmbedded || _bridgeInitialized) return;
  _bridgeInitialized = true;

  window.addEventListener('message', (event: MessageEvent<NextGenTVMessage>) => {
    const data = event.data;
    if (!data?.type?.startsWith('NEXTGENTV_')) return;

    console.log('[リアタイ Bridge] 受信:', data);
    bridgeState._debugLog.push({ type: data.type, ts: Date.now() });

    // デバッグ: bridgeState の中身を親に返す
    if ((data as Record<string, unknown>).type === 'NEXTGENTV_DEBUG_REQUEST') {
      window.parent.postMessage({ type: 'RIATAI_DEBUG_RESPONSE', bridgeState: { ...bridgeState, _debugLog: bridgeState._debugLog.slice(-20) } }, '*');
      return;
    }

    // PING を受け取ったら READY を再送する（タイミング問題の回避）
    if (data.type === 'NEXTGENTV_PING') {
      window.parent.postMessage({ type: 'RIATAI_READY' }, '*');
      console.log('[リアタイ Bridge] RIATAI_READY 再送');
      return;
    }

    if (data.type === 'NEXTGENTV_INIT') {
      bridgeState.mode = data.mode;
      bridgeState.keyword = data.keyword;
      bridgeState.programStartTime = data.programStartTime ?? '';
      bridgeState.programEndTime = data.programEndTime ?? '';
      bridgeState.recordingStartMargin = data.recordingStartMargin ?? 0;
      // コールバックで検索を自動実行
      const cleaned = cleanBroadcastKeyword(data.keyword);
      if (cleaned) {
        if (_onInitCallback) {
          _onInitCallback(cleaned, data.mode);
        } else {
          // React のマウント前に INIT が到着した場合はバッファに保存
          _pendingInit = { keyword: cleaned, mode: data.mode };
        }
      }
    } else if (data.type === 'NEXTGENTV_TIME_UPDATE') {
      bridgeState.currentTime = data.currentTime;
      bridgeState.paused = data.paused ?? false;
      if (_onTimeUpdateCallback) {
        _onTimeUpdateCallback(data.currentTime);
      }
    }
  });

  // デバッグ用: bridgeState をグローバルに公開（開発時のみ）
  (window as unknown as Record<string, unknown>).__bridgeState = bridgeState;

  window.parent.postMessage({ type: 'RIATAI_READY' }, '*');
  console.log('[リアタイ Bridge] RIATAI_READY 送信完了');
}
