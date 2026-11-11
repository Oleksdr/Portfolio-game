/* =========================================================
   Textes de l'interface en français et en anglais.
   Le contenu des panneaux est traduit directement dans
   index.html (balises data-l="fr" / data-l="en").
   ========================================================= */
(() => {
  const STR = {
    fr: {
      skills: 'compétences',
      infoBlocks: 'blocs info',
      plusSkill: '+1 compétence : {x}',
      allSkills: 'Toutes les compétences sont débloquées',
      infoBlock: 'Bloc info : {x}',
      allInfo: 'Tous les blocs info sont trouvés',
      mission: 'Mission accomplie : merci d\'avoir joué',
      loading: 'Chargement du niveau…',
      slow: 'Le chargement prend plus de temps que prévu…',
      no3d: 'La 3D ne peut pas s\'afficher sur cet appareil : voici le contenu.',
      menuOpen: 'Ouvrir le menu',
      menuClose: 'Fermer le menu',
      project: 'Projet {x}',
      turbo: 'Turbo',
      sfxTurbo: 'VROUM !',
      sfxBonus: 'PAF !',
      sfxWin: 'BRAVO !',
      formMissing: 'Remplissez les trois champs pour envoyer votre message.',
      formEmail: 'Adresse email invalide. Vérifiez le format, par exemple nom@domaine.fr.',
      formNoService: 'Le service d\'envoi ne répond pas. Contactez-moi sur LinkedIn en attendant.',
      formSending: 'Envoi en cours…',
      formSent: 'Message envoyé. Je vous réponds rapidement.',
      formError: 'Le message n\'est pas parti. Réessayez ou contactez-moi sur LinkedIn.',
    },
    en: {
      skills: 'skills',
      infoBlocks: 'info blocks',
      plusSkill: '+1 skill: {x}',
      allSkills: 'All skills unlocked',
      infoBlock: 'Info block: {x}',
      allInfo: 'All info blocks found',
      mission: 'Mission complete: thanks for playing',
      loading: 'Loading the level…',
      slow: 'Loading is taking longer than expected…',
      no3d: '3D can\'t be displayed on this device: here is the content.',
      menuOpen: 'Open menu',
      menuClose: 'Close menu',
      project: 'Project {x}',
      turbo: 'Turbo',
      sfxTurbo: 'WHOOSH!',
      sfxBonus: 'POW!',
      sfxWin: 'AWESOME!',
      formMissing: 'Fill in all three fields to send your message.',
      formEmail: 'Invalid email address. Check the format, for example name@domain.com.',
      formNoService: 'The sending service isn\'t responding. Reach me on LinkedIn in the meantime.',
      formSending: 'Sending…',
      formSent: 'Message sent. I\'ll get back to you soon.',
      formError: 'The message didn\'t go through. Try again or reach me on LinkedIn.',
    },
  };

  // Noms affichés dans le niveau (zones, lieux, compétences, blocs info)
  const LEVEL_TEXT = {
    zones: {
      start:     { fr: 'Départ',     en: 'Launch' },
      about:     { fr: 'À propos',   en: 'About' },
      interface: { fr: 'Interface',  en: 'Interface' },
      logique:   { fr: 'Logique',    en: 'Logic' },
      donnees:   { fr: 'Données',    en: 'Data' },
      systeme:   { fr: 'Système',    en: 'System' },
      projets:   { fr: 'Projets',    en: 'Projects' },
      contact:   { fr: 'Contact',    en: 'Contact' },
    },
    places: {
      start:     { fr: 'Le sol',            en: 'Ground' },
      about:     { fr: 'Les nuages',        en: 'Clouds' },
      interface: { fr: 'La stratosphère',   en: 'Stratosphere' },
      logique:   { fr: 'L\'orbite',         en: 'Orbit' },
      donnees:   { fr: 'La Lune',           en: 'The Moon' },
      systeme:   { fr: 'Les astéroïdes',    en: 'Asteroid belt' },
      projets:   { fr: 'Les planètes',      en: 'The planets' },
      contact:   { fr: 'L\'espace profond', en: 'Deep space' },
    },
    skills: {
      html: { fr: 'HTML', en: 'HTML' },
      css: { fr: 'CSS / Sass', en: 'CSS / Sass' },
      js: { fr: 'JavaScript', en: 'JavaScript' },
      javafx: { fr: 'JavaFX', en: 'JavaFX' },
      maquettage: { fr: 'Maquettage', en: 'Wireframing' },
      java: { fr: 'Java', en: 'Java' },
      php: { fr: 'PHP', en: 'PHP' },
      cpp: { fr: 'C++', en: 'C++' },
      c: { fr: 'C', en: 'C' },
      poo: { fr: 'Programmation objet', en: 'Object-oriented programming' },
      sql: { fr: 'SQL', en: 'SQL' },
      postgresql: { fr: 'PostgreSQL', en: 'PostgreSQL' },
      modelisation: { fr: 'Modélisation', en: 'Data modelling' },
      r: { fr: 'R', en: 'R' },
      linux: { fr: 'Linux', en: 'Linux' },
      bash: { fr: 'Bash', en: 'Bash' },
      ssh: { fr: 'SSH', en: 'SSH' },
      apache: { fr: 'Apache', en: 'Apache' },
    },
    bonuses: {
      grenoble:  { fr: 'Basé à Grenoble, au pied des Alpes', en: 'Based in Grenoble, at the foot of the Alps' },
      formation: { fr: 'En 2e année de BUT Informatique à l\'IUT2 Grenoble Alpes', en: '2nd-year BUT in Computer Science at IUT2 Grenoble Alpes' },
      equipe:    { fr: 'Des projets d\'équipe jusqu\'à 7 personnes', en: 'Team projects with up to 7 people' },
      projets:   { fr: '7 projets menés à l\'IUT, seul ou en équipe', en: '7 projects carried out at the IUT, solo or in a team' },
      serveur:   { fr: 'Un serveur Linux monté seul, de la VM jusqu\'à Apache', en: 'A Linux server set up solo, from the VM to Apache' },
      objectif:  { fr: 'Objectif : devenir développeur fullstack', en: 'Goal: become a full-stack developer' },
    },
  };

  const getLang = () => (document.documentElement.lang === 'en' ? 'en' : 'fr');

  window.I18N = {
    STR,
    LEVEL_TEXT,
    lang: getLang,
    t(key, x) {
      const s = (STR[getLang()] && STR[getLang()][key]) || STR.fr[key] || key;
      return x === undefined ? s : s.replace('{x}', x);
    },
    pick(map) {
      return map ? (map[getLang()] || map.fr) : '';
    },
  };
})();
