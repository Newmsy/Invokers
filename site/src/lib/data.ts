// Loads the data pack from ../data. The datamining side owns that folder and
// exports it; the site only reads it at build time.
import manifest from '../../../data/manifest.json';
import heroesJson from '../../../data/heroes.json';
import eventsJson from '../../../data/events.json';

export interface Manifest {
  gameVersion: string;
  extractedAt: string;
  schemaVersion: number;
}

// Only the fields the pages use so far. The full field tables live in schema/.
export interface Hero {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface GameEvent {
  id: string;
  name: string;
  [key: string]: unknown;
}

export const pack: Manifest = manifest;
export const heroes: Hero[] = heroesJson as Hero[];
export const events: GameEvent[] = eventsJson as GameEvent[];

/** Prefixes a site path with the deploy base (e.g. /invokers/ on GitHub Pages). */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
