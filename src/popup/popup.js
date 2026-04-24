import { lookup, suggest, GENDER_META } from "../lib/lookup.js";
import {
  consumePendingLookup,
  getFavorites,
  getHistory,
  getSettings,
  isFavorite,
  pushHistory,
  setSettings,
  toggleFavorite,
} from "../lib/storage.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  query: "",
  tab: "recent",
  suggestionIndex: -1,
  suggestionItems: []
};

const els = {
  input: $("#word-input"),
  inputWrap: $(".input-wrap"),
  clear: $("#clear-btn"),
  suggestions: $("#suggestions"),
  result: $("#result"),
  tabs: $$(".tab"),
  list: $("#list"),
  options: $("#open-options")
};

// ── init ───────────────────────────────────────────────
async function init() {
  const settings = await getSettings();
  applyTheme(settings.theme);
  renderEmpty();
  await renderList();

  const pending = await consumePendingLookup();
  const hash = decodeURIComponent(location.hash.slice(1));
  const initialWord = pending?.word || hash;

  if (initialWord) {
    els.input.value = initialWord;
    els.inputWrap.classList.add("has-text");
    handleQuery(initialWord, { commit: true });
  } else {
    els.input.focus();
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || "auto";
}

// ── events ─────────────────────────────────────────────
els.input.addEventListener("input", (e) => {
  const v = e.target.value;
  els.inputWrap.classList.toggle("has-text", v.length > 0);
  state.query = v;
  if (!v) { hideSuggestions(); renderEmpty(); return; }
  handleQuery(v, { commit: false });
});

els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (state.suggestionIndex >= 0) {
      pickSuggestion(state.suggestionItems[state.suggestionIndex]);
    } else {
      handleQuery(els.input.value, { commit: true });
      hideSuggestions();
    }
  } else if (e.key === "ArrowDown") { e.preventDefault(); moveSuggestion(1); }
  else if (e.key === "ArrowUp")    { e.preventDefault(); moveSuggestion(-1); }
  else if (e.key === "Escape")     { hideSuggestions(); }
});

els.clear.addEventListener("click", () => {
  els.input.value = "";
  els.inputWrap.classList.remove("has-text");
  state.query = "";
  hideSuggestions();
  renderEmpty();
  els.input.focus();
});

document.addEventListener("click", (e) => {
  if (!els.suggestions.contains(e.target) && e.target !== els.input)
    hideSuggestions();
});

els.tabs.forEach((t) =>
  t.addEventListener("click", () => {
    state.tab = t.dataset.tab;
    els.tabs.forEach((x) => x.classList.toggle("is-active", x === t));
    renderList();
  })
);

els.options.addEventListener("click", () => chrome.runtime.openOptionsPage());

// ── querying ───────────────────────────────────────────
let queryToken = 0;

async function handleQuery(word, { commit }) {
  state.query = word;
  const myToken = ++queryToken;

  // autocomplete suggestions (local dict only, fast)
  if (!commit && word.length >= 1 && word.length <= 14) {
    const items = await suggest(word);
    if (myToken !== queryToken) return;
    items.length ? showSuggestions(items) : hideSuggestions();
  } else {
    hideSuggestions();
  }

  // show loading shimmer for Wiktionary queries (> ~300ms)
  const shimmerTimer = setTimeout(() => {
    if (myToken === queryToken) els.result.classList.add("loading");
  }, 280);

  const res = await lookup(word);
  clearTimeout(shimmerTimer);
  els.result.classList.remove("loading");

  if (myToken !== queryToken) return;

  if (res.ok) {
    renderResult(res);
    if (commit) {
      pushHistory({ word: res.word, article: res.article, gender: res.gender, en: res.en });
      renderList();
    }
  } else if (commit || word.length >= 3) {
    renderNotFound(res);
  } else {
    renderEmpty();
  }
}

function showSuggestions(items) {
  state.suggestionItems = items;
  state.suggestionIndex = -1;
  els.suggestions.innerHTML = items
    .map((w) => `<li data-word="${w}"><span>${w}</span><span class="s-art">FR</span></li>`)
    .join("");
  els.suggestions.hidden = false;
  $$("#suggestions li").forEach((li) =>
    li.addEventListener("mousedown", (e) => { e.preventDefault(); pickSuggestion(li.dataset.word); })
  );
}

function hideSuggestions() {
  els.suggestions.hidden = true;
  state.suggestionIndex = -1;
  state.suggestionItems = [];
}

function moveSuggestion(delta) {
  if (!state.suggestionItems.length) return;
  state.suggestionIndex =
    (state.suggestionIndex + delta + state.suggestionItems.length) % state.suggestionItems.length;
  $$("#suggestions li").forEach((li, i) =>
    li.classList.toggle("is-active", i === state.suggestionIndex)
  );
}

function pickSuggestion(word) {
  els.input.value = word;
  els.inputWrap.classList.add("has-text");
  hideSuggestions();
  handleQuery(word, { commit: true });
}

// ── rendering ──────────────────────────────────────────
function renderEmpty() {
  els.result.innerHTML = "";
  const tpl = $("#tpl-empty").content.cloneNode(true);
  els.result.appendChild(tpl);
  els.result.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => {
      els.input.value = c.dataset.try;
      els.inputWrap.classList.add("has-text");
      handleQuery(c.dataset.try, { commit: true });
    })
  );
}

async function renderResult(res) {
  els.result.innerHTML = "";
  const tpl = $("#tpl-result").content.cloneNode(true);
  const meta = GENDER_META[res.gender] || GENDER_META.m;

  const card = tpl.querySelector(".card");
  card.style.setProperty("--gender-color", meta.color);

  tpl.querySelector(".article").textContent = res.article;
  tpl.querySelector(".word").textContent = res.word;
  tpl.querySelector(".g-glyph").textContent = meta.glyph;
  tpl.querySelector(".g-label").textContent = meta.label;
  tpl.querySelector(".translation").textContent = res.en || "";
  tpl.querySelector(".plural").textContent = res.plural || "—";

  const exRow = tpl.querySelector(".example-row");
  const exVal = tpl.querySelector(".example");
  if (res.example) {
    exVal.textContent = res.example;
  } else {
    exRow.hidden = true;
  }

  // show "Wiktionary" badge when result comes from the API
  const srcBadge = tpl.querySelector(".src-badge");
  if (res.src === "wiki") srcBadge.hidden = false;

  const favBtn = tpl.querySelector(".fav-btn");
  const fav = await isFavorite("fr", res.word);
  favBtn.classList.toggle("is-fav", fav);
  favBtn.addEventListener("click", async () => {
    const now = await toggleFavorite({ lang: "fr", word: res.word, article: res.article, gender: res.gender, en: res.en });
    favBtn.classList.toggle("is-fav", now);
    if (state.tab === "favorites") renderList();
  });

  els.result.appendChild(tpl);
}

function renderNotFound(res) {
  els.result.innerHTML = "";
  const tpl = $("#tpl-not-found").content.cloneNode(true);
  const row = tpl.querySelector(".suggest-row");
  const wikiMsg = tpl.querySelector(".nf-wiki");

  if (res.suggestions?.length) {
    res.suggestions.forEach((w) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = w;
      b.addEventListener("click", () => {
        els.input.value = w;
        els.inputWrap.classList.add("has-text");
        handleQuery(w, { commit: true });
      });
      row.appendChild(b);
    });
  } else {
    row.remove();
  }
  // Wiktionary was already tried in lookup(); it returned not-found
  wikiMsg.textContent = "Not found in Wiktionary either.";

  els.result.appendChild(tpl);
}

async function renderList() {
  const data = state.tab === "recent" ? await getHistory() : await getFavorites();
  const frOnly = data.filter((e) => !e.lang || e.lang === "fr");

  if (!frOnly.length) {
    els.list.innerHTML = `<div class="list-empty">${
      state.tab === "recent"
        ? "No lookups yet — type a word above."
        : "Star a word to save it here."
    }</div>`;
    return;
  }

  els.list.innerHTML = frOnly.map((e) => {
    const meta = GENDER_META[e.gender] || GENDER_META.m;
    return `<div class="list-item" data-word="${e.word}" style="--li-color:${meta.color}">
      <span class="li-art">${e.article || ""}</span>
      <span class="li-word">${e.word}</span>
      <span class="li-en">${e.en || ""}</span>
    </div>`;
  }).join("");

  els.list.querySelectorAll(".list-item").forEach((it) =>
    it.addEventListener("click", () => {
      els.input.value = it.dataset.word;
      els.inputWrap.classList.add("has-text");
      handleQuery(it.dataset.word, { commit: false });
    })
  );
}

init();
