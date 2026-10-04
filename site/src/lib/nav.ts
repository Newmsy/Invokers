// Site navigation, in the agreed order.
// Desktop: the top bar has News, then Database, Guides and Tools menus (entries by `group`), then the
// `header` entries as plain links, with My box as a button on the right.
// Phones: `tab` entries in the bottom bar; everything is on the More page, grouped the same way.
export type NavGroup = 'database' | 'guides' | 'tools' | 'site';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  header?: boolean;
  tab?: boolean;
  group?: NavGroup;
  /** Wide key art at the top of the section's page (lib/art bannerArt name). */
  banner?: string;
  /** One line for the menus, home page and More. */
  blurb?: string;
  /** Section picture as "kind:Name" (see lib/markdown-art), shown on the home cards, More and page headers. */
  art?: string;
}

import { heroes } from './data';

// The News pages come from their own work; the nav links them only once they exist, so the link checker stays green.
export const hasNews = Object.keys(import.meta.glob('../pages/news/index.astro')).length > 0;

export const nav: NavItem[] = [
  ...(hasNews
    ? [{ path: 'news', banner: 'campaign-progression', label: 'News', icon: 'refresh', header: true, art: 'item:Historic Playbook', blurb: 'Updates, events and Invoker spotlights' } satisfies NavItem]
    : []),
  // Database
  { path: 'heroes', banner: 'loading-screen', label: 'Invokers', icon: 'grid', tab: true, group: 'database', art: 'hero:Admiral Gladstone', blurb: `All ${heroes.length} Invokers with skills, stats and ratings` },
  { path: 'titans', banner: 'upgrade-titan', label: 'Titans', icon: 'grid', group: 'database', art: 'titan:Visciant', blurb: 'Every Titan, its Empowerment bonuses and skills' },
  { path: 'bosses', banner: 'collect-dungeon-titan', label: 'Bosses', icon: 'skull', group: 'database', art: 'item:Elder Titanheart', blurb: "How to beat each boss, with its dos and don'ts" },
  { path: 'effects', banner: 'collect-dungeon-essence', label: 'Status effects', icon: 'book', group: 'database', art: 'item:Rare Codex', blurb: 'Every buff, debuff and control effect, and who brings it' },
  { path: 'gear', banner: 'upgrade-relics', label: 'Gear sets', icon: 'shield', group: 'database', art: 'item:Gear Swap Pass', blurb: 'Every gear set and who should wear it' },
  { path: 'updates', banner: 'campaign-progression', label: 'Game updates', icon: 'refresh', group: 'database', art: 'item:Historic Playbook', blurb: 'What changed in each game update' },
  // Guides
  { path: 'guides', banner: 'novice-tournament', label: 'All guides', icon: 'book', group: 'guides', art: 'item:Legendary Codex', blurb: 'Every guide and article, by topic' },
  { path: 'tiers', banner: 'win-arena-medals', label: 'Tier lists', icon: 'tiers', header: true, group: 'guides', art: 'titan:Goros', blurb: 'The best Invokers and Titans for each mode and boss' },
  { path: 'ascension', banner: 'echo-legendary', label: 'Ascension and Awakening', icon: 'book', group: 'guides', art: 'item:5 star Echo', blurb: 'Star-up and awakening costs, and where materials drop' },
  { path: 'skill-costs', banner: 'upgrade-invoker', label: 'Skill costs', icon: 'book', group: 'guides', art: 'item:Rare Codex', blurb: 'What it costs to level skills, by rarity' },
  { path: 'gear-upgrades', banner: 'memorium', label: 'Gear upgrades and Memorium', icon: 'book', group: 'guides', art: 'item:Memorium', blurb: 'Gear upgrade gold, Memorium and selling' },
  { path: 'blog', banner: 'collect-dungeon-medals', label: 'Blog', icon: 'book', header: true, group: 'guides', art: 'item:Heroic Playbook', blurb: 'The numbers behind the game, in plain language' },
  // Tools
  { path: 'events', banner: 'energy', label: 'Events', icon: 'calendar', tab: true, group: 'tools', art: 'item:Energy', blurb: 'Event targets, energy planner and Arena Rush' },
  { path: 'summons', banner: 'summon-invoker', label: 'Summons', icon: 'star', tab: true, group: 'tools', art: 'item:Destiny Star', blurb: 'Summon rates and an odds calculator' },
  { path: 'packs', banner: 'gems', label: 'Pack value', icon: 'star', group: 'tools', art: 'item:Gems', blurb: 'Which paid packs give the most per £' },
  { path: 'trophies', banner: 'gold', label: 'Trophies', icon: 'trophy', group: 'tools', art: 'item:Gold Trophy', blurb: 'Trophy Room costs, bonuses and an upgrade planner' },
  { path: 'planner', banner: 'collect-dungeon-relics-1', label: 'Planner', icon: 'list', group: 'tools', art: 'item:Legendary Codex', blurb: 'Plan skill and gear upgrades for your own box' },
  { path: 'dps-simulator', banner: 'collect-dungeon-relics-2', label: 'DPS simulator', icon: 'grid', group: 'tools', art: 'hero:Ironblade Darus', blurb: 'Estimated damage per second and what each substat is worth' },
  { path: 'team', banner: 'clan-boss-1', label: 'Team builder', icon: 'grid', group: 'tools', art: 'titan:Vulkoz', blurb: 'Build a team and check its stats and mix' },
  { path: 'heroes/compare', banner: 'novice-tournament-2', label: 'Compare Invokers', icon: 'grid', group: 'tools', art: 'hero:Ironblade Darus', blurb: 'Put up to 4 Invokers side by side' },
  // Site
  { path: 'my-box', banner: 'stars', label: 'My box', icon: 'box', tab: true, group: 'site', art: 'item:Titanheart', blurb: 'Import your Invokers and gear, saved in your browser' },
  { path: 'about', label: 'About', icon: 'info', group: 'site' },
  { path: 'privacy', label: 'Privacy', icon: 'info', group: 'site' },
];

export const menus: { group: NavGroup; label: string; path: string }[] = [
  { group: 'database', label: 'Database', path: 'heroes' },
  { group: 'guides', label: 'Guides', path: 'guides' },
  { group: 'tools', label: 'Tools', path: 'events' },
];
export const inGroup = (g: NavGroup) => nav.filter((n) => n.group === g);
export const headerNav = nav.filter((n) => n.header);
export const myBox = nav.find((n) => n.path === 'my-box')!;
export const tabs: NavItem[] = [...nav.filter((n) => n.tab), { path: 'more', label: 'More', icon: 'menu' }];
