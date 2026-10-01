// Change notes for each game update, written by scripts/update-notes.ts into src/data/updates/<version>.json.
import type { UpdateNotes } from './diff';

const files = import.meta.glob<UpdateNotes>('../../data/updates/*.json', { eager: true, import: 'default' });

/** Compares versions like 0.61.1516 part by part, as numbers. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Every update's notes, newest first. */
export const updates: UpdateNotes[] = Object.values(files).sort((a, b) => compareVersions(b.to, a.to));

/** Anchor for an update on the Updates page, e.g. "v0-61-1516". */
export function updateAnchor(version: string): string {
  return `v${version.replace(/[^0-9a-z]+/gi, '-')}`;
}
