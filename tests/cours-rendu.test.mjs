/* Test de rendu : exécute chaque écran du module « Mes cours » avec un DOM et une
   base simulés. Objectif : qu'aucun écran ne plante et que le HTML tienne debout,
   y compris sur les cas vides (aucun cours, aucune notion). */
import fs from 'fs';
import path from 'path';

const RACINE = process.argv[2];
let ko = 0, ok = 0;
const vrai = (nom, c, info) => { if (c) { ok++; } else { ko++; console.log('  ✗ ' + nom + (info ? '\n     ' + info : '')); } };

/* ---------- faux Supabase : chaînable, renvoie les fixtures de la table ---------- */
function fausseDb(fixtures) {
  const ecrits = [];
  const make = (table, payload) => {
    const res = { data: fixtures[table] !== undefined ? fixtures[table] : [], error: null };
    const self = {
      then: (f, g) => Promise.resolve(res).then(f, g),
      select: () => self, eq: () => self, lte: () => self, order: () => self, limit: () => self,
      maybeSingle: () => Promise.resolve({ data: Array.isArray(res.data) ? res.data[0] : res.data, error: null }),
      single: () => Promise.resolve({ data: Array.isArray(res.data) ? res.data[0] : res.data, error: null }),
      insert: p => { ecrits.push({ table, op: 'insert', p }); return make(table + ':inserted', p); },
      update: p => { ecrits.push({ table, op: 'update', p }); return make(table, p); },
      upsert: p => { ecrits.push({ table, op: 'upsert', p }); return make(table, p); },
      delete: () => { ecrits.push({ table, op: 'delete' }); return make(table); },
    };
    return self;
  };
  return { from: t => make(t), ecrits };
}

/* ---------- faux DOM : on garde seulement ce que le module touche ---------- */
function fauxDom() {
  const elements = {};
  const el = id => elements[id] || (elements[id] = {
    id, innerHTML: '', value: '', textContent: '', disabled: false, dataset: {},
    classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
    click: () => {}, focus: () => {},
  });
  return { elements, el };
}

const FIXTURES_COURS = [
  { id: 1, child: 'alix', matiere: 'histoire', titre: 'La Révolution française', niveau: '4e',
    chapitre: '1789-1799', resume: 'Le résumé.', texte: '## Les causes\n- La **crise** financière\n> Une règle\n\n1. un\n2. deux\n---\nFin.',
    points_cles: ['Point A', 'Point B'], vocabulaire: [{ mot: 'Tiers État', def: 'le peuple' }],
    ressources: [{ site: 'Lumni', emoji: '🎬', type: 'video', titre: 'T', pourquoi: 'P', url: 'https://www.lumni.fr/recherche?q=x' }],
    created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z' },
  { id: 2, child: 'alix', matiere: 'maths', titre: 'Théorème de Pythagore', niveau: '4e',
    chapitre: '', resume: '', texte: 'a² + b² = c²', points_cles: [], vocabulaire: [], ressources: [],
    created_at: '2026-10-22T10:00:00Z', updated_at: '2026-10-22T10:00:00Z' },
];
const FIXTURES_NOTIONS = [
  { id: 10, cours_id: 1, child: 'alix', notion: 'Date clé', question: 'Quand commence la Révolution ?', reponse: '1789', box: 1, due: '2026-10-01', reussites: 0, echecs: 3, updated_at: '2026-10-20T10:00:00Z' },
  { id: 11, cours_id: 1, child: 'alix', notion: 'Tiers État', question: 'Qui est le Tiers État ?', reponse: 'Le peuple', box: 4, due: '2026-12-01', reussites: 3, echecs: 0, updated_at: '2026-10-20T10:00:00Z' },
];

async function scenario(nom, fixtures, fn, opts) {
  const o = opts || {};
  const dom = fauxDom();
  const db = fausseDb(fixtures);
  const src = fs.readFileSync(path.join(RACINE, 'cours.js'), 'utf8');
  const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toasts = [];
  const ecouteurs = {};
  const doc = {
    querySelectorAll: () => [],
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,AAA' }),
    // l'écran d'ajout n'existe que si #cours-photos a été rendu : le test le simule
    getElementById: id => (id === 'cours-photos' && !o.ecranAjout ? null : dom.el(id)),
    addEventListener: (type, h) => { ecouteurs[type] = h; },
  };
  const win = { matchMedia: () => ({ matches: !!o.tactile }) };
  const f = new Function('esc', 'child', 'db', 'toast', 'modal', 'closeModal', 'familyCode', 'badFamilyCode',
    'todayStr', '$', 'document', 'fetch', 'renderDashboard', 'Image', 'URL', 'window',
    src + '\n;return {renderCours, drawCoursList, openAjoutCours, drawDraft, drawCours, openCours, drawExos, drawRevision, drawInterroScreen, fillCoursParentCard, coursCardsHtml, setCoursFiltre, openExosMenu, exoHtml, drawRevisionFin, coursFiles, ' +
    'get exoState(){return exoState}, set exoState(v){exoState=v}, get revState(){return revState}, set revState(v){revState=v}, ' +
    'get coursCur(){return coursCur}, set coursCur(v){coursCur=v}, get coursNotions(){return coursNotions}, set coursNotions(v){coursNotions=v}, ' +
    'get coursPhotos(){return coursPhotos}, set coursPhotos(v){coursPhotos=v}, ' +
    'get coursDraft(){return coursDraft}, set coursDraft(v){coursDraft=v}, get coursList(){return coursList}, set coursList(v){coursList=v}};');
  const C = f(esc, 'alix', db, m => toasts.push(m), h => { dom.el('modal-root').innerHTML = h; }, () => {}, 'CODE', () => {},
    () => '2026-10-24', sel => dom.el(String(sel).replace('#', '')), doc, async () => ({ json: async () => ({}) }),
    () => {}, function () { return { onload: null, onerror: null, set src(v) {} }; },
    { createObjectURL: () => 'blob:', revokeObjectURL: () => {} }, win);
  try {
    await fn(C, dom, db, toasts, ecouteurs);
  } catch (e) {
    ko++;
    console.log('  ✗ ' + nom + ' a levé une erreur\n     ' + e.message + '\n     ' + String(e.stack).split('\n')[1]);
    return null;
  }
  return dom;
}

const html = dom => dom.el('main').innerHTML;
/* Un gabarit mal écrit laisse des traces reconnaissables dans le HTML produit. */
function sain(nom, h) {
  vrai(nom + ' : du HTML est produit', h.length > 50, h.slice(0, 80));
  vrai(nom + " : pas d'undefined affiché", !/undefined/.test(h), (h.match(/.{0,40}undefined.{0,40}/) || [])[0]);
  vrai(nom + ' : pas de [object Object]', !/\[object Object\]/.test(h));
  vrai(nom + ' : pas de NaN', !/>NaN|NaN</.test(h));
  vrai(nom + ' : pas de gabarit non interprété', !/\$\{/.test(h), (h.match(/.{0,40}\$\{.{0,40}/) || [])[0]);
  const ouv = (h.match(/<div/g) || []).length, fer = (h.match(/<\/div>/g) || []).length;
  vrai(nom + ' : les <div> sont équilibrés', ouv === fer, `${ouv} ouverts / ${fer} fermés`);
}

console.log('\n— écran « Mes cours » avec des cours —');
{
  const dom = await scenario('renderCours', { adalix_cours: FIXTURES_COURS, adalix_cours_notions: FIXTURES_NOTIONS }, async C => { await C.renderCours(); });
  if (dom) {
    const h = html(dom);
    sain('liste', h);
    vrai('les deux cours sont listés', /Révolution française/.test(h) && /Pythagore/.test(h));
    vrai('la bannière de révision apparaît', /à revoir/.test(h));
    vrai('les filtres par matière apparaissent', /Histoire/.test(h) && /Maths/.test(h));
  }
}

console.log('\n— écran « Mes cours » vide (premier lancement) —');
{
  const dom = await scenario('renderCours vide', { adalix_cours: [], adalix_cours_notions: [] }, async C => { await C.renderCours(); });
  if (dom) {
    const h = html(dom);
    sain('liste vide', h);
    vrai('un message d\'accueil est affiché', /Aucun cours/.test(h));
    vrai('aucune bannière de révision', !/à revoir/.test(h));
    vrai('aucun filtre inutile', !/gal-filter/.test(h));
  }
}

console.log('\n— écran d\'ajout, sur téléphone ou tablette —');
{
  const dom = await scenario('openAjoutCours tactile', {}, async C => { C.openAjoutCours(); }, { tactile: true });
  if (dom) {
    const h = html(dom);
    sain('ajout tactile', h);
    vrai("l'appareil photo arrière est déclenché par l'app", /capture="environment"/.test(h));
    vrai('le bouton photo est l\'action principale', /class="btn" onclick="document.getElementById\('cours-cam'\)/.test(h));
    vrai('la consigne parle de photographier', /photo/i.test(h) && !/Ctrl \+ V/.test(h));
    vrai('toutes les matières sont proposées', (h.match(/imgchip/g) || []).length >= 15);
  }
}

console.log('\n— écran d\'ajout, sur ordinateur —');
{
  const dom = await scenario('openAjoutCours bureau', {}, async C => { C.openAjoutCours(); }, { tactile: false });
  if (dom) {
    const h = html(dom);
    sain('ajout bureau', h);
    vrai('aucun bouton « prendre une photo » qui ouvrirait l\'explorateur', !/capture="environment"/.test(h));
    vrai('le glisser-déposer est annoncé', /Glisse tes images/.test(h));
    vrai('le collage est annoncé', /Ctrl \+ V/.test(h));
    vrai('la zone accepte le dépôt de fichiers', /ondrop=/.test(h) && /dataTransfer\.files/.test(h));
    vrai('on oriente vers le téléphone pour un cahier', /téléphone/.test(h));
    vrai('choisir une image reste l\'action principale', /class="btn" onclick="document.getElementById\('cours-gal'\)/.test(h));
  }
}

console.log('\n— coller une capture d\'écran (Ctrl + V) —');
{
  const faux = t => ({ type: t, getAsFile: () => ({ type: t, name: 'x' }) });
  // sur l'écran d'ajout : l'image collée est prise en compte
  await scenario('collage sur l\'écran d\'ajout', {}, async (C, dom, db, toasts, ecouteurs) => {
    vrai('un écouteur de collage est installé', typeof ecouteurs.paste === 'function');
    let empeche = false;
    ecouteurs.paste({ clipboardData: { items: [faux('image/png')] }, preventDefault: () => { empeche = true; } });
    vrai('le collage d\'une image est intercepté', empeche);
  }, { ecranAjout: true });

  // ailleurs dans l'app : on ne doit surtout pas capturer les Ctrl+V de l'enfant
  await scenario('collage hors écran d\'ajout', {}, async (C, dom, db, toasts, ecouteurs) => {
    let empeche = false;
    ecouteurs.paste({ clipboardData: { items: [faux('image/png')] }, preventDefault: () => { empeche = true; } });
    vrai('hors de l\'écran d\'ajout, le collage est ignoré', !empeche);
  }, { ecranAjout: false });

  // du texte collé ne doit pas être pris pour une photo
  await scenario('collage de texte', {}, async (C, dom, db, toasts, ecouteurs) => {
    let empeche = false;
    ecouteurs.paste({ clipboardData: { items: [faux('text/plain')] }, preventDefault: () => { empeche = true; } });
    vrai('coller du texte ne déclenche rien', !empeche);
  }, { ecranAjout: true });
}

console.log('\n— dépôt de fichiers : on ignore ce qui n\'est pas une image —');
{
  await scenario('coursFiles filtre', {}, async C => {
    C.coursPhotos = [];
    C.coursFiles([{ type: 'application/pdf', name: 'cours.pdf' }, { type: 'text/plain', name: 'a.txt' }]);
    vrai('un PDF déposé est ignoré sans planter', C.coursPhotos.length === 0);
  }, { ecranAjout: true });

  await scenario('coursFiles plafond', {}, async (C, dom, db, toasts) => {
    C.coursPhotos = [1, 2, 3, 4, 5];
    C.coursFiles([{ type: 'image/jpeg' }]);
    vrai('au-delà de 5 photos, l\'enfant est prévenu', toasts.some(t => /5 photos maximum/.test(t)), toasts.join(' | '));
  }, { ecranAjout: true });
}

console.log('\n— aperçu avant enregistrement —');
{
  const draft = Object.assign({}, FIXTURES_COURS[0], {
    a_retenir: [{ notion: 'Date clé', q: 'Quand ?', r: '1789' }],
    incertitudes: ['un mot page 2'],
  });
  const dom = await scenario('drawDraft', {}, async C => { C.coursDraft = draft; C.drawDraft(); });
  if (dom) {
    const h = html(dom);
    sain('aperçu', h);
    vrai('les incertitudes sont signalées', /un mot page 2/.test(h));
    vrai('le cours est rendu en HTML, pas en Markdown brut', /<h4>Les causes<\/h4>/.test(h) && !/## Les causes/.test(h));
    vrai('le gras est rendu', /<b>crise<\/b>/.test(h));
    vrai('la citation est rendue', /<blockquote>Une règle<\/blockquote>/.test(h));
    vrai('la liste numérotée est rendue', /<ol><li>un<\/li><li>deux<\/li><\/ol>/.test(h));
    vrai('le lien ressource est présent et externe', /target="_blank"/.test(h) && /rel="noopener"/.test(h));
  }
}

console.log('\n— écran d\'un cours enregistré —');
{
  const dom = await scenario('openCours', { adalix_cours: FIXTURES_COURS, adalix_cours_notions: FIXTURES_NOTIONS }, async C => { await C.openCours(1); });
  if (dom) {
    const h = html(dom);
    sain('cours', h);
    vrai('les boutons de révision sont là', /Interroge-moi/.test(h) && /exercices/.test(h));
    vrai('les notions dues sont annoncées', /notion à revoir/.test(h), (h.match(/.{0,30}à revoir.{0,20}/) || [])[0]);
    vrai("les boutons d'action ne seront pas imprimés", /class="card no-print"/.test(h));
    vrai('le vocabulaire est affiché', /Tiers État/.test(h));
  }
}

console.log('\n— fiche d\'exercices (avant et après correction) —');
{
  const ex = [
    { type: 'qcm', enonce: 'Quelle date ?', options: ['1788', '1789', '1790', '1791'], reponse: '1', explication: 'La prise de la Bastille.', notion: 'Date clé' },
    { type: 'reponse', enonce: 'Qui est le Tiers État ?', options: [], reponse: 'Le peuple', explication: 'Les 98 %.', notion: 'Tiers État' },
  ];
  let dom = await scenario('drawExos', {}, async C => {
    C.coursCur = FIXTURES_COURS[0]; C.coursNotions = FIXTURES_NOTIONS;
    C.exoState = { ex, rep: ['', ''], res: null, t0: Date.now() };
    C.drawExos();
  });
  if (dom) {
    const h = html(dom);
    sain('exercices', h);
    vrai('le QCM propose ses 4 options', (h.match(/quiz-opt/g) || []).length === 4);
    vrai('la question ouverte a une zone de texte', /<textarea/.test(h));
    vrai('la bonne réponse n\'est pas divulguée', !/Le peuple/.test(h), 'la réponse attendue apparaît avant correction !');
    vrai('le bouton de correction est présent', /Corriger ma fiche/.test(h));
  }
  dom = await scenario('drawExos corrigé', {}, async C => {
    C.coursCur = FIXTURES_COURS[0]; C.coursNotions = FIXTURES_NOTIONS;
    C.exoState = { ex, rep: ['1', 'les pauvres'], res: [{ ok: true, commentaire: 'Bon choix.' }, { ok: false, commentaire: 'Presque.' }], t0: Date.now() };
    C.drawExos();
  });
  if (dom) {
    const h = html(dom);
    sain('exercices corrigés', h);
    vrai('le score est affiché', /1\/2/.test(h));
    vrai('la correction juste est en vert', /quiz-fb ok/.test(h));
    vrai('la correction fausse est en rouge', /quiz-fb ko/.test(h));
    vrai('les explications sont données', /prise de la Bastille/.test(h));
    vrai('les options sont verrouillées', (h.match(/disabled/g) || []).length >= 4);
  }
}

console.log('\n— révisions espacées —');
{
  let dom = await scenario('drawRevision', {}, async C => {
    C.revState = { notions: FIXTURES_NOTIONS, i: 0, vu: false, bons: 0, coursId: 1 };
    C.drawRevision();
  });
  if (dom) {
    const h = html(dom);
    sain('révision', h);
    vrai('la question est posée', /Quand commence la Révolution/.test(h));
    vrai('la réponse est cachée', !/1789/.test(h), 'la réponse est visible avant que l\'enfant ait cherché !');
    vrai('la progression est affichée', /1 \/ 2/.test(h));
  }
  dom = await scenario('drawRevision révélée', {}, async C => {
    C.revState = { notions: FIXTURES_NOTIONS, i: 0, vu: true, bons: 0, coursId: 1 };
    C.drawRevision();
  });
  if (dom) {
    const h = html(dom);
    sain('révision révélée', h);
    vrai('la réponse est montrée', /1789/.test(h));
    vrai('les deux boutons d\'auto-évaluation sont là', /Je l'avais/.test(h) && /Pas vraiment/.test(h));
  }
  dom = await scenario('drawRevisionFin', {}, async C => {
    C.revState = { notions: FIXTURES_NOTIONS, i: 2, vu: false, bons: 2, coursId: 1 };
    await C.drawRevision();
  });
  if (dom) { sain('fin de révision', html(dom)); vrai('le score final est affiché', /2\/2/.test(html(dom))); }
}

console.log('\n— interro orale —');
{
  const dom = await scenario('drawInterroScreen', {}, async C => {
    C.coursCur = FIXTURES_COURS[0]; C.coursNotions = FIXTURES_NOTIONS;
    C.drawInterroScreen();
  });
  if (dom) {
    const h = html(dom);
    sain('interro', h);
    vrai('le champ de réponse est là', /id="interro-in"/.test(h));
    vrai('on peut passer une question', /Je ne sais pas/.test(h));
  }
}

console.log('\n— carte du tableau de bord parent —');
{
  const dom = await scenario('fillCoursParentCard', {
    adalix_cours: FIXTURES_COURS, adalix_cours_notions: FIXTURES_NOTIONS,
    adalix_cours_revisions: [{ id: 1, child: 'alix', type: 'exos', score: 3, total: 4, created_at: '2026-10-23T10:00:00Z' }],
  }, async C => { await C.fillCoursParentCard(); });
  if (dom) {
    const h = dom.el('cours-parent-card').innerHTML;
    sain('tableau de bord', h);
    vrai('les deux enfants figurent', /Adam/.test(h) && /Alix/.test(h));
    vrai('ce qui résiste est signalé', /Date clé/.test(h), 'la notion ratée 3 fois devrait remonter');
    vrai('le taux de réussite est calculé', /75 %/.test(h), (h.match(/\d+ %/) || [])[0]);
  }
  const vide = await scenario('fillCoursParentCard vide', { adalix_cours: [], adalix_cours_notions: [], adalix_cours_revisions: [] }, async C => { await C.fillCoursParentCard(); });
  if (vide) vrai('sans cours : message, pas de plantage', /Aucun cours/.test(vide.el('cours-parent-card').innerHTML));
}

console.log('\n' + (ko ? `❌ ${ko} échec(s), ${ok} test(s) passés` : `✅ ${ok} tests passés`));
process.exit(ko ? 1 : 0);
