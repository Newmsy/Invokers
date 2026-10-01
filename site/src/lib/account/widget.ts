// Behaviour for the header account button and panel (components/Account.astro).
import { PROVIDER_LABELS, type Provider } from './config';
import { getAccountState, onAccountChange, setAccountState, type AccountState } from './state';
import { deleteAccount, signIn, signOut, startAccount, syncNow } from './sync';

const SYNC_TEXT: Record<AccountState['sync'], string> = {
  idle: 'No box saved yet. Import one on the My box page and it will sync here.',
  syncing: 'Syncing your box…',
  synced: 'Your box is synced to this account.',
  unsynced: 'This browser has a box your account doesn\'t. Press "Sync now" to save it to your account.',
  error: '',
};

export function startWidget(): void {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const button = $<HTMLButtonElement>('account-button');
  const dialog = $<HTMLDialogElement>('account-dialog');
  if (!button || !dialog) return;

  function render(s: AccountState): void {
    const signedIn = s.status === 'signed-in';
    dialog.querySelector<HTMLElement>('[data-when="signed-out"]')!.hidden = signedIn;
    dialog.querySelector<HTMLElement>('[data-when="signed-in"]')!.hidden = !signedIn;
    $('account-error').textContent = s.error ?? '';
    if (!signedIn) {
      button.replaceChildren(s.status === 'loading' ? 'Account' : 'Sign in');
      return;
    }
    const who = s.name || s.email || 'your account';
    $('account-who').textContent = s.email && s.name ? `${s.name} (${s.email})` : who;
    $('account-sync').textContent = SYNC_TEXT[s.sync];
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = who.trim().charAt(0).toUpperCase();
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = s.name?.split(' ')[0] || 'Account';
    const dot = document.createElement('span');
    dot.className = `dot ${s.sync}`;
    dot.title = s.sync === 'error' ? 'Sync problem' : SYNC_TEXT[s.sync];
    button.replaceChildren(avatar, label, dot);
    button.setAttribute('aria-label', `Account: ${who}`);
  }

  button.addEventListener('click', () => dialog.showModal());
  // Clicking the backdrop closes the panel.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  for (const el of dialog.querySelectorAll<HTMLButtonElement>('[data-provider]')) {
    el.addEventListener('click', () => {
      const provider = el.dataset.provider as Provider;
      el.disabled = true;
      el.textContent = `Opening ${PROVIDER_LABELS[provider]}…`;
      void signIn(provider);
    });
  }
  $('account-sync-now').addEventListener('click', () => void syncNow());
  $('account-sign-out').addEventListener('click', () => void signOut().then(() => dialog.close()));
  $('account-delete').addEventListener('click', async () => {
    const ok = confirm(
      'Delete your account? This removes your saved box and your sign-in from our servers. ' +
        'The copy of your box in this browser stays until you delete it on the My box page.',
    );
    if (!ok) return;
    setAccountState({ error: undefined });
    await deleteAccount();
    if (!getAccountState().error) dialog.close();
  });

  onAccountChange(render);
  render(getAccountState());
  void startAccount();
}
