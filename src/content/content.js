// Gendly content script — hover tooltip for French word gender.
// Deliberately has NO imports (content scripts cannot be ES modules).
// Local dict is fetched directly; background is only used for Wiktionary fallback.

const GENDER_COLOR = { m: "#3b82f6", f: "#ec4899" };
const HOVER_DELAY  = 380;   // ms after cursor stops before lookup fires
const DISMISS_DELAY = 3200; // ms before tooltip auto-hides

// ── State ────────────────────────────────────────────────────────────
let tooltipRoot   = null;
let activeTooltip = null;
let dismissTimer  = null;
let hoverTimer    = null;
let lastWord      = null;
let lastMoveAt    = 0;
let hoverEnabled  = true; // default true; async read may refine this
let localWords    = null; // fr.json words object, loaded once

// ── Settings ─────────────────────────────────────────────────────────
chrome.storage.local.get("settings", (s) => {
  hoverEnabled = s?.settings?.hoverEnabled !== false;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) {
    hoverEnabled = changes.settings.newValue?.hoverEnabled !== false;
  }
});

// ── Local dictionary (loaded once, no background needed) ──────────────
function loadDict() {
  if (localWords !== null) return Promise.resolve(localWords);
  return fetch(chrome.runtime.getURL("src/data/fr.json"))
    .then((r) => r.json())
    .then((data) => { localWords = data.words || {}; return localWords; })
    .catch(() => { localWords = {}; return localWords; });
}

// ── Lookup ────────────────────────────────────────────────────────────
const ARTICLE_RE = /^(le|la|les|l'|un|une|des)\s+/i;
const VOWEL_RE   = /^[aeiouàâéèêëîïôùûüœæh]/i;

function normalize(w) {
  return w.trim().toLowerCase()
    .replace(/[.,!?;:"'«»""''()\[\]{}]/g, "")
    .replace(ARTICLE_RE, "")
    .trim();
}

function article(gender, word) {
  return VOWEL_RE.test(word) ? "l'" : (gender === "m" ? "le" : "la");
}

async function lookup(raw) {
  const key = normalize(raw);
  if (!key || key.length < 2) return null;

  // 1. Local dictionary — instant, no network, no background wakeup
  const dict = await loadDict();
  const entry = dict[key];
  if (entry) {
    const g = entry.g === "f" ? "f" : "m";
    return { ok: true, word: key, gender: g, article: article(g, key), en: entry.en || "" };
  }

  // 2. Background service worker for Wiktionary (only for unknown words)
  //    Race against a 4-second timeout so a sleeping worker doesn't hang forever.
  try {
    const res = await Promise.race([
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "lookup", word: key }, (r) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(r);
        });
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000))
    ]);
    if (res?.ok) return res;
  } catch (_) { /* background asleep or word not found — silently skip */ }

  return null;
}

// ── Word extraction (manual char-walk — more reliable than range.expand) ──
function getWordAtPoint(clientX, clientY) {
  let node, offset;

  try {
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(clientX, clientY);
      if (!r) return null;
      node   = r.startContainer;
      offset = r.startOffset;
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(clientX, clientY);
      if (!pos) return null;
      node   = pos.offsetNode;
      offset = pos.offset;
    } else {
      return null;
    }
  } catch (_) { return null; }

  if (!node || node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent || "";
  if (!text.trim()) return null;

  // Walk left to find start of the word token
  let start = offset;
  while (start > 0 && /[^\s.,!?;:"'«»""''()\[\]{}<>]/.test(text[start - 1])) start--;

  // Walk right to find end of the word token
  let end = offset;
  while (end < text.length && /[^\s.,!?;:"'«»""''()\[\]{}<>]/.test(text[end])) end++;

  const word = text.slice(start, end).trim();
  if (!word || word.length < 2 || word.length > 45) return null;
  if (/^\d+$/.test(word)) return null;
  return word;
}

// ── Mouse event listeners ─────────────────────────────────────────────
document.addEventListener("mousemove", (e) => {
  if (!hoverEnabled) return;

  // Throttle to ~16 fps to avoid excessive processing
  const now = Date.now();
  if (now - lastMoveAt < 60) return;
  lastMoveAt = now;

  const word = getWordAtPoint(e.clientX, e.clientY);

  // Same word as last time — don't re-trigger
  if (word === lastWord) return;
  lastWord = word;

  clearTimeout(hoverTimer);
  if (!word) return;

  const capturedX = e.clientX;
  const capturedY = e.clientY;
  hoverTimer = setTimeout(async () => {
    const res = await lookup(word);
    if (res?.ok) showTooltip(res, capturedX, capturedY);
  }, HOVER_DELAY);
}, { passive: true });

document.addEventListener("mouseleave", () => {
  clearTimeout(hoverTimer);
  lastWord = null;
}, { passive: true });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") dismissTooltip(true);
});

// ── Tooltip rendering ─────────────────────────────────────────────────
function getRoot() {
  if (!tooltipRoot) {
    tooltipRoot = document.createElement("div");
    tooltipRoot.id = "gendly-root";
    (document.documentElement || document.body).appendChild(tooltipRoot);
  }
  return tooltipRoot;
}

function showTooltip(res, cursorX, cursorY) {
  clearTimeout(dismissTimer);
  if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }

  const color = GENDER_COLOR[res.gender] || "#7c3aed";
  const label = res.gender === "m" ? "Masculine" : "Feminine";

  const tip = document.createElement("div");
  tip.className = "gendly-tooltip";
  tip.setAttribute("role", "tooltip");
  tip.append(
    mkEl("span", "gendly-dot",     { style: `background:${color}` }),
    mkEl("span", "gendly-gender",  { text: label,       style: `color:${color}` }),
    mkEl("span", "gendly-sep"),
    mkEl("span", "gendly-article", { text: res.article, style: `color:${color}` }),
    mkEl("span", "gendly-word",    { text: res.word })
  );
  if (res.en) {
    tip.append(mkEl("span", "gendly-sep"), mkEl("span", "gendly-en", { text: res.en }));
  }

  if (res.alt) {
    const altArt = VOWEL_RE.test(res.word) ? "l'" : (res.alt.g === "m" ? "le" : "la");
    const altLabel = res.alt.g === "m" ? "masc." : "fém.";
    tip.append(mkEl("span", "gendly-alt", { text: `· also ${altLabel}: ${altArt} (${res.alt.en})` }));
  }

  // Attach hidden first so the browser renders it and we can measure size
  const r = getRoot();
  tip.style.visibility = "hidden";
  r.appendChild(tip);

  // Compute position relative to the fixed root (which sits at viewport 0,0)
  const tw = tip.offsetWidth  || 200;
  const th = tip.offsetHeight || 36;
  const margin = 12;
  let x = cursorX - tw / 2;
  let y = cursorY - th - margin;
  if (y < 4) y = cursorY + margin + 20; // flip below cursor
  x = Math.max(margin, Math.min(x, window.innerWidth - tw - margin));

  tip.style.left       = x + "px";
  tip.style.top        = y + "px";
  tip.style.visibility = "";

  activeTooltip = tip;
  dismissTimer  = setTimeout(() => dismissTooltip(false), DISMISS_DELAY);
}

function dismissTooltip(immediate) {
  clearTimeout(dismissTimer);
  if (!activeTooltip) return;
  if (immediate) {
    activeTooltip.remove();
    activeTooltip = null;
    return;
  }
  activeTooltip.classList.add("gendly-dismiss");
  const old = activeTooltip;
  activeTooltip = null;
  setTimeout(() => old.remove(), 130);
}

function mkEl(tag, cls, opts = {}) {
  const e = document.createElement(tag);
  e.className = cls;
  if (opts.text)  e.textContent    = opts.text;
  if (opts.style) e.style.cssText  = opts.style;
  return e;
}
