/* =========================================================
   Portfolio jouable : logique de page
   Le défilement fait monter Bit vers l'espace, le panneau
   affiche le contenu de l'étape en cours.
   La scène 3D (js/world.bundle.js) lit window.GAME.
   ========================================================= */
(() => {
  const root = document.documentElement;
  const L = window.LEVEL;
  const I = window.I18N;
  if (!L || !I) return;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const T = I.LEVEL_TEXT;

  const SPAN = L.goal - L.start;
  const header = $('.site-header');
  const burger = $('.burger');
  const track = $('.track');
  const hero = $('.hero');
  const main = $('#main');
  const toasts = $('.toasts');
  const zoneEls = $$('.zone');
  const skillChips = $$('[data-skill]');

  const GAME = window.GAME = Object.assign(window.GAME || {}, {
    s: L.start,
    steer: 0,
    turboRequest: false,
    paused: true,
    ready: false,
    won: false,
    collected: new Set(),
    bonusFound: new Set(),
    collect,
    bonus,
  });

  /* ---------- Notifications ---------- */
  function toast(text, kind = '') {
    const t = document.createElement('p');
    t.className = `toast ${kind}`;
    t.textContent = text;
    toasts.appendChild(t);
    setTimeout(() => t.classList.add('is-out'), 2600);
    setTimeout(() => t.remove(), 3200);
    const max = window.matchMedia('(max-width: 900px), (max-height: 500px)').matches ? 1 : 3;
    while (toasts.children.length > max) toasts.firstChild.remove();
  }

  /* ---------- Compétences et blocs info (appelés par la scène 3D) ---------- */
  function collect(id) {
    if (GAME.collected.has(id)) return;
    GAME.collected.add(id);
    skillChips.filter((c) => c.dataset.skill === id).forEach((c) => {
      c.classList.add('is-got', 'just-got');
      setTimeout(() => c.classList.remove('just-got'), 900);
    });
    $('[data-hud-count]').textContent = GAME.collected.size;
    bump('.hud-coins');
    toast(I.t('plusSkill', I.pick(T.skills[id])), 'is-coin');
    if (GAME.collected.size === L.items.length) setTimeout(() => toast(I.t('allSkills'), 'is-win'), 700);
  }

  function bonus(id) {
    if (GAME.bonusFound.has(id)) return;
    GAME.bonusFound.add(id);
    $('[data-hud-bonus]').textContent = GAME.bonusFound.size;
    bump('.hud-bonus');
    toast(I.t('infoBlock', I.pick(T.bonuses[id])), 'is-info');
    sfx('sfxBonus', 'is-bonus');
    if (GAME.bonusFound.size === L.bonuses.length) setTimeout(() => toast(I.t('allInfo'), 'is-win'), 900);
  }

  /* ---------- Onomatopées façon manga ---------- */
  const sfxLayer = $('.sfx-layer');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastSfx = 0;
  function sfx(key, kind = '') {
    if (reduceMotion || !sfxLayer || root.classList.contains('no3d')) return;
    const now = performance.now();
    if (now - lastSfx < 350) return;
    lastSfx = now;
    const el = document.createElement('span');
    el.className = `sfx ${kind}`;
    el.textContent = I.t(key);
    el.style.setProperty('--x', `${30 + Math.random() * 20}%`);
    el.style.setProperty('--y', `${34 + Math.random() * 16}%`);
    el.style.setProperty('--r', `${-12 + Math.random() * 24}deg`);
    sfxLayer.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  function bump(sel) {
    const el = $(sel);
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /* ---------- Menu mobile ---------- */
  const setMenu = (open) => {
    header.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', I.t(open ? 'menuClose' : 'menuOpen'));
  };
  burger.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));

  /* ---------- Tiroir du panneau (téléphone) ---------- */
  const sheetBtn = $('.sheet-toggle');
  const setSheet = (open) => {
    main.classList.toggle('is-open', open);
    root.classList.toggle('sheet-open', open);
    sheetBtn.setAttribute('aria-expanded', String(open));
    if (!open) main.scrollTop = 0;
  };
  sheetBtn.addEventListener('click', () => setSheet(!main.classList.contains('is-open')));

  /* ---------- Langue ---------- */
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } };

  function refreshTexts() {
    $('[data-hud-total]').textContent = L.items.length;
    $('[data-hud-bonus-total]').textContent = L.bonuses.length;
    $('[data-hud-skills-label]').textContent = I.t('skills');
    $('[data-hud-info-label]').textContent = I.t('infoBlocks');
    $('.pad-turbo').textContent = I.t('turbo');
    burger.setAttribute('aria-label', I.t(header.classList.contains('menu-open') ? 'menuClose' : 'menuOpen'));
    $$('.alti-nodes button').forEach((b) => { b.textContent = I.pick(T.zones[b.dataset.zone]); });
    $$('[data-lang-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langSet === I.lang())));
    lastZone = '';
  }

  $$('[data-lang-set]').forEach((b) => {
    b.addEventListener('click', () => {
      root.lang = b.dataset.langSet;
      save('portfolio-lang', root.lang);
      refreshTexts();
      if (typeof GAME.setLang === 'function') GAME.setLang();
    });
  });

  /* ---------- Couleur ---------- */
  const themeBtn = $('.theme-btn');
  const themeMenu = $('#theme-menu');
  const setThemeMenu = (open) => {
    themeMenu.hidden = !open;
    themeBtn.setAttribute('aria-expanded', String(open));
  };
  themeBtn.addEventListener('click', (e) => { e.stopPropagation(); setThemeMenu(themeMenu.hidden); });
  document.addEventListener('click', (e) => { if (!themeMenu.hidden && !e.target.closest('.theme-picker')) setThemeMenu(false); });
  const markTheme = () => $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === root.getAttribute('data-theme'))));
  $$('[data-theme-set]').forEach((b) => {
    b.addEventListener('click', () => {
      root.setAttribute('data-theme', b.dataset.themeSet);
      save('portfolio-theme', b.dataset.themeSet);
      markTheme();
      setThemeMenu(false);
      if (typeof GAME.setTheme === 'function') GAME.setTheme();
    });
  });
  markTheme();

  /* ---------- Altimètre ---------- */
  const toP = (s) => clamp((s - L.start) / SPAN, 0, 1);
  const zoneTarget = (id) => {
    if (id === 'start') return L.start;
    if (id === 'contact') return L.goal;
    if (id === 'projets') return L.terminals[0].s;
    const first = L.items.find((i) => i.zone === id);
    if (first) return first.s - 3;
    const z = L.zones.find((zz) => zz.id === id);
    return z ? z.from + (z.to - z.from) * 0.5 : L.start;
  };
  const nodesList = $('.alti-nodes');
  L.zones.forEach((z) => {
    const li = document.createElement('li');
    li.style.setProperty('--at', `${toP(zoneTarget(z.id)) * 100}%`);
    li.dataset.zone = z.id;
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.zone = z.id;
    b.addEventListener('click', () => goTo(z.id));
    li.appendChild(b);
    nodesList.appendChild(li);
  });
  const altiNodes = $$('.alti-nodes li');

  /* ---------- Défilement ---------- */
  let lenis = null;
  const maxScroll = () => SPAN * L.pxPerUnit;
  const currentScroll = () => (lenis ? lenis.scroll : window.scrollY);

  function scrollToS(sv, opts = {}) {
    const target = clamp(toP(sv) * maxScroll(), 0, maxScroll());
    const dist = Math.abs(target - currentScroll());
    const duration = opts.duration || clamp(0.9 + dist / 6000, 0.9, 3.4);
    if (lenis) lenis.scrollTo(target, { duration });
    else window.scrollTo({ top: target, behavior: 'smooth' });
  }

  function goTo(id) {
    setMenu(false);
    if (root.classList.contains('no3d')) {
      const map = { start: '#top', about: '#about', interface: '#skills', projets: '#projects', contact: '#contact' };
      const el = $(map[id] || '#top');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    scrollToS(zoneTarget(id));
  }

  $$('[data-goto]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (root.classList.contains('no3d') && el.tagName === 'A') { setMenu(false); return; }
      e.preventDefault();
      goTo(el.dataset.goto);
    });
  });

  /* ---------- Commandes ---------- */
  let steerKeys = 0;
  let steerPad = 0;
  let climbDir = 0;
  const updateSteer = () => { GAME.steer = clamp(steerKeys + steerPad, -1, 1); };
  const isTyping = () => /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(document.activeElement && document.activeElement.tagName) && document.activeElement.closest('form');

  function turbo() {
    if (root.classList.contains('no3d')) return;
    GAME.turboRequest = true;
    sfx('sfxTurbo', 'is-turbo');
    scrollToS(GAME.s + 9, { duration: 0.85 });
  }

  const keys = new Set();
  const readKeys = () => {
    steerKeys = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    climbDir = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
    updateSteer();
  };
  const keyMap = { ArrowLeft: 'left', a: 'left', q: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', z: 'up', ArrowDown: 'down', s: 'down' };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { setMenu(false); setThemeMenu(false); return; }
    if (root.classList.contains('no3d') || isTyping()) return;
    const k = keyMap[e.key] || keyMap[e.key.toLowerCase && e.key.toLowerCase()];
    if (k) { keys.add(k); readKeys(); e.preventDefault(); }
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) turbo(); }
  });
  document.addEventListener('keyup', (e) => {
    const k = keyMap[e.key] || keyMap[e.key.toLowerCase && e.key.toLowerCase()];
    if (k) { keys.delete(k); readKeys(); }
  });
  window.addEventListener('blur', () => { keys.clear(); readKeys(); steerPad = 0; updateSteer(); });

  $$('.pad-btn[data-dir]').forEach((b) => {
    const dir = Number(b.dataset.dir);
    b.addEventListener('pointerdown', (e) => { steerPad = dir; updateSteer(); b.setPointerCapture(e.pointerId); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => { steerPad = 0; updateSteer(); }));
  });
  $('.pad-turbo').addEventListener('pointerdown', (e) => { e.preventDefault(); turbo(); });

  /* ---------- Démarrage du monde 3D ---------- */
  const webglOK = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  })();

  function startGame() {
    track.style.height = `${maxScroll() + window.innerHeight}px`;
    if (window.Lenis && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      lenis = new Lenis({ duration: 1.1, smoothWheel: true, wheelMultiplier: 0.9 });
    }
    window.scrollTo(0, 0);
    main.classList.add('is-empty');
    GAME.paused = false;
    if (typeof GAME.boot === 'function') GAME.boot();
    setTimeout(() => {
      if (!GAME.ready && !root.classList.contains('no3d')) {
        root.classList.add('is-slow');
        $('.loader-text').textContent = I.t('slow');
      }
    }, 12000);
  }

  // Affichage de secours si la 3D est impossible sur l'appareil (pas de choix à faire pour le visiteur)
  GAME.fail = (err) => {
    if (root.classList.contains('no3d')) return;
    console.warn('3D indisponible :', err);
    GAME.paused = true;
    root.classList.add('no3d');
    if (lenis) { lenis.destroy(); lenis = null; }
    track.style.height = '0px';
    zoneEls.forEach((z) => z.classList.remove('is-current'));
    main.classList.remove('is-empty');
    hero.style.opacity = '';
    hero.style.visibility = '';
    window.scrollTo(0, 0);
    toast(I.t('no3d'));
  };

  window.addEventListener('load', () => {
    if (typeof GAME.boot !== 'function' && !GAME.worldPending && !GAME.ready) GAME.fail(new Error('js/world.bundle.js introuvable'));
  });

  window.addEventListener('resize', () => {
    if (!root.classList.contains('no3d')) track.style.height = `${maxScroll() + window.innerHeight}px`;
  });

  /* ---------- Boucle ---------- */
  let lastZone = '';
  let lastProject = -1;

  const zoneAt = (sv) => {
    let id = 'start';
    L.zones.forEach((z) => { if (sv >= z.from - 1) id = z.id; });
    return id;
  };

  function setCurrent(zoneId, projectIndex) {
    let any = false;
    zoneEls.forEach((el) => {
      const on = el.dataset.zone === zoneId && (zoneId !== 'projets' || Number(el.dataset.project) === projectIndex);
      el.classList.toggle('is-current', on);
      if (on) any = true;
    });
    main.classList.toggle('is-empty', !any);
    setSheet(false);
    main.scrollTop = 0;
  }

  function frame(time) {
    if (lenis) lenis.raf(time);

    if (!root.classList.contains('no3d')) {
      root.classList.toggle('is-ready', !!GAME.ready);

      if (climbDir) {
        const target = clamp(currentScroll() + climbDir * 10, 0, maxScroll());
        if (lenis) lenis.scrollTo(target, { immediate: true });
        else window.scrollTo(0, target);
      }

      const p = clamp(currentScroll() / maxScroll(), 0, 1);
      const sv = L.start + p * SPAN;
      GAME.s = sv;

      const heroFade = clamp(1 - sv / 4, 0, 1);
      hero.style.opacity = heroFade;
      hero.style.visibility = heroFade < 0.02 ? 'hidden' : 'visible';
      root.classList.toggle('has-left-start', heroFade < 0.5);

      const zoneId = zoneAt(sv);
      let projectIndex = -1;
      if (zoneId === 'projets') {
        let best = Infinity;
        L.terminals.forEach((t) => {
          const d = Math.abs(t.s - sv);
          if (d < best) { best = d; projectIndex = t.index; }
        });
      }
      if (zoneId !== lastZone || projectIndex !== lastProject) {
        setCurrent(zoneId, projectIndex);
        $('[data-hud-zone]').textContent = zoneId === 'projets'
          ? `${I.pick(T.zones.projets)} · ${projectIndex + 1} / 7`
          : I.pick(T.zones[zoneId]);
        $('[data-hud-place]').textContent = I.pick(T.places[zoneId]);
        altiNodes.forEach((n) => n.classList.toggle('is-current', n.dataset.zone === zoneId));
        if (zoneId === 'contact' && !GAME.won) {
          GAME.won = true;
          toast(I.t('mission'), 'is-win');
          sfx('sfxWin', 'is-win');
        }
        lastZone = zoneId;
        lastProject = projectIndex;
      }

      $('.alti-fill').style.transform = `scaleY(${p})`;
      $('.alti-bit').style.bottom = `${p * 100}%`;
    }
    requestAnimationFrame(frame);
  }

  refreshTexts();
  if (webglOK) startGame();
  else GAME.fail(new Error('WebGL indisponible'));
  requestAnimationFrame(frame);
})();
