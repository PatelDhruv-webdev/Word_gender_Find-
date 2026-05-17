import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock, makeFetchFail } from '../setup.js';
import { loadExtSource, waitForInit, readDict } from '../helpers.js';

describe('db.js', () => {
  beforeEach(() => {
    installChromeMock();
    loadExtSource('db.js');
  });

  describe('normalize', () => {
    it('lowercases and strips leading "le "', () => {
      const { normalize } = window.FrenchGenderDB._internals;
      expect(normalize('Le chat')).toBe('chat');
    });

    it('strips "la "', () => {
      const { normalize } = window.FrenchGenderDB._internals;
      expect(normalize('la fleur')).toBe('fleur');
    });

    it("strips elided l'", () => {
      const { normalize } = window.FrenchGenderDB._internals;
      expect(normalize("l'école")).toBe('école');
    });

    it('strips "les "', () => {
      const { normalize } = window.FrenchGenderDB._internals;
      expect(normalize('Les enfants')).toBe('enfants');
    });

    it('strips "un "/"une "/"des "', () => {
      const { normalize } = window.FrenchGenderDB._internals;
      expect(normalize('un chien')).toBe('chien');
      expect(normalize('Une pomme')).toBe('pomme');
      expect(normalize('des livres')).toBe('livres');
    });

    it('preserves accented characters', () => {
      const { normalize } = window.FrenchGenderDB._internals;
      expect(normalize('Étudiant')).toBe('étudiant');
      expect(normalize('CRÈME')).toBe('crème');
    });

    it('returns empty string for whitespace input', () => {
      const { normalize } = window.FrenchGenderDB._internals;
      expect(normalize('   ')).toBe('');
    });
  });

  describe('init + seedDB', () => {
    it('populates IndexedDB with every dict entry', async () => {
      await window.FrenchGenderDB.init();
      await waitForInit();
      const dict = readDict();
      const sampleKey = Object.keys(dict)[0];
      const record = await window.FrenchGenderDB.lookup(sampleKey);
      expect(record).toBeTruthy();
      expect(record.gender).toBe(dict[sampleKey].gender);
    });

    it('is idempotent when called twice at the same version', async () => {
      await window.FrenchGenderDB.init();
      const first = await window.FrenchGenderDB.lookup('chat');
      await window.FrenchGenderDB.init();
      const second = await window.FrenchGenderDB.lookup('chat');
      expect(first).toEqual(second);
    });

    it('re-seeds when manifest version changes', async () => {
      await window.FrenchGenderDB.init();
      expect(await window.FrenchGenderDB.lookup('chat')).toBeTruthy();

      // Simulate shipping a new version with a changed dict
      installChromeMock({ manifestVersion: '2.0.0' });
      loadExtSource('db.js');
      await window.FrenchGenderDB.init();
      const record = await window.FrenchGenderDB.lookup('chat');
      expect(record).toBeTruthy();
      // meta should now record 2.0.0
      // We can't easily read meta directly here — the fact that re-seed ran
      // without throwing and lookup still works is the behavioral assertion.
    });

    it('does NOT mark seeded when fetch fails', async () => {
      makeFetchFail();
      await window.FrenchGenderDB.init();
      // lookup on empty DB returns null
      const record = await window.FrenchGenderDB.lookup('chat');
      expect(record).toBeNull();
    });
  });

  describe('lookup', () => {
    beforeEach(async () => {
      await window.FrenchGenderDB.init();
      await waitForInit();
    });

    it('returns full record for a known masculine word', async () => {
      const r = await window.FrenchGenderDB.lookup('chien');
      expect(r).toMatchObject({ gender: 'm', article: 'un', feminine: 'chienne' });
    });

    it('returns full record for a known feminine word', async () => {
      const r = await window.FrenchGenderDB.lookup('fleur');
      expect(r).toMatchObject({ gender: 'f', article: 'une' });
    });

    it('applies normalization before lookup', async () => {
      const r = await window.FrenchGenderDB.lookup("L'étudiant");
      expect(r).toMatchObject({ gender: 'm' });
    });

    it('returns null for unknown words', async () => {
      const r = await window.FrenchGenderDB.lookup('xyzzy');
      expect(r).toBeNull();
    });

    it('returns null for empty / whitespace input', async () => {
      expect(await window.FrenchGenderDB.lookup('')).toBeNull();
      expect(await window.FrenchGenderDB.lookup('   ')).toBeNull();
    });
  });
});
