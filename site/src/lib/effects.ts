// Buffs, debuffs and other effects that skills apply, for the effects glossary, the Invoker filter and the links in
// skill texts. Each description restates what the skills themselves say about the effect.
import { heroes, ratingFor, skillsFor, titans, type Hero } from './data';
import { rarityOrder } from './format';
import { tierNames } from './tiers/lists';
import type { TitanInfo } from './tiers/candidates';

export type EffectGroup = 'Control' | 'Damage over time' | 'Debuffs' | 'Buffs' | 'Protection' | 'Support';

export interface Effect {
  slug: string;
  name: string;
  group: EffectGroup;
  /** One line on what it does. */
  text: string;
  /** Matches a skill that applies it, in plain text. Bracketed effects ("[45% DEF Down]") are matched when cast. */
  match: RegExp;
  /** Bracketed in skill texts, so it can be linked there. */
  bracketed: boolean;
}

export const effectGroups: EffectGroup[] = ['Control', 'Damage over time', 'Debuffs', 'Buffs', 'Protection', 'Support'];

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const cast = (name: string) => new RegExp(`[Cc]asts? (?:an? )?\\[[^\\]]*?\\b${name}\\]`);

function bracket(name: string, group: EffectGroup, text: string): Effect {
  return { slug: slugOf(name), name, group, text, match: cast(name), bracketed: true };
}
function action(name: string, group: EffectGroup, text: string, match: RegExp): Effect {
  return { slug: slugOf(name), name, group, text, match, bracketed: false };
}

const down = (stat: string, what = stat) => bracket(`${stat} Down`, 'Debuffs', `Lowers the target's ${what}.`);
const up = (stat: string, what = stat) => bracket(`${stat} Up`, 'Buffs', `Raises the target's ${what}.`);

export const effects: Effect[] = [
  bracket('Stun', 'Control', "Can't move or use Skills. Skill cooldowns keep running."),
  bracket('Freeze', 'Control', "Can't move or use Skills and takes 75% damage from attacks. Skill cooldowns stop."),
  bracket('Shock', 'Control', "Can't move or use Skills and takes 125% damage from attacks. Skill cooldowns keep running."),
  bracket('Chain', 'Control', "Can't move, but can still use Skills and Invoke Titans."),
  bracket('Taunt', 'Control', 'Forced to attack the caster with Combo Attacks only until it ends.'),
  bracket('Blind', 'Control', 'More likely to miss Combo Attacks, which then deal no damage.'),
  bracket('Disable', 'Control', 'Blocks Active Skills.'),
  bracket('Suppression', 'Control', 'Blocks the Ultimate Skill.'),
  bracket('Titanblock', 'Control', 'Blocks Invoking Titans.'),
  bracket('Mindworm', 'Control', 'Stops Passive Skills from activating.'),
  action('Launch', 'Control', 'Throws targets into the air for a set time, sometimes knocking them away.', /\bLaunches\b/),
  action('Push', 'Control', 'Knocks the target a set distance away.', /\bPushes\b/),
  action('Pull', 'Control', 'Drags enemies to the caster.', /\bPulls\b/),

  bracket('Burn', 'Damage over time', "Deals a share of the target's MAX HP every 2s, capped by the caster's ATK."),
  bracket('Bleed', 'Damage over time', "Deals a share of the target's MAX HP every 2s, capped by the caster's ATK."),

  bracket('Weaken', 'Debuffs', 'Increases all damage the target takes.'),
  bracket('Heal Reduction', 'Debuffs', 'Shrinks all heals the target receives.'),
  bracket('Hex', 'Debuffs', "A target that dies under Hex can't be revived."),
  bracket('Block Revive', 'Debuffs', "A target killed under it can't be revived."),
  bracket('Jinx', 'Debuffs', 'Blocks the target from receiving buffs.'),
  down('ATK'),
  down('DEF'),
  down('RES'),
  down('ACC'),
  down('Crit Rate', 'Crit Rate'),
  down('Crit DMG', 'Crit Damage'),
  down('Combo SPD', 'Combo Speed'),
  down('Skill SPD', 'Skill Speed'),
  down('Move SPD', 'Move Speed'),
  down('Skill Recovery'),
  action('Steal buffs', 'Debuffs', 'Takes buffs from the target.', /\bSteals [^.]*buffs/),
  action('Remove buffs', 'Debuffs', 'Strips buffs from enemies.', /\bRemoves [^.]*\bbuffs? from/),
  action('Transfer debuffs', 'Debuffs', 'Moves debuffs onto the target.', /\bTransfers [^.]*debuffs/),
  action('Extend debuffs', 'Debuffs', 'Makes debuffs on the target last longer.', /\bExtends the duration of [^.]*debuffs/),

  up('ATK'),
  up('DEF'),
  up('RES'),
  up('ACC'),
  up('Crit Rate', 'Crit Rate'),
  up('Crit DMG', 'Crit Damage'),
  up('Combo SPD', 'Combo Speed'),
  up('Skill SPD', 'Skill Speed'),
  up('Move SPD', 'Move Speed'),
  up('Skill Recovery'),

  bracket('Shield', 'Protection', "Absorbs damage. Its size depends on the caster's damage dealt and MAX HP."),
  bracket('HP Shield', 'Protection', 'Absorbs a set amount of damage.'),
  bracket('Harden', 'Protection', 'Reduces all damage the target takes.'),
  bracket('Deflection', 'Protection', 'Redirects a share of incoming damage onto the caster.'),
  bracket('Reflect Damage', 'Protection', 'Returns a share of incoming damage to the attacker.'),
  bracket('Damage Filter', 'Protection', 'Blocks every hit below a set amount of damage.'),
  bracket('Immunity', 'Protection', 'Protects against a number of debuffs.'),
  bracket('Willpower', 'Protection', 'Protects against a number of Control debuffs.'),
  bracket('Evasion', 'Protection', 'More likely to evade Combo Attacks and take no damage.'),
  bracket('Unkillable', 'Protection', "Can't be killed while it lasts."),
  bracket('Invincibility', 'Protection', 'Blocks all incoming damage.'),

  action('Heal', 'Support', 'Restores HP.', /\bHeals\b/),
  bracket('Regeneration', 'Support', 'Heals the target every 2s.'),
  bracket('Lifeboost', 'Support', 'Raises current and MAX HP for a while; HP stays at the same percentage when it ends.'),
  action('Revive', 'Support', 'Brings dead allies back with part of their HP.', /\bRevives\b/),
  action('Cleanse', 'Support', 'Removes debuffs from allies.', /\bRemoves [^.]*debuffs from/),
];

export const effectBySlug = new Map(effects.map((e) => [e.slug, e]));

// Skill text at its highest level, as plain text.
const plain = (t: string) => t.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

function effectsOf(id: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const s of skillsFor(id)) {
    const text = plain(s.levels?.at(-1)?.text ?? '');
    if (!text) continue;
    for (const e of effects) {
      if (e.match.test(text)) found.set(e.slug, [...(found.get(e.slug) ?? []), s.type]);
    }
  }
  return found;
}

/** Effect slug → skill types, per hero or Titan id. */
const byId = new Map<string, Map<string, string[]>>([...heroes.map((h) => h.id), ...titans.map((t) => t.id)].map((id) => [id, effectsOf(id)]));

/** Effects in this hero's or Titan's kit, in glossary order. */
export function effectsFor(id: string): Effect[] {
  const found = byId.get(id);
  return found ? effects.filter((e) => found.has(e.slug)) : [];
}

/** Skill types (ActiveSkill1, Combo, …) of this hero or Titan that apply the effect. */
export function skillsWith(id: string, slug: string): string[] {
  return byId.get(id)?.get(slug) ?? [];
}

// Best-rated first, then by rarity and name.
const rank = (h: Hero) => {
  const t = ratingFor(h.id)?.tier as (typeof tierNames)[number] | undefined;
  return (t && tierNames.includes(t) ? tierNames.indexOf(t) : tierNames.length) * 10 + rarityOrder.indexOf(h.rarity);
};

/** Invokers whose kit applies the effect, best first. */
export function heroesWith(slug: string): Hero[] {
  return heroes.filter((h) => byId.get(h.id)?.has(slug)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function titansWith(slug: string): TitanInfo[] {
  return titans.filter((t) => byId.get(t.id)?.has(slug));
}

// Longest names first, so "HP Shield" wins over "Shield".
const linkable = effects.filter((e) => e.bracketed).sort((a, b) => b.name.length - a.name.length);
const bracketRe = new RegExp(`\\[([^\\]<]*?)(${linkable.map((e) => e.name).join('|')})\\]`, 'g');
const slugByName = new Map(linkable.map((e) => [e.name, e.slug]));

/** Links each bracketed effect in skill HTML (from richText) to its glossary entry. */
export function linkEffects(html: string, hrefFor: (slug: string) => string): string {
  return html.replace(bracketRe, (_, pre: string, name: string) => `[${pre}<a class="effect-link" href="${hrefFor(slugByName.get(name)!)}">${name}</a>]`);
}
