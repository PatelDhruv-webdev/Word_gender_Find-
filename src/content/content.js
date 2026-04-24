// Gendly content script — shows gender tooltip on word hover.

const GENDER_COLOR = { m: "#3b82f6", f: "#ec4899", n: "#10b981", pl: "#a855f7" };
const HOVER_DELAY = 420;
const DISMISS_DELAY = 3200;

let root = null;
let activeTooltip = null;
let dismissTimer = null;
let hoverTimer = null;
let lastWord = null;
let enabled = true;

(async () => {
  try {
    const s = await chrome.storage.local.get("settings");
    enabled = s.settings?.contextMenuEnabled !== false;
  } catch (_) {}
})();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.settings) return;
  enabled = changes.settings.newValue?.contextMenuEnabled !== false;
});

// ── Word detection via caretRangeFromPoint ─────────────
function getWordAtPoint(x, y) {
  let range;
  try {
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (!pos) return null;
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  } catch (_) { return null; }

  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

  // expand to word boundary
  range.expand("word");
  const word = range.toString().trim().replace(/[.,!?;:"'()\[\]{}<>«»""'']/g, "");
  if (!word || word.length < 2 || word.length > 40) return null;
  if (/^\d+$/.test(word)) return null; // skip pure numbers
  return word;
}

// ── Hover listeners ─────────────────────────────────────
document.addEventListener("mousemove", (e) => {
  if (!enabled) return;

  const word = getWordAtPoint(e.clientX, e.clientY);

  if (!word || word === lastWord) return;
  lastWord = word;

  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(async () => {
    const res = await chrome.runtime.sendMessage({ type: "lookup", word });
    if (!res?.ok) return;
    showTooltip(res, e.clientX, e.clientY);
  }, HOVER_DELAY);
});

document.addEventListener("mouseleave", () => {
  clearTimeout(hoverTimer);
  lastWord = null;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") dismissTooltip(true);
});

// ── Tooltip rendering ───────────────────────────────────
function getRoot() {
  if (!root) {
    root = document.createElement("div");
    root.id = "gendly-root";
    document.documentElement.appendChild(root);
  }
  return root;
}

function showTooltip(res, cursorX, cursorY) {
  clearTimeout(dismissTimer);
  if (activeTooltip) activeTooltip.remove();

  const color = GENDER_COLOR[res.gender] || "#7c3aed";

  const tip = document.createElement("div");
  tip.className = "gendly-tooltip";
  tip.setAttribute("role", "tooltip");

  const genderLabel = res.gender === "m" ? "Masculine" : "Feminine";

  const dot = el("span", "gendly-dot", { style: `background:${color}` });
  const gLabel = el("span", "gendly-gender", { style: `color:${color}`, text: genderLabel });
  const art = el("span", "gendly-article", { style: `color:${color}`, text: res.article });
  const word = el("span", "gendly-word", { text: res.word });

  tip.append(dot, gLabel, el("span", "gendly-sep"), art, word);

  if (res.en) {
    tip.append(el("span", "gendly-sep"), el("span", "gendly-en", { text: res.en }));
  }

  positionTooltip(tip, cursorX, cursorY);
  getRoot().appendChild(tip);
  activeTooltip = tip;

  dismissTimer = setTimeout(() => dismissTooltip(false), DISMISS_DELAY);
}

function positionTooltip(tip, cx, cy) {
  tip.style.cssText = "visibility:hidden;left:0;top:0";
  getRoot().appendChild(tip);

  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  const margin = 12;

  let x = cx - tw / 2;
  let y = cy - th - margin;

  if (y < 4) y = cy + margin + 18; // flip below cursor

  x = Math.max(margin, Math.min(x, window.innerWidth - tw - margin));

  tip.style.cssText = `left:${x}px;top:${y + window.scrollY}px`;
}

function dismissTooltip(immediate) {
  clearTimeout(dismissTimer);
  if (!activeTooltip) return;
  if (immediate) { activeTooltip.remove(); activeTooltip = null; return; }
  activeTooltip.classList.add("gendly-dismiss");
  const old = activeTooltip;
  setTimeout(() => old.remove(), 130);
  activeTooltip = null;
}

function el(tag, cls, opts = {}) {
  const e = document.createElement(tag);
  e.className = cls;
  if (opts.text) e.textContent = opts.text;
  if (opts.style) e.style.cssText = opts.style;
  return e;
}
