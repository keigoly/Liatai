// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',           // メイン画面
        background: 'src/background.ts', // 裏方プログラム
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // 裏方プログラムは固定の名前で出力する
          if (chunkInfo.name === 'background') {
            return 'service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
})