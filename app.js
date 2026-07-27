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
const MAX_NEW_PERSONS_PER_DAY = 3;

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
  buildNav(['programme','quiz','les100','checklist','projet','chat']);
  assistantName = null;
  loadUnlocked(); refreshStreak(); loadAssistantName();
  showTab('programme');
}
async function loadAssistantName(){
  const {data} = await db.from('adalix_assistant').select('name').eq('child',child).maybeSingle();
  assistantName = (data && data.name) || null;
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
    buildNav(['dashboard']);
    showTab('dashboard');
  } else { toast('Code incorrect'); }
}
function logout(){ location.reload(); }

/* ---------- nav ---------- */
const TABS = {
  programme:{icon:'📅',label:'Programme'}, quiz:{icon:'🧠',label:'Quiz'},
  les100:{icon:'🏆',label:'Les 100'}, checklist:{icon:'✅',label:'Checklist'},
  projet:{icon:'💻',label:'Mon projet'},
  chat:{icon:'💬',label:'Questions'}, dashboard:{icon:'📊',label:'Tableau de bord'},
};
// icônes réhabillées selon le profil — mêmes intitulés, juste l'esprit visuel qui change
const THEME_ICONS = {
  adam: {programme:'🗺️', quiz:'🐲', les100:'🏆', checklist:'📜', projet:'⚒️', chat:'🔮'},
  alix: {programme:'🌿', quiz:'🦊', les100:'🦋', checklist:'🐣', projet:'🎨', chat:'🐰'},
};
function tabIcon(t){ return (THEME_ICONS[child] && THEME_ICONS[child][t]) || TABS[t].icon; }
function buildNav(tabs){
  $('#navbar').innerHTML = tabs.map(t=>`<button id="nav-${t}" onclick="showTab('${t}')">${tabIcon(t)} ${TABS[t].label}</button>`).join('');
}
function showTab(t){
  tab = t;
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  const nb = $('#nav-'+t); if(nb) nb.classList.add('active');
  ({programme:renderProgramme, quiz:renderQuizList, les100:renderGallery, checklist:renderChecklist, projet:renderProjet, chat:renderChat, dashboard:renderDashboard}[t])();
}

/* ---------- programme ---------- */
function renderProgramme(){
  const w = D.weeks[currentWeek];
  $('#main').innerHTML = `
    <div class="week-pills">${D.weeks.map((wk,i)=>`<button class="${i===currentWeek?'active':''}" onclick="currentWeek=${i};renderProgramme()">S${wk.num}</button>`).join('')}</div>
    <div class="card"><h3>Semaine ${w.num} — ${esc(w.title)}</h3><div style="font-size:13px;color:#888;">${esc(w.dates)}</div></div>
    <div class="day-list">${w.days.map((d,i)=>`<div class="day-item" onclick="renderDay(${currentWeek},${i})">
      <div class="emoji">${d.emoji}</div>
      <div><div class="di-title">${esc(d.title)}</div><div class="di-sub">${esc(d.dow)} ${esc(d.date)} · ${esc(d.theme)}</div></div>
    </div>`).join('')}</div>`;
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
async function renderDay(wi, di){
  const d = D.weeks[wi].days[di];
  const remaining = child==='parent' ? MAX_NEW_PERSONS_PER_DAY : Math.max(0, MAX_NEW_PERSONS_PER_DAY - await countUnlockedToday());
  $('#main').innerHTML = `
    <div class="narrow">
    <button class="back-btn" onclick="renderProgramme()">← Semaine ${D.weeks[wi].num}</button>
    <div class="card day-detail">
      <div class="theme-tag">${esc(d.dow)} ${esc(d.date)} · ${esc(d.theme)}</div>
      <h2>${d.emoji} ${esc(d.title)}</h2>
      <p style="font-size:14.5px;line-height:1.55;">${esc(d.summary)}</p>
      <div class="ecrit-box"><b>✍️ Écriture :</b> ${esc(d.ecrit)}</div>
    </div>
    ${renderCases(d.cases)}
    ${d.logique ? `<div class="card"><h3>🧠 Logique & rhétorique du jour</h3>
      <div style="font-size:13px;font-weight:700;color:var(--accent2);margin-bottom:4px;">${esc(d.logique.titre)}</div>
      <p style="font-size:14px;line-height:1.55;">${esc(d.logique.texte)}</p>
    </div>` : ''}
    <div class="card"><h3>🔗 À explorer</h3><div class="links">${d.links.map(l=>`<a href="${l.u}" target="_blank" rel="noopener">${esc(l.t)} ↗</a>`).join('')}</div></div>
    <div class="card"><h3>👤 Personnalités du jour</h3>
      <div style="font-size:13px;color:#888;">Choisis-en 2 ou 3 à découvrir aujourd'hui — clique pour ouvrir la fiche.</div>
      <div style="font-size:12.5px;color:${remaining>0?'#888':'#c9636a'};margin:3px 0 6px;">${remaining>0?`Encore ${remaining} nouvelle${remaining>1?'s':''} carte${remaining>1?'s':''} à collectionner aujourd'hui.`:"Limite du jour atteinte — tu peux encore lire les fiches, la collection continuera demain."}</div>
      <div class="persos-chips">${d.persos.map(p=>`<button class="perso-chip" onclick="openPerson('${esc(p).replace(/'/g,"\\'")}')">${personEmoji(p)} ${esc(p)}</button>`).join('')}</div>
    </div>
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
      db.from('adalix_personalities').insert({child, person:name}).then(()=>{});
    }
  }
  modal(`<div style="text-align:center;font-size:46px;">${p.emoji}</div>
    <h3 style="text-align:center;">${esc(p.name)}</h3>
    <div style="text-align:center;font-size:12.5px;color:#888;">${esc(p.meta)} · ${p.catEmoji} ${esc(p.cat)}</div>
    <p style="text-align:center;font-weight:700;color:var(--accent2);">« ${esc(p.tagline)} »</p>
    <p style="font-size:14px;line-height:1.5;">${esc(p.desc)}</p>
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
      <div style="font-size:13px;color:#888;">Découvre les personnalités dans les fiches du jour, ou clique sur une carte mystère pour la révéler.</div></div>
    <div class="gal-filter"><button class="${galFilter==='all'?'active':''}" onclick="galFilter='all';renderGallery()">Toutes</button>
      ${cats.map(c=>`<button class="${galFilter===c?'active':''}" onclick="galFilter='${esc(c).replace(/'/g,"\\'")}';renderGallery()">${esc(c)}</button>`).join('')}</div>
    <div class="gal-grid2">${shown.map(p=>{
      const un = unlocked.has(p.name);
      return un
        ? `<div class="pcard" onclick="openPerson('${esc(p.name).replace(/'/g,"\\'")}')"><div class="pe">${p.emoji}</div><div class="pn">${esc(p.name)}</div><div class="pt2">${esc(p.tagline)}</div></div>`
        : `<div class="pcard locked" onclick="openPerson('${esc(p.name).replace(/'/g,"\\'")}')"><div class="pe">${p.catEmoji}</div><div class="pn">? ? ?</div><div class="pt2">${esc(p.cat)}</div></div>`;
    }).join('')}</div>`;
}

/* ---------- quiz ---------- */
let quizState = null;
function renderQuizList(){
  $('#main').innerHTML = `
    <div class="card"><h3>🧠 Les quiz du Grand Été</h3><div style="font-size:13px;color:#888;">Chronométré, noté, enregistré. Objectif : 7/10 minimum. Le grand quiz final pioche dans tout le mois !</div></div>
    <div class="quiz-list">
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
function quizTitle(id){ return id==='final' ? 'Grand quiz final' : (D.quizzes[id]?D.quizzes[id].title.split('—')[0].trim():id); }
function startQuiz(id){
  let questions;
  if(id==='final'){
    const all = Object.values(D.quizzes).flatMap(q=>q.questions);
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
  if(id==='projet' && !todayItems[id]){ showTab('projet'); return; }
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
}
async function saveChecklist(){
  const completed = D.checklist.filter(it=>todayItems[it.id]).length;
  await db.from('adalix_checklist').upsert({child, day:todayStr(), items:todayItems, completed, updated_at:new Date().toISOString()});
  refreshStreak();
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
  const curPhase = currentWeek+1;
  $('#main').innerHTML = `<div class="narrow">
    <div class="card"><h3>💻 Ton projet du mois</h3>
      <div style="font-size:13.5px;color:#666;line-height:1.5;">${esc(P.intro)}</div>
    </div>
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
      <div class="actions"><button class="btn" onclick="saveProjetNotes()">Enregistrer</button></div>
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
}

/* ---------- chat ---------- */
function renderChat(){
  if(!assistantName){ askAssistantName(); return; }
  $('#main').innerHTML = `<div class="narrow">
    <div class="card"><h3>💬 Pose toutes tes questions à ${esc(assistantName)}</h3>
      <div style="font-size:13px;color:#888;">Je suis ${esc(assistantName)}, ton assistant du Grand Été. Histoire, sciences, économie, mots compliqués… demande-moi tout !</div>
      <div id="chat-box"></div>
      <div class="chat-input">
        <input type="text" id="chat-in" placeholder="Ta question…" onkeydown="if(event.key==='Enter')sendChat()">
        <button class="btn" onclick="sendChat()">➤</button>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
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
  box.innerHTML = chatMsgs.map(m=>`<div class="msg ${m.role==='user'?'user':'bot'}">${esc(m.content)}</div>`).join('') || '<div style="color:#999;font-size:13px;text-align:center;margin-top:30px;">Aucun message — pose ta première question !</div>';
  box.scrollTop = box.scrollHeight;
}
async function sendChat(){
  const inp = $('#chat-in'); const text = inp.value.trim(); if(!text) return;
  inp.value=''; chatMsgs.push({role:'user', content:text}); drawChat();
  db.from('adalix_chat').insert({child, role:'user', content:text}).then(()=>{});
  chatMsgs.push({role:'assistant', content:'…'}); drawChat();
  try {
    const r = await fetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({child, assistantName, messages: chatMsgs.slice(0,-1).slice(-12)})});
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

/* ---------- parent dashboard ---------- */
async function renderDashboard(){
  $('#main').innerHTML = '<div class="card">Chargement…</div>';
  const [scores, checks, persos, journal, chats, projets, assistants] = await Promise.all([
    db.from('adalix_qcm_scores').select('*').order('created_at',{ascending:false}).limit(30),
    db.from('adalix_checklist').select('*').order('day',{ascending:false}).limit(60),
    db.from('adalix_personalities').select('*'),
    db.from('adalix_journal').select('*').order('created_at',{ascending:false}).limit(30),
    db.from('adalix_chat').select('*').order('created_at',{ascending:false}).limit(60),
    db.from('adalix_projet').select('*'),
    db.from('adalix_assistant').select('*'),
  ]);
  const S = scores.data||[], C = checks.data||[], P = persos.data||[], J = journal.data||[], CH = chats.data||[], PR = projets.data||[], AS = assistants.data||[];
  const assistantOf = k => (AS.find(r=>r.child===k)||{}).name;
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
        <div style="font-size:13px;">✅ Aujourd'hui : <b>${(C.find(r=>r.child===k&&r.day===todayStr())||{}).completed||0}/12</b></div>
      </div>`).join('')}</div>
    <div class="card"><h3>🧠 Derniers quiz</h3><table class="ptable"><tr><th>Qui</th><th>Quiz</th><th>Score</th><th>Date</th></tr>
      ${S.slice(0,12).map(r=>`<tr><td>${kidName(r.child)}</td><td>${esc(quizTitle(r.quiz_id))}</td><td><b>${r.score}/${r.total}</b></td><td>${new Date(r.created_at).toLocaleDateString('fr-FR')}</td></tr>`).join('')||'<tr><td colspan=4 style="color:#999;">Aucun quiz encore</td></tr>'}</table></div>
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
