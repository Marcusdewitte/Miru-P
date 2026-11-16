// Section backdrops (routes, network, globe, polder, beacon) and the four service emblems.
export default function initScenes() {
  if (!window.THREE) return;
  const THREE = window.THREE;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.innerWidth < 720;

  // mounts a scene into every match; each one pauses off-screen / in hidden tabs
  function mount(target, build) {
    const hosts = typeof target === 'string' ? document.querySelectorAll(target) : [target];
    Array.prototype.forEach.call(hosts, (host) => {
      if (host) mountOne(host, build);
    });
  }
  function mountOne(host, build) {
    host.classList.add('has-gl');
    const canvas = document.createElement('canvas');
    canvas.className = 'gl';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch (e) {
      canvas.remove();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    const api = build(scene, camera, renderer) || {};
    let w = 0,
      h = 0;
    function fit() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (api.resize) api.resize(w, h);
    }
    let running = false,
      onScreen = false,
      last = 0,
      t = 0,
      fade = 0;
    function frame(now) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000 || 0, 0.05);
      last = now;
      t += dt;
      fade = Math.min(1, fade + dt / 1.6);
      api.update(t, dt, 1 - Math.pow(1 - fade, 3));
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
      if (still) paintStill();
    });
    function paintStill() {
      api.update(14, 0, 1);
      renderer.render(scene, camera);
    }
    if (still) {
      paintStill();
      return;
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        (es) => {
          onScreen = es[0].isIntersecting;
          if (onScreen) {
            fit();
            start();
          } else stop();
        },
        {
          rootMargin: '120px 0px',
        },
      ).observe(host);
    } else {
      onScreen = true;
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else start();
    });
    start();
  }

  // world-space size of the view at depth z
  function visible(camera, z) {
    const vh = 2 * Math.tan((camera.fov * Math.PI) / 360) * (camera.position.z - z);
    return {
      w: vh * camera.aspect,
      h: vh,
    };
  }

  // paper sections: ink route lines drawing across
  function routes(scene, camera) {
    camera.position.set(0, 0, 20);
    const ROUTES = small ? 5 : 8,
      SEG = 120;
    const routes = [];
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uHead: {
          value: 0,
        },
        uFade: {
          value: 0,
        },
      },
      vertexShader:
        'attribute float along; varying float vA; void main(){ vA = along; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform float uHead; uniform float uFade; varying float vA;',
        'void main(){',
        '  float drawn = step(vA, uHead);',
        '  float tail = smoothstep(uHead - 0.9, uHead, vA);',
        '  float a = drawn * (0.06 + 0.14 * tail);',
        '  gl_FragColor = vec4(0.082, 0.078, 0.059, a * uFade);',
        '}',
      ].join('\n'),
    });
    for (let r = 0; r < ROUTES; r++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3));
      const along = new Float32Array(SEG);
      for (let i = 0; i < SEG; i++) along[i] = i / (SEG - 1);
      g.setAttribute('along', new THREE.BufferAttribute(along, 1));
      const m = mat.clone();
      const line = new THREE.Line(g, m);
      scene.add(line);
      routes.push({
        line,
        mat: m,
        speed: 0.05 + Math.random() * 0.05,
        offset: Math.random(),
        a: Math.random() * 6.28,
        b: Math.random() * 6.28,
        y0: (r / (ROUTES - 1)) * 2 - 1,
      });
    }
    let V = {
      w: 1,
      h: 1,
    };
    function shape(R) {
      const p = R.line.geometry.attributes.position.array;
      for (let i = 0; i < SEG; i++) {
        const u = i / (SEG - 1);
        p[i * 3] = (u - 0.5) * V.w * 1.1;
        p[i * 3 + 1] =
          R.y0 * V.h * 0.42 + Math.sin(u * 4.2 + R.a) * V.h * 0.08 + Math.sin(u * 9.1 + R.b) * V.h * 0.025;
        p[i * 3 + 2] = 0;
      }
      R.line.geometry.attributes.position.needsUpdate = true;
    }
    return {
      resize() {
        V = visible(camera, 0);
        routes.forEach(shape);
      },
      update(t, dt, f) {
        routes.forEach((R) => {
          R.mat.uniforms.uHead.value = (t * R.speed + R.offset) % 1.6;
          R.mat.uniforms.uFade.value = f;
        });
      },
    };
  }

  // dark bands: contacts drifting, amber sparks along links
  function network(scene, camera) {
    camera.position.set(0, 0, 30);
    const N = small ? 38 : 72,
      LINK = 7.5;
    const nodes = [];
    const pos = new Float32Array(N * 3),
      col = new Float32Array(N * 3),
      size = new Float32Array(N);
    const cream = new THREE.Color(0xf4f1ea),
      amber = new THREE.Color(0xe8862a);
    for (let i = 0; i < N; i++) {
      const hot = Math.random() < 0.12;
      nodes.push({
        x: 0,
        y: 0,
        z: (Math.random() * 2 - 1) * 3,
        vx: (Math.random() * 2 - 1) * 0.35,
        vy: (Math.random() * 2 - 1) * 0.35,
        hot,
        u: Math.random(),
        v: Math.random(),
      });
      const c = hot ? amber : cream;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      size[i] = hot ? 7 : 3.5 + Math.random() * 2;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    pg.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const pm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixel: {
          value: Math.min(window.devicePixelRatio || 1, 2),
        },
        uFade: {
          value: 0,
        },
      },
      vertexShader:
        'attribute vec3 color; attribute float size; uniform float uPixel; varying vec3 vC; void main(){ vC = color; gl_PointSize = size * uPixel; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform float uFade; varying vec3 vC; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.15,d); gl_FragColor = vec4(vC, a*0.75*uFade); }',
    });
    scene.add(new THREE.Points(pg, pm));
    const MAXL = N * 8;
    const lp = new Float32Array(MAXL * 6),
      la = new Float32Array(MAXL * 2);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lg.setAttribute('alpha', new THREE.BufferAttribute(la, 1));
    const lm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uFade: {
          value: 0,
        },
      },
      vertexShader:
        'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform float uFade; varying float vA; void main(){ gl_FragColor = vec4(0.957,0.945,0.918, vA*0.15*uFade); }',
    });
    scene.add(new THREE.LineSegments(lg, lm));
    const P = 6,
      pulses = [];
    const sp = new Float32Array(P * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixel: {
          value: Math.min(window.devicePixelRatio || 1, 2),
        },
        uFade: {
          value: 0,
        },
      },
      vertexShader:
        'uniform float uPixel; void main(){ gl_PointSize = 14.0*uPixel; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:
        'uniform float uFade; void main(){ float d=length(gl_PointCoord-0.5); float a=pow(smoothstep(0.5,0.0,d),2.0); gl_FragColor=vec4(1.0,0.62,0.25,a*uFade); }',
    });
    scene.add(new THREE.Points(sg, sm));
    for (let k = 0; k < P; k++)
      pulses.push({
        a: -1,
        b: -1,
        p: 1,
        s: 0.5 + Math.random() * 0.5,
        wait: Math.random() * 3,
      });
    let V = {
        w: 1,
        h: 1,
      },
      links = [];
    return {
      resize() {
        const prev = V;
        V = visible(camera, 0);
        nodes.forEach((n) => {
          if (!n.placed) {
            n.x = (n.u - 0.5) * V.w;
            n.y = (n.v - 0.5) * V.h;
            n.placed = true;
          } else {
            n.x *= V.w / prev.w;
            n.y *= V.h / prev.h;
          }
        });
      },
      update(t, dt, f) {
        pm.uniforms.uFade.value = lm.uniforms.uFade.value = sm.uniforms.uFade.value = f;
        const hw = V.w / 2 + 2,
          hh = V.h / 2 + 2;
        nodes.forEach((n, i) => {
          n.x += n.vx * dt;
          n.y += n.vy * dt;
          if (n.x < -hw) n.x = hw;
          if (n.x > hw) n.x = -hw;
          if (n.y < -hh) n.y = hh;
          if (n.y > hh) n.y = -hh;
          pos[i * 3] = n.x;
          pos[i * 3 + 1] = n.y;
          pos[i * 3 + 2] = n.z;
        });
        pg.attributes.position.needsUpdate = true;
        let c = 0;
        links.length = 0;
        for (let i = 0; i < N && c < MAXL; i++)
          for (let j = i + 1; j < N && c < MAXL; j++) {
            const dx = nodes[i].x - nodes[j].x,
              dy = nodes[i].y - nodes[j].y,
              d = Math.sqrt(dx * dx + dy * dy);
            if (d < LINK) {
              const a = 1 - d / LINK;
              lp.set([nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z], c * 6);
              la[c * 2] = la[c * 2 + 1] = a;
              links.push([i, j]);
              c++;
            }
          }
        lg.setDrawRange(0, c * 2);
        lg.attributes.position.needsUpdate = true;
        lg.attributes.alpha.needsUpdate = true;
        pulses.forEach((q, k) => {
          if (q.p >= 1) {
            q.wait -= dt;
            if (q.wait <= 0 && links.length) {
              const L = links[(Math.random() * links.length) | 0];
              q.a = L[0];
              q.b = L[1];
              q.p = 0;
              q.wait = 1 + Math.random() * 3;
            }
            sp[k * 3 + 2] = -999;
            return;
          }
          q.p += dt * q.s;
          const A = nodes[q.a],
            B = nodes[q.b],
            e = q.p * q.p * (3 - 2 * q.p);
          sp[k * 3] = A.x + (B.x - A.x) * e;
          sp[k * 3 + 1] = A.y + (B.y - A.y) * e;
          sp[k * 3 + 2] = A.z + (B.z - A.z) * e;
        });
        sg.attributes.position.needsUpdate = true;
      },
    };
  }

  // amber CTA panels: dotted globe, markets lighting up
  function globe(scene, camera) {
    camera.position.set(0, 0, 14);
    const M = small ? 1100 : 2200;
    const pos = new Float32Array(M * 3),
      lit = new Float32Array(M);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < M; i++) {
      const y = 1 - (i / (M - 1)) * 2,
        r = Math.sqrt(1 - y * y),
        th = golden * i;
      pos[i * 3] = Math.cos(th) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(th) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('lit', new THREE.BufferAttribute(lit, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uPixel: {
          value: Math.min(window.devicePixelRatio || 1, 2),
        },
        uFade: {
          value: 0,
        },
        uScale: {
          value: 1,
        },
      },
      vertexShader: [
        'attribute float lit; uniform float uPixel; uniform float uScale; varying float vFront; varying float vLit;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position,1.0);',
        '  vec4 mv = viewMatrix * wp;',
        '  vFront = smoothstep(-0.6, 0.9, normalize(mat3(modelMatrix)*position).z);',
        '  vLit = lit;',
        '  gl_PointSize = (2.8 + lit * 5.0) * uPixel * uScale;',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform float uFade; varying float vFront; varying float vLit;',
        'void main(){',
        '  float d = length(gl_PointCoord - 0.5);',
        '  float a = smoothstep(0.5, 0.3, d);',
        '  vec3 ink = vec3(0.082, 0.078, 0.059);',
        '  vec3 paper = vec3(0.98, 0.96, 0.92);',
        '  vec3 c = mix(ink, paper, vLit);',
        '  gl_FragColor = vec4(c, a * mix(0.12, 0.6, vFront) * (1.0 + vLit) * uFade);',
        '}',
      ].join('\n'),
    });
    const globe = new THREE.Points(g, mat);
    globe.rotation.x = 0.42;
    scene.add(globe);
    const marks = [];
    return {
      resize(w, h) {
        const V = visible(camera, 0);
        let R = Math.min(V.h * 0.6, V.w * 0.2);
        globe.scale.setScalar(R);
        globe.position.set(-V.w * 0.03, -V.h * 0.5 - R * 0.05, 0);
        mat.uniforms.uScale.value = Math.max(0.8, Math.min(1.3, h / 420));
        if (w < 1024) {
          R = Math.min(V.h * 0.45, V.w * 0.42);
          globe.scale.setScalar(R);
          globe.position.set(V.w * 0.5 - R * 0.35, -V.h * 0.5 + R * 0.1, 0);
        }
      },
      update(t, dt, f) {
        mat.uniforms.uFade.value = f;
        globe.rotation.y = t * 0.06;
        if (Math.random() < dt * 1.4 && marks.length < 7)
          marks.push({
            i: (Math.random() * M) | 0,
            p: 0,
          });
        for (let k = marks.length - 1; k >= 0; k--) {
          const m = marks[k];
          m.p += dt / 3.2;
          lit[m.i] = Math.sin(Math.min(m.p, 1) * Math.PI);
          if (m.p >= 1) {
            lit[m.i] = 0;
            marks.splice(k, 1);
          }
        }
        g.attributes.lit.needsUpdate = true;
      },
    };
  }

  // footer: dot field rolling like wind over a polder
  function polder(scene, camera) {
    camera.position.set(0, 3.2, 12);
    camera.lookAt(0, -0.6, -8);
    const CX = small ? 60 : 110,
      CZ = small ? 26 : 40;
    const pos = new Float32Array(CX * CZ * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: {
          value: 0,
        },
        uPixel: {
          value: Math.min(window.devicePixelRatio || 1, 2),
        },
        uFade: {
          value: 0,
        },
      },
      vertexShader: [
        'uniform float uTime; uniform float uPixel; varying float vA; varying float vH;',
        'void main(){',
        '  vec3 p = position;',
        '  float h = sin(p.x * 0.35 + uTime * 0.6) * 0.35 + sin(p.z * 0.5 - uTime * 0.45 + p.x * 0.12) * 0.28;',
        '  p.y += h;',
        '  vH = h;',
        '  vec4 mv = modelViewMatrix * vec4(p,1.0);',
        '  vA = smoothstep(-34.0, -6.0, mv.z) * smoothstep(2.0, -4.0, mv.z);',
        '  gl_PointSize = uPixel * 32.0 / -mv.z;',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform float uFade; varying float vA; varying float vH;',
        'void main(){',
        '  float d = length(gl_PointCoord - 0.5);',
        '  float a = smoothstep(0.5, 0.2, d);',
        '  vec3 c = mix(vec3(0.957,0.945,0.918), vec3(1.0,0.62,0.25), smoothstep(0.45, 0.62, vH));',
        '  gl_FragColor = vec4(c, a * vA * 0.55 * uFade);',
        '}',
      ].join('\n'),
    });
    scene.add(new THREE.Points(g, mat));
    return {
      resize() {
        const span = 46 * Math.max(1, camera.aspect / 2.2);
        let k = 0;
        for (let z = 0; z < CZ; z++)
          for (let x = 0; x < CX; x++) {
            pos[k++] = (x / (CX - 1) - 0.5) * span;
            pos[k++] = -1.2;
            pos[k++] = 4 - z * 0.95;
          }
        g.attributes.position.needsUpdate = true;
      },
      update(t, dt, f) {
        mat.uniforms.uTime.value = t;
        mat.uniforms.uFade.value = f;
      },
    };
  }

  // contact: rings pulsing out from the office
  function beacon(scene, camera) {
    camera.position.set(0, 0, 20);
    const GX = small ? 34 : 56,
      GY = 40;
    const grid = new Float32Array(GX * GY * 3);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(grid, 3));
    const center = new THREE.Vector2(0, 0);
    const gm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: {
          value: 0,
        },
        uPixel: {
          value: Math.min(window.devicePixelRatio || 1, 2),
        },
        uFade: {
          value: 0,
        },
        uCenter: {
          value: center,
        },
      },
      vertexShader: [
        'uniform float uTime; uniform float uPixel; uniform vec2 uCenter; varying float vA; varying float vWave;',
        'void main(){',
        '  float d = distance(position.xy, uCenter);',
        '  float w = 0.0;',
        '  for (int k = 0; k < 3; k++) {',
        '    float r = mod(uTime * 2.2 + float(k) * 4.0, 12.0);',
        '    w = max(w, smoothstep(1.1, 0.0, abs(d - r)) * (1.0 - r / 12.0));',
        '  }',
        '  vWave = w;',
        '  vA = smoothstep(22.0, 4.0, d);',
        '  gl_PointSize = (2.4 + w * 3.0) * uPixel;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform float uFade; varying float vA; varying float vWave;',
        'void main(){',
        '  float a = smoothstep(0.5, 0.2, length(gl_PointCoord - 0.5));',
        '  vec3 ink = vec3(0.082, 0.078, 0.059);',
        '  vec3 amber = vec3(0.91, 0.53, 0.16);',
        '  vec3 c = mix(ink, amber, smoothstep(0.05, 0.6, vWave));',
        '  gl_FragColor = vec4(c, a * vA * (0.10 + vWave * 0.75) * uFade);',
        '}',
      ].join('\n'),
    });
    scene.add(new THREE.Points(gg, gm));
    const om = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: {
          value: 0,
        },
        uFade: {
          value: 0,
        },
      },
      vertexShader:
        'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform float uTime; uniform float uFade; varying vec2 vUv;',
        'void main(){',
        '  float d = length(vUv - 0.5) * 2.0;',
        '  float core = smoothstep(0.32, 0.24, d);',
        '  float glow = pow(max(1.0 - d, 0.0), 2.0) * (0.45 + 0.15 * sin(uTime * 1.2566));',
        '  vec3 c = mix(vec3(0.91, 0.53, 0.16), vec3(1.0, 0.82, 0.55), core * 0.6);',
        '  gl_FragColor = vec4(c, max(core, glow) * uFade);',
        '}',
      ].join('\n'),
    });
    const orb = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), om);
    scene.add(orb);
    return {
      resize() {
        let V = visible(camera, 0),
          k = 0,
          sx = V.w / (GX - 1),
          sy = V.h / (GY - 1),
          s = sx;
        for (let y = 0; y < GY; y++)
          for (let x = 0; x < GX; x++) {
            grid[k++] = (x - (GX - 1) / 2) * s;
            grid[k++] = (y - (GY - 1) / 2) * s;
            grid[k++] = 0;
          }
        gg.attributes.position.needsUpdate = true;
        center.set(V.w * 0.28, 0);
        orb.position.set(center.x, center.y, 0.1);
      },
      update(t, dt, f) {
        gm.uniforms.uTime.value = om.uniforms.uTime.value = t;
        gm.uniforms.uFade.value = om.uniforms.uFade.value = f;
      },
    };
  }
  mount('[aria-labelledby="steps-in"], [aria-labelledby="principles"], .legal-head', routes);
  mount('.band', network);
  mount('.hairline .cta', globe);
  mount('.contact-grid aside > .reveal:last-child', beacon);
  mount('.site-footer', polder);
  const PX = Math.min(window.devicePixelRatio || 1, 2);
  const CREAM = new THREE.Color(0xf4f1ea),
    AMBER = new THREE.Color(0xe8862a);

  // --- service emblems
  function dotMaterial(extra) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixel: {
          value: PX,
        },
        uFade: {
          value: 0,
        },
      },
      vertexShader:
        'attribute vec3 color; attribute float size; attribute float alpha; uniform float uPixel; varying vec3 vC; varying float vA;' +
        'void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uPixel * (24.0 / -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader:
        'uniform float uFade; varying vec3 vC; varying float vA;' +
        'void main(){ float d = length(gl_PointCoord - 0.5); float core = smoothstep(0.5, 0.18, d); float glow = pow(smoothstep(0.5, 0.0, d), 3.0) * 0.6; gl_FragColor = vec4(vC, (core * 0.9 + glow) * vA * uFade); }',
    });
  }
  function dots(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    return g;
  }
  function setDot(g, i, x, y, z, col, size, alpha) {
    const p = g.attributes.position.array,
      c = g.attributes.color.array;
    p[i * 3] = x;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = z;
    c[i * 3] = col.r;
    c[i * 3 + 1] = col.g;
    c[i * 3 + 2] = col.b;
    g.attributes.size.array[i] = size;
    g.attributes.alpha.array[i] = alpha;
  }
  function flag(g) {
    ['position', 'color', 'size', 'alpha'].forEach((k) => {
      g.attributes[k].needsUpdate = true;
    });
  }
  function lineMaterial(color, opacity) {
    return new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }
  const ease = function (x) {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
  };

  // 01 eleven candidate markets narrowed to one
  function shortlist(scene, camera) {
    camera.position.set(0, 3.2, 11);
    camera.lookAt(0, 0, 0);
    const N = 11,
      dustN = 260,
      group = new THREE.Group();
    scene.add(group);
    const g = dots(N + 1 + dustN),
      m = dotMaterial();
    group.add(new THREE.Points(g, m));
    const spokes = new THREE.BufferGeometry();
    spokes.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    const sm = lineMaterial(0xf4f1ea, 0.0);
    group.add(new THREE.LineSegments(spokes, sm));
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        Array.from(
          {
            length: 129,
          },
          (_, i) => {
            const a = (i / 128) * Math.PI * 2;
            return new THREE.Vector3(Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6);
          },
        ),
      ),
      lineMaterial(0xf4f1ea, 0.0),
    );
    group.add(ring);
    const dust = [];
    for (let d = 0; d < dustN; d++)
      dust.push({
        a: Math.random() * 6.283,
        r: 0.6 + Math.random() * 4.4,
        y: (Math.random() * 2 - 1) * 1.6,
        s: 0.1 + Math.random() * 0.25,
      });
    let CYCLE = 13,
      winner = 3,
      order = [];
    function shuffle() {
      order = [];
      for (let i = 0; i < N; i++) if (i !== winner) order.push(i);
      order.sort(() => {
        return Math.random() - 0.5;
      });
    }
    shuffle();
    let lastCycle = -1;
    return {
      update(t, dt, f) {
        m.uniforms.uFade.value = f;
        const cyc = Math.floor(t / CYCLE),
          p = (t % CYCLE) / CYCLE;
        if (cyc !== lastCycle) {
          lastCycle = cyc;
          winner = (Math.random() * N) | 0;
          shuffle();
        }
        group.rotation.y = t * 0.12;
        const sp = spokes.attributes.position.array;
        const out = ease((p - 0.1) / 0.55) * (N - 1);
        const win = ease((p - 0.62) / 0.15),
          reset = ease((p - 0.9) / 0.1);
        for (let i = 0; i < N; i++) {
          const ang = (i / N) * Math.PI * 2,
            x = Math.cos(ang) * 3.6,
            z = Math.sin(ang) * 3.6,
            y = Math.sin(t * 0.8 + i) * 0.12;
          const k = order.indexOf(i),
            gone = i === winner ? 0 : ease(out - k);
          const alpha = (1 - gone * 0.85) * (1 - reset) + reset;
          const isW = i === winner ? win * (1 - reset) : 0;
          const col = isW > 0.01 ? AMBER : CREAM;
          setDot(g, i, x, y, z, col, 3.4 + isW * 6, alpha * (0.7 + isW * 0.3));
          sp.set([0, 0, 0, x * (1 - gone), y, z * (1 - gone)], i * 6);
        }
        setDot(g, N, 0, 0, 0, AMBER, 4 + win * 9 * (1 - reset), 0.35 + win * 0.65 * (1 - reset));
        spokes.attributes.position.needsUpdate = true;
        sm.opacity = 0.22 * f;
        ring.material.opacity = 0.12 * f;
        for (let q = 0; q < dustN; q++) {
          const D = dust[q],
            rr = D.r * (1 - 0.35 * win * (1 - reset)),
            aa = D.a + t * D.s * 0.4;
          setDot(
            g,
            N + 1 + q,
            Math.cos(aa) * rr,
            D.y * (1 - 0.5 * win * (1 - reset)),
            Math.sin(aa) * rr,
            CREAM,
            0.9,
            0.22,
          );
        }
        flag(g);
      },
    };
  }

  // 02 two networks, introduced one link at a time
  function bridge(scene, camera) {
    camera.position.set(0, 0, 12);
    const per = 22,
      N = per * 2,
      g = dots(N + 8),
      m = dotMaterial();
    scene.add(new THREE.Points(g, m));
    const nodes = [];
    for (let i = 0; i < N; i++) {
      const side = i < per ? -1 : 1,
        u = Math.random() * 6.283,
        v = Math.acos(2 * Math.random() - 1),
        r = 0.6 + Math.random() * 1.5;
      nodes.push({
        side,
        u,
        v,
        r,
        x: 0,
        y: 0,
        z: 0,
      });
    }
    const MAXA = 5,
      SEG = 40,
      arcs = [];
    for (let a = 0; a < MAXA; a++) {
      const ag = new THREE.BufferGeometry();
      ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3));
      const am = lineMaterial(0xe8862a, 0);
      const line = new THREE.Line(ag, am);
      scene.add(line);
      arcs.push({
        g: ag,
        m: am,
        a: -1,
        b: -1,
        p: 2,
        wait: a * 1.3,
      });
    }
    const inner = new THREE.BufferGeometry();
    inner.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 8 * 3), 3));
    const im = lineMaterial(0xf4f1ea, 0);
    scene.add(new THREE.LineSegments(inner, im));
    const tmp = new THREE.Vector3(),
      A = new THREE.Vector3(),
      B = new THREE.Vector3(),
      C = new THREE.Vector3();
    const curve = new THREE.QuadraticBezierCurve3(A, C, B);
    return {
      update(t, dt, f) {
        m.uniforms.uFade.value = f;
        im.opacity = 0.1 * f;
        nodes.forEach((n, i) => {
          const rot = t * 0.25 * n.side;
          n.x = n.side * 3.2 + Math.sin(n.v) * Math.cos(n.u + rot) * n.r;
          n.y = Math.cos(n.v) * n.r * 0.9;
          n.z = Math.sin(n.v) * Math.sin(n.u + rot) * n.r;
          setDot(g, i, n.x, n.y, n.z, CREAM, 2.4, 0.55);
        });
        let ip = inner.attributes.position.array,
          c = 0;
        for (let i = 0; i < N; i++)
          for (let j = i + 1; j < N; j++) {
            if (nodes[i].side !== nodes[j].side) continue;
            tmp.set(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y, nodes[i].z - nodes[j].z);
            if (tmp.length() < 1.05 && c < N * 4) {
              ip.set([nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z], c * 6);
              c++;
            }
          }
        inner.setDrawRange(0, c * 2);
        inner.attributes.position.needsUpdate = true;
        arcs.forEach((R, k) => {
          if (R.p > 1.6) {
            R.wait -= dt;
            if (R.wait <= 0) {
              R.a = (Math.random() * per) | 0;
              R.b = per + ((Math.random() * per) | 0);
              R.p = 0;
              R.wait = 2 + Math.random() * 3;
            }
          }
          const dotI = N + k;
          if (R.a < 0) {
            setDot(g, dotI, 0, 0, -99, AMBER, 0, 0);
            return;
          }
          R.p += dt / 2.4;
          const na = nodes[R.a],
            nb = nodes[R.b];
          A.set(na.x, na.y, na.z);
          B.set(nb.x, nb.y, nb.z);
          C.set((na.x + nb.x) / 2, (na.y + nb.y) / 2 + 2.2, (na.z + nb.z) / 2 + 1);
          const grow = ease(R.p),
            pos = R.g.attributes.position.array;
          for (let s = 0; s < SEG; s++) {
            curve.getPoint((s / (SEG - 1)) * grow, tmp);
            pos[s * 3] = tmp.x;
            pos[s * 3 + 1] = tmp.y;
            pos[s * 3 + 2] = tmp.z;
          }
          R.g.attributes.position.needsUpdate = true;
          R.m.opacity = 0.75 * f * (1 - ease((R.p - 1.0) / 0.6));
          curve.getPoint(grow, tmp);
          setDot(g, dotI, tmp.x, tmp.y, tmp.z, AMBER, 7, R.p < 1.05 ? 1 : 0);
          const lit = ease(R.p * 3) * (1 - ease((R.p - 1.1) / 0.5));
          setDot(g, R.a, na.x, na.y, na.z, AMBER, 2.4 + lit * 4, 0.55 + lit * 0.45);
          if (R.p > 0.95) setDot(g, R.b, nb.x, nb.y, nb.z, AMBER, 2.4 + lit * 4, 0.55 + lit * 0.45);
        });
        flag(g);
      },
    };
  }

  // 03 phased roadmap with milestones
  function roadmap(scene, camera) {
    camera.position.set(0, 4.2, 9);
    camera.lookAt(0, 0, -3);
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const u = i / 160;
      pts.push(new THREE.Vector3(Math.sin(u * 5.2) * 2.2 * (1 - u * 0.4), 0, 4 - u * 18));
    }
    const path = new THREE.CatmullRomCurve3(pts);
    const base = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(path.getPoints(200)),
      lineMaterial(0xf4f1ea, 0),
    );
    scene.add(base);
    const lit = new THREE.BufferGeometry();
    lit.setAttribute('position', new THREE.BufferAttribute(new Float32Array(201 * 3), 3));
    const litM = lineMaterial(0xe8862a, 0);
    scene.add(new THREE.Line(lit, litM));
    const MS = 6,
      gridN = 26 * 22,
      g = dots(MS + 1 + gridN),
      m = dotMaterial();
    scene.add(new THREE.Points(g, m));
    const tmp = new THREE.Vector3(),
      all = path.getPoints(200);
    let k = MS + 1;
    for (let z = 0; z < 22; z++)
      for (let x = 0; x < 26; x++) setDot(g, k++, (x - 12.5) * 0.8, -0.02, 4 - z * 0.9, CREAM, 0.9, 0.16);
    const CYCLE = 9;
    return {
      update(t, dt, f) {
        m.uniforms.uFade.value = f;
        base.material.opacity = 0.18 * f;
        const p = (t % CYCLE) / CYCLE,
          head = ease(p / 0.82),
          hold = ease((p - 0.9) / 0.1);
        const n = Math.max(1, Math.round(head * 200)),
          lp = lit.attributes.position.array;
        for (let i = 0; i <= 200; i++) {
          const q = all[Math.min(i, n)];
          lp[i * 3] = q.x;
          lp[i * 3 + 1] = q.y + 0.01;
          lp[i * 3 + 2] = q.z;
        }
        lit.attributes.position.needsUpdate = true;
        litM.opacity = 0.9 * f * (1 - hold);
        for (let s = 0; s < MS; s++) {
          const at = (s + 0.5) / MS;
          path.getPoint(at, tmp);
          const on = head >= at ? 1 : 0;
          setDot(
            g,
            s,
            tmp.x,
            tmp.y + 0.02,
            tmp.z,
            on ? AMBER : CREAM,
            on ? 8 * (1 - hold * 0.6) : 4,
            on ? 1 - hold * 0.5 : 0.45,
          );
        }
        path.getPoint(Math.min(head, 0.999), tmp);
        setDot(g, MS, tmp.x, 0.05, tmp.z, AMBER, 11 * (1 - hold), 1 - hold);
        flag(g);
      },
    };
  }

  // 04 the company assembled block by block
  function setup(scene, camera) {
    camera.position.set(7, 6.2, 8.5);
    camera.lookAt(0, 0.9, 0);
    const cells = [];
    const plan = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
      [-1, 0, 0],
      [-1, 0, 1],
      [0, 0, -1],
      [1, 0, -1],
      [-1, 0, -1],
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 1],
      [-1, 1, 0],
      [0, 1, -1],
      [1, 1, 1],
      [0, 2, 0],
      [1, 2, 0],
      [0, 2, 1],
      [0, 3, 0],
    ];
    const box = new THREE.BoxGeometry(0.92, 0.92, 0.92),
      edges = new THREE.EdgesGeometry(box);
    plan.forEach((c, i) => {
      const fill = new THREE.Mesh(
        box,
        new THREE.MeshBasicMaterial({
          color: 0x24221c,
          transparent: true,
          opacity: 0,
        }),
      );
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: i === plan.length - 1 ? 0xe8862a : 0xf4f1ea,
          transparent: true,
          opacity: 0,
        }),
      );
      const cube = new THREE.Group();
      cube.add(fill);
      cube.add(line);
      scene.add(cube);
      cells.push({
        g: cube,
        fill,
        line,
        x: c[0],
        y: c[1] + 0.46,
        z: c[2],
        last: i === plan.length - 1,
      });
    });
    const floor = new THREE.GridHelper(7, 7, 0xf4f1ea, 0xf4f1ea);
    floor.material.transparent = true;
    floor.material.opacity = 0;
    floor.material.depthWrite = false;
    scene.add(floor);
    const CYCLE = 12,
      STEP = 0.36;
    return {
      update(t, dt, f) {
        floor.material.opacity = 0.09 * f;
        const p = t % CYCLE,
          out = ease((p - (CYCLE - 1.2)) / 1.0);
        scene.rotation.y = Math.sin(t * 0.15) * 0.25;
        cells.forEach((c, i) => {
          const local = ease((p - 0.4 - i * STEP) / 0.7),
            drop = (1 - local) * 3;
          c.g.position.set(c.x, c.y + drop, c.z);
          const a = local * (1 - out) * f;
          c.fill.material.opacity = 0.92 * a;
          c.line.material.opacity = (c.last ? 1.0 : 0.55) * a;
        });
      },
    };
  }
  mount('.svc__emblem[data-emblem="shortlist"]', shortlist);
  mount('.svc__emblem[data-emblem="bridge"]', bridge);
  mount('.svc__emblem[data-emblem="roadmap"]', roadmap);
  mount('.svc__emblem[data-emblem="setup"]', setup);
}
