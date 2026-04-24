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

const ARTICLE_RE = /^(der|die|das|le|la|les|l'|el|los|las|il|lo|gli|le|un|une|ein|eine|einer|einem|einen|einem)\s+/i;

function normalize(word) {
  return (word || "").trim().toLowerCase()
    .replace(/[.,!?;:"'()\[\]{}«»""'']/g, "")
    .replace(/\s+/g, " ");
}

function stripArticle(key) {
  return key.replace(ARTICLE_RE, "").trim();
}

function articleFor(dict, gender) {
  const a = dict.articles || {};
  return a[gender] || "";
}

export async function lookup(word, lang) {
  const dict = await loadDict(lang);
  const raw = normalize(word);
  if (!raw) return { ok: false, reason: "empty" };

  // build candidate keys to try in order
  const candidates = new Set([
    raw,
    stripArticle(raw),
    raw.replace(/-/g, ""),          // hyphenated compounds
  ]);

  let entry = null;
  let matchedKey = raw;

  for (const key of candidates) {
    if (dict.words[key]) { entry = dict.words[key]; matchedKey = key; break; }
  }

  if (!entry) {
    // prefix suggestions (min 2 chars prefix)
    const prefix = raw.slice(0, Math.max(2, raw.length - 1));
    const suggestions = Object.keys(dict.words)
      .filter((k) => k.startsWith(prefix))
      .slice(0, 6);
    return { ok: false, reason: "not_found", suggestions, lang, word: raw };
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
