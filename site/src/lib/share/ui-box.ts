// Behaviour for components/ShareBox.astro on the My box page.
import { getAccountState, onAccountChange } from '../account/state';
import { loadBox, onBoxChange } from '../box/store';
import { createShare, deleteShare, listMyShares, shareUrl } from './api';
import { boxSharePayload } from './payload';

export function startShareBox(): void {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const open = $<HTMLButtonElement>('share-open');
  const dialog = $<HTMLDialogElement>('share-dialog');
  if (!open || !dialog) return;
  const error = (text = '') => ($('share-error').textContent = text);

  async function refreshButton(): Promise<void> {
    open.hidden = getAccountState().status !== 'signed-in' || !(await loadBox());
  }

  async function renderList(): Promise<void> {
    const list = $('share-list');
    try {
      const rows = await listMyShares();
      if (!rows.length) {
        list.replaceChildren(Object.assign(document.createElement('li'), { className: 'muted', textContent: 'No links yet.' }));
        return;
      }
      list.replaceChildren(
        ...rows.map((row) => {
          const li = document.createElement('li');
          const a = Object.assign(document.createElement('a'), { href: shareUrl(row.id), textContent: row.title, target: '_blank' });
          const kind = row.kind === 'team' ? 'Team' : 'Box';
          const when = Object.assign(document.createElement('span'), {
            className: 'when',
            textContent: `${kind} · ${new Date(row.created_at).toLocaleDateString()}`,
          });
          const remove = Object.assign(document.createElement('button'), { className: 'remove', type: 'button', textContent: 'Delete' });
          remove.addEventListener('click', async () => {
            if (!confirm(`Delete the link "${row.title}"? Anyone who has it won't be able to open it any more.`)) return;
            try {
              await deleteShare(row.id);
              await renderList();
            } catch (e) {
              error(`Couldn't delete the link: ${(e as Error).message}`);
            }
          });
          li.append(a, when, remove);
          return li;
        }),
      );
    } catch (e) {
      error(`Couldn't load your links: ${(e as Error).message}`);
    }
  }

  open.addEventListener('click', () => {
    error();
    $('share-result').hidden = true;
    dialog.showModal();
    void renderList();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  $('share-create').addEventListener('click', async () => {
    const button = $<HTMLButtonElement>('share-create');
    error();
    const box = await loadBox();
    if (!box) return error('Import your box first.');
    button.disabled = true;
    try {
      const payload = boxSharePayload(box, {
        storage: $<HTMLInputElement>('share-storage').checked,
        equipment: $<HTMLInputElement>('share-equipment').checked,
      });
      const url = await createShare('box', $<HTMLInputElement>('share-name').value, payload);
      $<HTMLInputElement>('share-link').value = url;
      $('share-result').hidden = false;
      await renderList();
    } catch (e) {
      error(`Couldn't create the link: ${(e as Error).message}`);
    } finally {
      button.disabled = false;
    }
  });

  $('share-copy').addEventListener('click', async () => {
    const input = $<HTMLInputElement>('share-link');
    try {
      await navigator.clipboard.writeText(input.value);
      $('share-copy').textContent = 'Copied';
      setTimeout(() => ($('share-copy').textContent = 'Copy'), 1500);
    } catch {
      input.select();
    }
  });

  onAccountChange(() => void refreshButton());
  onBoxChange(() => void refreshButton());
  void refreshButton();
}
