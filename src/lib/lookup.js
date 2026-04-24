// Shared lookup logic. Loads bundled dictionaries via fetch (extension URL).
// Used from popup and content scripts.

export const LANGUAGES = [
  { code: "de", label: "German", flag: "DE" },
  { code: "fr", label: "French", flag: "FR" },
  { code: "es", label: "Spanish", flag: "ES" },
  { code: "it", label: "Italian", flag: "IT" }
];

export const GENDER_META = {
  m:   { label: "masculine", color: "#3b82f6", glyph: "♂" },
  f:   { label: "feminine",  color: "#ec4899", glyph: "♀" },
  n:   { label: "neuter",    color: "#10b981", glyph: "⚲" },
  pl:  { label: "plural",    color: "#a855f7", glyph: "⚥" }
};

const cache = new Map();

async function loadDict(lang) {
  if (cache.has(lang)) return cache.get(lang);
  const url = chrome.runtime.getURL(`src/data/${lang}.json`);
  const res = await fetch(url);
  const data = await res.json();
  cache.set(lang, data);
  return data;
}

function normalize(word) {
  return (word || "").trim().toLowerCase().replace(/[.,!?;:"'()]/g, "");
}

function articleFor(dict, gender) {
  const a = dict.articles || {};
  return a[gender] || "";
}

export async function lookup(word, lang) {
  const dict = await loadDict(lang);
  const key = normalize(word);
  if (!key) return { ok: false, reason: "empty" };

  // direct hit
  let entry = dict.words[key];
  let matchedKey = key;

  // try stripping common articles ("der haus", "le chien", "la casa")
  if (!entry) {
    const stripped = key.replace(/^(der|die|das|le|la|les|el|los|las|il|lo|gli)\s+/, "");
    if (stripped !== key && dict.words[stripped]) {
      entry = dict.words[stripped];
      matchedKey = stripped;
    }
  }

  // suggestion: prefix match (only if no direct)
  if (!entry) {
    const candidates = Object.keys(dict.words)
      .filter((k) => k.startsWith(key.slice(0, 3)))
      .slice(0, 5);
    return { ok: false, reason: "not_found", suggestions: candidates, lang };
  }

  return {
    ok: true,
    lang,
    word: matchedKey,
    article: articleFor(dict, entry.g),
    gender: entry.g,
    plural: entry.plural,
    en: entry.en,
    example: entry.ex
  };
}

export async function suggest(prefix, lang, limit = 6) {
  const dict = await loadDict(lang);
  const p = normalize(prefix);
  if (p.length < 1) return [];
  return Object.keys(dict.words)
    .filter((k) => k.startsWith(p))
    .slice(0, limit);
}

export async function dictMeta(lang) {
  const dict = await loadDict(lang);
  return { label: dict.label, count: Object.keys(dict.words).length };
}
