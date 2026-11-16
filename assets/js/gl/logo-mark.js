// Header logo: the mark draws itself in 3D, then tilts towards the pointer.
export default function initLogoMark() {
  const INK = 0xf4f1ea,
    GROUND = 0x0e1b2c,
    ACCENT = 0xe8590c;
  function pathPoints(T) {
    const pts = [];
    function push(x, y) {
      const l = pts[pts.length - 1];
      if (l && Math.abs(l.x - x) < 1e-4 && Math.abs(l.y - y) < 1e-4) return;
      pts.push(new T.Vector3(x, y, 0));
    }
    function line(x0, y0, x1, y1, n) {
      for (let i = 0; i <= n; i++) push(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
    }
    function arc(cx, cy, r, a0, a1, n) {
      for (let i = 0; i <= n; i++) {
        const t = a0 + ((a1 - a0) * i) / n;
        push(cx + r * Math.cos(t), cy + r * Math.sin(t));
      }
    }
    const PI = Math.PI;
    line(0, 0, 0, 2, 12);
    arc(1, 2, 1, PI, 0, 40);
    line(2, 2, 2, 0.42, 12);
    arc(2.42, 0.42, 0.42, PI, 2 * PI, 20);
    line(2.84, 0.42, 2.84, 2, 12);
    arc(3.84, 2, 1, PI, 0, 40);
    line(4.84, 2, 4.84, -1.15, 16);
    const cx = 2.42 + 0.08,
      cy = 0.92;
    pts.forEach((p) => {
      const x = p.x;
      p.x -= cx;
      p.y -= cy;
      p.z = 0.55 * Math.sin((x - 2.42) * 0.75);
    });
    return pts;
  }
  function setup() {
    const T = window.THREE;
    const host = document.querySelector('.logo__mark');
    if (!T || !host) return;
    const canvas = host.querySelector('canvas');
    if (!canvas) return;
    let renderer;
    try {
      renderer = new T.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
    } catch (e) {
      return;
    }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const size = host.clientWidth || 46;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(28, 1, 0.1, 100);
    const tf = Math.tan((28 * Math.PI) / 180 / 2);
    camera.position.set(0, 0, (6.2 / 2 / tf) * 1.08);
    scene.add(new T.AmbientLight(0xffffff, 0.75));
    const key = new T.DirectionalLight(0xffffff, 1.1);
    key.position.set(-4, 6, 8);
    scene.add(key);
    const group = new T.Group();
    scene.add(group);
    const curve = new T.CatmullRomCurve3(pathPoints(T), false, 'centripetal', 0.5);
    const hullMat = new T.MeshBasicMaterial({
      color: INK,
      side: T.BackSide,
    });
    const coreMat = new T.MeshStandardMaterial({
      color: GROUND,
      roughness: 0.55,
    });
    const accMat = new T.MeshStandardMaterial({
      color: ACCENT,
      roughness: 0.35,
      metalness: 0.05,
    });
    const RIN = 0.17,
      ROUT = 0.33;
    const hull = new T.Mesh(new T.TubeGeometry(curve, 320, ROUT, 20, false), hullMat);
    const core = new T.Mesh(new T.TubeGeometry(curve, 320, RIN, 20, false), coreMat);
    group.add(hull, core);
    function sph(r, m, p) {
      const s = new T.Mesh(new T.SphereGeometry(r, 24, 16), m);
      s.position.copy(p);
      return s;
    }
    const start = curve.getPoint(0);
    group.add(sph(ROUT, hullMat, start), sph(RIN, coreMat, start));
    const dot = new T.Group();
    dot.position.copy(curve.getPoint(1));
    dot.add(sph(0.48, hullMat, new T.Vector3()), sph(0.35, accMat, new T.Vector3()));
    group.add(dot);
    const tip = new T.Group();
    tip.add(sph(ROUT, hullMat, new T.Vector3()), sph(RIN, coreMat, new T.Vector3()));
    group.add(tip);
    const count = core.geometry.index.count;
    const t0 = performance.now(),
      DRAW = reduce ? 0 : 1600;
    const target = {
        x: 0,
        y: 0,
      },
      cur = {
        x: 0,
        y: 0,
      };
    let running = false;
    function ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function frame(now) {
      const e = DRAW ? ease(Math.max(0, Math.min(1, (now - t0) / DRAW))) : 1;
      const n = Math.floor((count * e) / 6) * 6;
      hull.geometry.setDrawRange(0, n);
      core.geometry.setDrawRange(0, n);
      tip.visible = e < 1;
      if (e < 1) tip.position.copy(curve.getPoint(e));
      const pop = DRAW ? Math.max(0, Math.min(1, (now - t0 - DRAW + 120) / 420)) : 1;
      dot.scale.setScalar(Math.max(0.0001, pop < 1 ? pop * (1 + 0.3 * Math.sin(pop * Math.PI)) : 1));
      cur.x += (target.x - cur.x) * 0.1;
      cur.y += (target.y - cur.y) * 0.1;
      group.rotation.x = cur.x;
      group.rotation.y = cur.y;
      renderer.render(scene, camera);
      const settled =
        e >= 1 && pop >= 1 && Math.abs(target.x - cur.x) < 0.001 && Math.abs(target.y - cur.y) < 0.001;
      if (settled) {
        running = false;
        return;
      }
      requestAnimationFrame(safeFrame);
    }
    function safeFrame(now) {
      try {
        frame(now);
      } catch (err) {
        running = false;
        host.classList.remove('is-live');
      }
    }
    function kick() {
      if (!running) {
        running = true;
        requestAnimationFrame(safeFrame);
      }
    }
    const logo = host.closest('.logo') || host;
    if (!reduce) {
      logo.addEventListener('pointermove', (ev) => {
        const r = host.getBoundingClientRect();
        target.y = Math.max(-1, Math.min(1, (ev.clientX - (r.left + r.width / 2)) / 60)) * 0.7;
        target.x = Math.max(-1, Math.min(1, (ev.clientY - (r.top + r.height / 2)) / 60)) * 0.45;
        kick();
      });
      logo.addEventListener('pointerleave', () => {
        target.x = 0;
        target.y = 0;
        kick();
      });
    }
    host.classList.add('is-live');
    kick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
}
