#!/usr/bin/env node
/**
 * build-en-dict.js
 * Validates extension/en_dict.json against extension/dict.json.
 *   - every key is lowercase
 *   - every value is a non-empty array of strings
 *   - every French candidate exists as a key in dict.json
 *   - no duplicate candidates within the same entry
 *
 * Rewrites en_dict.json with alphabetically sorted keys on success.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT    = resolve(__dirname, '..');
const FR_PATH = resolve(ROOT, 'extension/dict.json');
const EN_PATH = resolve(ROOT, 'extension/en_dict.json');

const fr = JSON.parse(readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(readFileSync(EN_PATH, 'utf8'));

let errors = 0;
const err = (msg) => { console.error(`  ${msg}`); errors++; };

for (const [key, val] of Object.entries(en)) {
  if (key !== key.toLowerCase()) err(`[not-lowercase] "${key}"`);
  if (!Array.isArray(val) || val.length === 0) {
    err(`[bad-shape] "${key}" must be a non-empty array`);
    continue;
  }
  const seen = new Set();
  for (const cand of val) {
    if (typeof cand !== 'string' || !cand) {
      err(`[bad-candidate] "${key}" → ${JSON.stringify(cand)}`);
      continue;
    }
    if (seen.has(cand)) err(`[duplicate] "${key}" → "${cand}"`);
    seen.add(cand);
    if (!fr[cand]) err(`[missing-fr] "${key}" → "${cand}" (not in dict.json)`);
  }
}

console.log(`[en-build] ${Object.keys(en).length} English entries, ${errors} errors`);
if (errors > 0) {
  console.error(`[en-build] not writing — fix errors above`);
  process.exit(1);
}

// Sort keys alphabetically for stable diffs
const sorted = {};
for (const k of Object.keys(en).sort()) sorted[k] = en[k];
writeFileSync(EN_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');

// Stats
const multi = Object.values(sorted).filter((v) => v.length > 1).length;
const genders = { m: 0, f: 0 };
for (const v of Object.values(sorted)) {
  const g = fr[v[0]]?.gender;
  if (g === 'm' || g === 'f') genders[g]++;
}
console.log(`[en-build] wrote ${Object.keys(sorted).length} entries`);
console.log(`[en-build] stats: multi-candidate=${multi} primary-m=${genders.m} primary-f=${genders.f}`);
