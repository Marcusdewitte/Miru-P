// Home page "expansion stories": cards tip over one by one as you scroll through the section.
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (k) => k * k * (3 - 2 * k);

// card falls flat with a small settle at the end
function fallAngle(t) {
  const u = clamp01(t);
  const land = 0.78;
  if (u <= land) {
    const k = u / land;
    return -90 * k ** 3;
  }
  const k = (u - land) / (1 - land);
  return -90 + 6 * Math.sin(Math.PI * k) * (1 - k);
}

// the waiting deck shuffles forward in steps, not continuously
function deckAdvance(p) {
  const i = Math.floor(p);
  return i + smoothstep(clamp01((p - i - 0.28) / 0.6));
}

export default function initStories() {
  const section = document.querySelector('[data-tumble]');
  if (!section) return;

  const scene = section.querySelector('.tumble__scene');
  const cards = section.querySelectorAll('.tumble__card');
  const bar = section.querySelector('.tumble__bar span');
  const n = cards.length;
  const DEPTH = 4;
  const ASPECT = 4 / 3;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let gap = 60;
  let pos = 0;
  let target = 0;
  let active = -1;
  let running = false;
  let last = 0;

  section.style.setProperty('--n', n);

  const pose = (k, p) => {
    const t = p - k;
    const lift = (k - Math.floor(p) + 3) * 0.6;
    if (t >= 1) return { angle: -90, z: 0, lift, opacity: t < 3 ? 1 : 0, flat: true };
    if (t > 0) return { angle: fallAngle(t), z: 0, lift, opacity: 1, flat: false };
    const rel = k - deckAdvance(p);
    return { angle: 0, z: -Math.max(rel, 0), lift: 0, opacity: clamp01(DEPTH + 1 - rel), flat: false };
  };

  const paint = () => {
    cards.forEach((el, k) => {
      const p = pose(k, pos);
      el.style.transform = `translate3d(0, ${-p.lift}px, ${p.z * gap}px) rotateX(${p.angle}deg)`;
      el.style.opacity = p.opacity;
      el.style.visibility = p.opacity > 0 ? 'visible' : 'hidden';
      el.style.pointerEvents = k === Math.round(pos) ? 'auto' : 'none';
      el.style.setProperty('--td-shade', p.flat ? 0.08 : (-p.angle / 90) * 0.08);
    });

    // only the front card is tabbable
    const now = Math.min(n - 1, Math.max(0, Math.round(pos)));
    if (now !== active) {
      cards[active]?.setAttribute('tabindex', '-1');
      cards[now].removeAttribute('tabindex');
      active = now;
    }
    bar?.style.setProperty('--p', n > 1 ? pos / (n - 1) : 1);
  };

  const fit = () => {
    const W = scene.clientWidth;
    const H = scene.clientHeight;
    const h = Math.max(80, Math.min((W * (W < 640 ? 0.74 : 0.46)) / ASPECT, H * 0.5, 480));
    const top = H * 0.5 - 0.62 * h;
    gap = 0.24 * h;
    scene.style.perspective = `${6 * h}px`;
    scene.style.perspectiveOrigin = `50% ${top - 1.66 * h}px`;
    scene.style.setProperty('--td-w', `${h * ASPECT}px`);
    scene.style.setProperty('--td-h', `${h}px`);
    scene.style.setProperty('--td-top', `${top}px`);
    paint();
  };

  const progress = () => {
    const total = section.offsetHeight - window.innerHeight;
    return total > 0 ? clamp01(-section.getBoundingClientRect().top / total) : 0;
  };

  const tick = (time) => {
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
    last = time;
    pos += (target - pos) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - pos) < 0.002) {
      pos = target;
      running = false;
      last = 0;
    }
    paint();
    if (running) requestAnimationFrame(tick);
  };

  const onScroll = () => {
    target = progress() * (n - 1);
    if (still) {
      pos = target;
      paint();
    } else if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    fit();
    onScroll();
  });
  fit();
  target = pos = progress() * (n - 1);
  paint();
}
