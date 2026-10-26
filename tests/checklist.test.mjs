/* Tests de la checklist de l'année scolaire (app.js + D.checklist dans data.js).

   Ce qu'ils protègent :
   - le contenu de la liste : un id en double, un geste sans libellé ou une apostrophe
     dans un id casseraient silencieusement une ligne (les ids partent dans un onclick) ;
   - le chevron « y aller » : il doit emmener à l'outil SANS cocher la case. Un bug de
     ce genre a déjà existé (l'ancien geste « projet » renvoyait vers l'onglet sans
     jamais cocher, et l'enfant retrouvait la case vide en revenant) ;
   - la série 🔥 : le week-end doit la mettre en pause, pas la remettre à zéro, et le
     seuil doit suivre le contenu de data.js au lieu d'un nombre écrit en dur. */
import fs from 'fs';
import path from 'path';

const RACINE = process.argv[2];
let ko = 0, ok = 0;
const vrai = (nom, c, info) => { if (c) { ok++; } else { ko++; console.log('  ✗ ' + nom + (info ? '\n     ' + info : '')); } };
const eq = (nom, a, b) => vrai(nom, JSON.stringify(a) === JSON.stringify(b), 'attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a));

process.on('unhandledRejection', e => { ko++; console.log('  ✗ promesse rejetée hors de tout await\n     ' + e); });

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
    body: { className: '', appendChild() {} },
  };
  const win = { matchMedia: () => ({ matches: false }) };
  new Function('window', fs.readFileSync(path.join(RACINE, 'data.js'), 'utf8'))(win);

  const src = fs.readFileSync(path.join(RACINE, 'app.js'), 'utf8');
  const stockage = { getItem: () => null, setItem() {}, removeItem() {} };
  const appels = [];
  const bouchon = nom => (...a) => { appels.push({ nom, a }); };
  const f = new Function('window', 'document', 'localStorage', 'console', 'fetch', 'setTimeout',
    'coursBadgeEspace', 'renderCours', 'renderMots', 'fillCoursParentCard', 'fillMotsParentCard', 'Image', 'URL',
    src + '\n;return {D, TABS, CHK_SEUIL, estJourEcole, calculeSerie, todayStr, renderChecklist, '
    + 'drawChecklist, drawChecklistRepos, toggleItem, openJournal, showTab, renderAide, '
    + 'get todayItems(){return todayItems}, set todayItems(v){todayItems=v}, '
    + 'get child(){return child}, set child(v){child=v}, get tab(){return tab}};');
  const C = f(win, doc, stockage, { log() {}, warn() {}, error() {} }, async () => ({ json: async () => ({}) }),
    fn => { appels.push({ nom: 'setTimeout' }); return 0; },
    bouchon('coursBadgeEspace'), bouchon('renderCours'), bouchon('renderMots'), bouchon('fillCoursParentCard'), bouchon('fillMotsParentCard'),
    function () { return {}; }, { createObjectURL: () => '', revokeObjectURL() {} });
  C.child = profil || 'alix';
  return { C, el, appels };
}

/* ---------- le contenu de la liste ---------- */
console.log('\n— les gestes de la journée —');
{
  const { C } = chargeApp('alix');
  const L = C.D.checklist;
  vrai('la liste existe et n\'est pas vide', Array.isArray(L) && L.length > 0);
  eq('aucun id en double', L.length, new Set(L.map(i => i.id)).size);
  L.forEach(it => {
    vrai(`« ${it.id} » a un libellé`, typeof it.label === 'string' && it.label.trim().length > 2);
    vrai(`« ${it.id} » a une icône`, typeof it.emoji === 'string' && it.emoji.length > 0);
    // l'id voyage dans onclick="toggleItem('…')" : une apostrophe le couperait en deux
    vrai(`« ${it.id} » est un id sûr dans un onclick`, /^[a-z0-9_]+$/.test(it.id), it.id);
  });

  // le raccourci › doit mener à un onglet qui existe ET qui est routé par showTab
  const src = fs.readFileSync(path.join(RACINE, 'app.js'), 'utf8');
  const routeur = (src.match(/\(\{programme:renderProgramme[^}]*\}\[t\]\)/) || [''])[0];
  const routes = (routeur.match(/([a-z0-9]+):render/g) || []).map(s => s.replace(':render', ''));
  vrai('la table de routage a été trouvée', routes.length > 5);
  L.filter(it => it.tab).forEach(it => {
    vrai(`« ${it.id} » renvoie vers un onglet déclaré (${it.tab})`, !!C.TABS[it.tab]);
    vrai(`« ${it.id} » renvoie vers un onglet routé (${it.tab})`, routes.includes(it.tab));
  });
  vrai('au moins un geste renvoie vers un outil', L.some(it => it.tab));

  // openJournal est branché sur cet id précis : s'il disparaît, l'écriture du soir
  // se coche comme une case ordinaire et le journal ne se remplit plus jamais
  vrai("le geste « ecriture » existe toujours (le journal en dépend)", L.some(i => i.id === 'ecriture'));

  // les gestes de l'été ne doivent plus traîner dans une liste d'année scolaire
  ['balade', 'culture', 'lifeskill', 'projet', 'objectifs', 'nettoyage', 'chambre'].forEach(mort =>
    vrai(`« ${mort} » (geste de l'été) a bien disparu`, !L.some(i => i.id === mort)));
  // et les gestes de l'école doivent y être
  ['devoirs', 'revisions', 'photo', 'cartable'].forEach(att =>
    vrai(`« ${att} » est bien là`, L.some(i => i.id === att)));
}

/* ---------- le seuil de la série ---------- */
console.log('\n— le seuil qui allume la série 🔥 —');
{
  const { C } = chargeApp('alix');
  const n = C.D.checklist.length;
  vrai('le seuil est au moins 1', C.CHK_SEUIL >= 1);
  vrai('le seuil suit la liste et ne la dépasse pas', C.CHK_SEUIL <= n, `${C.CHK_SEUIL} > ${n}`);
  vrai('une journée imparfaite peut compter', C.CHK_SEUIL < n, `seuil ${C.CHK_SEUIL} = total ${n}`);
  vrai('le seuil reste exigeant (plus de la moitié)', C.CHK_SEUIL > n / 2);
}

/* ---------- jours d'école ---------- */
console.log('\n— lundi au vendredi, pas le week-end —');
{
  const { C } = chargeApp('alix');
  [['2026-10-19', 'lundi'], ['2026-10-20', 'mardi'], ['2026-10-21', 'mercredi'],
   ['2026-10-22', 'jeudi'], ['2026-10-23', 'vendredi']].forEach(([k, j]) =>
    vrai(`${j} est un jour d'école`, C.estJourEcole(k) === true, k));
  vrai('samedi n\'en est pas un', C.estJourEcole('2026-10-24') === false);
  vrai('dimanche n\'en est pas un', C.estJourEcole('2026-10-25') === false);
  vrai('la clef du jour est bien formée', /^\d{4}-\d{2}-\d{2}$/.test(C.todayStr()), C.todayStr());
}

/* ---------- la série ---------- */
console.log('\n— la série saute le week-end au lieu de se rompre —');
{
  const { C } = chargeApp('alix');
  const S = C.CHK_SEUIL, n = C.D.checklist.length;
  const j = (day, completed) => ({ day, completed });

  eq('aucune donnée → aucune série', C.calculeSerie([], '2026-10-26'), 0);
  eq('rien du tout ne plante pas', C.calculeSerie(null, '2026-10-26'), 0);

  // lundi 26 en cours, vendredi 23 et jeudi 22 réussis, le week-end est vide
  eq('le week-end vide ne rompt rien',
    C.calculeSerie([j('2026-10-23', S), j('2026-10-22', S)], '2026-10-26'), 2);

  // la journée en cours achevée s'ajoute
  eq('la journée du jour compte dès le seuil atteint',
    C.calculeSerie([j('2026-10-26', S), j('2026-10-23', S)], '2026-10-26'), 2);

  // sous le seuil, aujourd'hui ne compte pas mais ne casse pas la série d'avant
  eq("une journée en cours inachevée ne casse pas la série",
    C.calculeSerie([j('2026-10-26', S - 1), j('2026-10-23', S)], '2026-10-26'), 1);

  // un jour d'école raté, lui, rompt
  eq("un jour d'école raté rompt la série",
    C.calculeSerie([j('2026-10-23', S - 1), j('2026-10-22', S)], '2026-10-26'), 0);

  // une journée pleine compte aussi, évidemment
  eq('une journée complète compte', C.calculeSerie([j('2026-10-23', n)], '2026-10-26'), 1);

  // un samedi coché (vacances, bonne volonté) ne fait pas de mal
  eq('un samedi coché ne perturbe pas le compte',
    C.calculeSerie([j('2026-10-24', n), j('2026-10-23', S)], '2026-10-26'), 1);

  // demandé un dimanche : la série des jours d'école précédents reste visible
  eq('consultée un dimanche, la série tient',
    C.calculeSerie([j('2026-10-23', S), j('2026-10-22', S)], '2026-10-25'), 2);
}

/* ---------- le rendu d'un jour d'école ---------- */
console.log('\n— l\'écran de la journée —');
{
  const { C, el } = chargeApp('alix');
  C.todayItems = {};
  C.drawChecklist();
  const h = el('main').innerHTML;
  vrai('du HTML est produit', h.length > 200);
  vrai("pas d'undefined affiché", !/undefined/.test(h), (h.match(/.{0,40}undefined.{0,40}/) || [])[0]);
  vrai('pas de gabarit non interprété', !/\$\{/.test(h));
  eq('une ligne par geste', (h.match(/class="chk-item/g) || []).length, C.D.checklist.length);
  vrai('chaque geste est cliquable', C.D.checklist.every(it => h.includes(`toggleItem('${it.id}')`)));
  vrai('le compteur est affiché', new RegExp('0 / ' + C.D.checklist.length).test(h));
  vrai('le seuil de la série est annoncé', /série 🔥/.test(h));

  // le chevron : présent seulement là où il y a un onglet, et il ne coche pas la case
  const avecTab = C.D.checklist.filter(it => it.tab);
  eq('un chevron par geste qui mène à un outil', (h.match(/class="chk-go"/g) || []).length, avecTab.length);
  avecTab.forEach(it => vrai(`le chevron de « ${it.id} » ouvre ${it.tab} sans cocher`,
    h.includes(`event.stopPropagation();showTab('${it.tab}')`)));

  // une case cochée se voit
  C.todayItems = { eau: true };
  C.drawChecklist();
  const h2 = el('main').innerHTML;
  vrai('un geste coché est marqué fait', /chk-item done/.test(h2));
  vrai('le compteur a suivi', new RegExp('1 / ' + C.D.checklist.length).test(h2));
}

/* ---------- le rendu du week-end ---------- */
console.log('\n— l\'écran de repos —');
{
  const { C, el } = chargeApp('adam');
  C.drawChecklistRepos();
  const h = el('main').innerHTML;
  vrai('du HTML est produit', h.length > 100);
  vrai("pas d'undefined affiché", !/undefined/.test(h), (h.match(/.{0,40}undefined.{0,40}/) || [])[0]);
  vrai('pas de gabarit non interprété', !/\$\{/.test(h));
  vrai('aucune case à cocher', !/chk-item/.test(h));
  vrai('le repos est annoncé', /Pas d'école/.test(h));
  vrai('la série est dite en pause, pas perdue', /pause/.test(h) && /pas de zéro/.test(h));
  vrai('les outils restent accessibles', /showTab\('cours'\)/.test(h) && /showTab\('mots'\)/.test(h));
}

/* ---------- le bon écran selon le jour ---------- */
console.log('\n— renderChecklist choisit le bon écran —');
{
  const { C, el } = chargeApp('alix');
  const ecole = C.estJourEcole(C.todayStr());
  await C.renderChecklist();
  const h = el('main').innerHTML;
  if (ecole) {
    vrai(`un jour d'école (${C.todayStr()}) affiche la liste`, /chk-item/.test(h));
    vrai('la base vide ne coche rien', !/chk-item done/.test(h));
  } else {
    vrai(`un jour sans école (${C.todayStr()}) affiche le repos`, /Pas d'école/.test(h));
  }

  // l'écriture du soir ouvre la fenêtre d'écriture au lieu de se cocher en silence
  if (ecole) {
    C.todayItems = {};
    C.toggleItem('ecriture');
    vrai("« écriture du soir » ouvre le journal", /Écriture du soir/.test(el('modal-root').innerHTML));
    vrai('et ne coche pas la case toute seule', !C.todayItems.ecriture);
  }
}

/* ---------- le guide du Tuteur ---------- */
console.log('\n— le guide du Tuteur —');
{
  const { C, el } = chargeApp('alix');
  C.renderAide();
  const h = el('main').innerHTML;
  vrai('du HTML est produit', h.length > 2000);
  vrai("pas d'undefined affiché", !/undefined/.test(h), (h.match(/.{0,60}undefined.{0,60}/) || [])[0]);
  vrai('pas de gabarit non interprété', !/\$\{/.test(h));
  vrai('il parle des deux espaces', /Grand Été/.test(h) && /Tuteur/.test(h));
  vrai('il explique Mes cours', /Mes cours/.test(h));
  vrai('il explique Mes mots', /carnet/.test(h));
  vrai('il explique la journée et le week-end', /lundi au vendredi/.test(h));
  vrai('il annonce le vrai seuil de la série', h.includes(`${C.CHK_SEUIL} gestes sur ${C.D.checklist.length}`));
  vrai('il prévient que la lecture réclame une voix française', /voix française/.test(h));
  // règle tenue partout : on compte les mots gagnés, jamais les fautes
  vrai('aucun décompte de fautes promis', !/nombre de fautes|compte tes fautes/i.test(h));
  vrai('il dit ne rien comparer entre les enfants', /comparé avec (Adam|Alix)/.test(h));

  const { C: C2, el: el2 } = chargeApp('adam');
  C2.renderAide();
  vrai("chez Adam c'est Alix qui est nommée", /comparé avec Alix/.test(el2('main').innerHTML));
}

/* ---------- le guide du Grand Été ---------- */
console.log('\n— le guide du Grand Été ne parle plus de la checklist —');
{
  const { C, el } = chargeApp('alix');
  C.showTab('guide');
  const h = el('main').innerHTML;
  vrai('du HTML est produit', h.length > 2000);
  vrai("pas d'undefined affiché", !/undefined/.test(h), (h.match(/.{0,60}undefined.{0,60}/) || [])[0]);
  vrai('pas de gabarit non interprété', !/\$\{/.test(h));
  vrai('il annonce les deux espaces', /Les deux espaces/.test(h));
  vrai('il explique le bouton 🏠', /🏠/.test(h));
  vrai("il ne décrit plus la checklist, partie dans le Tuteur", !/L'onglet Checklist/.test(h));
  vrai("il ne promet plus la balade ni le nettoyage", !/balade, programme du jour/.test(h));
}

console.log('\n' + (ko ? `❌ ${ko} échec(s), ${ok} test(s) passés` : `✅ ${ok} tests passés`));
process.exit(ko ? 1 : 0);
