import { describe, expect, it } from 'vitest';
import { dataDocs, pageDocs, plainText } from '../src/lib/search/dataIndex';
import { search, snippet } from '../src/lib/search/match';
import heroesJson from '../../data/heroes.json';
import itemsJson from '../../data/items.json';

const docs = [...dataDocs(), ...pageDocs()];

describe('search index', () => {
  it('has every kind of entry', () => {
    const kinds = new Set(docs.map((d) => d.kind));
    for (const k of ['Invoker', 'Skill', 'Item', 'Gear set', 'Boss', 'Trophy', 'Page']) expect(kinds).toContain(k);
  });

  it('shows no internal codes or markup', () => {
    const text = JSON.stringify(docs.map(({ url, ...rest }) => rest));
    const codes = [...(heroesJson as { id: string }[]).map((h) => h.id), ...(itemsJson as { id: string }[]).map((i) => i.id)]
      // Codes that are also plain English words (e.g. "Gold", "Crown") are fine.
      .filter((id) => /[_\d]|[a-z][A-Z]/.test(id));
    for (const id of codes) expect(text, id).not.toContain(id);
    expect(text).not.toMatch(/<sprite|<br|<color|TMP_|Booster_|GE_|VIP_|SI_/);
    // Code-style names such as "LifeStealByCombos".
    expect(text).not.toMatch(/\b[A-Z][a-z]+[A-Z][a-z]+[A-Z]\w*/);
    expect(text).not.toMatch(/datamin|config|extract|decod|game file/i);
  });

  it('links heroes and skills by name, not by code', () => {
    for (const d of docs) if (d.url) expect(d.url).not.toMatch(/LTS\d|[A-Z]{2,}\d{2,}/);
  });
});

describe('search', () => {
  const sample = [
    { kind: 'Invoker' as const, title: 'Ironblade Darus', sub: 'Earth · Rare' },
    { kind: 'Skill' as const, title: 'Iron Kick', sub: 'Ironblade Darus · Skill 1', text: 'Attacks 1 enemy.' },
    { kind: 'Gear set' as const, title: 'Frost Tolerance set', text: 'Frost freezes the target.' },
  ];

  it('needs every word, matching word starts', () => {
    expect(search(sample, 'iron').map((h) => h.doc.title)).toEqual(['Ironblade Darus', 'Iron Kick']);
    expect(search(sample, 'fro tol').map((h) => h.doc.title)).toEqual(['Frost Tolerance set']);
    expect(search(sample, 'ron')).toEqual([]);
    expect(search(sample, '  ')).toEqual([]);
  });

  it('puts exact titles first', () => {
    expect(search(sample, 'iron kick')[0].doc.title).toBe('Iron Kick');
  });

  it('snippets text matches', () => {
    expect(search(sample, 'freezes')[0].snippet).toBe('Frost freezes the target.');
    expect(snippet('x'.repeat(200) + ' needle ' + 'y'.repeat(200), ['needle'])).toMatch(/^….*needle.*…$/);
  });

  it('finds real data', () => {
    expect(search(docs, 'ulgorim')[0].doc.kind).toBe('Boss');
    expect(search(docs, 'vampire')[0].doc.kind).toBe('Gear set');
  });
});

describe('plainText', () => {
  it('turns star icons into ★', () => {
    expect(plainText('3<sprite name="TMP_TextIcons_Atlas_0"> Dragonsoul')).toBe('3★ Dragonsoul');
    expect(plainText('from 1 <sprite name="x"> to 2 <sprite name="x">')).toBe('from 1★ to 2★');
  });
});
