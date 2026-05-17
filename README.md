# French Gender — Chrome Extension

Hover any French word for 2 seconds to see its gender, articles, and the feminine/masculine form.

## Install (developer mode)

1. Open `chrome://extensions` in Chrome or any Chromium browser (Edge, Brave, Arc).
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the `extension/` folder in this repo.
5. Open any webpage with French text, hover a noun for 2 seconds — a tooltip appears.

To pick up edits during development, press the circular reload arrow on the extension card in `chrome://extensions`, then reload the page you're testing.

## Layout

```
extension/
├── manifest.json      MV3 manifest: permissions, content script, SW
├── background.js      Service worker (install/update lifecycle)
├── content.js         Hover detection, word extraction, tooltip render
├── content.css        Tooltip styling (white card, gender accents)
├── db.js              IndexedDB seed + lookup wrapper
├── dict.json          Bundled French noun dictionary
└── icons/             16 / 48 / 128 px extension icons
```

## How it works

1. On first page load, `db.js` fetches the bundled `dict.json` and writes every entry into IndexedDB (`french-gender-db` → `words` store, keyed by word).
2. After seeding, `fg_seeded_v1` is set in `localStorage` so re-seeding is skipped on subsequent loads.
3. `content.js` listens for `mousemove`, extracts the word under the cursor with `caretRangeFromPoint`, and starts a 2 s timer.
4. When the timer fires, it looks up the word (lowercased, articles stripped) in IndexedDB and renders `#fg-tooltip`.

## Rebuilding the dictionary

`extension/dict.json` is generated from Lexique 3 (lexique.org), a public
French lexical database, merged with our hand-curated entries (CEFR levels +
irregular partner pairs like `garçon ↔ fille`).

```bash
# 1. Download Lexique 3 (~25 MB, not checked in)
mkdir -p .context/data
curl -sSL -o .context/data/Lexique383.tsv \
  http://www.lexique.org/databases/Lexique383/Lexique383.tsv

# 2. Rebuild dict.json
node scripts/build-dict.js

# Optional: tune thresholds
MIN_FREQ=1.0 TOP_N=3000 node scripts/build-dict.js
```

The script keeps only common singular nouns with confirmed gender (ranked by
frequency), then backfills any masc/fem partner referenced by the top-N set.

Current coverage: ~5200 entries (2700 masculine / 2400 feminine).

