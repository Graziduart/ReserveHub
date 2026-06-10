import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const core = env.VITE_API_CORE || 'http://127.0.0.1:3000'
  const iam = env.VITE_API_IAM || 'http://127.0.0.1:3001'
  const data = env.VITE_API_DATA || 'http://127.0.0.1:3002'
  const audit = env.VITE_API_AUDIT || 'http://127.0.0.1:3003'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
    server: {
      port: 5173,
      host: '127.0.0.1',
      strictPort: true,
      proxy: {
        '/proxy/core': {
          target: core,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/proxy\/core/, ''),
        },
        '/proxy/iam': {
          target: iam,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/proxy\/iam/, ''),
        },
        '/proxy/data': {
          target: data,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/proxy\/data/, ''),
        },
        '/proxy/audit': {
          target: audit,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/proxy\/audit/, ''),
        },
      },
    },
  }
})
