// Markdown links to site pages are written from the site root ("/summons", "/heroes/ironblade-darus").
// This prefixes them with the deploy base so they still work when the site is served from a subpath.
export default function remarkBaseLinks({ base = '/' } = {}) {
  const prefix = base.replace(/\/$/, '');
  const walk = (node) => {
    if ((node.type === 'link' || node.type === 'definition') && /^\/(?!\/)/.test(node.url)) node.url = prefix + node.url;
    node.children?.forEach(walk);
  };
  return (tree) => {
    if (prefix) walk(tree);
  };
}
