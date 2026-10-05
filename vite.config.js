import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:quest` sirve por HTTPS en la red local (WebXR exige contexto seguro en el visor).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'quest' ? [basicSsl()] : [],
  server: { host: mode === 'quest' },
  build: { chunkSizeWarningLimit: 1200 },
}));
