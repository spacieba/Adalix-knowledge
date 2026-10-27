/* Adalix Knowledge — lecture.js
   Lire et écrire : lecture guidée à voix haute, affichage adapté, carnet de mots
   personnel et dictées sur mesure.

   Principe de conception, valable partout dans ce fichier : jamais de stylo rouge,
   jamais de total de fautes affiché, on compte les mots gagnés. Rien de ce qui est
   ici n'entre dans le classement familial.

   Dépend de app.js (child, db, $, esc, toast, modal, closeModal, familyCode,
   badFamilyCode, todayStr) et de cours.js (callCours, coursCur, BOX_JOURS, jourPlus). */

/* ---------- préférences de lecture, par enfant et par appareil ---------- */
const LECT_DEFAUT = { taille: 1, espace: 1, syllabes: false, vitesse: 0.9 };
let lectPref = Object.assign({}, LECT_DEFAUT);
function lectClef() { return 'adalix_lecture_' + (child || 'x'); }
function lectChargePref() {
  lectPref = Object.assign({}, LECT_DEFAUT);
  try {
    const j = JSON.parse(localStorage.getItem(lectClef()) || '{}');
    Object.keys(LECT_DEFAUT).forEach(k => { if (j[k] !== undefined) lectPref[k] = j[k]; });
  } catch (e) { /* stockage indisponible : on garde les valeurs par défaut */ }
}
function lectSavePref() {
  try { localStorage.setItem(lectClef(), JSON.stringify(lectPref)); } catch (e) { /* tant pis */ }
}

/* ---------- découpage en syllabes ----------
   Heuristique française : noyaux vocaliques, puis répartition des consonnes.
   Elle est bonne sur l'immense majorité des mots courants, mais elle se trompe parfois —
   c'est pourquoi elle n'est jamais activée par défaut, et pourquoi les mots du carnet
   utilisent le découpage fourni par l'IA plutôt que celui-ci. */
const VOY = 'aàâäeéèêëiîïoôöuùûüyœæ';
const DIGR = ['ch', 'ph', 'th', 'gn', 'qu', 'gu'];
const LIQ = ['bl', 'cl', 'fl', 'gl', 'pl', 'br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr', 'vr'];
const estVoy = c => VOY.indexOf(String(c).toLowerCase()) >= 0;

function syllabes(mot) {
  const m = String(mot || '');
  if (m.length < 4) return [m];
  const bas = m.toLowerCase();
  // 1. les noyaux : suites maximales de voyelles
  const noyaux = [];
  for (let i = 0; i < bas.length; i++) {
    if (!estVoy(bas[i])) continue;
    const d = i;
    while (i + 1 < bas.length && estVoy(bas[i + 1])) i++;
    noyaux.push([d, i]);
  }
  if (noyaux.length < 2) return [m];
  // 2. entre deux noyaux, on décide où couper le groupe de consonnes
  const coupes = [];
  for (let k = 0; k < noyaux.length - 1; k++) {
    const d = noyaux[k][1] + 1, f = noyaux[k + 1][0];
    const n = f - d;
    if (n <= 0) continue;                               // deux noyaux collés : pas de coupe
    if (n === 1) { coupes.push(d); continue; }          // la consonne part avec la suite
    const deux = bas.slice(f - 2, f);
    const insecable = DIGR.includes(deux) || LIQ.includes(deux);
    coupes.push(insecable ? f - 2 : f - 1);
  }
  const bouts = [];
  let d = 0;
  coupes.forEach(c => { if (c > d) { bouts.push(m.slice(d, c)); d = c; } });
  bouts.push(m.slice(d));
  return bouts.filter(Boolean);
}
/* Rend un mot avec ses syllabes en couleurs alternées. `fourni` est le découpage
   de l'IA ("ba-teau") quand on l'a : il prime toujours sur l'heuristique. */
function syllabesHtml(mot, fourni) {
  const bouts = (fourni && String(fourni).indexOf('-') > 0)
    ? String(fourni).split('-')
    : syllabes(mot);
  return bouts.map((s, i) => `<span class="syl syl-${i % 2}">${esc(s)}</span>`).join('');
}

/* ---------- lecture à voix haute ---------- */
let lectVoix = null, lectEnCours = false, lectMots = [], lectTexte = '';
function lectVoixFr() {
  if (!('speechSynthesis' in window)) return null;
  if (lectVoix) return lectVoix;
  const dispo = speechSynthesis.getVoices().filter(v => /^fr/i.test(v.lang));
  lectVoix = dispo.find(v => v.localService) || dispo[0] || null;
  return lectVoix;
}
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.addEventListener) {
  // la liste des voix arrive souvent après le chargement de la page
  speechSynthesis.addEventListener('voiceschanged', () => { lectVoix = null; lectVoixFr(); });
}
function lectDispo() { return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; }

/* Lit un texte. `surligne` reçoit l'index du caractère en cours, quand l'appareil
   le fournit — certaines voix ne le font pas : on lit alors sans surlignage. */
function lectDire(texte, surligne, fini) {
  if (!lectDispo()) { toast("La lecture à voix haute n'est pas disponible sur cet appareil"); return false; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = 'fr-FR';
  u.rate = lectPref.vitesse;
  const v = lectVoixFr(); if (v) u.voice = v;
  if (surligne) u.onboundary = e => { if (e.charIndex != null) surligne(e.charIndex); };
  u.onend = () => { lectEnCours = false; if (fini) fini(); };
  u.onerror = () => { lectEnCours = false; if (fini) fini(); };
  lectEnCours = true;
  speechSynthesis.speak(u);
  return true;
}
function lectStop() {
  if (lectDispo()) speechSynthesis.cancel();
  lectEnCours = false;
}

/* ---------- la voix de l'assistant ----------
   Le moteur de lecture est déjà là (lectDire) : la voix de l'assistant n'est qu'une
   couche au-dessus, pour qu'il n'y ait qu'une voix et qu'un réglage de vitesse dans
   toute l'app. Elle sert au tuteur du chat et à l'interro d'un cours.

   Éteinte au départ, et le choix est retenu par enfant : une voix qui se met à parler
   sans prévenir en classe ou le soir, c'est l'app qu'on referme. Une fois allumée, elle
   lit chaque réponse qui arrive. */
let vxOn = false;
let vxDernier = '';     // la dernière réponse reçue, pour la réentendre
function vxClef() { return 'adalix_voix_' + (child || 'x'); }
function vxCharge() {
  try { vxOn = localStorage.getItem(vxClef()) === '1'; } catch (e) { vxOn = false; }
  lectChargePref();
  return vxOn;
}
function vxDispo() { return lectDispo(); }
function vxEtiquette() { return vxOn ? '🔊 Sa voix : oui' : '🔇 Sa voix : non'; }
/* Jamais un bouton qui ne marche pas : pas de voix sur l'appareil, pas de bouton. */
function vxBtn() {
  if (!vxDispo()) return '';
  return `<button class="btn ghost" id="vx-btn" onclick="vxBascule()" title="Lire les réponses à voix haute">${vxEtiquette()}</button>`;
}
function vxBascule() {
  vxOn = !vxOn;
  try { localStorage.setItem(vxClef(), vxOn ? '1' : '0'); } catch (e) { /* mode privé */ }
  const b = $('#vx-btn'); if (b) b.innerHTML = vxEtiquette();
  if (!vxOn) { vxStop(); toast('Voix éteinte 🔇'); return; }
  lectChargePref();
  toast('Je te lirai mes réponses à voix haute 🔊');
  if (vxDernier) vxDire(vxDernier);   // on entend tout de suite que ça marche
}
/* Ce qui s'écrit ne se dit pas : les étoiles du gras, les dièses des titres, les
   adresses et les emojis sonnent affreusement une fois lus à voix haute. */
function vxNettoie(t) {
  return String(t || '')
    .replace(/```[\s\S]*?```/g, ' un exemple de code. ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/https?:\/\/\S+/g, ' un lien ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}\u{20E3}]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
/* Dire ce texte maintenant, même si la voix automatique est éteinte : c'est le 🔊 que
   l'enfant vient de toucher à côté d'une réponse. */
function vxDire(t) {
  if (!vxDispo()) return;
  const txt = vxNettoie(t);
  if (!txt) return;
  lectChargePref();
  lectDire(txt);
}
/* Une réponse vient d'arriver : on la lit si la voix est allumée, et on la retient. */
function vxAuto(t) {
  vxDernier = String(t || '');
  if (vxOn) vxDire(t);
}
function vxStop() { if (vxDispo()) lectStop(); }

/* ---------- vue « lecture guidée » d'un cours ---------- */
/* Le Markdown est retiré : on lit un texte nu, et chaque mot devient cliquable et
   surlignable. Une ponctuation est ajoutée en fin de ligne quand elle manque, sinon
   la voix enchaîne les titres et les puces sans respirer. */
function lectTexteBrut(md) {
  return String(md || '').split('\n').map(l => {
    let t = l.trim();
    if (!t || /^(-{3,}|_{3,}|\*{3,})$/.test(t)) return '';
    t = t.replace(/^#{1,6}\s+/, '').replace(/^>\s?/, '').replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
    t = t.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
    if (t && !/[.!?:;]$/.test(t)) t += '.';
    return t;
  }).filter(Boolean).join('\n');
}
function lectDecoupe(txt) {
  const out = []; const re = /\S+/g; let m;
  while ((m = re.exec(txt))) out.push({ mot: m[0], d: m.index, f: m.index + m[0].length });
  return out;
}

let lectTitre = 'Lecture', lectRetour = null;
function openLecture(texte, titre, retour) {
  lectChargePref();
  lectTitre = titre || 'Lecture';
  lectRetour = retour || null;
  lectTexte = lectTexteBrut(texte);
  lectMots = lectDecoupe(lectTexte);
  drawLecture();
}
function drawLecture() {
  const titre = lectTitre;
  const sansVoix = !lectDispo();
  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn no-print" onclick="fermerLecture()">← Retour</button>
    <div class="card no-print">
      <h3>👓 ${esc(titre)}</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
        <button class="btn" id="lect-play" onclick="lectBascule()">${sansVoix ? '🔇 Voix indisponible' : '▶️ Écouter'}</button>
        <button class="btn ghost" onclick="lectRegle('taille',1)">🔍 Plus grand</button>
        <button class="btn ghost" onclick="lectRegle('taille',-1)">🔎 Plus petit</button>
        <button class="btn ghost" onclick="lectRegle('espace',1)">↔️ Plus aéré</button>
        <button class="btn ghost" onclick="lectRegle('espace',-1)">↕️ Plus serré</button>
        <button class="btn ghost" onclick="lectRegle('syllabes',0)">${lectPref.syllabes ? '🎨 Syllabes : oui' : '🎨 Syllabes : non'}</button>
        ${sansVoix ? '' : `<button class="btn ghost" onclick="lectRegle('vitesse',0)">🐢 Vitesse : ${lectPref.vitesse.toFixed(1)}×</button>`}
      </div>
      ${lectPref.syllabes ? `<div style="font-size:12px;opacity:.65;margin-top:8px;">Le découpage en syllabes est automatique : il se trompe sur quelques mots rares. Fie-toi à ton oreille.</div>` : ''}
    </div>
    <div class="card">
      <div id="lect-texte" class="lect-texte"
        style="font-size:${(16 + lectPref.taille * 2.5).toFixed(1)}px;
               letter-spacing:${(lectPref.espace * 0.06).toFixed(2)}em;
               word-spacing:${(lectPref.espace * 0.22).toFixed(2)}em;
               line-height:${(1.7 + lectPref.espace * 0.28).toFixed(2)};">${lectCorpsHtml()}</div>
    </div>
  </div>`;
}
function lectCorpsHtml() {
  let html = '', pos = 0;
  lectMots.forEach((m, i) => {
    html += esc(lectTexte.slice(pos, m.d)).replace(/\n/g, '<br>');
    const contenu = lectPref.syllabes ? syllabesHtml(m.mot) : esc(m.mot);
    html += `<span class="lw" id="lw-${i}" onclick="lectDireMot(${i})">${contenu}</span>`;
    pos = m.f;
  });
  return html + esc(lectTexte.slice(pos)).replace(/\n/g, '<br>');
}
function lectRegle(quoi, delta) {
  if (quoi === 'syllabes') lectPref.syllabes = !lectPref.syllabes;
  else if (quoi === 'vitesse') lectPref.vitesse = lectPref.vitesse <= 0.6 ? 1.1 : Math.round((lectPref.vitesse - 0.2) * 10) / 10;
  else lectPref[quoi] = Math.max(0, Math.min(4, lectPref[quoi] + delta));
  lectSavePref();
  lectStop();
  drawLecture();
}
function lectSurligne(charIndex) {
  const el = document.querySelector('.lw.on'); if (el) el.classList.remove('on');
  // le mot en cours est le dernier qui commence avant la position annoncée
  let k = -1;
  for (let i = 0; i < lectMots.length; i++) { if (lectMots[i].d <= charIndex) k = i; else break; }
  if (k < 0) return;
  const cible = document.getElementById('lw-' + k);
  if (cible) { cible.classList.add('on'); if (cible.scrollIntoView) cible.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
function lectBascule() {
  const btn = $('#lect-play');
  if (lectEnCours) { lectStop(); if (btn) btn.innerHTML = '▶️ Écouter'; const o = document.querySelector('.lw.on'); if (o) o.classList.remove('on'); return; }
  const ok = lectDire(lectTexte, lectSurligne, () => {
    const b = $('#lect-play'); if (b) b.innerHTML = '▶️ Écouter';
    const o = document.querySelector('.lw.on'); if (o) o.classList.remove('on');
  });
  if (ok && btn) btn.innerHTML = '⏸️ Pause';
}
function lectDireMot(i) {
  const m = lectMots[i]; if (!m) return;
  lectStop();
  const o = document.querySelector('.lw.on'); if (o) o.classList.remove('on');
  const el = document.getElementById('lw-' + i); if (el) el.classList.add('on');
  lectDire(m.mot.replace(/[^\wÀ-ÿ'-]/g, ''), null, () => { if (el) el.classList.remove('on'); });
}
function fermerLecture() {
  lectStop();
  if (lectRetour === 'mots') renderMots();
  else if (coursCur) drawCours();
  else renderMots();
}

/* ---------- carnet de mots ---------- */
let motsList = [];
let motState = null;

async function loadMots() {
  const { data } = await db.from('adalix_mots').select('*').eq('child', child).order('created_at', { ascending: false });
  motsList = data || [];
}

async function renderMots() {
  if (child === 'parent') { renderDashboard(); return; }
  lectChargePref();
  $('#main').innerHTML = '<div class="card">Chargement de tes mots…</div>';
  await loadMots();
  drawMots();
}

function drawMots() {
  const proposes = motsList.filter(m => m.statut === 'propose');
  /* Deux sortes de propositions, et elles ne se racontent pas pareil : un mot relevé
     dans un cahier (on a vu une faute, d'où `erreur`), et un mot d'une liste qu'il a
     photographiée pour l'apprendre — là il n'a rien raté du tout. */
  const releves = proposes.filter(m => m.erreur);
  const listes = proposes.filter(m => !m.erreur);
  const actifs = motsList.filter(m => m.statut === 'actif');
  const dus = actifs.filter(m => m.due <= todayStr());
  const gagnes = actifs.filter(m => m.box >= 4);

  $('#main').innerHTML = `<div class="narrow">
    <div class="card">
      <h3>✏️ Mes mots</h3>
      <div style="font-size:13.5px;line-height:1.55;">Les mots qui te résistent, rassemblés ici. Tu les revois quelques secondes, de temps en temps, et ils finissent par rentrer tout seuls.</div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        ${dus.length ? `<button class="btn" onclick="startMots()">💪 M'entraîner (${dus.length})</button>` : ''}
        <button class="btn${dus.length ? ' ghost' : ''}" onclick="openDicteeMenu()">📣 Une dictée</button>
        <button class="btn ghost" onclick="ajoutMotManuel()">➕ Ajouter un mot</button>
      </div>
      ${actifs.length ? `<div style="font-size:12.5px;opacity:.7;margin-top:10px;">${actifs.length} mot${actifs.length > 1 ? 's' : ''} suivi${actifs.length > 1 ? 's' : ''}${gagnes.length ? ` · <b>${gagnes.length}</b> gagné${gagnes.length > 1 ? 's' : ''} 🎉` : ''}</div>` : ''}
    </div>

    ${listes.length ? `<div class="card" style="border-left:5px solid #7eb5f4;">
      <h3>📋 Ta liste de mots</h3>
      <div style="font-size:13px;opacity:.8;margin-bottom:10px;">Tu l'as photographiée, et j'y ai lu ces <b>${listes.length} mots</b>. Garde-les tous d'un coup, ou enlève ceux que j'ai mal lus. Ensuite ils reviendront dans ton entraînement et dans tes dictées.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <button class="btn" onclick="motsListeTous('actif')">✓ Tout garder</button>
        <button class="btn ghost" onclick="motsListeTous('ecarte')">✕ Tout écarter</button>
      </div>
      <div class="mot-nuage">${listes.map(m => `<button class="mot-puce" onclick="motStatut(${m.id},'ecarte')" title="Enlever ce mot de la liste">${esc(m.mot)}<span>✕</span></button>`).join('')}</div>
    </div>` : ''}

    ${releves.length ? `<div class="card" style="border-left:5px solid #e8963f;">
      <h3>🔍 Ces mots étaient dans ton cahier</h3>
      <div style="font-size:13px;opacity:.8;margin-bottom:10px;">Je les ai lus différemment de l'orthographe habituelle. Garde ceux que tu veux travailler, écarte les autres — il m'arrive de mal déchiffrer une écriture.</div>
      ${releves.map(m => `<div class="mot-ligne">
        <div style="flex:1;min-width:0;">
          <div class="mot-correct">${syllabesHtml(m.mot, m.syllabes)}</div>
          ${m.erreur ? `<div class="mot-erreur">tu avais écrit : ${esc(m.erreur)}</div>` : ''}
        </div>
        <button class="btn" style="padding:8px 14px;" onclick="motStatut(${m.id},'actif')">✓</button>
        <button class="btn ghost" style="padding:8px 14px;" onclick="motStatut(${m.id},'ecarte')">✕</button>
      </div>`).join('')}
    </div>` : ''}

    ${actifs.length ? `<div class="card">
      <h3>📒 Mon carnet</h3>
      ${actifs.map(m => `<div class="mot-ligne">
        <div style="flex:1;min-width:0;">
          <div class="mot-correct">${syllabesHtml(m.mot, m.syllabes)}</div>
          <div class="mot-meta">${motJauge(m.box)}${m.box >= 4 ? ' · gagné 🎉' : (m.due <= todayStr() ? ' · à revoir' : ' · revu')}</div>
        </div>
        ${lectDispo() ? `<button class="btn ghost" style="padding:8px 12px;" title="Écouter" onclick="lectDire('${esc(m.mot).replace(/'/g, "\\'")}')">🔊</button>` : ''}
        <button class="btn ghost" style="padding:8px 12px;" title="Retirer" onclick="motStatut(${m.id},'ecarte')">🗑️</button>
      </div>`).join('')}
    </div>` : (proposes.length ? '' : `<div class="card" style="text-align:center;">
      <div style="font-size:40px;">📒</div>
      <div style="font-size:14px;margin-top:6px;">Ton carnet est vide pour l'instant.<br>Il se remplira tout seul quand tu photographieras tes cours — ou ajoute un mot toi-même.</div>
    </div>`)}
  </div>`;
}
function motJauge(box) {
  const n = Math.max(1, Math.min(5, box || 1));
  return '●'.repeat(n) + '<span style="opacity:.25;">' + '●'.repeat(5 - n) + '</span>';
}

/* Une liste de vingt-cinq mots validée mot par mot, c'est vingt-cinq gestes : elle
   abandonnerait avant la fin, et avec raison. */
async function motsListeTous(statut) {
  const ids = motsList.filter(m => m.statut === 'propose' && !m.erreur).map(m => m.id);
  if (!ids.length) return;
  const { error } = await db.from('adalix_mots').update({ statut, updated_at: new Date().toISOString() }).in('id', ids);
  if (error) { console.error(error); toast('Enregistrement impossible'); return; }
  motsList.forEach(m => { if (ids.indexOf(m.id) >= 0) m.statut = statut; });
  drawMots();
  toast(statut === 'actif' ? `${ids.length} mots dans ton carnet 📒` : 'Liste écartée');
}

async function motStatut(id, statut) {
  const { error } = await db.from('adalix_mots').update({ statut, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { console.error(error); toast('Enregistrement impossible'); return; }
  const m = motsList.find(x => x.id === id);
  if (m) m.statut = statut;
  drawMots();
}

function ajoutMotManuel() {
  modal(`<h3>➕ Ajouter un mot</h3>
    <p style="font-size:13.5px;color:#666;">Un mot que tu n'arrives jamais à écrire ? Mets-le ici, bien orthographié.</p>
    <input type="text" id="mot-new" placeholder="Ex : aujourd'hui" autocapitalize="off" autocomplete="off" spellcheck="false">
    <div class="actions"><button class="btn" onclick="saveMotManuel()">Ajouter</button><button class="btn ghost" onclick="closeModal()">Annuler</button></div>`);
  setTimeout(() => { const el = $('#mot-new'); if (el) el.focus(); }, 50);
}
async function saveMotManuel() {
  const el = $('#mot-new'); if (!el) return;
  const mot = el.value.trim();
  if (!mot) { toast('Écris le mot'); return; }
  closeModal();
  await motsAjoute([{ correct: mot, ecrit: '', type: 'autre', syllabes: '' }], 'manuel', null, 'actif');
  await renderMots();
  toast('Mot ajouté 📒');
}

/* Ajoute des mots au carnet. Un mot déjà présent n'est pas dupliqué : il redescend
   simplement dans les boîtes, puisqu'il vient d'être raté une fois de plus. */
async function motsAjoute(mots, source, coursId, statut) {
  const propres = (mots || [])
    .map(m => ({
      child, mot: String(m.correct || '').trim().slice(0, 40),
      erreur: String(m.ecrit || '').trim().slice(0, 40),
      syllabes: String(m.syllabes || '').trim().slice(0, 60),
      type: ['phonetique', 'grammatical', 'visuel', 'autre'].includes(m.type) ? m.type : 'autre',
      source: source || 'cours', cours_id: coursId || null,
      statut: statut || 'propose', box: 1, due: todayStr(), updated_at: new Date().toISOString(),
    }))
    .filter(m => m.mot);
  /* Deux listes photographiées partagent souvent un mot (« arbre », « moment ») :
     deux lignes identiques dans le même upsert, et Postgres refuse tout l'envoi. */
  const vus = {};
  let aEcrire = propres.filter(m => { const k = m.mot.toLowerCase(); if (vus[k]) return false; vus[k] = 1; return true; });
  /* Une liste de mots à apprendre n'est pas une faute : un mot déjà dans le carnet
     (peut-être en boîte 4, presque gagné) ou écarté exprès ne doit pas repartir à zéro
     parce qu'il réapparaît sur une photo. On n'ajoute donc que les mots nouveaux.
     Pour une faute, en revanche, le mot DOIT redescendre : c'est tout l'intérêt. */
  if (source === 'liste') {
    const { data: deja } = await db.from('adalix_mots').select('mot').eq('child', child);
    const connus = {};
    (deja || []).forEach(m => { connus[String(m.mot || '').toLowerCase()] = 1; });
    aEcrire = aEcrire.filter(m => !connus[m.mot.toLowerCase()]);
  }
  if (!aEcrire.length) return 0;
  const { error } = await db.from('adalix_mots').upsert(aEcrire, { onConflict: 'child,mot' });
  if (error) { console.error('mots non enregistrés', error); return 0; }
  return aEcrire.length;
}

/* ---------- entraînement : regarde → cache → écris → vérifie ---------- */
async function startMots() {
  const dus = motsList.filter(m => m.statut === 'actif' && m.due <= todayStr());
  if (!dus.length) { toast('Rien à revoir pour le moment — reviens demain ✏️'); return; }
  for (let i = dus.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [dus[i], dus[k]] = [dus[k], dus[i]]; }
  motState = { mots: dus.slice(0, 15), i: 0, etape: 'regarde', reponse: '', bons: 0 };
  drawMotEtape();
}
function drawMotEtape() {
  const S = motState;
  if (S.i >= S.mots.length) return drawMotsFin();
  const m = S.mots[S.i];
  const entete = `<div class="quiz-progress">✏️ Mot ${S.i + 1} / ${S.mots.length}</div>`;

  if (S.etape === 'regarde') {
    $('#main').innerHTML = `<div class="narrow">
      <button class="back-btn" onclick="quitterMots()">← Arrêter</button>
      <div class="card" style="text-align:center;">
        ${entete}
        <div style="font-size:13px;opacity:.7;margin-top:10px;">Regarde-le bien. Les couleurs montrent les syllabes.</div>
        <div class="mot-geant">${syllabesHtml(m.mot, m.syllabes)}</div>
        ${lectDispo() ? `<button class="btn ghost" onclick="lectDire('${esc(m.mot).replace(/'/g, "\\'")}')">🔊 Écouter</button>` : ''}
        <div class="actions" style="justify-content:center;margin-top:16px;">
          <button class="btn" onclick="motEtape('ecris')">Je l'ai photographié →</button>
        </div>
      </div>
    </div>`;
    if (lectDispo()) lectDire(m.mot);
    return;
  }

  if (S.etape === 'ecris') {
    $('#main').innerHTML = `<div class="narrow">
      <button class="back-btn" onclick="quitterMots()">← Arrêter</button>
      <div class="card" style="text-align:center;">
        ${entete}
        <div style="font-size:15px;margin:14px 0 4px;">Écris-le de mémoire :</div>
        <input type="text" id="mot-rep" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"
          style="text-align:center;font-size:24px;letter-spacing:.08em;" onkeydown="if(event.key==='Enter')motVerifie()">
        <div style="font-size:12px;opacity:.6;margin-top:4px;">La correction automatique du téléphone est désactivée ici : c'est toi qui écris.</div>
        <div class="actions" style="justify-content:center;">
          <button class="btn" onclick="motVerifie()">Vérifier</button>
          ${lectDispo() ? `<button class="btn ghost" onclick="lectDire('${esc(m.mot).replace(/'/g, "\\'")}')">🔊 Réécouter</button>` : ''}
        </div>
      </div>
    </div>`;
    setTimeout(() => { const el = $('#mot-rep'); if (el) el.focus(); }, 60);
    return;
  }

  // vérification
  const juste = motNormalise(S.reponse) === motNormalise(m.mot);
  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn" onclick="quitterMots()">← Arrêter</button>
    <div class="card" style="text-align:center;">
      ${entete}
      ${juste
        ? `<div style="font-size:40px;margin-top:10px;">🎉</div>
           <div style="font-size:17px;font-weight:700;margin:6px 0 2px;">C'est exactement ça !</div>
           <div class="mot-geant">${syllabesHtml(m.mot, m.syllabes)}</div>`
        : `<div style="font-size:15px;margin-top:12px;opacity:.8;">Tu as écrit :</div>
           <div class="mot-geant mot-ecrit">${esc(S.reponse || '(rien)')}</div>
           <div style="font-size:15px;opacity:.8;">Le mot s'écrit :</div>
           <div class="mot-geant">${motDiffHtml(S.reponse, m.mot)}</div>
           <div style="font-size:13.5px;opacity:.75;margin-top:6px;">Les lettres en couleur sont celles qui ont changé. Regarde-les bien, tu le reverras bientôt.</div>`}
      <div class="actions" style="justify-content:center;margin-top:14px;">
        <button class="btn" onclick="motSuivant(${juste})">Continuer →</button>
      </div>
    </div>
  </div>`;
}
const motNormalise = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
function motEtape(e) { motState.etape = e; drawMotEtape(); }
function motVerifie() {
  const el = $('#mot-rep');
  motState.reponse = el ? el.value : '';
  motState.etape = 'verif';
  drawMotEtape();
}
async function motSuivant(juste) {
  const S = motState, m = S.mots[S.i];
  if (juste) S.bons++;
  const box = juste ? Math.min(5, (m.box || 1) + 1) : 1;
  const maj = {
    box, due: jourPlus(BOX_JOURS[box] || 1),
    reussites: (m.reussites || 0) + (juste ? 1 : 0),
    echecs: (m.echecs || 0) + (juste ? 0 : 1),
    updated_at: new Date().toISOString(),
  };
  Object.assign(m, maj);
  const { error } = await db.from('adalix_mots').update(maj).eq('id', m.id);
  if (error) console.error('mot non mis à jour', error);
  S.i++; S.etape = 'regarde'; S.reponse = '';
  drawMotEtape();
}
function drawMotsFin() {
  const S = motState;
  $('#main').innerHTML = `<div class="narrow"><div class="card" style="text-align:center;">
    <h3>✏️ Terminé</h3>
    <div class="big-score">${S.bons}/${S.mots.length}</div>
    <div style="font-size:14px;margin-bottom:12px;">${S.bons === S.mots.length
      ? 'Tous écrits juste. Ces mots-là sont à toi. 🏆'
      : `${S.bons > 0 ? `${S.bons} mot${S.bons > 1 ? 's' : ''} écrit${S.bons > 1 ? 's' : ''} juste. ` : ''}Les autres reviendront demain — c'est comme ça qu'ils finissent par rester.`}</div>
    <button class="btn" onclick="renderMots()">Mes mots</button>
  </div></div>`;
  motState = null;
}
function quitterMots() { motState = null; lectStop(); renderMots(); }

/* Aligne ce qui a été écrit sur le mot juste, et met en couleur ce qui diffère.
   On montre la bonne orthographe, pas la faute : c'est elle qu'il faut photographier. */
function motDiffHtml(ecrit, correct) {
  const a = String(ecrit || '').toLowerCase(), b = String(correct || '');
  const bb = b.toLowerCase();
  // plus longue sous-séquence commune : les lettres de `b` qui en font partie sont « déjà sues »
  const t = Array.from({ length: a.length + 1 }, () => new Array(bb.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= bb.length; j++) {
      t[i][j] = a[i - 1] === bb[j - 1] ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]);
    }
  }
  const garde = new Array(b.length).fill(false);
  let i = a.length, j = bb.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === bb[j - 1]) { garde[j - 1] = true; i--; j--; }
    else if (t[i - 1][j] >= t[i][j - 1]) i--;
    else j--;
  }
  return b.split('').map((c, k) => garde[k] ? esc(c) : `<span class="lettre-diff">${esc(c)}</span>`).join('');
}

/* ---------- dictées ---------- */
let dicteeState = null;

function openDicteeMenu() {
  const n = motsList.filter(m => m.statut === 'actif').length;
  modal(`<h3>📣 Une dictée</h3>
    <p style="font-size:13.5px;color:#666;">Je prépare un petit texte${n ? ' autour des mots de ton carnet' : ''}, je te le lis, tu l'écris. Ensuite on regarde ensemble ce qui a bougé.</p>
    <div class="actions" style="flex-wrap:wrap;">
      <button class="btn" onclick="startDictee(2)">Très courte</button>
      <button class="btn" onclick="startDictee(3)">Courte</button>
      <button class="btn" onclick="startDictee(5)">Normale</button>
    </div>
    <div class="actions"><button class="btn ghost" onclick="closeModal()">Annuler</button></div>`);
}

async function startDictee(longueur) {
  closeModal();
  $('#main').innerHTML = '<div class="card">📣 Je prépare ta dictée…</div>';
  const mots = motsList.filter(m => m.statut === 'actif' && m.box <= 3)
    .slice(0, 10).map(m => ({ mot: m.mot, erreur: m.erreur }));
  const j = await callCours({
    mode: 'dictee', longueur, mots,
    cours: coursCur ? { titre: coursCur.titre, resume: coursCur.resume } : undefined,
  });
  if (!j) { renderMots(); return; }
  if (j.error || !j.dictee) { toast(j.error || 'Échec'); renderMots(); return; }
  dicteeState = { d: j.dictee, reponse: '', res: null };
  drawDictee();
}

function drawDictee() {
  const S = dicteeState;
  if (S.res) return drawDicteeCorrige();
  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn" onclick="quitterDictee()">← Arrêter</button>
    <div class="card">
      <h3>📣 ${esc(S.d.titre)}</h3>
      <div style="font-size:13px;opacity:.75;">Écoute, puis écris. Tu peux réécouter autant de fois que tu veux, et ralentir.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button class="btn" id="dict-play" onclick="dicteeEcoute()">${lectDispo() ? '🔊 Écouter' : '🔇 Voix indisponible'}</button>
        <button class="btn ghost" onclick="dicteeVitesse()">🐢 Vitesse : ${lectPref.vitesse.toFixed(1)}×</button>
      </div>
      <textarea id="dict-rep" rows="7" placeholder="Écris la dictée ici…" autocapitalize="sentences" autocomplete="off"
        autocorrect="off" spellcheck="false" style="margin-top:12px;font-size:17px;line-height:1.8;">${esc(S.reponse)}</textarea>
      <div style="font-size:12px;opacity:.6;">La correction automatique est désactivée : sinon elle écrirait à ta place.</div>
      <div class="actions"><button class="btn" id="dict-go" onclick="dicteeCorrige()">✅ J'ai fini</button></div>
    </div>
  </div>`;
}
function dicteeEcoute() {
  const S = dicteeState;
  const ta = $('#dict-rep'); if (ta) S.reponse = ta.value;   // on ne perd pas ce qui est écrit
  if (lectEnCours) { lectStop(); const b = $('#dict-play'); if (b) b.innerHTML = '🔊 Écouter'; return; }
  const ok = lectDire(S.d.a_dire, null, () => { const b = $('#dict-play'); if (b) b.innerHTML = '🔊 Écouter'; });
  const b = $('#dict-play'); if (ok && b) b.innerHTML = '⏸️ Pause';
}
function dicteeVitesse() {
  const ta = $('#dict-rep'); if (ta) dicteeState.reponse = ta.value;
  lectPref.vitesse = lectPref.vitesse <= 0.6 ? 1.1 : Math.round((lectPref.vitesse - 0.2) * 10) / 10;
  lectSavePref(); lectStop(); drawDictee();
}

async function dicteeCorrige() {
  const S = dicteeState;
  const ta = $('#dict-rep'); if (ta) S.reponse = ta.value;
  if (!S.reponse.trim()) { toast("Écris d'abord la dictée !"); return; }
  lectStop();
  const btn = $('#dict-go'); if (btn) { btn.disabled = true; btn.textContent = '✅ Correction…'; }
  const j = await callCours({ mode: 'corriger_dictee', attendu: S.d.texte, reponse: S.reponse });
  if (btn) { btn.disabled = false; btn.textContent = "✅ J'ai fini"; }
  if (!j) return;
  if (j.error || !j.fautes) { toast(j.error || 'Correction impossible'); return; }
  S.res = j;

  await db.from('adalix_dictees').insert({
    child, cours_id: (coursCur && coursCur.id) || null, titre: S.d.titre,
    texte: S.d.texte, reponse: S.reponse, score: j.justes, total: j.total, fautes: j.fautes,
  });
  // les mots fautifs rejoignent le carnet, déjà validés : ici il n'y a pas de doute de lecture
  const aAjouter = j.fautes.filter(f => f.attendu && f.ecrit && f.type !== 'autre')
    .map(f => ({ correct: f.attendu, ecrit: f.ecrit, type: f.type, syllabes: f.syllabes }));
  if (aAjouter.length) { await motsAjoute(aAjouter, 'dictee', null, 'actif'); await loadMots(); }
  drawDictee();
}

const TYPE_LABEL = {
  phonetique: { emoji: '👂', nom: 'Ça ne se lit pas comme ça', aide: "Le mot écrit ne peut pas se prononcer comme le mot attendu." },
  grammatical: { emoji: '🔗', nom: 'Accord ou conjugaison', aide: "C'est une règle, pas une mémoire : elle se retrouve en réfléchissant." },
  visuel: { emoji: '📷', nom: 'La forme du mot', aide: "Ça s'entend juste, mais le mot ne s'écrit pas comme ça — à photographier." },
  autre: { emoji: '✏️', nom: 'Ponctuation et majuscules', aide: '' },
};

function drawDicteeCorrige() {
  const S = dicteeState, r = S.res;
  const parType = {};
  r.fautes.forEach(f => { (parType[f.type] = parType[f.type] || []).push(f); });
  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn no-print" onclick="quitterDictee()">← Mes mots</button>
    <div class="card" style="text-align:center;">
      <h3>📣 ${esc(S.d.titre)}</h3>
      <div class="big-score">${r.justes} mots justes</div>
      ${r.commentaire ? `<div style="font-size:14.5px;line-height:1.55;">${esc(r.commentaire)}</div>` : ''}
    </div>
    ${r.fautes.length ? Object.keys(parType).map(t => {
      const T = TYPE_LABEL[t] || TYPE_LABEL.autre;
      return `<div class="card">
        <h3>${T.emoji} ${T.nom}</h3>
        ${T.aide ? `<div style="font-size:12.5px;opacity:.7;margin-bottom:8px;">${T.aide}</div>` : ''}
        ${parType[t].map(f => `<div class="mot-ligne" style="display:block;">
          <div class="mot-correct" style="font-size:19px;">${syllabesHtml(f.attendu, f.syllabes)}</div>
          ${f.ecrit ? `<div class="mot-erreur">tu avais écrit : ${esc(f.ecrit)}</div>` : '<div class="mot-erreur">tu l\'avais oublié</div>'}
          ${f.explication ? `<div style="font-size:13.5px;margin-top:4px;line-height:1.5;">${esc(f.explication)}</div>` : ''}
        </div>`).join('')}
      </div>`;
    }).join('') : `<div class="card" style="text-align:center;"><div style="font-size:40px;">🏆</div>
      <div style="font-size:15px;margin-top:6px;">Pas un mot à reprendre. Bravo !</div></div>`}
    <div class="card no-print" style="text-align:center;">
      <div style="font-size:13px;opacity:.75;margin-bottom:10px;">Les mots repris sont allés dans ton carnet — tu les reverras dans quelques jours.</div>
      <button class="btn" onclick="openDicteeMenu()">📣 Une autre dictée</button>
      <button class="btn ghost" onclick="quitterDictee()">Mes mots</button>
    </div>
  </div>`;
}
function quitterDictee() { dicteeState = null; lectStop(); renderMots(); }

/* ---------- récapitulatif pour le tableau de bord parent ---------- */
async function fillMotsParentCard() {
  const el = $('#mots-parent-card'); if (!el) return;
  const [mots, dictees] = await Promise.all([
    db.from('adalix_mots').select('*'),
    db.from('adalix_dictees').select('child,titre,score,total,fautes,created_at').order('created_at', { ascending: false }).limit(40),
  ]);
  const M = mots.data || [], D2 = dictees.data || [];
  if (!M.length && !D2.length) { el.innerHTML = ''; return; }

  const kids = ['adam', 'alix'];
  const nom = k => k === 'adam' ? '🐉 Adam' : '🦊 Alix';
  el.innerHTML = `<div class="card"><h3>✏️ Orthographe — ce qui revient</h3>
    ${kids.map(k => {
      const ms = M.filter(m => m.child === k && m.statut !== 'ecarte');
      const ds = D2.filter(d => d.child === k);
      if (!ms.length && !ds.length) return `<div class="jentry"><div class="jd">${nom(k)}</div><span style="color:#999;font-size:13px;">Rien encore</span></div>`;
      const fautes = ds.reduce((a, d) => a.concat(Array.isArray(d.fautes) ? d.fautes : []), []);
      const parType = {};
      fautes.forEach(f => { parType[f.type] = (parType[f.type] || 0) + 1; });
      ms.forEach(m => { if (m.source === 'cours') parType[m.type] = (parType[m.type] || 0) + 1; });
      const total = Object.values(parType).reduce((a, b) => a + b, 0);
      const ordre = Object.keys(parType).sort((a, b) => parType[b] - parType[a]);
      const resistants = ms.filter(m => m.echecs >= 2 && m.box <= 2).slice(0, 8);
      const gagnes = ms.filter(m => m.box >= 4).length;
      return `<div class="jentry">
        <div class="jd">${nom(k)}</div>
        <div style="font-size:13.5px;"><b>${ms.length}</b> mots au carnet dont <b>${gagnes}</b> acquis · <b>${ds.length}</b> dictée${ds.length > 1 ? 's' : ''}</div>
        ${total ? `<div style="margin-top:6px;">${ordre.map(t => {
          const T = TYPE_LABEL[t] || TYPE_LABEL.autre;
          const pct = Math.round(parType[t] / total * 100);
          return `<div style="display:flex;align-items:center;gap:8px;margin-top:3px;">
            <div style="width:170px;font-size:12.5px;">${T.emoji} ${T.nom}</div>
            <div style="flex:1;height:10px;background:#eceef3;border-radius:6px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:var(--accent);"></div></div>
            <div style="width:42px;text-align:right;font-size:12px;color:#888;">${pct} %</div></div>`;
        }).join('')}</div>` : ''}
        ${resistants.length ? `<div style="font-size:13px;margin-top:6px;color:#a8500f;">Mots qui résistent : ${resistants.map(m => esc(m.mot)).join(', ')}</div>` : ''}
      </div>`;
    }).join('')}
    <div class="actions" style="margin-top:4px;"><button class="btn ghost" onclick="openRecapOrtho()">🖨️ Récapitulatif imprimable</button></div>
    <div style="font-size:12px;color:#999;margin-top:6px;">Ce relevé décrit des observations d'usage dans l'application. Ce n'est pas un bilan : seul un orthophoniste peut en poser un.</div>
  </div>`;
}

/* Une page propre à emporter — les observations concrètes qu'on demande toujours
   au premier rendez-vous, et dont on ne se souvient jamais sur le moment. */
async function openRecapOrtho() {
  $('#main').innerHTML = '<div class="card">Préparation…</div>';
  const [mots, dictees] = await Promise.all([
    db.from('adalix_mots').select('*').order('created_at', { ascending: true }),
    db.from('adalix_dictees').select('*').order('created_at', { ascending: true }),
  ]);
  const M = (mots.data || []).filter(m => m.statut !== 'ecarte');
  const D2 = dictees.data || [];
  const kids = ['adam', 'alix'].filter(k => M.some(m => m.child === k) || D2.some(d => d.child === k));
  const fr = d => new Date(d).toLocaleDateString('fr-FR');

  $('#main').innerHTML = `<div class="narrow">
    <button class="back-btn no-print" onclick="renderDashboard()">← Tableau de bord</button>
    <div class="card no-print" style="text-align:center;">
      <button class="btn" onclick="window.print()">🖨️ Imprimer</button>
    </div>
    ${kids.map(k => {
      const ms = M.filter(m => m.child === k);
      const ds = D2.filter(d => d.child === k);
      const dates = ms.concat(ds).map(x => x.created_at).sort();
      const fautes = ds.reduce((a, d) => a.concat(Array.isArray(d.fautes) ? d.fautes : []), []);
      const parType = {};
      fautes.forEach(f => { (parType[f.type] = parType[f.type] || []).push(f); });
      ms.filter(m => m.source === 'cours' && m.erreur).forEach(m => {
        (parType[m.type] = parType[m.type] || []).push({ attendu: m.mot, ecrit: m.erreur, type: m.type });
      });
      const total = Object.values(parType).reduce((a, b) => a + b.length, 0);
      return `<div class="card">
        <h3>Relevé d'orthographe — ${k === 'adam' ? 'Adam' : 'Alix'}</h3>
        <div style="font-size:13px;opacity:.75;">Observations recueillies dans l'application${dates.length ? ` du ${fr(dates[0])} au ${fr(dates[dates.length - 1])}` : ''} · ${ds.length} dictée${ds.length > 1 ? 's' : ''}, ${ms.length} mots relevés.</div>
        <div class="cours-md"><h4>Répartition des erreurs</h4></div>
        ${total ? Object.keys(parType).sort((a, b) => parType[b].length - parType[a].length).map(t => {
          const T = TYPE_LABEL[t] || TYPE_LABEL.autre;
          const ex = parType[t].filter(f => f.ecrit).slice(0, 6);
          return `<div style="margin-bottom:10px;">
            <div style="font-size:14px;font-weight:700;">${T.nom} — ${parType[t].length} sur ${total} (${Math.round(parType[t].length / total * 100)} %)</div>
            ${ex.length ? `<div style="font-size:13px;opacity:.85;margin-top:2px;">Exemples : ${ex.map(f => `<i>${esc(f.ecrit)}</i> pour « ${esc(f.attendu)} »`).join(' · ')}</div>` : ''}
          </div>`;
        }).join('') : '<div style="font-size:13.5px;opacity:.7;">Pas encore assez d\'éléments.</div>'}
        <div class="cours-md"><h4>Mots travaillés sans succès durable</h4></div>
        <div style="font-size:13.5px;line-height:1.7;">${ms.filter(m => m.echecs >= 2).map(m => `${esc(m.mot)} (${m.echecs} échecs)`).join(' · ') || 'Aucun pour l\'instant.'}</div>
        <div class="cours-md"><h4>Mots acquis</h4></div>
        <div style="font-size:13.5px;line-height:1.7;">${ms.filter(m => m.box >= 4).map(m => esc(m.mot)).join(' · ') || 'Aucun pour l\'instant.'}</div>
        ${ds.length ? `<div class="cours-md"><h4>Dictées</h4></div>
        <div style="font-size:13.5px;line-height:1.7;">${ds.slice(-10).map(d => `${fr(d.created_at)} — « ${esc(d.titre)} » : ${d.score}/${d.total} mots justes`).join('<br>')}</div>` : ''}
        <div style="font-size:12px;opacity:.7;margin-top:14px;border-top:1px solid rgba(0,0,0,.1);padding-top:8px;">
          Document produit automatiquement à partir des exercices faits dans l'application familiale.
          Il décrit des observations d'usage, il ne constitue en aucun cas un bilan ni un diagnostic.
        </div>
      </div>`;
    }).join('') || '<div class="card">Aucune donnée pour l\'instant.</div>'}
  </div>`;
}
