// Services page: open a linked case study, highlight the current service in the index bar.
export default function initServices() {
  const openFromHash = () => {
    const id = location.hash.slice(1);
    const details = id && document.getElementById(id)?.querySelector('details');
    if (details) details.open = true;
  };
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  const links = document.querySelectorAll('.toc a');
  if (!links.length || !('IntersectionObserver' in window)) return;

  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) =>
          a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`),
        );
      }
    },
    { rootMargin: '-30% 0px -60% 0px' },
  );
  document.querySelectorAll('.service').forEach((s) => spy.observe(s));
}
