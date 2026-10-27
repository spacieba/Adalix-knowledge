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
  const clics = [];
  const el = id => elements[id] || (elements[id] = {
    id, innerHTML: '', value: '', textContent: '', disabled: false, dataset: {},
    // une balise <video> : zéro tant que la caméra n'a pas démarré
    videoWidth: 0, videoHeight: 0, srcObject: null, play: () => Promise.resolve(),
    classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
    click: () => clics.push(id), focus: () => {},
  });
  return { elements, el, clics };
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

/* ---------- faux IndexedDB ----------
   On ne garde que ce que cours.js utilise : ouvrir, put, get, delete. Les requêtes
   répondent au prochain microtâche, comme les vraies : le code branche ses handlers
   juste après l'appel, et il faut qu'ils soient en place quand ça répond. */
function fauxIdb(magasin) {
  const repond = dem => { Promise.resolve().then(() => { if (dem.onsuccess) dem.onsuccess(); }); return dem; };
  const store = {
    put(v, k) { magasin[k] = v; return repond({ result: undefined }); },
    get(k) { return repond({ result: magasin[k] }); },
    delete(k) { delete magasin[k]; return repond({ result: undefined }); },
  };
  const base = { transaction: () => ({ objectStore: () => store, oncomplete: null, onerror: null, onabort: null }) };
  return { open: () => repond({ result: base }) };
}
/* Un FileReader : il rend un dataURL dont le corps dit QUELLE version de la page a été
   lue (G la grande, P l'archive) et combien elle pèse. C'est ce qui permet de vérifier
   ce qui part réellement au serveur. */
function FauxFileReader() { this.onload = null; this.onerror = null; this.result = ''; }
FauxFileReader.prototype.readAsDataURL = function (b) {
  const marque = (b && b.marque) || 'Z';
  const taille = (b && b.size) || 4;
  this.result = 'data:image/jpeg;base64,' + marque.repeat(taille);
  Promise.resolve().then(() => { if (this.onload) this.onload(); });
};
/* Une page déjà prise, pour les tests qui partent d'un cours photographié. */
const pageFaite = (marque, taille) => ({
  grande: { marque: marque || 'G', size: taille || 1200 },
  petite: { marque: 'P', size: 100 },
  url: 'blob:apercu',
});

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
    createElement: () => {
      const cv = {
        width: 0, height: 0, getContext: () => ({ drawImage: () => {} }),
        toDataURL: () => 'data:image/jpeg;base64,AAAA',
      };
      // o.sansToBlob : un navigateur sans canvas.toBlob, où il faut repasser par le dataURL
      if (!o.sansToBlob) cv.toBlob = (cb, type, q) => cb({ size: o.poids || 1200, marque: q > 0.75 ? 'G' : 'P' });
      return cv;
    },
    // l'écran d'ajout n'existe que si #cours-photos a été rendu : le test le simule
    getElementById: id => (id === 'cours-photos' && !o.ecranAjout ? null : dom.el(id)),
    addEventListener: (type, h) => { ecouteurs[type] = h; },
  };
  const win = { matchMedia: () => ({ matches: !!o.tactile }) };
  /* Appareil photo simulé. o.camera : 'ok' il marche, 'refus' l'utilisateur dit non,
     absent il n'y en a pas du tout (ordinateur sans webcam, navigateur trop vieux). */
  const cam = { contraintes: null, arrets: 0 };
  const flux = { getTracks: () => [{ stop: () => { cam.arrets++; } }] };
  const nav = { userAgent: 'Test' };
  if (o.camera) {
    nav.mediaDevices = {
      getUserMedia: c => {
        cam.contraintes = c;
        return o.camera === 'refus'
          ? Promise.reject(new Error('NotAllowedError'))
          : Promise.resolve(flux);
      },
    };
  }
  const refusCode = [];
  /* Le micro vient d'app.js. o.micro : le navigateur sait écouter, donc le bouton doit
     apparaître ; absent : aucun bouton, c'est la règle « jamais un bouton qui ne
     marche pas ». */
  const micArrets = [];
  /* La voix de l'assistant (lecture.js) et le carnet de mots (lecture.js) sont simulés :
     ici on vérifie ce que cours.js leur demande, pas comment ils le font.
     o.voix : l'appareil sait parler. o.idb : le navigateur garde les pages. */
  const dits = [], vxArrets = [], motsEcrits = [], envois = [];
  const magasin = o.idb || {};
  const f = new Function('esc', 'child', 'db', 'toast', 'modal', 'closeModal', 'familyCode', 'badFamilyCode',
    'todayStr', '$', 'document', 'fetch', 'renderDashboard', 'Image', 'URL', 'window', 'navigator', 'console',
    'micBtn', 'micDispo', 'micStop',
    'vxBtn', 'vxDispo', 'vxCharge', 'vxStop', 'vxAuto', 'vxDire', 'motsAjoute', 'FileReader', 'indexedDB',
    src + '\n;return {renderCours, drawCoursList, openAjoutCours, drawDraft, drawCours, openCours, drawExos, drawRevision, drawInterroScreen, finirInterro, matieresInterro, interroAnnee, fillCoursParentCard, coursCardsHtml, setCoursFiltre, openExosMenu, exoHtml, drawRevisionFin, coursFiles, ' +
    'get exoState(){return exoState}, set exoState(v){exoState=v}, get revState(){return revState}, set revState(v){revState=v}, ' +
    'get coursCur(){return coursCur}, set coursCur(v){coursCur=v}, get coursNotions(){return coursNotions}, set coursNotions(v){coursNotions=v}, ' +
    'get coursPhotos(){return coursPhotos}, set coursPhotos(v){coursPhotos=v}, ' +
    'get coursDraft(){return coursDraft}, set coursDraft(v){coursDraft=v}, get coursList(){return coursList}, set coursList(v){coursList=v}, ' +
    'ouvrirCamera, camDeclic, fermerCamera, drawCamera, majCamera, cameraDispo, camRepli, coursPousseImage, ' +
    'camAnnuleDerniere, camDernierHtml, coursRetirePhoto, enregistrerCours, envoyerInterro, drawInterro, ' +
    'callCours, photosPaquet, lancerTranscription, SEUIL_ENVOI, PHOTOS_PAR_ENVOI, MATIERES, fusionneCours, ' +
    'photosGarde, photosOublie, photosEnAttente, photosReprends, reprendrePages, jeterPages, confirmJeterPages, ' +
    'get coursErr(){return coursErr}, get coursAttente(){return coursAttente}, set coursAttente(v){coursAttente=v}, ' +
    'get coursNotes(){return coursNotes}, set coursNotes(v){coursNotes=v}, ' +
    'get matChoisie(){return matChoisie}, set matChoisie(v){matChoisie=v}, ' +
    'get camStream(){return camStream}};');
  const C = f(esc, 'alix', db, m => toasts.push(m), h => { dom.el('modal-root').innerHTML = h; }, () => { dom.el('modal-root').innerHTML = ''; }, 'CODE',
    relance => refusCode.push(relance),
    () => '2026-10-24', sel => dom.el(String(sel).replace('#', '')), doc,
    /* o.reponse : la réponse du serveur, ou une fonction qui en donne une différente
       à chaque appel — c'est ainsi qu'on teste la relance automatique. */
    async (url, init) => {
      try { envois.push(JSON.parse((init && init.body) || '{}')); } catch (e) { envois.push(null); }
      const r = typeof o.reponse === 'function' ? o.reponse(envois.length) : o.reponse;
      return r || { status: 200, json: async () => ({}) };
    },
    () => {}, function () { return { onload: null, onerror: null, set src(v) {} }; },
    { createObjectURL: () => 'blob:', revokeObjectURL: () => {} }, win, nav, { log() {}, warn() {}, error() {} },
    id => (o.micro ? `<button class="btn ghost mic-btn" id="mic-${id}" onclick="micToggle('${id}')">🎤</button>` : ''),
    () => !!o.micro, () => micArrets.push(1),
    () => (o.voix ? '<button class="btn ghost" id="vx-btn" onclick="vxBascule()">🔇 Sa voix : non</button>' : ''),
    () => !!o.voix, () => {}, () => vxArrets.push(1),
    t => dits.push({ auto: true, t }), t => dits.push({ auto: false, t }),
    async (mots, source) => { motsEcrits.push({ mots, source }); return (mots || []).length; },
    FauxFileReader, o.idb ? fauxIdb(magasin) : undefined);
  dom.cam = cam;
  dom.micArrets = micArrets;
  dom.dits = dits;
  dom.vxArrets = vxArrets;
  dom.motsEcrits = motsEcrits;
  dom.magasin = magasin;
  dom.envois = envois;
  dom.refusCode = refusCode;
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
    vrai('le bouton photo ouvre l\'appareil photo intégré', /class="btn" onclick="ouvrirCamera\(\)"/.test(h));
    vrai("l'ancien <input capture> reste comme repli", /id="cours-cam"/.test(h));
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

/* ---------- appareil photo intégré ----------
   Le <input capture> passait la main à l'app Appareil photo du système ; sur l'Android
   de la maison, Android détruisait l'onglet à CHAQUE fois et la page se rechargeait —
   photo perdue, retour à l'écran des profils. Ici la caméra vit dans la page. */
console.log('\n— appareil photo intégré —');
{
  const dom = await scenario('caméra absente', {}, async C => {
    vrai("sans mediaDevices, l'app le sait", C.cameraDispo() === false);
    C.openAjoutCours();
    await C.ouvrirCamera();
  }, { tactile: true });
  if (dom) {
    vrai("on retombe sur l'ancien bouton", dom.clics.includes('cours-cam'));
    vrai("aucun écran de caméra n'est ouvert", !/cam-plein/.test(dom.el('modal-root').innerHTML));
  }
}

{
  const dom = await scenario('caméra refusée', {}, async (C, d, db, toasts) => {
    C.openAjoutCours();
    await C.ouvrirCamera();
    vrai('un refus est expliqué', toasts.some(t => /refus/i.test(t)), JSON.stringify(toasts));
  }, { tactile: true, camera: 'refus' });
  if (dom) {
    vrai("un refus bascule sur l'ancien bouton", dom.clics.includes('cours-cam'));
    vrai('aucun flux ne reste ouvert', !/cam-plein/.test(dom.el('modal-root').innerHTML));
  }
}

{
  const dom = await scenario('caméra ouverte', {}, async C => {
    C.openAjoutCours();
    await C.ouvrirCamera();
  }, { tactile: true, camera: 'ok' });
  if (dom) {
    const h = dom.el('modal-root').innerHTML;
    sain('écran caméra', h);
    vrai("l'écran plein écran est là", /cam-plein/.test(h));
    vrai('la vidéo est en ligne, pas en plein écran système', /playsinline/.test(h));
    vrai('le déclencheur est là', /onclick="camDeclic\(\)"/.test(h));
    vrai('on peut sortir', /onclick="fermerCamera\(\)"/.test(h));
    vrai('le compteur part de zéro, sans plafond', /0 page/.test(h) && !/\/ 5/.test(h));
    vrai('la consigne de cadrage est donnée', /Cadre la page/.test(h));
    vrai("c'est la caméra arrière qui est demandée", dom.cam.contraintes.video.facingMode.ideal === 'environment',
      JSON.stringify(dom.cam.contraintes));
    vrai('le micro n\'est pas demandé', dom.cam.contraintes.audio === false);
    vrai('le flux est branché sur la vidéo', !!dom.el('cam-video').srcObject);
  }
}

{
  // déclencher avant que la caméra ait démarré ne doit pas produire une image vide
  await scenario('déclic trop tôt', {}, async (C, d, db, toasts) => {
    C.openAjoutCours();
    await C.ouvrirCamera();
    C.camDeclic();
    vrai('aucune photo prise avant le démarrage', C.coursPhotos.length === 0);
    vrai('et on le dit', toasts.some(t => /démarre/.test(t)), JSON.stringify(toasts));
  }, { tactile: true, camera: 'ok' });
}

{
  // le cas normal : on enchaîne les pages sans jamais quitter l'app
  const dom = await scenario('enchaîner les pages', {}, async (C, d) => {
    C.openAjoutCours();
    await C.ouvrirCamera();
    d.el('cam-video').videoWidth = 1600; d.el('cam-video').videoHeight = 1200;
    const avant = d.el('modal-root').innerHTML;
    await C.camDeclic();
    vrai('la première page est prise', C.coursPhotos.length === 1);
    vrai('la page est gardée en deux tailles, hors de la mémoire texte',
      !!C.coursPhotos[0].grande && !!C.coursPhotos[0].petite && !C.coursPhotos[0].data);
    vrai("elle a un aperçu sans recopier l'image", /^blob:/.test(C.coursPhotos[0].url));
    vrai('le bas de l\'écran a suivi', /1 page/.test(d.el('cam-dernier').innerHTML), d.el('cam-dernier').innerHTML);
    vrai("l'écran n'est pas redessiné (la vidéo ne redémarre pas)", d.el('modal-root').innerHTML === avant);
    vrai('la caméra reste ouverte', !!C.camStream);

    await C.camDeclic();
    vrai('la deuxième page aussi', C.coursPhotos.length === 2);
    vrai('le compteur suit encore', /2 pages/.test(d.el('cam-dernier').innerHTML));
  }, { tactile: true, camera: 'ok' });
  if (dom) vrai('rien ne traîne à la fin', dom.cam.arrets === 0);
}

{
  // plus de plafond : un cours de huit pages ne doit pas être refusé à la cinquième
  const dom = await scenario('huit pages de suite', {}, async (C, d) => {
    C.openAjoutCours();
    await C.ouvrirCamera();
    d.el('cam-video').videoWidth = 1600; d.el('cam-video').videoHeight = 1200;
    for (let i = 0; i < 8; i++) await C.camDeclic();
    vrai('huit pages prises', C.coursPhotos.length === 8);
    vrai("la caméra ne s'est pas fermée toute seule", /cam-plein/.test(d.el('modal-root').innerHTML));
    vrai('le flux est toujours là', !!C.camStream);
    C.fermerCamera();
  }, { tactile: true, camera: 'ok' });
  if (dom) {
    vrai('la caméra est coupée quand on a fini', dom.cam.arrets > 0);
    vrai('aucun plafond annoncé', !dom.el('main').innerHTML.match(/maximum/));
  }
}

{
  // une photo mal cadrée se reprend sur place, sans fermer l'appareil photo
  await scenario('reprendre la dernière page', {}, async (C, d, db, toasts) => {
    C.openAjoutCours();
    await C.ouvrirCamera();
    d.el('cam-video').videoWidth = 1600; d.el('cam-video').videoHeight = 1200;
    await C.camDeclic(); await C.camDeclic();
    const h = d.el('cam-dernier').innerHTML;
    vrai("la dernière page prise est montrée", /<img src="blob:/.test(h), h);
    vrai('et on peut la reprendre', /camAnnuleDerniere\(\)/.test(h));
    await C.camAnnuleDerniere();
    vrai('la page est retirée', C.coursPhotos.length === 1);
    vrai('on le dit clairement', toasts.some(t => /refais-la/.test(t)), JSON.stringify(toasts));
    vrai('la caméra reste ouverte pour refaire la photo', !!C.camStream);
    vrai('le bas de l\'écran est à jour', /1 page/.test(d.el('cam-dernier').innerHTML));
    await C.camAnnuleDerniere();
    vrai('la dernière aussi peut partir', C.coursPhotos.length === 0);
    vrai('et il ne reste rien à reprendre', !/camAnnuleDerniere/.test(d.el('cam-dernier').innerHTML));
  }, { tactile: true, camera: 'ok' });
}

{
  // un navigateur sans canvas.toBlob doit quand même produire une page
  await scenario('sans toBlob', {}, async (C, d) => {
    C.openAjoutCours();
    await C.ouvrirCamera();
    d.el('cam-video').videoWidth = 1600; d.el('cam-video').videoHeight = 1200;
    await C.camDeclic();
    vrai('la page est quand même prise', C.coursPhotos.length === 1);
    vrai('et elle a bien ses deux tailles', !!C.coursPhotos[0].grande && !!C.coursPhotos[0].petite);
  }, { tactile: true, camera: 'ok', sansToBlob: true });
}

{
  // fermer rend toujours la caméra, même sans avoir pris de photo
  const dom = await scenario('fermer sans photo', {}, async (C, d) => {
    C.openAjoutCours();
    await C.ouvrirCamera();
    C.fermerCamera();
    vrai('le flux est rendu', !C.camStream);
    vrai("l'écran est refermé", !/cam-plein/.test(d.el('modal-root').innerHTML));
  }, { tactile: true, camera: 'ok' });
  if (dom) vrai('la caméra a été coupée', dom.cam.arrets > 0);
}

/* ---------- ce que le serveur peut répondre ----------
   Toutes les réponses ne sont pas du JSON : au-delà de ~4,5 Mo de corps, Vercel renvoie
   lui-même un 413 en texte brut. Et un code refusé doit relancer le geste tout seul,
   sinon l'enfant saisit le code et « rien ne se passe ». */
console.log('\n— réponses du serveur —');
{
  const dom = await scenario('code famille refusé', {}, async (C, d) => {
    C.openAjoutCours();
    C.coursPhotos = [{ media_type: 'image/jpeg', data: 'AAA', archive: 'aa', dataUrl: 'd' }];
    await C.lancerTranscription();
  }, { ecranAjout: true, reponse: { status: 200, json: async () => ({ error: 'code_famille' }) } });
  if (dom) {
    vrai('le code est redemandé', dom.refusCode.length === 1);
    vrai('et le geste sera rejoué tout seul', typeof dom.refusCode[0] === 'function');
  }
}

{
  const dom = await scenario('photos trop lourdes', {}, async (C, d, db, toasts) => {
    C.openAjoutCours();
    C.coursPhotos = [{ media_type: 'image/jpeg', data: 'AAA', archive: 'aa', dataUrl: 'd' }];
    await C.lancerTranscription();
    vrai('le poids est expliqué simplement', toasts.some(t => /trop lourdes/.test(t)), JSON.stringify(toasts));
  }, { ecranAjout: true, reponse: { status: 413, json: async () => { throw new Error('pas du JSON'); } } });
  if (dom) vrai('aucune demande de code pour un problème de poids', dom.refusCode.length === 0);
}

{
  const dom = await scenario('réponse illisible', {}, async (C, d, db, toasts) => {
    C.openAjoutCours();
    C.coursPhotos = [{ media_type: 'image/jpeg', data: 'AAA', archive: 'aa', dataUrl: 'd' }];
    await C.lancerTranscription();
    vrai('on le dit au lieu de planter', toasts.some(t => /réessaie/.test(t)), JSON.stringify(toasts));
  }, { ecranAjout: true, reponse: { status: 500, json: async () => { throw new Error('pas du JSON'); } } });
  if (dom) vrai('et on ne redemande pas le code', dom.refusCode.length === 0);
}

console.log('\n— poids de l\'envoi —');
{
  await scenario('envoi léger', {}, async C => {
    C.coursPhotos = [pageFaite('G', 1000)];
    const env = await C.photosPaquet(0, 1);
    vrai('sous le seuil, on envoie la bonne qualité', env[0].data[0] === 'G');
    vrai('le type est conservé', env[0].media_type === 'image/jpeg');
  }, { ecranAjout: true });

  await scenario('envoi trop lourd', {}, async C => {
    const gros = Math.ceil(C.SEUIL_ENVOI / 2) + 10;
    C.coursPhotos = [1, 2, 3].map(() => pageFaite('G', gros));
    const env = await C.photosPaquet(0, 3);
    vrai('au-dessus du seuil, on bascule sur les archives', env.every(p => p.data[0] === 'P'),
      env.map(p => p.data[0]).join(''));
    vrai('toutes les pages du paquet sont quand même envoyées', env.length === 3);
  }, { ecranAjout: true });

  await scenario('un paquet, pas tout', {}, async C => {
    C.coursPhotos = [1, 2, 3, 4, 5, 6].map(() => pageFaite('G', 10));
    const env = await C.photosPaquet(4, 6);
    vrai('on n\'encode que les pages demandées', env.length === 2);
  }, { ecranAjout: true });
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

  await scenario('coursFiles sans plafond', {}, async (C, dom, db, toasts) => {
    C.coursPhotos = [1, 2, 3, 4, 5].map(() => pageFaite());
    C.coursFiles([{ type: 'image/jpeg', name: 'a.jpg' }]);
    vrai('une sixième image n\'est jamais refusée', !toasts.some(t => /maximum/.test(t)), toasts.join(' | '));
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
    vrai("sans reconnaissance vocale, aucun bouton micro", !/mic-interro-in/.test(h));
    vrai("et aucune consigne qui parlerait d'un micro absent", !/Touche le micro/.test(h));
  }
}

/* Répondre à l'oral : une interro où il faut taper n'est plus une interro orale, et
   écrire est justement l'obstacle. Le bouton ne doit exister que si le navigateur sait
   écouter, et le micro ne doit pas rester ouvert derrière l'écran qu'on quitte. */
{
  const dom = await scenario('interro avec micro', { adalix_cours_revisions: [] }, async C => {
    C.coursCur = FIXTURES_COURS[0]; C.coursNotions = FIXTURES_NOTIONS;
    C.drawInterroScreen();
  }, { micro: true });
  if (dom) {
    const h = html(dom);
    sain('interro micro', h);
    vrai('le bouton micro visse le champ de réponse', /id="mic-interro-in"/.test(h));
    vrai('il est cliquable', /micToggle\('interro-in'\)/.test(h));
    vrai("et l'enfant sait quoi en faire", /micro/i.test(h) && /voix haute/.test(h));
  }
}
{
  const dom = await scenario('finirInterro coupe le micro', { adalix_cours: FIXTURES_COURS, adalix_cours_notions: FIXTURES_NOTIONS }, async C => {
    C.coursCur = FIXTURES_COURS[0]; C.coursNotions = FIXTURES_NOTIONS;
    C.drawInterroScreen();
    await C.finirInterro();
  }, { micro: true });
  if (dom) vrai("terminer l'interro coupe le micro", dom.micArrets.length === 1, String(dom.micArrets.length));
}

/* ---------- ce que l'assistant demande au module ----------
   « Interroge-moi » laisse l'enfant choisir une matière de son année. Deux pièges :
   proposer une matière sur laquelle on n'aurait rien à demander, et envoyer au modèle
   une réponse qu'il n'a pas à connaître avant de l'avoir posée. */
console.log('\n— les matières proposées à l\'assistant —');
{
  const dom = await scenario('matieresInterro', { adalix_cours: FIXTURES_COURS }, async (C, d) => {
    const mats = await C.matieresInterro();
    vrai('toutes les matières sont proposées', mats.length > 10, String(mats.length));
    vrai('celles où il a des cours viennent en tête', mats[0].cours > 0 && mats[1].cours > 0,
      JSON.stringify(mats.slice(0, 3)));
    vrai('avec le nombre de cours', mats.find(m => m.id === 'histoire').cours === 1
      && mats.find(m => m.id === 'maths').cours === 1);
    vrai('les autres annoncent zéro cours, pas undefined', mats.filter(m => m.cours === undefined).length === 0);
    vrai('chacune a un emoji et un intitulé', mats.every(m => m.emoji && m.label));
    vrai("« Autre » n'est pas proposé à vide", !mats.some(m => m.id === 'autre'));
  });
  if (!dom) vrai('matieresInterro ne plante pas', false);

  await scenario('matieresInterro sans aucun cours', { adalix_cours: [] }, async C => {
    const mats = await C.matieresInterro();
    vrai('un cahier vide propose quand même les matières', mats.length > 10, String(mats.length));
    vrai('et aucune ne prétend avoir des cours', mats.every(m => m.cours === 0));
  });
}

console.log('\n— le contexte d\'une interro de l\'année —');
{
  await scenario('interroAnnee avec cours', { adalix_cours: FIXTURES_COURS, adalix_cours_notions: FIXTURES_NOTIONS }, async C => {
    const a = await C.interroAnnee('histoire');
    vrai('la matière est nommée', /Histoire/.test(a.label) && !!a.emoji);
    vrai('le titre du cours y est', /Révolution française/.test(a.ctx));
    vrai('le résumé y est', /Le résumé/.test(a.ctx));
    vrai('les points clés y sont', /Point A/.test(a.ctx));
    vrai('le vocabulaire y est', /Tiers État = le peuple/.test(a.ctx));
    vrai('les questions déjà travaillées y sont', /Quand commence la Révolution \?/.test(a.ctx));
    vrai('ce qui résiste est signalé au tuteur', /RÉSISTE/.test(a.ctx) && /Date clé/.test(a.ctx));
    vrai("le tuteur est tenu de rester sur le cahier", /SUR CES COURS/.test(a.ctx));
    vrai('aucun gabarit non interprété', !/\$\{/.test(a.ctx));
  });

  await scenario('interroAnnee sans cours dans la matière', { adalix_cours: [] }, async C => {
    const a = await C.interroAnnee('svt');
    vrai('la matière est quand même nommée', /SVT/.test(a.label));
    vrai('on le dit clairement : pas de cahier ici', /aucun cours/.test(a.ctx));
    vrai('on bascule sur le programme de sa classe', /programme de SVT/.test(a.ctx));
    vrai("et on l'oriente vers Mes cours", /Mes cours/.test(a.ctx));
    vrai('aucun gabarit non interprété', !/\$\{/.test(a.ctx));
  });

  await scenario('interroAnnee : une matière inconnue ne casse rien', { adalix_cours: [] }, async C => {
    const a = await C.interroAnnee('nimportequoi');
    vrai('on retombe sur « Autre »', !!a.label && !!a.ctx);
  });
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

/* ---------- plus rien ne vit seulement en mémoire ----------
   Alix perdait ses photos : elle appuyait sur « Mettre au propre » et l'app revenait à
   l'écran de départ comme si elle n'avait rien fait. Chaque page doit donc être écrite
   dès la prise, et retrouvable au retour. */
console.log('\n— les pages sont gardées dès qu\'on les prend —');
{
  const dom = await scenario('garder chaque page', {}, async (C, d) => {
    C.openAjoutCours();
    C.matChoisie = 'svt';
    C.coursNotes = 'le schéma de la page 2 tombera au contrôle';
    await C.ouvrirCamera();
    d.el('cam-video').videoWidth = 1600; d.el('cam-video').videoHeight = 1200;
    await C.camDeclic();
    vrai('la première page est déjà à l\'abri', !!(d.magasin.alix && d.magasin.alix.pages.length === 1));
    await C.camDeclic();
    vrai('la deuxième aussi', d.magasin.alix.pages.length === 2);
    vrai('la matière est gardée avec les pages', d.magasin.alix.matiere === 'svt');
    vrai('et ce qu\'il a précisé', /schéma/.test(d.magasin.alix.notes));
    vrai('les deux tailles sont gardées, pas du texte', !!d.magasin.alix.pages[0].grande && !!d.magasin.alix.pages[0].petite);
    await C.coursRetirePhoto(0);
    vrai('retirer une page la retire aussi du stockage', d.magasin.alix.pages.length === 1);
  }, { tactile: true, camera: 'ok', idb: {} });
  if (dom) vrai('rien d\'autre n\'a été écrit', Object.keys(dom.magasin).length === 1, Object.keys(dom.magasin).join(','));
}
{
  // un navigateur sans IndexedDB (mode privé, quota plein) ne doit rien casser
  await scenario('sans IndexedDB', {}, async (C, d) => {
    C.openAjoutCours();
    await C.ouvrirCamera();
    d.el('cam-video').videoWidth = 1600; d.el('cam-video').videoHeight = 1200;
    await C.camDeclic();
    vrai('la page est quand même prise', C.coursPhotos.length === 1);
    vrai('et garder ne lève rien', (await C.photosGarde()) === null);
  }, { tactile: true, camera: 'ok' });
}

console.log('\n— retrouver ses pages au retour —');
{
  const attente = { alix: { matiere: 'svt', notes: 'la prof a insisté', ts: Date.now(), pages: [1, 2, 3].map(() => ({ grande: { marque: 'G', size: 10 }, petite: { marque: 'P', size: 5 } })) } };
  const dom = await scenario('la carte de reprise', { adalix_cours: FIXTURES_COURS, adalix_cours_notions: [] },
    async C => { await C.renderCours(); }, { idb: attente });
  if (dom) {
    const h = html(dom);
    sain('reprise', h);
    vrai('on lui dit que ses pages sont là', /3 pages/.test(h) && /gardées|rien n'est perdu/.test(h));
    vrai('la matière est rappelée', /svt|sciences/i.test(h) || /SVT/.test(h));
    vrai('il peut reprendre', /reprendrePages\(\)/.test(h));
    vrai('il peut aussi les jeter', /jeterPages\(\)/.test(h));
  }
}
{
  const attente = { alix: { matiere: 'svt', notes: 'la prof a insisté', ts: Date.now(), pages: [1, 2].map(() => ({ grande: { marque: 'G', size: 10 }, petite: { marque: 'P', size: 5 } })) } };
  const dom = await scenario('reprendre', { adalix_cours: [], adalix_cours_notions: [] }, async C => {
    await C.renderCours();
    C.reprendrePages();
    vrai('les deux pages sont revenues', C.coursPhotos.length === 2);
    vrai('chacune a un nouvel aperçu', C.coursPhotos.every(p => /^blob:/.test(p.url)));
    vrai('la matière est retrouvée', C.matChoisie === 'svt');
    vrai('et ses précisions aussi', /insisté/.test(C.coursNotes));
  }, { idb: attente, tactile: true });
  if (dom) {
    const h = html(dom);
    vrai("on repart de l'écran des photos", /Mettre au propre/.test(h));
    vrai('ses précisions sont réaffichées', /insisté/.test(h));
    vrai('la carte de reprise a disparu', !/reprendrePages/.test(h));
  }
}
{
  const attente = { alix: { matiere: 'histoire', notes: '', ts: Date.now(), pages: [{ grande: { marque: 'G', size: 10 }, petite: { marque: 'P', size: 5 } }] } };
  const dom = await scenario('jeter', { adalix_cours: [], adalix_cours_notions: [] }, async (C, d) => {
    await C.renderCours();
    C.jeterPages();
    vrai('on demande confirmation avant de jeter', /jeter/i.test(d.el('modal-root').innerHTML));
    await C.confirmJeterPages();
    vrai('les pages sont effacées du stockage', !d.magasin.alix);
    vrai('et la carte disparaît', !/reprendrePages/.test(html(d)));
  }, { idb: attente });
  if (dom) vrai('rien ne traîne en mémoire', dom.magasin.alix === undefined);
}
{
  // il est déjà en train de photographier : on ne lui propose pas de « reprendre »
  await scenario('pas de carte si des pages sont en cours', { adalix_cours: [], adalix_cours_notions: [] }, async C => {
    C.coursPhotos = [pageFaite()];
    await C.renderCours();
    vrai('aucune proposition de reprise', C.coursAttente === null);
  }, { idb: { alix: { matiere: 'maths', notes: '', ts: 1, pages: [{ grande: {}, petite: {} }] } } });
}

/* ---------- un échec doit se voir ----------
   C'est le cœur du problème d'Alix : la lecture échouait, un toast de trois secondes
   passait, et l'écran redevenait exactement comme avant d'appuyer. */
console.log('\n— quand la lecture échoue —');
{
  const dom = await scenario('échec visible', {}, async C => {
    C.coursPhotos = [pageFaite()];
    await C.lancerTranscription();
  }, { ecranAjout: true, reponse: { status: 500, json: async () => { throw new Error('pas du JSON'); } } });
  if (dom) {
    const h = dom.el('cours-erreur').innerHTML;
    vrai("l'échec reste affiché dans la page", h.length > 20, h);
    vrai('on propose de réessayer', /lancerTranscription\(\)/.test(h));
    vrai('et on rassure sur les photos', /gardées/.test(h));
    vrai('le bouton est rendu à son état normal', dom.el('cours-go').textContent === '✨ Mettre au propre');
    vrai('deux tentatives ont été faites avant de déranger', dom.envois.length === 2, String(dom.envois.length));
  }
}
{
  // la connexion lâche une fois, repasse à la seconde : l'enfant ne doit rien voir
  const dom = await scenario('relance silencieuse', {}, async C => {
    C.coursPhotos = [pageFaite()];
    await C.lancerTranscription();
    vrai('aucune erreur affichée', C.coursErr === '');
    vrai('le cours est bien arrivé', !!C.coursDraft && /néolithique/i.test(C.coursDraft.titre));
  }, {
    ecranAjout: true,
    reponse: n => (n === 1
      ? { status: 500, json: async () => { throw new Error('coupure'); } }
      : { status: 200, json: async () => ({ cours: { titre: 'Le néolithique', texte: 'A', matiere: 'histoire' } }) }),
  });
  if (dom) vrai('il a fallu deux envois', dom.envois.length === 2);
}
{
  // un code famille refusé n'est pas un échec de lecture : pas de relance, pas d'erreur
  const dom = await scenario('code refusé : pas de relance', {}, async C => {
    C.coursPhotos = [pageFaite()];
    await C.lancerTranscription();
    vrai('aucune erreur de lecture affichée', C.coursErr === '');
  }, { ecranAjout: true, reponse: { status: 200, json: async () => ({ error: 'code_famille' }) } });
  if (dom) {
    vrai('le code est demandé une seule fois', dom.refusCode.length === 1, String(dom.refusCode.length));
    vrai('et on n\'a pas renvoyé les photos pour rien', dom.envois.length === 1, String(dom.envois.length));
  }
}

/* ---------- un cours long part par paquets ---------- */
console.log('\n— un cours de plusieurs pages —');
{
  const dom = await scenario('six pages, deux paquets', {}, async C => {
    C.coursPhotos = [1, 2, 3, 4, 5, 6].map(() => pageFaite('G', 10));
    await C.lancerTranscription();
    vrai('un seul cours à la fin', !!C.coursDraft);
    vrai('les deux textes sont là, dans l\'ordre', /^Début[\s\S]*Fin$/.test(C.coursDraft.texte), C.coursDraft.texte);
    vrai('le titre vient des premières pages', C.coursDraft.titre === 'Les volcans');
    vrai('le résumé vient du dernier paquet, qui a tout vu', /tout le chapitre/.test(C.coursDraft.resume));
  }, {
    ecranAjout: true,
    reponse: n => ({
      status: 200,
      json: async () => ({ cours: n === 1
        ? { titre: 'Les volcans', matiere: 'svt', texte: 'Début', resume: 'la première moitié', points_cles: ['a'] }
        : { titre: '', matiere: 'svt', texte: 'Fin', resume: 'tout le chapitre', points_cles: ['a', 'b'] } }),
    }),
  });
  if (dom) {
    vrai('deux envois, pas six', dom.envois.length === 2, String(dom.envois.length));
    vrai('le premier paquet fait quatre pages', dom.envois[0].photos.length === 4);
    vrai('le second emporte le reste', dom.envois[1].photos.length === 2);
    vrai('le premier paquet ne parle pas de suite', !dom.envois[0].suite);
    vrai('le second donne ce qui a déjà été lu', dom.envois[1].suite === 'Début', String(dom.envois[1].suite));
    vrai('la matière choisie accompagne chaque paquet', dom.envois.every(e => !!e.matiere));
  }
}
{
  await scenario('fusionneCours', {}, async C => {
    const a = { titre: 'T', matiere: 'svt', niveau: '6e', chapitre: 'C', resume: 'r1', texte: 'A',
      points_cles: ['p1'], vocabulaire: [{ mot: 'magma', def: 'd' }], a_retenir: [{ q: 'Q1', r: 'R' }],
      liste_mots: [{ mot: 'arbre' }], mots_a_revoir: [], ressources: [{ url: 'u1' }], incertitudes: ['i1'] };
    const b = { titre: 'Autre', matiere: 'histoire', niveau: '4e', chapitre: 'D', resume: 'r2', texte: 'B',
      points_cles: ['p1', 'p2'], vocabulaire: [{ mot: 'magma', def: 'd' }, { mot: 'lave', def: 'd' }],
      a_retenir: [{ q: 'Q2', r: 'R' }], liste_mots: [{ mot: 'arbre' }, { mot: 'moment' }],
      mots_a_revoir: [], ressources: [{ url: 'u1' }], incertitudes: ['i2'] };
    const f = C.fusionneCours(a, b);
    vrai('le premier paquet donne le titre et la matière', f.titre === 'T' && f.matiere === 'svt' && f.niveau === '6e');
    vrai('les textes se suivent', f.texte === 'A\n\nB');
    vrai('le dernier résumé gagne', f.resume === 'r2');
    vrai('les points clés les plus complets gagnent', f.points_cles.length === 2);
    vrai('le vocabulaire ne double pas', f.vocabulaire.length === 2, JSON.stringify(f.vocabulaire));
    vrai('les mots de liste ne doublent pas', f.liste_mots.length === 2);
    vrai('les cartes s\'additionnent', f.a_retenir.length === 2);
    vrai('une ressource en double est écartée', f.ressources.length === 1);
    vrai('toutes les incertitudes sont dites', f.incertitudes.length === 2);
    vrai('un premier paquet seul passe tel quel', C.fusionneCours(null, b) === b);
  }, { ecranAjout: true });
}

/* ---------- la liste de mots photographiée ----------
   Elle a photographié quatre listes de vocabulaire : le cours était parfait, et son
   carnet de mots est resté vide. C'est ce que la matière « Orthographe » répare. */
console.log('\n— une liste de mots devient son carnet —');
{
  await scenario('la matière existe', {}, async C => {
    vrai('« Orthographe » est proposée', C.MATIERES.some(m => m.id === 'orthographe'));
    vrai('elle est juste après le français',
      C.MATIERES.findIndex(m => m.id === 'orthographe') === C.MATIERES.findIndex(m => m.id === 'francais') + 1);
  }, {});
}
{
  const dom = await scenario('les mots rejoignent le carnet',
    { 'adalix_cours:inserted': [{ id: 42 }], adalix_cours: FIXTURES_COURS, adalix_cours_notions: [] },
    async (C, d, db) => {
      C.coursPhotos = [1, 2, 3, 4].map(() => pageFaite());
      C.coursDraft = { titre: 'Liste 1', matiere: 'orthographe', niveau: '6e', chapitre: '', resume: 'r',
        texte: '## Liste 1', points_cles: [], vocabulaire: [], ressources: [], a_retenir: [],
        liste_mots: [{ mot: 'coquillage', syllabes: 'co-quil-lage' }, { mot: 'trésor', syllabes: 'tré-sor' }],
        mots_a_revoir: [] };
      await C.enregistrerCours();
      const photos = db.ecrits.filter(e => e.table === 'adalix_cours_photos' && e.op === 'insert');
      vrai('les photos partent par petits lots', photos.length === 2, String(photos.length));
      vrai('toutes les pages sont enregistrées', photos.reduce((n, e) => n + e.p.length, 0) === 4);
      vrai('les rangs se suivent', photos[1].p[0].rang === 3);
    }, { idb: { alix: { matiere: 'orthographe', notes: '', ts: 1, pages: [{ grande: {}, petite: {} }] } } });
  if (dom) {
    const liste = dom.motsEcrits.find(e => e.source === 'liste');
    vrai('la liste est envoyée au carnet', !!liste);
    if (liste) {
      vrai('chaque mot y est', liste.mots.length === 2);
      vrai("l'orthographe juste est le mot à apprendre", liste.mots[0].correct === 'coquillage');
      vrai('aucune faute inventée', liste.mots.every(m => m.ecrit === ''));
      vrai('le découpage en syllabes est transmis', liste.mots[0].syllabes === 'co-quil-lage');
    }
    vrai('les pages en attente sont oubliées', !dom.magasin.alix);
  }
}
{
  // la liste de verbes irréguliers anglais d'Adam n'a rien à faire dans un carnet
  // d'orthographe française
  const dom = await scenario('pas de carnet pour les autres matières',
    { 'adalix_cours:inserted': [{ id: 43 }], adalix_cours: FIXTURES_COURS, adalix_cours_notions: [] },
    async C => {
      C.coursPhotos = [];
      C.coursDraft = { titre: 'Irregular verbs', matiere: 'anglais', texte: 'be was been', points_cles: [],
        vocabulaire: [], ressources: [], a_retenir: [], mots_a_revoir: [],
        liste_mots: [{ mot: 'become', syllabes: 'be-come' }] };
      await C.enregistrerCours();
    }, {});
  if (dom) vrai('aucun mot anglais dans le carnet', !dom.motsEcrits.some(e => e.source === 'liste'),
    JSON.stringify(dom.motsEcrits));
}

/* ---------- la voix du tuteur ---------- */
console.log('\n— le tuteur a une voix —');
{
  const dom = await scenario('interro avec voix', { adalix_cours: FIXTURES_COURS, adalix_cours_notions: FIXTURES_NOTIONS }, async C => {
    C.coursCur = FIXTURES_COURS[0]; C.coursNotions = FIXTURES_NOTIONS;
    C.drawInterroScreen();
  }, { voix: true });
  if (dom) {
    const h = html(dom);
    sain('interro voix', h);
    vrai('le bouton de voix est là', /id="vx-btn"/.test(h));
  }
}
{
  const dom = await scenario('la question est dite', { adalix_cours: FIXTURES_COURS, adalix_cours_notions: FIXTURES_NOTIONS }, async C => {
    C.coursCur = FIXTURES_COURS[0]; C.coursNotions = FIXTURES_NOTIONS;
    C.drawInterroScreen();
    await C.envoyerInterro('');
  }, { voix: true, reponse: { status: 200, json: async () => ({ reply: 'Quelle est la capitale ?' }) } });
  if (dom) {
    vrai('elle est dite à voix haute', dom.dits.some(d => d.auto && /capitale/.test(d.t)), JSON.stringify(dom.dits));
    vrai('et un 🔊 permet de la réentendre', /vxDireQuestion\(/.test(dom.el('chat-box').innerHTML));
  }
}
{
  const dom = await scenario('terminer coupe la voix', { adalix_cours: FIXTURES_COURS, adalix_cours_notions: FIXTURES_NOTIONS, adalix_cours_revisions: [] }, async C => {
    C.coursCur = FIXTURES_COURS[0]; C.coursNotions = FIXTURES_NOTIONS;
    C.drawInterroScreen();
    await C.finirInterro();
  }, { voix: true });
  if (dom) vrai("terminer l'interro fait taire le tuteur", dom.vxArrets.length === 1, String(dom.vxArrets.length));
}
{
  const dom = await scenario('sans voix, aucun bouton', { adalix_cours: FIXTURES_COURS, adalix_cours_notions: FIXTURES_NOTIONS }, async C => {
    C.coursCur = FIXTURES_COURS[0]; C.coursNotions = FIXTURES_NOTIONS;
    C.drawInterroScreen();
    await C.envoyerInterro('');
  }, { reponse: { status: 200, json: async () => ({ reply: 'Une question ?' }) } });
  if (dom) {
    vrai('aucun bouton de voix', !/vx-btn/.test(html(dom)));
    vrai('aucun 🔊 sur la question', !/vxDireQuestion/.test(dom.el('chat-box').innerHTML));
    /* cours.js propose toujours la réponse à la voix ; c'est lecture.js qui décide de
       parler ou non (testé dans lecture.test.mjs). Ici, l'essentiel : sans voix sur
       l'appareil, l'interro marche exactement pareil. */
    vrai("la question s'affiche quand même", /Une question/.test(dom.el('chat-box').innerHTML));
  }
}

/* ---------- ce qui est gardé ne s'efface que sur sa demande ----------
   Un stockage qui se vide tout seul serait pire que pas de stockage : il promettrait
   quelque chose qu'il ne tient pas. */
console.log('\n— des pages gardées ne disparaissent pas toutes seules —');
{
  const attente = { alix: { matiere: 'histoire', notes: 'une note', ts: Date.now(), pages: [{ grande: { size: 9 }, petite: { size: 4 } }] } };
  const dom = await scenario('ouvrir un nouveau cours ne jette rien', { adalix_cours: [], adalix_cours_notions: [] }, async C => {
    await C.renderCours();
    C.openAjoutCours();                       // « 📸 Ajouter un cours » : il repart de zéro…
    vrai("l'écran d'ajout est bien vide", C.coursPhotos.length === 0);
    await C.photosGarde();                    // …et il tape une note avant toute photo
    vrai('mais ses pages d\'avant sont toujours là', !!attente.alix, JSON.stringify(Object.keys(attente)));
  }, { idb: attente, tactile: true });
  if (dom) vrai('rien n\'a été effacé', dom.magasin.alix.pages.length === 1);
}
{
  const attente = { alix: { matiere: 'histoire', notes: '', ts: Date.now(), pages: [{ grande: { size: 9 }, petite: { size: 4 } }] } };
  await scenario('retirer sa dernière page, c\'est voulu', { adalix_cours: [], adalix_cours_notions: [] }, async (C, d) => {
    await C.renderCours();
    C.reprendrePages();
    await C.coursRetirePhoto(0);
    vrai('plus aucune page en mémoire', C.coursPhotos.length === 0);
    vrai('et plus rien de gardé', !d.magasin.alix);
  }, { idb: attente, tactile: true });
}
{
  // la matière reprise doit se voir sur l'écran, pas seulement en mémoire
  const attente = { alix: { matiere: 'svt', notes: '', ts: Date.now(), pages: [{ grande: { size: 9 }, petite: { size: 4 } }] } };
  const dom = await scenario('la matière reprise est surlignée', { adalix_cours: [], adalix_cours_notions: [] }, async C => {
    await C.renderCours();
    C.reprendrePages();
  }, { idb: attente, tactile: true });
  if (dom) {
    const h = html(dom);
    vrai('la SVT est la matière surlignée', /imgchip sel" data-mat="svt"/.test(h), (h.match(/imgchip sel[^>]*/) || [])[0]);
    vrai('une seule matière est surlignée', (h.match(/imgchip sel/g) || []).length === 1);
  }
}
{
  // il a choisi « Orthographe » : le modèle n'a pas à le contredire
  const dom = await scenario('le choix de l\'enfant fait foi', {}, async C => {
    C.coursPhotos = [pageFaite()];
    C.matChoisie = 'orthographe';
    await C.lancerTranscription();
    vrai('le cours reste en orthographe', C.coursDraft.matiere === 'orthographe', C.coursDraft.matiere);
  }, {
    ecranAjout: true,
    reponse: { status: 200, json: async () => ({ cours: { titre: 'Liste 1', matiere: 'francais', texte: 'des mots' } }) },
  });
  if (dom) vrai('la matière choisie est bien partie au serveur', dom.envois[0].matiere === 'orthographe');
}

console.log('\n' + (ko ? `❌ ${ko} échec(s), ${ok} test(s) passés` : `✅ ${ok} tests passés`));
process.exit(ko ? 1 : 0);
