/// <reference types="chrome" />
// ↑ この1行を必ず一番上に追加してください

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: any) => console.error(error));