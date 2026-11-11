/* =========================================================
   Niveau vertical : Bit décolle du sol et monte vers l'espace.
   La progression « s » est l'altitude (1 unité = 1 unité 3D).
   Partagé par app.js et la scène 3D.
   ========================================================= */
(() => {
  // Étapes de l'ascension (altitude de début et de fin)
  const zones = [
    { id: 'start',     from: 0,   to: 10 },
    { id: 'about',     from: 10,  to: 36 },
    { id: 'interface', from: 36,  to: 76 },
    { id: 'logique',   from: 76,  to: 116 },
    { id: 'donnees',   from: 116, to: 150 },
    { id: 'systeme',   from: 150, to: 184 },
    { id: 'projets',   from: 184, to: 270 },
    { id: 'contact',   from: 270, to: 300 },
  ];
  const zone = (id) => zones.find((z) => z.id === id);

  // Trajectoire : un léger slalom pour que le vol reste vivant
  const pathX = (s) => Math.sin(s * 0.075) * 2.4 + Math.sin(s * 0.023) * 1.2;

  // Compétences : réparties dans leur étape
  const skillsBy = {
    interface: ['html', 'css', 'js', 'javafx', 'maquettage'],
    logique: ['java', 'php', 'cpp', 'c', 'poo'],
    donnees: ['sql', 'postgresql', 'modelisation', 'r'],
    systeme: ['linux', 'bash', 'ssh', 'apache'],
  };
  const items = [];
  Object.entries(skillsBy).forEach(([zid, ids]) => {
    const z = zone(zid);
    const step = (z.to - z.from) / (ids.length + 0.6);
    ids.forEach((id, i) => {
      const s = z.from + step * (i + 0.9);
      items.push({ id, zone: zid, s, x: pathX(s) + (i % 2 ? 0.7 : -0.7), y: s + 1.1 });
    });
  });

  // Blocs info : sur le côté, il faut aller les chercher (← →)
  const bonusAt = [
    ['grenoble', 'about', 0.55, 1],
    ['formation', 'interface', 0.5, -1],
    ['equipe', 'logique', 0.45, 1],
    ['projets', 'donnees', 0.55, -1],
    ['serveur', 'systeme', 0.5, 1],
    ['objectif', 'contact', 0.3, -1],
  ];
  const bonuses = bonusAt.map(([id, zid, k, side]) => {
    const z = zone(zid);
    const s = z.from + (z.to - z.from) * k;
    return { id, zone: zid, s, x: pathX(s) + side * 3.8, y: s + 1.2, side };
  });

  // Projets : 7 stations holographiques, alternativement à gauche et à droite
  const pz = zone('projets');
  const terminals = Array.from({ length: 7 }, (_, i) => {
    const s = pz.from + 7 + i * 11.5;
    const side = i % 2 ? 1 : -1;
    return { index: i, s, x: pathX(s) + side * 4.6, y: s + 1.4, side };
  });

  const goal = 292;

  window.LEVEL = {
    zones,
    items,
    bonuses,
    terminals,
    pathX,
    start: 0,
    goal,
    stationY: goal,
    pxPerUnit: 62, // hauteur de défilement par unité d'altitude
  };
})();
