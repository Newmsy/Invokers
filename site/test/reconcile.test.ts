import { describe, expect, it } from 'vitest';
import { decide } from '../src/lib/account/reconcile';
import { parseProviders } from '../src/lib/account/config';

const at = (importedAt: string) => ({ importedAt });
const OLD = '2026-10-01T10:00:00.000Z';
const NEW = '2026-10-01T12:00:00.000Z';

describe('box sync', () => {
  it('does nothing when there is no box anywhere', () => {
    expect(decide(null, null, null)).toBe('none');
  });
  it('downloads the account box onto a fresh browser', () => {
    expect(decide(null, at(OLD), null)).toBe('download');
  });
  it('uploads a browser box the account has never seen', () => {
    expect(decide(at(OLD), null, null)).toBe('upload');
  });
  it("doesn't re-upload a box that was deleted from the account on another device", () => {
    expect(decide(at(OLD), null, OLD)).toBe('none');
  });
  it('does nothing when both copies match', () => {
    expect(decide(at(OLD), at(OLD), null)).toBe('none');
  });
  it('takes the account copy when only the other device re-imported', () => {
    expect(decide(at(OLD), at(NEW), OLD)).toBe('download');
  });
  it('uploads when only this browser changed, even to an older backup', () => {
    expect(decide(at(OLD), at(NEW), NEW)).toBe('upload');
  });
  it('keeps the newer import when both changed', () => {
    expect(decide(at(NEW), at(OLD), null)).toBe('upload');
    expect(decide(at(OLD), at(NEW), '2026-09-01T00:00:00.000Z')).toBe('download');
  });
});

describe('sign-in providers', () => {
  it('defaults to Google and Discord', () => {
    expect(parseProviders(undefined)).toEqual(['google', 'discord']);
  });
  it('ignores unknown names and spacing', () => {
    expect(parseProviders(' Discord, myspace ,github')).toEqual(['discord', 'github']);
  });
});
