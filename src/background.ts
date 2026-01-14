/// <reference types="chrome" />
// ↑ この1行を必ず一番上に追加してください

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error(error));

// メッセージハンドラ: ポップアップからサイドパネルを開くリクエストを受ける
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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