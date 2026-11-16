// Fresh page loads start at the top (or at the #section). Back/forward keeps the browser's restore.
export default function startAtTop() {
  const [nav] = performance.getEntriesByType?.('navigation') ?? [];
  if (nav?.type === 'back_forward') return;

  let touched = false;
  for (const type of ['wheel', 'touchmove', 'keydown', 'mousedown']) {
    window.addEventListener(type, () => (touched = true), { passive: true, once: true });
  }

  const place = () => {
    if (touched) return;
    const id = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
    const target = id && document.getElementById(id);
    if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  place();
  document.addEventListener('DOMContentLoaded', place);
  window.addEventListener('load', () => {
    place();
    setTimeout(place, 120); // late layout shifts (fonts, images)
  });
  window.addEventListener('pageshow', (e) => e.persisted && place());
}
