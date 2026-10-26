/* Tests des deux espaces (Le Grand Été / Tuteur). Charge réellement data.js puis
   app.js dans un DOM simulé : un onglet mal orthographié dans ESPACES donnerait un
   bouton qui ne fait rien, et rien ne le signalerait en production. */
import fs from 'fs';
import path from 'path';

const RACINE = process.argv[2];
let ko = 0, ok = 0;
const vrai = (nom, c, info) => { if (c) { ok++; } else { ko++; console.log('  ✗ ' + nom + (info ? '\n     ' + info : '')); } };
const eq = (nom, a, b) => vrai(nom, JSON.stringify(a) === JSON.stringify(b), 'attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a));

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
    body: { className: '' },
  };
  // matchMedia sert à savoir si l'app tourne déjà installée (display-mode: standalone)
  const defilements = [];
  const win = { matchMedia: () => ({ matches: !!opt.installee }), scrollTo: (x, y) => defilements.push([x, y]) };
  const nav = { userAgent: opt.ua || 'Test', standalone: !!opt.iosInstallee };
  // data.js tel quel : les fonctions de rendu lisent window.DATA
  new Function('window', fs.readFileSync(path.join(RACINE, 'data.js'), 'utf8'))(win);

  const src = fs.readFileSync(path.join(RACINE, 'app.js'), 'utf8');
  const stockage = { getItem: () => null, setItem() {}, removeItem() {} };
  const appels = [];
  const bouchon = nom => (...a) => { appels.push({ nom, a }); };
  const f = new Function('window', 'document', 'localStorage', 'console', 'fetch', 'setTimeout',
    'coursBadgeEspace', 'renderCours', 'renderMots', 'fillCoursParentCard', 'fillMotsParentCard', 'Image', 'URL', 'navigator',
    src + '\n;return {TABS, ESPACES, showEspaces, enterEspace, showTab, buildNav, majEnTete, '
    + 'majInstall, htmlInstall, estInstallee, estIPhone, lancerInstall, aideInstallIPhone, '
    + 'get espace(){return espace}, set espace(v){espace=v}, get child(){return child}, set child(v){child=v}, '
    + 'get tab(){return tab}};');
  const C = f(win, doc, stockage, { log() {}, warn() {}, error() {} }, async () => ({ json: async () => ({}) }),
    fn => { appels.push({ nom: 'setTimeout' }); return 0; },
    bouchon('coursBadgeEspace'), bouchon('renderCours'), bouchon('renderMots'), bouchon('fillCoursParentCard'), bouchon('fillMotsParentCard'),
    function () { return {}; }, { createObjectURL: () => '', revokeObjectURL() {} }, nav);
  C.child = profil || 'alix';
  return { C, el, elements, appels, win, defilements };
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

console.log('\n' + (ko ? `❌ ${ko} échec(s), ${ok} test(s) passés` : `✅ ${ok} tests passés`));
process.exit(ko ? 1 : 0);
