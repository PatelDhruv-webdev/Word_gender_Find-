import { describe, it, expect } from 'vitest';
import { readDict } from '../helpers.js';

const dict = readDict();

describe('dict.json integrity', () => {
  it('has at least 40 entries', () => {
    expect(Object.keys(dict).length).toBeGreaterThanOrEqual(40);
  });

  it('every entry has gender ∈ {m, f}', () => {
    for (const [word, data] of Object.entries(dict)) {
      expect(['m', 'f'], `${word}`).toContain(data.gender);
    }
  });

  it('every entry has article ∈ {un, une}', () => {
    for (const [word, data] of Object.entries(dict)) {
      expect(['un', 'une'], `${word}`).toContain(data.article);
    }
  });

  it('article agrees with gender (m↔un, f↔une)', () => {
    for (const [word, data] of Object.entries(dict)) {
      if (data.gender === 'm') expect(data.article, `${word}`).toBe('un');
      if (data.gender === 'f') expect(data.article, `${word}`).toBe('une');
    }
  });

  it('every feminine/masculine cross-reference points to an existing entry', () => {
    for (const [word, data] of Object.entries(dict)) {
      const partner = data.feminine || data.masculine;
      if (!partner) continue;
      if (partner === word) continue; // epicene (camarade, dentiste, etc.)
      expect(dict[partner], `partner of ${word} → ${partner}`).toBeDefined();
    }
  });

  it('partner entries have the opposite gender (when they differ from the key)', () => {
    for (const [word, data] of Object.entries(dict)) {
      const partner = data.feminine || data.masculine;
      if (!partner || partner === word) continue;
      const partnerEntry = dict[partner];
      if (!partnerEntry) continue;
      expect(partnerEntry.gender, `${word} ↔ ${partner}`).not.toBe(data.gender);
    }
  });

  it('level, if present, matches CEFR pattern', () => {
    for (const [word, data] of Object.entries(dict)) {
      if (data.level == null) continue;
      expect(data.level, `${word}`).toMatch(/^(A1|A2|B1|B2|C1|C2)$/);
    }
  });

  it('keys are lowercase', () => {
    for (const word of Object.keys(dict)) {
      expect(word, word).toBe(word.toLowerCase());
    }
  });

  it('contains well-known high-frequency nouns with correct gender', () => {
    const known = {
      chien:     { gender: 'm', article: 'un'  },
      chat:      { gender: 'm', article: 'un'  },
      fleur:     { gender: 'f', article: 'une' },
      école:     { gender: 'f', article: 'une' },
      étudiant:  { gender: 'm', article: 'un'  },
      maison:    { gender: 'f', article: 'une' },
      livre:     { gender: 'm', article: 'un'  },
      femme:     { gender: 'f', article: 'une' },
      homme:     { gender: 'm', article: 'un'  },
      eau:       { gender: 'f', article: 'une' },
    };
    for (const [word, expected] of Object.entries(known)) {
      expect(dict[word], word).toBeDefined();
      expect(dict[word].gender,  word).toBe(expected.gender);
      expect(dict[word].article, word).toBe(expected.article);
    }
  });

  it('has at least 1000 entries after expansion', () => {
    expect(Object.keys(dict).length).toBeGreaterThanOrEqual(1000);
  });
});
