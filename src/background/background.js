import {
  clearPendingLookup,
  getSettings,
  setPendingLookup
} from "../lib/storage.js";
import { lookup } from "../lib/lookup.js";

const MENU_ID = "lookup-gender";

async function syncContextMenu() {
  const settings = await getSettings();
  await chrome.contextMenus.removeAll();

  if (!settings.contextMenuEnabled) {
    return;
  }

  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Find gender",
    contexts: ["selection"]
  });
}

chrome.runtime.onInstalled.addListener(() => {
  syncContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  syncContextMenu();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.settings) {
    return;
  }
  syncContextMenu();
});

// Content script sends lookup requests to avoid fetching JSON from page context
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === "lookup") {
    lookup(msg.word).then((res) => reply(res));
    return true;
  }
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) {
    return;
  }

  const selectedWord = info.selectionText?.trim();
  if (!selectedWord) {
    await clearPendingLookup();
    return;
  }

  await setPendingLookup(selectedWord);

  try {
    await chrome.action.openPopup();
  } catch (error) {
    await clearPendingLookup();
    console.error("Failed to open popup from context menu.", error);
  }
});
