import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXT_DIR } from './setup.js';

export function loadExtSource(relPath) {
  const src = readFileSync(join(EXT_DIR, relPath), 'utf8');
  // Execute in global scope so `window.*` assignments land on jsdom's window.
  // eslint-disable-next-line no-new-func
  new Function(src).call(globalThis);
}

export async function waitForInit() {
  // Let pending microtasks (DB open, seed, storage read) settle.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

export function readDict() {
  const src = readFileSync(join(EXT_DIR, 'dict.json'), 'utf8');
  return JSON.parse(src);
}
