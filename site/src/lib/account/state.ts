// Account state shared across the page without loading the Supabase client, so the My box page can show
// "synced to your account" while browser-only builds stay light.
import { accountsEnabled } from './config';

export interface AccountState {
  /** 'off' when this build has no accounts; 'loading' until the saved session has been checked. */
  status: 'off' | 'loading' | 'signed-out' | 'signed-in';
  email?: string;
  name?: string;
  sync: 'idle' | 'syncing' | 'synced' | 'unsynced' | 'error';
  /** Last sync problem, in words a player can act on. */
  error?: string;
}

const EVENT = 'invokers-account';
let state: AccountState = { status: accountsEnabled ? 'loading' : 'off', sync: 'idle' };

export function getAccountState(): AccountState {
  return state;
}

export function setAccountState(next: Partial<AccountState>): void {
  state = { ...state, ...next };
  window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));
}

export function onAccountChange(callback: (s: AccountState) => void): () => void {
  const listener = (e: Event) => callback((e as CustomEvent<AccountState>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
