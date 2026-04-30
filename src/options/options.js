import {
  clearFavorites,
  clearHistory,
  clearWikiCache,
  getSettings,
  setSettings,
} from "../lib/storage.js";

let statusTimer = null;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || "auto";
}

function showStatus(msg = "Saved.") {
  const el = document.querySelector("#save-status");
  if (!el) return;
  el.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { el.textContent = ""; }, 2200);
}

async function updateSettings(patch) {
  const s = await setSettings(patch);
  applyTheme(s.theme);
  showStatus();
}

async function init() {
  const settings = await getSettings();
  applyTheme(settings.theme);

  // Theme radio buttons
  document.querySelectorAll('input[name="theme"]').forEach((opt) => {
    opt.checked = opt.value === (settings.theme || "auto");
    opt.addEventListener("change", () => {
      if (opt.checked) updateSettings({ theme: opt.value });
    });
  });

  // Hover tooltip toggle
  const hoverEl = document.querySelector("#hover-enabled");
  if (hoverEl) {
    hoverEl.checked = settings.hoverEnabled !== false;
    hoverEl.addEventListener("change", () =>
      updateSettings({ hoverEnabled: hoverEl.checked })
    );
  }

  // Context menu toggle
  const ctxEl = document.querySelector("#context-menu-enabled");
  if (ctxEl) {
    ctxEl.checked = settings.contextMenuEnabled !== false;
    ctxEl.addEventListener("change", () =>
      updateSettings({ contextMenuEnabled: ctxEl.checked })
    );
  }

  // Clear history
  document.querySelector("#clear-history")?.addEventListener("click", async () => {
    await clearHistory();
    showStatus("History cleared.");
  });

  // Clear favorites
  document.querySelector("#clear-favorites")?.addEventListener("click", async () => {
    await clearFavorites();
    showStatus("Favourites cleared.");
  });

  // Clear Wiktionary cache
  document.querySelector("#clear-wiki-cache")?.addEventListener("click", async () => {
    await clearWikiCache();
    showStatus("Wiktionary cache cleared.");
  });
}

init();
