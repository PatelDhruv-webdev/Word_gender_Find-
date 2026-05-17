/**
 * content.js — French Gender hover tooltip
 * Flow: mousemove → extract word at cursor → Nms timer → lookup → show tooltip
 * Tooltip lives inside a shadow DOM so host-page styles can't leak in.
 */

const DEFAULT_HOVER_DELAY_MS = 2000;
const STORAGE_KEY_DELAY = 'hoverDelayMs';

let hoverDelayMs = DEFAULT_HOVER_DELAY_MS;
let hoverTimer   = null;
let activeWord   = null;
let hostEl       = null;   // shadow host anchored in page DOM
let shadowRoot   = null;
let cardEl       = null;   // tooltip card inside shadow root

// ─── Init ────────────────────────────────────────────────────────────────────

(async () => {
  await window.FrenchGenderDB.init();
  await loadDelayFromStorage();
  watchDelayChanges();
  document.addEventListener('mousemove', onMouseMove);
  document.documentElement.addEventListener('mouseleave', onMouseOut);
})();

async function loadDelayFromStorage() {
  try {
    const { [STORAGE_KEY_DELAY]: stored } =
      await chrome.storage.sync.get({ [STORAGE_KEY_DELAY]: DEFAULT_HOVER_DELAY_MS });
    if (typeof stored === 'number' && stored >= 200 && stored <= 10000) {
      hoverDelayMs = stored;
    }
  } catch {
    // storage unavailable (rare) — keep default
  }
}

function watchDelayChanges() {
  if (!chrome?.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[STORAGE_KEY_DELAY]) return;
    const next = changes[STORAGE_KEY_DELAY].newValue;
    if (typeof next === 'number' && next >= 200 && next <= 10000) {
      hoverDelayMs = next;
    }
  });
}

// ─── Word extraction ─────────────────────────────────────────────────────────

function getWordAtPoint(x, y) {
  let range;

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;
    range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.setEnd(pos.offsetNode, pos.offset);
  }

  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

  const textNode = range.startContainer;
  const text     = textNode.textContent;
  const offset   = range.startOffset;

  let start = offset;
  while (start > 0 && /[\wÀ-ÿ'-]/i.test(text[start - 1])) start--;

  let end = offset;
  while (end < text.length && /[\wÀ-ÿ'-]/i.test(text[end])) end++;

  const word = text.slice(start, end).trim();
  return word.length > 0 ? word : null;
}

// ─── Event handlers ──────────────────────────────────────────────────────────

function onMouseMove(e) {
  const word = getWordAtPoint(e.clientX, e.clientY);

  if (!word || word === activeWord) return;

  clearTimeout(hoverTimer);
  hideTooltip();
  activeWord = word;

  const x = e.clientX;
  const y = e.clientY;
  hoverTimer = setTimeout(() => triggerLookup(word, x, y), hoverDelayMs);
}

function onMouseOut() {
  clearTimeout(hoverTimer);
  hideTooltip();
  activeWord = null;
}

// ─── Lookup & render ─────────────────────────────────────────────────────────

async function triggerLookup(word, x, y) {
  const result = await window.FrenchGenderDB.lookup(word);
  if (!result) return;
  showTooltip(result, word, x, y);
}

// ─── Shadow host ─────────────────────────────────────────────────────────────

function ensureHost() {
  if (hostEl && hostEl.isConnected) return;

  hostEl = document.createElement('div');
  hostEl.id = 'fg-tooltip-host';
  hostEl.style.cssText = [
    'all: initial',
    'position: absolute',
    'top: 0',
    'left: 0',
    'z-index: 2147483647',
    'pointer-events: none',
  ].join(';');

  shadowRoot = hostEl.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  const cssUrl = chrome.runtime.getURL('content.css');
  style.textContent = `@import url("${cssUrl}");`;
  shadowRoot.appendChild(style);

  document.body.appendChild(hostEl);
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function showTooltip(data, word, x, y) {
  ensureHost();
  hideTooltip();

  const isMasc  = data.gender === 'm';
  const article = data.article;
  const defArt  = isMasc ? 'le' : 'la';
  const level   = data.level || '';
  const partner = isMasc ? data.feminine : data.masculine;
  const partnerLabel = isMasc ? 'Féminin' : 'Masculin';
  const partnerArticle = isMasc ? 'une' : 'un';

  cardEl = document.createElement('div');
  cardEl.id = 'fg-tooltip';
  cardEl.setAttribute('data-gender', data.gender);

  cardEl.innerHTML = `
    <div class="fg-header">
      <div class="fg-gender-pill">${isMasc ? '♂ Masculin' : '♀ Féminin'}</div>
      ${level ? `<div class="fg-level">${level}</div>` : ''}
    </div>

    <div class="fg-word-row">
      <span class="fg-article">${defArt}</span>
      <span class="fg-word">${escapeHtml(word.toLowerCase())}</span>
    </div>

    <div class="fg-article-row">
      <span class="fg-dim">Article indéfini :</span>
      <span class="fg-indef">${article} ${escapeHtml(word.toLowerCase())}</span>
    </div>

    ${partner ? `
    <div class="fg-divider"></div>
    <div class="fg-partner-row">
      <span class="fg-partner-label">${partnerLabel} :</span>
      <span class="fg-partner-article">${partnerArticle}</span>
      <span class="fg-partner-word">${escapeHtml(partner)}</span>
    </div>
    ` : ''}
  `;

  shadowRoot.appendChild(cardEl);
  positionTooltip(x, y);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function positionTooltip(x, y) {
  if (!cardEl || !hostEl) return;

  const W  = cardEl.offsetWidth  || 220;
  const H  = cardEl.offsetHeight || 120;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const margin  = 14;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  let left = x + scrollX + margin;
  let top  = y + scrollY - H / 2;

  if (x + margin + W > vw) left = x + scrollX - W - margin;

  top = Math.max(scrollY + 8, Math.min(top, scrollY + vh - H - 8));

  hostEl.style.left = `${left}px`;
  hostEl.style.top  = `${top}px`;
}

function hideTooltip() {
  if (cardEl) {
    cardEl.remove();
    cardEl = null;
  }
}

// Exposed for unit tests (accessed via window when loaded in jsdom)
if (typeof window !== 'undefined') {
  window.__FG_TEST__ = {
    getState: () => ({ hoverDelayMs, activeWord, hasTooltip: !!cardEl, hostEl, cardEl, shadowRoot }),
    getWordAtPoint,
    showTooltip,
    hideTooltip,
    positionTooltip,
    onMouseMove,
    onMouseOut,
    reset: () => {
      clearTimeout(hoverTimer);
      hoverTimer = null;
      activeWord = null;
      hideTooltip();
      if (hostEl) { hostEl.remove(); hostEl = null; shadowRoot = null; }
    },
    setDelay: (ms) => { hoverDelayMs = ms; },
  };
}
