// Hero: drifting light motes + pointer halo over the photo.
export default function initHeroField() {
  const canvas = document.querySelector('.hero__gl');
  const hero = document.querySelector('.hero');
  if (!canvas || !hero || !window.THREE) return;
  const THREE = window.THREE;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
  } catch (e) {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const COUNT = window.innerWidth < 720 ? 700 : 1600;
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    const x = (Math.pow(Math.random(), 0.7) * 2 - 0.6) * 9;
    pos[i * 3] = x;
    pos[i * 3 + 1] = (Math.random() * 2 - 1) * 5.5;
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * 4;
    seed[i * 4] = 0.08 + Math.random() * 0.22;
    seed[i * 4 + 1] = Math.random() < 0.06 ? 3.2 + Math.random() * 3 : 0.8 + Math.random() * 1.8;
    seed[i * 4 + 2] = Math.random() * Math.PI * 2;
    seed[i * 4 + 3] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const uniforms = {
    uTime: {
      value: 0,
    },
    uPixel: {
      value: renderer.getPixelRatio(),
    },
    uPointer: {
      value: new THREE.Vector2(0, 0),
    },
    uFade: {
      value: 0,
    },
  };
  const motes = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: [
        'attribute vec4 seed;',
        'uniform float uTime; uniform float uPixel; uniform vec2 uPointer;',
        'varying float vAlpha; varying float vWarm;',
        'void main(){',
        '  vec3 p = position;',
        '  float t = uTime * seed.x;',
        '  p.y = mod(p.y + t + 5.5, 11.0) - 5.5;',
        '  p.x += sin(uTime * 0.21 + seed.z) * 0.35 + uPointer.x * (0.25 + p.z * 0.06);',
        '  p.z += cos(uTime * 0.17 + seed.z) * 0.25;',
        '  p.y += uPointer.y * (0.15 + p.z * 0.04);',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  float edge = smoothstep(5.5, 3.5, abs(p.y));',
        '  float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + seed.x * 3.0) + seed.z);',
        '  vAlpha = edge * twinkle;',
        '  vWarm = seed.w;',
        '  gl_PointSize = seed.y * uPixel * (42.0 / -mv.z);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform float uFade;',
        'varying float vAlpha; varying float vWarm;',
        'void main(){',
        '  float d = length(gl_PointCoord - 0.5);',
        '  float a = smoothstep(0.5, 0.0, d);',
        '  a *= a;',
        '  vec3 amber = mix(vec3(0.95, 0.60, 0.22), vec3(1.0, 0.86, 0.62), vWarm);',
        '  gl_FragColor = vec4(amber, a * vAlpha * 0.85 * uFade);',
        '}',
      ].join('\n'),
    }),
  );
  scene.add(motes);
  const haloUniforms = {
    uTime: {
      value: 0,
    },
    uFade: {
      value: 0,
    },
  };
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.ShaderMaterial({
      uniforms: haloUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader:
        'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform float uTime; uniform float uFade; varying vec2 vUv;',
        'void main(){',
        '  float d = length(vUv - 0.5) * 2.0;',
        '  float breathe = 0.85 + 0.15 * sin(uTime * 1.2566);',
        '  float a = pow(max(1.0 - d, 0.0), 2.2) * 0.38 * breathe;',
        '  gl_FragColor = vec4(0.91, 0.53, 0.16, a * uFade);',
        '}',
      ].join('\n'),
    }),
  );
  halo.position.set(2.6, -0.6, -1.5);
  scene.add(halo);
  let visibleW = 1,
    visibleH = 1;
  function fit() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    visibleH = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    visibleW = visibleH * camera.aspect;
    motes.scale.set(Math.max(1, visibleW / 14), Math.max(1, visibleH / 9), 1);
  }
  const target = new THREE.Vector2(0, 0),
    haloTarget = new THREE.Vector2(2.6, -0.6);
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    target.set(nx, ny);
    haloTarget.set(nx * visibleW * 0.5, ny * visibleH * 0.5);
  });
  hero.addEventListener('pointerleave', () => {
    target.set(0, 0);
    haloTarget.set(2.6, -0.6);
  });
  let running = false,
    onScreen = true,
    last = 0,
    t = 0,
    fade = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    t += dt;
    fade = Math.min(1, fade + dt / 2.2);
    const e = 1 - Math.pow(1 - fade, 3);
    uniforms.uTime.value = t;
    haloUniforms.uTime.value = t;
    uniforms.uFade.value = e;
    haloUniforms.uFade.value = e;
    uniforms.uPointer.value.lerp(target, 0.035);
    halo.position.x += (haloTarget.x - halo.position.x) * 0.03;
    halo.position.y += (haloTarget.y - halo.position.y) * 0.03;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || still || !onScreen || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
  }
  fit();
  window.addEventListener('resize', () => {
    fit();
    if (still) renderStill();
  });
  function renderStill() {
    uniforms.uTime.value = 12;
    haloUniforms.uTime.value = 0;
    uniforms.uFade.value = 1;
    haloUniforms.uFade.value = 1;
    renderer.render(scene, camera);
  }
  if (still) {
    renderStill();
    return;
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
      if (onScreen) start();
      else stop();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  start();
}
