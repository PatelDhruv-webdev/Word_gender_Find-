import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installChromeMock } from '../setup.js';
import { loadExtSource, waitForInit } from '../helpers.js';

async function loadBoth() {
  loadExtSource('db.js');
  loadExtSource('content.js');
  await waitForInit();
}

describe('content.js', () => {
  beforeEach(() => {
    installChromeMock();
  });

  describe('getWordAtPoint', () => {
    beforeEach(async () => {
      await loadBoth();
    });

    it('returns null when the text node has no word characters', () => {
      const { getWordAtPoint } = window.__FG_TEST__;
      document.body.innerHTML = '<p id="t">   .   </p>';
      // Patch caretRangeFromPoint to return a range into the text node at offset 3 (a space)
      const tn = document.getElementById('t').firstChild;
      document.caretRangeFromPoint = () => {
        const r = document.createRange();
        r.setStart(tn, 3);
        r.setEnd(tn, 3);
        return r;
      };
      expect(getWordAtPoint(0, 0)).toBeNull();
    });

    it('expands through accented characters', () => {
      const { getWordAtPoint } = window.__FG_TEST__;
      document.body.innerHTML = '<p id="t">une école à Paris</p>';
      const tn = document.getElementById('t').firstChild;
      document.caretRangeFromPoint = () => {
        const r = document.createRange();
        // offset inside "école"
        const idx = tn.textContent.indexOf('école') + 2;
        r.setStart(tn, idx);
        r.setEnd(tn, idx);
        return r;
      };
      expect(getWordAtPoint(0, 0)).toBe('école');
    });

    it('expands through hyphens (grand-mère)', () => {
      const { getWordAtPoint } = window.__FG_TEST__;
      document.body.innerHTML = '<p id="t">ma grand-mère adore</p>';
      const tn = document.getElementById('t').firstChild;
      document.caretRangeFromPoint = () => {
        const r = document.createRange();
        const idx = tn.textContent.indexOf('grand-mère') + 3;
        r.setStart(tn, idx);
        r.setEnd(tn, idx);
        return r;
      };
      expect(getWordAtPoint(0, 0)).toBe('grand-mère');
    });

    it('expands through apostrophes', () => {
      const { getWordAtPoint } = window.__FG_TEST__;
      document.body.innerHTML = "<p id=\"t\">voici l'école</p>";
      const tn = document.getElementById('t').firstChild;
      document.caretRangeFromPoint = () => {
        const r = document.createRange();
        const idx = tn.textContent.indexOf("l'école") + 3;
        r.setStart(tn, idx);
        r.setEnd(tn, idx);
        return r;
      };
      expect(getWordAtPoint(0, 0)).toBe("l'école");
    });
  });

  describe('showTooltip', () => {
    beforeEach(async () => {
      await loadBoth();
    });

    it('renders masculine layout with blue/le/un', () => {
      const { showTooltip, getState } = window.__FG_TEST__;
      showTooltip({ gender: 'm', article: 'un', feminine: 'chienne', level: 'A1' }, 'chien', 100, 100);
      const { shadowRoot } = getState();
      const card = shadowRoot.getElementById('fg-tooltip');
      expect(card.getAttribute('data-gender')).toBe('m');
      expect(card.querySelector('.fg-gender-pill').textContent).toContain('Masculin');
      expect(card.querySelector('.fg-article').textContent).toBe('le');
      expect(card.querySelector('.fg-indef').textContent).toContain('un chien');
      expect(card.querySelector('.fg-partner-label').textContent).toContain('Féminin');
      expect(card.querySelector('.fg-partner-word').textContent).toBe('chienne');
      expect(card.querySelector('.fg-level').textContent).toBe('A1');
    });

    it('renders feminine layout with pink/la/une', () => {
      const { showTooltip, getState } = window.__FG_TEST__;
      showTooltip({ gender: 'f', article: 'une', masculine: 'chien' }, 'chienne', 50, 50);
      const { shadowRoot } = getState();
      const card = shadowRoot.getElementById('fg-tooltip');
      expect(card.getAttribute('data-gender')).toBe('f');
      expect(card.querySelector('.fg-gender-pill').textContent).toContain('Féminin');
      expect(card.querySelector('.fg-article').textContent).toBe('la');
      expect(card.querySelector('.fg-indef').textContent).toContain('une chienne');
      expect(card.querySelector('.fg-partner-label').textContent).toContain('Masculin');
      expect(card.querySelector('.fg-partner-word').textContent).toBe('chien');
    });

    it('omits partner block when no partner form exists', () => {
      const { showTooltip, getState } = window.__FG_TEST__;
      showTooltip({ gender: 'f', article: 'une' }, 'école', 100, 100);
      const { shadowRoot } = getState();
      const card = shadowRoot.getElementById('fg-tooltip');
      expect(card.querySelector('.fg-partner-row')).toBeNull();
      expect(card.querySelector('.fg-divider')).toBeNull();
    });

    it('omits level badge when level is missing', () => {
      const { showTooltip, getState } = window.__FG_TEST__;
      showTooltip({ gender: 'm', article: 'un' }, 'truc', 0, 0);
      const { shadowRoot } = getState();
      expect(shadowRoot.querySelector('.fg-level')).toBeNull();
    });

    it('escapes HTML in the displayed word', () => {
      const { showTooltip, getState } = window.__FG_TEST__;
      showTooltip({ gender: 'm', article: 'un' }, '<img onerror=x>', 0, 0);
      const { shadowRoot } = getState();
      const card = shadowRoot.getElementById('fg-tooltip');
      expect(card.querySelector('img')).toBeNull();
      expect(card.querySelector('.fg-word').textContent).toContain('<img');
    });

    it('isolates itself inside shadow DOM', () => {
      const { showTooltip } = window.__FG_TEST__;
      showTooltip({ gender: 'm', article: 'un' }, 'chat', 0, 0);
      // Light-tree query must NOT find #fg-tooltip directly
      expect(document.querySelector('#fg-tooltip')).toBeNull();
      // But the host IS in the light tree
      expect(document.querySelector('#fg-tooltip-host')).toBeTruthy();
    });
  });

  describe('positionTooltip', () => {
    beforeEach(async () => {
      await loadBoth();
      // Give jsdom a fixed viewport
      Object.defineProperty(window, 'innerWidth',  { configurable: true, value: 1000 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    });

    it('places tooltip to the right of cursor by default', () => {
      const { showTooltip, positionTooltip, getState } = window.__FG_TEST__;
      showTooltip({ gender: 'm', article: 'un' }, 'chat', 100, 100);
      positionTooltip(100, 100);
      const { hostEl } = getState();
      expect(parseInt(hostEl.style.left, 10)).toBeGreaterThan(100);
    });

    it('flips left when near the right edge', () => {
      const { showTooltip, positionTooltip, getState } = window.__FG_TEST__;
      showTooltip({ gender: 'm', article: 'un' }, 'chat', 990, 100);
      positionTooltip(990, 100);
      const { hostEl } = getState();
      // With default 220 width + margin, 990 + 14 + 220 > 1000, so flip left
      expect(parseInt(hostEl.style.left, 10)).toBeLessThan(990);
    });

    it('clamps vertically to stay inside viewport', () => {
      const { showTooltip, positionTooltip, getState } = window.__FG_TEST__;
      showTooltip({ gender: 'm', article: 'un' }, 'chat', 100, 5);
      positionTooltip(100, 5);
      const { hostEl } = getState();
      expect(parseInt(hostEl.style.top, 10)).toBeGreaterThanOrEqual(8);
    });
  });

  describe('hover debounce (timer)', () => {
    beforeEach(async () => {
      await loadBoth();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does NOT fire lookup when the cursor keeps moving across words', async () => {
      const { onMouseMove, getState } = window.__FG_TEST__;
      document.body.innerHTML = '<p id="t">chat chien fleur arbre</p>';
      const tn = document.getElementById('t').firstChild;

      let caretIdx = 0;
      document.caretRangeFromPoint = () => {
        const r = document.createRange();
        r.setStart(tn, caretIdx);
        r.setEnd(tn, caretIdx);
        return r;
      };

      const spy = vi.spyOn(window.FrenchGenderDB, 'lookup');

      // Move across four words quickly (< 2s apart)
      for (const word of ['chat', 'chien', 'fleur', 'arbre']) {
        caretIdx = tn.textContent.indexOf(word) + 1;
        onMouseMove({ clientX: 10, clientY: 10 });
        await vi.advanceTimersByTimeAsync(500);
      }
      // Less than 2000ms elapsed on the last word — no lookup yet
      expect(spy).not.toHaveBeenCalled();
    });

    it('fires lookup after 2s on a stable word', async () => {
      const { onMouseMove } = window.__FG_TEST__;
      document.body.innerHTML = '<p id="t">chien</p>';
      const tn = document.getElementById('t').firstChild;
      document.caretRangeFromPoint = () => {
        const r = document.createRange();
        r.setStart(tn, 2);
        r.setEnd(tn, 2);
        return r;
      };

      const spy = vi.spyOn(window.FrenchGenderDB, 'lookup');
      onMouseMove({ clientX: 10, clientY: 10 });
      await vi.advanceTimersByTimeAsync(2000);
      expect(spy).toHaveBeenCalledWith('chien');
    });

    it('respects a custom delay set via setDelay', async () => {
      const { onMouseMove, setDelay } = window.__FG_TEST__;
      setDelay(500);
      document.body.innerHTML = '<p id="t">chien</p>';
      const tn = document.getElementById('t').firstChild;
      document.caretRangeFromPoint = () => {
        const r = document.createRange();
        r.setStart(tn, 2);
        r.setEnd(tn, 2);
        return r;
      };
      const spy = vi.spyOn(window.FrenchGenderDB, 'lookup');
      onMouseMove({ clientX: 10, clientY: 10 });
      await vi.advanceTimersByTimeAsync(500);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('onMouseOut', () => {
    beforeEach(async () => {
      await loadBoth();
    });

    it('hides tooltip and clears active word', () => {
      const { showTooltip, onMouseOut, getState } = window.__FG_TEST__;
      showTooltip({ gender: 'm', article: 'un' }, 'chat', 0, 0);
      expect(getState().hasTooltip).toBe(true);
      onMouseOut();
      expect(getState().hasTooltip).toBe(false);
      expect(getState().activeWord).toBeNull();
    });
  });
});
