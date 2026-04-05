import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runMigration } from './utils/migration'
import { AuthProvider } from './contexts/AuthContext'

// v1.0.x → v1.1.0 ストレージマイグレーション
runMigration();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
