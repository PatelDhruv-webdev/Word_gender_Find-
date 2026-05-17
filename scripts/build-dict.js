#!/usr/bin/env node
/**
 * build-dict.js
 * Builds extension/dict.json from Lexique 3 (lexique.org), merged with the
 * existing curated entries so hand-curated CEFR levels + irregular partner
 * mappings (garçon ↔ fille, frère ↔ sœur, etc.) are preserved.
 *
 * Usage:
 *   node scripts/build-dict.js            # default thresholds
 *   MIN_FREQ=0.5 TOP_N=8000 node scripts/build-dict.js
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const LEXIQUE   = resolve(ROOT, '.context/data/Lexique383.tsv');
const DICT_OUT  = resolve(ROOT, 'extension/dict.json');

// Tunables
const MIN_FREQ = Number(process.env.MIN_FREQ ?? 0.5);   // per-million, books+films combined
const TOP_N    = Number(process.env.TOP_N    ?? 5000);  // hard cap

// ─── Load existing curated dict (for CEFR + irregular partners) ──────────────
const curated = existsSync(DICT_OUT) ? JSON.parse(readFileSync(DICT_OUT, 'utf8')) : {};
console.log(`[build] loaded ${Object.keys(curated).length} curated entries`);

// ─── Parse Lexique TSV ───────────────────────────────────────────────────────
if (!existsSync(LEXIQUE)) {
  console.error(`[build] missing ${LEXIQUE}`);
  console.error('[build] run: curl -sSL -o .context/data/Lexique383.tsv http://www.lexique.org/databases/Lexique383/Lexique383.tsv');
  process.exit(1);
}

const raw  = readFileSync(LEXIQUE, 'utf8');
const rows = raw.split('\n');
const header = rows[0].split('\t');
const idx = (name) => header.indexOf(name);
const I = {
  ortho: idx('ortho'),
  lemme: idx('lemme'),
  cgram: idx('cgram'),
  genre: idx('genre'),
  nombre: idx('nombre'),
  freqfilms: idx('freqfilms2'),
  freqlivres: idx('freqlivres'),
};

// Group nouns by lemma to discover masc/fem pairs
const byLemma = new Map();

let scanned = 0, kept = 0;
for (let i = 1; i < rows.length; i++) {
  const line = rows[i];
  if (!line) continue;
  const cols = line.split('\t');
  if (cols[I.cgram] !== 'NOM') continue;
  if (cols[I.nombre] === 'p') continue;          // skip plural forms
  const g = cols[I.genre];
  if (g !== 'm' && g !== 'f') continue;

  scanned++;
  const ortho  = cols[I.ortho].toLowerCase().trim();
  if (!ortho || /[^a-zà-ÿ'’-]/i.test(ortho)) continue;    // skip proper nouns / weird chars
  if (ortho.length > 30) continue;
  const lemme  = cols[I.lemme].toLowerCase().trim() || ortho;
  const fFilm  = parseFloat(cols[I.freqfilms])  || 0;
  const fBook  = parseFloat(cols[I.freqlivres]) || 0;
  const freq   = Math.max(fFilm, fBook);
  if (freq < MIN_FREQ) continue;
  kept++;

  if (!byLemma.has(lemme)) byLemma.set(lemme, []);
  byLemma.get(lemme).push({ ortho, gender: g, freq });
}
console.log(`[build] scanned ${scanned} noun rows, ${kept} passed freq≥${MIN_FREQ} (${byLemma.size} unique lemmas)`);

// ─── Collapse to one entry per surface form, find partners within the lemma ──
const allEntries = new Map(); // ortho → { gender, article, feminine?, masculine?, freq }

for (const [, variants] of byLemma) {
  const masc = variants.filter((v) => v.gender === 'm').sort((a, b) => b.freq - a.freq)[0];
  const fem  = variants.filter((v) => v.gender === 'f').sort((a, b) => b.freq - a.freq)[0];

  if (masc) {
    allEntries.set(masc.ortho, {
      gender: 'm',
      article: 'un',
      ...(fem && fem.ortho !== masc.ortho ? { feminine: fem.ortho } : {}),
      freq: masc.freq,
    });
  }
  if (fem) {
    allEntries.set(fem.ortho, {
      gender: 'f',
      article: 'une',
      ...(masc && masc.ortho !== fem.ortho ? { masculine: masc.ortho } : {}),
      freq: fem.freq,
    });
  }
}

// ─── Rank by frequency, take top N, then backfill referenced partners ────────
const ranked = new Map(
  [...allEntries.entries()]
    .sort((a, b) => b[1].freq - a[1].freq)
    .slice(0, TOP_N)
);

// Pull in any partner referenced by a top-N entry but missing from it.
let backfilled = 0;
for (const [, data] of ranked) {
  const p = data.feminine || data.masculine;
  if (p && !ranked.has(p) && allEntries.has(p)) {
    ranked.set(p, allEntries.get(p));
    backfilled++;
  }
}
console.log(`[build] ranked → top ${TOP_N} + ${backfilled} backfilled partners = ${ranked.size}`);

// ─── Merge with curated entries (curated wins on level + partner fields) ─────
const merged = {};

// First, seed from ranked Lexique output
for (const [word, data] of ranked.entries()) {
  const { freq, ...keep } = data;
  merged[word] = keep;
}

// Then, overlay curated entries (adds CEFR levels, irregular partners, anything
// Lexique might miss like compound words). Curated partner refs are kept even
// if the partner isn't in our top-N, because we also add those partners back.
const partnersToEnsure = new Set();
for (const [word, data] of Object.entries(curated)) {
  merged[word] = { ...merged[word], ...data };
  const partner = data.feminine || data.masculine;
  if (partner && !merged[partner]) partnersToEnsure.add(partner);
}

// Ensure partner entries referenced by curated exist (from curated itself, typically)
for (const p of partnersToEnsure) {
  if (curated[p]) merged[p] = { ...merged[p], ...curated[p] };
}

// ─── Sort keys alphabetically for stable diffs ───────────────────────────────
const out = {};
for (const k of Object.keys(merged).sort((a, b) => a.localeCompare(b, 'fr'))) {
  // Normalize apostrophe variants (’ → ')
  const key = k.replace(/’/g, "'");
  out[key] = merged[k];
}

// ─── Sanity checks ───────────────────────────────────────────────────────────
let errors = 0;
for (const [w, d] of Object.entries(out)) {
  if (!['m', 'f'].includes(d.gender)) { console.error(`[invalid gender] ${w}`); errors++; }
  if (d.gender === 'm' && d.article !== 'un')  { console.error(`[m≠un]  ${w}`); errors++; }
  if (d.gender === 'f' && d.article !== 'une') { console.error(`[f≠une] ${w}`); errors++; }
  const partner = d.feminine || d.masculine;
  if (partner && partner !== w && !out[partner]) {
    console.error(`[missing partner] ${w} → ${partner}`);
    errors++;
  }
}
if (errors > 0) {
  console.error(`[build] ${errors} validation errors — not writing`);
  process.exit(1);
}

writeFileSync(DICT_OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`[build] wrote ${Object.keys(out).length} entries to ${DICT_OUT}`);

// Quick stats
const m = Object.values(out).filter((e) => e.gender === 'm').length;
const f = Object.values(out).filter((e) => e.gender === 'f').length;
const withPartner = Object.values(out).filter((e) => e.feminine || e.masculine).length;
const withLevel   = Object.values(out).filter((e) => e.level).length;
console.log(`[build] stats: masculine=${m} feminine=${f} with-partner=${withPartner} with-CEFR=${withLevel}`);
