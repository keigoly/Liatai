import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runMigration } from './utils/migration'
import { initBridge } from './lib/nextgentv-bridge'

// v1.0.x → v1.1.0 ストレージマイグレーション
runMigration();

// NextGenTV iframe 埋め込み時の postMessage ブリッジ初期化
initBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
