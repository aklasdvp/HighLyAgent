#!/usr/bin/env node
/**
 * Zero-dependency static server for the built Admin Dashboard (dist/).
 * Binds 127.0.0.1 only — the frontend must never be public.
 * SPA fallback → index.html for all non-file routes.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(join(fileURLToPath(import.meta.url), '..', '..', 'dist'));
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8090);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    let path = normalize(url.pathname).replace(/^([/\\])+/, '');
    if (path === '') path = 'index.html';

    let file = resolve(join(root, path));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }

    let body;
    try {
      body = await readFile(file);
    } catch {
      // SPA fallback
      body = await readFile(join(root, 'index.html'));
      file = join(root, 'index.html');
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'self'; connect-src 'self' https://api.highlyagent.io wss://api.highlyagent.io",
    });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end('internal error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`◆ HighLyAgent admin → http://${HOST}:${PORT}  (local only)`);
});
