// Gendly content script — shows inline gender tooltip on double-click selection.
// Uses message passing to background for dictionary lookups.

const GENDER_COLOR = { m: "#3b82f6", f: "#ec4899", n: "#10b981", pl: "#a855f7" };
const DISMISS_DELAY = 4000;

let root = null;
let activeTooltip = null;
let dismissTimer = null;
let enabled = true;

(async () => {
  try {
    const s = await chrome.storage.local.get("settings");
    enabled = s.settings?.contextMenuEnabled !== false;
  } catch (_) { /* keep enabled = true if storage unavailable */ }
})();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) {
    enabled = changes.settings.newValue?.contextMenuEnabled !== false;
  }
});

function getRoot() {
  if (!root) {
    root = document.createElement("div");
    root.id = "gendly-root";
    document.documentElement.appendChild(root);
  }
  return root;
}

function getLang() {
  try {
    const stored = JSON.parse(
      localStorage.getItem("gendly-settings") || "{}"
    );
    return stored.defaultLang || "de";
  } catch (_) { return "de"; }
}

document.addEventListener("dblclick", async (e) => {
  if (!enabled) return;

  const sel = window.getSelection();
  const word = sel?.toString().trim().split(/\s+/)[0] || "";
  if (!word || word.length > 40) return;

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  let lang = "de";
  try {
    const s = await chrome.storage.local.get("settings");
    lang = s.settings?.defaultLang || "de";
  } catch (_) {}

  const res = await chrome.runtime.sendMessage({ type: "lookup", word, lang });
  showTooltip(res, rect);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") dismissTooltip(true);
});

document.addEventListener("click", (e) => {
  if (activeTooltip && !activeTooltip.contains(e.target)) {
    dismissTooltip(false);
  }
});

function showTooltip(res, targetRect) {
  clearTimeout(dismissTimer);
  if (activeTooltip) activeTooltip.remove();

  const tip = document.createElement("div");
  tip.className = "gendly-tooltip";
  tip.setAttribute("role", "tooltip");
  tip.setAttribute("aria-live", "polite");

  if (res?.ok) {
    const color = GENDER_COLOR[res.gender] || "#7c3aed";

    const dot = document.createElement("span");
    dot.className = "gendly-dot";
    dot.style.background = color;

    const art = document.createElement("span");
    art.className = "gendly-article";
    art.style.color = color;
    art.textContent = res.article;

    const word = document.createElement("span");
    word.className = "gendly-word";
    word.textContent = res.word;

    tip.appendChild(dot);
    tip.appendChild(art);
    tip.appendChild(word);

    if (res.en) {
      const sep = document.createElement("span");
      sep.className = "gendly-sep";
      const en = document.createElement("span");
      en.className = "gendly-en";
      en.textContent = res.en;
      tip.appendChild(sep);
      tip.appendChild(en);
    }

    const badge = document.createElement("span");
    badge.className = "gendly-badge";
    badge.textContent = (res.lang || "").toUpperCase();
    tip.appendChild(badge);
  } else {
    const msg = document.createElement("span");
    msg.className = "gendly-not-found";
    msg.textContent = `"${res?.word || "?"}" not found`;
    tip.appendChild(msg);
  }

  positionTooltip(tip, targetRect);
  getRoot().appendChild(tip);
  activeTooltip = tip;

  dismissTimer = setTimeout(() => dismissTooltip(false), DISMISS_DELAY);
}

function positionTooltip(tip, rect) {
  // temporarily visible off-screen to measure size
  tip.style.visibility = "hidden";
  tip.style.left = "0px";
  tip.style.top = "0px";
  getRoot().appendChild(tip);

  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  const margin = 8;

  let x = rect.left + rect.width / 2 - tw / 2;
  let y = rect.top - th - margin + window.scrollY;

  // flip below if clipped at top
  if (rect.top - th - margin < 0) y = rect.bottom + margin + window.scrollY;

  // clamp x to viewport
  x = Math.max(margin, Math.min(x, window.innerWidth - tw - margin));

  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
  tip.style.visibility = "";
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
  setTimeout(() => { old.remove(); }, 130);
  activeTooltip = null;
}
