const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// wrap each word so the headline can stagger in
function splitWords(node, counter = { n: 0 }) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      for (const part of child.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.append(part);
          continue;
        }
        const outer = document.createElement('span');
        const inner = document.createElement('span');
        outer.className = 'w';
        inner.style.setProperty('--i', counter.n++);
        inner.textContent = part;
        outer.append(inner);
        frag.append(outer);
      }
      child.replaceWith(frag);
    } else if (child.nodeType === Node.ELEMENT_NODE && !child.classList.contains('orb')) {
      splitWords(child, counter);
    }
  }
}

export default function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const h1 = hero.querySelector('.statement');
  if (h1) {
    h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
    splitWords(h1);
  }

  const img = hero.querySelector('.hero__media img');
  const start = () => requestAnimationFrame(() => hero.classList.add('is-in'));
  if (!img || img.complete) {
    start();
  } else {
    img.addEventListener('load', start);
    setTimeout(start, 1200);
  }

  if (reducedMotion()) return;

  const media = hero.querySelector('.hero__media');
  if (media) {
    let ticking = false;
    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = Math.min(window.scrollY, hero.offsetHeight);
          media.style.transform = `translate3d(0, ${y * 0.3}px, 0)`;
          ticking = false;
        });
      },
      { passive: true },
    );
  }

  const glow = hero.querySelector('.hero__glow');
  if (glow && window.matchMedia('(hover: hover)').matches) {
    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      glow.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
      glow.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  }
}
