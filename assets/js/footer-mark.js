// Footer logo: the orange dot can be dragged along the M (pointer + arrow keys).
const SAMPLES = 600;
const MAX_STEP = 0.06; // stops the dot jumping across the gap between the legs

export default function initFooterMark() {
  const svg = document.querySelector('.site-footer__symbol');
  const path = svg?.querySelector('path');
  const dot = svg?.querySelector('.sym-dot');
  if (!path || !dot || !path.getTotalLength) return;

  const total = path.getTotalLength();
  const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const p = path.getPointAtLength((total * i) / SAMPLES);
    return { x: p.x, y: p.y };
  });

  let t = 1;
  let dragging = false;

  const place = (next) => {
    t = Math.min(1, Math.max(0, next));
    const p = path.getPointAtLength(total * t);
    dot.setAttribute('transform', `translate(${p.x.toFixed(4)} ${p.y.toFixed(4)})`);
    const pct = Math.round(t * 100);
    dot.setAttribute('aria-valuenow', pct);
    dot.setAttribute(
      'aria-valuetext',
      pct === 0 ? 'Start of the M' : pct === 100 ? 'End of the M' : `${pct}% along the M`,
    );
  };

  const closest = (x, y, from = 0, to = SAMPLES) => {
    let best = from;
    let bestD = Infinity;
    for (let i = from; i <= to; i++) {
      const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best / SAMPLES;
  };

  const toSvg = (e) => {
    const m = svg.getScreenCTM();
    if (!m) return null;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  };

  const follow = (e) => {
    const p = toSvg(e);
    if (!p) return;
    let next = closest(p.x, p.y);
    if (Math.abs(next - t) > MAX_STEP) {
      const lo = Math.max(0, Math.floor((t - MAX_STEP) * SAMPLES));
      const hi = Math.min(SAMPLES, Math.ceil((t + MAX_STEP) * SAMPLES));
      next = closest(p.x, p.y, lo, hi);
    }
    place(next);
  };

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    svg.classList.remove('is-dragging');
    try {
      dot.releasePointerCapture(e.pointerId);
    } catch {}
  };

  dot.addEventListener('pointerdown', (e) => {
    dragging = true;
    dot.setPointerCapture(e.pointerId);
    svg.classList.add('is-dragging');
    e.preventDefault();
  });
  dot.addEventListener('pointermove', (e) => dragging && follow(e));
  dot.addEventListener('pointerup', end);
  dot.addEventListener('pointercancel', end);

  const steps = {
    ArrowRight: 0.02,
    ArrowUp: 0.02,
    ArrowLeft: -0.02,
    ArrowDown: -0.02,
    PageUp: 0.1,
    PageDown: -0.1,
  };
  dot.addEventListener('keydown', (e) => {
    if (e.key in steps) place(t + steps[e.key]);
    else if (e.key === 'Home') place(0);
    else if (e.key === 'End') place(1);
    else return;
    e.preventDefault();
  });

  place(1);
}
