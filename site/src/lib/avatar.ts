// Small round hero portrait for browser-built lists (pickers, compare, team, box). Styled by .avatar in
// layouts/Base.astro; without art it is an empty tinted circle so rows stay aligned.
export function avatar(src: string | undefined, size = 32): HTMLElement {
  const box = document.createElement('span');
  box.className = 'avatar';
  box.style.setProperty('--size', `${size}px`);
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.loading = 'lazy';
    img.width = size;
    img.height = size;
    box.append(img);
  }
  return box;
}
