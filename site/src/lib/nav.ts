// Site navigation, in the agreed order (Gear joins when its page exists).
// Desktop: `header` entries in the top bar, with My box as a button on the right.
// Phones: `tab` entries in the bottom bar; everything is on the More page.
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  header?: boolean;
  tab?: boolean;
}

export const nav: NavItem[] = [
  { path: 'heroes', label: 'Invokers', icon: 'grid', header: true, tab: true },
  { path: 'events', label: 'Events', icon: 'calendar', header: true, tab: true },
  { path: 'summons', label: 'Summons', icon: 'star', header: true, tab: true },
  { path: 'trophies', label: 'Trophies', icon: 'trophy', header: true },
  { path: 'bosses', label: 'Bosses', icon: 'skull', header: true },
  { path: 'blog', label: 'Blog', icon: 'book', header: true },
  { path: 'planner', label: 'Planner', icon: 'list' },
  { path: 'skill-costs', label: 'Skill costs', icon: 'book' },
  { path: 'ascension', label: 'Ascension and Awakening', icon: 'book' },
  { path: 'gear-upgrades', label: 'Gear upgrades and Memorium', icon: 'book' },
  { path: 'updates', label: 'Game updates', icon: 'refresh' },
  { path: 'heroes/compare', label: 'Compare Invokers', icon: 'grid' },
  { path: 'team', label: 'Team builder', icon: 'grid' },
  { path: 'my-box', label: 'My box', icon: 'box', tab: true },
  { path: 'about', label: 'About', icon: 'info' },
  { path: 'privacy', label: 'Privacy', icon: 'info' },
];

export const headerNav = nav.filter((n) => n.header);
export const myBox = nav.find((n) => n.path === 'my-box')!;
export const tabs: NavItem[] = [...nav.filter((n) => n.tab), { path: 'more', label: 'More', icon: 'menu' }];
