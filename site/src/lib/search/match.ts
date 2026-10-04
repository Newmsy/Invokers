// Search matching, shared by the search page (in the browser) and the tests.
// The index is small (a few hundred entries), so a plain scan is fast enough.

export type SearchKind = 'Invoker' | 'Titan' | 'Skill' | 'Item' | 'Gear set' | 'Boss' | 'Trophy' | 'Guide' | 'Page';

export interface SearchDoc {
  kind: SearchKind;
  title: string;
  /** Short line under the title, e.g. "Fire · Legendary". */
  sub?: string;
  /** Plain text matched against the query (and used for the snippet). */
  text?: string;
  /** Where the result links to. Items have no page of their own, so they have none. */
  url?: string;
  /** Portrait or icon URL shown next to the result. */
  image?: string;
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  /** A short excerpt of `text` around the first match, when the match was in the text. */
  snippet?: string;
}

/** Lower case, accents dropped, punctuation turned into spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%★+.]+/g, ' ')
    .replace(/(^|\s)\.+|\.+(\s|$)/g, ' ')
    .trim();
}

export function tokens(query: string): string[] {
  return normalize(query).split(' ').filter(Boolean);
}

// Kinds people most often look for come first when scores tie.
const kindRank: Record<SearchKind, number> = {
  Invoker: 0,
  Titan: 1,
  Boss: 1,
  'Gear set': 2,
  Trophy: 3,
  Item: 4,
  Skill: 5,
  Guide: 6,
  Page: 7,
};

// A leading "+" counts as part of the word boundary, so "20% atk" finds "+20% ATK".
const wordStart = (hay: string, t: string) =>
  hay.startsWith(t) || hay.includes(` ${t}`) || hay.startsWith(`+${t}`) || hay.includes(` +${t}`);

/**
 * Every query word must appear in the title, sub line or text (as the start of a word,
 * so "fro" finds "Frost"). Title matches outrank sub-line matches, which outrank text.
 */
export function search(docs: SearchDoc[], query: string, limit = 50): SearchHit[] {
  const words = tokens(query);
  if (words.length === 0) return [];
  const phrase = words.join(' ');
  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const title = normalize(doc.title);
    const sub = normalize(doc.sub ?? '');
    const text = normalize(doc.text ?? '');
    let score = 0;
    let inText = false;
    for (const w of words) {
      if (wordStart(title, w)) score += 10;
      else if (wordStart(sub, w)) score += 4;
      else if (wordStart(text, w)) {
        score += 1;
        inText = true;
      } else {
        score = -1;
        break;
      }
    }
    if (score < 0) continue;
    if (title === phrase) score += 30;
    else if (title.startsWith(phrase)) score += 15;
    hits.push({ doc, score, snippet: inText && doc.text ? snippet(doc.text, words) : undefined });
  }
  return hits
    .sort((a, b) => b.score - a.score || kindRank[a.doc.kind] - kindRank[b.doc.kind] || a.doc.title.localeCompare(b.doc.title))
    .slice(0, limit);
}

/** About 140 characters of `text` around the first query word found in it. */
export function snippet(text: string, words: string[], size = 140): string {
  const lower = text.toLowerCase();
  let at = -1;
  for (const w of words) {
    const m = new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).exec(lower);
    if (m) {
      at = m.index + m[1].length;
      break;
    }
  }
  if (at < 0 || text.length <= size) return text.length <= size ? text : `${text.slice(0, size).trimEnd()}…`;
  // Start at a word boundary a little before the match.
  let start = Math.max(0, at - 40);
  if (start > 0) start = text.indexOf(' ', start) + 1 || start;
  const end = Math.min(text.length, start + size);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
