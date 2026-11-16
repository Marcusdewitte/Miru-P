const KEY = 'miru-cookie-consent';
const listeners = new Set();
let fallback = null; // storage can throw (private mode, blocked site data)

export function getConsent() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.choice === 'accepted' || saved?.choice === 'declined') return saved.choice;
  } catch {}
  return fallback;
}

function saveConsent(choice) {
  fallback = choice;
  try {
    localStorage.setItem(KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
  } catch {}
  listeners.forEach((fn) => fn(choice));
}

export function onConsent(fn) {
  listeners.add(fn);
}

export default function initCookies() {
  const banner = document.getElementById('cookie-consent');
  if (!banner) return;

  const show = () => {
    banner.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('is-open')));
  };

  const hide = () => {
    banner.classList.remove('is-open');
    const done = () => {
      banner.hidden = true;
      banner.removeEventListener('transitionend', done);
    };
    banner.addEventListener('transitionend', done);
    setTimeout(done, 600); // no transitionend with reduced motion
  };

  banner.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cookie-choice]');
    if (!btn) return;
    saveConsent(btn.dataset.cookieChoice);
    hide();
  });

  // handy for a future "cookie settings" link
  window.cookieConsent = {
    get: getConsent,
    reset() {
      fallback = null;
      try {
        localStorage.removeItem(KEY);
      } catch {}
      show();
    },
  };

  if (!getConsent()) show();
}
