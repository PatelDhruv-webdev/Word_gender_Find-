/**
 * background.js — service worker
 * db.js auto-reseeds IndexedDB when the extension version changes, so this
 * worker only logs lifecycle events.
 */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.log('[French Gender] Extension installed.');
  } else if (reason === 'update') {
    console.log('[French Gender] Extension updated — dictionary will re-seed on next page load.');
  }
});
