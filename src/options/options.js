import { getSettings, setSettings, clearHistory } from "../lib/storage.js";

let statusTimer = null;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || "auto";
}

function showSaved(msg = "Saved.") {
  const el = document.querySelector("#save-status");
  if (!el) return;
  el.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { el.textContent = ""; }, 1800);
}

async function updateSettings(patch) {
  const s = await setSettings(patch);
  applyTheme(s.theme);
  showSaved();
}

async function init() {
  const settings = await getSettings();
  applyTheme(settings.theme);

  // theme radio buttons
  document.querySelectorAll('input[name="theme"]').forEach((opt) => {
    opt.checked = opt.value === (settings.theme || "auto");
    opt.addEventListener("change", () => {
      if (opt.checked) updateSettings({ theme: opt.value });
    });
  });

  // context menu toggle
  const ctxEl = document.querySelector("#context-menu-enabled");
  if (ctxEl) {
    ctxEl.checked = settings.contextMenuEnabled !== false;
    ctxEl.addEventListener("change", () =>
      updateSettings({ contextMenuEnabled: ctxEl.checked })
    );
  }

  // hover tooltip toggle
  const hoverEl = document.querySelector("#hover-enabled");
  if (hoverEl) {
    hoverEl.checked = settings.hoverEnabled !== false;
    hoverEl.addEventListener("change", () =>
      updateSettings({ hoverEnabled: hoverEl.checked })
    );
  }

  // clear history
  document.querySelector("#clear-history")?.addEventListener("click", async () => {
    await clearHistory();
    showSaved("History cleared.");
  });

  // clear favorites
  document.querySelector("#clear-favorites")?.addEventListener("click", async () => {
    await chrome.storage.local.set({ favorites: [] });
    showSaved("Favorites cleared.");
  });
}

init();
