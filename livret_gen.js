/* Génère livret_adam.html et livret_alix.html à partir de data.js */
const fs = require('fs');
global.window = {};
require('./data.js');
const D = global.window.DATA;

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const KIDS = {
  adam: { prenom:'Adam', age:13, emoji:'🐉', tag:"13 ans · explorateur d'idées",
    accent:'#c9962c', accent2:'#16241a', soft:'#f3ead3', assistantHint:'ton assistant (celui que tu as baptisé dans l’app)' },
  alix: { prenom:'Alix', age:11, emoji:'🦊', tag:'11 ans · créatrice d’histoires',
    accent:'#e8798f', accent2:'#a34a68', soft:'#fff2f4', assistantHint:'ton assistant (celui que tu as baptisé dans l’app)' },
};

const cb = '<span class="cb"></span>';

function planningTable(){
  return `<table class="plan"><tr><th></th>${['Lun','Mar','Mer','Jeu','Ven','Sam'].map(d=>`<th>${d}</th>`).join('')}</tr>
  ${D.weeks.map(w=>`<tr><td class="wk">S${w.num}<br><span>${esc(w.title)}</span><br><span class="dates">${esc(w.dates)}</span></td>
    ${w.days.map(d=>`<td>${d.emoji} ${esc(d.title.split('·')[0].split(':')[0].trim())}<br><span class="theme">${esc(d.theme)}</span></td>`).join('')}</tr>`).join('')}
  </table>`;
}

function weekPage(wi, intro, pourquoi){
  const w = D.weeks[wi];
  return `<section class="page">
    <h1>Semaine ${w.num} — ${esc(w.title)} <span class="dates">· ${esc(w.dates)}</span></h1>
    <p class="lead">${intro}</p>
    <div class="box why"><b>Pourquoi cette semaine compte :</b> ${pourquoi}</div>
    ${w.days.map(d=>`<div class="dayrow"><div class="daylabel">${d.emoji} <b>${esc(d.dow)} ${esc(d.date)}</b><br><span class="theme">${esc(d.theme)}</span></div>
      <div class="daybody"><b>${esc(d.title)}</b><br>${esc(d.summary.length>260 ? d.summary.slice(0, d.summary.lastIndexOf(' ',260))+'…' : d.summary)}</div></div>`).join('')}
  </section>`;
}

function livret(kid){
  const K = KIDS[kid];
  const ideas = D.projet[kid].ideas;
  const cats = [...new Set(D.persons.map(p=>p.cat))];

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 13mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Lora', serif; font-size: 10.3pt; line-height: 1.5; color: #26282e; margin:0; }
  h1,h2,h3 { font-family:'Poppins',sans-serif; color:${K.accent2}; }
  h1 { font-size:17pt; border-bottom:3px solid ${K.accent}; padding-bottom:4px; margin:0 0 10px; }
  h2 { font-size:12.5pt; margin:14px 0 4px; }
  h3 { font-size:11pt; margin:10px 0 3px; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .lead { font-size:10.8pt; }
  .dates { color:#888; font-size:10pt; font-weight:400; }
  .box { background:${K.soft}; border-left:4px solid ${K.accent}; border-radius:6px; padding:8px 12px; margin:8px 0; }
  .why { background:#fdf6ec; border-left-color:#c98f2f; }
  .cols2 { column-count:2; column-gap:8mm; }
  .cb { display:inline-block; width:9px; height:9px; border:1.4px solid ${K.accent2}; border-radius:2px; margin-right:5px; vertical-align:-1px; }
  ul { margin:4px 0 8px 16px; padding:0; } li { margin-bottom:3px; }
  table.plan { width:100%; border-collapse:collapse; font-size:7.6pt; line-height:1.3; margin-top:6px; }
  table.plan th { background:${K.accent2}; color:white; padding:4px 3px; font-family:'Poppins'; font-size:8pt; }
  table.plan td { border:1px solid #ddd; padding:4px 4px; vertical-align:top; }
  table.plan td.wk { background:${K.soft}; font-family:'Poppins'; font-weight:600; font-size:8pt; width:16mm; }
  table.plan td.wk span { font-weight:400; font-size:6.8pt; color:#666; }
  table.plan .theme, .theme { color:#999; font-size:7pt; font-style:italic; }
  .dayrow { display:flex; gap:5mm; border-bottom:1px solid #eee; padding:5px 0; font-size:9.3pt; }
  .daylabel { width:30mm; flex-shrink:0; font-size:8.6pt; }
  .cover { height:257mm; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;
    background:linear-gradient(160deg, ${K.accent2}, ${K.accent}); color:white; border-radius:8px; padding:20mm; }
  .cover h1 { color:white; border:none; font-size:34pt; margin:6mm 0 2mm; }
  .cover .big { font-size:60pt; }
  .cover p { font-size:12pt; opacity:.92; }
  .cover .site { margin-top:14mm; background:rgba(255,255,255,.15); border-radius:10px; padding:6px 18px; font-family:'Poppins'; font-size:11pt; }
  .kv { display:flex; gap:4mm; margin:6px 0; font-size:9.5pt; }
  .kv > div { flex:1; background:${K.soft}; border-radius:6px; padding:6px 10px; }
  .gal { font-size:8.1pt; line-height:1.55; }
  .gal h3 { column-span:all; margin:8px 0 3px; }
  .timeline td { vertical-align:top; padding:2px 6px 2px 0; font-size:9pt; }
  .timeline td:first-child { font-family:'Poppins'; font-weight:600; color:${K.accent2}; white-space:nowrap; width:22mm; }
  .small { font-size:8.6pt; color:#555; }
  .notice { font-size:8.8pt; color:#a33; background:#fbecec; border-radius:6px; padding:6px 10px; margin-bottom:8px; }
  .lines { border-bottom:1px dotted #bbb; height:7mm; }
  </style></head><body>

  <!-- ═══ COUVERTURE ═══ -->
  <section class="page"><div class="cover">
    <div class="big">${K.emoji}</div>
    <h1>Le Grand Été<br>d'${K.prenom}</h1>
    <p>${esc(K.tag)}</p>
    <p><b>27 juillet → 23 août 2026</b> · 4 semaines pour apprendre, douter, raconter et créer</p>
    <div class="site">🌐 adalix-knowledge.vercel.app</div>
    <p style="margin-top:12mm;font-size:10pt;opacity:.8;">Géographie · Histoire · Économie · Géopolitique · Logique &amp; rhétorique · IA · Maths curieuses · Esprit critique</p>
  </div></section>

  <!-- ═══ MODE D'EMPLOI ═══ -->
  <section class="page">
    <h1>📖 Comment fonctionne ton Grand Été</h1>
    <p class="lead">Deux compagnons pour un même voyage. <b>Le site</b> (adalix-knowledge.vercel.app) est ton pilote quotidien : il s'ouvre chaque matin sur le programme du jour, avec le déroulé pas à pas, les quiz, ta collection de personnalités, ta checklist, ton projet, ton assistant IA et tes badges. <b>Ce livret</b> est ta base papier : le pourquoi des choses, les connaissances à retenir, les antisèches — et il ne tombe jamais en panne de wifi.</p>
    <div class="box"><b>Ta journée type (~1h30, six jours sur sept — repos le dimanche) :</b><br>
    🌐 Ouvre le site → la page du jour s'affiche → suis le déroulé (lecture, vidéo, activité, quiz ou exposé selon le jour) → cartes « IA du jour » et « Logique &amp; rhétorique » → une étape de ton projet → le soir, checklist et écriture (appris / étonné).</div>
    <h2>Les onglets du site, en bref</h2>
    <ul>
      <li><b>📅 Programme</b> — la page du jour, cœur de l'app, avec le déroulé et les flèches jour par jour.</li>
      <li><b>🧠 Quiz</b> — le quiz des capitales (à refaire en S4 pour mesurer tes progrès !), un QCM par semaine (objectif 70 %), et le grand quiz final.</li>
      <li><b>🏆 Les 100</b> — 103 personnalités à collectionner : tu choisis librement lesquelles, 3 nouvelles par jour, chaque fiche a sa vidéo « Quelle Histoire ».</li>
      <li><b>✅ Checklist</b> — tes 12 gestes quotidiens ; chaque journée complète allume ta série 🔥.</li>
      <li><b>💻 Mon projet</b> — ton projet du mois, guidé jour par jour (l'étape du jour s'affiche).</li>
      <li><b>💬 Questions</b> — ton assistant IA : pose-lui tout, envoie-lui même des images et des captures d'écran.</li>
      <li><b>📖 Guide</b> — le mode d'emploi complet, à relire quand tu veux.</li>
    </ul>
    <h2>Tes 4 semaines en un coup d'œil</h2>
    ${planningTable()}
  </section>

  <!-- ═══ POURQUOI UNE ROUTINE ═══ -->
  <section class="page">
    <h1>🔥 Pourquoi une routine ? (la vraie raison)</h1>
    <p class="lead">Une routine n'est pas une punition de parent : c'est une <b>technologie</b>, étudiée par les scientifiques, utilisée par les sportifs de haut niveau, les artistes et les astronautes. Voici pourquoi elle marche — pour de vrai.</p>
    <h2>1. Les petites victoires font tourner le moteur</h2>
    <p>Des chercheurs ont analysé des milliers de journées de travail pour trouver ce qui motive le plus les gens. Réponse surprenante : ni les récompenses, ni les compliments, mais <b>la sensation d'avancer</b> — même d'un petit pas. Ton cerveau compte les cases cochées, pas leur taille : un lit fait « vaut » une victoire, comme un chapitre lu. À 9h du matin, avec l'eau, le lit, la lecture et la balade cochées, tu n'espères plus gagner ta journée : <b>tu l'attaques déjà gagnant.</b></p>
    <h2>2. Chaque case cochée est un vote</h2>
    <p>Tu ne deviens pas discipliné en le décidant un soir de motivation. Tu le deviens parce que tu as coché « lecture » cent matins de suite — et qu'à force, « je suis quelqu'un qui lit » n'est plus un rêve mais une <b>description</b>. Chaque répétition est un vote pour la personne que tu deviens. C'est comme ça que se construisent les identités : par l'action répétée, pas par la déclaration.</p>
    <h2>3. Une chaîne, pas une liste</h2>
    <p>Le secret des routines qui tiennent : chaque geste s'accroche au précédent. Le verre d'eau entraîne le lit, le lit entraîne la lecture… Il ne reste qu'<b>une seule décision à prendre : démarrer</b>. C'est aussi pour ça que l'ordre compte : commencer par le téléphone place la barre du plaisir si haut que tout le reste paraît fade ensuite. Commencer par un livre, et le monde reste intéressant.</p>
    <h2>4. Environ 66 jours pour un automatisme</h2>
    <p>Les études montrent qu'un geste répété devient automatique en 66 jours en moyenne (entre 18 et 254 selon les gens et les gestes). Ton mois d'été, c'est la moitié du chemin pour tes habitudes de l'année. Et retiens la règle du <b>pardon</b> : un jour raté n'annule rien — les scientifiques l'ont vérifié. On ne casse pas une chaîne en sautant un maillon, on la casse en s'arrêtant.</p>
    <h2>5. Les deux serre-livres de la journée</h2>
    <p>Le milieu de ta journée ne t'appartient jamais complètement (les autres, les imprévus). Mais le premier geste du matin et le dernier du soir, si. C'est pour ça que ta checklist commence par des objectifs écrits le matin (ce qu'on écrit, le cerveau le repère toute la journée) et se termine par l'écriture du soir : ce que tu as appris, ce qui t'a étonné. <b>Tu choisis ta première pensée et ta dernière</b> — les deux serre-livres qui tiennent la journée debout.</p>
    <div class="box"><b>Ta checklist des 12 gestes :</b> ${D.checklist.map(c=>c.emoji+' '+esc(c.label)).join(' · ')}</div>
  </section>

  <!-- ═══ POURQUOI CES THÈMES ═══ -->
  <section class="page">
    <h1>🧭 Pourquoi ces thèmes ? Le fil des 4 semaines</h1>
    <p class="lead">Ce programme n'est pas un empilement de matières : c'est <b>un seul voyage en quatre étapes</b>, qui mène d'une question — comment savoir ce qui est vrai ? — à une capacité : penser par toi-même.</p>
    <div class="box"><b>S1 · Douter et vérifier</b> → <b>S2 · Raconter et convaincre</b> → <b>S3 · Comprendre les mécanismes</b> → <b>S4 · Penser par toi-même</b></div>
    <h2>Pourquoi chaque fil compte</h2>
    <ul>
      <li><b>🗺️ La géographie (lundis)</b> — c'est la scène où toute l'actualité se joue. Impossible de comprendre une guerre, un accord commercial ou une crise climatique sans savoir placer les acteurs sur la carte.</li>
      <li><b>🏛️ « Qui écrit l'histoire ? » (mardis)</b> — le fil le plus important du mois. César, Cortés, Zinn, les Amérindiens : quatre fois la même leçon — celui qui gagne écrit le livre. Qui la connaît lit tout autrement : les manuels, les infos, et même les récits de cour de récré.</li>
      <li><b>💰 L'économie (mercredis)</b> — le langage dans lequel le monde prend ses vraies décisions. Smith, Marx, Ricardo, Keynes, la Bourse, le dollar : comprendre ces mécanismes, c'est ne plus subir les mots « inflation », « dette » ou « marché » comme des formules magiques.</li>
      <li><b>🌐 La géopolitique (jeudis)</b> — apprendre à lire un conflit comme un adulte informé : qui sont les acteurs, que disent-ils vouloir, que veulent-ils vraiment, et qui raconte quoi.</li>
      <li><b>🧠 Logique &amp; rhétorique (tous les jours)</b> — les armes de l'esprit. La rhétorique pour convaincre — et repérer quand on essaie de te manipuler ; la logique pour distinguer un raisonnement qui tient d'un raisonnement qui triche. Tout le reste du programme s'appuie dessus.</li>
      <li><b>🤖 L'IA (tous les jours)</b> — tu vis la révolution technologique de TON siècle. En 24 notions : d'où elle vient, comment fonctionne un modèle de langage, ce qu'elle peut apporter, quels métiers elle bouscule — et comment garder ton cerveau aux commandes.</li>
      <li><b>🔢 Les maths curieuses (vendredis)</b> — le nombre d'or, Fibonacci, les fractales : les maths comme on ne te les montre jamais, belles et cachées partout dans la nature.</li>
      <li><b>🔍 L'esprit critique (samedis)</b> — le complot lunaire, les sophismes, le fact-checking : l'entraînement pratique qui assemble tout. À l'ère des deepfakes, c'est un équipement de survie.</li>
      <li><b>🎤 Les exposés (vendredis)</b> — savoir, c'est bien ; savoir le <b>dire</b>, c'est le superpouvoir. Quatre exposés, quatre outils, une méthode : accroche, 3 idées, chute.</li>
      <li><b>💻 Ton projet (tous les jours)</b> — savoir <b>faire</b> : une création à toi, menée de l'idée à la démo, comme un vrai projet de pro.</li>
    </ul>
  </section>

  <!-- ═══ 4 PAGES SEMAINES ═══ -->
  ${weekPage(0,
    "Tout commence par une question d'hygiène mentale : comment savoir ce qui est vrai ? Cette semaine, tu apprends à douter proprement — pas à douter de tout (ça, c'est de la paresse), mais à vérifier ce qui mérite de l'être.",
    "C'est le socle. Le quiz des capitales t'apprend l'humilité (on croit savoir…), César t'apprend que même les livres d'histoire ont un narrateur, et le complot lunaire t'apprend à démonter une théorie séduisante avec de la physique de collège. Tout le mois s'appuie sur ces réflexes.")}
  ${weekPage(1,
    "Maintenant que tu sais vérifier, apprends à raconter et à convaincre — et à reconnaître quand on te raconte et qu'on te convainc. Storytelling, sophismes : les deux faces de la même médaille.",
    "Le storytelling est l'arme la plus puissante du monde (demande aux publicitaires), et les sophismes sont ses tricheries préférées. Cette semaine te donne les deux : l'art de captiver honnêtement, et le radar anti-triche. Le jeudi, lecture en famille : le conflit israélo-palestinien — deux narrateurs sincères, le cas le plus difficile du monde réel.")}
  ${weekPage(2,
    "Sous les récits, il y a des mécanismes : la Bourse, la dette, les médias, les biais. Cette semaine, tu ouvres les capots pour voir comment ça marche à l'intérieur.",
    "Comprendre un mécanisme, c'est ne plus pouvoir se faire avoir par lui. Après cette semaine, « la Bourse a dévissé » ou « la dette explose » ne seront plus des formules magiques — et l'atelier fact-checking du samedi te donne la méthode des journalistes professionnels, celle que tu garderas toute ta vie.")}
  ${weekPage(3,
    "La dernière semaine (chez papa) assemble tout : religions et laïcité, le grand débat économique, la logique formelle… et le moment où tu passes de lecteur à AUTEUR : écrire toi-même le même événement avec deux narrateurs.",
    "C'est la destination du voyage : penser par toi-même. Plus personne ne te dit quoi penser — on te demande de construire, d'argumenter, de débattre en repérant les sophismes des autres. Et le samedi 22 : exposé final, grand quiz, re-match des capitales… et la fête. Tu l'auras méritée.")}

  <!-- ═══ CONNAISSANCES : HISTOIRE ═══ -->
  <section class="page">
    <h1>🏛️ À retenir — Qui écrit l'histoire ?</h1>
    <p class="lead">Le fil rouge des mardis, en une page. Quatre histoires, une seule leçon.</p>
    <h2>César et les Gaulois (S1)</h2>
    <p>Pendant 2000 ans, on a cru les Gaulois barbares… parce que le seul récit venait de leur vainqueur : la « Guerre des Gaules », écrite par César lui-même, à la 3e personne pour paraître neutre. L'archéologie (Bibracte, Alésia) a redécouvert des artisans brillants — tonneau, cotte de mailles, villes fortifiées. <b>Leçon : demande toujours qui raconte, et ce qu'il a à y gagner.</b></p>
    <h2>La conquête de l'Amérique (S2)</h2>
    <p>500 Espagnols n'ont pas vaincu un empire par génie : la variole a tué plus que les épées, et Cortés avait des dizaines de milliers d'alliés indigènes. Les codex aztèques ont été brûlés par milliers — la version des vaincus, effacée. Un moine, Las Casas, a documenté les massacres : le premier lanceur d'alerte. <b>Leçon : quand une victoire paraît miraculeuse, cherche ce que le récit ne dit pas.</b></p>
    <h2>Howard Zinn et l'histoire vue d'en bas (S3)</h2>
    <p>En 1980, Zinn raconte l'Amérique depuis ceux qu'on n'interroge jamais. Exemple : « tous les hommes naissent égaux » (1776) est écrit par des propriétaires d'esclaves ; l'esclavage dure encore 90 ans, puis les lois Jim Crow imposent la ségrégation un siècle de plus, jusqu'au mouvement des droits civiques (Rosa Parks, Martin Luther King). <b>Leçon : le récit officiel retient les grandes dates ; l'histoire complète retient aussi ceux qui ont résisté. Et Zinn aussi doit être croisé avec d'autres sources !</b></p>
    <h2>Les Amérindiens — à toi d'écrire (S4)</h2>
    <p>Des centaines de traités signés puis rompus, le Sentier des larmes (1830, ~4000 morts), Wounded Knee (1890)… et plus de 570 nations amérindiennes toujours vivantes aujourd'hui. Le mot « pionnier » n'a pas le même sens des deux côtés de la même colline. <b>Cette fois, c'est toi le narrateur : même événement, deux récits sincères.</b></p>
  </section>

  <!-- ═══ CONNAISSANCES : ÉCO ═══ -->
  <section class="page">
    <h1>💰 À retenir — L'économie en 4 matchs</h1>
    <h2>Match 1 · Smith contre Marx (S1)</h2>
    <p><b>Adam Smith (1776)</b> : chacun poursuit son intérêt, et une « main invisible » organise le marché — le boulanger te nourrit pour gagner sa vie, pas par bonté. <b>Karl Marx (un siècle plus tard)</b> : le patron garde trop de la valeur créée par l'ouvrier ; cette injustice mènera à la révolution. Le 20e siècle a testé les deux (Guerre froide). Aujourd'hui, presque tous les pays sont des <b>économies mixtes</b> : boulangerie privée, école publique.</p>
    <h2>Match 2 · Ricardo contre Keynes (S2)</h2>
    <p><b>Ricardo (1817)</b> : l'avantage comparatif — chacun se spécialise dans ce qu'il fait le mieux et tout le monde gagne à l'échange (le libre-échange). <b>Keynes (1936, après le krach de 1929)</b> : en crise, attendre aggrave la spirale ; l'État doit dépenser pour relancer la machine — « à long terme, nous serons tous morts ». Chaque élection rejoue ce match.</p>
    <h2>Match 3 · Toi contre la Bourse (S3)</h2>
    <p><b>Action</b> = part de propriété d'une entreprise (risqué, gain possible). <b>Obligation</b> = prêt avec intérêts fixés (plus sûr). <b>La Bourse</b> = le marché où tout s'échange — émotions comprises : euphorie, panique, rumeurs. <b>La dette d'État</b> = des obligations qu'on renouvelle sans cesse ; le vrai danger est la perte de confiance des prêteurs (Grèce, 2010).</p>
    <h2>Match 4 · Le dollar contre le monde (S4)</h2>
    <p><b>1944, Bretton Woods</b> : 44 pays choisissent le dollar comme monnaie pivot, convertible en or (35 $ l'once). <b>1971, « Nixon shock »</b> : trop de dollars imprimés, fin de la convertibilité — depuis, les monnaies reposent sur la <b>confiance</b> (monnaies fiduciaires). Le dollar reste roi (pétrodollar, réserves des banques centrales) : un « privilège exorbitant » qui permet aux États-Unis d'emprunter moins cher. Chine, Russie et BRICS cherchent à en sortir — sans remplaçant pour l'instant.</p>
    <div class="box"><b>Les économistes à connaître :</b> Smith (main invisible) · Marx (lutte des classes) · Ricardo (avantage comparatif) · Keynes (relance par l'État) — et dans ta galerie : Amartya Sen (les famines naissent d'injustices, pas du manque), Esther Duflo (tester contre la pauvreté comme on teste un médicament), Muhammad Yunus (le micro-crédit).</div>
  </section>

  <!-- ═══ CONNAISSANCES : MONDE ═══ -->
  <section class="page">
    <h1>🌐 À retenir — Lire le monde</h1>
    <h2>L'ONU : indispensable et impuissante (S1)</h2>
    <p>Née en 1945 sur « plus jamais ça ». À l'Assemblée générale, 193 pays, une voix chacun. Mais au Conseil de sécurité, 5 vainqueurs de 1945 (USA, Russie, Chine, France, Royaume-Uni) ont un <b>droit de veto</b> : un seul « non » bloque tout. L'ONU vaccine, nourrit, casque bleu… et se paralyse dès qu'un grand est impliqué. Le débat : faut-il supprimer le veto ?</p>
    <h2>Jérusalem, trois fois sainte (S4)</h2>
    <p>Dans moins d'1 km² : le <b>Mur occidental</b> (judaïsme), le <b>Saint-Sépulcre</b> (christianisme), l'<b>esplanade des Mosquées</b> avec Al-Aqsa (islam). Quatre quartiers imbriqués, chaque pierre disputée — c'est pourquoi aucun plan de paix n'a encore réussi à dessiner cette ville.</p>
    <h2>Religions, laïcité — et le droit de ne pas croire (S4)</h2>
    <p>La « règle d'or » (« ne fais pas aux autres… ») existe dans presque toutes les traditions. La France a sa règle du jeu : la <b>laïcité</b> (1905) — l'État ne finance ni ne privilégie aucun culte, chacun croit ou ne croit pas librement.</p>
    <div class="box"><b>4 mots à ne plus confondre :</b> le <b>théiste</b> croit en un dieu personnel qui intervient dans le monde (les grandes religions révélées) · le <b>déiste</b> croit en un créateur qui a lancé l'univers sans intervenir ensuite — la position de Voltaire, son « horloger » · l'<b>athée</b> ne croit en aucun dieu · l'<b>agnostique</b> pense qu'on ne peut pas savoir. La laïcité n'est aucune des quatre : c'est la règle qui les protège toutes.</div>
    <h2>Lire une guerre en cours (S2-S3)</h2>
    <p>La méthode, applicable à tout conflit : ① qui sont les acteurs ? ② que dit vouloir chacun — et que veut-il peut-être vraiment ? ③ quels mots chaque camp choisit-il (le vocabulaire est un champ de bataille) ? ④ qu'est-ce qui est vérifié par des sources indépendantes ? ⑤ derrière les cartes, de vraies vies. Les pages « Comprendre le Moyen-Orient » de ce livret sont ton terrain d'application — à lire avec un parent.</p>
  </section>

  <!-- ═══ KIT ESPRIT CRITIQUE ═══ -->
  <section class="page">
    <h1>🔍 L'antisèche de l'esprit critique</h1>
    <h2>Les 6 sophismes à savoir nommer</h2>
    <ul>
      <li><b>L'homme de paille</b> — déformer ce que dit l'autre pour l'attaquer plus facilement.</li>
      <li><b>L'appel à l'autorité</b> — « un savant l'a dit » ne remplace pas une preuve (surtout hors de son domaine).</li>
      <li><b>L'appel à la popularité</b> — « tout le monde le pense » n'a jamais rendu une idée vraie.</li>
      <li><b>Le faux dilemme</b> — te laisser choisir entre deux options quand il en existe dix.</li>
      <li><b>La pente glissante</b> — « si on accepte A, alors forcément la catastrophe Z » (sans prouver la chaîne).</li>
      <li><b>L'ad hominem</b> — attaquer la personne au lieu de son argument.</li>
    </ul>
    <h2>Les 5 étapes du fact-checking</h2>
    <p>① Remonter à la <b>source primaire</b> · ② croiser <b>3 sources indépendantes</b> · ③ <b>recherche d'image inversée</b> · ④ vérifier la <b>date</b> (le recyclage d'images est le trucage n°1) · ⑤ se demander <b>qui gagne quoi</b> si j'y crois. Et la règle des 30 secondes avant de partager.</p>
    <h2>Les outils de logique</h2>
    <ul>
      <li><b>Rasoir d'Ockham</b> — entre plusieurs explications, la plus simple est souvent la bonne (un outil de tri, pas une preuve).</li>
      <li><b>Charge de la preuve</b> — c'est à celui qui affirme de prouver. « Prouve-moi que c'est faux ! » est une triche (la théière de Russell).</li>
      <li><b>Corrélation ≠ causalité</b> — A et B vont ensemble ? Trois pistes : A cause B, B cause A, ou un C caché cause les deux (les glaces et les noyades… c'est l'été).</li>
      <li><b>Biais du survivant</b> — on ne voit que ceux qui ont réussi ; les échecs ont disparu des statistiques (les avions criblés de balles qui rentrent…).</li>
      <li><b>Valide ≠ vrai</b> — « tous les chats sont verts ; Rex est un chat ; donc Rex est vert » : structure parfaite, prémisse fausse. Un argument <b>solide</b> = structure valide ET prémisses vraies.</li>
    </ul>
    <div class="box"><b>La règle d'or :</b> plus une info t'indigne ou te fait plaisir, plus il faut la vérifier — c'est exactement là que ton cerveau baisse la garde.</div>
  </section>

  <!-- ═══ RHÉTORIQUE ═══ -->
  <section class="page">
    <h1>🎤 La rhétorique en 4 marches</h1>
    <p class="lead">Une marche par mardi — et tout s'applique dès l'exposé du vendredi.</p>
    <h2>Marche 1 · Structurer et accrocher (S1)</h2>
    <p>La règle d'or en trois temps : <b>l'accroche</b> (les 20 premières secondes décident si on t'écoute — question surprenante, chiffre choc, mini-histoire ; jamais « alors voilà, je vais vous parler de… »), <b>3 idées maximum</b> (le cerveau retient par trois), <b>la chute</b> préparée qui claque (jamais « voilà voilà… c'est fini »).</p>
    <h2>Marche 2 · Le storytelling (S2)</h2>
    <p>Les humains ne retiennent pas les informations : ils retiennent les <b>histoires</b>. La recette : un personnage, un obstacle, un retournement. « La variole a tué des millions d'Aztèques » s'oublie ; l'histoire d'un enfant aztèque qui voit arriver les navires, jamais.</p>
    <h2>Marche 3 · La voix, le corps, le regard (S3)</h2>
    <p>Ton contenu vaut 50 % ; l'autre moitié, c'est comment tu le portes. Les 4 leviers : <b>le silence</b> (l'arme secrète — une pause avant l'idée clé), <b>le volume et le rythme</b> (varier, ralentir sur l'important), <b>le regard</b> (balayer, pas fixer ses pieds), <b>les mains</b> (elles dessinent ce que tu dis).</p>
    <h2>Marche 4 · Improviser et encaisser les questions (S4)</h2>
    <p>Le sommet de l'art. Face à une question dont tu ignores la réponse : « je ne sais pas, mais voici ce que je sais » vaut mille fois un bluff. Et pour répondre avec structure, la méthode <b>PREP</b> : <b>P</b>oint de vue → <b>R</b>aison → <b>E</b>xemple → <b>P</b>oint de vue répété.</p>
    <div class="box"><b>Tes 4 exposés (vendredis + final) :</b> thème au choix mais <b>connexe à la semaine</b>, idées brainstormées avec ${K.assistantHint}, 5-10 minutes devant la famille. Les outils, dans l'ordre : <b>S1 Gamma</b> (il génère les slides depuis ton plan) · <b>S2 Claude</b> (construis AVEC lui, pas PAR lui) · <b>S3 Canva</b> (toi le designer — max 10 mots par slide) · <b>S4 PowerPoint et son IA</b> (l'outil des pros). Le mode d'emploi détaillé de chaque outil est sur la page du vendredi dans l'app. Après ton passage : notation étoiles + commentaire dans l'app !</div>
  </section>

  <!-- ═══ IA ═══ -->
  <section class="page">
    <h1>🤖 L'IA en une page</h1>
    <p class="lead">Le résumé du fil rouge « IA du jour » — 75 ans d'histoire, et ton siècle à toi.</p>
    <h2>La frise</h2>
    <table class="timeline">
      <tr><td>1950</td><td>Alan Turing pose LA question — « les machines peuvent-elles penser ? » — et invente son fameux test.</td></tr>
      <tr><td>1956</td><td>Conférence de Dartmouth : le terme « intelligence artificielle » est inventé. L'acte de naissance officiel.</td></tr>
      <tr><td>1970-90</td><td>Les « hivers de l'IA » : promesses trop grandes, résultats décevants, financements coupés. Leçon d'esprit critique.</td></tr>
      <tr><td>1997 / 2016</td><td>Deep Blue bat Kasparov aux échecs ; AlphaGo bat Lee Sedol au go (le fameux « coup 37 » que personne n'avait imaginé).</td></tr>
      <tr><td>2012</td><td>Le deep learning décolle (AlexNet) grâce aux données d'internet et… aux cartes graphiques des jeux vidéo.</td></tr>
      <tr><td>2017</td><td>Les <b>Transformers</b> (« Attention Is All You Need ») — l'architecture derrière ChatGPT, Claude, Gemini. Le T de GPT.</td></tr>
      <tr><td>2022+</td><td>Les grands modèles de langage (LLM) arrivent dans toutes les mains. Tu es là. 2024 : AlphaFold reçoit le Nobel de chimie, l'Europe vote l'AI Act.</td></tr>
    </table>
    <h2>Comment marche un LLM (en 3 phrases)</h2>
    <p>Il s'entraîne en jouant à « devine le mot suivant » sur des milliards de textes — et pour bien deviner, il est obligé d'absorber grammaire, faits et idées. Quand tu lui parles, il ne cherche pas dans une base de réponses : il <b>génère</b> sa réponse mot après mot, en choisissant du plausible. C'est pour ça qu'il peut « halluciner » : inventer avec un aplomb parfait — plus c'est précis et important, plus tu vérifies.</p>
    <h2>Et pour ton avenir ?</h2>
    <p>L'IA remplace surtout des <b>tâches</b> répétitives, rarement des métiers entiers. Trois familles gagnantes : ceux qui <b>pilotent</b> l'IA, ceux dont le métier est profondément <b>humain</b> (soigner, enseigner, créer, construire, négocier), et les métiers qui <b>n'existent pas encore</b>. La compétence n°1 : savoir apprendre, désapprendre et réapprendre.</p>
    <div class="box"><b>La règle d'or, à vie :</b> utilise l'IA pour comprendre plus, jamais pour réfléchir moins. Si elle fait tes devoirs, c'est elle qui s'entraîne — pas toi.</div>
  </section>

  <!-- ═══ MATHS ═══ -->
  <section class="page">
    <h1>🔢 Les maths curieuses du mois</h1>
    <h2>Le nombre d'or — φ ≈ 1,618 (S1)</h2>
    <p>Du Parthénon aux coquillages, une proportion qui fascine depuis l'Antiquité. Mesure toi-même : longueur ÷ largeur de tes cartes, livres, écrans — lesquels s'en approchent ? Et garde l'œil critique : parfois on voit le nombre d'or… parce qu'on veut le voir.</p>
    <h2>La suite de Fibonacci (S2)</h2>
    <p>0, 1, 1, 2, 3, 5, 8, 13, 21, 34… chaque nombre = la somme des deux précédents. Les spirales des pommes de pin, ananas et tournesols tombent presque toujours sur ces nombres. Magie ultime : divise un terme par le précédent (34÷21…) → le résultat tend vers… φ. Les deux mystères n'en font qu'un.</p>
    <h2>Les fractales (S3)</h2>
    <p>Des figures dont chaque morceau ressemble au tout : zoome sur une fougère, tu vois une petite fougère. Le flocon de Koch a un périmètre <b>infini</b> dans une surface <b>finie</b>. La star absolue : le chou romanesco. La nature adore les fractales : poumons, éclairs, rivières, côtes bretonnes.</p>
    <h2>La logique formelle (S4)</h2>
    <p>Le syllogisme d'Aristote (majeure, mineure, conclusion), les diagrammes de Venn qui rendent les erreurs visibles, et la distinction reine : <b>valide</b> (bien construit) ≠ <b>vrai</b> (prémisses exactes). Il faut les deux pour qu'un argument soit solide — c'est l'outil qui te permet de vérifier même les raisonnements des IA.</p>
    <div class="box"><b>Le match des capitales :</b> note ici ton score du premier lundi ____ / 20, et celui du 22 août ____ / 20. La différence, c'est ton mois.</div>
  </section>

  <!-- ═══ MOYEN-ORIENT (2 pages préservées) ═══ -->
  <section class="page">
    <h1>🕊️ Pages spéciales — Comprendre le Moyen-Orient (1/2)</h1>
    <div class="notice">À lire avec un parent. Ces pages parlent de guerres réelles et actuelles : des morts, des familles déplacées, des désaccords profonds. L'objectif n'est pas de te dire qui a « raison », mais de t'aider à comprendre pourquoi ces conflits sont si difficiles à résumer équitablement. Situation décrite au 27 juillet 2026 — vérifie avec un parent ce qui a changé depuis (France 24, Le Monde) : c'est déjà un exercice de fact-checking.</div>
    <h2>1 · Le conflit israélo-palestinien : comment on en est arrivé là</h2>
    <table class="timeline">
      <tr><td>1917</td><td>Déclaration Balfour — le Royaume-Uni, qui contrôle la région, soutient l'idée d'un « foyer national juif » en Palestine.</td></tr>
      <tr><td>1947</td><td>L'ONU propose de partager la Palestine en deux États. Les dirigeants juifs acceptent, les dirigeants arabes refusent.</td></tr>
      <tr><td>1948</td><td>Création d'Israël, aussitôt suivie d'une guerre. ~700 000 Palestiniens fuient ou sont chassés. Les Israéliens parlent de « guerre d'indépendance », les Palestiniens de « Nakba » (catastrophe). Deux noms pour un même événement — souviens-toi de César.</td></tr>
      <tr><td>1967</td><td>Guerre des Six Jours : Israël occupe la Cisjordanie, Gaza et Jérusalem-Est. L'ONU parle de territoires « occupés » ; le gouvernement israélien conteste ce mot pour la Cisjordanie, qu'il appelle Judée-Samarie. Le vocabulaire lui-même est un champ de bataille.</td></tr>
      <tr><td>1993-95</td><td>Accords d'Oslo — Rabin et Arafat se serrent la main, prix Nobel de la paix… puis Rabin est assassiné par un extrémiste israélien opposé à la paix. Le processus s'enlise.</td></tr>
      <tr><td>2007</td><td>Le Hamas prend le contrôle de Gaza. Blocus israélo-égyptien.</td></tr>
      <tr><td>7 oct. 2023</td><td>Le Hamas attaque Israël : ~1200 morts, 251 otages. Israël riposte par une offensive massive sur Gaza.</td></tr>
      <tr><td>2023-25</td><td>Une des guerres les plus meurtrières du siècle pour les civils : de l'ordre de 70 000 morts palestiniens (chiffre débattu dans le détail, mais reconnu dans son ordre de grandeur même par l'armée israélienne), la majorité de Gaza détruite, famine, ~2 millions de déplacés.</td></tr>
      <tr><td>Nov. 2025</td><td>Cadre de cessez-le-feu adopté à l'ONU (résolution 2803).</td></tr>
      <tr><td>Juil. 2026</td><td>Le cessez-le-feu tient partiellement : otages libérés, aide relancée, mais frappes toujours en cours et large partie de Gaza sous contrôle israélien. En Cisjordanie, la colonisation s'accélère (« annexion de fait » selon l'ONU, ce qu'Israël conteste). Plus de 140 pays sur 193 reconnaissent un État palestinien — dont la France depuis septembre 2025, mais pas les États-Unis.</td></tr>
    </table>
    <div class="box"><b>Pourquoi c'est si dur à raconter équitablement :</b> deux peuples ont des liens anciens et sincères avec la même terre, chacun a vécu des pertes immenses, et jusqu'aux mots (« occupé »/« disputé », « Nakba »/« indépendance ») tout est disputé. <b>Exercice en famille :</b> reformule un même fait avec les mots que choisirait chaque camp.</div>
  </section>
  <section class="page">
    <h1>🕊️ Comprendre le Moyen-Orient (2/2)</h1>
    <h2>2 · Iran, Israël, États-Unis : une guerre en cours</h2>
    <table class="timeline">
      <tr><td>Contexte</td><td>Des décennies de tension autour du programme nucléaire iranien, du soutien de l'Iran à des groupes armés régionaux (Hezbollah, Houthis), et de la sécurité d'Israël.</td></tr>
      <tr><td>Juin 2025</td><td>Guerre de 12 jours : frappes israéliennes puis américaines sur les sites nucléaires iraniens (Fordow, Natanz, Ispahan). Cessez-le-feu.</td></tr>
      <tr><td>28 fév. 2026</td><td>Vaste opération américano-israélienne en pleine négociation. Le guide suprême Ali Khamenei est tué ; son fils Mojtaba lui succède. Riposte iranienne (missiles, drones, fermeture du détroit d'Ormuz — passage vital du pétrole mondial).</td></tr>
      <tr><td>Avr.-juin 2026</td><td>Cessez-le-feu fragiles et rompus, médiations du Pakistan puis du Qatar.</td></tr>
      <tr><td>Juil. 2026</td><td>Reprise des bombardements début juillet, puis pause précaire fin juillet, négociations en cours. Statut : ni guerre finie, ni paix — une pause fragile.</td></tr>
    </table>
    <div class="box"><b>Le point de désaccord majeur :</b> les frappes étaient justifiées par la crainte d'une bombe nucléaire iranienne — mais l'AIEA (l'agence de vérification de l'ONU) n'avait trouvé aucune preuve d'un programme militaire actif. Un cas d'école pour ta semaine 3 : la justification d'un camp, contestée par les vérificateurs indépendants.</div>
    <p><b>Les intérêts de chacun :</b> États-Unis et Israël — empêcher la bombe iranienne, affaiblir ses alliés armés. Iran — souveraineté et survie du régime. Pays du Golfe — d'abord la peur de l'embrasement, puis un durcissement après avoir été touchés. Russie et Chine — soutien diplomatique à l'Iran, sans intervenir. Europe — appels à la diplomatie.</p>
    <p><b>Derrière les cartes :</b> des milliers de morts, surtout militaires mais aussi civils. La géopolitique parle de vraies vies.</p>
  </section>

  <!-- ═══ PROJET ═══ -->
  <section class="page">
    <h1>💻 Ton projet du mois</h1>
    <p class="lead">${esc(D.projet.intro)}</p>
    <div class="box why">${esc(D.projet.rendu)}</div>
    <h2>Tes 6 idées (ou la tienne !)</h2>
    <ul>${ideas.map(i=>`<li><b>${esc(i.titre)}</b> — ${esc(i.desc)}</li>`).join('')}</ul>
    <h2>Les 4 phases</h2>
    <ul>${D.projet.phases.map(ph=>`<li><b>S${ph.semaine}</b> — ${esc(ph.titre)}</li>`).join('')}</ul>
    <p class="small">L'app te donne chaque jour l'étape précise (onglet « Mon projet ») : en semaine 1, tu ne fabriques rien — tu brainstormes avec ton assistant, tu choisis, tu planifies. C'est comme ça que travaillent les pros. ${esc(D.projet.astuce||'')}</p>
    <h2>Mes notes de projet</h2>
    <p class="small">Mon idée choisie : ______________________________ · Mon rendu final rêvé :</p>
    <div class="lines"></div><div class="lines"></div><div class="lines"></div>
  </section>

  <!-- ═══ GALERIE ═══ -->
  <section class="page">
    <h1>🏆 La galerie des ${D.persons.length} — ta liste de chasse</h1>
    <p class="small">Coche chaque personnalité découverte (3 nouvelles par jour maximum dans l'app — mais tu peux tout lire !). Chaque fiche de l'app a sa vidéo « Quelle Histoire ». Objectif : tout cocher avant le 23 août.</p>
    <div class="cols2 gal">
    ${cats.slice(0, 7).map(c=>{
      const items = D.persons.filter(p=>p.cat===c);
      return `<h3>${items[0].catEmoji} ${esc(c)}</h3>` + items.map(p=>`<div>${cb}${p.emoji} <b>${esc(p.name)}</b> — ${esc(p.tagline)}</div>`).join('');
    }).join('')}
    </div>
  </section>
  <section class="page">
    <h1>🏆 La galerie des ${D.persons.length} — suite</h1>
    <div class="cols2 gal">
    ${cats.slice(7).map(c=>{
      const items = D.persons.filter(p=>p.cat===c);
      return `<h3>${items[0].catEmoji} ${esc(c)}</h3>` + items.map(p=>`<div>${cb}${p.emoji} <b>${esc(p.name)}</b> — ${esc(p.tagline)}</div>`).join('');
    }).join('')}
    </div>
  </section>

  <!-- ═══ BILAN ═══ -->
  <section class="page">
    <h1>🌟 Mon bilan du Grand Été</h1>
    <div class="kv">
      <div><b>🗺️ Capitales</b><br>S1 : ____ / 20<br>S4 : ____ / 20</div>
      <div><b>🧠 Mes QCM</b><br>S1 : __ /13 · S2 : __ /13<br>S3 : __ /13 · S4 : __ /13</div>
      <div><b>🏆 Ma collection</b><br>____ / ${D.persons.length} cartes<br>🎖️ ____ / 18 badges</div>
      <div><b>🔥 Ma série</b><br>Record : ____ jours<br>de journées complètes</div>
    </div>
    <h2>Les 3 choses qui m'ont le plus marqué ce mois-ci</h2>
    <div class="lines"></div><div class="lines"></div><div class="lines"></div>
    <h2>Ce que je veux garder comme habitude en septembre</h2>
    <div class="lines"></div><div class="lines"></div>
    <h2>Mon meilleur exposé, et pourquoi</h2>
    <div class="lines"></div><div class="lines"></div>
    <h2>La question que je me pose encore</h2>
    <div class="lines"></div><div class="lines"></div>
    <div class="box" style="margin-top:10mm;text-align:center;"><b>Tu as traversé 75 ans d'IA, 2000 ans d'histoire, quatre systèmes économiques, trois religions, six sophismes et ${D.persons.length} destins extraordinaires. Garde tes deux superpouvoirs : la curiosité, et l'esprit critique. 🌞</b></div>
  </section>
  </body></html>`;
}

for (const kid of ['adam','alix']) {
  fs.writeFileSync(`livret_${kid}.html`, livret(kid));
  console.log(`livret_${kid}.html écrit (${Math.round(fs.statSync(`livret_${kid}.html`).size/1024)} Ko)`);
}
