// The player's imported box, saved in this browser (IndexedDB). Nothing here is sent anywhere.
// Any page can read it with loadBox() and react to re-imports with onBoxChange(); later, Google sign-in
// can sync this same document.
import type { BoxAccessory, BoxGear, BoxHero, BoxPart } from './decode';

export const BOX_SCHEMA = 1;

export interface BoxDoc {
  schema: typeof BOX_SCHEMA;
  /** ISO time of the last import. */
  importedAt: string;
  /** Site data pack version the import was made against. */
  gameVersion: string;
  /** Per file: format byte and the game's revision counter. */
  files: Partial<Record<BoxPart, { formatVersion: number; revision: string; importedAt: string }>>;
  heroes: BoxHero[];
  gear: BoxGear[];
  accessories: BoxAccessory[];
}

const DB = 'invokers-companion';
const STORE = 'box';
const KEY = 'current';
const CHANNEL = 'invokers-box';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The saved box, or null if the player hasn't imported one (or storage is unavailable). */
export async function loadBox(): Promise<BoxDoc | null> {
  try {
    const doc = await run<BoxDoc | undefined>('readonly', (s) => s.get(KEY));
    return isBoxDoc(doc) ? doc : null;
  } catch {
    return null;
  }
}

export async function saveBox(doc: BoxDoc): Promise<void> {
  await run('readwrite', (s) => s.put(doc, KEY));
  announce();
}

export async function clearBox(): Promise<void> {
  await run('readwrite', (s) => s.delete(KEY));
  announce();
}

/** Calls back whenever the box is imported or deleted, in this tab or another one. */
export function onBoxChange(callback: () => void): () => void {
  const local = () => callback();
  window.addEventListener(CHANNEL, local);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
  channel?.addEventListener('message', local);
  return () => {
    window.removeEventListener(CHANNEL, local);
    channel?.close();
  };
}

function announce(): void {
  window.dispatchEvent(new Event(CHANNEL));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage('changed');
    channel.close();
  }
}

export function isBoxDoc(v: unknown): v is BoxDoc {
  const d = v as BoxDoc | null | undefined;
  return (
    !!d &&
    d.schema === BOX_SCHEMA &&
    Array.isArray(d.heroes) &&
    Array.isArray(d.gear) &&
    Array.isArray(d.accessories) &&
    typeof d.files === 'object'
  );
}
