// /api/projet — le coach de projet : interview adaptative + feuille de route + suggestions (Sonnet 5)
function buildSystem(child){
  const kid = child === 'alix'
    ? "Alix, 11 ans (reste simple, imagé, phrases courtes, une notion à la fois)"
    : "Adam, 13 ans (tu peux aller plus loin dans le vocabulaire et les concepts)";
  return `Tu es le coach de projet du "Grand Été". Tu accompagnes ${kid} dans son projet du mois, de l'idée jusqu'au produit fini présenté à la fête du 22 août. Le produit fini doit être MONTRABLE (page web via la Fabrique de l'app, carnet, objet, défilé…).

TON RÔLE À CHAQUE TOUR :
1. Réagir en 1-2 phrases chaleureuses à la dernière réponse de l'enfant (jamais de flatterie creuse : rebondis sur le fond).
2. Poser LA prochaine question la plus utile — UNE seule, adaptée à la phase du projet :
   · début → clarifier la vision (pour qui ? à quoi ça ressemble fini ? qu'est-ce qui te fait le plus envie ?)
   · milieu → concret (par quoi commencer ? qu'est-ce qui bloque ? montre-moi ce que tu as fait)
   · fin → finitions, tests, préparation de la démo.
3. Mettre à jour la feuille de route : liste d'étapes CONCRÈTES et PETITES (30-45 min chacune), de la première à la démo finale, max 12 étapes. Conserve les étapes déjà faites (done:true) telles quelles. Ajuste les étapes à venir selon les réponses.
4. Proposer 0 à 2 suggestions NOUVELLES (idées d'amélioration, de contenu, de fonctionnalité) — l'enfant les gardera ou les éliminera. Ne répète jamais une suggestion déjà présente ou éliminée.
5. Estimer l'avancement global (progress, 0-100), honnêtement.

RÈGLES : français ; si le projet est numérique, oriente vers la Fabrique de l'app (le Bâtisseur construit la page, la mini-base peut sauvegarder des données) ; accueille tous les sujets qui passionnent l'enfant (mode, jeu vidéo, fiction, sport, musique…) sans les juger ni les ramener vers le scolaire — ne refuse que ce qui serait vraiment inadapté à l'âge ; si la réponse de l'enfant est vide ou hors sujet, repose une question plus simple.

FORMAT DE RÉPONSE — UNIQUEMENT ce JSON, sans texte autour, sans bloc de code :
{"message":"ta réaction (1-2 phrases)","question":"ta prochaine question","steps":[{"t":"étape","done":false}],"suggestions":["suggestion 1"],"progress":25}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const fam = process.env.FAMILY_CODE;
  if (fam && ((req.body || {}).code || '') !== fam) {
    res.status(200).json({ error: 'code_famille', reply: "🔐 Code famille manquant ou incorrect !" });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ error: "Le coach de projet n'est pas branché — clé API manquante." }); return; }
  try {
    const { child, board, answer } = req.body || {};
    if (!['adam', 'alix'].includes(child)) { res.status(400).json({ error: 'enfant inconnu' }); return; }
    const b = board || {};
    const state = {
      idee: (b.idea || '').toString().slice(0, 200),
      avancement: b.progress || 0,
      feuille_de_route: (Array.isArray(b.steps) ? b.steps : []).slice(0, 14).map(s => ({ t: String(s.t || '').slice(0, 140), done: !!s.done })),
      suggestions_gardees: (Array.isArray(b.suggestions) ? b.suggestions : []).filter(s => s.status === 'kept').map(s => String(s.t).slice(0, 140)).slice(0, 10),
      suggestions_eliminees: (Array.isArray(b.suggestions) ? b.suggestions : []).filter(s => s.status === 'dropped').map(s => String(s.t).slice(0, 140)).slice(0, 10),
      suggestions_en_attente: (Array.isArray(b.suggestions) ? b.suggestions : []).filter(s => !s.status || s.status === 'pending').map(s => String(s.t).slice(0, 140)).slice(0, 6),
      dernieres_questions_reponses: (Array.isArray(b.qa) ? b.qa : []).slice(-6).map(x => ({ q: String(x.q || '').slice(0, 200), r: String(x.a || '').slice(0, 400) })),
      question_en_cours: (b.current_q || '').toString().slice(0, 200),
    };
    const userMsg = answer && String(answer).trim()
      ? `État du projet :\n${JSON.stringify(state, null, 1)}\n\nMa réponse à ta question en cours : ${String(answer).slice(0, 1200)}`
      : `État du projet :\n${JSON.stringify(state, null, 1)}\n\nC'est le lancement (ou la reprise) de l'accompagnement : réagis à l'idée, pose ta première question, propose une feuille de route initiale.`;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL_FABRIQUE || 'claude-sonnet-5',
        max_tokens: 1500,
        system: buildSystem(child),
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    const j = await r.json();
    if (!r.ok) { console.error('anthropic error', j); res.status(200).json({ error: 'Petit souci du coach — réessaie dans une minute !' }); return; }
    const text = (j.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) { res.status(200).json({ error: 'Réponse illisible — réessaie !' }); return; }
    let out;
    try { out = JSON.parse(m[0]); } catch (e) { res.status(200).json({ error: 'Réponse illisible — réessaie !' }); return; }
    res.status(200).json({
      board: {
        message: String(out.message || '').slice(0, 500),
        question: String(out.question || '').slice(0, 300),
        steps: (Array.isArray(out.steps) ? out.steps : []).slice(0, 12).map(s => ({ t: String(s.t || s || '').slice(0, 140), done: !!s.done })),
        suggestions: (Array.isArray(out.suggestions) ? out.suggestions : []).slice(0, 2).map(s => String(s).slice(0, 140)),
        progress: Math.max(0, Math.min(100, Math.round(Number(out.progress) || 0))),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(200).json({ error: 'Petit souci du coach — réessaie dans une minute !' });
  }
};
