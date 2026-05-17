import { test, expect, chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR   = join(__dirname, '..', '..', 'extension');
const FIXTURE   = 'file://' + join(__dirname, '..', 'fixtures', 'page.html');

let context;
let page;

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'fg-ext-'));
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      '--no-sandbox',
    ],
  });
  page = await context.newPage();
  await page.goto(FIXTURE);
  // Give the content script time to init + seed IndexedDB
  await page.waitForTimeout(500);
});

test.afterAll(async () => {
  await context?.close();
});

async function hoverAndWait(selector, delayMs = 2200) {
  const el = page.locator(selector);
  const box = await el.boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  // Move cursor out first, then into the element to trigger fresh timer
  await page.mouse.move(10, 10);
  await page.waitForTimeout(100);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(delayMs);
}

function shadowCard() {
  return page.locator('#fg-tooltip-host').evaluateHandle((host) => {
    return host.shadowRoot.getElementById('fg-tooltip');
  });
}

test('tooltip appears for a known masculine word', async () => {
  await hoverAndWait('#w-chien');
  await expect(page.locator('#fg-tooltip-host')).toBeAttached();

  const data = await page.evaluate(() => {
    const host = document.getElementById('fg-tooltip-host');
    const card = host.shadowRoot.getElementById('fg-tooltip');
    return {
      gender:  card.getAttribute('data-gender'),
      pill:    card.querySelector('.fg-gender-pill').textContent,
      article: card.querySelector('.fg-article').textContent,
      indef:   card.querySelector('.fg-indef').textContent,
      partner: card.querySelector('.fg-partner-word')?.textContent,
    };
  });
  expect(data.gender).toBe('m');
  expect(data.pill).toContain('Masculin');
  expect(data.article).toBe('le');
  expect(data.indef).toContain('un chien');
  expect(data.partner).toBe('chienne');
});

test('tooltip appears for a known feminine word', async () => {
  await hoverAndWait('#w-fleur');
  const data = await page.evaluate(() => {
    const host = document.getElementById('fg-tooltip-host');
    const card = host.shadowRoot.getElementById('fg-tooltip');
    return {
      gender:  card.getAttribute('data-gender'),
      article: card.querySelector('.fg-article').textContent,
    };
  });
  expect(data.gender).toBe('f');
  expect(data.article).toBe('la');
});

test('tooltip does NOT appear for an unknown word', async () => {
  await hoverAndWait('#w-unknown');
  const hasCard = await page.evaluate(() => {
    const host = document.getElementById('fg-tooltip-host');
    return !!host?.shadowRoot?.getElementById('fg-tooltip');
  });
  expect(hasCard).toBe(false);
});

test('tooltip hides when cursor leaves the viewport', async () => {
  await hoverAndWait('#w-chien');
  // Confirm tooltip is visible
  let present = await page.evaluate(() => {
    const host = document.getElementById('fg-tooltip-host');
    return !!host?.shadowRoot?.getElementById('fg-tooltip');
  });
  expect(present).toBe(true);

  // Dispatch mouseleave on <html> to simulate cursor leaving viewport
  await page.evaluate(() => {
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
  });
  await page.waitForTimeout(100);

  present = await page.evaluate(() => {
    const host = document.getElementById('fg-tooltip-host');
    return !!host?.shadowRoot?.getElementById('fg-tooltip');
  });
  expect(present).toBe(false);
});

test('tooltip respects custom delay from chrome.storage.sync', async () => {
  // Set delay to 300ms via the extension's service worker, then reload the
  // page so the content script reads the new value at init.
  const [sw] = context.serviceWorkers();
  await sw.evaluate(() => chrome.storage.sync.set({ hoverDelayMs: 300 }));
  await page.reload();
  await page.waitForTimeout(400); // let init + seed settle

  const el = page.locator('#w-chien');
  const box = await el.boundingBox();
  await page.mouse.move(10, 10);
  await page.waitForTimeout(100);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500); // 500 > 300 but < 2000 (default)

  const present = await page.evaluate(() => {
    const host = document.getElementById('fg-tooltip-host');
    return !!host?.shadowRoot?.getElementById('fg-tooltip');
  });
  expect(present).toBe(true);

  // Restore default for any later tests
  await sw.evaluate(() => chrome.storage.sync.remove('hoverDelayMs'));
});
