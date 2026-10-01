// Browser-side hero search box used by the compare page and the team builder: type a name, pick from up
// to 8 matches with the mouse or the arrow keys and Enter.
import type { RosterHero } from './roster';

export interface PickerOptions {
  roster: RosterHero[];
  onPick: (hero: RosterHero) => void;
  /** Heroes that can't be picked right now (already chosen). */
  exclude?: () => Set<string>;
  /** Extra filter, e.g. "only heroes in my box". */
  filter?: () => ((h: RosterHero) => boolean) | null;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

export function attachPicker(input: HTMLInputElement, list: HTMLUListElement, opts: PickerOptions): void {
  let matches: RosterHero[] = [];
  let active = -1;

  function render() {
    const q = norm(input.value.trim());
    const taken = opts.exclude?.() ?? new Set<string>();
    const extra = opts.filter?.() ?? null;
    matches = q
      ? opts.roster
          .filter((h) => !taken.has(h.slug) && (!extra || extra(h)) && norm(h.name).includes(q))
          .sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)) || a.name.localeCompare(b.name))
          .slice(0, 8)
      : [];
    active = matches.length ? 0 : -1;
    list.replaceChildren(
      ...matches.map((h, i) => {
        const li = document.createElement('li');
        li.id = `${list.id}-${i}`;
        li.setAttribute('role', 'option');
        li.innerHTML = `<strong></strong><span></span>`;
        li.querySelector('strong')!.textContent = h.name;
        li.querySelector('span')!.textContent = `${h.rarity} · ${h.element} · ${h.cls}`;
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          pick(i);
        });
        return li;
      }),
    );
    if (q && !matches.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No match';
      list.append(li);
    }
    list.hidden = !q;
    input.setAttribute('aria-expanded', String(!list.hidden));
    highlight();
  }

  function highlight() {
    [...list.querySelectorAll('[role=option]')].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    if (active >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function pick(i: number) {
    const h = matches[i];
    if (!h) return;
    input.value = '';
    render();
    opts.onPick(h);
    input.focus();
  }

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-autocomplete', 'list');
  input.addEventListener('input', render);
  input.addEventListener('blur', () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  });
  input.addEventListener('focus', () => input.value && render());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!matches.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      highlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Escape') {
      input.value = '';
      render();
    }
  });
}
