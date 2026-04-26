# LaLe — French Word Gender

A Chrome extension that tells you the grammatical gender of French words instantly — no account, no internet required for 1,700+ common words.

**Hover** over any French word on a page, or **type** in the popup search bar.

---

## Features

- **Instant local lookup** — 1,718 words with gender, plural, and English translation; no network needed
- **Hover tooltip** — appears above any French word you hold your cursor over
- **Popup search** with autocomplete, recent history, and favorites
- **Exception words** — 28 words that change meaning with gender (e.g. *le tour* / *la tour*)
- **Wiktionary fallback** — for words not in the local dictionary, fetched and cached automatically
- **Dark mode** — follows system preference or set manually in Settings

---

## Install

### From source (developer mode)

1. Clone or download this repository
2. Go to `chrome://extensions` → enable **Developer mode** (top right)
3. Click **Load unpacked** → select the project folder
4. The `la·le` icon appears in your toolbar

### From Chrome Web Store

*(Coming soon)*

---

## How It Works

```
User hovers / types
       ↓
Content script reads fr.json directly (no background wake-up)
       ↓
Found? → show tooltip / card instantly
       ↓
Not found? → ask background → fetch Wiktionary → cache result
```

The key design decision: the content script loads `fr.json` on its own, bypassing the MV3 service worker for local lookups. This means the tooltip always responds in under 50 ms for the 1,718 bundled words, even if the background is sleeping.

---

## Dictionary Format

`src/data/fr.json`:

```json
{
  "language": "fr",
  "words": {
    "maison": { "g": "f", "plural": "maisons", "en": "house" },
    "livre":  { "g": "m", "plural": "livres",  "en": "book",
                "alt": { "g": "f", "en": "pound (weight/currency)" } }
  }
}
```

`alt` marks exception words with two genders and two meanings.

---

## Project Structure

```
mogadishu/
├── manifest.json
├── icons/
│   └── icon.svg  (source; PNGs auto-generated)
├── src/
│   ├── data/
│   │   └── fr.json          ← 1718-word dictionary
│   ├── lib/
│   │   ├── lookup.js        ← local + Wiktionary lookup engine
│   │   └── storage.js       ← history, favorites, settings
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── options/
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   ├── content/
│   │   ├── content.js       ← hover tooltip logic
│   │   └── content.css
│   └── background/
│       └── background.js    ← Wiktionary proxy + context menu
└── tests/
    └── test.html            ← in-browser test runner
```

---

## Deployment

### Chrome Web Store (free, widest reach)

1. Zip the project: `zip -r lale.zip . --exclude "*.git*" --exclude "tests/*"`
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay the one-time $5 developer registration fee
4. Upload the zip, fill in description + screenshots, set price to **Free**
5. Submit for review (1–3 business days)

Users install for free — you pay nothing ongoing.

### Firefox Add-ons (optional, same code)

MV3 is supported on Firefox 109+. Submit at [addons.mozilla.org](https://addons.mozilla.org). No fee required.

### GitHub Releases (for advanced users)

Tag a release and attach the zip — users can sideload in developer mode.

---

## Development

No build step. Edit files directly and click the reload button in `chrome://extensions`.

Run the test suite by opening `tests/test.html` from the extensions page or via:

```
chrome-extension://<your-extension-id>/tests/test.html
```

---

## License

MIT
