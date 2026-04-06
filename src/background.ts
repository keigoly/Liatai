/// <reference types="chrome" />
// ↑ この1行を必ず一番上に追加してください

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error(error));

// メッセージハンドラ: ポップアップからサイドパネルを開くリクエストを受ける
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 拡張機能自身からのメッセージのみ受け付ける
  if (sender.id !== chrome.runtime.id) return;

  // 認証トークンリフレッシュハンドラ
  if (message.action === 'refreshAuthToken') {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, token });
      }
    });
    return true; // 非同期レスポンス
  }

  if (message.action === 'openSidePanel') {
    // アクティブなタブを取得してサイドパネルを開く
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs.find(t => t.url && !t.url.startsWith('chrome://'));
      if (tab?.id) {
        chrome.sidePanel.open({ tabId: tab.id })
          .then(() => sendResponse({ success: true }))
          .catch((err) => {
            console.error('Failed to open side panel:', err);
            sendResponse({ success: false, error: String(err) });
          });
      } else {
        // タブが見つからない場合、新しいタブを開いてからサイドパネルを開く
        chrome.tabs.create({ url: 'https://www.google.com' }, (newTab) => {
          if (newTab?.id) {
            setTimeout(() => {
              chrome.sidePanel.open({ tabId: newTab.id! })
                .then(() => sendResponse({ success: true }))
                .catch((err) => sendResponse({ success: false, error: String(err) }));
            }, 500);
          } else {
            sendResponse({ success: false, error: 'No tab available' });
          }
        });
      }
    });
    return true; // 非同期レスポンスを示す
  }
});