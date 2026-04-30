// Tiny wrapper around chrome.storage.local for settings, history, favorites.

const KEYS = {
  settings:      "settings",
  history:       "history",
  favorites:     "favorites",
  pendingLookup: "pendingLookup"
};

const DEFAULTS = {
  settings: {
    defaultLang:         "fr",
    contextMenuEnabled:  true,
    hoverEnabled:        true,
    theme:               "auto"   // "auto" | "light" | "dark"
  },
  history:       [],
  favorites:     [],
  pendingLookup: null
};

async function get(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (res) => resolve(res[key] ?? DEFAULTS[key]));
  });
}

async function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// ── Settings ───────────────────────────────────────────
export async function getSettings() {
  const s = await get(KEYS.settings);
  return { ...DEFAULTS.settings, ...s };
}

export async function setSettings(patch) {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await set(KEYS.settings, next);
  return next;
}

// ── History ────────────────────────────────────────────
export async function pushHistory(entry) {
  const list = await get(KEYS.history);
  // dedupe by lang+word (undefined lang treated as "fr"), newest first, cap at 50
  const filtered = list.filter(
    (e) => !(
      (e.lang || "fr") === (entry.lang || "fr") &&
      e.word === entry.word
    )
  );
  filtered.unshift({ ...entry, at: Date.now() });
  await set(KEYS.history, filtered.slice(0, 50));
}

export async function getHistory() {
  return get(KEYS.history);
}

export async function clearHistory() {
  await set(KEYS.history, []);
}

// ── Favorites ──────────────────────────────────────────
export async function toggleFavorite(entry) {
  const list = await get(KEYS.favorites);
  const idx = list.findIndex(
    (e) => (e.lang || "fr") === (entry.lang || "fr") && e.word === entry.word
  );
  if (idx >= 0) list.splice(idx, 1);
  else list.unshift({ ...entry, at: Date.now() });
  await set(KEYS.favorites, list);
  return idx < 0; // true = now favorited
}

export async function getFavorites() {
  return get(KEYS.favorites);
}

export async function clearFavorites() {
  await set(KEYS.favorites, []);
}

export async function isFavorite(lang, word) {
  const list = await get(KEYS.favorites);
  return list.some((e) => (e.lang || "fr") === lang && e.word === word);
}

// ── Wiktionary cache ────────────────────────────────────
export async function clearWikiCache() {
  const all = await new Promise((resolve) =>
    chrome.storage.local.get(null, resolve)
  );
  const wikiKeys = Object.keys(all).filter((k) => k.startsWith("wiki_"));
  if (wikiKeys.length) {
    await new Promise((resolve) =>
      chrome.storage.local.remove(wikiKeys, resolve)
    );
  }
}

// ── Pending lookup (context menu → popup) ──────────────
export async function setPendingLookup(word) {
  const next = word ? { word: word.trim(), at: Date.now() } : null;
  await set(KEYS.pendingLookup, next);
  return next;
}

export async function getPendingLookup() {
  return get(KEYS.pendingLookup);
}

export async function clearPendingLookup() {
  await set(KEYS.pendingLookup, null);
}

export async function consumePendingLookup() {
  const pending = await getPendingLookup();
  await clearPendingLookup();
  return pending;
}
