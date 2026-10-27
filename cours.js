/* Adalix Knowledge — cours.js
   Onglet « Mes cours » : l'enfant photographie son cours, l'app le met au propre,
   puis il révise avec un tuteur (interro orale, fiche d'exercices, révisions espacées)
   et peut aller plus loin sur ce chapitre précis.
   Dépend de app.js pour : child, db, $, esc, toast, modal, closeModal, familyCode,
   badFamilyCode, todayStr. */

const MATIERES = [
  { id: 'histoire', emoji: '🏛️', label: 'Histoire' },
  { id: 'geo',      emoji: '🗺️', label: 'Géographie' },
  { id: 'emc',      emoji: '⚖️', label: 'EMC' },
  { id: 'francais', emoji: '📖', label: 'Français' },
  { id: 'maths',    emoji: '➗', label: 'Maths' },
  { id: 'svt',      emoji: '🌱', label: 'SVT' },
  { id: 'physique', emoji: '🧪', label: 'Physique-chimie' },
  { id: 'techno',   emoji: '⚙️', label: 'Techno' },
  { id: 'anglais',  emoji: '🇬🇧', label: 'Anglais' },
  { id: 'espagnol', emoji: '🇪🇸', label: 'Espagnol' },
  { id: 'allemand', emoji: '🇩🇪', label: 'Allemand' },
  { id: 'latin',    emoji: '🏺', label: 'Latin' },
  { id: 'arts',     emoji: '🎨', label: 'Arts plastiques' },
  { id: 'musique',  emoji: '🎵', label: 'Musique' },
  { id: 'autre',    emoji: '📚', label: 'Autre' },
];
const matOf = id => MATIERES.find(m => m.id === id) || MATIERES[MATIERES.length - 1];

/* Révisions espacées (boîtes de Leitner) : à chaque réussite la notion revient plus
   tard, à chaque échec elle repart au début. Cinq boîtes suffisent pour tenir un
   trimestre sans que l'enfant ait l'impression de ressasser. */
const BOX_JOURS = { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 };
const MAX_PHOTOS = 5;

let coursList = null;      // cours du profil courant, du plus récent au plus ancien
let coursCur = null;       // le cours ouvert
let coursNotions = [];     // notions du cours ouvert
let coursFiltre = 'all';
let coursPhotos = [];      // photos en attente : {media_type, data, archive, dataUrl}
let coursDraft = null;     // cours mis au propre, pas encore enregistré
let coursBusy = false;
let coursDue = [];         // notions à revoir aujourd'hui, tous cours confondus
let tutorMsgs = [];
let tutorFini = false;
let tutorBilan = {};       // notion → réussie ou non, pour CETTE session d'interro
let exoState = null;
let revState = null;

const jourPlus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dateFr = s => s ? new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';

/* ---------- appel serveur ---------- */
/* `relance` est rejouée automatiquement dès que le code famille est accepté : sinon
   l'enfant saisit le code, rien ne se passe, et il doit deviner qu'il faut refaire son
   geste — c'est exactement ce qui est arrivé au premier vrai essai. */
async function callCours(payload, relance) {
  const r = await fetch('/api/cours', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ child, code: familyCode }, payload)),
  });
  /* Toutes les réponses ne sont pas du JSON : au-delà d'environ 4,5 Mo de corps, Vercel
     renvoie lui-même un 413 en texte brut, et r.json() lèverait une erreur incompréhensible. */
  const j = await r.json().catch(() => null);
  if (!j) {
    toast(r.status === 413
      ? 'Tes photos sont trop lourdes — reprends-en moins à la fois.'
      : "Le serveur n'a pas répondu correctement — réessaie.");
    return null;
  }
  if (j.error === 'code_famille') { badFamilyCode(relance); return null; }
  return j;
}

/* Vercel refuse un corps de requête au-delà d'environ 4,5 Mo. Cinq pages denses en
   1500px peuvent dépasser. Dans ce cas on envoie les versions d'archive (1000px) :
   le cours reste parfaitement lisible, et mieux vaut un peu moins fin qu'un échec. */
const SEUIL_ENVOI = 3.2 * 1024 * 1024;
function photosAEnvoyer() {
  const poids = champ => coursPhotos.reduce((n, p) => n + String(p[champ] || '').length, 0);
  const champ = poids('data') <= SEUIL_ENVOI ? 'data' : 'archive';
  return coursPhotos.map(p => ({ media_type: p.media_type, data: p[champ] }));
}

/* ---------- mini-Markdown : le cours au propre, joliment ----------
   Volontairement limité au sous-ensemble que l'IA a pour consigne de produire
   (titres, puces, gras, citations, séparateurs) : pas de dépendance, pas de surprise. */
function coursMd(src) {
  const inline = s => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    // un astérisque isolé (3 * 4 * 5) n'est pas de l'italique : il faut du texte collé aux deux étoiles
    .replace(/(^|[\s(«"';-])\*([^\s*][^*\n]*?[^\s*]|[^\s*])\*/g, '$1<i>$2</i>');
  const out = [];
  let liste = null;
  const ferme = () => { if (liste) { out.push('</' + liste + '>'); liste = null; } };
  String(src || '').split('\n').forEach(l => {
    const t = l.trim();
    if (!t) { ferme(); return; }
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(t)) { ferme(); out.push('<hr>'); return; }
    let m;
    if ((m = t.match(/^#{3,}\s+(.*)$/))) { ferme(); out.push('<h5>' + inline(m[1]) + '</h5>'); return; }
    if ((m = t.match(/^#{1,2}\s+(.*)$/)))  { ferme(); out.push('<h4>' + inline(m[1]) + '</h4>'); return; }
    if ((m = t.match(/^>\s?(.*)$/)))       { ferme(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); return; }
    if ((m = t.match(/^[-*•]\s+(.*)$/)))   { if (liste !== 'ul') { ferme(); out.push('<ul>'); liste = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
    if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { if (liste !== 'ol') { ferme(); out.push('<ol>'); liste = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
    ferme(); out.push('<p>' + inline(t) + '</p>');
  });
  ferme();
  return out.join('');
}

/* ---------- chargement ---------- */
async function loadCours() {
  const { data } = await db.from('adalix_cours')
    .select('id,child,matiere,titre,niveau,chapitre,resume,texte,points_cles,vocabulaire,ressources,created_at,updated_at')
    .eq('child', child).order('created_at', { ascending: false });
  coursList = data || [];
  noteNiveau(coursList);
}
/* Le niveau de classe est écrit sur ses cahiers, et le modèle le relève à la
   transcription. On le partage avec app.js (`niveauVu`), qui en a besoin pour cadrer
   une interro sur une matière encore sans cours — sinon il faudrait le redemander. */
function noteNiveau(cs) {
  const niv = (cs || []).map(c => c.niveau).find(n => /^[3456]e$/.test(String(n || '')));
  if (niv && typeof niveauVu !== 'undefined') niveauVu = niv;
}
async function loadDue() {
  const { data } = await db.from('adalix_cours_notions')
    .select('*').eq('child', child).lte('due', todayStr()).order('due', { ascending: true });
  coursDue = data || [];
}

/* ---------- écran principal ---------- */
async function renderCours() {
  if (child === 'parent') { renderDashboard(); return; }
  $('#main').innerHTML = '<div class="card">Chargement de tes cours…</div>';
  await Promise.all([loadCours(), loadDue()]);
  drawCoursList();
}

function drawCoursList() {
  const presentes = MATIERES.filter(m => coursList.some(c => c.matiere === m.id));
  const vus = coursFiltre === 'all' ? coursList : coursList.filter(c => c.matiere === coursFiltre);
  const nbDue = coursDue.length;

  $('#main').innerHTML = `<div class="narrow">
    <div class="card">
      <h3>📸 Mes cours</h3>
      <div style="font-size:13.5px;line-height:1.55;">Prends ton cours en photo : il revient au propre, bien présenté, et tu pourras le réviser avec un tuteur qui t'interroge et te fabrique des exercices.</div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" onclick="openAjoutCours()">📸 Ajouter un cours</button>
        ${nbDue ? `<button class="btn ghost" onclick="startRevision()">🔁 ${nbDue} notion${nbDue > 1 ? 's' : ''} à revoir</button>` : ''}
      </div>
    </div>

    ${nbDue ? `<div class="card" style="border-left:5px solid #e8963f;">
      <h3>🔁 C'est le moment de revoir</h3>
      <div style="font-size:13.5px;">Tu as <b>${nbDue} notion${nbDue > 1 ? 's' : ''}</b> à revoir aujourd'hui — ce sont celles que tu avais apprises il y a quelques jours. 3 minutes suffisent, et elles tiendront bien plus longtemps dans ta tête.</div>
      <div style="margin-top:10px;"><button class="btn" onclick="startRevision()">Démarrer la révision</button></div>
    </div>` : ''}

    ${presentes.length > 1 ? `<div class="gal-filter">
      <button class="${coursFiltre === 'all' ? 'active' : ''}" onclick="setCoursFiltre('all')">Tout (${coursList.length})</button>
      ${presentes.map(m => `<button class="${coursFiltre === m.id ? 'active' : ''}" onclick="setCoursFiltre('${m.id}')">${m.emoji} ${m.label}</button>`).join('')}
    </div>` : ''}

    ${vus.length ? `<div class="quiz-list">${vus.map(c => {
      const m = matOf(c.matiere);
      const nb = (c.points_cles || []).length;
      return `<button onclick="openCours(${c.id})">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;">${m.emoji}</span>
          <span style="flex:1;min-width:0;">
            <span style="display:block;">${esc(c.titre)}</span>
            <span style="display:block;font-size:12px;opacity:.6;font-weight:400;">${m.label}${c.niveau && c.niveau !== '?' ? ' · ' + esc(c.niveau) : ''} · ${dateFr(c.created_at)}${nb ? ' · ' + nb + ' points clés' : ''}</span>
          </span>
        </div>
      </button>`;
    }).join('')}</div>`
      : `<div class="card" style="text-align:center;">
          <div style="font-size:40px;">📷</div>
          <div style="font-size:14px;margin-top:6px;">Aucun cours pour l'instant.<br>Photographie la double-page de ton cahier et regarde ce qui se passe !</div>
        </div>`}
  </div>`;
}
function setCoursFiltre(f) { coursFiltre = f; drawCoursList(); }

/* ---------- ajout d'un cours : photos → mise au propre ---------- */
function openAjoutCours() {
  coursPhotos = []; coursDraft = null;
  // téléphone ou tablette : on propose l'appareil photo. Sur ordinateur il n'y en a pas,
  // et `capture` y est ignoré — un bouton « Prendre une photo » qui ouvre l'explorateur
  // de fichiers est un mensonge : on affiche le glisser-déposer et le collage à la place.
  const tactile = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn" onclick="renderCours()">← Mes cours</button>
    <div class="card">
      <h3>📸 Un nouveau cours</h3>
      <div style="font-size:11.5px;opacity:.6;text-transform:uppercase;letter-spacing:1px;margin-top:8px;">Quelle matière ?</div>
      <div class="imgchips" id="cours-mat">${MATIERES.map((m, i) => `<button class="imgchip${i === 0 ? ' sel' : ''}" data-mat="${m.id}" onclick="pickMat('${m.id}')">${m.emoji} ${m.label}</button>`).join('')}</div>

      <div style="font-size:11.5px;opacity:.6;text-transform:uppercase;letter-spacing:1px;margin-top:12px;">Les photos (${MAX_PHOTOS} maximum)</div>
      <div style="font-size:12.5px;opacity:.75;margin:4px 0 8px;">${tactile
        ? "Cadre bien la page, à plat, en pleine lumière, sans ton ombre dessus. Une page par photo : si le cours en fait trois, appuie trois fois."
        : "Glisse tes images ici, ou colle une capture d'écran avec Ctrl + V. Pour photographier un cahier, ouvre plutôt l'app sur le téléphone : elle y déclenche l'appareil photo toute seule."}</div>
      <div id="cours-drop" style="display:flex;gap:8px;flex-wrap:wrap;border-radius:var(--radius-card);padding:2px;transition:outline .12s;"
        ondragover="event.preventDefault();this.style.outline='2px dashed var(--accent)';this.style.outlineOffset='4px';"
        ondragleave="this.style.outline='';"
        ondrop="event.preventDefault();this.style.outline='';coursFiles(event.dataTransfer.files);">
        ${tactile ? `<button class="btn" onclick="ouvrirCamera()">📸 Prendre une photo</button>
        <input type="file" id="cours-cam" accept="image/*" capture="environment" style="display:none;" onchange="coursFiles(this.files);this.value='';">` : ''}
        <button class="btn${tactile ? ' ghost' : ''}" onclick="document.getElementById('cours-gal').click()">🖼️ Choisir une image</button>
        <input type="file" id="cours-gal" accept="image/*" multiple style="display:none;" onchange="coursFiles(this.files);this.value='';">
      </div>
      <div id="cours-photos"></div>

      <div style="font-size:11.5px;opacity:.6;text-transform:uppercase;letter-spacing:1px;margin-top:14px;">Quelque chose à préciser ? (facultatif)</div>
      <textarea id="cours-notes" rows="2" placeholder="Ex : la prof a dit que le schéma de la page 2 tombera au contrôle"></textarea>

      <div class="actions" style="margin-top:12px;">
        <button class="btn" id="cours-go" onclick="lancerTranscription()">✨ Mettre au propre</button>
      </div>
    </div>
  </div>`;
  drawCoursPhotos();
}
let matChoisie = MATIERES[0].id;
function pickMat(id) {
  matChoisie = id;
  document.querySelectorAll('#cours-mat .imgchip').forEach(b => b.classList.toggle('sel', b.dataset.mat === id));
}

function coursFiles(files) {
  const restants = MAX_PHOTOS - coursPhotos.length;
  if (restants <= 0) { toast(`${MAX_PHOTOS} photos maximum`); return; }
  Array.from(files || []).filter(f => f && f.type && f.type.startsWith('image/')).slice(0, restants).forEach(coursAjouteFichier);
}
/* Coller une capture d'écran (Ctrl + V) — le geste naturel sur ordinateur, quand le
   cours est un document de l'ENT ou une page scannée plutôt qu'un cahier. */
document.addEventListener('paste', ev => {
  if (!document.getElementById('cours-photos')) return;   // on n'est pas sur l'écran d'ajout
  const items = (ev.clipboardData || {}).items || [];
  for (const it of items) {
    if (it.type && it.type.startsWith('image/')) { ev.preventDefault(); coursFiles([it.getAsFile()]); return; }
  }
});
/* Deux tailles : une grande pour que l'IA puisse lire l'écriture, une petite
   gardée en base pour que l'enfant puisse revenir vérifier sa photo plus tard. */
function coursAjouteFichier(file) {
  if (!file || !file.type.startsWith('image/')) { toast("Ce fichier n'est pas une image"); return; }
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => { URL.revokeObjectURL(url); coursPousseImage(img, img.width, img.height); };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Image illisible — reprends-la'); };
  img.src = url;
}

/* Deux tailles de chaque page : la grande part au serveur pour être lue, la petite est
   archivée et sert d'aperçu. Partagé par le fichier choisi et par l'appareil photo
   intégré — la source est une <img> ou un <canvas>, drawImage accepte les deux. */
function coursPousseImage(source, w, h) {
  if (!w || !h) { toast('Image illisible — reprends-la'); return; }
  const rendu = (max, q) => {
    const s = Math.min(1, max / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * s); cv.height = Math.round(h * s);
    cv.getContext('2d').drawImage(source, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', q);
  };
  const grande = rendu(1500, 0.82);
  const petite = rendu(1000, 0.68);
  coursPhotos.push({
    media_type: 'image/jpeg',
    data: grande.split(',')[1],
    archive: petite.split(',')[1],
    dataUrl: petite,
  });
  drawCoursPhotos();
}

/* ---------- appareil photo intégré ----------
   Avant, « Prendre une photo » était un <input capture="environment"> : il passait la
   main à l'application Appareil photo du système. Sur un téléphone un peu juste en
   mémoire, Android en profite pour détruire l'onglet Chrome ; au retour la page se
   recharge de zéro, on repart de l'écran des profils et la photo est perdue avec le
   reste. Constaté à CHAQUE essai sur l'Android de la maison : le bouton était
   inutilisable, et c'est le geste central de tout le module.
   Ici l'appareil photo vit DANS la page. On ne quitte jamais l'app, donc rien ne peut
   être repris par le système, et on enchaîne les pages d'un cours sans aller-retour. */
let camStream = null;

function cameraDispo() {
  return !!(typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
/* Repli : l'ancien chemin. Il marche quand le téléphone a de la mémoire, et c'est
   toujours mieux que pas de photo du tout. */
function camRepli() {
  const el = document.getElementById('cours-cam');
  if (el) el.click(); else toast('Aucun appareil photo disponible sur cet appareil');
}
async function ouvrirCamera() {
  if (coursPhotos.length >= MAX_PHOTOS) { toast(`${MAX_PHOTOS} photos maximum`); return; }
  if (!cameraDispo()) { camRepli(); return; }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
  } catch (e) {
    console.warn('camera', e);
    camStream = null;
    toast("Appareil photo refusé — on passe par l'autre chemin");
    camRepli();
    return;
  }
  drawCamera();
  const v = $('#cam-video');
  if (v) {
    v.srcObject = camStream;
    const p = v.play && v.play();
    if (p && p.catch) p.catch(() => {});
  }
}
function camAideTexte() {
  const n = coursPhotos.length;
  return n
    ? `${n} page${n > 1 ? 's' : ''} prise${n > 1 ? 's' : ''} — tourne la page et recommence, ou touche « Terminé ».`
    : 'Cadre la page à plat, bien éclairée, sans ton ombre dessus.';
}
function drawCamera() {
  $('#modal-root').innerHTML = `<div class="cam-plein">
    <video id="cam-video" playsinline autoplay muted></video>
    <div class="cam-aide" id="cam-aide">${camAideTexte()}</div>
    <div class="cam-barre">
      <button class="cam-fermer" onclick="fermerCamera()">Terminé</button>
      <button class="cam-declic" id="cam-declic" onclick="camDeclic()" title="Prendre la photo"></button>
      <div class="cam-compteur" id="cam-compteur">${coursPhotos.length} / ${MAX_PHOTOS}</div>
    </div>
  </div>`;
}
/* Après une prise on ne redessine QUE le compteur : refaire tout l'écran détruirait la
   balise vidéo et redémarrerait la caméra, avec un clignotement à chaque page. */
function majCamera() {
  const c = $('#cam-compteur'); if (c) c.textContent = `${coursPhotos.length} / ${MAX_PHOTOS}`;
  const a = $('#cam-aide'); if (a) a.textContent = camAideTexte();
}
function camDeclic() {
  const v = $('#cam-video');
  if (!v || !v.videoWidth) { toast('Un instant, la caméra démarre…'); return; }
  const cv = document.createElement('canvas');
  cv.width = v.videoWidth; cv.height = v.videoHeight;
  cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
  coursPousseImage(cv, cv.width, cv.height);
  toast(`Page ${coursPhotos.length} 📸`);
  if (coursPhotos.length >= MAX_PHOTOS) { fermerCamera(); return; }
  majCamera();
}
function fermerCamera() {
  if (camStream) {
    try { camStream.getTracks().forEach(t => t.stop()); } catch (e) { /* flux déjà coupé */ }
    camStream = null;
  }
  closeModal();
  drawCoursPhotos();   // les vignettes des pages prises réapparaissent sous le formulaire
}
function drawCoursPhotos() {
  const el = $('#cours-photos'); if (!el) return;
  el.innerHTML = coursPhotos.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
    ${coursPhotos.map((p, i) => `<div style="position:relative;">
      <img src="${p.dataUrl}" style="height:92px;border-radius:10px;display:block;box-shadow:0 2px 8px rgba(0,0,0,.18);">
      <button onclick="coursRetirePhoto(${i})" title="Retirer" style="position:absolute;top:-6px;right:-6px;width:24px;height:24px;border-radius:50%;border:none;background:#c9636a;color:#fff;cursor:pointer;font-size:13px;line-height:1;">✕</button>
      <div style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.6);color:#fff;border-radius:6px;font-size:11px;padding:1px 6px;">${i + 1}</div>
    </div>`).join('')}
  </div>` : '';
}
function coursRetirePhoto(i) { coursPhotos.splice(i, 1); drawCoursPhotos(); }

async function lancerTranscription() {
  if (coursBusy) return;
  if (!coursPhotos.length) { toast('Ajoute au moins une photo 📷'); return; }
  coursBusy = true;
  const btn = $('#cours-go');
  if (btn) { btn.disabled = true; btn.textContent = '✨ Je lis ton cours…'; }
  const notes = ($('#cours-notes') || {}).value || '';
  try {
    const j = await callCours({
      mode: 'transcrire', matiere: matChoisie, notes, photos: photosAEnvoyer(),
    }, lancerTranscription);
    if (!j) return;
    if (j.error || !j.cours) { toast(j.error || 'Échec de la lecture'); return; }
    coursDraft = j.cours;
    drawDraft();
  } catch (e) {
    toast('Erreur de connexion — réessaie');
  } finally {
    coursBusy = false;
    const b = $('#cours-go'); if (b) { b.disabled = false; b.textContent = '✨ Mettre au propre'; }
  }
}

function drawDraft() {
  const d = coursDraft;
  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn" onclick="openAjoutCours()">← Reprendre les photos</button>
    <div class="card" style="border-left:5px solid #3e9c7a;">
      <h3>✅ Voilà ton cours au propre</h3>
      <div style="font-size:13.5px;">Relis-le avant d'enregistrer : si un mot a été mal lu, corrige-le maintenant — tout le reste (les exercices, les interros) sera construit sur ce texte.</div>
      ${(d.incertitudes || []).length ? `<div class="ecrit-box" style="margin-top:10px;">
        <b>⚠️ Ce que je n'ai pas bien lu :</b>
        <ul style="margin:6px 0 0;padding-left:20px;">${d.incertitudes.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>` : ''}
      <div class="actions" style="margin-top:12px;flex-wrap:wrap;">
        <button class="btn" id="save-cours" onclick="enregistrerCours()">💾 Enregistrer ce cours</button>
        <button class="btn ghost" onclick="editDraft()">✏️ Corriger le texte</button>
      </div>
    </div>
    ${coursCardsHtml(d, true)}
  </div>`;
}

/* Le cours lui-même : même rendu pour le brouillon et pour un cours enregistré. */
function coursCardsHtml(c, brouillon) {
  const m = matOf(c.matiere);
  return `<div class="card cours-page">
      <div class="theme-tag">${m.emoji} ${m.label}${c.niveau && c.niveau !== '?' ? ' · ' + esc(c.niveau) : ''}</div>
      <h2 style="color:var(--accent2);margin:4px 0 2px;font-size:21px;font-family:var(--font-display);">${esc(c.titre)}</h2>
      ${c.chapitre ? `<div style="font-size:13px;opacity:.65;">${esc(c.chapitre)}</div>` : ''}
      ${c.resume ? `<div class="ecrit-box" style="margin-top:10px;">${esc(c.resume)}</div>` : ''}
      <div class="cours-md">${coursMd(c.texte)}</div>
    </div>
    ${(c.points_cles || []).length ? `<div class="card"><h3>⭐ À retenir avant tout</h3>
      <ul class="cours-ul">${c.points_cles.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
    ${(c.vocabulaire || []).length ? `<div class="card"><h3>📘 Les mots du cours</h3>
      ${c.vocabulaire.map(v => `<div style="font-size:14px;margin-bottom:7px;line-height:1.5;"><b>${esc(v.mot)}</b> — ${esc(v.def)}</div>`).join('')}</div>` : ''}
    ${(c.ressources || []).length ? `<div class="card"><h3>🔭 Pour aller plus loin</h3>
      <div style="font-size:12.5px;opacity:.7;margin-bottom:8px;">${brouillon ? 'Des pistes choisies pour ce chapitre' : 'Sur ce chapitre précis'} — ça s'ouvre dans un nouvel onglet.</div>
      <div class="links">${c.ressources.map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener">
        ${r.emoji} <b>${esc(r.titre)}</b> <span style="opacity:.6;font-weight:400;">· ${r.type === 'video' ? 'vidéo' : 'article'} · ${esc(r.site)}</span>
        ${r.pourquoi ? `<div style="font-size:12.5px;font-weight:400;opacity:.75;margin-top:2px;">${esc(r.pourquoi)}</div>` : ''}
      </a>`).join('')}</div></div>` : ''}`;
}

function editDraft() {
  modal(`<h3>✏️ Corriger le texte</h3>
    <p style="font-size:13px;color:#666;">Tu peux tout retoucher. Les titres commencent par <code>##</code>, les puces par <code>-</code>, et ce qui est entre <code>**étoiles**</code> ressort en gras.</p>
    <textarea id="draft-texte" rows="16" style="font-family:ui-monospace,monospace;font-size:13px;">${esc(coursDraft.texte)}</textarea>
    <div class="actions"><button class="btn" onclick="applyDraftEdit()">Appliquer</button><button class="btn ghost" onclick="closeModal()">Annuler</button></div>`);
}
function applyDraftEdit() {
  const ta = $('#draft-texte'); if (!ta) return;
  coursDraft.texte = ta.value;
  closeModal(); drawDraft(); toast('Texte corrigé ✏️');
}

async function enregistrerCours() {
  if (coursBusy) return;
  coursBusy = true;
  const btn = $('#save-cours');
  if (btn) { btn.disabled = true; btn.textContent = '💾 Enregistrement…'; }
  try {
    const d = coursDraft;
    const { data, error } = await db.from('adalix_cours').insert({
      child, matiere: d.matiere, titre: d.titre, niveau: d.niveau, chapitre: d.chapitre,
      resume: d.resume, texte: d.texte,
      points_cles: d.points_cles || [], vocabulaire: d.vocabulaire || [], ressources: d.ressources || [],
    }).select('id').single();
    if (error || !data) { console.error(error); toast("L'enregistrement a échoué — réessaie"); return; }
    const id = data.id;

    // les cartes à retenir deviennent les notions des révisions espacées
    const cartes = (d.a_retenir || []).filter(c => c.q && c.r);
    if (cartes.length) {
      await db.from('adalix_cours_notions').insert(cartes.map(c => ({
        cours_id: id, child, notion: c.notion || c.q.slice(0, 50), question: c.q, reponse: c.r,
        box: 1, due: todayStr(),
      })));
    }
    // les mots mal orthographiés dans le cahier rejoignent le carnet (lecture.js), en
    // « proposé » : une écriture mal déchiffrée ne doit jamais devenir une faute à réviser
    const motsVus = (d.mots_a_revoir || []).length;
    if (motsVus) await motsAjoute(d.mots_a_revoir, 'cours', id, 'propose');

    // les photos d'origine, dans leur propre table pour ne pas alourdir la liste des cours
    if (coursPhotos.length) {
      const { error: ePhoto } = await db.from('adalix_cours_photos').insert(coursPhotos.map((p, i) => ({
        cours_id: id, child, rang: i, media_type: 'image/jpeg', data: p.archive,
      })));
      if (ePhoto) console.error('photos non enregistrées', ePhoto);
    }
    coursPhotos = []; coursDraft = null;
    toast(motsVus ? `Cours enregistré 💾 — ${motsVus} mot${motsVus > 1 ? 's' : ''} à regarder dans « Mes mots »` : 'Cours enregistré 💾');
    await renderCours();
    openCours(id);
  } finally {
    coursBusy = false;
  }
}

/* ---------- un cours ---------- */
async function openCours(id) {
  $('#main').innerHTML = '<div class="card">Chargement…</div>';
  const [{ data: c }, { data: nots }] = await Promise.all([
    db.from('adalix_cours').select('*').eq('id', id).maybeSingle(),
    db.from('adalix_cours_notions').select('*').eq('cours_id', id).order('id', { ascending: true }),
  ]);
  if (!c) { toast('Cours introuvable'); renderCours(); return; }
  coursCur = c; coursNotions = nots || [];
  drawCours();
}

function drawCours() {
  const c = coursCur;
  const nbDue = coursNotions.filter(n => n.due <= todayStr()).length;
  const acquises = coursNotions.filter(n => n.box >= 4).length;
  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn no-print" onclick="renderCours()">← Mes cours</button>
    <div class="card no-print">
      <h3>🎓 Réviser ce cours</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button class="btn" onclick="openLecture(coursCur.texte, coursCur.titre)">👓 Lire ce cours</button>
        <button class="btn" onclick="startInterro()">🎤 Interroge-moi</button>
        <button class="btn" onclick="openExosMenu()">✍️ Des exercices</button>
        ${nbDue ? `<button class="btn ghost" onclick="startRevision(${c.id})">🔁 ${nbDue} notion${nbDue > 1 ? 's' : ''} à revoir</button>` : ''}
      </div>
      ${coursNotions.length ? `<div style="font-size:12.5px;opacity:.7;margin-top:10px;">${coursNotions.length} notions suivies${acquises ? ` · <b>${acquises}</b> bien installée${acquises > 1 ? 's' : ''}` : ''}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button class="btn ghost" onclick="editCoursTexte()">✏️ Corriger le texte</button>
        <button class="btn ghost" onclick="window.print()">🖨️ Imprimer</button>
        <button class="btn ghost" onclick="voirPhotos()">🖼️ Mes photos</button>
        <button class="btn ghost" onclick="supprimerCours()">🗑️ Supprimer</button>
      </div>
    </div>
    ${coursCardsHtml(c, false)}
  </div>`;
}

function editCoursTexte() {
  modal(`<h3>✏️ Corriger le texte</h3>
    <p style="font-size:13px;color:#666;">Les titres commencent par <code>##</code>, les puces par <code>-</code>, le gras s'écrit <code>**comme ça**</code>.</p>
    <textarea id="cours-texte-edit" rows="16" style="font-family:ui-monospace,monospace;font-size:13px;">${esc(coursCur.texte)}</textarea>
    <div class="actions"><button class="btn" onclick="saveCoursTexte()">Enregistrer</button><button class="btn ghost" onclick="closeModal()">Annuler</button></div>`);
}
async function saveCoursTexte() {
  const ta = $('#cours-texte-edit'); if (!ta) return;
  const texte = ta.value;
  const { error } = await db.from('adalix_cours').update({ texte, updated_at: new Date().toISOString() }).eq('id', coursCur.id);
  if (error) { console.error(error); toast('Enregistrement impossible'); return; }
  coursCur.texte = texte;
  const l = (coursList || []).find(x => x.id === coursCur.id); if (l) l.texte = texte;
  closeModal(); drawCours(); toast('Texte corrigé ✏️');
}

async function voirPhotos() {
  modal('<h3>🖼️ Mes photos</h3><p style="font-size:13px;color:#666;">Chargement…</p>');
  const { data } = await db.from('adalix_cours_photos').select('rang,media_type,data').eq('cours_id', coursCur.id).order('rang', { ascending: true });
  const ps = data || [];
  modal(`<h3>🖼️ Mes photos</h3>
    ${ps.length ? ps.map(p => `<img src="data:${p.media_type};base64,${p.data}" style="width:100%;border-radius:10px;margin-bottom:8px;">`).join('')
      : '<p style="font-size:13.5px;color:#666;">Aucune photo gardée pour ce cours.</p>'}
    <div class="actions"><button class="btn ghost" onclick="closeModal()">Fermer</button></div>`);
}

function supprimerCours() {
  modal(`<h3>🗑️ Supprimer ce cours ?</h3>
    <p style="font-size:13.5px;">« ${esc(coursCur.titre)} » et tout ce qui va avec (notions suivies, photos) sera effacé. C'est définitif.</p>
    <div class="actions"><button class="btn" style="background:#c9636a;" onclick="confirmSupprCours()">Oui, supprimer</button><button class="btn ghost" onclick="closeModal()">Annuler</button></div>`);
}
async function confirmSupprCours() {
  const { error } = await db.from('adalix_cours').delete().eq('id', coursCur.id);
  closeModal();
  if (error) { console.error(error); toast('Suppression impossible'); return; }
  toast('Cours supprimé');
  renderCours();
}

/* ---------- interro orale ---------- */
function startInterro() {
  tutorMsgs = []; tutorFini = false; tutorBilan = {};
  drawInterroScreen();
  envoyerInterro('');
}
function drawInterroScreen() {
  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn" onclick="finirInterro()">← Terminer l'interro</button>
    <div class="card">
      <h3>🎤 ${esc(coursCur.titre)}</h3>
      <div style="font-size:12.5px;opacity:.7;">Réponds avec tes mots, comme à l'oral. Si tu ne sais pas, dis-le : on passe à la suite.</div>
      <div id="chat-box"></div>
      <div class="chat-input">
        ${micBtn('interro-in')}
        <input type="text" id="interro-in" placeholder="Ta réponse…" onkeydown="if(event.key==='Enter')envoyerInterro()">
        <button class="btn" onclick="envoyerInterro()">➤</button>
      </div>
      ${micDispo() ? `<div style="font-size:12px;opacity:.65;margin-top:5px;">🎤 Touche le micro et réponds à voix haute : tes mots s'écrivent tout seuls, tu relis, puis tu envoies.</div>` : ''}
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn ghost" onclick="passerQuestion()">⏭️ Je ne sais pas, passe</button>
        <button class="btn${tutorFini ? '' : ' ghost'}" onclick="finirInterro()">🏁 Terminer${tutorFini ? ' et enregistrer' : ''}</button>
      </div>
    </div>
  </div>`;
  drawInterro();
}
function drawInterro() {
  const box = $('#chat-box'); if (!box) return;
  box.innerHTML = tutorMsgs.map(m => `<div class="msg ${m.role === 'user' ? 'user' : 'bot'}">${esc(m.content)}</div>`).join('')
    || '<div style="color:#999;font-size:13px;text-align:center;margin-top:30px;">Le tuteur prépare sa première question…</div>';
  box.scrollTop = box.scrollHeight;
}
function passerQuestion() { const i = $('#interro-in'); if (i) { i.value = 'Je ne sais pas, passe à la question suivante.'; envoyerInterro(); } }

async function envoyerInterro(forcee) {
  if (coursBusy) return;
  const inp = $('#interro-in');
  const texte = forcee !== undefined ? forcee : (inp ? inp.value.trim() : '');
  if (texte) { tutorMsgs.push({ role: 'user', content: texte }); if (inp) inp.value = ''; }
  tutorMsgs.push({ role: 'assistant', content: '…' });
  drawInterro();
  coursBusy = true;
  try {
    const j = await callCours({
      mode: 'interro',
      cours: { titre: coursCur.titre, matiere: coursCur.matiere, resume: coursCur.resume, texte: coursCur.texte },
      notions: coursNotions.map(n => ({ notion: n.notion, question: n.question, reponse: n.reponse })),
      messages: tutorMsgs.slice(0, -1),
    });
    if (!j) { tutorMsgs.pop(); drawInterro(); return; }
    if (j.error || !j.reply) { tutorMsgs[tutorMsgs.length - 1] = { role: 'assistant', content: j.error || 'Oups, réessaie !' }; drawInterro(); return; }
    tutorMsgs[tutorMsgs.length - 1] = { role: 'assistant', content: j.reply };
    if (j.bilan) { tutorBilan[j.bilan.notion] = !!j.bilan.ok; await majNotion(j.bilan.notion, j.bilan.ok); }
    // le tuteur vient de faire son bilan final : le bouton « Terminer » devient l'action principale
    if (j.fini && !tutorFini) { tutorFini = true; drawInterroScreen(); return; }
    drawInterro();
  } catch (e) {
    tutorMsgs[tutorMsgs.length - 1] = { role: 'assistant', content: 'Erreur de connexion — réessaie.' };
    drawInterro();
  } finally { coursBusy = false; }
}

/* Une notion vient d'être testée : on la fait avancer (ou repartir) dans les boîtes. */
async function majNotion(nom, ok) {
  const n = coursNotions.find(x => x.notion === nom)
    || coursNotions.find(x => (x.notion || '').toLowerCase() === String(nom || '').toLowerCase());
  if (!n) return;
  const box = ok ? Math.min(5, (n.box || 1) + 1) : 1;
  const maj = {
    box, due: jourPlus(BOX_JOURS[box] || 1),
    reussites: (n.reussites || 0) + (ok ? 1 : 0),
    echecs: (n.echecs || 0) + (ok ? 0 : 1),
    updated_at: new Date().toISOString(),
  };
  Object.assign(n, maj);
  const { error } = await db.from('adalix_cours_notions').update(maj).eq('id', n.id);
  if (error) console.error('notion non mise à jour', error);
}

async function finirInterro() {
  micStop();   // le micro ne doit pas rester ouvert derrière l'écran qu'on quitte
  // on n'enregistre que ce que le tuteur a réellement tranché pendant CETTE session
  const notions = Object.keys(tutorBilan);
  if (notions.length) {
    const { error } = await db.from('adalix_cours_revisions').insert({
      cours_id: coursCur.id, child, type: 'interro',
      score: notions.filter(n => tutorBilan[n]).length, total: notions.length,
      notions_ratees: notions.filter(n => !tutorBilan[n]),
    });
    if (error) console.error('interro non enregistrée', error);
  }
  openCours(coursCur.id);
}

/* ---------- fiche d'exercices ---------- */
function openExosMenu() {
  const faibles = coursNotions.filter(n => n.box <= 2 && n.echecs > 0);
  modal(`<h3>✍️ Une fiche d'exercices</h3>
    <p style="font-size:13.5px;color:#666;">Des exercices fabriqués sur mesure à partir de TON cours — pour appliquer, pas pour réciter.</p>
    ${faibles.length ? `<div class="ecrit-box" style="margin-bottom:10px;font-size:13px;">Je vais insister sur ce qui te résiste : ${faibles.slice(0, 4).map(n => esc(n.notion)).join(', ')}.</div>` : ''}
    <div class="actions" style="flex-wrap:wrap;">
      <button class="btn" onclick="startExos(4)">4 exercices</button>
      <button class="btn" onclick="startExos(6)">6 exercices</button>
      <button class="btn" onclick="startExos(9)">9 exercices</button>
    </div>
    <div class="actions"><button class="btn ghost" onclick="closeModal()">Annuler</button></div>`);
}

async function startExos(nb) {
  closeModal();
  $('#main').innerHTML = '<div class="card">✍️ Je fabrique tes exercices…</div>';
  const faibles = coursNotions.filter(n => n.box <= 2 && n.echecs > 0).map(n => n.notion);
  const j = await callCours({
    mode: 'exos', nb, notions: faibles,
    cours: { titre: coursCur.titre, matiere: coursCur.matiere, niveau: coursCur.niveau, resume: coursCur.resume, texte: coursCur.texte },
  });
  if (!j) { drawCours(); return; }
  if (j.error || !j.exercices) { toast(j.error || 'Échec'); drawCours(); return; }
  exoState = { ex: j.exercices, rep: j.exercices.map(() => ''), res: null, t0: Date.now() };
  drawExos();
}

function drawExos() {
  const S = exoState;
  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn no-print" onclick="drawCours()">← Le cours</button>
    <div class="card no-print">
      <h3>✍️ Exercices — ${esc(coursCur.titre)}</h3>
      <div style="font-size:13px;opacity:.75;">Réponds à tout, puis demande la correction. Les questions ouvertes sont corrigées sur le fond : l'orthographe ne compte pas ici.</div>
    </div>
    ${S.ex.map((e, i) => exoHtml(e, i)).join('')}
    <div class="card no-print" style="text-align:center;">
      ${S.res ? `<div class="big-score">${S.res.filter(r => r.ok).length}/${S.ex.length}</div>
        <div style="font-size:14px;margin-bottom:10px;">${bilanExos(S.res.filter(r => r.ok).length, S.ex.length)}</div>
        <button class="btn" onclick="openExosMenu()">✍️ Une autre fiche</button>
        <button class="btn ghost" onclick="drawCours()">Retour au cours</button>`
      : `<button class="btn" id="exo-go" onclick="corrigerExos()">✅ Corriger ma fiche</button>`}
    </div>
  </div>`;
}

function exoHtml(e, i) {
  const S = exoState;
  const r = S.res ? S.res[i] : null;
  const corrige = !!r;
  return `<div class="card">
    <div style="font-size:11.5px;opacity:.55;text-transform:uppercase;letter-spacing:1px;">Exercice ${i + 1}${e.notion ? ' · ' + esc(e.notion) : ''}</div>
    <div class="quiz-q" style="margin:6px 0 10px;">${esc(e.enonce)}</div>
    ${e.type === 'qcm'
      ? e.options.map((o, k) => {
          const choisi = String(S.rep[i]) === String(k);
          const bonne = String(e.reponse) === String(k);
          const cls = corrige ? (bonne ? ' correct' : (choisi ? ' wrong' : '')) : (choisi ? ' sel-opt' : '');
          return `<button class="quiz-opt${cls}" ${corrige ? 'disabled' : ''} onclick="repExo(${i},'${k}')">${esc(o)}</button>`;
        }).join('')
      : `<textarea rows="${e.type === 'calcul' ? 2 : 3}" ${corrige ? 'disabled' : ''} placeholder="${e.type === 'calcul' ? 'Ton calcul et ton résultat…' : 'Ta réponse…'}" oninput="repExo(${i}, this.value)">${esc(S.rep[i])}</textarea>`}
    ${corrige ? `<div class="quiz-fb ${r.ok ? 'ok' : 'ko'}">
      <b>${r.ok ? '✅ Juste' : '❌ Pas tout à fait'}</b> — ${esc(r.commentaire)}
      ${e.explication ? `<div style="margin-top:6px;opacity:.9;">${esc(e.explication)}</div>` : ''}
    </div>` : ''}
  </div>`;
}
function repExo(i, v) {
  exoState.rep[i] = v;
  if (exoState.ex[i].type === 'qcm') drawExos();
}

async function corrigerExos() {
  if (coursBusy) return;
  const S = exoState;
  const btn = $('#exo-go'); if (btn) { btn.disabled = true; btn.textContent = '✅ Correction…'; }
  coursBusy = true;
  try {
    // les QCM se corrigent ici (on a la bonne réponse), le rédigé part à la correction IA
    const res = S.ex.map(() => null);
    const aEnvoyer = [];
    S.ex.forEach((e, i) => {
      if (e.type === 'qcm') {
        const ok = String(S.rep[i]) === String(e.reponse);
        res[i] = { ok, commentaire: ok ? "Bon choix." : `La bonne réponse était : ${e.options[Number(e.reponse)] || e.reponse}.` };
      } else {
        aEnvoyer.push({ i, enonce: e.enonce, attendu: e.reponse, reponse: S.rep[i] });
      }
    });
    if (aEnvoyer.length) {
      const j = await callCours({ mode: 'corriger', items: aEnvoyer.map(x => ({ enonce: x.enonce, attendu: x.attendu, reponse: x.reponse })) });
      if (!j) return;
      if (j.error || !j.resultats) { toast(j.error || 'Correction impossible'); return; }
      aEnvoyer.forEach((x, k) => { res[x.i] = j.resultats[k] || { ok: false, commentaire: `La réponse attendue : ${x.attendu}` }; });
    }
    S.res = res;
    const bons = res.filter(r => r.ok).length;

    // les notions ratées redescendent dans les boîtes, les réussies progressent
    for (let i = 0; i < S.ex.length; i++) {
      if (S.ex[i].notion) await majNotion(S.ex[i].notion, !!res[i].ok);
    }
    await db.from('adalix_cours_revisions').insert({
      cours_id: coursCur.id, child, type: 'exos', score: bons, total: S.ex.length,
      notions_ratees: S.ex.filter((e, i) => !res[i].ok && e.notion).map(e => e.notion),
    });
    drawExos();
  } finally {
    coursBusy = false;
    const b = $('#exo-go'); if (b) { b.disabled = false; b.textContent = '✅ Corriger ma fiche'; }
  }
}
function bilanExos(bons, total) {
  const p = total ? bons / total : 0;
  if (p === 1) return 'Sans faute — ce cours est à toi. 🏆';
  if (p >= 0.75) return 'Solide ! Revois juste ce qui a coincé.';
  if (p >= 0.5) return "C'est en train de rentrer. Refais une fiche demain, tu verras la différence.";
  return "Ce cours n'est pas encore digéré — relis-le, puis demande une interro orale.";
}

/* ---------- révisions espacées ---------- */
async function startRevision(coursId) {
  $('#main').innerHTML = '<div class="card">Chargement de tes notions…</div>';
  let q = db.from('adalix_cours_notions').select('*').eq('child', child).lte('due', todayStr());
  if (coursId) q = q.eq('cours_id', coursId);
  const { data } = await q.order('due', { ascending: true });
  const notions = (data || []).slice(0, 20);
  if (!notions.length) { toast('Rien à revoir pour le moment — reviens demain 🔁'); return coursId ? openCours(coursId) : renderCours(); }
  // ordre mélangé : réviser toujours dans le même ordre fait retenir l'ordre, pas le cours
  for (let i = notions.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [notions[i], notions[k]] = [notions[k], notions[i]]; }
  revState = { notions, i: 0, vu: false, bons: 0, coursId: coursId || null };
  drawRevision();
}

function drawRevision() {
  const S = revState;
  if (S.i >= S.notions.length) return drawRevisionFin();
  const n = S.notions[S.i];
  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn" onclick="quitterRevision()">← Arrêter</button>
    <div class="card">
      <div class="quiz-progress">🔁 Notion ${S.i + 1} / ${S.notions.length} · boîte ${n.box}/5</div>
      <div class="quiz-q" style="margin:14px 0;">${esc(n.question)}</div>
      ${S.vu
        ? `<div class="quiz-fb ok"><b>La réponse :</b> ${esc(n.reponse)}</div>
           <div style="font-size:13.5px;margin:12px 0 8px;text-align:center;">Alors, tu l'avais ?</div>
           <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
             <button class="btn" onclick="repondreRevision(true)">✅ Je l'avais</button>
             <button class="btn ghost" onclick="repondreRevision(false)">❌ Pas vraiment</button>
           </div>
           <div style="font-size:12px;opacity:.6;text-align:center;margin-top:10px;">Sois honnête : c'est toi que tu aides.</div>`
        : `<textarea id="rev-rep" rows="3" placeholder="Réponds de tête (ou passe directement à la réponse)"></textarea>
           <div class="actions"><button class="btn" onclick="revealRevision()">👀 Voir la réponse</button></div>`}
    </div>
  </div>`;
}
function revealRevision() { revState.vu = true; drawRevision(); }
async function repondreRevision(ok) {
  const S = revState;
  const n = S.notions[S.i];
  const box = ok ? Math.min(5, (n.box || 1) + 1) : 1;
  if (ok) S.bons++;
  const maj = {
    box, due: jourPlus(BOX_JOURS[box] || 1),
    reussites: (n.reussites || 0) + (ok ? 1 : 0),
    echecs: (n.echecs || 0) + (ok ? 0 : 1),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('adalix_cours_notions').update(maj).eq('id', n.id);
  if (error) console.error('notion non mise à jour', error);
  S.i++; S.vu = false;
  drawRevision();
}
async function drawRevisionFin() {
  const S = revState;
  await db.from('adalix_cours_revisions').insert({
    cours_id: S.coursId, child, type: 'espacee', score: S.bons, total: S.notions.length,
    notions_ratees: [],
  });
  $('#main').innerHTML = `<div class="narrow"><div class="card" style="text-align:center;">
    <h3>🔁 Révision terminée</h3>
    <div class="big-score">${S.bons}/${S.notions.length}</div>
    <div style="font-size:14px;margin-bottom:12px;">${S.bons === S.notions.length
      ? 'Tout était là. Ces notions reviendront dans longtemps. 🏆'
      : `Les ${S.notions.length - S.bons} notion${S.notions.length - S.bons > 1 ? 's' : ''} qui ont résisté reviendront dès demain — c'est comme ça qu'elles finissent par rester.`}</div>
    <button class="btn" onclick="renderCours()">Mes cours</button>
  </div></div>`;
  revState = null;
}
function quitterRevision() { const id = revState && revState.coursId; revState = null; if (id) openCours(id); else renderCours(); }

/* ---------- pastille sur l'écran des deux espaces ----------
   Les révisions espacées ne servent à rien si l'enfant ne pense pas à y revenir :
   le nombre de notions dues s'affiche dès l'écran d'accueil, sur la carte Tuteur. */
async function coursBadgeEspace() {
  const el = $('#espace-tuteur-info'); if (!el) return;
  const { data } = await db.from('adalix_cours_notions').select('id').eq('child', child).lte('due', todayStr());
  const n = (data || []).length;
  if (n) el.innerHTML = `<div class="ec-pastille">🔁 ${n} notion${n > 1 ? 's' : ''} à revoir</div>`;
}

/* ---------- carte du tableau de bord parent ---------- */
async function fillCoursParentCard() {
  const el = $('#cours-parent-card'); if (!el) return;
  const [cours, revs, nots] = await Promise.all([
    db.from('adalix_cours').select('id,child,matiere,titre,created_at').order('created_at', { ascending: false }).limit(60),
    db.from('adalix_cours_revisions').select('*').order('created_at', { ascending: false }).limit(60),
    db.from('adalix_cours_notions').select('child,notion,box,echecs,due'),
  ]);
  const C = cours.data || [], R = revs.data || [], N = nots.data || [];
  if (!C.length) {
    el.innerHTML = `<div class="card"><h3>📚 Les cours mis au propre</h3>
      <div style="font-size:13.5px;color:#888;">Aucun cours déposé pour l'instant. L'onglet « Mes cours » attend une première photo.</div></div>`;
    return;
  }
  const kids = ['adam', 'alix'];
  const nom = k => k === 'adam' ? '🐉 Adam' : '🦊 Alix';
  el.innerHTML = `<div class="card"><h3>📚 Les cours mis au propre</h3>
    ${kids.map(k => {
      const cs = C.filter(c => c.child === k);
      const rs = R.filter(r => r.child === k);
      const ns = N.filter(n => n.child === k);
      if (!cs.length) return `<div class="jentry"><div class="jd">${nom(k)}</div><span style="color:#999;font-size:13px;">Aucun cours déposé</span></div>`;
      const exos = rs.filter(r => r.type === 'exos');
      const pts = exos.reduce((s, r) => s + r.total, 0);
      const bons = exos.reduce((s, r) => s + r.score, 0);
      // ce qui coince vraiment : échoué au moins deux fois et toujours dans la première boîte
      const coince = ns.filter(n => n.box <= 1 && n.echecs >= 2).slice(0, 6);
      const acquises = ns.filter(n => n.box >= 4).length;
      const aRevoir = ns.filter(n => n.due <= todayStr()).length;
      return `<div class="jentry">
        <div class="jd">${nom(k)} · dernier cours le ${new Date(cs[0].created_at).toLocaleDateString('fr-FR')}</div>
        <div style="font-size:13.5px;"><b>${cs.length}</b> cours · <b>${ns.length}</b> notions suivies dont <b>${acquises}</b> bien installées · <b>${aRevoir}</b> à revoir aujourd'hui</div>
        <div style="font-size:13.5px;">${exos.length ? `<b>${exos.length}</b> fiches d'exercices · ${pts ? Math.round(bons / pts * 100) : 0} % de réussite` : "Pas encore d'exercices faits"}${rs.filter(r => r.type === 'interro').length ? ` · <b>${rs.filter(r => r.type === 'interro').length}</b> interros orales` : ''}</div>
        <div style="font-size:13px;margin-top:5px;">Derniers cours : ${cs.slice(0, 4).map(c => `${matOf(c.matiere).emoji} ${esc(c.titre)}`).join(' · ')}</div>
        ${coince.length ? `<div style="font-size:13px;margin-top:5px;color:#a8500f;">⚠️ Ce qui résiste : ${coince.map(n => esc(n.notion)).join(', ')}</div>` : ''}
      </div>`;
    }).join('')}
    <div style="font-size:12px;color:#999;margin-top:6px;">Les notions « bien installées » ont été réussies plusieurs fois à quelques jours d'intervalle — c'est le seul signe fiable que quelque chose est vraiment retenu.</div>
  </div>`;
}

/* ---------- ce que l'assistant demande à ce module ----------
   « Interroge-moi » (app.js) laisse l'enfant choisir une matière de son année scolaire.
   Les deux fonctions ci-dessous sont les seules portes d'entrée : app.js ne connaît ni
   MATIERES ni les tables des cours. */

/* Toutes les matières, celles où il a photographié des cours d'abord. On les propose
   toutes : là où il a un cours, l'interro porte sur SON cahier ; ailleurs, sur le
   programme de sa classe. Aucune ne mène donc à une interro vide. */
async function matieresInterro() {
  const { data } = await db.from('adalix_cours').select('matiere,niveau').eq('child', child);
  const cs = data || [];
  noteNiveau(cs);
  const n = {};
  cs.forEach(c => { n[c.matiere] = (n[c.matiere] || 0) + 1; });
  const avec = MATIERES.filter(m => n[m.id]).map(m => ({ id: m.id, emoji: m.emoji, label: m.label, cours: n[m.id] }));
  // « Autre » n'a de sens que s'il y a déjà des cours dedans : sinon on n'interroge sur rien
  const sans = MATIERES.filter(m => !n[m.id] && m.id !== 'autre').map(m => ({ id: m.id, emoji: m.emoji, label: m.label, cours: 0 }));
  return avec.concat(sans);
}

/* Le contexte d'une interro de l'année : ses cours de cette matière et les notions
   déjà suivies, avec leur question et leur réponse. On envoie les résumés et les
   points clés plutôt que le cours entier — l'assistant doit poser des questions, pas
   réciter le cahier, et le corps du texte ferait exploser la requête. */
async function interroAnnee(mat) {
  const m = matOf(mat);
  const { data: cd } = await db.from('adalix_cours')
    .select('id,titre,niveau,chapitre,resume,points_cles,vocabulaire')
    .eq('child', child).eq('matiere', mat).order('created_at', { ascending: false }).limit(12);
  const cours = cd || [];
  if (!cours.length) {
    const niv = typeof niveauScolaire === 'function' ? niveauScolaire() : '5e';
    return { emoji: m.emoji, label: m.label, cours: 0,
      ctx: `ANNÉE SCOLAIRE — ${m.label}. Il n'a encore photographié aucun cours de cette matière : `
        + `interroge-le sur le programme de ${m.label} de ${niv}, tel qu'il est enseigné au collège en France. `
        + `Commence par le début du programme de l'année et préviens-le que tu l'interroges sur le programme, `
        + `pas sur son cahier — s'il veut réviser SON cours, il le photographie dans « Mes cours ».` };
  }
  const ids = cours.map(c => c.id);
  const { data: nd } = await db.from('adalix_cours_notions')
    .select('cours_id,notion,question,reponse,box,echecs').eq('child', child);
  const notions = (nd || []).filter(n => ids.indexOf(n.cours_id) >= 0);
  const lignes = cours.map(c => {
    const ns = notions.filter(n => n.cours_id === c.id);
    return [
      `COURS : ${c.titre}${c.chapitre ? ` — ${c.chapitre}` : ''}${c.niveau ? ` (${c.niveau})` : ''}`,
      c.resume ? `  Résumé : ${String(c.resume).slice(0, 600)}` : '',
      (c.points_cles || []).length ? `  À retenir : ${(c.points_cles || []).join(' · ').slice(0, 700)}` : '',
      (c.vocabulaire || []).length ? `  Vocabulaire : ${(c.vocabulaire || []).map(v => `${v.mot} = ${v.def}`).join(' · ').slice(0, 700)}` : '',
      ns.length ? `  Questions déjà travaillées : ${ns.map(n => `${n.question} → ${n.reponse}`).join(' | ').slice(0, 900)}` : '',
      // ce qui résiste : échoué au moins deux fois et toujours dans la première boîte
      ns.filter(n => n.box <= 1 && n.echecs >= 2).length
        ? `  CE QUI LUI RÉSISTE (insiste dessus) : ${ns.filter(n => n.box <= 1 && n.echecs >= 2).map(n => n.notion).join(', ')}` : '',
    ].filter(Boolean).join('\n');
  });
  return { emoji: m.emoji, label: m.label, cours: cours.length,
    ctx: `ANNÉE SCOLAIRE — ${m.label}. Ses cours photographiés et mis au propre, du plus récent au plus ancien. `
      + `Interroge-le SUR CES COURS, avec ses mots à lui, et pas sur le programme en général :\n`
      + lignes.join('\n\n') };
}
