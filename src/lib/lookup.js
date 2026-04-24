// Lookup engine — French only.
// Priority: local dictionary → chrome.storage cache → Wiktionary API → not found.

export const LANG = "fr";

export const GENDER_META = {
  m:  { label: "masculine", color: "#3b82f6", glyph: "♂" },
  f:  { label: "feminine",  color: "#ec4899", glyph: "♀" },
  pl: { label: "plural",    color: "#a855f7", glyph: "⚥" }
};

export const ARTICLE = { m: "le", f: "la", pl: "les" };

// article prefixed to elided nouns
function article(gender, word) {
  if (gender === "pl") return "les";
  const vowel = /^[aeiouàâéèêëîïôùûüœæh]/i.test(word);
  if (vowel) return "l'";
  return gender === "m" ? "le" : "la";
}

// ── local dictionary cache ────────────────────────────
let localDict = null;

async function getLocal() {
  if (localDict) return localDict;
  const url = chrome.runtime.getURL("src/data/fr.json");
  const res = await fetch(url);
  localDict = await res.json();
  return localDict;
}

const ARTICLE_RE = /^(le|la|les|l'|un|une|des)\s+/i;

function normalize(w) {
  return (w || "").trim().toLowerCase()
    .replace(/[.,!?;:"'()\[\]«»""'']/g, "")
    .replace(ARTICLE_RE, "")
    .trim();
}

// ── Wiktionary API fallback ───────────────────────────
// Cache key: "wiki_fr_<word>" in chrome.storage.local

async function getCached(word) {
  return new Promise((res) =>
    chrome.storage.local.get(`wiki_fr_${word}`, (r) =>
      res(r[`wiki_fr_${word}`] ?? null)
    )
  );
}

async function setCached(word, entry) {
  chrome.storage.local.set({ [`wiki_fr_${word}`]: entry });
}

const WIKI_API = "https://en.wiktionary.org/w/api.php";

async function fetchWiktionary(word) {
  const cached = await getCached(word);
  if (cached) return cached;
  if (cached === false) return null; // previously confirmed missing

  try {
    const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) { await setCached(word, false); return null; }
    const data = await res.json();
    const wikitext = data?.parse?.wikitext?.["*"];
    if (!wikitext) { await setCached(word, false); return null; }

    const entry = parseWikitext(word, wikitext);
    await setCached(word, entry ?? false);
    return entry;
  } catch (_) {
    return null;
  }
}

function parseWikitext(word, wikitext) {
  // find the ==French== section
  const frIdx = wikitext.search(/^==French==/m);
  if (frIdx === -1) return null;

  // end of French section = next ==Heading== (same level)
  const afterFr = wikitext.slice(frIdx + 10);
  const nextSection = afterFr.search(/^==[^=]/m);
  const frSection = nextSection === -1 ? afterFr : afterFr.slice(0, nextSection);

  // detect part of speech — we only handle nouns
  if (!/===Noun===/i.test(frSection) && !/\{\{fr-noun/i.test(frSection)) return null;

  // {{fr-noun|f}} or {{fr-noun|m}} or {{fr-noun|f|...}} etc.
  const nounTpl = frSection.match(/\{\{fr-noun\s*\|([mf])/i);
  if (!nounTpl) return null;
  const gender = nounTpl[1].toLowerCase(); // 'm' or 'f'

  // plural: second pipe arg, or word with 's', or '—' if invariable
  const pluralTpl = frSection.match(/\{\{fr-noun[^}]*\|[mf]\|([^|}]+)/i);
  let plural = word + "s";
  if (pluralTpl) {
    const raw = pluralTpl[1].trim();
    plural = raw === "-" || raw === "~" ? "invariable" : raw;
  }

  // first definition line starting with #
  const defMatch = frSection.match(/^#\s*(.+)/m);
  let en = "";
  if (defMatch) {
    en = defMatch[1]
      .replace(/\{\{[^}]+\}\}/g, "")        // remove templates
      .replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, "$1") // [[link|text]] → link
      .replace(/\[\[([^\]]+)\]\]/g, "$1")   // [[link]] → link
      .replace(/<[^>]+>/g, "")              // strip HTML
      .trim();
  }

  return { gender, plural, en, src: "wiki" };
}

// ── public API ────────────────────────────────────────

export async function lookup(word) {
  const key = normalize(word);
  if (!key || key.length < 2) return { ok: false, reason: "empty" };

  const dict = await getLocal();

  // 1. direct local hit
  let entry = dict.words[key];

  // 2. try without accent variants for common typos (e → é etc.) — skip, too risky

  if (entry) {
    return {
      ok: true, src: "local",
      word: key,
      article: article(entry.g, key),
      gender: entry.g,
      plural: entry.plural,
      en: entry.en,
      example: entry.ex
    };
  }

  // 3. local prefix suggestions for autocomplete hint
  const suggestions = Object.keys(dict.words)
    .filter((k) => k.startsWith(key.slice(0, Math.max(2, key.length - 1))))
    .slice(0, 6);

  // 4. Wiktionary fallback
  const wiki = await fetchWiktionary(key);
  if (wiki) {
    return {
      ok: true, src: "wiki",
      word: key,
      article: article(wiki.gender, key),
      gender: wiki.gender,
      plural: wiki.plural,
      en: wiki.en,
      example: ""
    };
  }

  return { ok: false, reason: "not_found", suggestions, word: key };
}

export async function suggest(prefix, limit = 8) {
  const dict = await getLocal();
  const p = normalize(prefix);
  if (p.length < 1) return [];
  return Object.keys(dict.words)
    .filter((k) => k.startsWith(p))
    .slice(0, limit);
}
