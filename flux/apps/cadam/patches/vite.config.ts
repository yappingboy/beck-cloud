import { sentryVitePlugin } from '@sentry/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
import fs from 'node:fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const appBase = '/cadam';
const normalizedAppBase = appBase.replace(/\/$/, '');

function serveOpenScadWasmInDev(): Plugin {
  return {
    name: 'serve-openscad-wasm-in-dev',
    configureServer(server) {
      const wasmPath = path.resolve(
        __dirname,
        'src/vendor/openscad-wasm/openscad.wasm',
      );

      server.middlewares.use((req, res, next) => {
        if (!req.url) return;

        const url = new URL(req.url, 'http://localhost');

        if (
          url.pathname !==
          `${normalizedAppBase}/src/vendor/openscad-wasm/openscad.wasm`
        ) {
          return next();
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/wasm');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(wasmPath)
          .on('error', (error) => next(error))
          .pipe(res);
      });
    },
  };
}

// Self-host (BeckCloud): the built image runs the full TanStack Start +
// Nitro SSR server (node .output/server/index.mjs) instead of nginx, so
// /api/* routes (aiChat, mesh, ...) execute in-process against Supabase +
// Ollama. The client build's public/ tree (static assets + SPA shell) is
// served verbatim under /cadam/ by a tiny nitro static plugin:
//   /cadam/            → index.html (SPA shell)
//   /cadam/assets/*    → verbatim files (hashed, immutable)
//   /cadam/<anything>  → SPA fallback to index.html
// Everything else (/api/*, /cadam/api/*) is handled by TanStack routes.
function cadamStaticAssets(): any {
  const root = path.resolve(__dirname, '.output/public');
  const safeRoot = `${root.replace(/\\/g, '/')}/`;
  const norm = (p: string) => p.split('?')[0];
  const types: Record<string, string> = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.json': 'application/json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
    '.map': 'application/json',
    '.html': 'text/html; charset=utf-8',
  };
  return {
    name: 'cadam-static-assets',
    // nitroPlugin is the Nitro-idiomatic hook for the SSR build (the
    // `buildServerStart` vite hook does not exist on Plugin types).
    nitroPlugin: (nitro: any) => {
      if (process.env.CADAM_SELF_HOST !== '1') return;
      const send = (event: any, file: string, cache: boolean) => {
        const ext = path.extname(file);
        event.node.res.statusCode = 200;
        event.node.res.setHeader(
          'Content-Type',
          types[ext] ?? 'application/octet-stream',
        );
        if (cache) {
          event.node.res.setHeader(
            'Cache-Control',
            'public, max-age=31536000, immutable',
          );
        }
        event.node.res.end(fs.readFileSync(file));
      };
      nitro.options.plugins.push(
        (nitroApp: any) => {
          nitroApp.hooks.addHook('request', async (event: any) => {
            const host = event.headers.get('host') ?? 'localhost';
            const p = norm(
              new URL(event.path, `http://${host}`).pathname,
            );
            // Let TanStack route handlers run for API calls.
            if (p.startsWith('/api/')) return;
            if (!p.startsWith(`${normalizedAppBase}/`)) return;
            const rel = p.slice(normalizedAppBase.length + 1);
            const file = path.join(root, rel);
            if (
              file.startsWith(safeRoot) &&
              fs.existsSync(file) &&
              fs.statSync(file).isFile()
            ) {
              send(event, file, p.includes('/assets/'));
              return;
            }
            const shell = path.join(root, 'index.html');
            if (fs.existsSync(shell)) {
              send(event, shell, false);
              return;
            }
            event.node.res.statusCode = 404;
            event.node.res.end('not found');
          });
        },
      );
    },
  };
}

export default defineConfig({
  base: appBase,
  plugins: [
    serveOpenScadWasmInDev(),
    cadamStaticAssets(),
    tanstackStart({
      router: {
        basepath: normalizedAppBase,
      },
      spa: {
        enabled: true,
        maskPath: normalizedAppBase,
      },
    }),
    nitro({
      baseURL: normalizedAppBase,
      inlineDynamicImports: true,
    }),
    react(),
    sentryVitePlugin({
      org: 'adamcad',
      project: 'adamcad',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,

    outDir: 'dist/cadam',
    emptyOutDir: true,

    sourcemap: true,
  },
  environments: {
    client: {
      build: {
        outDir: 'dist/cadam',
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (
                id.includes('/node_modules/react/') ||
                id.includes('/node_modules/react-dom/') ||
                id.includes('@tanstack/react-router/') ||
                id.includes('@tanstack/react-start/') ||
                id.includes('lucide-react/')
              ) {
                return 'vendor';
              }
            },
          },
        },
      },
    },
    server: {
      build: {
        outDir: 'dist/server',
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
  server: {
    port: 3000,
    open: false,
  },
  optimizeDeps: {
    exclude: ['@zip.js/zip.js', 'three', 'three-stdlib', '@sentry/vite-plugin'],
  },
});
