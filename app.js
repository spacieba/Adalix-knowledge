/* Adalix Knowledge — app.js */
const SUPA_URL = 'https://qntpdaakdqaysxbeugxk.supabase.co';
const SUPA_KEY = 'sb_publishable_0m2Hob3cSEFz8UzLJrwBhw_AuW3EIOB';
const PARENT_PIN = '2026';
const db = window.supabase.createClient(SUPA_URL, SUPA_KEY);
const D = window.DATA;

let child = null;          // 'adam' | 'alix' | 'parent'
let tab = 'programme';
let unlocked = new Set();  // person names
let chatMsgs = [];         // {role, content}
let currentWeek = 0;
let assistantName = null;
let childProfile = '';
const MAX_NEW_PERSONS_PER_DAY = 3;
let earnedBadges = new Set();
let pendingRareBadges = [];

/* ---------- utils ---------- */
const $ = sel => document.querySelector(sel);
const esc = s => (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const todayStr = () => new Date().toISOString().slice(0,10);
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2500); }
function modal(html){ $('#modal-root').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`; }
function closeModal(){ $('#modal-root').innerHTML=''; }

/* ---------- profile ---------- */
function selectProfile(c){
  child = c;
  document.body.className = 'theme-' + c;
  $('#screen-profile').classList.add('hidden');
  $('#screen-app').classList.remove('hidden');
  $('#hdr-who').textContent = c === 'adam' ? '🐉 Adam' : '🦊 Alix';
  localStorage.setItem('adalix_child', c);
  buildNav(['programme','quiz','geo','les100','checklist','projet','fabrique','chat','guide']);
  assistantName = null;
  fabMsgs = []; fabCode = ''; fabUrl = ''; fabLoaded = false; fabStep = 0;
  loadUnlocked(); refreshStreak(); loadAssistantName();
  loadBadges().then(checkBadges);
  showTab('programme');
}
async function loadAssistantName(){
  const {data} = await db.from('adalix_assistant').select('name').eq('child',child).maybeSingle();
  assistantName = (data && data.name) || null;
  const {data: prof} = await db.from('adalix_profiles').select('profile').eq('child',child).maybeSingle();
  childProfile = (prof && prof.profile) || '';
}
function askParentPin(){
  modal(`<h3>Espace parent</h3><p style="font-size:14px;">Code d'accès :</p>
    <input type="password" id="pin-input" inputmode="numeric">
    <div class="actions"><button class="btn" onclick="checkPin()">Entrer</button><button class="btn ghost" onclick="closeModal()">Annuler</button></div>`);
  setTimeout(()=>$('#pin-input').focus(),50);
}
function checkPin(){
  if($('#pin-input').value === PARENT_PIN){
    closeModal(); child='parent';
    document.body.className='theme-parent';
    $('#screen-profile').classList.add('hidden');
    $('#screen-app').classList.remove('hidden');
    $('#hdr-who').textContent='📊 Espace parent';
    $('#hdr-streak').style.display='none';
    $('#hdr-badges').style.display='none';
    buildNav(['dashboard']);
    showTab('dashboard');
  } else { toast('Code incorrect'); }
}
function logout(){ location.reload(); }

/* ---------- nav ---------- */
const TABS = {
  programme:{icon:'📅',label:'Programme'}, quiz:{icon:'🧠',label:'Quiz'}, geo:{icon:'🌍',label:'Jeux géo'},
  les100:{icon:'🏆',label:'Les 100'}, checklist:{icon:'✅',label:'Checklist'},
  projet:{icon:'💻',label:'Mon projet'}, fabrique:{icon:'🏭',label:'Fabrique'},
  chat:{icon:'💬',label:'Questions'}, guide:{icon:'📖',label:'Guide'}, dashboard:{icon:'📊',label:'Tableau de bord'},
};
// icônes réhabillées selon le profil — mêmes intitulés, juste l'esprit visuel qui change
const THEME_ICONS = {
  adam: {programme:'🗺️', quiz:'🐲', geo:'🌍', les100:'🏆', checklist:'📜', projet:'⚒️', fabrique:'🏭', chat:'🔮', guide:'🧭'},
  alix: {programme:'🌿', quiz:'🦊', geo:'🌍', les100:'🦋', checklist:'🐣', projet:'🎨', fabrique:'🏭', chat:'🐰', guide:'📖'},
};
function tabIcon(t){ return (THEME_ICONS[child] && THEME_ICONS[child][t]) || TABS[t].icon; }
function buildNav(tabs){
  $('#navbar').innerHTML = tabs.map(t=>`<button id="nav-${t}" onclick="showTab('${t}')">${tabIcon(t)} ${TABS[t].label}</button>`).join('');
}
function showTab(t){
  tab = t;
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  const nb = $('#nav-'+t); if(nb) nb.classList.add('active');
  ({programme:renderProgramme, quiz:renderQuizList, geo:renderGeo, les100:renderGallery, checklist:renderChecklist, projet:renderProjet, fabrique:renderFabrique, chat:renderChat, guide:renderGuide, dashboard:renderDashboard}[t])();
}

/* ---------- guide ---------- */
function renderGuide(){
  const gcard = (emoji, titre, html) => `<div class="card"><h3>${emoji} ${titre}</h3><div style="font-size:14px;line-height:1.6;">${html}</div></div>`;
  $('#main').innerHTML = `<div class="narrow">
    ${gcard('🌞', 'Bienvenue dans Le Grand Été',
      `Quatre semaines, du 27 juillet au 22 août, pour apprendre autrement : pas de notes, pas de profs — juste toi, des idées passionnantes, et environ 1h à 1h30 par jour. L'app s'ouvre chaque matin sur <b>le programme du jour</b> : tout ce qu'il y a à faire est sur cette page, dans l'ordre. Six jours par semaine, repos le dimanche. Chaque semaine a son grand thème : <b>S1 douter et vérifier</b>, <b>S2 raconter et convaincre</b>, <b>S3 comprendre les mécanismes</b>, <b>S4 penser par toi-même</b>.`)}
    ${gcard('📅', "L'onglet Programme",
      `Le cœur de l'app. Chaque jour a son thème : <b>lundi</b> géographie, <b>mardi</b> « Qui écrit l'histoire ? », <b>mercredi</b> économie, <b>jeudi</b> géopolitique ou religions, <b>vendredi</b> maths curieuses + ton exposé, <b>samedi</b> esprit critique. Sur la fiche du jour tu trouves : le sujet expliqué, <b>le déroulé</b> (les étapes concrètes, avec les durées), la consigne d'écriture du soir, des liens à explorer et des personnalités en rapport avec le thème.`)}
    ${gcard('🧠', 'Pourquoi la logique et la rhétorique ? (le fil rouge le plus important)',
      `Chaque jour, une notion de <b>logique</b> ou de <b>rhétorique</b>. Pourquoi ? Parce que ce sont les armes de l'esprit.<br><br>
      La <b>rhétorique</b>, c'est l'art de convaincre — inventé par les Grecs il y a 2500 ans. Ceux qui la maîtrisent mènent les débats, décrochent les jobs, défendent leurs idées ; ceux qui l'ignorent se font mener. Elle te servira dans tes exposés du vendredi, à l'école, et toute ta vie. Mais surtout : connaître les techniques de persuasion, c'est <b>reconnaître quand on les utilise contre toi</b> — dans une pub, une vidéo, un discours.<br><br>
      La <b>logique</b>, c'est le solfège de la pensée : savoir distinguer un raisonnement qui tient debout d'un raisonnement qui triche (les fameux <b>sophismes</b> — homme de paille, faux dilemme, appel à la popularité…). Une fois que tu sais les nommer, tu les vois PARTOUT. Personne ne pourra plus te vendre n'importe quoi.<br><br>
      Les samedis « esprit critique » assemblent le tout : démonter un complot, détecter les sophismes, vérifier une info comme un pro.`)}
    ${gcard('🤖', "Le fil rouge « IA du jour »",
      `Chaque jour aussi, une notion sur l'intelligence artificielle. En 24 jours tu sauras : d'où vient l'IA (Turing 1950, Dartmouth 1956), comment fonctionne vraiment un assistant comme celui de l'onglet Questions, pourquoi il peut se tromper, ce que l'IA peut apporter à l'humanité (médecine, science, climat), quels métiers elle menace, lesquels elle va créer — et comment garder ton cerveau aux commandes. Tu vis la révolution de TON siècle : autant la comprendre de l'intérieur.`)}
    ${gcard('🧠', "L'onglet Quiz",
      `Un QCM par semaine (13 questions sur tout ce que tu as vu, dont 3 sur l'IA) — objectif : <b>70% minimum</b>, tu peux rejouer autant que tu veux. Le <b>quiz des capitales</b> (20 questions, difficulté croissante) se joue dès le premier lundi — note ton score, tu le rejoueras en fin de mois pour mesurer tes progrès. Et le dernier samedi : le <b>grand quiz final</b>, 20 questions piochées dans tout le mois. Tous tes scores sont enregistrés.`)}
    ${gcard('🌍', "L'onglet Jeux géo",
      `Douze jeux de géographie à records : cliquer les <b>pays</b> (Europe, monde, Union européenne), les <b>régions</b> et <b>départements</b> français, placer les <b>villes</b> (France, Europe, monde, USA) au kilomètre près, la <b>géo physique</b> (Everest, Amazone, Sahara…), les <b>capitales</b> et les <b>drapeaux</b>. Chaque jeu affiche TON record et celui d’${child==='adam'?'Alix':'Adam'} — le petit 🔥 signale qu'il faut reprendre la couronne !`)}
    ${gcard('🏆', "L'onglet Les 100 — ta collection",
      `103 personnalités qui ont changé le monde : scientifiques, résistants, artistes, sportifs, explorateurs… <b>C'est toi qui choisis</b> qui découvrir : parcours la galerie, clique sur les cartes qui t'intriguent. Tu peux en ajouter <b>3 nouvelles par jour</b> à ta collection (la lecture, elle, est illimitée). Chaque fiche propose un lien vidéo vers la chaîne <b>« Quelle Histoire »</b> pour aller plus loin. La fiche du jour te suggère des personnalités en lien avec le thème, mais rien n'est imposé. Objectif du mois : la collection complète ?`)}
    ${gcard('✅', "L'onglet Checklist",
      `Tes 12 gestes quotidiens : lit fait, lecture, balade, programme du jour, projet, écriture du soir… Chaque journée complète allume ta série 🔥 en haut de l'écran. L'<b>écriture du soir</b> (ce que j'ai appris / ce qui m'a étonné) construit jour après jour ton journal du mois — tu seras fier(e) de le relire en septembre.`)}
    ${gcard('💻', "L'onglet Mon projet",
      `Un vrai projet personnel, mené sur tout le mois, <b>guidé jour par jour</b> : chaque jour, l'app te donne l'étape à faire. Semaine 1 : tu ne fabriques rien — tu <b>brainstormes avec ton assistant</b>, tu choisis ton idée et tu poses ton plan. Semaine 2 : première version complète, même moche. Semaine 3 : amélioration et finitions. Semaine 4 : préparation de la présentation. Le <b>rendu final</b> se montre à la fête du 22 août, avec une mini-présentation de 2-3 minutes. Six idées te sont proposées, mais tu peux inventer la tienne.`)}
    ${gcard('🏭', "L'onglet Fabrique — ton atelier de création",
      `Le grand atelier : tu y fabriques une <b>vraie page web</b> avec le Bâtisseur, une IA spécialisée dans la construction. Cinq étapes de pro : imagine, fabrique (par petites améliorations successives), teste, <b>publie ton code sur GitHub</b> — le coffre-fort mondial du code — et ta page est mise <b>en ligne sur le vrai internet</b>, avec un lien à partager. C'est l'endroit idéal pour construire ton projet du mois s'il est numérique. Tu peux même regarder et modifier le code toi-même (bouton « Voir le code »).`)}
    ${gcard('💬', "L'onglet Questions",
      `Ton assistant IA personnel — c'est toi qui l'as baptisé ! Pose-lui TOUTES tes questions : un mot compliqué, un point d'histoire, une idée d'exposé. Règle d'or (tu la verras dans le fil IA) : utilise-le pour <b>comprendre plus</b>, jamais pour réfléchir à ta place. Il y a aussi l'atelier d'images pour illustrer tes projets et exposés.`)}
    ${gcard('🎤', "Les exposés du vendredi",
      `Chaque vendredi, 5 à 10 minutes devant la famille, avec un support créé avec les outils de la semaine. La règle du jeu : le thème est <b>au choix, mais connexe à quelque chose vu dans la semaine</b> — et tu <b>brainstormes d'abord tes idées avec ton assistant</b> avant de choisir. Un outil différent chaque semaine, avec son mode d'emploi sur la page du vendredi : <b>Gamma</b> (S1), <b>Claude</b> (S2), <b>Canva</b> (S3), <b>PowerPoint et son IA</b> (S4). La recette apprise en rhétorique : une <b>accroche</b>, <b>3 idées</b>, une <b>chute</b>. Après ton passage, papa note ton exposé (étoiles + commentaire) — tu verras son avis apparaître sur la page du jour. Le dernier samedi : l'exposé final, le grand quiz… et la fête !`)}
    ${gcard('🎖️', 'Les badges',
      `18 badges à débloquer (bouton en haut de l'écran) : assiduité, savoir, collection, créativité, curiosité, discipline. Trois sont rares et déclenchent une vraie célébration. Ils se débloquent tout seuls au fil de tes actions.`)}
    ${gcard('💛', 'Le mot de la fin',
      `Ce programme n'est pas une école bis : c'est TON été. Avance à ton rythme, creuse ce qui te passionne, saute ce qui t'ennuie un jour et reviens-y le lendemain. La seule vraie règle : rester curieux — et garder ton esprit critique allumé, même (surtout !) face à cette app.`)}
  </div>`;
}

/* ---------- exposés ---------- */
const EXPOSES = [
  {num:1, wi:0, di:4, label:'Exposé n°1', date:'ven 31/07'},
  {num:2, wi:1, di:4, label:'Exposé n°2', date:'ven 07/08'},
  {num:3, wi:2, di:4, label:'Exposé n°3', date:'ven 14/08'},
  {num:4, wi:3, di:5, label:'Exposé final', date:'sam 22/08'},
];
function exposeNumFor(wi, di){ const e = EXPOSES.find(x=>x.wi===wi && x.di===di); return e ? e.num : null; }

/* ---------- programme ---------- */
function dayDate(d){ const [dd,mm] = d.date.split('/').map(Number); return new Date(2026, mm-1, dd); }
// Trouve le jour du programme correspondant à aujourd'hui.
// Retourne {wi, di, banner} ou null (programme terminé → vue d'ensemble).
function todayInProgramme(){
  const now = new Date(); now.setHours(0,0,0,0);
  let exact = null, next = null, last = null;
  D.weeks.forEach((w,wi)=>w.days.forEach((d,di)=>{
    const t = dayDate(d).getTime();
    last = {wi, di, t};
    if(t === now.getTime()) exact = {wi, di};
    if(!next && t > now.getTime()) next = {wi, di, t};
  }));
  if(exact) return {...exact, today:true, banner:null};
  if(next){
    const isBefore = dayDate(D.weeks[0].days[0]).getTime() > now.getTime();
    return {...next, today:false, banner: isBefore
      ? "🌞 Le programme commence bientôt — le voici en avant-première !"
      : "😴 Aujourd'hui c'est dimanche, repos ! Voici ce qui t'attend demain."};
  }
  return null; // programme terminé
}
function renderProgramme(overview){
  if(!overview){
    const t = todayInProgramme();
    if(t){ currentWeek = t.wi; renderDay(t.wi, t.di, t); return; }
  }
  const t = todayInProgramme();
  const w = D.weeks[currentWeek];
  $('#main').innerHTML = `
    ${t ? `<div style="margin-bottom:12px;"><button class="btn" onclick="renderProgramme()">📍 Revenir à aujourd'hui</button></div>` : ''}
    <div class="week-pills">${D.weeks.map((wk,i)=>`<button class="${i===currentWeek?'active':''}" onclick="currentWeek=${i};renderProgramme(true)">S${wk.num}</button>`).join('')}</div>
    <div class="card"><h3>Semaine ${w.num} — ${esc(w.title)}</h3><div style="font-size:13px;color:#888;">${esc(w.dates)}</div></div>
    <div class="day-list">${w.days.map((d,i)=>{
      const isToday = t && t.today && t.wi===currentWeek && t.di===i;
      return `<div class="day-item" style="${isToday?'border-left-color:#c98f2f;background:#fdf6ec;':''}" onclick="renderDay(${currentWeek},${i})">
      <div class="emoji">${d.emoji}</div>
      <div><div class="di-title">${esc(d.title)}${isToday?' <span style="font-size:11px;background:#c98f2f;color:white;border-radius:10px;padding:2px 8px;vertical-align:middle;">📍 AUJOURD’HUI</span>':''}</div><div class="di-sub">${esc(d.dow)} ${esc(d.date)} · ${esc(d.theme)}</div></div>
    </div>`;}).join('')}</div>`;
}
function renderCases(cases){
  if(!cases || !cases.length) return '';
  return cases.map(c=>`
    <div class="card" style="${c.sensible?'border-left:4px solid #c9636a;':''}">
      <h3>${c.emoji} ${esc(c.titre)}</h3>
      ${c.sensible?'<div style="font-size:12px;color:#b04a4a;font-weight:700;margin-bottom:4px;">👪 Sujet sensible — à lire avec un parent</div>':''}
      <p style="font-size:14px;line-height:1.55;"><b>D'où ça vient ?</b> ${esc(c.origine)}</p>
      <div style="margin-top:8px;">${c.arguments.map(a=>`
        <div style="margin-bottom:8px;padding:8px 10px;background:#f7f8fb;border-radius:8px;">
          <div style="font-size:13.5px;font-weight:700;">💬 ${esc(a.a)}</div>
          <div style="font-size:13.5px;color:#444;margin-top:3px;">↳ ${esc(a.r)}</div>
        </div>`).join('')}</div>
      <p style="font-size:13.5px;line-height:1.5;color:#555;margin-top:6px;"><b>Pourquoi ça marche quand même ?</b> ${esc(c.psycho)}</p>
    </div>`).join('');
}
async function renderDay(wi, di, ctx){
  const d = D.weeks[wi].days[di];
  const idx = wi*6 + di;
  const prev = idx > 0 ? {wi: Math.floor((idx-1)/6), di: (idx-1)%6} : null;
  const next = idx < 23 ? {wi: Math.floor((idx+1)/6), di: (idx+1)%6} : null;
  const pd = prev ? D.weeks[prev.wi].days[prev.di] : null;
  const nd = next ? D.weeks[next.wi].days[next.di] : null;
  const dayNav = `<div style="display:flex;gap:10px;justify-content:space-between;margin:14px 0 4px;">
    ${pd?`<button class="btn ghost" style="font-size:12.5px;" onclick="renderDay(${prev.wi},${prev.di})">◀ ${esc(pd.dow)} ${esc(pd.date)}</button>`:'<span></span>'}
    ${nd?`<button class="btn ghost" style="font-size:12.5px;" onclick="renderDay(${next.wi},${next.di})">${esc(nd.dow)} ${esc(nd.date)} ▶</button>`:'<span></span>'}
  </div>`;
  const remaining = child==='parent' ? MAX_NEW_PERSONS_PER_DAY : Math.max(0, MAX_NEW_PERSONS_PER_DAY - await countUnlockedToday());
  const expoNum = exposeNumFor(wi, di);
  let expoNoteHtml = '';
  if(expoNum && child!=='parent'){
    const {data:en} = await db.from('adalix_expose_notes').select('*').eq('child',child).eq('expose_num',expoNum).maybeSingle();
    if(en){
      expoNoteHtml = `<div class="card" style="border-left:4px solid #c98f2f;">
        <h3>⭐ L'avis du parent sur ton exposé</h3>
        <div style="font-size:24px;letter-spacing:4px;color:#c98f2f;">${'★'.repeat(en.stars)}<span style="color:#ccd4e0;">${'★'.repeat(5-en.stars)}</span></div>
        ${en.comment?`<p style="font-size:14px;line-height:1.55;">${esc(en.comment)}</p>`:''}
      </div>`;
    }
  }
  $('#main').innerHTML = `
    <div class="narrow">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      ${ctx && ctx.today ? `<div style="font-weight:800;color:var(--accent2);font-size:15px;">📍 Aujourd'hui</div>` : `<button class="back-btn" style="margin:0;" onclick="renderProgramme()">📍 Aujourd'hui</button>`}
      <button class="back-btn" style="margin:0;" onclick="currentWeek=${wi};renderProgramme(true)">📅 Tout le programme</button>
    </div>
    ${ctx && ctx.banner ? `<div class="card" style="border-left:4px solid #c98f2f;background:#fdf6ec;"><div style="font-size:14px;">${esc(ctx.banner)}</div></div>` : ''}
    <div class="card day-detail">
      <div class="theme-tag">${esc(d.dow)} ${esc(d.date)} · Semaine ${D.weeks[wi].num} · ${esc(d.theme)}</div>
      <h2>${d.emoji} ${esc(d.title)}</h2>
      <p style="font-size:14.5px;line-height:1.55;">${esc(d.summary)}</p>
      ${d.detail?`<p style="font-size:14px;line-height:1.6;color:#444;">${esc(d.detail)}</p>`:''}
      <div class="ecrit-box"><b>✍️ Écriture :</b> ${esc(d.ecrit)}</div>
    </div>
    ${d.etapes && d.etapes.length ? `<div class="card"><h3>🧭 Le déroulé du jour</h3>
      <ol style="margin:6px 0 2px 20px;padding:0;">${d.etapes.map(e=>`<li style="font-size:14px;line-height:1.55;margin-bottom:8px;">${esc(e)}</li>`).join('')}</ol>
    </div>` : ''}
    ${d.outil ? `<div class="card"><h3>🛠️ L'outil de la semaine : ${esc(d.outil.nom)}</h3>
      <p style="font-size:14px;line-height:1.6;">${esc(d.outil.texte)}</p>
    </div>` : ''}
    ${expoNoteHtml}
    ${renderCases(d.cases)}
    ${D.ia && D.ia[wi*6+di] ? `<div class="card"><h3>🤖 IA du jour</h3>
      <div style="font-size:13px;font-weight:700;color:var(--accent2);margin-bottom:4px;">${esc(D.ia[wi*6+di].titre)}</div>
      <p style="font-size:14px;line-height:1.55;">${esc(D.ia[wi*6+di].texte)}</p>
    </div>` : ''}
    ${d.logique ? `<div class="card"><h3>🧠 Logique & rhétorique du jour</h3>
      <div style="font-size:13px;font-weight:700;color:var(--accent2);margin-bottom:4px;">${esc(d.logique.titre)}</div>
      <p style="font-size:14px;line-height:1.55;">${esc(d.logique.texte)}</p>
    </div>` : ''}
    <div class="card"><h3>🔗 À explorer</h3><div class="links">${d.links.map(l=> l.u && l.u.startsWith('tab:')
      ? `<a href="javascript:void(0)" onclick="showTab('${l.u.slice(4)}')">${esc(l.t)} →</a>`
      : `<a href="${l.u}" target="_blank" rel="noopener">${esc(l.t)} ↗</a>`).join('')}</div></div>
    <div class="card"><h3>👤 Personnalités en lien avec aujourd'hui</h3>
      <div style="font-size:13px;color:#888;">Des suggestions liées au thème du jour — mais c'est toi qui choisis : tu peux préférer n'importe quelle carte de l'onglet « Les 100 ».</div>
      <div style="font-size:12.5px;color:${remaining>0?'#888':'#c9636a'};margin:3px 0 6px;">${remaining>0?`Encore ${remaining} nouvelle${remaining>1?'s':''} carte${remaining>1?'s':''} à collectionner aujourd'hui.`:"Limite du jour atteinte — tu peux encore lire les fiches, la collection continuera demain."}</div>
      <div class="persos-chips">${d.persos.map(p=>`<button class="perso-chip" onclick="openPerson('${esc(p).replace(/'/g,"\\'")}')">${personEmoji(p)} ${esc(p)}</button>`).join('')}</div>
    </div>
    ${dayNav}
    </div>`;
}

/* ---------- persons / gallery ---------- */
function findPerson(name){ return D.persons.find(p=>p.name===name); }
function personEmoji(name){ const p=findPerson(name); return p?p.emoji:'⭐'; }
async function loadUnlocked(){
  if(child==='parent') return;
  const {data} = await db.from('adalix_personalities').select('person').eq('child', child);
  unlocked = new Set((data||[]).map(r=>r.person));
}
async function countUnlockedToday(){
  if(child==='parent') return 0;
  const start = new Date(); start.setHours(0,0,0,0);
  const {data} = await db.from('adalix_personalities').select('created_at').eq('child',child).gte('created_at', start.toISOString());
  return (data||[]).length;
}
async function openPerson(name){
  const p = findPerson(name);
  if(!p){ toast('Fiche à venir !'); return; }
  const isNew = !unlocked.has(name);
  let capped = false;
  if(isNew && child!=='parent'){
    const todayCount = await countUnlockedToday();
    if(todayCount >= MAX_NEW_PERSONS_PER_DAY){
      capped = true;
    } else {
      unlocked.add(name);
      db.from('adalix_personalities').insert({child, person:name}).then(()=>{ checkBadges(); });
    }
  }
  modal(`<div style="text-align:center;font-size:46px;">${p.emoji}</div>
    <h3 style="text-align:center;">${esc(p.name)}</h3>
    <div style="text-align:center;font-size:12.5px;color:#888;">${esc(p.meta)} · ${p.catEmoji} ${esc(p.cat)}</div>
    <p style="text-align:center;font-weight:700;color:var(--accent2);">« ${esc(p.tagline)} »</p>
    <p style="font-size:14px;line-height:1.5;">${esc(p.desc)}</p>
    <div class="links"><a href="https://www.youtube.com/@QuelleHistoireParis/search?query=${encodeURIComponent(p.name)}" target="_blank" rel="noopener">🎥 Vidéo « Quelle Histoire » sur ${esc(p.name)} ↗</a></div>
    ${isNew && !capped?`<p style="text-align:center;color:#b06a1a;font-weight:700;">🎉 Nouvelle carte débloquée ! (${unlocked.size}/${D.persons.length})</p>`:''}
    ${capped?`<p style="text-align:center;color:#c9636a;font-weight:700;font-size:13px;">🔒 Tu as déjà choisi ${MAX_NEW_PERSONS_PER_DAY} cartes aujourd'hui — reviens demain pour collectionner celle-ci !</p>`:''}
    <div class="actions"><button class="btn" onclick="closeModal();if(tab==='les100')renderGallery();">Fermer</button></div>`);
}
let galFilter = 'all';
function renderGallery(){
  const cats = [...new Set(D.persons.map(p=>p.cat))];
  const shown = D.persons.filter(p=>galFilter==='all'||p.cat===galFilter);
  $('#main').innerHTML = `
    <div class="card"><h3>🏆 Ta collection : ${unlocked.size} / ${D.persons.length}</h3>
      <div style="font-size:13px;color:#888;">C'est toi qui choisis ! Parcours la galerie, clique sur les personnalités qui t'intriguent — tu peux en ajouter ${MAX_NEW_PERSONS_PER_DAY} nouvelles par jour à ta collection (et tout relire à volonté).</div></div>
    <div class="gal-filter"><button class="${galFilter==='all'?'active':''}" onclick="galFilter='all';renderGallery()">Toutes</button>
      ${cats.map(c=>`<button class="${galFilter===c?'active':''}" onclick="galFilter='${esc(c).replace(/'/g,"\\'")}';renderGallery()">${esc(c)}</button>`).join('')}</div>
    <div class="gal-grid2">${shown.map(p=>{
      const un = unlocked.has(p.name);
      return un
        ? `<div class="pcard" onclick="openPerson('${esc(p.name).replace(/'/g,"\\'")}')"><div class="pe">${p.emoji}</div><div class="pn">${esc(p.name)}</div><div class="pt2">${esc(p.tagline)}</div></div>`
        : `<div class="pcard locked" onclick="openPerson('${esc(p.name).replace(/'/g,"\\'")}')"><div class="pe">${p.catEmoji}</div><div class="pn">${esc(p.name)}</div><div class="pt2">${esc(p.meta)}</div></div>`;
    }).join('')}</div>`;
}

/* ---------- quiz ---------- */
let quizState = null;
function renderQuizList(){
  $('#main').innerHTML = `
    <div class="card"><h3>🧠 Les quiz du Grand Été</h3><div style="font-size:13px;color:#888;">Chronométré, noté, enregistré. Objectif : 7/10 minimum. Le grand quiz final pioche dans tout le mois !</div></div>
    <div class="quiz-list">
      <button onclick="showTab('geo')" style="border-left-color:#3e9c7a;">🌍 LES JEUX DE GÉOGRAPHIE — cartes, villes, drapeaux… avec records !</button>
      ${Object.entries(D.quizzes).map(([id,qz])=>`<button onclick="startQuiz('${id}')">📝 ${esc(qz.title)}</button>`).join('')}
      <button onclick="startQuiz('final')" style="border-left-color:#c98f2f;">🏆 LE GRAND QUIZ FINAL — 20 questions sur tout le mois</button>
    </div>
    <div class="card"><h3>📈 Tes derniers scores</h3><div id="score-history">Chargement…</div></div>`;
  loadScores();
}
async function loadScores(){
  const {data} = await db.from('adalix_qcm_scores').select('*').eq('child', child).order('created_at',{ascending:false}).limit(8);
  const el = $('#score-history'); if(!el) return;
  if(!data || !data.length){ el.innerHTML = '<span style="color:#888;font-size:13px;">Aucun quiz encore — lance-toi !</span>'; return; }
  el.innerHTML = data.map(r=>`<div style="font-size:13.5px;padding:4px 0;">${r.score>=Math.ceil(r.total*0.7)?'🏅':'📝'} ${esc(quizTitle(r.quiz_id))} — <b>${r.score}/${r.total}</b> <span style="color:#999;">(${new Date(r.created_at).toLocaleDateString('fr-FR')})</span></div>`).join('');
}
function quizTitle(id){
  if(id==='final') return 'Grand quiz final';
  const geo = (typeof GEO_GAMES !== 'undefined') && GEO_GAMES.find(g=>(g.qid||'capitales')===id && id!=='capitales');
  if(geo) return geo.label;
  return D.quizzes[id] ? D.quizzes[id].title.split('—')[0].trim() : id;
}
function startQuiz(id){
  let questions;
  if(id==='final'){
    // le grand final pioche dans les QCM hebdo (pas dans le quiz des capitales, qui a son propre match S1 vs S4)
    const all = Object.entries(D.quizzes).filter(([qid])=>qid.startsWith('s')).flatMap(([,q])=>q.questions);
    questions = all.sort(()=>Math.random()-0.5).slice(0,20);
  } else { questions = D.quizzes[id].questions; }
  quizState = { id, questions, idx:0, score:0, t0:Date.now(), answered:false };
  renderQuizQ();
}
function renderQuizQ(){
  const s = quizState, q = s.questions[s.idx];
  $('#main').innerHTML = `
    <div class="narrow">
    <button class="back-btn" onclick="quizState=null;renderQuizList()">← Quitter</button>
    <div class="card">
      <div class="quiz-progress">Question ${s.idx+1} / ${s.questions.length} · Score : ${s.score}</div>
      <div class="quiz-q">${esc(q.q)}</div>
      ${q.opts.map((o,i)=>`<button class="quiz-opt" id="opt-${i}" onclick="answerQ(${i})">${String.fromCharCode(65+i)}. ${esc(o)}</button>`).join('')}
    </div>
    </div>`;
}
function answerQ(i){
  const s = quizState, q = s.questions[s.idx];
  if(s.answered) return; s.answered = true;
  if(i===q.a){ s.score++; $('#opt-'+i).classList.add('correct'); }
  else { $('#opt-'+i).classList.add('wrong'); $('#opt-'+q.a).classList.add('correct'); }
  setTimeout(()=>{
    s.idx++; s.answered=false;
    if(s.idx < s.questions.length) renderQuizQ(); else finishQuiz();
  }, 900);
}
async function finishQuiz(){
  const s = quizState;
  const dur = Math.round((Date.now()-s.t0)/1000);
  const pct = s.score/s.questions.length;
  const badge = pct===1?'🥇 PARFAIT !':pct>=0.85?'🏅 Expert':pct>=0.7?'✅ Objectif atteint':'💪 Retente ta chance';
  await db.from('adalix_qcm_scores').insert({child, quiz_id:s.id, score:s.score, total:s.questions.length, duration_s:dur});
  checkBadges();
  $('#main').innerHTML = `
    <div class="narrow">
    <div class="card" style="text-align:center;">
      <h3>${esc(quizTitle(s.id))}</h3>
      <div class="big-score">${s.score} / ${s.questions.length}</div>
      <div style="font-size:20px;">${badge}</div>
      <div style="font-size:13px;color:#888;margin-top:6px;">⏱️ ${Math.floor(dur/60)}m${String(dur%60).padStart(2,'0')}s</div>
      <div class="actions" style="justify-content:center;">
        <button class="btn" onclick="startQuiz('${s.id}')">Rejouer</button>
        <button class="btn ghost" onclick="quizState=null;renderQuizList()">Retour</button>
      </div>
    </div>
    </div>`;
}

/* ---------- Jeux géo ---------- */
const GEO_GAMES = [
  {id:'europe',       icon:'🇪🇺', label:"Pays d'Europe",            sub:'42 pays à cliquer',            type:'shape', map:'europe', qid:'carte_europe'},
  {id:'ue',           icon:'💙', label:"Pays de l'Union européenne", sub:'les 27, sauras-tu les trouver ?', type:'shape', map:'europe', qid:'carte_ue',
    subset:['Allemagne','Autriche','Belgique','Bulgarie','Chypre','Croatie','Danemark','Espagne','Estonie','Finlande','France','Grèce','Hongrie','Irlande','Italie','Lettonie','Lituanie','Luxembourg','Malte','Pays-Bas','Pologne','Portugal','Roumanie','Slovaquie','Slovénie','Suède','Tchéquie']},
  {id:'monde',        icon:'🌍', label:'Pays du monde',              sub:'55 pays à situer',             type:'shape', map:'monde', qid:'carte_monde'},
  {id:'regions',      icon:'🧭', label:'Régions de France',          sub:'les 13 régions métropolitaines', type:'shape', map:'regions', qid:'carte_regions'},
  {id:'departements', icon:'🧩', label:'Départements français',      sub:'25 départements tirés au sort', type:'shape', map:'departements', qid:'carte_departements', sample:25},
  {id:'vf',           icon:'📍', label:'Villes de France',           sub:'place 30 villes sur la carte', type:'city', qid:'villes_france'},
  {id:'ve',           icon:'🏰', label:"Villes d'Europe",            sub:'30 capitales et grandes villes', type:'city', qid:'villes_europe'},
  {id:'vm',           icon:'🌐', label:'Villes du monde',            sub:'30 mégapoles à placer',        type:'city', qid:'villes_monde'},
  {id:'vusa',         icon:'🗽', label:'Villes des USA',             sub:'25 villes américaines',        type:'city', qid:'villes_usa'},
  {id:'phys',         icon:'🏔️', label:'Géo physique du monde',      sub:'fleuves, monts, déserts…',     type:'city', qid:'geo_physique'},
  {id:'capitales',    icon:'🏛️', label:'Capitales du monde',         sub:'le QCM à refaire en S4 !',     type:'qcm'},
  {id:'drapeaux',     icon:'🚩', label:'Drapeaux du monde',          sub:'20 drapeaux à reconnaître',    type:'flags', qid:'drapeaux'},
];
const GEO_QIDS = GEO_GAMES.map(g=>g.qid).filter(Boolean).concat(['capitales']);
function geoRun(id){
  const g = GEO_GAMES.find(x=>x.id===id);
  if(g.type==='shape') startMapGame(id);
  else if(g.type==='city') startCityGame(id);
  else if(g.type==='flags') startFlagsGame();
  else startQuiz('capitales');
}
async function renderGeo(){
  $('#main').innerHTML = `
    <div class="card"><h3>🌍 Les jeux de géographie</h3>
      <div style="font-size:13px;color:#888;">Clique, place, devine — chaque jeu garde ton record ET celui de ${child==='adam'?'Alix':'Adam'}. À vous deux de faire monter la barre !</div></div>
    <div class="quiz-list" id="geo-list">
      ${GEO_GAMES.map(g=>`<button onclick="geoRun('${g.id}')">
        <div style="font-weight:700;">${g.icon} ${esc(g.label)}</div>
        <div style="font-size:12px;color:#888;">${esc(g.sub)}</div>
        <div style="font-size:12px;margin-top:4px;" id="rec-${g.id}">…</div>
      </button>`).join('')}
    </div>`;
  // records des deux enfants
  const qids = GEO_GAMES.map(g=>g.qid || 'capitales');
  const {data} = await db.from('adalix_qcm_scores').select('child,quiz_id,score,total,duration_s').in('quiz_id', qids);
  const rows = data||[];
  const bestOf = (k, qid) => rows.filter(r=>r.child===k && r.quiz_id===qid)
    .sort((a,b)=> b.score-a.score || (a.duration_s||1e9)-(b.duration_s||1e9))[0];
  const fmt = r => r ? `${r.score}${r.duration_s?' · '+Math.floor(r.duration_s/60)+'m'+String(r.duration_s%60).padStart(2,'0'):''}` : '—';
  const other = child==='adam' ? 'alix' : 'adam';
  const otherName = other==='adam' ? 'Adam' : 'Alix';
  GEO_GAMES.forEach(g=>{
    const el = $('#rec-'+g.id); if(!el) return;
    const qid = g.qid || 'capitales';
    const mine = bestOf(child, qid), theirs = bestOf(other, qid);
    el.innerHTML = `🥇 Toi : <b>${fmt(mine)}</b> &nbsp;·&nbsp; ${otherName} : <b>${fmt(theirs)}</b>`;
    if(mine && theirs && theirs.score > mine.score) el.innerHTML += ' 🔥';
  });
}

/* ---- jeux « clique sur la zone » (pays, régions, départements) ---- */
let mapGame = null;
function startMapGame(gameId){
  const cfg = GEO_GAMES.find(g=>g.id===gameId);
  const M = window.MAPS && window.MAPS[cfg.map];
  if(!M){ toast('Carte indisponible — recharge la page'); return; }
  let idxs = M.targets.map((t,i)=>i);
  if(cfg.subset){ const s = new Set(cfg.subset); idxs = idxs.filter(i=>s.has(M.targets[i].n)); }
  let order = idxs.sort(()=>Math.random()-0.5);
  if(cfg.sample) order = order.slice(0, cfg.sample);
  mapGame = { cfg, M, order, included:new Set(order), idx:0, score:0, tries:0, found:{}, t0:Date.now() };
  mapGame.timer = setInterval(()=>{
    if(!mapGame) return;
    const el = $('#map-timer');
    if(el){ const s = Math.round((Date.now()-mapGame.t0)/1000); el.textContent = '⏱️ ' + Math.floor(s/60) + 'm' + String(s%60).padStart(2,'0'); }
  }, 1000);
  renderMapGame();
}
function stopMapGame(){ if(mapGame && mapGame.timer) clearInterval(mapGame.timer); mapGame = null; }
function renderMapGame(){
  const g = mapGame; if(!g) return;
  const M = g.M;
  const target = M.targets[g.order[g.idx]];
  $('#main').innerHTML = `
    <button class="back-btn" onclick="stopMapGame();renderGeo()">← Quitter</button>
    <div class="card">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div class="quiz-progress">${g.idx+1} / ${g.order.length} · Score : ${g.score}</div>
        <div class="quiz-progress" id="map-timer">⏱️</div>
      </div>
      <div class="quiz-q">${g.cfg.icon} Clique sur : <span style="color:var(--accent2);">${esc(target.n)}</span></div>
      <div id="map-feedback" style="font-size:13px;height:18px;color:#c9636a;"></div>
      <svg viewBox="0 0 ${M.w} ${M.h}" style="width:100%;background:#dde8f2;border-radius:10px;display:block;overflow:hidden;">
        ${(M.context||[]).map(d=>`<path d="${d}" fill="#c8cfd8" stroke="#ffffff" stroke-width="0.6"></path>`).join('')}
        ${M.targets.map((t,i)=>`<path d="${t.d}" id="mp-${i}" fill="${g.found[i]==='ok'?'#3e9c7a':g.found[i]==='miss'?'#e8963f':(g.included.has(i)?'#f0e6c8':'#c8cfd8')}" stroke="#8a8f98" stroke-width="0.7" style="cursor:pointer;" onclick="mapClick(${i})"></path>`).join('')}
      </svg>
      <div style="font-size:12px;color:#888;margin-top:6px;">3 points du premier coup, 2 au deuxième, 1 au troisième. Vert = trouvé, orange = révélé.</div>
    </div>`;
}
function mapClick(i){
  const g = mapGame; if(!g) return;
  const targetIdx = g.order[g.idx];
  if(g.found[i] !== undefined && i !== targetIdx) return;
  if(i === targetIdx){
    g.score += Math.max(1, 3 - g.tries);
    g.found[i] = 'ok'; g.tries = 0; g.idx++;
    if(g.idx >= g.order.length){ finishMapGame(); return; }
    renderMapGame();
  } else {
    g.tries++;
    const el = $('#mp-'+i);
    if(el){ const old = el.getAttribute('fill'); el.setAttribute('fill','#c9636a'); setTimeout(()=>{ if(el.isConnected) el.setAttribute('fill', old); }, 450); }
    const fb = $('#map-feedback');
    if(g.tries >= 3){
      g.found[targetIdx] = 'miss'; g.tries = 0;
      const good = $('#mp-'+targetIdx); if(good) good.setAttribute('fill','#e8963f');
      if(fb) fb.textContent = "C'était là, en orange ! On continue…";
      g.idx++;
      setTimeout(()=>{ if(!mapGame) return; if(g.idx >= g.order.length) finishMapGame(); else renderMapGame(); }, 1200);
    } else if(fb){ fb.textContent = `Non — plus que ${3-g.tries} essai${3-g.tries>1?'s':''}…`; }
  }
}
async function finishMapGame(){
  const g = mapGame; if(!g) return;
  clearInterval(g.timer);
  const dur = Math.round((Date.now()-g.t0)/1000);
  const total = g.order.length * 3;
  mapGame = null;
  await geoEndScreen(g.cfg.label, g.cfg.qid, g.score, total, dur, `geoRun('${g.cfg.id}')`);
}

/* ---- jeux « place la ville » (distance en km) ---- */
let cityGame = null;
function startCityGame(gameId){
  const cfg = GEO_GAMES.find(g=>g.id===gameId);
  const C = window.MAPS && window.MAPS.cities && window.MAPS.cities[gameId];
  if(!C){ toast('Carte indisponible — recharge la page'); return; }
  const bgMap = C.bg==='france' ? {w:window.MAPS.france_bg.w, h:window.MAPS.france_bg.h, paths:window.MAPS.france_bg.paths}
    : C.bg==='usa' ? {w:window.MAPS.usa_bg.w, h:window.MAPS.usa_bg.h, paths:window.MAPS.usa_bg.paths}
    : {w:window.MAPS[C.bg].w, h:window.MAPS[C.bg].h, paths:(window.MAPS[C.bg].context||[]).concat(window.MAPS[C.bg].targets.map(t=>t.d))};
  const order = C.list.map((c,i)=>i).sort(()=>Math.random()-0.5);
  cityGame = { cfg, C, bg:bgMap, order, idx:0, score:0, locked:false, t0:Date.now() };
  cityGame.timer = setInterval(()=>{
    if(!cityGame) return;
    const el = $('#map-timer');
    if(el){ const s = Math.round((Date.now()-cityGame.t0)/1000); el.textContent = '⏱️ ' + Math.floor(s/60) + 'm' + String(s%60).padStart(2,'0'); }
  }, 1000);
  renderCityGame();
}
function stopCityGame(){ if(cityGame && cityGame.timer) clearInterval(cityGame.timer); cityGame = null; }
function renderCityGame(){
  const g = cityGame; if(!g) return;
  const city = g.C.list[g.order[g.idx]];
  $('#main').innerHTML = `
    <button class="back-btn" onclick="stopCityGame();renderGeo()">← Quitter</button>
    <div class="card">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div class="quiz-progress">${g.idx+1} / ${g.order.length} · Score : ${g.score}</div>
        <div class="quiz-progress" id="map-timer">⏱️</div>
      </div>
      <div class="quiz-q">${g.cfg.icon} Place : <span style="color:var(--accent2);">${esc(city.n)}</span></div>
      <div id="map-feedback" style="font-size:13.5px;height:20px;font-weight:700;"></div>
      <svg id="city-svg" viewBox="0 0 ${g.bg.w} ${g.bg.h}" style="width:100%;background:#dde8f2;border-radius:10px;display:block;overflow:hidden;cursor:crosshair;" onclick="cityClick(event)">
        ${g.bg.paths.map(d=>`<path d="${d}" fill="#e6e0cc" stroke="#9aa2b0" stroke-width="0.6"></path>`).join('')}
        <g id="city-markers"></g>
      </svg>
      <div style="font-size:12px;color:#888;margin-top:6px;">Clique à l'endroit exact : 100 points si tu tombes dessus, moins il y a de kilomètres d'écart, plus tu marques !</div>
    </div>`;
}
function cityClick(evt){
  const g = cityGame; if(!g || g.locked) return;
  const svg = $('#city-svg'); if(!svg) return;
  const r = svg.getBoundingClientRect();
  const x = (evt.clientX - r.left) * g.bg.w / r.width;
  const y = (evt.clientY - r.top) * g.bg.h / r.height;
  const city = g.C.list[g.order[g.idx]];
  const dpx = Math.hypot(x - city.x, y - city.y);
  const km = Math.round(dpx * city.k);
  const points = Math.max(0, 100 - Math.round(km / g.C.D));
  g.score += points;
  g.locked = true;
  const mk = $('#city-markers');
  if(mk) mk.innerHTML = `
    <line x1="${x}" y1="${y}" x2="${city.x}" y2="${city.y}" stroke="#c9636a" stroke-width="1.2" stroke-dasharray="4 3"></line>
    <circle cx="${x}" cy="${y}" r="5" fill="#c9636a" stroke="white" stroke-width="1.5"></circle>
    <circle cx="${city.x}" cy="${city.y}" r="5" fill="#3e9c7a" stroke="white" stroke-width="1.5"></circle>`;
  const fb = $('#map-feedback');
  if(fb) fb.innerHTML = km <= 15 ? `🎯 En plein dessus ! <span style="color:#3e9c7a;">+${points} pts</span>`
    : `📍 À ${km} km — <span style="color:${points>50?'#3e9c7a':'#c9636a'};">+${points} pts</span>`;
  setTimeout(()=>{
    if(!cityGame) return;
    cityGame.locked = false; cityGame.idx++;
    if(cityGame.idx >= cityGame.order.length){ finishCityGame(); } else { renderCityGame(); }
  }, 1400);
}
async function finishCityGame(){
  const g = cityGame; if(!g) return;
  clearInterval(g.timer);
  const dur = Math.round((Date.now()-g.t0)/1000);
  const total = g.order.length * 100;
  cityGame = null;
  await geoEndScreen(g.cfg.label, g.cfg.qid, g.score, total, dur, `geoRun('${g.cfg.id}')`);
}

/* ---- jeu des drapeaux (images flagcdn) ---- */
const FLAGS = [['France','fr'],['Allemagne','de'],['Italie','it'],['Espagne','es'],['Portugal','pt'],['Royaume-Uni','gb'],['Irlande','ie'],['Belgique','be'],['Pays-Bas','nl'],['Suisse','ch'],['Autriche','at'],['Grèce','gr'],['Suède','se'],['Norvège','no'],['Finlande','fi'],['Danemark','dk'],['Pologne','pl'],['Ukraine','ua'],['Russie','ru'],['Turquie','tr'],['États-Unis','us'],['Canada','ca'],['Mexique','mx'],['Brésil','br'],['Argentine','ar'],['Chili','cl'],['Colombie','co'],['Pérou','pe'],['Chine','cn'],['Japon','jp'],['Corée du Sud','kr'],['Inde','in'],['Indonésie','id'],['Australie','au'],['Nouvelle-Zélande','nz'],['Maroc','ma'],['Algérie','dz'],['Tunisie','tn'],['Égypte','eg'],['Sénégal','sn'],["Côte d'Ivoire",'ci'],['Nigéria','ng'],['Afrique du Sud','za'],['Kenya','ke'],['Israël','il'],['Liban','lb'],['Arabie saoudite','sa'],['Iran','ir'],['Vietnam','vn'],['Thaïlande','th']];
let flagGame = null;
function startFlagsGame(){
  const qs = FLAGS.slice().sort(()=>Math.random()-0.5).slice(0,20).map(([name,iso])=>{
    const wrong = FLAGS.filter(f=>f[1]!==iso).sort(()=>Math.random()-0.5).slice(0,3);
    const opts = [[name,iso]].concat(wrong).sort(()=>Math.random()-0.5);
    return { name, iso, opts };
  });
  flagGame = { qs, idx:0, score:0, locked:false, t0:Date.now() };
  renderFlagGame();
}
function renderFlagGame(){
  const g = flagGame; if(!g) return;
  const q = g.qs[g.idx];
  $('#main').innerHTML = `
    <div class="narrow">
    <button class="back-btn" onclick="flagGame=null;renderGeo()">← Quitter</button>
    <div class="card">
      <div class="quiz-progress">Drapeau ${g.idx+1} / ${g.qs.length} · Score : ${g.score}</div>
      <div class="quiz-q">🚩 Quel est le drapeau ${q.name.match(/^(États|Pays)/)?'des':q.name.match(/^[AEIOUÉÈ]/)?"de l'":['France','Allemagne','Italie','Espagne','Grèce','Suède','Norvège','Finlande','Pologne','Ukraine','Russie','Turquie','Chine','Inde','Nouvelle-Zélande','Tunisie','Colombie','Thaïlande','Argentine','Belgique','Suisse','Autriche','Hongrie','Corée du Sud',"Côte d'Ivoire",'Arabie saoudite'].includes(q.name)?'de la ':'du '}<span style="color:var(--accent2);">${esc(q.name)}</span> ?</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${q.opts.map(([n,iso],i)=>`<button id="flag-${i}" onclick="flagClick(${i})" style="border:2.5px solid #ccd4e0;border-radius:12px;background:white;padding:10px;cursor:pointer;">
          <img src="https://flagcdn.com/w160/${iso}.png" alt="?" style="width:100%;max-width:150px;border:1px solid #eee;border-radius:4px;">
        </button>`).join('')}
      </div>
    </div>
    </div>`;
}
function flagClick(i){
  const g = flagGame; if(!g || g.locked) return;
  g.locked = true;
  const q = g.qs[g.idx];
  const ok = q.opts[i][1] === q.iso;
  if(ok) g.score++;
  const el = $('#flag-'+i); if(el) el.style.borderColor = ok ? '#3e9c7a' : '#c9636a';
  const goodIdx = q.opts.findIndex(o=>o[1]===q.iso);
  const good = $('#flag-'+goodIdx); if(good) good.style.borderColor = '#3e9c7a';
  setTimeout(()=>{
    if(!flagGame) return;
    flagGame.locked = false; flagGame.idx++;
    if(flagGame.idx >= flagGame.qs.length){ finishFlagGame(); } else { renderFlagGame(); }
  }, 900);
}
async function finishFlagGame(){
  const g = flagGame; if(!g) return;
  const dur = Math.round((Date.now()-g.t0)/1000);
  flagGame = null;
  await geoEndScreen('Drapeaux du monde', 'drapeaux', g.score, g.qs.length, dur, 'startFlagsGame()');
}

/* ---- écran de fin commun aux jeux géo ---- */
async function geoEndScreen(label, qid, score, total, dur, replay){
  const pct = score/total;
  const badge = pct>=0.9?'🥇 Champion(ne) !':pct>=0.7?'🏅 Très solide !':pct>=0.5?'✅ Bonne base — rejoue pour battre ton record':'💪 Ça se dompte en rejouant !';
  await db.from('adalix_qcm_scores').insert({child, quiz_id:qid, score, total, duration_s:dur});
  checkBadges();
  // record battu ?
  let recordMsg = '';
  try {
    const {data} = await db.from('adalix_qcm_scores').select('child,score').eq('quiz_id',qid);
    const rows = data||[];
    const myBest = Math.max(...rows.filter(r=>r.child===child).map(r=>r.score));
    const other = child==='adam'?'alix':'adam';
    const otherBest = Math.max(0, ...rows.filter(r=>r.child===other).map(r=>r.score));
    if(score >= myBest && score > 0) recordMsg = '🎉 Nouveau record personnel !';
    if(otherBest && score > otherBest) recordMsg += ` Et tu passes devant ${other==='adam'?'Adam':'Alix'} ! 👑`;
  } catch(e){}
  $('#main').innerHTML = `
    <div class="narrow">
    <div class="card" style="text-align:center;">
      <h3>${esc(label)}</h3>
      <div class="big-score">${score} / ${total}</div>
      <div style="font-size:20px;">${badge}</div>
      ${recordMsg?`<div style="font-size:15px;color:#b06a1a;font-weight:700;margin-top:6px;">${recordMsg}</div>`:''}
      <div style="font-size:13px;color:#888;margin-top:6px;">⏱️ ${Math.floor(dur/60)}m${String(dur%60).padStart(2,'0')}s</div>
      <div class="actions" style="justify-content:center;">
        <button class="btn" onclick="${replay}">Rejouer</button>
        <button class="btn ghost" onclick="renderGeo()">Tous les jeux</button>
      </div>
    </div>
    </div>`;
}


/* ---------- checklist ---------- */
let todayItems = {};
async function renderChecklist(){
  const {data} = await db.from('adalix_checklist').select('*').eq('child',child).eq('day',todayStr()).maybeSingle();
  todayItems = (data && data.items) || {};
  drawChecklist();
}
function drawChecklist(){
  const done = D.checklist.filter(it=>todayItems[it.id]).length;
  $('#main').innerHTML = `
    <div class="narrow">
    <div class="card"><h3>✅ Ma journée — ${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</h3>
      <div style="font-size:14px;">${done} / ${D.checklist.length} ${done===D.checklist.length?'— journée complète, bravo ! 🎉':''}</div></div>
    ${D.checklist.map(it=>`<div class="chk-item ${todayItems[it.id]?'done':''}" onclick="toggleItem('${it.id}')">
      <div class="box">${todayItems[it.id]?'✓':''}</div><div class="emoji">${it.emoji}</div><div class="lbl">${esc(it.label)}</div>
    </div>`).join('')}
    </div>`;
}
async function toggleItem(id){
  if(id==='ecriture' && !todayItems[id]){ openJournal(); return; }
  // 'projet' se coche directement comme les autres (avant : redirection vers l'onglet projet
  // sans jamais cocher — l'enfant croyait avoir validé et retrouvait la case vide)
  todayItems[id] = !todayItems[id];
  drawChecklist(); saveChecklist();
}
function openJournal(){
  modal(`<h3>✍️ Écriture du soir</h3>
    <p style="font-size:13.5px;color:#666;">Quelques lignes suffisent — c'est TA trace de la journée.</p>
    <b style="font-size:14px;">Ce que j'ai appris aujourd'hui :</b>
    <textarea id="j-learned" rows="3"></textarea>
    <b style="font-size:14px;">Ce qui m'a étonné :</b>
    <textarea id="j-surprised" rows="3"></textarea>
    <div class="actions"><button class="btn" onclick="saveJournal()">Enregistrer</button><button class="btn ghost" onclick="closeModal()">Plus tard</button></div>`);
}
async function saveJournal(){
  const learned = $('#j-learned').value.trim(), surprised = $('#j-surprised').value.trim();
  if(!learned && !surprised){ toast('Écris au moins une ligne !'); return; }
  await db.from('adalix_journal').insert({child, day:todayStr(), learned, surprised});
  todayItems['ecriture'] = true;
  closeModal(); drawChecklist(); saveChecklist(); toast('Enregistré ! 🌟');
  checkBadges();
}
async function saveChecklist(){
  const completed = D.checklist.filter(it=>todayItems[it.id]).length;
  await db.from('adalix_checklist').upsert({child, day:todayStr(), items:todayItems, completed, updated_at:new Date().toISOString()});
  refreshStreak();
  checkBadges();
}
async function refreshStreak(){
  if(child==='parent') return;
  const {data} = await db.from('adalix_checklist').select('day,completed').eq('child',child).order('day',{ascending:false}).limit(40);
  let streak = 0;
  if(data){
    const map = Object.fromEntries(data.map(r=>[r.day, r.completed]));
    for(let i=0;i<40;i++){
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.toISOString().slice(0,10);
      const c = map[key]||0;
      if(c >= 8) streak++;
      else if(i===0) continue;   // today not finished yet doesn't break the streak
      else break;
    }
  }
  $('#hdr-streak').textContent = '🔥 ' + streak;
}

/* ---------- projet du mois ---------- */
let projetState = null;
async function renderProjet(){
  $('#main').innerHTML = '<div class="card">Chargement…</div>';
  const P = D.projet;
  const mine = P[child] || P.adam;
  const {data} = await db.from('adalix_projet').select('*').eq('child',child).maybeSingle();
  projetState = data || {child, idea:null, notes:'', phase:1};
  const t = todayInProgramme();
  const stepIdx = t ? t.wi*6 + t.di : 23;
  const curPhase = (t ? t.wi : 3) + 1;
  const weekSteps = (P.steps||[]).slice((curPhase-1)*6, (curPhase-1)*6+6);
  $('#main').innerHTML = `<div class="narrow">
    <div class="card"><h3>💻 Ton projet du mois</h3>
      <div style="font-size:13.5px;color:#666;line-height:1.5;">${esc(P.intro)}</div>
      ${P.rendu?`<div class="ecrit-box" style="margin-top:10px;">${esc(P.rendu)}</div>`:''}
    </div>
    ${P.steps && P.steps[stepIdx] ? `<div class="card" style="border-left:4px solid #c98f2f;"><h3>🪜 L'étape du jour (jour ${stepIdx+1}/24)</h3>
      <p style="font-size:14.5px;line-height:1.6;margin:4px 0;">${esc(P.steps[stepIdx])}</p>
      <div style="font-size:12px;color:#888;margin-top:8px;">Les étapes de la semaine ${curPhase} :</div>
      <ol style="margin:4px 0 0 20px;padding:0;" start="${(curPhase-1)*6+1}">${weekSteps.map((s,i)=>`<li style="font-size:12.5px;line-height:1.5;margin-bottom:4px;${(curPhase-1)*6+i===stepIdx?'font-weight:700;color:var(--accent2);':'color:#888;'}">${esc(s.split('.')[0])}.</li>`).join('')}</ol>
    </div>` : ''}
    <div class="card"><h3>🗺️ Les 4 phases</h3>
      ${P.phases.map(ph=>`<div style="display:flex;gap:8px;align-items:baseline;padding:4px 0;${ph.semaine===curPhase?'font-weight:700;color:var(--accent2);':'color:#888;'}">
        <div>S${ph.semaine}</div><div style="font-size:13.5px;">${esc(ph.titre)}</div>${ph.semaine===curPhase?'<span style="font-size:12px;">← cette semaine</span>':''}
      </div>`).join('')}
    </div>
    <div class="card"><h3>💡 6 idées, 1 choix</h3>
      <div style="font-size:12.5px;color:#888;margin-bottom:6px;">Clique sur ton idée (ou change d'avis à tout moment).</div>
      ${mine.ideas.map((idea,i)=>`<div class="chk-item ${projetState.idea===idea.titre?'done':''}" onclick="chooseIdea('${esc(idea.titre).replace(/'/g,"\\'")}')">
        <div class="box">${projetState.idea===idea.titre?'✓':''}</div>
        <div><div class="di-title" style="font-size:14px;">${esc(idea.titre)}</div><div class="di-sub">${esc(idea.desc)}</div></div>
      </div>`).join('')}
      <div style="font-size:12.5px;color:#888;margin-top:8px;">${esc(P.astuce)}</div>
    </div>
    <div class="card"><h3>📝 Où j'en suis</h3>
      <textarea id="proj-notes" rows="4" placeholder="Note ce que tu as fait aujourd'hui sur ton projet…">${esc(projetState.notes||'')}</textarea>
      <div class="actions"><button class="btn" onclick="saveProjetNotes()">Enregistrer</button>
      <button class="btn ghost" onclick="showTab('fabrique')">🏭 Construire dans la Fabrique</button></div>
    </div>
  </div>`;
}
async function chooseIdea(titre){
  projetState.idea = titre;
  await db.from('adalix_projet').upsert({child, idea:titre, notes:projetState.notes||'', phase:currentWeek+1, updated_at:new Date().toISOString()});
  renderProjet();
}
async function saveProjetNotes(){
  const notes = $('#proj-notes').value.trim();
  projetState.notes = notes;
  await db.from('adalix_projet').upsert({child, idea:projetState.idea||null, notes, phase:currentWeek+1, updated_at:new Date().toISOString()});
  await markChecklistItemDone('projet');
  toast('Projet enregistré ! 🌟');
}
// coche un item de la checklist du jour sans écraser les autres (utile depuis un autre onglet que "checklist")
async function markChecklistItemDone(id){
  const {data} = await db.from('adalix_checklist').select('*').eq('child',child).eq('day',todayStr()).maybeSingle();
  const items = (data && data.items) || {};
  items[id] = true;
  const completed = D.checklist.filter(it=>items[it.id]).length;
  await db.from('adalix_checklist').upsert({child, day:todayStr(), items, completed, updated_at:new Date().toISOString()});
  todayItems = items;
  refreshStreak();
  checkBadges();
}

/* ---------- La Fabrique ---------- */
let fabMsgs = [];
let fabCode = '';
let fabUrl = '';
let fabLoaded = false;
const FAB_STEPS = [
  {e:'💡', t:'Imagine', d:"Décris ton idée au Bâtisseur : c'est quoi ta page, pour qui, qu'est-ce qu'on doit y voir ? (Ton projet du mois est le candidat idéal !)"},
  {e:'🔨', t:'Fabrique', d:"Demande au Bâtisseur, regarde l'aperçu changer, puis améliore petit à petit : un titre, des couleurs, un bouton… Une chose à la fois, comme les pros."},
  {e:'🧪', t:'Teste', d:"Clique partout dans l'aperçu, cherche ce qui cloche, fais tester quelqu'un d'autre. Un bug trouvé = une victoire."},
  {e:'🚀', t:'Publie', d:"Ton code part sur GitHub (le coffre-fort mondial du code, celui des vrais développeurs) et ta page est mise en ligne automatiquement."},
  {e:'🔗', t:'Partage', d:"Envoie ton lien à la famille — ta page est sur le vrai internet, visible depuis n'importe où dans le monde."},
];
let fabStep = 0;
async function renderFabrique(){
  if(child==='parent'){ renderDashboard(); return; }
  if(!fabLoaded){
    $('#main').innerHTML = '<div class="card">Ouverture de l\'atelier…</div>';
    const {data} = await db.from('adalix_fabrique').select('*').eq('child',child).maybeSingle();
    fabCode = (data && data.code) || '';
    fabUrl = (data && data.published_url) || '';
    fabLoaded = true;
  }
  $('#main').innerHTML = `
    <div class="card"><h3>🏭 La Fabrique — ton atelier de création</h3>
      <div style="font-size:13px;color:#888;">Ici tu fabriques une vraie page web avec le Bâtisseur, ton IA d'atelier — puis tu la publies sur le vrai internet, comme un vrai développeur. Suis les 5 étapes :</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
        ${FAB_STEPS.map((s,i)=>`<button class="btn ${i===fabStep?'':'ghost'}" style="font-size:12px;padding:6px 10px;" onclick="fabStep=${i};renderFabrique()">${s.e} ${i+1}. ${s.t}</button>`).join('')}
      </div>
      <div style="font-size:13.5px;line-height:1.5;margin-top:8px;background:#fdf6ec;border-radius:8px;padding:8px 12px;"><b>${FAB_STEPS[fabStep].e} Étape ${fabStep+1} — ${FAB_STEPS[fabStep].t} :</b> ${FAB_STEPS[fabStep].d}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;align-items:start;">
      <div class="card">
        <h3>🤖 Le Bâtisseur</h3>
        <div id="fab-box" style="display:flex;flex-direction:column;gap:8px;max-height:44vh;min-height:120px;overflow-y:auto;padding:4px 2px;"></div>
        <div class="chat-input" style="margin-top:8px;">
          <input type="text" id="fab-in" placeholder="Ex : fabrique-moi la première page de mon atlas imaginaire…" onkeydown="if(event.key==='Enter')sendFab()">
          <button class="btn" onclick="sendFab()">🔨</button>
        </div>
      </div>
      <div class="card">
        <h3>👀 L'aperçu de ta page</h3>
        <iframe id="fab-preview" sandbox="allow-scripts" style="width:100%;height:44vh;border:1.5px solid #ccd4e0;border-radius:10px;background:white;"></iframe>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <button class="btn ghost" style="font-size:12.5px;" onclick="toggleFabCode()">👨‍💻 Voir le code</button>
          <button class="btn" style="font-size:12.5px;background:#3e9c7a;" onclick="publishFab()">🚀 Publier ma page</button>
        </div>
        <div id="fab-code-wrap" class="hidden" style="margin-top:8px;">
          <textarea id="fab-code" rows="10" spellcheck="false" style="font-family:monospace;font-size:11.5px;"></textarea>
          <button class="btn ghost" style="font-size:12px;margin-top:4px;" onclick="applyFabCode()">Appliquer mes modifications</button>
        </div>
        <div id="fab-pub" style="font-size:13px;margin-top:8px;">${fabUrl?`🔗 Dernière publication : <a href="${fabUrl}" target="_blank" rel="noopener">${fabUrl}</a>`:''}</div>
      </div>
    </div>`;
  drawFab(); updateFabPreview();
}
function drawFab(){
  const box = $('#fab-box'); if(!box) return;
  const visible = fabMsgs.map(m => ({...m, content: m.role==='assistant' ? m.content.replace(/```html[\s\S]*?```/g, '🔧 [code mis à jour → regarde l\'aperçu !]') : m.content}));
  box.innerHTML = visible.map(m=>`<div class="msg ${m.role==='user'?'user':'bot'}" style="font-size:13.5px;">${esc(m.content)}</div>`).join('')
    || '<div style="color:#999;font-size:13px;text-align:center;margin-top:20px;">Décris ta page de rêve au Bâtisseur — il la construit sous tes yeux. 🏗️</div>';
  box.scrollTop = box.scrollHeight;
}
function updateFabPreview(){
  const f = $('#fab-preview'); if(!f) return;
  f.srcdoc = fabCode || '<body style="font-family:sans-serif;color:#999;display:flex;align-items:center;justify-content:center;height:90vh;text-align:center;">Ta page apparaîtra ici.<br>Commence par en parler au Bâtisseur !</body>';
  const ta = $('#fab-code'); if(ta) ta.value = fabCode;
}
function toggleFabCode(){ const w = $('#fab-code-wrap'); if(w){ w.classList.toggle('hidden'); const ta=$('#fab-code'); if(ta) ta.value = fabCode; } }
function applyFabCode(){ const ta = $('#fab-code'); if(!ta) return; fabCode = ta.value; updateFabPreview(); saveFab(); toast('Code appliqué 👨‍💻'); }
async function saveFab(){
  await db.from('adalix_fabrique').upsert({child, code:fabCode, published_url:fabUrl, updated_at:new Date().toISOString()});
}
async function sendFab(){
  const inp = $('#fab-in'); const text = inp ? inp.value.trim() : ''; if(!text) return;
  inp.value='';
  fabMsgs.push({role:'user', content:text});
  fabMsgs.push({role:'assistant', content:'🔨 Le Bâtisseur travaille…'});
  drawFab();
  try {
    const r = await fetch('/api/fabrique', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({child, currentCode: fabCode, messages: fabMsgs.slice(0,-1).slice(-10)})});
    const j = await r.json();
    const reply = j.reply || j.error || 'Oups, réessaie !';
    fabMsgs[fabMsgs.length-1] = {role:'assistant', content: reply};
    const m = reply.match(/```html\s*([\s\S]*?)```/);
    if(m && m[1].trim()){
      fabCode = m[1].trim();
      updateFabPreview(); saveFab();
      if(fabStep < 1){ fabStep = 1; }
    }
  } catch(e){
    fabMsgs[fabMsgs.length-1] = {role:'assistant', content:'Erreur de connexion — réessaie dans un instant.'};
  }
  drawFab();
  if($('#fab-code') && !$('#fab-code-wrap').classList.contains('hidden')) $('#fab-code').value = fabCode;
}
async function publishFab(){
  if(!fabCode.trim()){ toast('Fabrique d\'abord ta page avec le Bâtisseur !'); return; }
  const pub = $('#fab-pub'); if(pub) pub.innerHTML = '🚀 Publication en cours…';
  try {
    const r = await fetch('/api/publish', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({child, html: fabCode})});
    const j = await r.json();
    if(j.url){
      fabUrl = j.url; fabStep = 4; saveFab();
      if(pub) pub.innerHTML = `🎉 <b>Publié !</b> Ton code est sur <a href="${j.fileUrl}" target="_blank" rel="noopener">GitHub</a> — comme un vrai dev.<br>🔗 Ta page sera en ligne dans ~1 minute : <a href="${j.url}" target="_blank" rel="noopener">${j.url}</a>`;
      toast('🚀 Publié sur GitHub !');
    } else {
      if(pub) pub.innerHTML = '😕 ' + esc(j.error || 'Erreur de publication');
    }
  } catch(e){ if(pub) pub.innerHTML = '😕 Erreur de connexion — réessaie.'; }
}

/* ---------- chat ---------- */
function renderChat(){
  if(!assistantName){ askAssistantName(); return; }
  $('#main').innerHTML = `<div class="narrow">
    <div class="card"><h3>💬 Pose toutes tes questions à ${esc(assistantName)}</h3>
      <div style="font-size:13px;color:#888;">Je suis ${esc(assistantName)}, ton assistant du Grand Été. Histoire, sciences, économie, mots compliqués… demande-moi tout !</div>
      <div id="chat-box"></div>
      <div id="chat-img-preview"></div>
      <div class="chat-input">
        <button class="btn ghost" style="padding:10px 12px;" title="Envoyer une image ou une capture d'écran" onclick="document.getElementById('chat-file').click()">🖼️</button>
        <input type="file" id="chat-file" accept="image/*" style="display:none;" onchange="if(this.files[0])handleChatFile(this.files[0]);this.value='';">
        <input type="text" id="chat-in" placeholder="Ta question… (tu peux aussi coller une image !)" onkeydown="if(event.key==='Enter')sendChat()" onpaste="handleChatPaste(event)">
        <button class="btn" onclick="sendChat()">➤</button>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn ghost" onclick="openGems()">⭐ Mes pépites</button>
        <button class="btn ghost" onclick="openImagine()">🎨 Atelier d'images</button>
        <button class="btn ghost" onclick="askAssistantName()">✏️ Renommer ${esc(assistantName)}</button>
      </div>
    </div>
  </div>`;
  drawChat();
}
function askAssistantName(){
  const first = !assistantName;
  modal(`<h3>🤖 ${first?'Baptise ton assistant !':'Renomme ton assistant'}</h3>
    <p style="font-size:13.5px;color:#666;">${first?"C'est lui qui répondra à toutes tes questions ce mois-ci — donne-lui un nom !":"Choisis un nouveau nom :"}</p>
    <input type="text" id="assistant-name-input" placeholder="Ex : Nova, Sam, Merlin…" maxlength="20" value="${esc(assistantName||'')}">
    <div class="actions"><button class="btn" onclick="saveAssistantName()">${first?"C'est parti !":'Enregistrer'}</button>${first?'':'<button class="btn ghost" onclick="closeModal()">Annuler</button>'}</div>`);
  setTimeout(()=>{ const el=$('#assistant-name-input'); if(el) el.focus(); },50);
}
async function saveAssistantName(){
  const el = $('#assistant-name-input');
  const name = el ? el.value.trim() : '';
  if(!name){ toast('Donne-lui un nom !'); return; }
  assistantName = name;
  await db.from('adalix_assistant').upsert({child, name});
  closeModal();
  if(tab==='chat') renderChat();
}
function drawChat(){
  const box = $('#chat-box'); if(!box) return;
  box.innerHTML = chatMsgs.map((m,i)=>`<div class="msg ${m.role==='user'?'user':'bot'}">${m.dataUrl?`<img src="${m.dataUrl}" style="max-width:100%;border-radius:10px;display:block;margin-bottom:${m.content?'6px':'0'};">`:''}${esc(m.content)}${m.role==='assistant' && m.content && m.content!=='…' ? `<div style="text-align:right;margin-top:4px;"><button onclick="saveGem(${i})" title="Garder cette réponse dans mes pépites" style="background:none;border:none;cursor:pointer;font-size:15px;opacity:${m.saved?'1':'.45'};">${m.saved?'⭐ gardé':'⭐'}</button></div>`:''}</div>`).join('') || '<div style="color:#999;font-size:13px;text-align:center;margin-top:30px;">Aucun message — pose ta première question ! Tu peux aussi m\'envoyer une image ou une capture d\'écran. 🖼️</div>';
  box.scrollTop = box.scrollHeight;
}
/* ---- pépites : garder ses meilleures questions/réponses ---- */
async function saveGem(i){
  const m = chatMsgs[i];
  if(!m || m.role!=='assistant' || m.saved) return;
  // retrouve la question qui précède cette réponse
  let q = '';
  for(let j=i-1;j>=0;j--){ if(chatMsgs[j].role==='user'){ q = chatMsgs[j].content || '(image)'; break; } }
  const {error} = await db.from('adalix_saved').insert({child, question:q, answer:m.content});
  if(error){ toast('Erreur — réessaie'); return; }
  m.saved = true; drawChat();
  toast('⭐ Gardé dans tes pépites !');
}
async function openGems(){
  const {data} = await db.from('adalix_saved').select('*').eq('child',child).order('created_at',{ascending:false});
  const gems = data||[];
  modal(`<h3>⭐ Mes pépites</h3>
    <div style="font-size:12.5px;color:#888;margin-bottom:8px;">${gems.length ? 'Tes questions-réponses préférées, gardées pour toujours.' : 'Rien pour l\'instant — clique sur la petite étoile ⭐ sous une réponse de ton assistant pour la garder ici.'}</div>
    <div style="max-height:52vh;overflow:auto;">
    ${gems.map(g=>`<div style="background:#f7f8fb;border-radius:10px;padding:9px 12px;margin-bottom:8px;">
      <div style="font-size:11px;color:#999;">${new Date(g.created_at).toLocaleDateString('fr-FR')} <button onclick="deleteGem(${g.id})" style="float:right;background:none;border:none;cursor:pointer;">🗑️</button></div>
      ${g.question?`<div style="font-size:13px;font-weight:700;margin:2px 0;">${esc(g.question)}</div>`:''}
      <div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">${esc(g.answer)}</div>
    </div>`).join('')}
    </div>
    <div class="actions"><button class="btn" onclick="closeModal()">Fermer</button></div>`);
}
async function deleteGem(id){
  await db.from('adalix_saved').delete().eq('id',id).eq('child',child);
  openGems();
}
/* ---- images dans le chat (les "yeux" de l'assistant) ---- */
let pendingImage = null;   // {media_type, data, dataUrl}
function handleChatPaste(ev){
  const items = (ev.clipboardData || {}).items || [];
  for(const it of items){
    if(it.type && it.type.startsWith('image/')){
      ev.preventDefault();
      handleChatFile(it.getAsFile());
      return;
    }
  }
}
function handleChatFile(file){
  if(!file || !file.type.startsWith('image/')) { toast('Ce fichier n\'est pas une image'); return; }
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    // redimensionne (max 1024px) et compresse pour rester léger
    const MAX = 1024;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const dataUrl = cv.toDataURL('image/jpeg', 0.85);
    pendingImage = { media_type:'image/jpeg', data:dataUrl.split(',')[1], dataUrl };
    drawImgPreview();
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Image illisible — réessaie'); };
  img.src = url;
}
function drawImgPreview(){
  const el = $('#chat-img-preview'); if(!el) return;
  el.innerHTML = pendingImage ? `<div style="display:flex;align-items:center;gap:10px;margin-top:8px;background:rgba(0,0,0,.05);border-radius:10px;padding:6px 10px;">
    <img src="${pendingImage.dataUrl}" style="height:52px;border-radius:8px;">
    <span style="font-size:12.5px;color:#888;flex:1;">Image prête à envoyer — ajoute ta question puis ➤</span>
    <button class="btn ghost" style="padding:4px 10px;" onclick="pendingImage=null;drawImgPreview();">✕</button>
  </div>` : '';
}
async function sendChat(){
  const inp = $('#chat-in'); const text = inp.value.trim();
  if(!text && !pendingImage) return;
  const img = pendingImage; pendingImage = null; drawImgPreview();
  inp.value='';
  chatMsgs.push({role:'user', content:text, image: img?{media_type:img.media_type, data:img.data}:undefined, dataUrl: img?img.dataUrl:undefined});
  drawChat();
  db.from('adalix_chat').insert({child, role:'user', content:(text||'') + (img?' [📷 image envoyée]':'')}).then(()=>{ checkBadges(); });
  chatMsgs.push({role:'assistant', content:'…'}); drawChat();
  try {
    // on n'envoie l'image que sur le dernier message (l'historique reste en texte, léger)
    const hist = chatMsgs.slice(0,-1).slice(-12);
    const payload = hist.map((m,i)=>({ role:m.role, content:m.content, image: (i===hist.length-1 && m.image) ? m.image : undefined }));
    const r = await fetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({child, assistantName, profile: childProfile, messages: payload})});
    const j = await r.json();
    chatMsgs[chatMsgs.length-1] = {role:'assistant', content: j.reply || j.error || 'Oups, réessaie !'};
    db.from('adalix_chat').insert({child, role:'assistant', content: chatMsgs[chatMsgs.length-1].content}).then(()=>{});
  } catch(e){
    chatMsgs[chatMsgs.length-1] = {role:'assistant', content:'Erreur de connexion — réessaie dans un instant.'};
  }
  drawChat();
}
function openImagine(){
  modal(`<h3>🎨 Atelier d'images</h3>
    <p style="font-size:13.5px;color:#666;">Décris l'image de tes rêves (un personnage de ton histoire, une planète, un gâteau fabuleux…) et l'IA la dessine.</p>
    <textarea id="img-prompt" rows="3" placeholder="Ex : un château volant au coucher du soleil, style aquarelle"></textarea>
    <div id="img-out"></div>
    <div class="actions"><button class="btn" id="img-go" onclick="genImage()">Générer</button><button class="btn ghost" onclick="closeModal()">Fermer</button></div>`);
}
async function genImage(){
  const prompt = $('#img-prompt').value.trim(); if(!prompt) return;
  $('#img-go').textContent='✨ En cours…'; $('#img-go').disabled=true;
  try {
    const r = await fetch('/api/image', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prompt})});
    const j = await r.json();
    $('#img-out').innerHTML = j.url ? `<img class="img-result" src="${j.url}">` : `<p style="color:#c9636a;font-size:13px;">${esc(j.error||'Erreur')}</p>`;
  } catch(e){ $('#img-out').innerHTML = '<p style="color:#c9636a;font-size:13px;">Erreur de connexion.</p>'; }
  $('#img-go').textContent='Générer'; $('#img-go').disabled=false;
}

/* ---------- badges ---------- */
const BADGE_CATS = {
  assiduite:{label:'Assiduité', emoji:'🔥'},
  savoir:{label:'Savoir', emoji:'🧠'},
  collection:{label:'Collection', emoji:'🏆'},
  creativite:{label:'Créativité', emoji:'✍️'},
  curiosite:{label:'Curiosité', emoji:'💬'},
  discipline:{label:'Discipline', emoji:'✅'},
};
const BADGES = [
  {id:'streak3', cat:'assiduite', emoji:'🔥', label:"3 jours d'affilée", desc:'Checklist complète 3 jours de suite.'},
  {id:'streak7', cat:'assiduite', emoji:'🔥🔥', label:'Une semaine', desc:'Checklist complète 7 jours de suite.'},
  {id:'streak14', cat:'assiduite', emoji:'🔥🔥🔥', label:'Deux semaines', desc:'Checklist complète 14 jours de suite.'},
  {id:'streak28', cat:'assiduite', emoji:'👑', label:'Streak parfait', desc:'Checklist complète sur les 4 semaines.', rare:true},
  {id:'quiz_first', cat:'savoir', emoji:'🥇', label:'Premier quiz réussi', desc:'Un quiz réussi à 70% ou plus.'},
  {id:'quiz_perfect', cat:'savoir', emoji:'💯', label:'Premier sans-faute', desc:'Un quiz réussi à 100%.'},
  {id:'quiz_5', cat:'savoir', emoji:'🧠', label:'5 quiz complétés', desc:'5 quiz terminés, peu importe le score.'},
  {id:'quiz_final', cat:'savoir', emoji:'🏆', label:'Grand quiz final réussi', desc:'Le grand quiz final réussi à 70% ou plus.', rare:true},
  {id:'quiz_fast', cat:'savoir', emoji:'⚡', label:'Éclair', desc:'Un quiz réussi (≥70%) en moins de 90 secondes.'},
  {id:'collec_first', cat:'collection', emoji:'🔍', label:'Première carte', desc:'Ta première personnalité débloquée.'},
  {id:'collec_10', cat:'collection', emoji:'📚', label:'10 cartes', desc:'10 personnalités débloquées.'},
  {id:'collec_50', cat:'collection', emoji:'🏛️', label:'Mi-collection', desc:'50 personnalités débloquées.'},
  {id:'collec_100', cat:'collection', emoji:'👑', label:'Collection complète', desc:`Les ${D.persons.length} personnalités débloquées.`, rare:true},
  {id:'journal_first', cat:'creativite', emoji:'✍️', label:'Première page', desc:'Ta première écriture du soir.'},
  {id:'journal_week', cat:'creativite', emoji:'📖', label:"Semaine d'écriture", desc:'7 entrées de journal.'},
  {id:'chat_first', cat:'curiosite', emoji:'💬', label:'Première question', desc:"Ta première question posée à l'assistant."},
  {id:'chat_10', cat:'curiosite', emoji:'🔬', label:'10 questions', desc:"10 questions posées à l'assistant."},
  {id:'checklist_full', cat:'discipline', emoji:'✅', label:'Journée complète', desc:'Une première journée 12/12.'},
];
async function computeStreak(){
  if(child==='parent') return 0;
  const {data} = await db.from('adalix_checklist').select('day,completed').eq('child',child).order('day',{ascending:false}).limit(40);
  let streak = 0;
  if(data){
    const map = Object.fromEntries(data.map(r=>[r.day, r.completed]));
    for(let i=0;i<40;i++){
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.toISOString().slice(0,10);
      const c = map[key]||0;
      if(c >= 8) streak++;
      else if(i===0) continue;
      else break;
    }
  }
  return streak;
}
async function loadBadges(){
  if(child==='parent') return;
  const {data} = await db.from('adalix_badges').select('badge_id').eq('child',child);
  earnedBadges = new Set((data||[]).map(r=>r.badge_id));
  updateBadgeHeader();
}
function updateBadgeHeader(){
  const el = $('#hdr-badges'); if(el) el.textContent = '🎖️ ' + earnedBadges.size;
}
async function checkBadges(){
  if(child==='parent') return;
  const [streak, qzRes, jrRes, chRes, ckRes] = await Promise.all([
    computeStreak(),
    db.from('adalix_qcm_scores').select('quiz_id,score,total,duration_s').eq('child',child),
    db.from('adalix_journal').select('id').eq('child',child),
    db.from('adalix_chat').select('id').eq('child',child).eq('role','user'),
    db.from('adalix_checklist').select('completed').eq('child',child),
  ]);
  const qz = qzRes.data||[], jr = jrRes.data||[], ch = chRes.data||[], ck = ckRes.data||[];
  const stats = {
    streak,
    quizCount: qz.length,
    quizPassed: qz.some(r=>r.total && r.score/r.total>=0.7),
    quizPerfect: qz.some(r=>r.total && r.score===r.total),
    quizFinalPassed: qz.some(r=>r.quiz_id==='final' && r.total && r.score/r.total>=0.7),
    quizFast: qz.some(r=>r.total && r.score/r.total>=0.7 && r.duration_s!=null && r.duration_s<90),
    collecCount: unlocked.size,
    journalCount: jr.length,
    chatCount: ch.length,
    checklistFullDay: ck.some(r=>r.completed>=D.checklist.length),
  };
  const conditions = {
    streak3: stats.streak>=3, streak7: stats.streak>=7, streak14: stats.streak>=14, streak28: stats.streak>=28,
    quiz_first: stats.quizPassed, quiz_perfect: stats.quizPerfect, quiz_5: stats.quizCount>=5,
    quiz_final: stats.quizFinalPassed, quiz_fast: stats.quizFast,
    collec_first: stats.collecCount>=1, collec_10: stats.collecCount>=10, collec_50: stats.collecCount>=50, collec_100: stats.collecCount>=D.persons.length,
    journal_first: stats.journalCount>=1, journal_week: stats.journalCount>=7,
    chat_first: stats.chatCount>=1, chat_10: stats.chatCount>=10,
    checklist_full: stats.checklistFullDay,
  };
  const toUnlock = BADGES.filter(b=>!earnedBadges.has(b.id) && conditions[b.id]);
  if(!toUnlock.length) return;
  for(const b of toUnlock){
    earnedBadges.add(b.id);
    db.from('adalix_badges').upsert({child, badge_id:b.id}).then(()=>{});
  }
  updateBadgeHeader();
  celebrateBadges(toUnlock);
}
function celebrateBadges(list){
  const rare = list.filter(b=>b.rare), common = list.filter(b=>!b.rare);
  common.forEach(b=>toast(`${b.emoji} Badge débloqué : ${b.label} !`));
  if(rare.length){ pendingRareBadges = pendingRareBadges.concat(rare); showNextRareBadge(); }
}
function showNextRareBadge(){
  if(!pendingRareBadges.length) return;
  const b = pendingRareBadges.shift();
  modal(`<div style="text-align:center;">
    <div style="font-size:60px;">${b.emoji}</div>
    <h3>🎉 Badge rare débloqué !</h3>
    <div style="font-weight:800;font-size:17px;color:var(--accent2);">${esc(b.label)}</div>
    <p style="font-size:13.5px;color:#666;">${esc(b.desc)}</p>
    <div class="actions" style="justify-content:center;"><button class="btn" onclick="showNextRareBadge()">${pendingRareBadges.length?'Suivant':'Trop bien !'}</button></div>
  </div>`);
}
function renderBadgesHTML(){
  const cats = Object.keys(BADGE_CATS);
  return `<h3 style="text-align:center;">🎖️ Tes badges : ${earnedBadges.size} / ${BADGES.length}</h3>
    ${cats.map(c=>{
      const items = BADGES.filter(b=>b.cat===c);
      return `<div style="margin-bottom:10px;"><div style="font-size:12.5px;font-weight:700;color:#888;margin-bottom:4px;">${BADGE_CATS[c].emoji} ${BADGE_CATS[c].label}</div>
      <div class="gal-grid2">${items.map(b=>{
        const has = earnedBadges.has(b.id);
        return has
          ? `<div class="pcard" title="${esc(b.desc)}"><div class="pe">${b.emoji}</div><div class="pn">${esc(b.label)}</div></div>`
          : `<div class="pcard locked" title="${esc(b.desc)}"><div class="pe">🔒</div><div class="pn">? ? ?</div></div>`;
      }).join('')}</div></div>`;
    }).join('')}
    <div class="actions" style="justify-content:center;"><button class="btn ghost" onclick="closeModal()">Fermer</button></div>`;
}
function openBadges(){ modal(renderBadgesHTML()); }

/* ---------- parent dashboard ---------- */
async function renderDashboard(){
  $('#main').innerHTML = '<div class="card">Chargement…</div>';
  const [scores, checks, persos, journal, chats, projets, assistants, badges, expoNotes, profiles] = await Promise.all([
    db.from('adalix_qcm_scores').select('*').order('created_at',{ascending:false}).limit(30),
    db.from('adalix_checklist').select('*').order('day',{ascending:false}).limit(60),
    db.from('adalix_personalities').select('*'),
    db.from('adalix_journal').select('*').order('created_at',{ascending:false}).limit(30),
    db.from('adalix_chat').select('*').order('created_at',{ascending:false}).limit(60),
    db.from('adalix_projet').select('*'),
    db.from('adalix_assistant').select('*'),
    db.from('adalix_badges').select('*'),
    db.from('adalix_expose_notes').select('*'),
    db.from('adalix_profiles').select('*'),
  ]);
  profilesCache = profiles.data||[];
  const S = scores.data||[], C = checks.data||[], P = persos.data||[], J = journal.data||[], CH = chats.data||[], PR = projets.data||[], AS = assistants.data||[], BD = badges.data||[];
  expoNotesCache = expoNotes.data||[];
  expoStars = {};
  expoNotesCache.forEach(r=>{ expoStars[r.child+'_'+r.expose_num] = r.stars; });
  const assistantOf = k => (AS.find(r=>r.child===k)||{}).name;
  const badgeCountOf = k => BD.filter(r=>r.child===k).length;
  const kids = ['adam','alix'];
  const kidName = k => k==='adam'?'🚀 Adam':'🎨 Alix';
  const streakOf = k => {
    const map = Object.fromEntries(C.filter(r=>r.child===k).map(r=>[r.day,r.completed]));
    let s=0; for(let i=0;i<60;i++){ const d=new Date(); d.setDate(d.getDate()-i); const key=d.toISOString().slice(0,10);
      if((map[key]||0)>=8) s++; else if(i===0) continue; else break; } return s; };
  $('#main').innerHTML = `<div class="narrow" style="max-width:900px;">
    <div class="stat-row">${kids.map(k=>`
      <div class="stat"><div class="v">${kidName(k)}</div>
        <div style="margin-top:8px;font-size:13px;">🔥 Série : <b>${streakOf(k)} j</b> · 🏆 Cartes : <b>${P.filter(p=>p.child===k).length}/${D.persons.length}</b></div>
        <div style="font-size:13px;">✅ Aujourd'hui : <b>${(C.find(r=>r.child===k&&r.day===todayStr())||{}).completed||0}/12</b> · 🎖️ Badges : <b>${badgeCountOf(k)}/${BADGES.length}</b></div>
      </div>`).join('')}</div>
    <div class="card"><h3>🧠 Derniers quiz</h3><table class="ptable"><tr><th>Qui</th><th>Quiz</th><th>Score</th><th>Date</th></tr>
      ${S.slice(0,12).map(r=>`<tr><td>${kidName(r.child)}</td><td>${esc(quizTitle(r.quiz_id))}</td><td><b>${r.score}/${r.total}</b></td><td>${new Date(r.created_at).toLocaleDateString('fr-FR')}</td></tr>`).join('')||'<tr><td colspan=4 style="color:#999;">Aucun quiz encore</td></tr>'}</table></div>
    ${renderProfilesCard()}
    ${renderExpoNotationCard()}
    <div class="card"><h3>💻 Leur projet du mois</h3>
      ${kids.map(k=>{
        const pr = PR.find(r=>r.child===k);
        if(!pr || !pr.idea) return `<div class="jentry"><div class="jd">${kidName(k)}</div><span style="color:#999;font-size:13px;">Pas encore choisi</span></div>`;
        return `<div class="jentry"><div class="jd">${kidName(k)} · Semaine ${pr.phase||1} · ${new Date(pr.updated_at).toLocaleDateString('fr-FR')}</div>
          <div><b>Idée choisie :</b> ${esc(pr.idea)}</div>${pr.notes?`<div><b>Dernière note :</b> ${esc(pr.notes)}</div>`:''}</div>`;
      }).join('')}
    </div>
    <div class="card"><h3>✍️ Leurs réalisations — journal du soir</h3>
      ${J.map(r=>`<div class="jentry"><div class="jd">${kidName(r.child)} · ${new Date(r.created_at).toLocaleDateString('fr-FR')}</div>
        ${r.learned?`<div><b>Appris :</b> ${esc(r.learned)}</div>`:''}${r.surprised?`<div><b>Étonné :</b> ${esc(r.surprised)}</div>`:''}</div>`).join('')||'<span style="color:#999;font-size:13px;">Rien pour l\'instant</span>'}</div>
    <div class="card"><h3>💬 Leurs conversations</h3>
      <div style="font-size:12px;color:#888;margin-bottom:4px;">${kids.map(k=>`${kidName(k)} a baptisé son assistant : <b>${esc(assistantOf(k)||'pas encore choisi')}</b>`).join(' · ')}</div>
      ${CH.slice(0,30).reverse().map(r=>`<div style="font-size:13px;padding:4px 0;border-bottom:1px solid #f0f2f6;"><b>${kidName(r.child)}${r.role==='assistant'?` ← ${esc(assistantOf(r.child)||'assistant')}`:''} :</b> ${esc(r.content.slice(0,180))}${r.content.length>180?'…':''}</div>`).join('')||'<span style="color:#999;font-size:13px;">Aucune conversation encore</span>'}</div>
    ${renderAdminPanel()}
  </div>`;
}

/* ---------- profils enfants pour l'assistant (parent) ---------- */
let profilesCache = [];
function renderProfilesCard(){
  const kids = ['adam','alix'];
  const kidName = k => k==='adam'?'🚀 Adam':'🎨 Alix';
  return `<div class="card"><h3>👤 Profils pour l'assistant IA</h3>
    <div style="font-size:12.5px;color:#888;margin-bottom:8px;">Tout ce que tu écris ici est transmis (discrètement) à l'assistant de chaque enfant : centres d'intérêt, caractère, ce qui le motive, ses difficultés, son niveau… Plus c'est riche, plus les réponses seront personnalisées. L'assistant ne révèle jamais qu'il a ce contexte.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">
      ${kids.map(k=>{
        const p = profilesCache.find(r=>r.child===k);
        return `<div>
          <div style="font-weight:800;color:var(--accent2);margin-bottom:4px;">${kidName(k)}</div>
          <textarea id="prof-${k}" rows="6" placeholder="Décris ${k==='adam'?'Adam':'Alix'}…">${esc(p?p.profile:'')}</textarea>
          <button class="btn" style="font-size:12.5px;padding:7px 14px;" onclick="saveProfile('${k}')">Enregistrer</button>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}
async function saveProfile(k){
  const el = $('#prof-'+k); if(!el) return;
  const profile = el.value.trim();
  const {error} = await db.from('adalix_profiles').upsert({child:k, profile, updated_at:new Date().toISOString()});
  if(error){ toast('Erreur — réessaie'); return; }
  const idx = profilesCache.findIndex(r=>r.child===k);
  if(idx>=0) profilesCache[idx].profile = profile; else profilesCache.push({child:k, profile});
  toast('Profil enregistré 👤');
}

/* ---------- notation des exposés (parent) ---------- */
let expoNotesCache = [];
let expoStars = {};
function expoNoteOf(k, num){ return expoNotesCache.find(r=>r.child===k && r.expose_num===num); }
function expoStarsHtml(k, num){
  const v = expoStars[k+'_'+num] || 0;
  return [1,2,3,4,5].map(i=>`<span onclick="setExpoStar('${k}',${num},${i})" style="cursor:pointer;font-size:24px;color:${i<=v?'#c98f2f':'#ccd4e0'};">★</span>`).join('');
}
function setExpoStar(k, num, v){
  expoStars[k+'_'+num] = v;
  const el = $('#stars-'+k+'-'+num);
  if(el) el.innerHTML = expoStarsHtml(k, num);
}
function renderExpoNotationCard(){
  const kids = ['adam','alix'];
  const kidName = k => k==='adam'?'🚀 Adam':'🎨 Alix';
  return `<div class="card"><h3>🎤 Exposés — notation</h3>
    <div style="font-size:12.5px;color:#888;margin-bottom:8px;">Note chaque exposé (1 à 5 étoiles) et laisse un petit mot — l'enfant verra ton avis sur la page du jour de son exposé.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">
      ${kids.map(k=>`<div>
        <div style="font-weight:800;color:var(--accent2);margin-bottom:6px;">${kidName(k)}</div>
        ${EXPOSES.map(e=>{
          const existing = expoNoteOf(k, e.num);
          return `<div class="jentry">
            <div class="jd">${e.label} · ${e.date}${existing?` · noté le ${new Date(existing.updated_at).toLocaleDateString('fr-FR')}`:''}</div>
            <div id="stars-${k}-${e.num}">${expoStarsHtml(k, e.num)}</div>
            <textarea id="cmt-${k}-${e.num}" rows="2" placeholder="Ton commentaire…">${esc(existing?existing.comment:'')}</textarea>
            <button class="btn" style="font-size:12.5px;padding:7px 14px;" onclick="saveExpoNote('${k}',${e.num})">${existing?'Mettre à jour':'Enregistrer'}</button>
          </div>`;
        }).join('')}
      </div>`).join('')}
    </div>
  </div>`;
}
async function saveExpoNote(k, num){
  const stars = expoStars[k+'_'+num] || 0;
  if(!stars){ toast("Choisis d'abord un nombre d'étoiles ⭐"); return; }
  const cmtEl = $('#cmt-'+k+'-'+num);
  const comment = cmtEl ? cmtEl.value.trim() : '';
  const {error} = await db.from('adalix_expose_notes').upsert(
    {child:k, expose_num:num, stars, comment, updated_at:new Date().toISOString()},
    {onConflict:'child,expose_num'});
  if(error){ toast('Erreur — réessaie'); return; }
  const idx = expoNotesCache.findIndex(r=>r.child===k && r.expose_num===num);
  const rec = {child:k, expose_num:num, stars, comment, updated_at:new Date().toISOString()};
  if(idx>=0) expoNotesCache[idx] = rec; else expoNotesCache.push(rec);
  toast('Note enregistrée ⭐');
}

/* ---------- administration ---------- */
let adminScope = 'adam';
const RESET_TABLES = [
  {key:'checklist', table:'adalix_checklist', label:'Checklist quotidienne'},
  {key:'quiz', table:'adalix_qcm_scores', label:'Scores de quiz'},
  {key:'personnalites', table:'adalix_personalities', label:'Galerie de personnalités'},
  {key:'journal', table:'adalix_journal', label:'Journal du soir'},
  {key:'chat', table:'adalix_chat', label:'Conversations avec l\'assistant'},
  {key:'projet', table:'adalix_projet', label:'Projet du mois'},
  {key:'assistant', table:'adalix_assistant', label:'Nom de l\'assistant'},
  {key:'badges', table:'adalix_badges', label:'Badges débloqués'},
  {key:'exposes', table:'adalix_expose_notes', label:'Notes des exposés'},
  {key:'pepites', table:'adalix_saved', label:'Pépites du chat'},
];
function renderAdminPanel(){
  return `<div class="card" style="border-left:4px solid #c9636a;">
    <h3>⚙️ Administration</h3>
    <p style="font-size:12.5px;color:#888;">Réinitialise tout ou partie des données. Ces actions sont irréversibles.</p>
    <div style="margin:8px 0;">
      <label style="font-size:13px;font-weight:700;">Enfant concerné : </label>
      <select id="admin-scope" onchange="adminScope=this.value" style="padding:6px;border-radius:8px;border:1.5px solid #ccd4e0;">
        <option value="adam" ${adminScope==='adam'?'selected':''}>🚀 Adam</option>
        <option value="alix" ${adminScope==='alix'?'selected':''}>🎨 Alix</option>
        <option value="all" ${adminScope==='all'?'selected':''}>Les deux</option>
      </select>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${RESET_TABLES.map(t=>`<button class="btn ghost" style="font-size:12.5px;" onclick="confirmReset('${t.key}','${esc(t.label).replace(/'/g,"\\'")}')">↺ ${esc(t.label)}</button>`).join('')}
    </div>
    <div class="actions" style="margin-top:12px;">
      <button class="btn" style="background:#c9636a;" onclick="confirmReset('all','TOUT (toutes les données)')">⚠️ Tout réinitialiser</button>
    </div>
  </div>`;
}
function confirmReset(key, label){
  const scopeLabel = adminScope==='all' ? 'Adam ET Alix' : (adminScope==='adam'?'Adam':'Alix');
  modal(`<h3>⚠️ Confirmer la réinitialisation</h3>
    <p style="font-size:14px;">Tu vas réinitialiser <b>${esc(label)}</b> pour <b>${scopeLabel}</b>. Cette action est irréversible.</p>
    <div class="actions"><button class="btn" style="background:#c9636a;" onclick="doReset('${key}')">Confirmer</button><button class="btn ghost" onclick="closeModal()">Annuler</button></div>`);
}
async function doReset(key){
  closeModal();
  const targets = key==='all' ? RESET_TABLES : RESET_TABLES.filter(t=>t.key===key);
  for(const t of targets){
    let q = db.from(t.table).delete();
    q = adminScope==='all' ? q.neq('child','__all__') : q.eq('child', adminScope);
    await q;
  }
  toast('Réinitialisé ✅');
  renderDashboard();
}

/* ---------- boot ---------- */
(function(){
  const saved = localStorage.getItem('adalix_child');
  // always show profile screen on load (le même appareil peut servir aux deux)
})();
