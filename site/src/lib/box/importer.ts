// Turns the files a player picks (the game's snapshot files, or a backup) into a BoxDoc.
import {
  BOX_FILES,
  KNOWN_FORMAT,
  decodeAccessories,
  decodeGear,
  decodeHeroes,
  type BoxAccessory,
  type BoxGear,
  type BoxHero,
  type BoxPart,
  type StatRoll,
} from './decode';
import { BOX_SCHEMA, isBoxDoc, type BoxDoc } from './store';

export interface ImportResult {
  doc: BoxDoc;
  /** Which parts this import refreshed. */
  updated: BoxPart[];
  /** Things the player should know (e.g. a newer game format). */
  notes: string[];
}

const decoders = { heroes: decodeHeroes, gear: decodeGear, accessories: decodeAccessories };

/** Only these names are ever opened. Anything else in the folder, including the profile file, is never read. */
export function partFor(name: string): BoxPart | null {
  const lower = name.toLowerCase();
  for (const [part, file] of Object.entries(BOX_FILES) as [BoxPart, string][]) {
    if (lower === file.toLowerCase()) return part;
  }
  return null;
}

export class ImportError extends Error {}

/**
 * Decodes whichever of the three snapshot files were picked and merges them into the previous box,
 * so re-importing just the gear file keeps the saved invokers.
 */
export async function importSnapshots(files: File[], previous: BoxDoc | null, gameVersion: string): Promise<ImportResult> {
  const picked = new Map<BoxPart, File>();
  for (const f of files) {
    const part = partFor(f.name);
    if (part) picked.set(part, f);
  }
  if (picked.size === 0) {
    throw new ImportError(
      `None of the picked files is a box file. Pick ${Object.values(BOX_FILES).join(', ')} from the aggregate_snapshots folder.`,
    );
  }

  const now = new Date().toISOString();
  const doc: BoxDoc = previous
    ? { ...previous, files: { ...previous.files }, importedAt: now, gameVersion }
    : { schema: BOX_SCHEMA, importedAt: now, gameVersion, files: {}, heroes: [], gear: [], accessories: [] };
  const notes: string[] = [];
  const updated: BoxPart[] = [];

  for (const [part, file] of picked) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let snap;
    try {
      snap = decoders[part](bytes);
    } catch {
      throw new ImportError(
        `${file.name} couldn't be read. If the game updated recently, the site may not support the new format yet; ` +
          'otherwise close the game and try again.',
      );
    }
    if (snap.formatVersion !== KNOWN_FORMAT[part]) {
      notes.push(`${file.name} uses a newer file format (${snap.formatVersion}); double-check what was imported.`);
    }
    // TypeScript can't narrow the union of item arrays per key, so assign through a loose view.
    (doc as unknown as Record<BoxPart, unknown[]>)[part] = snap.items;
    doc.files[part] = { formatVersion: snap.formatVersion, revision: snap.revision, importedAt: now };
    updated.push(part);
  }
  return { doc, updated, notes };
}

/** Reads a backup made with "Download backup". */
export async function importBackup(file: File): Promise<BoxDoc> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new ImportError(`${file.name} isn't a backup file from this site.`);
  }
  if (!isBoxDoc(parsed) || !itemsLookRight(parsed)) throw new ImportError(`${file.name} isn't a backup file from this site.`);
  return parsed;
}

/** Spot-checks every item's shape, so a hand-edited backup can't break the views. */
function itemsLookRight(doc: BoxDoc): boolean {
  const roll = (s: unknown) => !!s && typeof (s as StatRoll).stat === 'string' && typeof (s as StatRoll).value === 'number';
  const item = (i: BoxGear | BoxAccessory) =>
    typeof i?.id === 'number' && typeof i.slot === 'string' && typeof i.rank === 'string' &&
    typeof i.rarity === 'string' && typeof i.level === 'number' &&
    (i.mainStat === null || roll(i.mainStat)) && Array.isArray(i.subStats) && i.subStats.every(roll);
  const hero = (h: BoxHero) =>
    typeof h?.id === 'number' && typeof h.configId === 'string' && typeof h.rank === 'string' &&
    typeof h.level === 'number' && typeof h.inStorage === 'boolean' && typeof h.awakenLevel === 'number' &&
    !!h.gearBySlot && typeof h.gearBySlot === 'object';
  return doc.heroes.every(hero) && doc.gear.every(item) && doc.accessories.every(item);
}
