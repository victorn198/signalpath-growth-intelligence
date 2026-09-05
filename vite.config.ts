import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers', 'echarts/features', 'echarts-for-react/lib/core'],
          table: ['@tanstack/react-table'],
        },
      },
    },
  },
  server: { watch: { ignored: ['**/.venv/**', '**/__pycache__/**', '**/.pytest_cache/**', '**/target/**'] } },
})