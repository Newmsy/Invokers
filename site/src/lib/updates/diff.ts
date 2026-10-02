// Compares two data packs (the previous game update's and the new one's) and lists what changed, in the shape
// the Updates page shows. Pure: no file or git access, so the CLI (scripts/update-notes.ts) and tests share it.
// Only fields the site shows are compared; internal-only fields are ignored on purpose.

export interface PackFiles {
  manifest: { gameVersion: string; extractedAt: string };
  heroes?: PackHero[];
  skills?: PackSkillSet[];
  skillCosts?: PackSkillCost[];
  sets?: PackSet[];
  items?: { id: string; name: string; description?: string }[];
  trophies?: { trophies: PackTrophy[] };
  bosses?: { bosses: PackBoss[] };
}

interface PackHero {
  id: string;
  name: string;
  rarity: string;
  faction: string;
  element: string;
  class: string;
  baseRank: string;
  maxStats: Record<string, number>;
  statsByRank?: Record<string, Record<string, Record<string, number>>>;
}

interface PackSkill {
  type: string;
  title: string | null;
  cooldown?: unknown;
  levels?: { level: number; text: string }[];
  empowerments?: { empowerment: number; text: string }[];
}

interface PackSkillSet {
  heroId: string;
  kind: string;
  name: string;
  skills: PackSkill[];
}

interface PackSkillCost {
  rarity: string;
  skill: string;
  toLevel: number;
  cost: Record<string, number>;
}

interface PackSet {
  id: string;
  name: string;
  bonuses: Record<string, { stat: string; statName: string; value: number }[]>;
}

interface PackTrophy {
  id: string;
  name: string;
  maxLevel: number;
  levels: { level: number; cost: { itemId: string; amount: number }[]; bonuses: { stat: string; value: number; valueType: string }[] }[];
}

interface PackBoss {
  id: string;
  name: string;
  element?: string;
  dos: string[];
  donts: string[];
  corruptions: string[];
  stages: { stage: number; energy: number }[];
}

/** One run of a text diff: unchanged text, or a changed span (either side may be empty). */
export type TextPart = { same: string } | { before: string; after: string };

export interface ValueChange {
  /** What changed, already in site wording, e.g. "HP" or "Rarity". */
  label: string;
  before: string;
  after: string;
}

export interface HeroRef {
  id: string;
  name: string;
  rarity?: string;
  element?: string;
}

export interface SkillChange {
  /** Skill slot, e.g. ActiveSkill1 or PassiveBonus. */
  type: string;
  title: string;
  status: 'added' | 'removed' | 'changed';
  renamedFrom?: string;
  /** Levels (or Titan empowerments) whose text changed, with the diff of the highest one. */
  levels?: number[];
  levelWord?: 'Level' | 'Empowerment';
  top?: { level: number; parts: TextPart[] };
  /** Max level before → after, when it changed. */
  maxLevel?: { before: number; after: number };
}

export interface UpdateNotes {
  from: string;
  to: string;
  /** Date the new data was taken (YYYY-MM-DD). */
  date: string;
  heroes: {
    added: HeroRef[];
    removed: HeroRef[];
    changed: (HeroRef & { changes: ValueChange[]; growthChanged?: boolean })[];
  };
  skills: (HeroRef & { kind: string; changes: SkillChange[] })[];
  skillCosts: { rarity: string; skill: string; toLevel: number; before: string; after: string }[];
  sets: { added: string[]; removed: string[]; changed: { name: string; changes: ValueChange[] }[] };
  items: { added: string[]; removed: string[]; renamed: { before: string; after: string }[] };
  trophies: { name: string; changes: ValueChange[] }[];
  bosses: { added: string[]; removed: string[]; changed: { name: string; changes: ValueChange[] }[] };
}

const statLabels: Record<string, { label: string; percent?: boolean }> = {
  hp: { label: 'HP' },
  atk: { label: 'ATK' },
  def: { label: 'DEF' },
  critRate: { label: 'Crit Rate', percent: true },
  critDmg: { label: 'Crit DMG', percent: true },
  acc: { label: 'ACC' },
  res: { label: 'RES' },
  instinct: { label: 'Instinct' },
  comboSpeed: { label: 'Combo Speed' },
  skillSpeed: { label: 'Skill Speed' },
  skillRecovery: { label: 'Skill Recovery' },
  manaGen: { label: 'Mana Generation' },
  runSpeed: { label: 'Movement Speed' },
};

/** Percent values are stored as fractions; round away float noise like 0.05000000074. */
export function fmt(value: number, percent?: boolean): string {
  if (percent) return `${Math.round(value * 10000) / 100}%`;
  return (Math.round(value * 100) / 100).toLocaleString('en-GB');
}

const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

const byKey = <T>(list: T[] | undefined, key: (t: T) => string) => new Map((list ?? []).map((t) => [key(t), t]));

/** Game rich text → plain words: tags dropped, <br> as a space. */
export function plainText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word-level diff of two strings, grouped into unchanged and changed runs. */
export function diffText(before: string, after: string): TextPart[] {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  // LCS table over tokens (skill texts are short, so the n*m table is fine).
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const parts: TextPart[] = [];
  let sameBuf = '';
  let beforeBuf = '';
  let afterBuf = '';
  const flushChange = () => {
    if (beforeBuf || afterBuf) parts.push({ before: beforeBuf, after: afterBuf });
    beforeBuf = afterBuf = '';
  };
  const flushSame = () => {
    if (sameBuf) parts.push({ same: sameBuf });
    sameBuf = '';
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flushChange();
      sameBuf += a[i];
      i++;
      j++;
    } else {
      flushSame();
      if (j < b.length && (i >= a.length || lcs[i][j + 1] >= lcs[i + 1][j])) afterBuf += b[j++];
      else beforeBuf += a[i++];
    }
  }
  flushChange();
  flushSame();
  return parts;
}

function diffHeroes(prev: PackFiles, next: PackFiles): UpdateNotes['heroes'] {
  const before = byKey(prev.heroes, (h) => h.id);
  const after = byKey(next.heroes, (h) => h.id);
  const ref = (h: PackHero): HeroRef => ({ id: h.id, name: h.name, rarity: h.rarity, element: h.element });
  const result: UpdateNotes['heroes'] = { added: [], removed: [], changed: [] };
  if (!prev.heroes || !next.heroes) return result;

  for (const [id, h] of after) if (!before.has(id)) result.added.push(ref(h));
  for (const [id, h] of before) if (!after.has(id)) result.removed.push(ref(h));
  for (const [id, h] of after) {
    const old = before.get(id);
    if (!old) continue;
    const changes: ValueChange[] = [];
    const fields: [keyof PackHero, string][] = [
      ['name', 'Name'],
      ['rarity', 'Rarity'],
      ['faction', 'Faction'],
      ['element', 'Element'],
      ['class', 'Class'],
      ['baseRank', 'Starting rank'],
    ];
    for (const [key, label] of fields)
      if (String(old[key]) !== String(h[key])) changes.push({ label, before: String(old[key]), after: String(h[key]) });
    for (const [key, { label, percent }] of Object.entries(statLabels)) {
      const o = old.maxStats?.[key];
      const n = h.maxStats?.[key];
      if (typeof o === 'number' && typeof n === 'number' && !same(o, n))
        changes.push({ label: `Max ${label}`, before: fmt(o, percent), after: fmt(n, percent) });
    }
    // Growth at lower ranks and levels can move without the max changing; flag it rather than list every step.
    const growthChanged =
      !!old.statsByRank && !!h.statsByRank && JSON.stringify(old.statsByRank) !== JSON.stringify(h.statsByRank);
    if (changes.length || growthChanged) result.changed.push({ ...ref(h), changes, ...(growthChanged ? { growthChanged } : {}) });
  }
  return result;
}

function skillLevels(s: PackSkill): { n: number; text: string }[] {
  if (s.empowerments) return s.empowerments.map((e) => ({ n: e.empowerment, text: e.text }));
  return (s.levels ?? []).map((l) => ({ n: l.level, text: l.text }));
}

const slotNames: Record<string, string> = {
  ActiveSkill1: 'Skill 1',
  ActiveSkill2: 'Skill 2',
  ActiveSkill3: 'Skill 3',
  PassiveBonus: 'Passive',
};

function skillTitle(s: PackSkill): string {
  return s.title ?? slotNames[s.type] ?? s.type;
}

function diffSkill(old: PackSkill, s: PackSkill): SkillChange | undefined {
  const change: SkillChange = { type: s.type, title: skillTitle(s), status: 'changed' };
  if (old.title !== s.title) change.renamedFrom = skillTitle(old);
  const before = new Map(skillLevels(old).map((l) => [l.n, plainText(l.text)]));
  const after = skillLevels(s).map((l) => ({ n: l.n, text: plainText(l.text) }));
  const changed = after.filter((l) => before.has(l.n) && before.get(l.n) !== l.text);
  if (changed.length) {
    const top = changed[changed.length - 1];
    change.levels = changed.map((l) => l.n);
    change.levelWord = s.empowerments ? 'Empowerment' : 'Level';
    change.top = { level: top.n, parts: diffText(before.get(top.n)!, top.text) };
  }
  const maxBefore = Math.max(0, ...before.keys());
  const maxAfter = Math.max(0, ...after.map((l) => l.n));
  if (maxBefore !== maxAfter) change.maxLevel = { before: maxBefore, after: maxAfter };
  return change.renamedFrom || change.levels || change.maxLevel ? change : undefined;
}

function diffSkills(prev: PackFiles, next: PackFiles): UpdateNotes['skills'] {
  if (!prev.skills || !next.skills) return [];
  const before = byKey(prev.skills, (s) => s.heroId);
  const result: UpdateNotes['skills'] = [];
  for (const set of next.skills) {
    const old = before.get(set.heroId);
    // A brand-new hero's skills are covered by "new Invokers".
    if (!old) continue;
    const oldSkills = byKey(old.skills, (s) => s.type);
    const newTypes = new Set(set.skills.map((s) => s.type));
    const changes: SkillChange[] = [];
    for (const s of set.skills) {
      const o = oldSkills.get(s.type);
      if (!o) changes.push({ type: s.type, title: skillTitle(s), status: 'added' });
      else {
        const c = diffSkill(o, s);
        if (c) changes.push(c);
      }
    }
    for (const o of old.skills)
      if (!newTypes.has(o.type)) changes.push({ type: o.type, title: skillTitle(o), status: 'removed' });
    if (changes.length) result.push({ id: set.heroId, name: set.name, kind: set.kind, changes });
  }
  return result;
}

function costText(cost: Record<string, number> | undefined, itemName: (id: string) => string): string {
  if (!cost) return 'none';
  return Object.entries(cost)
    .map(([id, n]) => `${n.toLocaleString('en-GB')} ${itemName(id)}`)
    .join(', ');
}

function diffSkillCosts(prev: PackFiles, next: PackFiles, itemName: (id: string) => string): UpdateNotes['skillCosts'] {
  if (!prev.skillCosts || !next.skillCosts) return [];
  const key = (c: PackSkillCost) => `${c.rarity}|${c.skill}|${c.toLevel}`;
  const before = byKey(prev.skillCosts, key);
  const after = byKey(next.skillCosts, key);
  const result: UpdateNotes['skillCosts'] = [];
  for (const k of new Set([...before.keys(), ...after.keys()])) {
    const o = before.get(k);
    const n = after.get(k);
    if (JSON.stringify(o?.cost) === JSON.stringify(n?.cost)) continue;
    const c = (n ?? o)!;
    result.push({
      rarity: c.rarity,
      skill: c.skill,
      toLevel: c.toLevel,
      before: costText(o?.cost, itemName),
      after: costText(n?.cost, itemName),
    });
  }
  return result;
}

// Some set stats have no display name in the pack (the name is the stat key); give those plain names.
const setStatNames: Record<string, string> = {
  LifeStealByOtherSkills: 'Lifesteal from skills',
  LifeStealByCombos: 'Lifesteal from combos',
  IncreaseHealingDone: 'Healing done',
  IncreaseShieldDone: 'Shield size',
  RunSpeedBonusOutOfCombat: 'Move SPD out of combat',
};

function setStatName(b: { stat: string; statName: string }): string {
  if (b.statName !== b.stat) return b.statName;
  return setStatNames[b.stat] ?? b.stat.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

function diffSets(prev: PackFiles, next: PackFiles): UpdateNotes['sets'] {
  const result: UpdateNotes['sets'] = { added: [], removed: [], changed: [] };
  if (!prev.sets || !next.sets) return result;
  const before = byKey(prev.sets, (s) => s.id);
  const after = byKey(next.sets, (s) => s.id);
  for (const [id, s] of after) if (!before.has(id)) result.added.push(s.name);
  for (const [id, s] of before) if (!after.has(id)) result.removed.push(s.name);
  const bonusText = (list: PackSet['bonuses'][string] | undefined) =>
    list?.length
      ? list.map((b) => `${setStatName(b)} +${fmt(b.value, b.stat.endsWith('Percent') || !Number.isInteger(b.value))}`).join(', ')
      : 'none';
  for (const [id, s] of after) {
    const old = before.get(id);
    if (!old) continue;
    const changes: ValueChange[] = [];
    if (old.name !== s.name) changes.push({ label: 'Name', before: old.name, after: s.name });
    for (const pieces of [...new Set([...Object.keys(old.bonuses), ...Object.keys(s.bonuses)])].sort((x, y) => +x - +y)) {
      const o = bonusText(old.bonuses[pieces]);
      const n = bonusText(s.bonuses[pieces]);
      if (o !== n) changes.push({ label: `${pieces}-piece bonus`, before: o, after: n });
    }
    if (changes.length) result.changed.push({ name: s.name, changes });
  }
  return result;
}

function diffItems(prev: PackFiles, next: PackFiles): UpdateNotes['items'] {
  const result: UpdateNotes['items'] = { added: [], removed: [], renamed: [] };
  if (!prev.items || !next.items) return result;
  const before = byKey(prev.items, (i) => i.id);
  const after = byKey(next.items, (i) => i.id);
  // Items still without an English name show only their key; leave those out.
  const named = (i: { id: string; name: string }) => !!i.name && !(i.name === i.id && /_|[a-z][A-Z]/.test(i.name));
  for (const [id, i] of after) {
    const old = before.get(id);
    if (!named(i)) continue;
    if (!old) result.added.push(i.name);
    else if (named(old) && old.name !== i.name) result.renamed.push({ before: old.name, after: i.name });
  }
  for (const [id, i] of before) if (!after.has(id) && named(i)) result.removed.push(i.name);
  return result;
}

function diffTrophies(prev: PackFiles, next: PackFiles, itemName: (id: string) => string): UpdateNotes['trophies'] {
  if (!prev.trophies || !next.trophies) return [];
  const before = byKey(prev.trophies.trophies, (t) => t.id);
  const result: UpdateNotes['trophies'] = [];
  for (const t of next.trophies.trophies) {
    const old = before.get(t.id);
    if (!old) {
      result.push({ name: t.name, changes: [{ label: 'Trophy', before: 'none', after: 'new' }] });
      continue;
    }
    const changes: ValueChange[] = [];
    if (old.maxLevel !== t.maxLevel) changes.push({ label: 'Max level', before: String(old.maxLevel), after: String(t.maxLevel) });
    const oldLevels = byKey(old.levels, (l) => String(l.level));
    for (const l of t.levels) {
      const o = oldLevels.get(String(l.level));
      if (!o) continue;
      const cost = (c: typeof l.cost) => costText(Object.fromEntries(c.map((x) => [x.itemId, x.amount])), itemName);
      if (cost(o.cost) !== cost(l.cost)) changes.push({ label: `Level ${l.level} cost`, before: cost(o.cost), after: cost(l.cost) });
      const bonus = (b: typeof l.bonuses) => b.map((x) => `+${fmt(x.value, x.valueType === 'percent')}`).join(', ');
      if (bonus(o.bonuses) !== bonus(l.bonuses))
        changes.push({ label: `Level ${l.level} bonus`, before: bonus(o.bonuses), after: bonus(l.bonuses) });
    }
    if (changes.length) result.push({ name: t.name, changes });
  }
  return result;
}

function diffBosses(prev: PackFiles, next: PackFiles): UpdateNotes['bosses'] {
  const result: UpdateNotes['bosses'] = { added: [], removed: [], changed: [] };
  if (!prev.bosses || !next.bosses) return result;
  const label = (b: PackBoss) => (b.element ? `${b.name} (${b.element})` : b.name);
  const before = byKey(prev.bosses.bosses, (b) => b.id);
  const after = byKey(next.bosses.bosses, (b) => b.id);
  for (const [id, b] of after) if (!before.has(id)) result.added.push(label(b));
  for (const [id, b] of before) if (!after.has(id)) result.removed.push(label(b));
  for (const [id, b] of after) {
    const old = before.get(id);
    if (!old) continue;
    const changes: ValueChange[] = [];
    const list = (l: string[]) => l.map(plainText).join(' / ') || 'none';
    if (list(old.corruptions) !== list(b.corruptions))
      changes.push({ label: 'Corruptions', before: list(old.corruptions), after: list(b.corruptions) });
    if (list(old.dos) !== list(b.dos)) changes.push({ label: 'Tips: do', before: list(old.dos), after: list(b.dos) });
    if (list(old.donts) !== list(b.donts)) changes.push({ label: "Tips: don't", before: list(old.donts), after: list(b.donts) });
    const oldStages = byKey(old.stages, (s) => String(s.stage));
    for (const s of b.stages) {
      const o = oldStages.get(String(s.stage));
      if (o && o.energy !== s.energy) changes.push({ label: `Stage ${s.stage} energy`, before: String(o.energy), after: String(s.energy) });
    }
    if (old.stages.length !== b.stages.length)
      changes.push({ label: 'Stages', before: String(old.stages.length), after: String(b.stages.length) });
    if (changes.length) result.changed.push({ name: label(b), changes });
  }
  return result;
}

export function diffPacks(prev: PackFiles, next: PackFiles): UpdateNotes {
  const names = new Map([...(prev.items ?? []), ...(next.items ?? [])].map((i) => [i.id, i.name]));
  const itemName = (id: string) => names.get(id) ?? id;
  return {
    from: prev.manifest.gameVersion,
    to: next.manifest.gameVersion,
    date: next.manifest.extractedAt,
    heroes: diffHeroes(prev, next),
    skills: diffSkills(prev, next),
    skillCosts: diffSkillCosts(prev, next, itemName),
    sets: diffSets(prev, next),
    items: diffItems(prev, next),
    trophies: diffTrophies(prev, next, itemName),
    bosses: diffBosses(prev, next),
  };
}

/** Number of separate changes, for summaries. */
export function changeCount(n: UpdateNotes): number {
  return (
    n.heroes.added.length +
    n.heroes.removed.length +
    n.heroes.changed.length +
    n.skills.reduce((t, h) => t + h.changes.length, 0) +
    n.skillCosts.length +
    n.sets.added.length +
    n.sets.removed.length +
    n.sets.changed.length +
    n.items.added.length +
    n.items.removed.length +
    n.items.renamed.length +
    n.trophies.length +
    n.bosses.added.length +
    n.bosses.removed.length +
    n.bosses.changed.length
  );
}
