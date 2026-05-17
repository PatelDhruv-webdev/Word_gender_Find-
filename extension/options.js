const STORAGE_KEY_DELAY = 'hoverDelayMs';
const DEFAULT_DELAY = 2000;

const delayInput = document.getElementById('delay');
const statusEl   = document.getElementById('status');

function showStatus(msg) {
  statusEl.textContent = msg;
  setTimeout(() => { statusEl.textContent = ''; }, 1500);
}

chrome.storage.sync.get({ [STORAGE_KEY_DELAY]: DEFAULT_DELAY }).then(({ [STORAGE_KEY_DELAY]: v }) => {
  delayInput.value = v;
});

delayInput.addEventListener('change', async () => {
  const n = Number(delayInput.value);
  if (!Number.isFinite(n) || n < 200 || n > 10000) {
    showStatus('Value must be 200–10000.');
    return;
  }
  await chrome.storage.sync.set({ [STORAGE_KEY_DELAY]: n });
  showStatus('Saved.');
});
