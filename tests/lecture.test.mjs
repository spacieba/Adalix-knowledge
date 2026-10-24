/* Tests de lecture.js : découpage en syllabes, lecture guidée, carnet de mots, dictées.
   Un enfant en difficulté de lecture est le dernier à qui on peut servir un écran cassé
   ou une bonne réponse divulguée trop tôt — c'est ce que ces tests protègent. */
import fs from 'fs';
import path from 'path';

const RACINE = process.argv[2];
let ko = 0, ok = 0;
const vrai = (nom, c, info) => { if (c) { ok++; } else { ko++; console.log('  ✗ ' + nom + (info ? '\n     ' + info : '')); } };
const eq = (nom, a, b) => vrai(nom, JSON.stringify(a) === JSON.stringify(b), 'attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a));

function fausseDb(fixtures) {
  const ecrits = [];
  const make = (table) => {
    const res = { data: fixtures[table] !== undefined ? fixtures[table] : [], error: null };
    const self = {
      then: (f, g) => Promise.resolve(res).then(f, g),
      select: () => self, eq: () => self, lte: () => self, order: () => self, limit: () => self,
      maybeSingle: () => Promise.resolve({ data: res.data[0], error: null }),
      single: () => Promise.resolve({ data: res.data[0], error: null }),
      insert: p => { ecrits.push({ table, op: 'insert', p }); return make(table); },
      update: p => { ecrits.push({ table, op: 'update', p }); return make(table); },
      upsert: (p, o) => { ecrits.push({ table, op: 'upsert', p, o }); return make(table); },
      delete: () => { ecrits.push({ table, op: 'delete' }); return make(table); },
    };
    return self;
  };
  return { from: t => make(t), ecrits };
}

function charge(fixtures, opts) {
  const o = opts || {};
  const elements = {};
  const el = id => elements[id] || (elements[id] = {
    id, innerHTML: '', textContent: '', value: o.valeurs && o.valeurs[id] !== undefined ? o.valeurs[id] : '',
    disabled: false, style: {}, dataset: {},
    classList: { _c: new Set(), add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); }, toggle() {}, contains(c) { return this._c.has(c); } },
    focus() {}, click() {}, querySelector: () => null, scrollIntoView() {},
  });
  const db = fausseDb(fixtures || {});
  const toasts = [];
  const parles = [];
  const doc = {
    querySelector: () => null, querySelectorAll: () => [],
    getElementById: id => elements[id] || null,
    createElement: () => el('tmp'), addEventListener() {},
  };
  const stockage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
  const synth = o.sansVoix ? undefined : {
    cancel() {}, speak(u) { parles.push(u.text); if (u.onend) setTimeout(() => u.onend(), 0); },
    getVoices: () => [{ lang: 'fr-FR', localService: true, name: 'Amelie' }],
    addEventListener() {},
  };
  const src = fs.readFileSync(path.join(RACINE, 'lecture.js'), 'utf8');
  const f = new Function('esc', 'child', 'db', 'toast', 'modal', 'closeModal', 'familyCode', 'badFamilyCode',
    'todayStr', '$', 'document', 'localStorage', 'speechSynthesis', 'SpeechSynthesisUtterance', 'window',
    'callCours', 'coursCur', 'drawCours', 'renderDashboard', 'BOX_JOURS', 'jourPlus', 'console', 'setTimeout',
    src + '\n;return {syllabes, syllabesHtml, lectTexteBrut, lectDecoupe, openLecture, drawLecture, lectCorpsHtml, '
    + 'renderMots, drawMots, motDiffHtml, motNormalise, drawMotEtape, drawDictee, fillMotsParentCard, openRecapOrtho, '
    + 'motsAjoute, startMots, TYPE_LABEL, lectDispo, '
    + 'get motsList(){return motsList}, set motsList(v){motsList=v}, '
    + 'get motState(){return motState}, set motState(v){motState=v}, '
    + 'get dicteeState(){return dicteeState}, set dicteeState(v){dicteeState=v}, '
    + 'get lectPref(){return lectPref}, set lectPref(v){lectPref=v}};');

  const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const C = f(esc, o.child || 'alix', db, m => toasts.push(m), h => { el('modal-root').innerHTML = h; }, () => {},
    'CODE', () => {}, () => '2026-10-24', sel => el(String(sel).replace('#', '')), doc, stockage,
    synth, synth ? function (t) { this.text = t; } : undefined, { matchMedia: () => ({ matches: false }) },
    o.callCours || (async () => ({})), o.coursCur || null, () => {}, () => {},
    { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 }, n => '2026-11-0' + n,
    { log() {}, warn() {}, error() {} }, fn => { fn(); return 0; });
  return { C, el, elements, db, toasts, parles };
}

const html = el => el('main').innerHTML;
function sain(nom, h) {
  vrai(nom + ' : du HTML est produit', h.length > 50);
  vrai(nom + " : pas d'undefined", !/undefined/.test(h), (h.match(/.{0,40}undefined.{0,40}/) || [])[0]);
  vrai(nom + ' : pas de [object Object]', !/\[object Object\]/.test(h));
  vrai(nom + ' : pas de NaN', !/>NaN|NaN</.test(h));
  vrai(nom + ' : pas de gabarit non interprété', !/\$\{/.test(h), (h.match(/.{0,40}\$\{.{0,40}/) || [])[0]);
  const o = (h.match(/<div/g) || []).length, f = (h.match(/<\/div>/g) || []).length;
  vrai(nom + ' : les <div> sont équilibrés', o === f, `${o} ouverts / ${f} fermés`);
}

/* ---------- découpage en syllabes ---------- */
console.log('\n— syllabes : le découpage des mots courants —');
{
  const { C } = charge({});
  const cas = [
    ['bateau', 'ba-teau'], ['orthographe', 'or-tho-gra-phe'], ['appeler', 'ap-pe-ler'],
    ['maison', 'mai-son'], ['animal', 'a-ni-mal'], ['travail', 'tra-vail'],
    ['beaucoup', 'beau-coup'], ['oiseau', 'oi-seau'], ['enfant', 'en-fant'],
    ['tableau', 'ta-bleau'], ['partir', 'par-tir'], ['femme', 'fem-me'],
  ];
  cas.forEach(([mot, attendu]) => eq('« ' + mot + ' »', C.syllabes(mot).join('-'), attendu));
  eq('un mot court n\'est pas découpé', C.syllabes('le'), ['le']);
  eq('chaîne vide', C.syllabes(''), ['']);
  eq('null ne plante pas', C.syllabes(null), ['']);
  vrai('aucune lettre perdue au découpage',
    ['anticonstitutionnellement', 'chrysanthème', 'aujourd\'hui', 'œuf', 'hiéroglyphe']
      .every(m => C.syllabes(m).join('') === m),
    ['anticonstitutionnellement', 'chrysanthème', "aujourd'hui", 'œuf', 'hiéroglyphe']
      .filter(m => C.syllabes(m).join('') !== m).join(', '));

  const h = C.syllabesHtml('bateau');
  vrai('les syllabes alternent les couleurs', /syl-0/.test(h) && /syl-1/.test(h));
  vrai("le découpage fourni par l'IA a la priorité", C.syllabesHtml('femme', 'fem-me').replace(/<[^>]*>/g, '') === 'femme');
  vrai('le HTML est échappé', !/<script>/.test(C.syllabesHtml('<script>')));
}

/* ---------- texte lisible ---------- */
console.log('\n— préparation du texte à lire —');
{
  const { C } = charge({});
  const t = C.lectTexteBrut('## Les causes\n- La **crise** financière\n> Une règle\n---\n1. Premier point');
  vrai('les marques de Markdown disparaissent', !/[#*>-]{2}/.test(t) && !/\*\*/.test(t), t);
  vrai('le gras devient du texte normal', /La crise financière/.test(t), t);
  vrai('une ponctuation est ajoutée pour que la voix respire', /causes\./.test(t), t);
  vrai('le séparateur est retiré', !/---/.test(t), t);
  eq('découpage en mots', C.lectDecoupe('le chat dort').map(m => m.mot), ['le', 'chat', 'dort']);
  eq('les positions permettent de suivre la voix', C.lectDecoupe('le chat').map(m => m.d), [0, 3]);
}

console.log('\n— écran de lecture guidée —');
{
  const { C, el } = charge({});
  C.openLecture('## Titre\nLe **chat** dort.', 'Mon cours');
  const h = html(el);
  sain('lecture', h);
  vrai('le titre est repris', /Mon cours/.test(h));
  vrai('chaque mot est repérable pour le surlignage', /id="lw-0"/.test(h) && /id="lw-1"/.test(h));
  vrai('les réglages de confort sont proposés', /Plus grand/.test(h) && /Plus aéré/.test(h) && /Syllabes/.test(h));
  vrai("l'écoute est proposée", /Écouter/.test(h));
  vrai('les réglages sont appliqués au texte', /letter-spacing:/.test(h) && /line-height:/.test(h));
}

console.log('\n— sans synthèse vocale, l\'écran reste utilisable —');
{
  const { C, el } = charge({}, { sansVoix: true });
  vrai('la voix est détectée absente', C.lectDispo() === false);
  C.openLecture('Le chat dort.', 'Test');
  const h = html(el);
  sain('lecture sans voix', h);
  vrai("l'absence de voix est annoncée clairement", /indisponible/.test(h));
  vrai('le confort de lecture reste disponible', /Plus aéré/.test(h));
}

/* ---------- carnet de mots ---------- */
const MOTS = [
  { id: 1, child: 'alix', mot: 'bateau', erreur: 'bato', syllabes: 'ba-teau', type: 'phonetique', source: 'cours', statut: 'propose', box: 1, due: '2026-10-01', reussites: 0, echecs: 0 },
  { id: 2, child: 'alix', mot: 'femme', erreur: 'fame', syllabes: 'fem-me', type: 'visuel', source: 'dictee', statut: 'actif', box: 1, due: '2026-10-01', reussites: 0, echecs: 3 },
  { id: 3, child: 'alix', mot: 'aujourd\'hui', erreur: '', syllabes: '', type: 'autre', source: 'manuel', statut: 'actif', box: 5, due: '2026-12-01', reussites: 4, echecs: 0 },
];

console.log('\n— carnet de mots —');
{
  const { C, el } = charge({ adalix_mots: MOTS });
  await C.renderMots();
  const h = html(el);
  sain('carnet', h);
  vrai('les mots proposés sont séparés des mots validés', /Ces mots étaient dans ton cahier/.test(h));
  vrai('on peut écarter une mauvaise lecture', /motStatut\(1,'ecarte'\)/.test(h));
  vrai('on peut valider un mot', /motStatut\(1,'actif'\)/.test(h));
  vrai('le carnet liste les mots actifs', /femme/.test(h) && /aujourd/.test(h));
  vrai("l'entraînement est proposé quand il y a des mots dus", /M'entraîner/.test(h));
  vrai('la dictée est proposée', /Une dictée/.test(h));
  vrai('un mot acquis est célébré', /gagné/.test(h));
  vrai('aucun décompte de fautes n\'est affiché', !/faute/i.test(h), (h.match(/.{0,30}faute.{0,30}/i) || [])[0]);
}

console.log('\n— carnet vide —');
{
  const { C, el } = charge({ adalix_mots: [] });
  await C.renderMots();
  const h = html(el);
  sain('carnet vide', h);
  vrai('un message explique comment il se remplira', /se remplira tout seul/.test(h));
  vrai("pas d'entraînement proposé sans mot", !/M'entraîner/.test(h));
}

console.log('\n— entraînement regarde → écris → vérifie —');
{
  const dus = [{ id: 2, mot: 'femme', syllabes: 'fem-me', box: 1, reussites: 0, echecs: 3 }];
  // étape 1 : on montre le mot
  let { C, el } = charge({});
  C.motState = { mots: dus, i: 0, etape: 'regarde', reponse: '', bons: 0 };
  C.drawMotEtape();
  let h = html(el);
  sain('étape regarde', h);
  vrai('le mot est montré en grand', /mot-geant/.test(h) && /fem/.test(h));
  vrai('les syllabes sont colorées', /syl-0/.test(h));

  // étape 2 : le mot doit avoir disparu, et la correction du téléphone être coupée
  ({ C, el } = charge({}));
  C.motState = { mots: dus, i: 0, etape: 'ecris', reponse: '', bons: 0 };
  C.drawMotEtape();
  h = html(el);
  sain('étape écris', h);
  vrai('le mot n\'est plus visible', !/mot-geant/.test(h), 'le mot à écrire est resté affiché !');
  vrai('la correction automatique est désactivée', /spellcheck="false"/.test(h) && /autocorrect="off"/.test(h));
  vrai('la saisie automatique est désactivée', /autocomplete="off"/.test(h));

  // étape 3 : la correction montre la bonne orthographe
  ({ C, el } = charge({}));
  C.motState = { mots: dus, i: 0, etape: 'verif', reponse: 'fame', bons: 0 };
  C.drawMotEtape();
  h = html(el);
  sain('étape vérifie', h);
  vrai('ce qu\'elle a écrit est rappelé', /fame/.test(h));
  vrai('les lettres qui changent sont signalées', /lettre-diff/.test(h));
  vrai('le ton reste encourageant', /tu le reverras/.test(h));

  // réussite
  ({ C, el } = charge({}));
  C.motState = { mots: dus, i: 0, etape: 'verif', reponse: 'Femme ', bons: 0 };
  C.drawMotEtape();
  h = html(el);
  vrai('la casse et les espaces ne pénalisent pas', /exactement ça/.test(h), h.slice(0, 200));
}

console.log('\n— comparaison lettre à lettre —');
{
  const { C } = charge({});
  const nu = s => s.replace(/<[^>]*>/g, '');
  vrai('le mot juste est toujours affiché en entier', nu(C.motDiffHtml('fame', 'femme')) === 'femme');
  vrai('les lettres en trop côté enfant ne cassent rien', nu(C.motDiffHtml('femmme', 'femme')) === 'femme');
  vrai('une réponse vide signale tout le mot', (C.motDiffHtml('', 'chat').match(/lettre-diff/g) || []).length === 4);
  vrai('une réponse juste ne signale rien', !/lettre-diff/.test(C.motDiffHtml('chat', 'chat')));
  vrai('la comparaison ignore la casse', !/lettre-diff/.test(C.motDiffHtml('CHAT', 'chat')));
  vrai('le HTML est échappé', !/<b>/.test(C.motDiffHtml('x', '<b>')));
  eq('normalisation', C.motNormalise('  Femme  '), 'femme');
}

/* ---------- dictées ---------- */
console.log('\n— dictée : saisie puis correction —');
{
  const d = { titre: 'Le chat du voisin', texte: 'Le chat dort.', a_dire: 'Le chat dort point', pieges: ['accords'] };
  let { C, el } = charge({});
  C.dicteeState = { d, reponse: '', res: null };
  C.drawDictee();
  let h = html(el);
  sain('dictée', h);
  vrai('le texte à écrire n\'est pas affiché', !/Le chat dort\./.test(h), 'la dictée est visible à l\'écran !');
  vrai('la correction automatique est désactivée', /spellcheck="false"/.test(h) && /autocorrect="off"/.test(h));
  vrai('on peut réécouter et ralentir', /Écouter/.test(h) && /Vitesse/.test(h));

  ({ C, el } = charge({}));
  C.dicteeState = {
    d, reponse: 'Le chas dor', res: {
      justes: 1, total: 3, commentaire: 'Tu as bien écrit « le ».',
      fautes: [
        { attendu: 'chat', ecrit: 'chas', type: 'phonetique', explication: 'Chat se termine par un t muet.', syllabes: 'chat' },
        { attendu: 'dort', ecrit: 'dor', type: 'grammatical', explication: 'Il dort : le verbe prend un t.', syllabes: 'dort' },
      ],
    },
  };
  C.drawDictee();
  h = html(el);
  sain('dictée corrigée', h);
  vrai('on compte les mots justes, pas les fautes', /mots justes/.test(h) && !/\bfautes?\b/i.test(h.replace(/parType|fautes\./g, '')), (h.match(/.{0,30}faute.{0,30}/i) || [])[0]);
  vrai('les erreurs sont groupées par nature', /Ça ne se lit pas comme ça/.test(h) && /Accord ou conjugaison/.test(h));
  vrai('chaque erreur donne une règle', /t muet/.test(h) && /le verbe prend un t/.test(h));
  vrai('le commentaire commence par ce qui est réussi', /Tu as bien écrit/.test(h));
  vrai("l'envoi au carnet est annoncé", /carnet/.test(h));
}

console.log('\n— les mots d\'une dictée rejoignent le carnet —');
{
  const { C, db } = charge({});
  await C.motsAjoute([
    { correct: 'chat', ecrit: 'chas', type: 'phonetique', syllabes: 'chat' },
    { correct: '', ecrit: 'vide', type: 'autre' },
  ], 'dictee', null, 'actif');
  const up = db.ecrits.filter(e => e.op === 'upsert' && e.table === 'adalix_mots');
  vrai('un upsert est envoyé', up.length === 1);
  vrai('les entrées sans mot correct sont écartées', up[0].p.length === 1, JSON.stringify(up[0].p));
  vrai('le doublon est géré par contrainte', up[0].o && up[0].o.onConflict === 'child,mot', JSON.stringify(up[0].o));
  vrai('le statut demandé est respecté', up[0].p[0].statut === 'actif');
  vrai('le type est conservé', up[0].p[0].type === 'phonetique');

  const { C: C2, db: db2 } = charge({});
  await C2.motsAjoute([{ correct: 'x', ecrit: 'y', type: 'nimportequoi' }], 'cours', 7, 'propose');
  const u2 = db2.ecrits.filter(e => e.op === 'upsert')[0];
  vrai('un type inconnu retombe sur « autre »', u2.p[0].type === 'autre');
  vrai('le cours d\'origine est tracé', u2.p[0].cours_id === 7);
  vrai('les mots venus d\'un cahier sont seulement proposés', u2.p[0].statut === 'propose');
}

/* ---------- parent ---------- */
console.log('\n— récapitulatif parent —');
{
  const DICT = [{ id: 1, child: 'alix', titre: 'Le chat', score: 8, total: 10, created_at: '2026-10-20T10:00:00Z',
    fautes: [{ attendu: 'chat', ecrit: 'chas', type: 'phonetique' }, { attendu: 'dort', ecrit: 'dor', type: 'grammatical' }] }];
  const { C, el } = charge({ adalix_mots: MOTS, adalix_dictees: DICT });
  await C.fillMotsParentCard();
  const h = el('mots-parent-card').innerHTML;
  sain('carte parent', h);
  vrai('la répartition par nature de faute est montrée', /Ça ne se lit pas comme ça/.test(h));
  vrai('les mots qui résistent remontent', /femme/.test(h));
  vrai('le récapitulatif imprimable est proposé', /openRecapOrtho/.test(h));
  vrai('la limite est dite explicitement', /n'est pas un bilan/.test(h));

  const { C: C2, el: el2 } = charge({ adalix_mots: MOTS, adalix_dictees: DICT });
  await C2.openRecapOrtho();
  const r = html(el2);
  sain('récapitulatif', r);
  vrai('des exemples concrets sont donnés', /bato/.test(r) || /chas/.test(r));
  vrai('les mots acquis figurent', /Mots acquis/.test(r));
  vrai('le document se dit non diagnostique', /ne constitue en aucun cas un bilan/.test(r));
  vrai('le bouton imprimer est exclu de l\'impression', /class="card no-print"/.test(r));
}

console.log('\n' + (ko ? `❌ ${ko} échec(s), ${ok} test(s) passés` : `✅ ${ok} tests passés`));
process.exit(ko ? 1 : 0);
