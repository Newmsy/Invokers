// Creating, listing and opening share links. Players can only create and delete their own; anyone with a link
// can open that one share through get_share(), and nobody can list other people's (see supabase/migrations).
import { getClient } from '../account/client';
import { SHARE_ID, newShareId, type ShareKind } from './payload';

export interface ShareRow {
  id: string;
  kind: ShareKind;
  title: string;
  created_at: string;
}

export function shareUrl(id: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return new URL(`${base}share/?id=${id}`, window.location.origin).toString();
}

/** Saves a snapshot and returns its public link. The player must be signed in. */
export async function createShare(kind: ShareKind, title: string, payload: unknown): Promise<string> {
  const db = await getClient();
  const id = newShareId();
  const { error } = await db.from('shares').insert({ id, kind, title: title.trim().slice(0, 80) || 'Untitled', payload });
  if (error) throw new Error(error.message);
  return shareUrl(id);
}

export async function listMyShares(): Promise<ShareRow[]> {
  const db = await getClient();
  const { data, error } = await db.from('shares').select('id, kind, title, created_at').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ShareRow[];
}

export async function deleteShare(id: string): Promise<void> {
  const db = await getClient();
  const { error } = await db.from('shares').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export interface OpenedShare {
  kind: ShareKind;
  title: string;
  payload: unknown;
  created_at: string;
}

/** Opens a share by its link id, signed in or not. Null if it doesn't exist or was deleted. */
export async function getShare(id: string): Promise<OpenedShare | null> {
  if (!SHARE_ID.test(id)) return null;
  const db = await getClient();
  const { data, error } = await db.rpc('get_share', { share_id: id });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as OpenedShare | undefined) ?? null;
}
