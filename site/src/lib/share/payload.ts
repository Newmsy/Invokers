// What a share link holds. Only what the player ticked is copied in; nothing else from their box is uploaded.
import type { BoxAccessory, BoxGear, BoxHero } from '../box/decode';
import type { BoxDoc } from '../box/store';

export type ShareKind = 'box' | 'team';

/** A snapshot of part of a box, taken when the link is made. */
export interface BoxShare {
  schema: 1;
  importedAt: string;
  gameVersion: string;
  heroes: BoxHero[];
  /** Only gear and accessories worn by the shared invokers, and only if the player chose to share them. */
  gear: BoxGear[];
  accessories: BoxAccessory[];
}

/** A team from the team builder. Hero ids are data pack ids (heroes.json "id"), which don't change with URLs. */
export interface TeamDoc {
  schema: 1;
  name: string;
  gameVersion: string;
  heroes: { id: string; note?: string }[];
}

export interface BoxShareOptions {
  /** Include invokers kept in storage. */
  storage: boolean;
  /** Include the gear and accessories the shared invokers are wearing. */
  equipment: boolean;
}

export function boxSharePayload(doc: BoxDoc, opts: BoxShareOptions): BoxShare {
  const heroes = doc.heroes
    .filter((h) => opts.storage || !h.inStorage)
    .map((h) => (opts.equipment ? h : { ...h, gearBySlot: {}, accessoryBySlot: {} }));
  const ids = new Set(heroes.map((h) => h.id));
  const worn = <T extends { equippedHeroId: number | null }>(items: T[]) =>
    opts.equipment ? items.filter((i) => i.equippedHeroId !== null && ids.has(i.equippedHeroId)) : [];
  return {
    schema: 1,
    importedAt: doc.importedAt,
    gameVersion: doc.gameVersion,
    heroes,
    gear: worn(doc.gear),
    accessories: worn(doc.accessories),
  };
}

export function isBoxShare(v: unknown): v is BoxShare {
  const d = v as BoxShare | null;
  return !!d && d.schema === 1 && Array.isArray(d.heroes) && Array.isArray(d.gear) && Array.isArray(d.accessories);
}

export function isTeamDoc(v: unknown): v is TeamDoc {
  const d = v as TeamDoc | null;
  return (
    !!d &&
    d.schema === 1 &&
    typeof d.name === 'string' &&
    Array.isArray(d.heroes) &&
    d.heroes.every((h) => !!h && typeof h.id === 'string')
  );
}

/** 12 random URL-safe characters (72 bits): long enough that links can't be guessed. */
export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}

export const SHARE_ID = /^[A-Za-z0-9_-]{12}$/;
