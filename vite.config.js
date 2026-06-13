import { resolve } from 'path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { createRelay } from './src/server/relay.js';

/**
 * controller-relay プラグイン
 * 共有モジュール src/server/relay.js を Vite dev サーバのミドルウェアとして使う。
 * （本番配信は server.js が同じ relay を使う）
 */
function controllerRelay() {
  return {
    name: 'controller-relay',
    configureServer(server) {
      const relay = createRelay();
      server.middlewares.use((req, res, next) => relay.handle(req, res, next));
    },
  };
}

export default defineConfig({
  base: './',
  server: { host: true },
  plugins: [basicSsl(), controllerRelay()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        controller: resolve(__dirname, 'controller.html'),
      },
    },
  },
});
