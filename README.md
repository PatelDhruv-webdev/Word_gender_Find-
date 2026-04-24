# Gendly — Word Gender Finder

A Chrome extension that instantly shows the grammatical gender of words in German, French, Spanish, and Italian.

## Features

- **Search popup** — Click the toolbar icon, type a word, get the article + gender color-coded at a glance
- **Right-click lookup** — Select any word on a webpage → right-click → "Find gender"
- **Inline tooltip** — Double-click any word on a page for a floating gender chip
- **Auto-suggestions** — Typeahead as you type
- **History & Favorites** — Recent lookups saved; star words to keep them
- **Dark mode** — Follows your system preference

## Install (unpacked, developer mode)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `mogadishu/` folder (this directory)
5. The Gendly **G** icon appears in the toolbar

## Project structure

```
manifest.json
icons/              PNG icons (16 / 32 / 48 / 128 px)
scripts/
  make_icons.py     Regenerate PNG icons (stdlib only, no deps)
src/
  popup/            Extension toolbar popup (HTML + CSS + JS)
  background/       Service worker (context menu, message routing)
  content/          Inline tooltip injected into web pages
  options/          Settings page
  lib/
    lookup.js       Dictionary lookup + autocomplete
    storage.js      chrome.storage.local wrappers
  data/
    de.json         German dictionary (~50 words)
    fr.json         French dictionary (~50 words)
    es.json         Spanish dictionary (~50 words)
    it.json         Italian dictionary (~50 words)
```

## Expanding the dictionary

Each `src/data/<lang>.json` file contains a `"words"` object keyed by lowercase word.
Add entries in this shape:

```json
"fenster": { "g": "n", "plural": "Fenster", "en": "window", "ex": "Das Fenster ist offen." }
```

Gender codes: `m` masculine · `f` feminine · `n` neuter · `pl` plural-only

## Regenerating icons

```bash
python3 scripts/make_icons.py
```

No external dependencies required.
