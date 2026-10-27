/* Tests des deux espaces (Le Grand Été / Tuteur). Charge réellement data.js puis
   app.js dans un DOM simulé : un onglet mal orthographié dans ESPACES donnerait un
   bouton qui ne fait rien, et rien ne le signalerait en production. */
import fs from 'fs';
import path from 'path';

const RACINE = process.argv[2];
let ko = 0, ok = 0;
const vrai = (nom, c, info) => { if (c) { ok++; } else { ko++; console.log('  ✗ ' + nom + (info ? '\n     ' + info : '')); } };
const eq = (nom, a, b) => vrai(nom, JSON.stringify(a) === JSON.stringify(b), 'attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a));

const UA_CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const UA_SAMSUNG = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36';
const UA_FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0';
const UA_CHROME_BUREAU = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
const UA_FIREFOX_BUREAU = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/130.0 Firefox/130.0';

function chargeApp(profil, options) {
  const opt = options || {};
  const elements = {};
  const el = id => elements[id] || (elements[id] = {
    id, innerHTML: '', textContent: '', value: '', disabled: false, dataset: {}, style: {},
    classList: {
      _c: new Set(),
      add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); },
      toggle(c, v) { if (v) this._c.add(c); else this._c.delete(c); },
      contains(c) { return this._c.has(c); },
    },
    click() {}, focus() {}, appendChild() {}, remove() {},
  });
  const doc = {
    querySelector: s => el(String(s).replace(/^#/, '')),
    querySelectorAll: () => [],
    getElementById: id => el(id),
    createElement: () => el('tmp-' + Math.random()),
    addEventListener() {},
    body: { className: '', appendChild() {}, removeChild() {} },
  };
  // matchMedia sert à savoir si l'app tourne déjà installée (display-mode: standalone)
  const defilements = [];
  const ecouteursWin = {};
  const win = {
    matchMedia: () => ({ matches: !!opt.installee }),
    scrollTo: (x, y) => defilements.push([x, y]),
    addEventListener: (t, h) => { ecouteursWin[t] = h; },
  };
  /* Reconnaissance vocale simulée. opt.micro : le navigateur sait écouter. On garde ce
     qu'on lui demande, pour vérifier qu'on écoute bien en français et qu'on s'arrête
     au silence plutôt que de laisser le micro ouvert. */
  const micros = [];
  if (opt.micro) {
    win.webkitSpeechRecognition = function () {
      const r = { lang: '', continuous: null, interimResults: null, demarre: 0, arrets: 0,
        start() { this.demarre++; }, stop() { this.arrets++; } };
      micros.push(r);
      return r;
    };
  }
  // sessionStorage : survit au rechargement du même onglet, pas à la fermeture
  const session = Object.assign({}, opt.session || {});
  const sessionStorage = {
    getItem: k => (k in session ? session[k] : null),
    setItem: (k, v) => { session[k] = String(v); },
    removeItem: k => { delete session[k]; },
  };
  const rechargements = [];
  const location = { reload: () => rechargements.push(1), protocol: 'https:' };
  const nav = { userAgent: opt.ua || 'Test', standalone: !!opt.iosInstallee };
  // data.js tel quel : les fonctions de rendu lisent window.DATA
  new Function('window', fs.readFileSync(path.join(RACINE, 'data.js'), 'utf8'))(win);

  const src = fs.readFileSync(path.join(RACINE, 'app.js'), 'utf8');
  const stockage = { getItem: () => null, setItem() {}, removeItem() {} };
  const appels = [];
  const bouchon = nom => (...a) => { appels.push({ nom, a }); };
  /* cours.js répond pour l'année scolaire : app.js ne connaît ni les matières ni les
     tables des cours, il les demande. opt.mats / opt.annee règlent la réponse. */
  /* La voix de l'assistant vit dans lecture.js (un seul moteur de lecture pour toute
     l'app). Ici on la simule pour vérifier ce qui relève d'app.js : le bouton est-il
     proposé, la réponse est-elle dite, la voix se taît-elle quand on part ?
     o.voix : l'appareil sait parler. */
  const dits = [], vxArrets = [];
  const f = new Function('window', 'document', 'localStorage', 'console', 'fetch', 'setTimeout',
    'coursBadgeEspace', 'renderCours', 'renderMots', 'fillCoursParentCard', 'fillMotsParentCard', 'Image', 'URL', 'navigator',
    'sessionStorage', 'location', 'matieresInterro', 'interroAnnee',
    'vxDispo', 'vxBtn', 'vxCharge', 'vxStop', 'vxAuto', 'vxDire',
    src + '\n;return {TABS, ESPACES, showEspaces, enterEspace, showTab, buildNav, majEnTete, '
    + 'majInstall, htmlInstall, estInstallee, estIPhone, estMobile, estChromium, '
    + 'lancerInstall, aideInstallIPhone, aideInstallManuelle, navInstall, '
    + 'selectProfile, logout, SES, '
    + 'GE_SUJETS, joursVus, contexteEte, openInterroMenu, interroSujets, lancerInterro, arreterInterro, '
    + 'niveauScolaire, renderChat, drawChat, sendChat, vxDireMsg, micDispo, micBtn, micToggle, micStop, '
    + 'get espace(){return espace}, set espace(v){espace=v}, get child(){return child}, set child(v){child=v}, '
    + 'get assistantName(){return assistantName}, set assistantName(v){assistantName=v}, '
    + 'get niveauVu(){return niveauVu}, set niveauVu(v){niveauVu=v}, '
    + 'get quizMode(){return quizMode}, get quizSujet(){return quizSujet}, get quizCtx(){return quizCtx}, '
    + 'get chatMsgs(){return chatMsgs}, '
    + 'get tab(){return tab}};');
  const C = f(win, doc, stockage, { log() {}, warn() {}, error() {} }, async () => ({ json: async () => (opt.reponse || {}) }),
    fn => { appels.push({ nom: 'setTimeout' }); return 0; },
    bouchon('coursBadgeEspace'), bouchon('renderCours'), bouchon('renderMots'), bouchon('fillCoursParentCard'), bouchon('fillMotsParentCard'),
    function () { return {}; }, { createObjectURL: () => '', revokeObjectURL() {} }, nav,
    sessionStorage, location,
    async () => opt.mats || [{ id: 'histoire', emoji: '🏛️', label: 'Histoire', cours: 2 },
                              { id: 'svt', emoji: '🌱', label: 'SVT', cours: 0 }],
    async mat => opt.annee === null ? null : (opt.annee || { emoji: '🏛️', label: 'Histoire', ctx: 'ANNÉE SCOLAIRE — Histoire. ' + mat }),
    () => !!opt.voix,
    () => (opt.voix ? '<button class="btn ghost" id="vx-btn" onclick="vxBascule()">🔇 Sa voix : non</button>' : ''),
    () => {}, () => vxArrets.push(1), t => dits.push({ auto: true, t }), t => dits.push({ auto: false, t }));
  C.child = profil || 'alix';
  return { C, el, elements, appels, win, defilements, session, ecouteursWin, rechargements, micros, dits, vxArrets };
}

/* ---------- cohérence du découpage ---------- */
console.log('\n— les onglets déclarés existent et sont routés —');
{
  const { C } = chargeApp('adam');
  const src = fs.readFileSync(path.join(RACINE, 'app.js'), 'utf8');
  // la table de routage de showTab : {programme:renderProgramme, cours:renderCours, ...}
  const routeur = (src.match(/\(\{programme:renderProgramme[^}]*\}\[t\]\)/) || [''])[0];
  const routes = (routeur.match(/([a-z0-9]+):render/g) || []).map(s => s.replace(':render', ''));
  vrai('la table de routage a été trouvée', routes.length > 5, routes.join(','));

  ['adam', 'alix'].forEach(enfant => {
    Object.keys(C.ESPACES).forEach(k => {
      C.ESPACES[k].tabs(enfant).forEach(t => {
        vrai(`[${enfant}/${k}] « ${t} » est déclaré dans TABS`, !!C.TABS[t]);
        vrai(`[${enfant}/${k}] « ${t} » est routé par showTab`, routes.includes(t));
      });
    });
  });
}

console.log('\n— aucun onglet en double, aucun onglet perdu —');
{
  const { C } = chargeApp('adam');
  ['adam', 'alix'].forEach(enfant => {
    const ete = C.ESPACES.ete.tabs(enfant);
    const tut = C.ESPACES.tuteur.tabs(enfant);
    const double = ete.filter(t => tut.includes(t));
    eq(`[${enfant}] aucun onglet dans les deux espaces`, double, []);

    // tout ce que l'enfant avait avant la séparation doit rester atteignable ;
    // « aide » (le guide du Tuteur) s'y ajoute volontairement
    const avant = enfant === 'adam'
      ? ['programme', 'cours', 'mots', 'quiz', 'geo', 'orientation', 'les100', 'checklist', 'projet', 'fabrique', 'chat', 'guide']
      : ['programme', 'cours', 'mots', 'quiz', 'geo', 'les100', 'checklist', 'projet', 'fabrique', 'chat', 'guide'];
    const attendus = avant.concat(['aide']);
    const apres = ete.concat(tut);
    eq(`[${enfant}] aucun onglet perdu dans la réorganisation`, avant.filter(t => !apres.includes(t)), []);
    eq(`[${enfant}] aucun onglet apparu par erreur`, apres.filter(t => !attendus.includes(t)), []);
  });
  eq("l'orientation reste réservée à Adam", C.ESPACES.ete.tabs('alix').includes('orientation'), false);
  vrai("l'orientation est bien dans Le Grand Été pour Adam", C.ESPACES.ete.tabs('adam').includes('orientation'));
  eq('Tuteur : cours, mots, checklist, assistant, guide', C.ESPACES.tuteur.tabs('alix'), ['cours', 'mots', 'checklist', 'chat', 'aide']);
  eq('le guide du Grand Été reste dans Le Grand Été', C.ESPACES.ete.tabs('alix').includes('guide'), true);
}

/* ---------- l'écran des deux cartes ---------- */
console.log('\n— rendu de l\'écran des espaces —');
{
  const { C, el, appels } = chargeApp('alix');
  C.showEspaces();
  const h = el('main').innerHTML;
  vrai('du HTML est produit', h.length > 100);
  vrai("pas d'undefined affiché", !/undefined/.test(h), (h.match(/.{0,40}undefined.{0,40}/) || [])[0]);
  vrai('pas de gabarit non interprété', !/\$\{/.test(h));
  vrai('les deux cartes sont là', /Le Grand Été/.test(h) && /Tuteur/.test(h));
  vrai('elles sont cliquables', /enterEspace\('ete'\)/.test(h) && /enterEspace\('tuteur'\)/.test(h));
  vrai("l'enfant est salué par son prénom", /Salut Alix/.test(h));
  vrai('la pastille des révisions a sa place réservée', /id="espace-tuteur-info"/.test(h));
  vrai("la proposition d'installation a sa place réservée", /id="install-slot"/.test(h));
  vrai('la barre d\'onglets est masquée', el('nav').classList.contains('hidden'));
  vrai('les notions à revoir sont demandées à cours.js', appels.some(a => a.nom === 'coursBadgeEspace'));
  vrai("l'en-tête ne porte aucun espace", el('hdr-who').textContent === '🦊 Alix', el('hdr-who').textContent);
}

console.log('\n— entrer dans un espace —');
{
  const { C, el } = chargeApp('adam');
  C.showEspaces();
  C.enterEspace('tuteur');
  vrai("l'espace courant est mémorisé", C.espace === 'tuteur');
  vrai('la barre d\'onglets réapparaît', !el('nav').classList.contains('hidden'));
  const nav = el('navbar').innerHTML;
  vrai('la barre ne contient que les onglets du Tuteur', /nav-cours/.test(nav) && /nav-mots/.test(nav) && /nav-checklist/.test(nav) && /nav-chat/.test(nav) && /nav-aide/.test(nav));
  vrai('elle ne contient rien du Grand Été', !/nav-programme/.test(nav) && !/nav-quiz/.test(nav) && !/nav-geo/.test(nav));
  eq('cinq onglets, pas plus', (nav.match(/<button/g) || []).length, 5);
  vrai("l'en-tête indique où on se trouve", /Adam · 🎓 Tuteur/.test(el('hdr-who').textContent), el('hdr-who').textContent);
  vrai('le premier onglet est ouvert', C.tab === 'cours');

  C.enterEspace('ete');
  const nav2 = el('navbar').innerHTML;
  vrai('Le Grand Été ouvre sur le programme', C.tab === 'programme');
  vrai('Adam y retrouve son orientation', /nav-orientation/.test(nav2));
  vrai('les cours ne sont pas dans Le Grand Été', !/nav-cours/.test(nav2));
  vrai("l'en-tête a suivi", /Adam · 🌞 Le Grand Été/.test(el('hdr-who').textContent), el('hdr-who').textContent);

  C.showEspaces();
  vrai('le retour à l\'accueil efface l\'espace courant', C.espace === null);
  vrai("et nettoie l'en-tête", el('hdr-who').textContent === '🐉 Adam', el('hdr-who').textContent);
}

/* ---------- retrouver sa place après un rechargement subi ----------
   Android détruit l'onglet quand la mémoire manque — systématiquement pendant une photo
   sur le téléphone de la maison. Au retour, la page se recharge : elle doit remettre
   l'enfant là où il était, sans jamais court-circuiter l'écran des profils d'un vrai
   démarrage ni le code du parent. */
console.log('\n— reprendre où on en était après un rechargement —');
{
  const { C, session } = chargeApp('alix');
  C.selectProfile('alix');
  C.enterEspace('tuteur');
  C.showTab('mots');
  eq("l'enfant est noté dans la session", session.adalix_s_child, 'alix');
  eq("l'espace aussi", session.adalix_s_espace, 'tuteur');
  eq("et l'onglet", session.adalix_s_tab, 'mots');

  // revenir au choix des espaces oublie l'espace, pas l'enfant
  C.showEspaces();
  eq("le retour à l'accueil oublie l'espace", session.adalix_s_espace, '');
  eq("mais se souvient de l'enfant", session.adalix_s_child, 'alix');
}

{
  // « changer » doit vraiment changer : sinon le rechargement restaurerait le profil
  const { C, session, rechargements } = chargeApp('adam');
  C.selectProfile('adam');
  C.logout();
  vrai('« changer » efface la session', !session.adalix_s_child, JSON.stringify(session));
  eq('et recharge la page', rechargements.length, 1);
}

{
  // rechargement subi : on remet l'enfant exactement où il était
  const { C, el, ecouteursWin, appels } = chargeApp('alix', {
    session: { adalix_s_child: 'alix', adalix_s_espace: 'tuteur', adalix_s_tab: 'checklist' },
  });
  C.child = null;
  vrai("le gestionnaire de démarrage est bien posé", typeof ecouteursWin.load === 'function');
  ecouteursWin.load();
  eq("l'enfant est retrouvé", C.child, 'alix');
  eq("l'espace est retrouvé", C.espace, 'tuteur');
  eq("l'onglet est retrouvé", C.tab, 'checklist');
  vrai("l'écran des profils est passé", el('screen-profile').classList.contains('hidden'));
  // un seul rendu : ouvrir l'onglet par défaut PUIS le bon lançait deux rendus
  // asynchrones en course, et le plus lent écrasait l'autre à l'écran
  vrai("l'onglet par défaut n'est jamais rendu au passage",
    !appels.some(a => a.nom === 'renderCours'), JSON.stringify(appels.map(a => a.nom)));
}

{
  // vrai démarrage : rien en session, on demande qui c'est
  const { C, el, ecouteursWin } = chargeApp('alix');
  C.child = null;
  ecouteursWin.load();
  vrai('sans session, aucun profil restauré', C.child === null, String(C.child));
  vrai("l'écran des profils reste affiché", !el('screen-profile').classList.contains('hidden'));
}

{
  // le parent est protégé par un code : jamais restauré automatiquement
  const { C, el, ecouteursWin } = chargeApp('alix', { session: { adalix_s_child: 'parent' } });
  C.child = null;
  ecouteursWin.load();
  vrai("le parent n'est jamais restauré sans son code", C.child === null, String(C.child));
  vrai("l'écran des profils reste affiché", !el('screen-profile').classList.contains('hidden'));
}

{
  // un onglet qui n'existe pas dans l'espace enregistré ne doit pas tout casser
  const { C, ecouteursWin } = chargeApp('alix', {
    session: { adalix_s_child: 'alix', adalix_s_espace: 'tuteur', adalix_s_tab: 'quiz' },
  });
  C.child = null;
  ecouteursWin.load();
  eq("on entre quand même dans l'espace", C.espace, 'tuteur');
  eq("et on ouvre son premier onglet", C.tab, 'cours');
}

{
  // un espace supprimé entre deux versions ne doit pas tout casser non plus
  const { C, ecouteursWin } = chargeApp('alix', {
    session: { adalix_s_child: 'alix', adalix_s_espace: 'nexistepas' },
  });
  C.child = null;
  ecouteursWin.load();
  eq("l'enfant est quand même retrouvé", C.child, 'alix');
  vrai("et on le laisse sur l'écran des espaces", C.espace === null, String(C.espace));
}

console.log('\n— changer de page ramène en haut —');
{
  // sinon on ouvre « Ma journée » au milieu de la liste, titre et compteur hors écran
  const { C, defilements } = chargeApp('alix');
  C.showEspaces();
  C.enterEspace('tuteur');
  vrai("entrer dans un espace remonte en haut", defilements.some(d => d[0] === 0 && d[1] === 0),
    JSON.stringify(defilements));

  const avant = defilements.length;
  C.showTab('checklist');
  vrai("changer d'onglet remonte en haut", defilements.length > avant);
  eq('on remonte bien tout en haut', defilements[defilements.length - 1], [0, 0]);

  const avant2 = defilements.length;
  C.showEspaces();
  vrai("revenir au choix des espaces remonte aussi", defilements.length > avant2);
}

console.log('\n— un espace inconnu ne casse rien —');
{
  const { C, el } = chargeApp('alix');
  C.showEspaces();
  C.enterEspace('nimportequoi');
  vrai('aucun changement d\'espace', C.espace === null);
  vrai('la barre reste masquée', el('nav').classList.contains('hidden'));
}

/* ---------- proposer d'installer l'app ----------
   Règle : jamais de bouton qui ne marche pas. On ne le montre que si le navigateur a
   annoncé qu'il savait installer (beforeinstallprompt), ou sur iPhone où l'on explique
   le geste à la main — et jamais si l'app tourne déjà installée. */
console.log('\n— proposer d\'installer l\'app —');
{
  const { C, el, win } = chargeApp('alix');
  C.showEspaces();
  vrai("l'emplacement est vide tant que le navigateur n'a rien annoncé", el('install-slot').innerHTML === '',
    el('install-slot').innerHTML);
  vrai("aucun bouton d'installation inutile sur l'écran", !/install-card/.test(el('main').innerHTML));

  // le navigateur se décide, éventuellement après le premier rendu
  win.__pwaPrompt = { prompt() { this.appelee = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
  C.majInstall();
  const h = el('install-slot').innerHTML;
  vrai('le bouton apparaît', /install-card/.test(h));
  vrai('il est cliquable', /lancerInstall\(\)/.test(h));
  vrai("pas d'undefined affiché", !/undefined/.test(h), h);
  vrai('pas de gabarit non interprété', !/\$\{/.test(h));
  vrai("il ne renvoie pas vers les instructions iPhone", !/aideInstallIPhone/.test(h));
}

{
  // app déjà installée : plus rien à proposer, même si le navigateur insiste
  const { C, el, win } = chargeApp('adam', { installee: true });
  win.__pwaPrompt = { prompt() {}, userChoice: Promise.resolve({ outcome: 'accepted' }) };
  C.showEspaces();
  vrai("l'app installée reconnaît son état", C.estInstallee() === true);
  vrai('aucune proposition quand c\'est déjà installé', el('install-slot').innerHTML === '',
    el('install-slot').innerHTML);
}

{
  // iOS installé via « Sur l'écran d'accueil » : navigator.standalone
  const { C } = chargeApp('alix', { iosInstallee: true });
  vrai('le cas iOS installé est reconnu', C.estInstallee() === true);
}

{
  // iPhone pas encore installé : Safari n'émet jamais l'événement, on explique le geste
  const { C, el } = chargeApp('alix', { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15' });
  vrai("l'iPhone est reconnu", C.estIPhone() === true);
  C.showEspaces();
  const h = el('install-slot').innerHTML;
  vrai('le bouton d\'aide apparaît', /install-card/.test(h));
  vrai('il ouvre les instructions', /aideInstallIPhone\(\)/.test(h));
  vrai("il n'essaie pas d'ouvrir une boîte de dialogue qui n'existe pas", !/lancerInstall/.test(h));

  C.aideInstallIPhone();
  const m = el('modal-root').innerHTML;
  vrai('les instructions parlent du bouton Partager', /Partager/.test(m));
  vrai("et de « Sur l'écran d'accueil »", /écran d'accueil/.test(m));
  vrai('pas de gabarit non interprété dans les instructions', !/\$\{/.test(m));
}

{
  // le clic : la boîte du navigateur s'ouvre, et l'événement ne se rejoue pas
  const { C, el, win } = chargeApp('alix');
  let appelee = false;
  win.__pwaPrompt = { prompt() { appelee = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
  C.showEspaces();
  await C.lancerInstall();
  vrai('la boîte de dialogue du navigateur a été ouverte', appelee);
  vrai("l'événement est consommé, pas rejoué", !win.__pwaPrompt);
  vrai("et la proposition disparaît de l'écran", el('install-slot').innerHTML === '', el('install-slot').innerHTML);

  // deuxième clic sans événement : ne doit pas planter
  await C.lancerInstall();
  vrai('un clic sans événement ne casse rien', true);
}

/* ---------- quand le navigateur ne propose rien de lui-même ----------
   Adam a ouvert l'app sur son téléphone et n'a vu AUCUNE proposition d'installation
   (27/10/2026). Seuls les navigateurs Chromium émettent « beforeinstallprompt » :
   ailleurs on ne montrait rien du tout, alors que tous ces navigateurs savent ajouter
   la page à l'écran d'accueil par leur menu. On montre donc le geste à faire. */
console.log('\n— installer quand le navigateur ne dit rien —');
{
  const { C, el } = chargeApp('adam', { ua: UA_CHROME_ANDROID });
  C.showEspaces();
  const h = el('install-slot').innerHTML;
  vrai('un téléphone voit quand même la proposition', /install-card/.test(h), h);
  vrai('elle ouvre les instructions', /aideInstallManuelle\(\)/.test(h));
  vrai("elle n'essaie pas d'ouvrir une boîte de dialogue absente", !/lancerInstall/.test(h));
  vrai("pas d'undefined affiché", !/undefined/.test(h), h);
  vrai('pas de gabarit non interprété', !/\$\{/.test(h));

  C.aideInstallManuelle();
  const m = el('modal-root').innerHTML;
  vrai('les instructions nomment le navigateur', /Chrome/.test(m), m.slice(0, 200));
  vrai("et le geste exact", /écran d'accueil/i.test(m) || /Installer l'application/.test(m));
  // Chrome sait normalement proposer l'installation : lui conseiller « ouvre dans
  // Chrome » serait absurde, on lui dit de recharger
  vrai('un Chromium se voit conseiller de recharger', /Recharge la page/.test(m), m.slice(-400));
  vrai("et pas d'aller chercher Chrome, où il est déjà", !/dans <b>Chrome<\/b>/.test(m));
  vrai('pas de gabarit non interprété', !/\$\{/.test(m));
  vrai("pas d'undefined", !/undefined/.test(m));
}
{
  // Samsung Internet : jamais d'événement, et un menu qui ne s'appelle pas comme ailleurs
  const { C, el } = chargeApp('adam', { ua: UA_SAMSUNG });
  C.showEspaces();
  vrai('Samsung Internet voit la proposition', /install-card/.test(el('install-slot').innerHTML));
  C.aideInstallManuelle();
  const m = el('modal-root').innerHTML;
  vrai('on lui donne SON geste', /Samsung Internet/.test(m) && /Ajouter la page à/.test(m), m.slice(0, 300));
  vrai("et le repli reste d'ouvrir la page dans Chrome", /adalix-knowledge\.vercel\.app/.test(m));
}
{
  // Firefox Android : sait installer, ne l'annonce jamais
  const { C, el } = chargeApp('alix', { ua: UA_FIREFOX_ANDROID });
  C.showEspaces();
  vrai('Firefox Android voit la proposition', /install-card/.test(el('install-slot').innerHTML));
  C.aideInstallManuelle();
  vrai('avec son propre menu', /Firefox/.test(el('modal-root').innerHTML));
}
{
  // Chromium de bureau : l'icône est dans la barre d'adresse, personne ne la voit
  const { C, el } = chargeApp('adam', { ua: UA_CHROME_BUREAU });
  C.showEspaces();
  vrai('un Chrome de bureau voit la proposition', /install-card/.test(el('install-slot').innerHTML));
  C.aideInstallManuelle();
  const m = el('modal-root').innerHTML;
  vrai("on lui montre la barre d'adresse", /barre d'adresse/.test(m), m.slice(0, 300));
}
{
  // Firefox de bureau ne sait pas installer : on ne promet rien
  const { C, el } = chargeApp('alix', { ua: UA_FIREFOX_BUREAU });
  C.showEspaces();
  vrai('aucune proposition sur un navigateur qui ne sait pas installer',
    el('install-slot').innerHTML === '', el('install-slot').innerHTML);
}
{
  // app déjà installée : rien, quel que soit le navigateur
  const { C, el } = chargeApp('adam', { ua: UA_CHROME_ANDROID, installee: true });
  C.showEspaces();
  vrai('rien à proposer quand c\'est déjà installé', el('install-slot').innerHTML === '');
}
{
  /* L'écran « Qui es-tu ? » est le PREMIER que voit celui qui ouvre l'app : c'est là
     qu'Adam a cherché. La proposition doit s'y afficher sans attendre un profil. */
  const { C, el, ecouteursWin } = chargeApp('adam', { ua: UA_CHROME_ANDROID });
  C.child = null;
  ecouteursWin.load();
  const h = el('install-slot-accueil').innerHTML;
  vrai("l'écran des profils propose l'installation", /install-card/.test(h), h);
  vrai('sur fond sombre, la carte change de livrée', /sur-sombre/.test(h));
  vrai('pas de gabarit non interprété', !/\$\{/.test(h));
}

/* ---------- Interroge-moi : sur quoi ? ----------
   Le mode révision envoyait tout le programme d'été en vrac, et l'année scolaire
   n'était pas révisable du tout. On choisit l'espace, puis le sujet. */
console.log('\n— Interroge-moi : choisir l\'espace puis le sujet —');
{
  const { C, el } = chargeApp('alix');
  C.openInterroMenu();
  const m = el('modal-root').innerHTML;
  vrai('les deux espaces sont proposés', /Le Grand Été/.test(m) && /année scolaire/.test(m));
  vrai('et seulement eux', (m.match(/choix-row/g) || []).length === 2, m);
  vrai('chacun mène à ses sujets', /interroSujets\('ete'\)/.test(m) && /interroSujets\('annee'\)/.test(m));
  vrai("pas d'undefined", !/undefined/.test(m), m);
  vrai('pas de gabarit non interprété', !/\$\{/.test(m));
}
{
  const { C, el } = chargeApp('alix');
  C.interroSujets('ete');
  const m = el('modal-root').innerHTML;
  vrai('les grands thèmes sont proposés', /Géographie/.test(m) && /esprit critique/i.test(m) && /personnalités/.test(m));
  vrai('chacun dit combien il contient', /journées/.test(m) && /personnalités<\/span>|personnalités/.test(m));
  vrai('chacun lance une interro', /lancerInterro\('ete','geo'\)/.test(m));
  vrai('« un peu de tout » reste possible', /lancerInterro\('ete','tout'\)/.test(m));
  vrai('on peut revenir en arrière', /openInterroMenu\(\)/.test(m));
  vrai("pas d'undefined", !/undefined/.test(m), (m.match(/.{0,40}undefined.{0,40}/) || [])[0]);
  vrai('pas de gabarit non interprété', !/\$\{/.test(m));
}
{
  /* Aucun thème vide ne doit être proposé : un bouton qui mène à une interro sans
     matière est exactement le genre de bouton qu'on ne met pas. */
  ['adam', 'alix'].forEach(enfant => {
    const { C } = chargeApp(enfant);
    const jours = C.joursVus();
    vrai(`[${enfant}] les journées déjà passées sont connues`, jours.length > 20, String(jours.length));
    const pleins = C.GE_SUJETS.filter(s => s.lignes(jours).length > 0);
    vrai(`[${enfant}] il reste largement de quoi réviser`, pleins.length >= 9, String(pleins.length));
    pleins.forEach(s => vrai(`[${enfant}] « ${s.label} » ne produit que du texte`,
      s.lignes(jours).every(x => typeof x === 'string' && x.length > 2)));
    // la semaine 5 se différencie par enfant : l'histoire de l'art est le programme
    // d'Alix, l'argent celui d'Adam. Le thème de l'autre ne doit pas être proposé vide.
    const a = s => (C.GE_SUJETS.find(x => x.id === s).lignes(jours) || []).length;
    if (enfant === 'alix') vrai('Alix a sa danse, ses arts et sa pop culture', a('arts') === 4, String(a('arts')));
    else vrai("Adam n'a pas de thème « arts » à réviser, et on ne le lui propose pas", a('arts') === 0);
  });
  // un thème reste dans son thème : la géographie ne doit pas ramasser la géopolitique
  const { C } = chargeApp('alix');
  const jours = C.joursVus();
  const geo = C.GE_SUJETS.find(s => s.id === 'geo').lignes(jours).join(' ');
  vrai('la géographie ne ramasse pas la géopolitique', !/Géopolitique/.test(geo), geo);
  const arts = C.GE_SUJETS.find(s => s.id === 'arts').lignes(jours).join(' ');
  vrai("« Qui écrit l'histoire ? » et l'histoire de l'art sont bien séparées",
    !/Qui écrit l'histoire/.test(arts), arts);
  const hist = C.GE_SUJETS.find(s => s.id === 'histoire').lignes(jours).join(' ');
  vrai("et réciproquement", !/Histoire de l'art|Histoire de la danse/.test(hist), hist);
}
{
  const { C, el } = await (async () => {
    const h = chargeApp('alix');
    await h.C.interroSujets('annee');
    return h;
  })();
  const m = el('modal-root').innerHTML;
  vrai('les matières sont proposées', /Histoire/.test(m) && /SVT/.test(m));
  vrai('celles avec des cours le disent', /2 cours photographiés/.test(m), m);
  vrai('les autres annoncent le programme de sa classe', /programme de 6e/.test(m), m);
  vrai('chacune lance une interro', /lancerInterro\('annee','svt'\)/.test(m));
  vrai("pas d'undefined", !/undefined/.test(m), (m.match(/.{0,40}undefined.{0,40}/) || [])[0]);
  vrai('pas de gabarit non interprété', !/\$\{/.test(m));
}
{
  // le niveau vient de ses cahiers quand on l'y a lu, de son âge sinon
  const { C } = chargeApp('adam');
  vrai("à défaut, le niveau vient de son âge", C.niveauScolaire() === '4e', C.niveauScolaire());
  C.niveauVu = '3e';
  vrai('le niveau lu sur ses cours gagne', C.niveauScolaire() === '3e', C.niveauScolaire());
}
{
  // lancer une interro du Grand Été : le contexte est figé, et il tient au sujet
  const { C, el } = chargeApp('alix');
  C.assistantName = 'Nova';
  await C.lancerInterro('ete', 'geo');
  vrai('le mode révision est actif', C.quizMode === true);
  vrai('le sujet est retenu', C.quizSujet && C.quizSujet.id === 'geo', JSON.stringify(C.quizSujet));
  vrai('le contexte nomme le thème', /Géographie/.test(C.quizCtx), C.quizCtx.slice(0, 120));
  vrai('le contexte ne contient QUE ce thème', !/Géopolitique/.test(C.quizCtx), C.quizCtx);
  vrai('le contexte est du texte, pas un gabarit', !/\$\{/.test(C.quizCtx));
  vrai('le bouton annonce le sujet et propose de sortir',
    /arrêter/.test(el('main').innerHTML) && /Géographie/.test(el('main').innerHTML));

  C.arreterInterro();
  vrai('arrêter remet le bouton à zéro', C.quizMode === false && C.quizSujet === null && C.quizCtx === '');
  vrai('et le bouton redevient une invitation', /🎓 Interroge-moi/.test(el('main').innerHTML));
}
{
  // année scolaire : c'est cours.js qui fournit le contexte, app.js ne fait que l'armer
  const { C } = chargeApp('alix');
  C.assistantName = 'Nova';
  await C.lancerInterro('annee', 'histoire');
  vrai('le mode révision est actif', C.quizMode === true);
  vrai("le sujet vient de l'année scolaire", C.quizSujet.espace === 'annee' && C.quizSujet.label === 'Histoire');
  vrai('le contexte est celui des cours', /ANNÉE SCOLAIRE/.test(C.quizCtx), C.quizCtx);
}
{
  // un sujet inconnu ne doit rien armer : sinon on interrogerait sur le vide
  const { C } = chargeApp('alix');
  C.assistantName = 'Nova';
  await C.lancerInterro('ete', 'nexistepas');
  vrai('un thème inconnu ne lance rien', C.quizMode === false);
  await C.lancerInterro('annee', 'histoire');
  C.arreterInterro();
}
{
  // cours.js qui ne répond rien (base coupée) ne doit pas armer une interro muette
  const { C } = chargeApp('alix', { annee: null });
  C.assistantName = 'Nova';
  await C.lancerInterro('annee', 'histoire');
  vrai('pas de contexte, pas de révision', C.quizMode === false);
}

/* ---------- répondre à l'oral ---------- */
console.log('\n— répondre à l\'oral : le micro');
{
  const { C, el } = chargeApp('alix');
  C.assistantName = 'Nova';
  C.renderChat();
  const h = el('main').innerHTML;
  vrai('sans reconnaissance vocale, aucun bouton micro', !/mic-chat-in/.test(h));
  vrai("et aucune promesse qu'on ne tient pas", !/répondre à l'oral/.test(h), h);
  vrai('le micro se sait indisponible', C.micDispo() === false);
  vrai('et micBtn ne rend rien', C.micBtn('chat-in') === '');
}
{
  const { C, el, micros } = chargeApp('alix', { micro: true });
  C.assistantName = 'Nova';
  C.renderChat();
  const h = el('main').innerHTML;
  vrai('le bouton micro est là', /id="mic-chat-in"/.test(h), h.slice(0, 400));
  vrai('il est cliquable', /micToggle\('chat-in'\)/.test(h));
  vrai("l'enfant sait qu'il peut répondre à l'oral", /oral/.test(h));

  C.micToggle('chat-in');
  vrai("l'écoute a démarré", micros.length === 1 && micros[0].demarre === 1, JSON.stringify(micros));
  vrai("on écoute en français", micros[0].lang === 'fr-FR', micros[0].lang);
  vrai("on s'arrête au silence, le micro ne reste pas ouvert", micros[0].continuous === false);
  vrai('il voit les mots arriver', micros[0].interimResults === true);
  vrai('le bouton montre qu\'il écoute', el('mic-chat-in').classList.contains('on'));

  // ce qui est reconnu atterrit dans le champ, à la suite de ce qui y était
  el('chat-in').value = 'Je pense que';
  C.micToggle('chat-in');                       // deuxième appui : on arrête
  vrai("un deuxième appui arrête l'écoute", micros[0].arrets === 1);
  vrai('et le bouton cesse de clignoter', !el('mic-chat-in').classList.contains('on'));
}
{
  // le texte dicté complète la saisie au lieu de l'effacer
  const { C, el, micros } = chargeApp('alix', { micro: true });
  C.assistantName = 'Nova';
  C.renderChat();
  el('chat-in').value = 'La réponse est';
  C.micToggle('chat-in');
  micros[0].onresult({ results: [[{ transcript: 'mille sept cent quatre-vingt-neuf' }]] });
  vrai('la dictée complète ce qui était déjà tapé',
    el('chat-in').value === 'La réponse est mille sept cent quatre-vingt-neuf', el('chat-in').value);
  vrai("rien n'est envoyé tout seul : c'est l'enfant qui valide",
    C.chatMsgs.length === 0, JSON.stringify(C.chatMsgs));

  // changer d'onglet pendant qu'il parle coupe le micro : sinon il continue d'écouter
  // derrière un écran que l'enfant a quitté
  C.showTab('mots');
  vrai("changer d'onglet arrête le micro", micros[0].arrets === 1, String(micros[0].arrets));

  // le micro refusé le dit, et ne laisse pas le bouton allumé
  micros[0].onerror({ error: 'not-allowed' });
  vrai('un micro bloqué éteint le bouton', !el('mic-chat-in').classList.contains('on'));
  micros[0].onend();
  vrai('la fin de l\'écoute éteint le bouton', !el('mic-chat-in').classList.contains('on'));
}

/* ---------- la voix de l'assistant ----------
   Elle a déjà un micro pour répondre ; lui donner une voix ferme la boucle, et pour
   Alix c'est le vrai gain : réécouter n'est pas relire. La décision de parler vit dans
   lecture.js ; ce qui se teste ici, c'est ce qu'app.js propose et demande. */
console.log('\n— la voix de l\'assistant dans le chat —');
{
  const { C, el } = chargeApp('alix', { voix: true });
  C.assistantName = 'Nova';
  C.renderChat();
  const h = el('main').innerHTML;
  vrai('le bouton de voix est proposé', /id="vx-btn"/.test(h));
  vrai("et l'enfant sait ce que ça fait", /voix haute/.test(h));
}
{
  const { C, el } = chargeApp('alix', {});
  C.assistantName = 'Nova';
  C.renderChat();
  const h = el('main').innerHTML;
  vrai("sans voix sur l'appareil, aucun bouton", !/vx-btn/.test(h));
  vrai("et aucune promesse de voix", !/voix haute/.test(h));
}
{
  // un 🔊 sur chaque réponse, pour la réentendre sans tout relire
  const { C, el, dits } = chargeApp('alix', { voix: true });
  C.assistantName = 'Nova';
  C.renderChat();
  C.chatMsgs.push({ role: 'user', content: 'Explique-moi les volcans' });
  C.chatMsgs.push({ role: 'assistant', content: 'Un volcan est une ouverture.' });
  C.drawChat();
  const h = el('chat-box').innerHTML;
  vrai('la réponse porte un 🔊', /vxDireMsg\(1\)/.test(h), h);
  vrai('la question de l\'enfant, non', !/vxDireMsg\(0\)/.test(h));
  C.vxDireMsg(1);
  vrai('le toucher fait relire la réponse', dits.some(d => !d.auto && /ouverture/.test(d.t)), JSON.stringify(dits));
}
{
  const { C, el } = chargeApp('alix', {});
  C.assistantName = 'Nova';
  C.renderChat();
  C.chatMsgs.push({ role: 'assistant', content: 'Une réponse.' });
  C.drawChat();
  vrai('sans voix, aucun 🔊 inutile', !/vxDireMsg/.test(el('chat-box').innerHTML));
}
{
  const { C, el, dits } = chargeApp('alix', { voix: true, reponse: { reply: 'Les volcans crachent de la lave.' } });
  C.assistantName = 'Nova';
  C.renderChat();
  el('chat-in').value = 'Parle-moi des volcans';
  await C.sendChat();
  vrai('la réponse est affichée', /lave/.test(el('chat-box').innerHTML));
  vrai('et proposée à la voix', dits.some(d => d.auto && /lave/.test(d.t)), JSON.stringify(dits));
}
{
  // on change d'onglet : ni micro ouvert, ni voix qui continue
  const { C, vxArrets } = chargeApp('alix', { voix: true });
  C.assistantName = 'Nova';
  C.enterEspace('tuteur', 'chat');
  const avant = vxArrets.length;
  C.showTab('mots');
  vrai("quitter l'écran fait taire l'assistant", vxArrets.length > avant);
}

console.log('\n' + (ko ? `❌ ${ko} échec(s), ${ok} test(s) passés` : `✅ ${ok} tests passés`));
process.exit(ko ? 1 : 0);
