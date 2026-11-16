export default function initNav() {
  const toggle = document.querySelector('.menu-toggle');
  if (!toggle) return;

  const setOpen = (open) => {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('nav-open')));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !document.body.classList.contains('nav-open')) return;
    setOpen(false);
    toggle.focus();
  });
}
