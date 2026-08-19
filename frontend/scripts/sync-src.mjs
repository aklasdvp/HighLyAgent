#!/usr/bin/env node
/**
 * Source bootstrap — fills this standalone frontend repo with the full
 * application source (src/ + index.html) from the monorepo workspace.
 *
 *   • Runs AUTOMATICALLY on `npm install` (postinstall) — nothing to remember.
 *   • Idempotent: overwrites with the latest source every time it finds the monorepo.
 *   • Safe standalone: if this folder is already self-contained (e.g. cloned from
 *     GitHub on another machine), it prints a notice and exits 0 — install continues.
 *   • Verifies the copy: compares file counts and confirms the key entry files.
 */
import { cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const monoRoot = path.resolve(repoRoot, '..');
const fromSrc = path.join(monoRoot, 'src');

const KEY_FILES = ['main.tsx', 'App.tsx', 'index.css', 'lib/store.tsx', 'lib/data.ts', 'lib/api.ts', 'components/ui.tsx'];

const countFiles = (dir) =>
  readdirSync(dir).reduce((n, f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? n + countFiles(p) : n + 1;
  }, 0);

if (!existsSync(path.join(fromSrc, 'main.tsx'))) {
  console.log('─'.repeat(56));
  console.log('◆ HighLyAgent frontend — already standalone.');
  console.log('  No monorepo source found next door, so there is nothing');
  console.log('  to sync. Continue with:  npm run dev   (or npm run build)');
  console.log('─'.repeat(56));
  process.exit(0);
}

/* ── copy ── */
cpSync(fromSrc, path.join(repoRoot, 'src'), { recursive: true });
cpSync(path.join(monoRoot, 'index.html'), path.join(repoRoot, 'index.html'));

/* ── verify ── */
const toSrc = path.join(repoRoot, 'src');
const srcCount = countFiles(fromSrc);
const dstCount = countFiles(toSrc);
const missing = KEY_FILES.filter((f) => !existsSync(path.join(toSrc, f)));

console.log('─'.repeat(56));
console.log('◆ HighLyAgent frontend — source sync complete');
console.log(`  src/         ${dstCount} files copied (source has ${srcCount})`);
console.log('  index.html   copied');
if (missing.length) {
  console.log(`  ⚠ missing key files: ${missing.join(', ')}`);
} else {
  console.log('  ✓ all key entry files verified (main, App, store, api…)');
}
console.log('─'.repeat(56));
if (dstCount !== srcCount || missing.length) {
  console.log('  ⚠ counts differ — re-run: node scripts/sync-src.mjs');
} else {
  console.log('  This folder is now fully self-contained. Next:');
  console.log('    npm run build');
  console.log('    git init && git add -A && git commit -m "HighLyAgent frontend" && git push');
}
console.log('─'.repeat(56));
process.exit(0);
