// Decides which copy of the box wins when a signed-in player has one in this browser and one in their account.
// Boxes are compared by importedAt; `marker` is the importedAt this browser last synced, so we can tell
// which side changed since then.

export type SyncAction = 'none' | 'upload' | 'download';

interface Stamp {
  importedAt: string;
}

export function decide(local: Stamp | null, remote: Stamp | null, marker: string | null): SyncAction {
  if (!local && !remote) return 'none';
  if (!local) return 'download';
  if (!remote) {
    // This browser's box was synced and the account copy is gone: it was deleted on another device,
    // so don't quietly put it back. "Sync now" still uploads on purpose.
    return marker === local.importedAt ? 'none' : 'upload';
  }
  if (local.importedAt === remote.importedAt) return 'none';
  if (local.importedAt === marker) return 'download';
  if (remote.importedAt === marker) return 'upload';
  // Both changed since the last sync (or never synced): the newer import wins.
  return Date.parse(remote.importedAt) > Date.parse(local.importedAt) ? 'download' : 'upload';
}
