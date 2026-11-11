/* =========================================================
   Monde 3D du portfolio jouable : l'ascension vers l'espace.
   Lit window.LEVEL (niveau) et window.GAME (altitude, commandes).

   Fichier source : il est assemblé avec Three.js dans
   js/world.bundle.js (commande : npm run build).
   ========================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const L = window.LEVEL;
const G = window.GAME;
let booted = false;

function boot() {
  if (booted) return;
  booted = true;
  try {
    init();
  } catch (err) {
    console.warn('Monde 3D indisponible :', err);
    if (G && typeof G.fail === 'function') G.fail(err);
  }
}

if (L && G) {
  G.boot = boot;
  if (!G.paused) boot();
}

function init() {
  const canvas = document.getElementById('world');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('WebGL indisponible');

  /* ---------- Palier de performance ---------- */
  const mobile = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  const weak = mobile || (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const tier = { dpr: Math.min(devicePixelRatio || 1, weak ? 1.5 : 2), stars: weak ? 700 : 1600, galaxy: weak ? 700 : 1600, bloom: !weak };
  renderer.setPixelRatio(tier.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const I18N = window.I18N;
  const T = I18N.LEVEL_TEXT;

  /* ---------- Thèmes de couleur ---------- */
  const THEMES = {
    cyan:   { a: 0x5fe1ff, b: 0x3d8bff, hi: 0xffc83d },
    violet: { a: 0xb79cff, b: 0x6c5cff, hi: 0xffc83d },
    vert:   { a: 0x5cffb0, b: 0x1fb58f, hi: 0xffd166 },
    orange: { a: 0xffb35c, b: 0xff6b4a, hi: 0x5fe1ff },
    rose:   { a: 0xff8ad0, b: 0xc04bff, hi: 0xffe66d },
  };
  const themeKey = () => (THEMES[document.documentElement.getAttribute('data-theme')] ? document.documentElement.getAttribute('data-theme') : 'cyan');
  let theme = THEMES[themeKey()];
  const themed = { a: [], b: [], hi: [] };
  const tm = (role, mat) => { themed[role].push(mat); mat.color.setHex(theme[role]); return mat; };
  const hexCss = (n) => '#' + new THREE.Color(n).getHexString();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2a5e);
  scene.fog = new THREE.Fog(0x1b2a5e, 34, 120);

  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 400);
  camera.position.set(0, 3, 15);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x6a7ab8, 1.3);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sunLight.position.set(12, 18, 14);
  scene.add(sunLight);
  const flameLight = new THREE.PointLight(0xffa64d, 0, 7, 1.6);
  scene.add(flameLight);

  /* ---------- Outils ---------- */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const rand = (a, b) => a + Math.random() * (b - a);
  const lineMat = (color, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const segs = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return g; };
  const circle = (a, cx, cy, cz, r, n = 32, plane = 'xy') => {
    for (let s = 0; s < n; s++) {
      const t1 = (s / n) * Math.PI * 2;
      const t2 = ((s + 1) / n) * Math.PI * 2;
      if (plane === 'xy') a.push(cx + Math.cos(t1) * r, cy + Math.sin(t1) * r, cz, cx + Math.cos(t2) * r, cy + Math.sin(t2) * r, cz);
      else a.push(cx + Math.cos(t1) * r, cy, cz + Math.sin(t1) * r, cx + Math.cos(t2) * r, cy, cz + Math.sin(t2) * r);
    }
  };
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const glowTex = canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  const glowSprite = (color, size, opacity = 1, fog = true) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog }));
    s.scale.setScalar(size);
    return s;
  };

  /* ---------- Style anime : ombrage en aplats (cel-shading) et contours noirs ---------- */
  const INK = 0x14141f;
  const gradientMap = (() => {
    const tex = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  })();
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  // Contour « coque inversée » : une copie légèrement agrandie, noire, vue de dos
  const outline = (mesh, k = 0.06) => {
    const o = new THREE.Mesh(mesh.geometry, inkMat);
    o.scale.setScalar(1 + k);
    mesh.add(o);
    return mesh;
  };

  const FONT = '"Archivo", "Helvetica Neue", Arial, sans-serif';
  function label(text, { h = 0.55, color = '#E8EEFF', border = '#5FE1FF', bg = 'rgba(4,6,26,0.82)', weight = 700, size = 56 } = {}) {
    const ctx0 = document.createElement('canvas').getContext('2d');
    ctx0.font = `${weight} ${size}px ${FONT}`;
    const w = Math.ceil(ctx0.measureText(text).width) + size * 1.1;
    const hh = Math.ceil(size * 1.7);
    const tex = canvasTex(w, hh, (ctx) => {
      ctx.font = `${weight} ${size}px ${FONT}`;
      ctx.fillStyle = bg;
      ctx.strokeStyle = border;
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(2, 2, w - 4, hh - 4, hh / 2 - 2);
      else ctx.rect(2, 2, w - 4, hh - 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, hh / 2 + 2);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sp.scale.set(h * (w / hh), h, 1);
    return sp;
  }

  // Décors groupés par tranche d'altitude (on ne dessine que ce qui est proche)
  const stages = [];
  const stage = (y1, y2) => { const g = new THREE.Group(); g.userData = { y1, y2 }; scene.add(g); stages.push(g); return g; };
  const animated = [];

  /* =========================================================
     Couleur du ciel selon l'altitude
     ========================================================= */
  // [altitude, haut du ciel, bas du ciel] : coucher de soleil au sol, nuit violette dans l'espace
  const SKY = [
    [0, 0x4f9dff, 0xffa95e], [14, 0x3d8ef0, 0xa8dcff], [36, 0x2a63d6, 0x78b6ff], [60, 0x1d43a8, 0x4a7ee0],
    [82, 0x132a7a, 0x2f4cb8], [116, 0x0e1658, 0x24237a], [150, 0x150c45, 0x311867], [184, 0x200b4a, 0x45166e],
    [240, 0x2c0d52, 0x641b72], [300, 0x3b0e5a, 0x8a2272],
  ];
  const skyTop = new THREE.Color();
  const skyBottom = new THREE.Color();
  const cA = new THREE.Color();
  const cB = new THREE.Color();
  const skyColors = (y) => {
    let i = SKY.length - 2;
    for (let k = 0; k < SKY.length - 1; k++) { if (y <= SKY[k + 1][0]) { i = k; break; } }
    const t = clamp01((y - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]));
    skyTop.copy(cA.set(SKY[i][1])).lerp(cB.set(SKY[i + 1][1]), t);
    skyBottom.copy(cA.set(SKY[i][2])).lerp(cB.set(SKY[i + 1][2]), t);
  };
  const skyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { top: { value: skyTop }, bottom: { value: skyBottom } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: 'uniform vec3 top;\nuniform vec3 bottom;\nvarying vec2 vUv;\nvoid main() {\n  gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 1.0, vUv.y)), 1.0);\n  #include <colorspace_fragment>\n}',
    depthWrite: false,
    depthTest: false,
  }));
  skyQuad.frustumCulled = false;
  skyQuad.renderOrder = -1000;
  scene.add(skyQuad);
  scene.background = null;

  // Étoile scintillante à quatre branches
  const sparkTex = canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 10);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(32, 2); ctx.quadraticCurveTo(35, 29, 62, 32); ctx.quadraticCurveTo(35, 35, 32, 62);
    ctx.quadraticCurveTo(29, 35, 2, 32); ctx.quadraticCurveTo(29, 29, 32, 2);
    ctx.fill();
  });

  /* ---------- Étoiles (apparaissent en montant) ---------- */
  const stars = (() => {
    const n = tier.stars;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-70, 70);
      pos[i * 3 + 1] = rand(20, 360);
      pos[i * 3 + 2] = rand(-90, -25);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff6d8, size: 0.9, map: sparkTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    scene.add(p);
    return p;
  })();

  /* =========================================================
     1. Le sol : les Alpes et le pas de tir
     ========================================================= */
  const ground = stage(-20, 40);
  (() => {
    const x0 = L.pathX(0);
    // Sol
    const floor = new THREE.Mesh(new THREE.BoxGeometry(200, 2, 60), toon(0x3fae5c));
    floor.position.set(x0, -1.6, -20);
    ground.add(floor);
    // Montagnes
    [[-34, 0x5a7fd6, 1, 0.9], [-48, 0x8aa6ea, 1.4, 1.3]].forEach(([z, col, amp, freq]) => {
      const shape = new THREE.Shape();
      shape.moveTo(-110, -2);
      const ridge = [];
      for (let x = -110; x <= 110; x += 2.5) {
        const y = 3 + Math.abs(Math.sin(x * 0.06 * freq)) * 13 * amp + Math.sin(x * 0.23) * 2.2;
        shape.lineTo(x, y);
        ridge.push([x, y]);
      }
      shape.lineTo(110, -2);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(x0, 0, z);
      ground.add(m);
      // contour noir des crêtes, façon dessin
      const a = [];
      for (let i = 0; i < ridge.length - 1; i++) a.push(ridge[i][0], ridge[i][1], 0.1, ridge[i + 1][0], ridge[i + 1][1], 0.1);
      const ridgeLine = new THREE.LineSegments(segs(a), new THREE.LineBasicMaterial({ color: INK }));
      ridgeLine.position.copy(m.position);
      ground.add(ridgeLine);
      // neige : un petit chapeau blanc sur chaque sommet
      const caps = [];
      for (let i = 1; i < ridge.length - 1; i++) {
        const [x, y] = ridge[i];
        if (y > 9 * amp && y >= ridge[i - 1][1] && y >= ridge[i + 1][1]) caps.push(x - 2.2, y - 2.4, 0.05, x + 2.2, y - 2.4, 0.05, x, y, 0.05);
      }
      if (caps.length) {
        const snow = new THREE.Mesh(segs(caps), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
        snow.position.copy(m.position);
        ground.add(snow);
      }
    });
    // Lumières de la ville
    const lights = [];
    for (let i = 0; i < 260; i++) lights.push(x0 + rand(-60, 60), rand(-0.6, 0.6), rand(-28, -8));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
    ground.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xffd28a, size: 0.25, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    // Pas de tir
    const pad = outline(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 0.5, 40), toon(0xe9e4d6)), 0.03);
    pad.position.set(x0, -0.25, 0);
    ground.add(pad);
    const ring = [];
    circle(ring, 0, 0, 0, 2.3, 48, 'xz');
    circle(ring, 0, 0, 0, 1.4, 40, 'xz');
    const padRing = new THREE.LineSegments(segs(ring), tm('a', lineMat(0xffffff, 0.9)));
    padRing.position.set(x0, 0.01, 0);
    ground.add(padRing);
    // Tour de lancement
    const tw = [];
    for (let k = 0; k < 10; k++) {
      const y0 = k * 1.2;
      tw.push(-0.5, y0, 0, 0.5, y0 + 1.2, 0, 0.5, y0, 0, -0.5, y0 + 1.2, 0, -0.5, y0, 0, -0.5, y0 + 1.2, 0, 0.5, y0, 0, 0.5, y0 + 1.2, 0);
    }
    tw.push(0.5, 9, 0, 2.2, 9, 0);
    const tower = new THREE.LineSegments(segs(tw), tm('b', lineMat(0xffffff, 0.8)));
    tower.position.set(x0 - 4.2, 0, -1.2);
    ground.add(tower);
  })();

  /* =========================================================
     2. Les nuages (et un avion)
     ========================================================= */
  const clouds = stage(0, 60);
  const puffGeo = new THREE.SphereGeometry(1, 18, 14);
  const cloudMat = toon(0xffffff);
  const cumulus = () => {
    const g = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const r = rand(0.9, 1.7) * (i === Math.floor(n / 2) ? 1.35 : 1);
      const m = outline(new THREE.Mesh(puffGeo, cloudMat), 0.07);
      m.scale.setScalar(r);
      m.position.set((i - (n - 1) / 2) * 1.35 + rand(-0.2, 0.2), (r - 1) * 0.7 + rand(0, 0.3), rand(-0.4, 0.4));
      g.add(m);
    }
    const base = outline(new THREE.Mesh(puffGeo, cloudMat), 0.05);
    base.scale.set(n * 0.85, 0.75, 1);
    base.position.y = -0.35;
    g.add(base);
    return g;
  };
  const cloudList = [];
  for (let i = 0; i < (weak ? 10 : 18); i++) {
    const front = i % 5 === 0;
    const c = cumulus();
    c.scale.setScalar(front ? rand(0.9, 1.2) : rand(1.1, 2));
    c.position.set(rand(-26, 26), rand(9, 44), front ? rand(2.5, 4) : rand(-24, -6));
    c.userData.v = rand(0.3, 0.7);
    clouds.add(c);
    cloudList.push(c);
  }
  animated.push((t, dt, cx) => {
    cloudList.forEach((c) => {
      c.position.x += c.userData.v * dt;
      if (c.position.x > cx + 30) c.position.x = cx - 30;
    });
  });
  (() => {
    const a = [-1.6, 0, 0, 1.6, 0, 0, -0.2, 0, 0, -0.6, 1.4, 0, -0.2, 0, 0, -0.6, -1.4, 0, -1.4, 0, 0, -1.7, 0.6, 0];
    const plane = new THREE.Group();
    plane.add(new THREE.LineSegments(segs(a), new THREE.LineBasicMaterial({ color: 0xe8eeff })));
    const red = glowSprite(0xff4d6d, 0.6);
    red.position.set(-0.6, 1.4, 0);
    const green = glowSprite(0x4dff9a, 0.6);
    green.position.set(-0.6, -1.4, 0);
    plane.add(red, green);
    plane.rotation.x = 1.2;
    clouds.add(plane);
    animated.push((t, dt, cx) => {
      const k = (t * 0.035) % 1;
      plane.position.set(cx - 40 + k * 80, 28, -16);
      red.material.opacity = green.material.opacity = Math.sin(t * 8) > 0 ? 1 : 0.15;
    });
  })();

  /* =========================================================
     3. La stratosphère : ballon-sonde et aurores
     ========================================================= */
  const strato = stage(30, 95);
  (() => {
    const balloon = new THREE.Group();
    const sph = outline(new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 18), toon(0xff5a5f)), 0.05);
    const box = outline(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), toon(0xffd166)), 0.1);
    box.position.y = -3.2;
    const string = new THREE.LineSegments(segs([0, -1.5, 0, 0, -3, 0]), new THREE.LineBasicMaterial({ color: INK }));
    balloon.add(sph, box, string);
    strato.add(balloon);
    animated.push((t, dt, cx) => { balloon.position.set(cx + 9 + Math.sin(t * 0.3) * 1.5, 54 + Math.sin(t * 0.25) * 4, -10); });

    const ribbons = [[0x6cffb6, 62, -40], [0x36d6ff, 66, -46], [0xa66cff, 70, -52]].map(([col, y, z]) => {
      const n = 140;
      const pos = new Float32Array(n * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const line = new THREE.Line(g, lineMat(col, 0.55));
      strato.add(line);
      return { line, pos, n, y, z };
    });
    animated.push((t, dt, cx) => {
      ribbons.forEach((r, j) => {
        for (let i = 0; i < r.n; i++) {
          const x = cx - 50 + (i / r.n) * 100;
          r.pos[i * 3] = x;
          r.pos[i * 3 + 1] = r.y + Math.sin(x * 0.12 + t * 0.6 + j) * 2 + Math.sin(x * 0.05 - t * 0.3) * 1.5;
          r.pos[i * 3 + 2] = r.z;
        }
        r.line.geometry.attributes.position.needsUpdate = true;
      });
    });
  })();

  /* =========================================================
     4. L'orbite : la Terre en dessous, satellites et station
     ========================================================= */
  const orbit = stage(60, 175);
  const earth = new THREE.Group();
  (() => {
    const tex = canvasTex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#2f8cff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4cc26a';
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, 40 + Math.random() * (h - 80), 12 + Math.random() * 46, 8 + Math.random() * 26, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 3 + Math.random() * 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(80, 64, 48), toon(0xffffff, { map: tex, transparent: true }));
    const atmo = glowSprite(0x6fb6ff, 210, 0.55, false);
    earth.add(atmo, sphere);
    earth.position.set(0, 18, -150);
    earth.userData.sphere = sphere;
    earth.userData.atmo = atmo;
    scene.add(earth);
  })();
  const satellite = () => {
    const g = new THREE.Group();
    g.add(outline(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.9), toon(0xffd166)), 0.08));
    [-1, 1].forEach((side) => {
      const panel = outline(new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 0.06), toon(0x3d6bff)), 0.06);
      panel.position.x = side * 1.65;
      g.add(panel);
    });
    const a = [];
    [-1, 1].forEach((side) => {
      const x1 = side * 0.45;
      const x2 = side * 2.6;
      a.push(x1, 0, 0, x2, 0, 0);
      const px = Math.min(x1, x2) + (side > 0 ? 0.3 : 0);
      for (let k = 0; k <= 4; k++) { const xx = side > 0 ? 0.75 + k * 0.45 : -0.75 - k * 0.45; a.push(xx, -0.5, 0, xx, 0.5, 0); }
      a.push(side * 0.75, -0.5, 0, side * 2.55, -0.5, 0, side * 0.75, 0.5, 0, side * 2.55, 0.5, 0);
      void px;
    });
    g.add(new THREE.LineSegments(segs(a), tm('b', lineMat(0xffffff, 0.95))));
    return g;
  };
  [[84, -8, 0.05], [98, -12, -0.04], [108, -6, 0.06]].forEach(([y, z, v], i) => {
    const s = satellite();
    orbit.add(s);
    animated.push((t, dt, cx) => {
      s.position.set(cx + Math.sin(t * v * 6 + i * 2) * 16, y + Math.cos(t * v * 4 + i) * 2, z);
      s.rotation.set(t * 0.2 + i, t * 0.3, 0.4);
    });
  });
  (() => {
    const st = new THREE.Group();
    const mod = toon(0xf4f1e8);
    [-6, -4, 4, 6].forEach((x) => {
      const panel = outline(new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.2, 0.08), toon(0x3d6bff)), 0.04);
      panel.position.x = x;
      st.add(panel);
    });
    [-2.2, 0, 2.2].forEach((x) => {
      const c = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2, 16), mod), 0.08);
      c.rotation.z = Math.PI / 2;
      c.position.x = x;
      st.add(c);
    });
    const a = [-7, 0, 0, 7, 0, 0];
    [-6, -4, 4, 6].forEach((x) => {
      a.push(x - 0.8, -2.6, 0, x + 0.8, -2.6, 0, x + 0.8, -2.6, 0, x + 0.8, 2.6, 0, x + 0.8, 2.6, 0, x - 0.8, 2.6, 0, x - 0.8, 2.6, 0, x - 0.8, -2.6, 0);
      for (let k = -2; k <= 2; k++) a.push(x - 0.8, k, 0, x + 0.8, k, 0);
      a.push(x, -2.6, 0, x, 2.6, 0);
    });
    st.add(new THREE.LineSegments(segs(a), tm('b', lineMat(0xffffff, 0.9))));
    orbit.add(st);
    animated.push((t, dt, cx) => { st.position.set(cx - 12, 100, -18); st.rotation.set(0.3, t * 0.08, 0.15); });
  })();

  /* =========================================================
     5. La Lune
     ========================================================= */
  const moonStage = stage(100, 175);
  const moon = (() => {
    const tex = canvasTex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f2e8c9';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = 3 + Math.random() * 18;
        ctx.fillStyle = `rgba(190,170,130,${0.35 + Math.random() * 0.35})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,20,31,.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x - 1, y - 1, r, Math.PI, Math.PI * 1.6);
        ctx.stroke();
      }
    });
    const m = outline(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 32), toon(0xffffff, { map: tex })), 0.02);
    m.position.set(L.pathX(133) + 17, 133, -28);
    moonStage.add(m);
    const moonGlow = glowSprite(0xfff1c9, 34, 0.3);
    moonGlow.position.copy(m.position).setZ(-29);
    moonStage.add(moonGlow);
    return m;
  })();
  animated.push((t) => { moon.rotation.y = t * 0.04; });

  /* =========================================================
     6. La ceinture d'astéroïdes
     ========================================================= */
  const belt = stage(135, 205);
  const rocks = [];
  for (let i = 0; i < (weak ? 26 : 40); i++) {
    const geo = new THREE.IcosahedronGeometry(rand(0.5, 2.2), 1);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * rand(0.75, 1.2), p.getY(k) * rand(0.75, 1.2), p.getZ(k) * rand(0.75, 1.2));
    geo.computeVertexNormals();
    const rock = outline(new THREE.Mesh(geo, toon(new THREE.Color().setHSL(rand(0.05, 0.1), 0.35, rand(0.42, 0.55)))), 0.06);
    const y = rand(150, 186);
    const front = i % 7 === 0;
    let x = L.pathX(y) + rand(-20, 20);
    if (!front && Math.abs(x - L.pathX(y)) < 3) x += 6;
    rock.position.set(front ? L.pathX(y) + (Math.random() < 0.5 ? -9 : 9) : x, y, front ? rand(2, 4) : rand(-22, -4));
    rock.userData.spin = new THREE.Vector3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6));
    belt.add(rock);
    rocks.push(rock);
  }
  animated.push((t, dt) => {
    rocks.forEach((r) => {
      r.rotation.x += r.userData.spin.x * dt;
      r.rotation.y += r.userData.spin.y * dt;
      r.rotation.z += r.userData.spin.z * dt;
    });
  });

  /* =========================================================
     7. Les planètes
     ========================================================= */
  const planets = stage(170, 300);
  const bands = (cols) => canvasTex(256, 128, (ctx, w, h) => {
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = cols[Math.floor((Math.sin(y * 0.15) * 0.5 + 0.5) * (cols.length - 0.01))];
      ctx.fillRect(0, y, w, 4);
    }
  });
  const ringed = (() => {
    const g = new THREE.Group();
    const p = outline(new THREE.Mesh(new THREE.SphereGeometry(7, 48, 32), toon(0xffffff, { map: bands(['#ffb35c', '#ff8a4c', '#ffd28a', '#f07a3a']) })), 0.025);
    const ringTex = canvasTex(256, 8, (ctx, w) => {
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = `rgba(255,230,170,${0.3 + 0.6 * Math.abs(Math.sin(x * 0.11)) * (x > 30 ? 1 : 0)})`;
        ctx.fillRect(x, 0, 1, 8);
      }
    });
    const ringGeo = new THREE.RingGeometry(9, 15, 96, 1);
    const pos = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - 9) / 6, 0.5);
    }
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -1.25;
    g.add(p, ring);
    g.rotation.z = 0.35;
    g.position.set(L.pathX(205) - 20, 205, -38);
    planets.add(g);
    return p;
  })();
  const giant = outline(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 32), toon(0xffffff, { map: bands(['#4fd1c5', '#2fb5ff', '#7be0d6', '#2a8bd6']) })), 0.02);
  giant.position.set(L.pathX(240) + 22, 240, -46);
  planets.add(giant);
  const red = outline(new THREE.Mesh(new THREE.SphereGeometry(3, 32, 24), toon(0xffffff, { map: bands(['#ff5a5f', '#e0434a', '#ff8a8c']) })), 0.05);
  red.position.set(L.pathX(258) - 11, 258, -22);
  planets.add(red);
  animated.push((t) => { ringed.rotation.y = t * 0.05; giant.rotation.y = t * 0.03; red.rotation.y = t * 0.08; });

  /* =========================================================
     8. L'espace profond : nébuleuse, galaxie, comète
     ========================================================= */
  const deep = stage(230, 380);
  [[0xff5fa2, 270, -70, 70], [0x7b5cff, 300, -80, 90], [0x36d6ff, 285, -65, 55], [0xff8a5c, 320, -90, 80], [0x7b5cff, 255, -75, 60]].forEach(([c, y, z, s], i) => {
    const n = glowSprite(c, s, 0.32, false);
    n.position.set((i % 2 ? 1 : -1) * 22, y, z);
    deep.add(n);
  });
  const galaxy = (() => {
    const n = tier.galaxy;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c1 = new THREE.Color(0xffd6a0);
    const c2 = new THREE.Color(0x7b8cff);
    for (let i = 0; i < n; i++) {
      const arm = i % 3;
      const r = Math.pow(Math.random(), 0.7) * 16;
      const th = r * 0.45 + (arm / 3) * Math.PI * 2 + rand(-0.3, 0.3);
      pos.set([Math.cos(th) * r, rand(-0.5, 0.5) * (1 - r / 16), Math.sin(th) * r], i * 3);
      const c = c1.clone().lerp(c2, r / 16);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    p.position.set(28, 300, -70);
    p.rotation.x = 1.1;
    deep.add(p);
    return p;
  })();
  const comet = (() => {
    const g = new THREE.Group();
    g.add(glowSprite(0xe8f6ff, 2.2, 1, false));
    const tail = new THREE.LineSegments(segs([0, 0, 0, 9, 4, 0, 0, 0.2, 0, 8, 4.8, 0, 0, -0.2, 0, 8.5, 3.4, 0]), lineMat(0x9fdcff, 0.6));
    g.add(tail);
    deep.add(g);
    return g;
  })();
  animated.push((t, dt, cx) => {
    galaxy.rotation.y = t * 0.03;
    const k = (t * 0.05) % 1;
    comet.position.set(cx + 40 - k * 80, 300 - k * 30, -40);
  });

  /* =========================================================
     Station finale (contact)
     ========================================================= */
  const station = new THREE.Group();
  const beaconParts = {};
  (() => {
    const xs = L.pathX(L.stationY);
    const deck = outline(new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 4), toon(0xf4f1e8)), 0.02);
    deck.position.set(xs + 3, L.stationY - 0.3, 0);
    const deckEdge = new THREE.LineSegments(new THREE.EdgesGeometry(deck.geometry), tm('a', lineMat(0xffffff, 0.9)));
    deckEdge.position.copy(deck.position);
    station.add(deck, deckEdge);
    const mod = outline(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 5, 24), toon(0xffd166)), 0.04);
    mod.rotation.z = Math.PI / 2;
    mod.position.set(xs + 4.5, L.stationY + 1.3, -3.2);
    station.add(mod);
    // Antenne parabolique
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), toon(0xffffff, { side: THREE.DoubleSide }));
    dish.rotation.x = Math.PI * 0.75;
    dish.position.set(xs + 6.2, L.stationY + 4.4, -0.8);
    const mast = new THREE.LineSegments(segs([xs + 6.2, L.stationY, -0.8, xs + 6.2, L.stationY + 3.6, -0.8]), tm('hi', lineMat(0xffffff, 0.9)));
    station.add(dish, mast);
    const beacon = glowSprite(0xffffff, 1.4);
    tm('hi', beacon.material);
    beacon.position.set(xs + 6.2, L.stationY + 5.6, -0.4);
    station.add(beacon);
    const waves = [0, 1, 2].map(() => {
      const a = [];
      circle(a, 0, 0, 0, 1, 48);
      const r = new THREE.LineSegments(segs(a), tm('hi', lineMat(0xffffff, 0)));
      r.position.copy(beacon.position);
      station.add(r);
      return r;
    });
    Object.assign(beaconParts, { beacon, waves, x: xs + 6.2, y: L.stationY + 5.6 });
  })();
  scene.add(station);

  /* =========================================================
     Compétences, blocs info, stations de projets, panneaux
     ========================================================= */
  const coinGeo = new THREE.OctahedronGeometry(0.42, 0);
  const coins = L.items.map((it, i) => {
    const grp = new THREE.Group();
    const mat = toon(theme.hi, { emissive: theme.hi, emissiveIntensity: 0.25 });
    const mesh = outline(new THREE.Mesh(coinGeo, mat), 0.12);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(coinGeo), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.9 }));
    const halo = glowSprite(theme.hi, 1.8, 0.45);
    tm('hi', halo.material);
    grp.add(halo, mesh, edge);
    grp.position.set(it.x, it.y, 0);
    scene.add(grp);
    return { ...it, grp, mesh, mat, edge, halo, phase: i * 0.7, state: G.collected.has(it.id) ? 'gone' : 'idle', t: 0, tag: null };
  });

  const bonusGeo = new RoundedBoxGeometry(0.95, 0.95, 0.95, 3, 0.12);
  const bonuses = L.bonuses.map((b, i) => {
    const grp = new THREE.Group();
    const mesh = outline(new THREE.Mesh(bonusGeo, toon(0x3d6bff, { transparent: true })), 0.1);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.97, 0.97, 0.97)), tm('a', lineMat(0xffffff, 1)));
    const halo = glowSprite(0xffffff, 2.2, 0.35);
    tm('a', halo.material);
    grp.add(halo, mesh, edge);
    grp.position.set(b.x, b.y, 0);
    scene.add(grp);
    return { ...b, grp, mesh, edge, halo, mark: null, phase: i, state: G.bonusFound.has(b.id) ? 'gone' : 'idle', t: 0 };
  });
  bonuses.forEach((b) => { if (b.state === 'gone') b.grp.visible = false; });

  const terminals = L.terminals.map((t) => {
    const grp = new THREE.Group();
    const frameGeo = new THREE.BoxGeometry(2.6, 1.7, 0.18);
    const frame = outline(new THREE.Mesh(frameGeo, toon(0xf4f1e8)), 0.05);
    const frameEdge = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo), tm('a', lineMat(0xffffff, 0.8)));
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x0b2a66 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4), screenMat);
    screen.position.z = 0.1;
    const lines = [];
    for (let k = 0; k < 4; k++) lines.push(-0.95, 0.38 - k * 0.25, 0.11, -0.95 + 0.6 + ((k * 37) % 9) * 0.13, 0.38 - k * 0.25, 0.11);
    const code = new THREE.LineSegments(segs(lines), tm('a', lineMat(0xffffff, 0.7)));
    // petits propulseurs sous la station
    const thr = glowSprite(0xffffff, 0.8, 0.7);
    tm('hi', thr.material);
    thr.position.y = -1.1;
    grp.add(frame, frameEdge, screen, code, thr);
    grp.position.set(t.x, t.y, -0.6);
    grp.rotation.y = -t.side * 0.25;
    scene.add(grp);
    return { ...t, grp, screenMat, frameEdge, code, thr, level: 0, tag: null };
  });

  /* ---------- Textes dans la 3D (reconstruits au changement de langue) ---------- */
  const labels = [];
  const disposeLabel = (sp) => { sp.parent && sp.parent.remove(sp); sp.material.map.dispose(); sp.material.dispose(); };
  function buildLabels() {
    labels.splice(0).forEach(disposeLabel);
    const border = hexCss(theme.a);
    L.zones.forEach((z, i) => {
      if (z.id === 'start') return;
      const txt = `${I18N.pick(T.zones[z.id])} · ${I18N.pick(T.places[z.id])}`;
      const sp = label(txt, { h: 0.9, border, size: 60, weight: 800 });
      const y = z.from + 3.2;
      sp.position.set(L.pathX(y) + (i % 2 ? 5.2 : -5.2), y, -1.8);
      scene.add(sp);
      labels.push(sp);
    });
    coins.forEach((c) => {
      c.tag = label(I18N.pick(T.skills[c.id]), { h: 0.42, size: 44, weight: 600, border: hexCss(theme.hi) });
      c.tag.position.set(c.x, c.y + 0.95, 0);
      c.tag.visible = c.state === 'idle';
      scene.add(c.tag);
      labels.push(c.tag);
    });
    bonuses.forEach((b) => {
      b.mark = label('i', { h: 0.62, size: 60, weight: 800, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)', color: '#E8F6FF' });
      b.mark.position.z = 0.5;
      b.grp.add(b.mark);
      labels.push(b.mark);
    });
    terminals.forEach((t) => {
      t.tag = label(I18N.t('project', t.index + 1), { h: 0.42, size: 44, weight: 700, border });
      t.tag.position.set(t.x, t.y + 1.35, -0.6);
      scene.add(t.tag);
      labels.push(t.tag);
    });
  }

  function applyTheme() {
    theme = THEMES[themeKey()];
    Object.keys(themed).forEach((role) => themed[role].forEach((m) => m.color.setHex(theme[role])));
    coins.forEach((c) => { c.mat.color.setHex(theme.hi); c.mat.emissive.setHex(theme.hi); });
    neon.color.setHex(theme.a);
    buildLabels();
  }
  G.setTheme = applyTheme;
  G.setLang = buildLabels;

  /* =========================================================
     Bit et son jetpack
     ========================================================= */
  const bit = new THREE.Group();
  const rig = new THREE.Group();
  bit.add(rig);
  scene.add(bit);

  const shell = toon(0xf7f4ee);
  const dark = toon(0x1c1f3a);
  const neon = new THREE.MeshBasicMaterial({ color: theme.a });
  const tipMat = tm('hi', new THREE.MeshBasicMaterial({ color: 0xffffff }));

  const body = outline(new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.74, 0.58, 4, 0.18), shell), 0.07);
  body.position.y = 0.95;
  const chest = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), neon);
  chest.position.set(0, 1.0, 0.295);
  const head = new THREE.Group();
  head.position.y = 1.72;
  const skull = outline(new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.78, 0.78, 5, 0.22), shell), 0.06);
  const visor = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.5, 0.06, 3, 0.05), dark);
  visor.position.z = 0.38;
  // Grands yeux d'anime avec reflet
  const eyeGeo = new THREE.CircleGeometry(0.105, 24);
  const eyeL = new THREE.Mesh(eyeGeo, neon);
  const eyeR = new THREE.Mesh(eyeGeo, neon);
  eyeL.scale.set(1, 1.35, 1);
  eyeR.scale.set(1, 1.35, 1);
  eyeL.position.set(-0.17, 0.0, 0.415);
  eyeR.position.set(0.17, 0.0, 0.415);
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [eyeL, eyeR].forEach((e) => {
    const sp = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), shine);
    sp.position.set(0.035, 0.04, 0.002);
    e.add(sp);
  });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8), dark);
  stem.position.y = 0.55;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), tipMat);
  tip.position.y = 0.74;
  head.add(skull, visor, eyeL, eyeR, stem, tip);

  // Jetpack
  const pack = new THREE.Group();
  const tank = outline(new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.7, 0.32, 3, 0.1), toon(0xff5a5f)), 0.08);
  tank.position.set(0, 1.02, -0.45);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.34), neon);
  stripe.position.set(0, 1.2, -0.45);
  pack.add(tank, stripe);
  const nozzles = [-0.2, 0.2].map((x) => {
    const n = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 14), toon(0x8a90a8)), 0.12);
    n.position.set(x, 0.6, -0.48);
    pack.add(n);
    const flame = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.8, 14, 1), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 12, 1), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    outline(outer, 0.12);
    outer.rotation.x = Math.PI;
    inner.rotation.x = Math.PI;
    outer.position.y = -0.375;
    inner.position.y = -0.225;
    const fg = glowSprite(0xffa64d, 0.9, 0.8);
    fg.position.y = -0.3;
    flame.add(outer, inner, fg);
    flame.position.set(x, 0.49, -0.48);
    pack.add(flame);
    return flame;
  });
  rig.add(pack);

  const limb = (len, r) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), shell);
  const joint = (x, y) => { const j = new THREE.Group(); j.position.set(x, y, 0); return j; };
  const armL = joint(-0.5, 1.2);
  const armR = joint(0.5, 1.2);
  [armL, armR].forEach((j) => { const m = outline(limb(0.36, 0.09), 0.18); m.position.y = -0.24; j.add(m); });
  const legL = joint(-0.2, 0.62);
  const legR = joint(0.2, 0.62);
  [legL, legR].forEach((j) => {
    const m = outline(limb(0.3, 0.11), 0.15);
    m.position.y = -0.24;
    const foot = outline(new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.12, 0.34, 2, 0.05), dark), 0.15);
    foot.position.set(0, -0.52, 0.05);
    j.add(m, foot);
  });
  rig.add(body, chest, head, armL, armR, legL, legR);

  /* ---------- Fumée du jetpack et éclats ---------- */
  const N = 520;
  const pPos = new Float32Array(N * 3).fill(-9999);
  const pVel = new Float32Array(N * 3);
  const pLife = new Float32Array(N);
  const pCol = new Float32Array(N * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  // Bouffées de fumée dessinées : rond blanc cerné de noir
  const puffTex = canvasTex(64, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#14141f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.42, map: puffTex, transparent: true, alphaTest: 0.5, vertexColors: true, depthWrite: true }));
  parts.frustumCulled = false;
  scene.add(parts);
  let pNext = 0;
  const tmpC = new THREE.Color();
  function emit(x, y, z, vx, vy, vz, life, color) {
    const i = pNext;
    pNext = (pNext + 1) % N;
    pPos.set([x, y, z], i * 3);
    pVel.set([vx, vy, vz], i * 3);
    tmpC.set(color);
    pCol.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
    pLife[i] = life;
  }
  function burst(x, y, z, color, count = 26, speed = 4) {
    for (let k = 0; k < count; k++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI;
      const s = speed * rand(0.5, 1.1);
      emit(x, y, z, Math.cos(th) * Math.sin(ph) * s, Math.cos(ph) * s, Math.sin(th) * Math.sin(ph) * s * 0.5, rand(0.6, 1.1), color);
    }
  }

  /* ---------- Halo (machines puissantes) ---------- */
  let composer = null;
  let bloomPass = null;
  if (tier.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.3, 0.4, 0.6);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    if (composer) {
      composer.setPixelRatio(Math.min(tier.dpr, 1.25));
      composer.setSize(innerWidth, innerHeight);
      bloomPass.resolution.set(innerWidth / 2, innerHeight / 2);
    }
  };
  resize();
  addEventListener('resize', resize);

  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      mouse.x = (e.clientX / innerWidth) * 2 - 1;
      mouse.y = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load(`700 56px ${FONT}`), new Promise((r) => setTimeout(r, 1500))]).catch(() => {})
    : Promise.resolve();
  buildLabels();
  fontReady.then(buildLabels);

  /* ---------- Lignes de vitesse façon manga (canvas 2D par-dessus la scène) ---------- */
  const speed = (() => {
    const c = document.getElementById('speedlines');
    if (!c) return null;
    const ctx = c.getContext('2d');
    const n = weak ? 40 : 80;
    const lines = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), l: rand(0.08, 0.3), v: rand(1.2, 2.4), w: rand(1, 3.5) }));
    const fit = () => { c.width = Math.round(innerWidth * Math.min(devicePixelRatio || 1, 1.5)); c.height = Math.round(innerHeight * Math.min(devicePixelRatio || 1, 1.5)); };
    fit();
    addEventListener('resize', fit);
    return { c, ctx, lines, level: 0 };
  })();
  function drawSpeed(intensity, dt) {
    if (!speed) return;
    speed.level = lerp(speed.level, intensity, 0.15);
    const { c, ctx, lines } = speed;
    ctx.clearRect(0, 0, c.width, c.height);
    if (speed.level < 0.03) return;
    ctx.lineCap = 'round';
    lines.forEach((ln) => {
      ln.y += ln.v * dt * (0.6 + speed.level * 1.8);
      if (ln.y > 1.2) { ln.y = -0.3; ln.x = Math.random(); }
      // plus denses sur les bords, comme dans une case de manga
      const edge = Math.abs(ln.x - 0.5) * 2;
      ctx.globalAlpha = Math.min(0.85, speed.level * (0.25 + edge * 0.9));
      ctx.strokeStyle = ln.w > 2.5 ? '#14141f' : '#ffffff';
      ctx.lineWidth = ln.w * (c.width / innerWidth);
      ctx.beginPath();
      ctx.moveTo(ln.x * c.width, ln.y * c.height);
      ctx.lineTo(ln.x * c.width, (ln.y + ln.l * (0.5 + speed.level)) * c.height);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  /* =========================================================
     Boucle
     ========================================================= */
  const clock = new THREE.Clock();
  const st = {
    s: G.s, prevS: G.s, x: L.pathX(G.s), offset: 0, vx: 0, phase: 0, turbo: 0, blink: 0, nextBlink: 2,
    camX: L.pathX(0), camY: 3, wonAt: -1, emitAcc: 0,
  };
  let frames = 0;
  let fpsTime = 0;
  let checked = false;

  function loop() {
    if (G.paused || document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (!checked) {
      frames++;
      fpsTime += dt;
      if (fpsTime > 2.5) {
        checked = true;
        if (frames / fpsTime < 40 && composer) { composer = null; renderer.setPixelRatio(1); resize(); }
      }
    }

    // ----- Altitude et déplacement latéral -----
    st.prevS = st.s;
    st.s = lerp(st.s, G.s, 0.25);
    const climb = (st.s - st.prevS) / Math.max(dt, 0.001);
    const landed = st.s > L.goal - 0.6;   // posé sur la station finale
    const grounded = st.s < 0.35 || landed;
    const steer = grounded ? 0 : (G.steer || 0);
    st.offset = Math.max(-5.5, Math.min(5.5, st.offset + steer * 7.5 * dt));
    if (grounded) st.offset = lerp(st.offset, 0, 0.1);
    if (landed) st.offset = lerp(st.offset, 0, 0.08);
    const targetX = L.pathX(st.s) + st.offset;
    const prevX = st.x;
    st.x = lerp(st.x, targetX, 0.18);
    st.vx = (st.x - prevX) / Math.max(dt, 0.001);
    const by = landed ? L.stationY : st.s + (grounded ? 0 : Math.sin(t * 2.4) * 0.08);

    if (G.turboRequest) {
      G.turboRequest = false;
      if (!grounded || G.s > 0.2) { st.turbo = 1; burst(st.x, by + 0.4, -0.3, 0xffb347, 18, 3); }
    }
    st.turbo = Math.max(0, st.turbo - dt * 1.1);

    bit.position.set(st.x, by, 0);
    bit.rotation.y = lerp(bit.rotation.y, grounded ? 0.35 : 0.55 + Math.max(-0.4, Math.min(0.4, st.vx * 0.05)), 0.1);
    rig.rotation.z = lerp(rig.rotation.z, grounded ? 0 : Math.max(-0.35, Math.min(0.35, -st.vx * 0.05)), 0.12);
    rig.rotation.x = lerp(rig.rotation.x, grounded ? 0 : 0.12 + st.turbo * 0.2, 0.1);

    // Pose : debout au sol, jambes ballantes en vol
    const thrust = grounded ? 0 : clamp01(0.55 + Math.abs(climb) * 0.04 + st.turbo);
    if (grounded) {
      legL.rotation.x = lerp(legL.rotation.x, 0, 0.2);
      legR.rotation.x = lerp(legR.rotation.x, 0, 0.2);
      armL.rotation.z = lerp(armL.rotation.z, -0.12, 0.2);
      armR.rotation.z = lerp(armR.rotation.z, 0.12, 0.2);
    } else {
      legL.rotation.x = 0.25 + Math.sin(t * 3) * 0.12;
      legR.rotation.x = 0.1 + Math.sin(t * 3 + 1.4) * 0.12;
      const waving = G.won && t - st.wonAt < 2.6;
      armL.rotation.z = lerp(armL.rotation.z, -0.55 - st.turbo * 0.5, 0.15);
      armR.rotation.z = lerp(armR.rotation.z, waving ? 2.6 + Math.sin(t * 12) * 0.35 : 0.55 + st.turbo * 0.5, 0.15);
    }

    // Flammes du jetpack
    nozzles.forEach((f, i) => {
      const flick = 0.85 + Math.sin(t * 40 + i * 2) * 0.1 + Math.random() * 0.1;
      const len = thrust * (1 + st.turbo * 1.6) * flick;
      f.scale.set(1 + st.turbo * 0.4, Math.max(0.001, len), 1 + st.turbo * 0.4);
      f.visible = thrust > 0.02;
    });
    flameLight.position.set(st.x, by + 0.2, -0.2);
    flameLight.intensity = thrust * (6 + st.turbo * 10);

    // Fumée et étincelles
    if (thrust > 0.02) {
      st.emitAcc += dt * (weak ? 40 : 70) * (1 + st.turbo * 2);
      while (st.emitAcc > 1) {
        st.emitAcc -= 1;
        const side = Math.random() < 0.5 ? -0.2 : 0.2;
        const fire = Math.random() < 0.35;
        emit(st.x + side * Math.cos(bit.rotation.y), by + 0.15, -0.45, rand(-0.4, 0.4), -rand(3, 5) * (1 + st.turbo), rand(-0.3, 0.3), fire ? rand(0.2, 0.4) : rand(0.6, 1.1), fire ? 0xffc23d : 0xffffff);
      }
    }

    if (t > st.nextBlink) { st.blink = 1; st.nextBlink = t + 2.4 + Math.random() * 2.5; }
    st.blink = Math.max(0, st.blink - dt * 9);
    eyeL.scale.y = eyeR.scale.y = 1 - Math.sin(st.blink * Math.PI) * 0.9;

    // ----- Compétences : aimantées vers Bit au passage -----
    const lo = Math.min(st.prevS, st.s) - 0.8;
    const hi = Math.max(st.prevS, st.s) + 0.8;
    coins.forEach((c) => {
      if (c.state === 'idle') {
        c.grp.position.y = c.y + Math.sin(t * 2 + c.phase) * 0.12;
        c.mesh.rotation.y = t * 1.6 + c.phase;
        c.edge.rotation.y = c.mesh.rotation.y;
        if (c.s >= lo && c.s <= hi) {
          c.state = 'pop';
          c.t = 0;
          c.from = c.grp.position.clone();
          if (c.tag) c.tag.visible = false;
          G.collect(c.id);
        }
      } else if (c.state === 'pop') {
        c.t += dt;
        const k = clamp01(c.t / 0.4);
        c.grp.position.lerpVectors(c.from, new THREE.Vector3(st.x, by + 1.1, 0), k);
        c.grp.scale.setScalar(1 - k * 0.6);
        if (k >= 1) {
          c.state = 'gone';
          c.grp.visible = false;
          burst(st.x, by + 1.1, 0, theme.hi, 22, 3.5);
        }
      }
    });

    // ----- Blocs info : il faut aller les toucher (← →) -----
    bonuses.forEach((b) => {
      if (b.state === 'idle') {
        b.grp.position.y = b.y + Math.sin(t * 1.6 + b.phase) * 0.12;
        b.grp.rotation.y = Math.sin(t * 0.8 + b.phase) * 0.4;
        b.halo.material.opacity = 0.25 + Math.sin(t * 3 + b.phase) * 0.15;
        if (Math.abs(st.x - b.x) < 1.25 && Math.abs(by + 1.1 - b.y) < 1.4) {
          b.state = 'pop';
          b.t = 0;
          burst(b.x, b.y, 0, theme.a, 36, 5);
          if (typeof G.bonus === 'function') G.bonus(b.id);
        }
      } else if (b.state === 'pop') {
        b.t += dt;
        const k = b.t / 0.5;
        b.grp.scale.setScalar(1 + k * 0.6);
        b.mesh.material.opacity = 1 - k;
        b.edge.material.opacity = 1 - k;
        if (b.mark) b.mark.material.opacity = 1 - k;
        if (k >= 1) { b.state = 'gone'; b.grp.visible = false; }
      }
    });

    // ----- Stations de projets -----
    terminals.forEach((tmn) => {
      const near = Math.abs(tmn.s - st.s) < 5.5 ? 1 : 0;
      tmn.level = lerp(tmn.level, near, 0.1);
      tmn.screenMat.color.setRGB(0.04 + tmn.level * 0.1, 0.16 + tmn.level * 0.45, 0.4 + tmn.level * 0.45);
      tmn.frameEdge.material.opacity = 0.5 + tmn.level * 0.5;
      tmn.code.material.opacity = 0.4 + tmn.level * 0.6;
      tmn.grp.position.y = tmn.y + Math.sin(t * 1.2 + tmn.index) * 0.15;
      tmn.thr.material.opacity = 0.5 + Math.random() * 0.4;
    });

    // ----- Station finale et feu d'artifice -----
    beaconParts.beacon.material.opacity = 0.6 + Math.sin(t * 3) * 0.4;
    beaconParts.waves.forEach((w, i) => {
      const k = ((t * 0.5 + i / 3) % 1);
      w.scale.setScalar(0.4 + k * 3.5);
      w.material.opacity = (G.won ? 0.9 : 0.35) * (1 - k);
    });
    if (G.won && st.wonAt < 0) st.wonAt = t;
    if (st.wonAt >= 0 && t - st.wonAt < 3.5 && Math.random() < 0.14) {
      burst(beaconParts.x + rand(-8, 8), beaconParts.y + rand(1, 6), -2, Math.random() < 0.5 ? theme.hi : theme.a, 34, 5);
    }

    // ----- Particules -----
    for (let i = 0; i < N; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt;
      pVel[i * 3 + 1] -= 2 * dt;
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      if (pLife[i] <= 0) pPos[i * 3 + 1] = -9999;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    // ----- Décors : on n'anime et n'affiche que l'étape proche -----
    stages.forEach((g) => { g.visible = by > g.userData.y1 - 30 && by < g.userData.y2 + 30; });
    animated.forEach((fn) => fn(t, dt, st.camX));
    const earthK = smooth(62, 82, by) * (1 - smooth(150, 185, by));
    earth.visible = earthK > 0.01;
    earth.position.x = st.camX * 0.6;
    earth.position.y = 18 + (by - 95) * 0.55;
    earth.userData.sphere.material.opacity = earthK;
    earth.userData.atmo.material.opacity = 0.55 * earthK;
    earth.userData.sphere.rotation.y = t * 0.01;

    // ----- Ciel -----
    skyColors(by);
    scene.fog.color.copy(skyBottom).lerp(skyTop, 0.4);
    stars.material.opacity = smooth(30, 90, by) * (0.75 + Math.sin(t * 2) * 0.25);
    hemi.intensity = lerp(1.3, 0.95, smooth(40, 120, by));

    // ----- Caméra -----
    // Téléphone en paysage : panneau à droite, Bit à gauche (comme sur ordinateur)
    const landscape = mobile && innerWidth > innerHeight;
    const portraitPhone = mobile && !landscape;
    const camZ = (portraitPhone ? 18 : 15) + st.turbo * 1.2;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const halfW = Math.tan(vFov / 2) * camZ * camera.aspect;
    const startBlend = clamp01(st.s / 3);
    const ahead = portraitPhone ? 0 : lerp(-halfW * 0.4, halfW * (landscape ? 0.3 : 0.24), startBlend);
    st.camX = lerp(st.camX, st.x + ahead, 0.06);
    st.camY = lerp(st.camY, by, 0.12);
    mouse.sx = lerp(mouse.sx, mouse.x, 0.05);
    mouse.sy = lerp(mouse.sy, mouse.y, 0.05);
    camera.position.set(st.camX + mouse.sx * 0.7, st.camY + 1.2 - mouse.sy * 0.4, camZ);
    const lookY = portraitPhone ? lerp(4.8, -1.1, startBlend) : lerp(1.6, 2.6, startBlend);
    camera.lookAt(st.camX, st.camY + lookY, 0);
    stars.position.set(st.camX * 0.5, st.camY * 0.08, 0);

    drawSpeed(grounded ? 0 : clamp01((Math.abs(climb) - 6) / 30) + st.turbo, dt);

    if (composer) composer.render();
    else renderer.render(scene, camera);
    if (!G.ready) G.ready = true;
  }

  renderer.setAnimationLoop(loop);
}
