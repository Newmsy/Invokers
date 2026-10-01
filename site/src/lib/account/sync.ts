// Signs players in with Supabase Auth and keeps their saved box in step with one row in the `boxes` table.
// Row-level security means each player can only read and write their own row (see supabase/migrations).
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { isBoxDoc, loadBox, saveBox, type BoxDoc } from '../box/store';
import { getClient } from './client';
import type { Provider } from './config';
import { decide } from './reconcile';
import { setAccountState } from './state';

const TABLE = 'boxes';
let userId: string | null = null;
/** True while this module writes the local box itself, so that write isn't echoed back to the account. */
let applyingRemote = false;

const markerKey = (uid: string) => `invokers-sync:${uid}`;
function getMarker(uid: string): string | null {
  try {
    return localStorage.getItem(markerKey(uid));
  } catch {
    return null;
  }
}
function setMarker(uid: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(markerKey(uid));
    else localStorage.setItem(markerKey(uid), value);
  } catch {
    // Private mode or blocked storage: sync still works, it just can't remember the last sync.
  }
}

function failure(err: unknown): string {
  const text = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  if (/fetch|network/i.test(text)) return "Couldn't reach the account server. Check your connection and try again.";
  return `Sync failed: ${text}`;
}

async function remoteStamp(db: SupabaseClient, uid: string): Promise<{ importedAt: string } | null> {
  const { data, error } = await db.from(TABLE).select('imported_at').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data ? { importedAt: data.imported_at as string } : null;
}

async function upload(db: SupabaseClient, uid: string, doc: BoxDoc): Promise<void> {
  const { error } = await db.from(TABLE).upsert({ user_id: uid, doc, imported_at: doc.importedAt });
  if (error) throw error;
  setMarker(uid, doc.importedAt);
}

async function download(db: SupabaseClient, uid: string): Promise<void> {
  const { data, error } = await db.from(TABLE).select('doc').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  if (!data || !isBoxDoc(data.doc)) throw new Error('the saved box in your account is from a newer version of the site');
  const doc = data.doc as BoxDoc;
  setMarker(uid, doc.importedAt);
  applyingRemote = true;
  try {
    await saveBox(doc);
  } finally {
    applyingRemote = false;
  }
}

async function reconcile(force = false): Promise<void> {
  if (!userId) return;
  const uid = userId;
  setAccountState({ sync: 'syncing', error: undefined });
  try {
    const db = await getClient();
    const [local, remote] = await Promise.all([loadBox(), remoteStamp(db, uid)]);
    let action = decide(local, remote, getMarker(uid));
    if (force && local && action === 'none' && !remote) action = 'upload';
    if (action === 'upload' && local) await upload(db, uid, local);
    if (action === 'download') await download(db, uid);
    // Not synced only when this browser keeps a box the account doesn't have.
    const unsynced = action === 'none' && !!local && !remote;
    setAccountState({ sync: unsynced ? 'unsynced' : local || remote ? 'synced' : 'idle' });
  } catch (err) {
    setAccountState({ sync: 'error', error: failure(err) });
  }
}

/** Runs after the player imports, restores or deletes their box in this tab. */
async function onLocalChange(): Promise<void> {
  if (!userId || applyingRemote) return;
  const uid = userId;
  setAccountState({ sync: 'syncing', error: undefined });
  try {
    const db = await getClient();
    const local = await loadBox();
    if (local) {
      if (local.importedAt !== getMarker(uid)) await upload(db, uid, local);
      setAccountState({ sync: 'synced' });
    } else {
      // Deleting the box while signed in deletes the account copy too (the My box page says so).
      const { error } = await db.from(TABLE).delete().eq('user_id', uid);
      if (error) throw error;
      setMarker(uid, null);
      setAccountState({ sync: 'idle' });
    }
  } catch (err) {
    setAccountState({ sync: 'error', error: failure(err) });
  }
}

function applySession(session: Session | null): void {
  const user = session?.user ?? null;
  const changed = (user?.id ?? null) !== userId;
  userId = user?.id ?? null;
  if (!user) {
    setAccountState({ status: 'signed-out', email: undefined, name: undefined, sync: 'idle', error: undefined });
    return;
  }
  const meta = user.user_metadata ?? {};
  setAccountState({
    status: 'signed-in',
    email: user.email,
    name: (meta.full_name || meta.name || meta.user_name || undefined) as string | undefined,
  });
  if (changed) void reconcile();
}

let started = false;

/** Restores the saved session (including one just returned from Google or Discord) and starts syncing. */
export async function startAccount(): Promise<void> {
  if (started) return;
  started = true;
  // The box store fires this window event only in the tab that made the change.
  window.addEventListener('invokers-box', () => void onLocalChange());
  try {
    const db = await getClient();
    db.auth.onAuthStateChange((_event, session) => {
      // Supabase asks for no awaiting inside this callback.
      setTimeout(() => applySession(session), 0);
    });
    const { data } = await db.auth.getSession();
    applySession(data.session);
  } catch (err) {
    setAccountState({ status: 'signed-out', sync: 'error', error: failure(err) });
  }
}

export async function signIn(provider: Provider): Promise<void> {
  const db = await getClient();
  const redirectTo = window.location.href.split('#')[0];
  const { error } = await db.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) setAccountState({ error: failure(error) });
}

/** Signs out. The box stays saved in this browser. */
export async function signOut(): Promise<void> {
  const db = await getClient();
  await db.auth.signOut();
}

export function syncNow(): Promise<void> {
  return reconcile(true);
}

/**
 * Removes everything the account holds: the saved box and the sign-in itself. The copy in this browser stays,
 * and the player can delete it on the My box page.
 */
export async function deleteAccount(): Promise<void> {
  const uid = userId;
  if (!uid) return;
  const db = await getClient();
  const { error } = await db.rpc('delete_my_account');
  if (error) {
    setAccountState({ error: `Couldn't delete your account: ${error.message}` });
    return;
  }
  setMarker(uid, null);
  await db.auth.signOut({ scope: 'local' });
}
