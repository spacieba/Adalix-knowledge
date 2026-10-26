/* Tests des deux espaces (Le Grand Été / Tuteur). Charge réellement data.js puis
   app.js dans un DOM simulé : un onglet mal orthographié dans ESPACES donnerait un
   bouton qui ne fait rien, et rien ne le signalerait en production. */
import fs from 'fs';
import path from 'path';

const RACINE = process.argv[2];
let ko = 0, ok = 0;
const vrai = (nom, c, info) => { if (c) { ok++; } else { ko++; console.log('  ✗ ' + nom + (info ? '\n     ' + info : '')); } };
const eq = (nom, a, b) => vrai(nom, JSON.stringify(a) === JSON.stringify(b), 'attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a));

function chargeApp(profil) {
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
  const win = { matchMedia: () => ({ matches: false }) };
  // data.js tel quel : les fonctions de rendu lisent window.DATA
  new Function('window', fs.readFileSync(path.join(RACINE, 'data.js'), 'utf8'))(win);

  const src = fs.readFileSync(path.join(RACINE, 'app.js'), 'utf8');
  const stockage = { getItem: () => null, setItem() {}, removeItem() {} };
  const appels = [];
  const bouchon = nom => (...a) => { appels.push({ nom, a }); };
  const f = new Function('window', 'document', 'localStorage', 'console', 'fetch', 'setTimeout',
    'coursBadgeEspace', 'renderCours', 'renderMots', 'fillCoursParentCard', 'fillMotsParentCard', 'Image', 'URL',
    src + '\n;return {TABS, ESPACES, showEspaces, enterEspace, showTab, buildNav, majEnTete, '
    + 'get espace(){return espace}, set espace(v){espace=v}, get child(){return child}, set child(v){child=v}, '
    + 'get tab(){return tab}};');
  const C = f(win, doc, stockage, { log() {}, warn() {}, error() {} }, async () => ({ json: async () => ({}) }),
    fn => { appels.push({ nom: 'setTimeout' }); return 0; },
    bouchon('coursBadgeEspace'), bouchon('renderCours'), bouchon('renderMots'), bouchon('fillCoursParentCard'), bouchon('fillMotsParentCard'),
    function () { return {}; }, { createObjectURL: () => '', revokeObjectURL() {} });
  C.child = profil || 'alix';
  return { C, el, elements, appels };
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

console.log('\n— un espace inconnu ne casse rien —');
{
  const { C, el } = chargeApp('alix');
  C.showEspaces();
  C.enterEspace('nimportequoi');
  vrai('aucun changement d\'espace', C.espace === null);
  vrai('la barre reste masquée', el('nav').classList.contains('hidden'));
}

console.log('\n' + (ko ? `❌ ${ko} échec(s), ${ok} test(s) passés` : `✅ ${ok} tests passés`));
process.exit(ko ? 1 : 0);
