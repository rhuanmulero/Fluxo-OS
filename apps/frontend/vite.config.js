import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const page = (name) => fileURLToPath(new URL(`./${name}.html`, import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
    /* Sem strictPort o Vite sobe numa porta livre qualquer, e a origem deixa de
       bater com FRONTEND_URL: o login passa a falhar com INVALID_ORIGIN. */
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: page('index'),
        login: page('login'),
        workspace: page('workspace'),
        resetPassword: page('reset-password'),
      },
    },
  },
});
