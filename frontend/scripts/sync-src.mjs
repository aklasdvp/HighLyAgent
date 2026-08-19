#!/usr/bin/env node
/**
 * One-time source sync — copies the full application source (src/ + index.html)
 * from the monorepo workspace into this standalone frontend repo.
 *
 *   node scripts/sync-src.mjs        (run from the frontend/ folder)
 *
 * After it runs, this folder is 100% self-contained and ready to be pushed
 * as its own repository:
 *
 *   git init && git add -A && git commit -m "HighLyAgent frontend" && git push
 *
 * If this folder is already standalone (no monorepo next door), the script
 * exits gracefully — nothing to do.
 */
import { cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const monoRoot = path.resolve(repoRoot, '..');
const fromSrc = path.join(monoRoot, 'src');

if (!existsSync(path.join(fromSrc, 'main.tsx'))) {
  console.error('✗ Monorepo source not found at:', fromSrc);
  console.error('  This folder already looks standalone — nothing to sync.');
  console.error('  Continue with: npm install && npm run dev');
  process.exit(1);
}

const countFiles = (dir) =>
  readdirSync(dir).reduce((n, f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? n + countFiles(p) : n + 1;
  }, 0);

cpSync(fromSrc, path.join(repoRoot, 'src'), { recursive: true });
cpSync(path.join(monoRoot, 'index.html'), path.join(repoRoot, 'index.html'));

const total = countFiles(path.join(repoRoot, 'src'));
console.log(`✓ src/ synced        — ${total} files`);
console.log('✓ index.html synced');
console.log('');
console.log('This folder is now fully self-contained.');
console.log('Next:  git init && git add -A && git commit -m "HighLyAgent frontend" && git push');
