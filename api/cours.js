// /api/cours — le module « Mes cours » : photos mises au propre, tuteur, exercices, ressources.
// Quatre modes, un seul point d'entrée : transcrire | exos | corriger | interro.

/* ---------- ressources « pour aller plus loin » ----------
   L'IA ne donne JAMAIS d'URL : elle choisit un site dans cette liste et propose une
   requête. C'est le serveur qui fabrique le lien. Résultat : aucun lien mort, aucun
   site inconnu, et on sait exactement où les enfants peuvent atterrir. */
const enc = s => encodeURIComponent(String(s || '').slice(0, 120).trim());
const yt = q => 'https://www.youtube.com/results?search_query=' + enc(q);
const google = (site, q) => 'https://www.google.com/search?q=' + enc('site:' + site + ' ' + q);

const SITES = {
  lumni:        { nom: 'Lumni',                  type: 'video',   emoji: '🎬', pour: 'toutes matières',            url: q => 'https://www.lumni.fr/recherche?q=' + enc(q) },
  lesbonsprofs: { nom: 'Les Bons Profs',         type: 'video',   emoji: '👩‍🏫', pour: 'cours du collège',           url: q => yt('les bons profs ' + q) },
  cpsorcier:    { nom: "C'est pas sorcier",      type: 'video',   emoji: '🔬', pour: 'sciences, techno, géo',       url: q => yt("c'est pas sorcier " + q) },
  notabene:     { nom: 'Nota Bene',              type: 'video',   emoji: '🏛️', pour: 'histoire',                    url: q => yt('nota bene histoire ' + q) },
  monka:        { nom: 'Yvan Monka',             type: 'video',   emoji: '➗', pour: 'maths',                       url: q => yt('yvan monka ' + q) },
  arte:         { nom: 'Arte',                   type: 'video',   emoji: '📺', pour: 'histoire, géo, arts',         url: q => 'https://www.arte.tv/fr/search/?q=' + enc(q) },
  khan:         { nom: 'Khan Academy',           type: 'video',   emoji: '🎓', pour: 'maths et sciences',           url: q => 'https://fr.khanacademy.org/search?page_search_query=' + enc(q) },
  vikidia:      { nom: 'Vikidia',                type: 'article', emoji: '📗', pour: 'encyclopédie 8-13 ans',       url: q => 'https://fr.vikidia.org/w/index.php?search=' + enc(q) },
  wikipedia:    { nom: 'Wikipédia',              type: 'article', emoji: '📘', pour: 'encyclopédie',                url: q => 'https://fr.wikipedia.org/w/index.php?search=' + enc(q) },
  kartable:     { nom: 'Kartable',               type: 'article', emoji: '📝', pour: 'fiches de cours',             url: q => 'https://www.kartable.fr/recherche?q=' + enc(q) },
  mathstiques:  { nom: 'Maths et tiques',        type: 'article', emoji: '📐', pour: 'maths',                       url: q => google('maths-et-tiques.fr', q) },
  bnf:          { nom: 'BnF — Classes',          type: 'article', emoji: '📜', pour: 'histoire, français, arts',    url: q => google('classes.bnf.fr', q) },
  panorama:     { nom: "Panorama de l'art",      type: 'article', emoji: '🎨', pour: 'arts plastiques',             url: q => google('panoramadelart.com', q) },
  philharmonie: { nom: 'Philharmonie de Paris',  type: 'article', emoji: '🎵', pour: 'musique',                     url: q => google('pad.philharmoniedeparis.fr', q) },
  british:      { nom: 'British Council Teens',  type: 'article', emoji: '🇬🇧', pour: 'anglais',                     url: q => 'https://learnenglishteens.britishcouncil.org/search?keys=' + enc(q) },
  learngerman:  { nom: 'DW — Learn German',      type: 'article', emoji: '🇩🇪', pour: 'allemand',                    url: q => google('learngerman.dw.com', q) },
  espagnol:     { nom: 'Espagnol facile',        type: 'article', emoji: '🇪🇸', pour: 'espagnol',                    url: q => google('espagnolfacile.com', q) },
};
const CATALOGUE = Object.keys(SITES).map(k => `- ${k} — ${SITES[k].nom} (${SITES[k].type === 'video' ? 'vidéos' : 'articles'}, ${SITES[k].pour})`).join('\n');

/* Transforme ce que l'IA a proposé en liens réellement cliquables. */
function construitRessources(brutes) {
  return (Array.isArray(brutes) ? brutes : []).slice(0, 4).map(r => {
    const s = SITES[String((r && r.site) || '').trim()];
    if (!s) return null;
    const requete = String((r && r.requete) || '').slice(0, 120);
    if (!requete) return null;
    return {
      site: s.nom, emoji: s.emoji, type: s.type,
      titre: String((r && r.titre) || requete).slice(0, 120),
      pourquoi: String((r && r.pourquoi) || '').slice(0, 220),
      url: s.url(requete),
    };
  }).filter(Boolean);
}

/* ---------- l'enfant ---------- */
function qui(child) {
  return child === 'alix'
    ? "Alix, 11 ans (6e-5e) : phrases courtes, vocabulaire simple, images concrètes, une idée à la fois"
    : "Adam, 13 ans (4e-3e) : tu peux aller plus loin dans le vocabulaire, les nuances et les concepts";
}

/* ---------- mode transcrire : les photos → un cours au propre ---------- */
function systemTranscrire(child, matiere) {
  return `Tu mets au propre le cours d'un collégien français à partir de photos de son cahier, de son manuel ou du tableau. L'enfant est ${qui(child)}.${matiere && matiere !== 'autre' ? `\nMatière annoncée par l'enfant : ${matiere}.` : ''}

RÈGLE ABSOLUE — FIDÉLITÉ
Tu transcris ce qui est SUR les photos. Tu n'ajoutes aucune connaissance extérieure dans le cours lui-même, tu n'inventes rien, tu ne complètes pas un paragraphe coupé. Un cours inventé est bien pire qu'un cours incomplet : l'enfant réviserait du faux.
- Un mot que tu n'arrives pas à lire : écris-le \`[illisible]\` et signale-le dans "incertitudes".
- Une photo floue, mal cadrée ou sans rapport : dis-le dans "incertitudes".
- Plusieurs photos = UN SEUL cours continu, remis dans l'ordre logique (numéros de page, suite des titres).

CE QUE TU CORRIGES, EN REVANCHE
- L'orthographe, la grammaire, la ponctuation et les accents : le cours doit être impeccable.
- Les abréviations de prise de notes : "qqch" → "quelque chose", "ds" → "dans", "pdt" → "pendant", "càd" → "c'est-à-dire", "XIXe s." → "XIXe siècle".
- La mise en forme : tu rends visible la structure que l'enfant avait dans la tête (grandes parties, sous-parties, listes).

MISE EN FORME DU CHAMP "texte" (mini-Markdown, rien d'autre)
- \`## \` pour une grande partie, \`### \` pour une sous-partie.
- \`- \` pour une puce, \`1. \` pour une liste numérotée.
- \`**gras**\` pour les mots-clés, les dates et les définitions à retenir. Sois généreux : c'est ce que l'enfant relira en diagonale.
- \`> \` pour une citation, une définition encadrée ou une règle.
- \`---\` pour séparer deux parties sans rapport.
- Garde la numérotation du cours (I., A., 1.) dans les titres si elle existe.
- Mathématiques et sciences : écris les formules en texte lisible (x², √2, 3 × 4, ½, ≤, ≠, →, π, H₂O). JAMAIS de LaTeX ni de dollars.

LES AUTRES CHAMPS (là, tu as le droit d'apporter ton aide)
- "resume" : 2 ou 3 phrases qui disent de quoi parle ce cours.
- "points_cles" : 3 à 6 phrases, l'essentiel à ne pas rater.
- "vocabulaire" : 0 à 8 mots difficiles du cours, définis simplement et pour SON âge.
- "a_retenir" : 4 à 10 cartes question/réponse tirées du cours, qui serviront à l'interroger plus tard. Questions précises et vérifiables (pas "parle-moi de la Révolution"), réponses courtes. Donne à chaque carte une "notion" de 2-4 mots.
- "ressources" : 2 à 4 pistes pour aller plus loin SUR CE CHAPITRE PRÉCIS — au moins une vidéo et au moins un article. Tu ne donnes pas d'adresse internet : tu choisis un identifiant de site dans le catalogue ci-dessous et tu écris la requête de recherche exacte. Choisis le site selon la matière et selon l'âge (Vikidia plutôt que Wikipédia pour Alix). "pourquoi" dit en une phrase ce que l'enfant va y gagner.

CATALOGUE DES SITES AUTORISÉS (identifiant — nom)
${CATALOGUE}

RÉPONSE — UNIQUEMENT ce JSON, sans texte autour, sans bloc de code :
{"titre":"titre du cours","matiere":"histoire|geo|emc|francais|maths|svt|physique|techno|anglais|espagnol|allemand|latin|arts|musique|autre","niveau":"6e|5e|4e|3e|?","chapitre":"nom du chapitre si visible","resume":"...","texte":"le cours au propre en mini-Markdown","points_cles":["..."],"vocabulaire":[{"mot":"...","def":"..."}],"a_retenir":[{"notion":"...","q":"...","r":"..."}],"ressources":[{"site":"identifiant","requete":"...","titre":"...","pourquoi":"..."}],"incertitudes":["..."]}`;
}

/* ---------- mode exos : une fiche d'exercices sur ce cours ---------- */
function systemExos(child, nb) {
  return `Tu fabriques une fiche d'exercices pour un collégien français, à partir de SON cours (fourni ci-dessous). L'enfant est ${qui(child)}.

PRINCIPES
- Les exercices portent uniquement sur ce cours. Rien qui demande une connaissance absente du cours.
- Tu fais APPLIQUER, tu ne fais pas réciter : un calcul à faire, une phrase à transformer, un document à interpréter, un cas concret à trancher, une traduction, un classement.
- Progression : les deux premiers sont faciles (mise en route), les derniers demandent de réfléchir.
- Adapte le type d'exercice à la matière : maths et physique → calculs et problèmes ; langues → traduction, conjugaison, phrases à compléter ; français → analyse grammaticale, réécriture, figures de style ; histoire-géo-EMC → dates, causes et conséquences, lecture de document, vrai/faux argumenté ; SVT et techno → schéma à expliquer, expérience à interpréter.
- ${nb} exercices, variés : mélange des QCM et des questions à rédiger.

TYPES DISPONIBLES
- "qcm" : 4 propositions dans "options", "reponse" = l'index (0 à 3) de la bonne.
- "reponse" : question ouverte courte, "reponse" = la réponse attendue (1-2 phrases).
- "calcul" : un calcul ou un problème, "reponse" = le résultat attendu avec son unité.
Dans tous les cas, "explication" explique la bonne réponse comme le ferait un bon prof (2-4 phrases, le raisonnement et pas seulement le résultat), et "notion" nomme en 2-4 mots ce que l'exercice teste.

RÉPONSE — UNIQUEMENT ce JSON, sans texte autour, sans bloc de code :
{"exercices":[{"type":"qcm|reponse|calcul","enonce":"...","options":["a","b","c","d"],"reponse":"0","explication":"...","notion":"..."}]}`;
}

/* ---------- mode corriger : l'enfant a rédigé, on corrige ---------- */
function systemCorriger(child) {
  return `Tu corriges les réponses d'un collégien à des exercices sur son propre cours. L'enfant est ${qui(child)}.

COMMENT TU CORRIGES
- Tu juges le FOND, pas la forme : une réponse juste mal orthographiée ou mal tournée est juste. Un synonyme est juste. Une réponse incomplète mais exacte est juste, et tu complètes dans le commentaire.
- Une réponse vide ou hors sujet est fausse, sans détour.
- "ok" vaut true seulement si l'essentiel de la réponse attendue est là.
- "commentaire" : 1 à 3 phrases. Si c'est juste, dis précisément ce qui est bien (pas "bravo" tout seul). Si c'est faux, donne la bonne réponse ET pourquoi, sans jamais humilier. Tu parles à l'enfant, directement, avec "tu".

RÉPONSE — UNIQUEMENT ce JSON, sans texte autour, sans bloc de code :
{"resultats":[{"ok":true,"commentaire":"..."}]}
Un objet par exercice, dans le même ordre que les exercices reçus.`;
}

/* ---------- mode interro : le tuteur qui pose les questions à l'oral ---------- */
function systemInterro(child, cours, notions) {
  return `Tu es le tuteur d'un collégien français qui révise SON cours, à l'oral, dans une conversation. L'enfant est ${qui(child)}.

TON DÉROULÉ
- UNE question à la fois. Jamais deux. Jamais de liste de questions.
- L'enfant répond avec ses mots : tu accueilles, tu corriges, tu complètes, puis tu enchaînes sur la question suivante.
- S'il répond juste : dis ce qui était juste et précis dans sa réponse, ajoute un détail qu'il ne savait peut-être pas, et passe à la suite.
- S'il se trompe : ne donne pas la réponse tout de suite. Donne un indice et laisse-le réessayer UNE fois. S'il se trompe encore, ou s'il dit qu'il ne sait pas, donne la réponse complète et explique-la.
- S'il dit "je ne sais pas" ou "passe" : tu passes, sans insister et sans reproche.
- Tu varies : de la date qui se récite, du "pourquoi" qui se réfléchit, du "explique-moi comme à un copain".
- Ton chaleureux, direct, jamais scolaire, jamais moralisateur. Tutoiement. Réponses courtes : 2 à 5 phrases, c'est une conversation, pas un cours.
- Quand tu as fait le tour des notions, fais un bilan honnête : ce qui est acquis, ce qu'il faut revoir — et dis-le gentiment.

LE COURS À RÉVISER
Titre : ${cours.titre}${cours.matiere ? ` (${cours.matiere})` : ''}
${cours.resume ? `Résumé : ${cours.resume}\n` : ''}${cours.texte ? `\n${cours.texte}\n` : ''}${notions.length ? `\nNOTIONS À COUVRIR (coche-les mentalement au fur et à mesure) :\n${notions.map((n, i) => `${i + 1}. ${n.notion} — ${n.question}${n.reponse ? ` (réponse : ${n.reponse})` : ''}`).join('\n')}` : ''}

RÉPONSE — UNIQUEMENT ce JSON, sans texte autour, sans bloc de code :
{"reply":"ce que tu dis à l'enfant","bilan":{"notion":"la notion que sa DERNIÈRE réponse vient de tester","ok":true},"fini":false}
"bilan" vaut null si l'enfant n'a encore rien répondu, s'il a demandé à passer, ou si tu lui as seulement donné un indice sans trancher. "notion" doit être repris MOT POUR MOT dans la liste ci-dessus. "fini" passe à true quand tu viens de faire le bilan final.`;
}

/* ---------- appel à l'API Anthropic ----------
   Trois filets de sécurité, parce qu'un enfant qui tombe sur une erreur technique
   abandonne : si le modèle configuré n'existe pas (clé sans accès, identifiant changé)
   on retombe sur le modèle déjà utilisé par le reste de l'app ; si l'option de
   repli côté serveur n'est pas ouverte sur la clé, on réessaie sans elle. */
const MODELE_SECOURS = 'claude-sonnet-4-5';

async function appelClaude(key, body, avecRepli) {
  const envoie = async (corps, beta) => {
    const headers = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    if (beta) headers['anthropic-beta'] = beta;
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(corps) });
    return { ok: r.ok, status: r.status, j: await r.json() };
  };
  // 1er essai : tel que demandé, avec le repli serveur en cas de refus du modèle
  let res = avecRepli
    ? await envoie(Object.assign({}, body, { fallbacks: 'default' }), 'server-side-fallback-2026-07-01')
    : await envoie(body);
  // l'option de repli n'est pas disponible sur cette clé → on refait l'appel sans elle
  if (!res.ok && res.status === 400 && avecRepli) {
    console.warn('cours: repli serveur refusé, nouvel essai sans', (res.j.error || {}).message);
    res = await envoie(body);
  }
  // modèle inconnu → on prend celui que le reste de l'app utilise déjà. On retire au
  // passage output_config : ce réglage n'existe que sur les modèles récents, le garder
  // ferait échouer le repli pour une deuxième raison.
  if (!res.ok && (res.status === 404 || res.status === 400) && body.model !== MODELE_SECOURS) {
    console.warn('cours: modèle', body.model, 'indisponible, repli sur', MODELE_SECOURS);
    const secours = Object.assign({}, body, { model: MODELE_SECOURS });
    delete secours.output_config;
    res = await envoie(secours);
  }
  return res;
}

function texteDe(j) {
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

/* L'IA a pour consigne de ne répondre que du JSON — mais un modèle peut l'entourer
   d'un mot ou d'un bloc de code. On extrait le premier objet et on le parse. */
function jsonDe(texte) {
  const m = String(texte || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const liste = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);

/* ---------- point d'entrée ---------- */
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const fam = process.env.FAMILY_CODE;
  if (fam && ((req.body || {}).code || '') !== fam) {
    res.status(200).json({ error: 'code_famille' });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ error: "Le module des cours n'est pas branché — il manque la clé API côté serveur." }); return; }

  const { mode, child } = req.body || {};
  if (!['adam', 'alix'].includes(child)) { res.status(400).json({ error: 'enfant inconnu' }); return; }

  try {
    if (mode === 'transcrire') return await transcrire(req, res, key, child);
    if (mode === 'exos')       return await exos(req, res, key, child);
    if (mode === 'corriger')   return await corriger(req, res, key, child);
    if (mode === 'interro')    return await interro(req, res, key, child);
    res.status(400).json({ error: 'mode inconnu' });
  } catch (e) {
    console.error('cours', mode, e);
    res.status(200).json({ error: 'Petit souci technique — réessaie dans une minute !' });
  }
};

/* ---- photos → cours au propre ---- */
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function transcrire(req, res, key, child) {
  const { photos, matiere, notes } = req.body || {};
  const imgs = liste(photos, 6).filter(p => p && typeof p.data === 'string'
    && IMG_TYPES.includes(p.media_type) && p.data.length < 4_000_000);
  if (!imgs.length) { res.status(200).json({ error: "Aucune photo lisible — reprends-la en plein jour, bien à plat." }); return; }

  const blocks = imgs.map(p => ({ type: 'image', source: { type: 'base64', media_type: p.media_type, data: p.data } }));
  blocks.push({
    type: 'text',
    text: `Voici ${imgs.length === 1 ? 'la photo' : `les ${imgs.length} photos`} de mon cours, dans l'ordre.`
      + (notes ? `\n\nCe que je précise : ${str(notes, 400)}` : '')
      + `\n\nMets-le au propre.`,
  });

  const r = await appelClaude(key, {
    model: process.env.ANTHROPIC_MODEL_COURS || 'claude-sonnet-5-5',
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    system: systemTranscrire(child, str(matiere, 20)),
    messages: [{ role: 'user', content: blocks }],
  }, true);

  if (!r.ok) { console.error('cours transcrire', r.j); res.status(200).json({ error: "La lecture a échoué — réessaie dans un instant." }); return; }
  if (r.j.stop_reason === 'refusal') {
    res.status(200).json({ error: "Je n'ai pas pu traiter cette photo. Si le cours parle d'un sujet difficile, montre-le à un parent — il pourra t'aider à le mettre au propre." });
    return;
  }
  const out = jsonDe(texteDe(r.j));
  if (!out) { res.status(200).json({ error: "Je n'ai pas réussi à relire ce cours — réessaie avec des photos plus nettes." }); return; }

  res.status(200).json({
    cours: {
      titre: str(out.titre, 120) || 'Mon cours',
      matiere: str(out.matiere, 20) || str(matiere, 20) || 'autre',
      niveau: str(out.niveau, 10),
      chapitre: str(out.chapitre, 120),
      resume: str(out.resume, 600),
      texte: str(out.texte, 24000),
      points_cles: liste(out.points_cles, 8).map(p => str(p, 300)).filter(Boolean),
      vocabulaire: liste(out.vocabulaire, 8)
        .map(v => ({ mot: str(v && v.mot, 60), def: str(v && v.def, 300) }))
        .filter(v => v.mot && v.def),
      a_retenir: liste(out.a_retenir, 12)
        .map(c => ({ notion: str(c && c.notion, 60), q: str(c && c.q, 300), r: str(c && c.r, 400) }))
        .filter(c => c.q && c.r),
      ressources: construitRessources(out.ressources),
      incertitudes: liste(out.incertitudes, 6).map(i => str(i, 200)).filter(Boolean),
    },
  });
}

/* ---- fiche d'exercices ---- */
async function exos(req, res, key, child) {
  const { cours, nb, notions } = req.body || {};
  const c = cours || {};
  const combien = Math.max(3, Math.min(10, Math.round(Number(nb) || 6)));
  const ciblage = liste(notions, 8).map(n => str(n, 60)).filter(Boolean);

  const r = await appelClaude(key, {
    model: process.env.ANTHROPIC_MODEL_COURS_LEGER || 'claude-haiku-5-5',
    max_tokens: 4000,
    system: systemExos(child, combien),
    messages: [{
      role: 'user', content: `MON COURS\nTitre : ${str(c.titre, 120)}\nMatière : ${str(c.matiere, 20)}\nNiveau : ${str(c.niveau, 10)}\n`
        + (c.resume ? `Résumé : ${str(c.resume, 600)}\n` : '')
        + `\n${str(c.texte, 14000)}\n`
        + (ciblage.length ? `\nInsiste sur ces notions, je les rate souvent : ${ciblage.join(', ')}.` : '')
        + `\n\nFabrique-moi la fiche d'exercices.`,
    }],
  }, false);

  if (!r.ok) { console.error('cours exos', r.j); res.status(200).json({ error: "Les exercices n'ont pas pu être préparés — réessaie." }); return; }
  const out = jsonDe(texteDe(r.j));
  if (!out) { res.status(200).json({ error: "Les exercices n'ont pas pu être préparés — réessaie." }); return; }

  const exercices = liste(out.exercices, 10).map(e => {
    const type = ['qcm', 'reponse', 'calcul'].includes(e && e.type) ? e.type : 'reponse';
    const options = type === 'qcm' ? liste(e.options, 4).map(o => str(o, 200)).filter(Boolean) : [];
    if (type === 'qcm' && options.length < 2) return null;
    return {
      type, options,
      enonce: str(e && e.enonce, 600),
      reponse: str(e && e.reponse, 400),
      explication: str(e && e.explication, 700),
      notion: str(e && e.notion, 60),
    };
  }).filter(e => e && e.enonce && e.reponse !== '');

  if (!exercices.length) { res.status(200).json({ error: "Les exercices n'ont pas pu être préparés — réessaie." }); return; }
  res.status(200).json({ exercices });
}

/* ---- correction des réponses rédigées ---- */
async function corriger(req, res, key, child) {
  const items = liste((req.body || {}).items, 10)
    .map(i => ({ enonce: str(i && i.enonce, 600), attendu: str(i && i.attendu, 400), reponse: str(i && i.reponse, 1200) }))
    .filter(i => i.enonce);
  if (!items.length) { res.status(400).json({ error: 'rien à corriger' }); return; }

  const r = await appelClaude(key, {
    model: process.env.ANTHROPIC_MODEL_COURS_LEGER || 'claude-haiku-5-5',
    max_tokens: 2500,
    system: systemCorriger(child),
    messages: [{
      role: 'user', content: items.map((i, n) => `EXERCICE ${n + 1}\nQuestion : ${i.enonce}\nRéponse attendue : ${i.attendu}\nMa réponse : ${i.reponse || '(rien)'}`).join('\n\n')
        + `\n\nCorrige mes ${items.length} réponses.`,
    }],
  }, false);

  if (!r.ok) { console.error('cours corriger', r.j); res.status(200).json({ error: 'La correction a échoué — réessaie.' }); return; }
  const out = jsonDe(texteDe(r.j));
  if (!out || !Array.isArray(out.resultats)) { res.status(200).json({ error: 'La correction a échoué — réessaie.' }); return; }

  res.status(200).json({
    resultats: items.map((it, n) => {
      const x = out.resultats[n] || {};
      return { ok: !!x.ok, commentaire: str(x.commentaire, 600) || (x.ok ? "C'est juste !" : `La réponse attendue : ${it.attendu}`) };
    }),
  });
}

/* ---- interro orale ---- */
async function interro(req, res, key, child) {
  const { cours, notions, messages } = req.body || {};
  const c = cours || {};
  const nots = liste(notions, 12)
    .map(n => ({ notion: str(n && n.notion, 60), question: str(n && n.question, 300), reponse: str(n && n.reponse, 400) }))
    .filter(n => n.notion || n.question);

  const hist = liste(messages, 24)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-16)
    .map(m => ({ role: m.role, content: str(m.content, 1500) || '…' }));
  if (!hist.length || hist[hist.length - 1].role !== 'user') {
    hist.push({ role: 'user', content: "Je suis prêt — interroge-moi sur ce cours, une question à la fois !" });
  }

  const r = await appelClaude(key, {
    model: process.env.ANTHROPIC_MODEL_COURS_LEGER || 'claude-haiku-5-5',
    max_tokens: 1200,
    system: systemInterro(child, {
      titre: str(c.titre, 120), matiere: str(c.matiere, 20),
      resume: str(c.resume, 600), texte: str(c.texte, 12000),
    }, nots),
    messages: hist,
  }, false);

  if (!r.ok) { console.error('cours interro', r.j); res.status(200).json({ error: 'Le tuteur ne répond pas — réessaie dans un instant.' }); return; }
  const out = jsonDe(texteDe(r.j));
  if (!out || !out.reply) { res.status(200).json({ error: 'Le tuteur ne répond pas — réessaie dans un instant.' }); return; }

  // on ne garde un bilan que s'il porte sur une notion réellement suivie
  let bilan = null;
  if (out.bilan && out.bilan.notion) {
    const nom = str(out.bilan.notion, 60);
    if (nots.some(n => n.notion === nom)) bilan = { notion: nom, ok: !!out.bilan.ok };
  }
  res.status(200).json({ reply: str(out.reply, 2000), bilan, fini: !!out.fini });
}
