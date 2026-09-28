import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const groqKey = env.VITE_GROQ_API_KEY || env.GROQ_API_KEY || ''
  const geminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''

  return {
    plugins: [react()],
    base: '/Portfolio-Tracker/',
    envPrefix: ['VITE_', 'GROQ_', 'GEMINI_'],
    define: {
      'import.meta.env.VITE_GROQ_API_KEY': JSON.stringify(groqKey),
      'import.meta.env.GROQ_API_KEY': JSON.stringify(groqKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        }
      }
    }
  }
})

