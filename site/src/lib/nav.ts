// Site navigation, in the agreed order.
// Desktop: `header` entries in the top bar, with My box as a button on the right.
// Phones: `tab` entries in the bottom bar; everything is on the More page.
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  header?: boolean;
  tab?: boolean;
  /** Section picture as "kind:Name" (see lib/markdown-art), shown on the home cards, More and page headers. */
  art?: string;
}

export const nav: NavItem[] = [
  { path: 'heroes', label: 'Invokers', icon: 'grid', header: true, tab: true, art: 'hero:Admiral Gladstone' },
  { path: 'effects', label: 'Status effects', icon: 'book', art: 'item:Rare Codex' },
  { path: 'tiers', label: 'Tier lists', icon: 'tiers', header: true, art: 'titan:Goros' },
  { path: 'events', label: 'Events', icon: 'calendar', header: true, tab: true, art: 'item:Energy' },
  { path: 'summons', label: 'Summons', icon: 'star', header: true, tab: true, art: 'item:Destiny Star' },
  { path: 'packs', label: 'Pack value', icon: 'star', art: 'item:Gems' },
  { path: 'gear', label: 'Gear', icon: 'shield', header: true, art: 'item:Gear Swap Pass' },
  { path: 'trophies', label: 'Trophies', icon: 'trophy', art: 'item:Gold Trophy' },
  { path: 'bosses', label: 'Bosses', icon: 'skull', header: true, art: 'item:Elder Titanheart' },
  { path: 'blog', label: 'Blog', icon: 'book', header: true, art: 'item:Heroic Playbook' },
  { path: 'planner', label: 'Planner', icon: 'list', art: 'item:Legendary Codex' },
  { path: 'skill-costs', label: 'Skill costs', icon: 'book', art: 'item:Rare Codex' },
  { path: 'ascension', label: 'Ascension and Awakening', icon: 'book', art: 'item:5 star Echo' },
  { path: 'gear-upgrades', label: 'Gear upgrades and Memorium', icon: 'book', art: 'item:Memorium' },
  { path: 'updates', label: 'Game updates', icon: 'refresh', art: 'item:Historic Playbook' },
  { path: 'heroes/compare', label: 'Compare Invokers', icon: 'grid', art: 'hero:Ironblade Darus' },
  { path: 'team', label: 'Team builder', icon: 'grid', art: 'titan:Vulkoz' },
  { path: 'my-box', label: 'My box', icon: 'box', tab: true, art: 'item:Titanheart' },
  { path: 'about', label: 'About', icon: 'info' },
  { path: 'privacy', label: 'Privacy', icon: 'info' },
];

export const headerNav = nav.filter((n) => n.header);
export const myBox = nav.find((n) => n.path === 'my-box')!;
export const tabs: NavItem[] = [...nav.filter((n) => n.tab), { path: 'more', label: 'More', icon: 'menu' }];
