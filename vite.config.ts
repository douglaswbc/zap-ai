import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.OPENAI_KEY': JSON.stringify(env.OPENAI_KEY),
        'process.env.SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
        'process.env.EVO_API_URL': JSON.stringify(env.VITE_EVO_API_URL),
        'process.env.EVO_API_KEY': JSON.stringify(env.VITE_EVO_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
