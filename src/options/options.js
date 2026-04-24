import { LANGUAGES } from "../lib/lookup.js";
import { getSettings, setSettings, clearHistory } from "../lib/storage.js";

const els = {
  defaultLanguage: document.querySelector("#default-language"),
  themeOptions: [...document.querySelectorAll('input[name="theme"]')],
  contextMenuEnabled: document.querySelector("#context-menu-enabled"),
  saveStatus: document.querySelector("#save-status")
};

let statusTimer = null;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || "auto";
}

function showSavedState(message = "Saved.") {
  els.saveStatus.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    els.saveStatus.textContent = "";
  }, 1400);
}

function renderLanguageOptions(selectedLang) {
  els.defaultLanguage.innerHTML = LANGUAGES.map(
    (language) =>
      `<option value="${language.code}"${
        language.code === selectedLang ? " selected" : ""
      }>${language.label}</option>`
  ).join("");
}

async function updateSettings(patch) {
  const settings = await setSettings(patch);
  applyTheme(settings.theme);
  showSavedState();
}

async function init() {
  const settings = await getSettings();
  applyTheme(settings.theme);
  renderLanguageOptions(settings.defaultLang);

  els.themeOptions.forEach((option) => {
    option.checked = option.value === settings.theme;
  });

  els.contextMenuEnabled.checked = settings.contextMenuEnabled;

  els.defaultLanguage.addEventListener("change", async (event) => {
    await updateSettings({ defaultLang: event.target.value });
  });

  els.themeOptions.forEach((option) => {
    option.addEventListener("change", async (event) => {
      if (!event.target.checked) {
        return;
      }
      await updateSettings({ theme: event.target.value });
    });
  });

  els.contextMenuEnabled.addEventListener("change", async (event) => {
    await updateSettings({ contextMenuEnabled: event.target.checked });
  });

  document.querySelector("#clear-history")?.addEventListener("click", async () => {
    await clearHistory();
    showSavedState("History cleared.");
  });

  document.querySelector("#clear-favorites")?.addEventListener("click", async () => {
    await chrome.storage.local.set({ favorites: [] });
    showSavedState("Favorites cleared.");
  });
}

init();
