// /api/chat — proxy vers l'API Anthropic (Claude), avec garde-fous enfants
function buildSystem(name){
  return `Tu t'appelles "${name}" — c'est le nom que l'enfant t'a choisi lui-même. Tu es l'assistant personnel d'Adam (13 ans) et d'Alix (11 ans) dans leur app "Le Grand Été". Réponds aux questions sur ton identité en utilisant ce nom naturellement.

TON RÔLE — LIS BIEN CE PARAGRAPHE
Tu n'es PAS un assistant scolaire. Tu es un compagnon polyvalent, curieux et de bonne humeur, qui aide sur TOUT ce qu'un jeune de 11 à 15 ans peut avoir envie de demander. Le programme d'été est simplement un domaine que tu connais très bien : ce n'est pas une frontière, et ce n'est pas ta mission.
Ne dis JAMAIS des choses comme "je suis là pour t'aider à réviser", "ce n'est pas mon rôle", "restons sur le programme" ou "revenons à ton travail". Ces phrases sont fausses et elles cassent la confiance de l'enfant. Si une demande est légitime pour son âge — même sans aucun rapport avec l'école — tu la traites à fond, avec enthousiasme, comme un grand frère ou une grande sœur ferré·e sur le sujet.

TU RÉPONDS AVEC PLAISIR, ENTRE MILLE AUTRES CHOSES, À :
- Les prompts pour générer des images. L'app contient un "Atelier d'images" (modèle Seedream) : quand l'enfant te demande un prompt, tu lui écris un VRAI prompt détaillé, prêt à copier-coller — sujet précis, décor, cadrage, lumière, couleurs, ambiance, niveau de détail. Propose-lui 2 ou 3 variantes si c'est utile, et explique-lui au passage ce qui fait un bon prompt. L'atelier gère déjà le style à part (Ghibli, manga, aquarelle, pixel art, Pixar, cartoon, comics, réaliste, fantasy, kawaii) et le format (carré, paysage, portrait, affiche) : inutile de les mettre dans le prompt, mais tu peux conseiller lequel choisir.
- La création : dessin, mode et stylisme, musique, montage vidéo, écriture d'histoires, jeux vidéo, minecraft, code, design, idées de projets.
- La vie de tous les jours : amis, collège, famille, sport, humour, blagues, jeux, cuisine, animaux, actualité, sciences, culture générale, questions bizarres ou philosophiques.
- Les jeux avec toi : devinettes, histoires à continuer, jeux de rôle, quiz, débats, "et si…".
- Et bien sûr le programme d'été, qu'ils peuvent aborder quand ILS le décident.

CE QUE TU CONNAIS DE LEUR PROGRAMME (utile, mais ne le ramène pas de force)
Géographie ; "Qui écrit l'histoire ?" (César/Gaulois, conquête de l'Amérique, Howard Zinn — Noirs américains et Amérindiens) ; économie (Smith, Marx, Keynes, Ricardo, bourse, obligations, dette, Bretton Woods et le dollar) ; géopolitique (ONU, Moyen-Orient) ; esprit critique (complot lunaire, terre plate, chemtrails, 11-Septembre, sophismes, fact-checking) ; logique et rhétorique ; maths curieuses (nombre d'or, Fibonacci, fractales) ; personnalités inspirantes à collectionner.

STYLE
- Toujours en français, chaleureux, enthousiaste, jamais moralisateur. Adam 13 ans : tu peux aller loin. Alix 11 ans : plus simple et imagé.
- Longueur adaptée à la demande : court par défaut (quelques phrases), mais développe vraiment quand c'est une histoire, un tuto, une liste d'idées, un prompt détaillé ou une explication qui le mérite.
- Quand c'est une question de réflexion, tu peux lui retourner la question ("et toi, qu'en penses-tu ?") — mais une fois, pas à chaque message, et jamais pour esquiver.
- L'enfant peut t'envoyer des images ou des captures d'écran (un exercice, un schéma, une carte, une photo, un dessin…) : regarde-les, décris-les, commente-les, aide-le.

DEVOIRS ET EXERCICES
Commence par guider (indice, méthode, première étape). Mais si l'enfant redemande, dit qu'il est bloqué ou veut vérifier, donne la réponse complète ET explique-la : tu n'es pas là pour lui résister.

LES SEULES VRAIES LIMITES
- Contenu sexuel ou romantique explicite, drogues et alcool présentés positivement, incitation à la violence, automutilation ou troubles alimentaires, moyens de se faire du mal ou de faire du mal à quelqu'un, contenu haineux, aide à tricher en dissimulant (faux mots d'excuse, contourner un contrôle parental).
- Sur les sujets sensibles (guerres actuelles, religion, politique, 11-Septembre, sexualité, mort), tu ne te dérobes pas : tu réponds de façon factuelle, calme, adaptée à l'âge, tu présentes les différents points de vue, et tu suggères d'en reparler avec un parent quand c'est un sujet intime ou lourd.
- Si un enfant a l'air en détresse (harcèlement, tristesse durable, idées noires), prends-le au sérieux, écoute-le, et encourage-le chaleureusement à en parler à son père, sa mère ou un adulte de confiance.
- Quand tu dois refuser, fais-le en une phrase, sans sermon, et propose immédiatement autre chose. Un refus doit rester RARE : dans le doute, aide.`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const fam = process.env.FAMILY_CODE;
  if (fam && ((req.body || {}).code || '') !== fam) {
    res.status(200).json({ error: 'code_famille', reply: "🔐 Code famille manquant ou incorrect — clique sur OK et saisis le code que papa t'a donné !" });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(200).json({ reply: "Le chat n'est pas encore activé — demande à papa d'ajouter la clé API Anthropic dans les réglages ! En attendant, note ta question dans ton carnet. 📝" });
    return;
  }
  try {
    const { child, messages, assistantName, profile, memory, mode, quizContext } = req.body || {};
    const name = (assistantName || 'ton assistant').toString().slice(0, 30) || 'ton assistant';
    const prof = (profile || '').toString().slice(0, 2500);
    const memo = (memory || '').toString().slice(0, 1800);
    // mode "memoire" : condenser la conversation récente + l'ancienne mémoire en un résumé glissant
    if (mode === 'memoire') {
      const transcript = (messages || [])
        .filter(m => m && typeof m.content === 'string')
        .slice(-16)
        .map(m => `${m.role === 'user' ? 'Enfant' : 'Assistant'}: ${m.content.slice(0, 400)}`)
        .join('\n');
      if (!transcript) { res.status(200).json({ memory: memo }); return; }
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL_LIGHT || 'claude-haiku-4-5',
          max_tokens: 400,
          system: "Tu tiens la mémoire d'un assistant personnel pour un enfant de 11-15 ans (sujets scolaires ET loisirs, créations, centres d'intérêt). À partir de l'ancienne mémoire et des nouveaux échanges, écris la nouvelle mémoire : ce que l'enfant a demandé, ses centres d'intérêt, ce qu'il a compris ou pas, ses projets en cours, ce qu'il faudrait suivre. Français, 120 mots max, phrases télégraphiques, uniquement la mémoire sans texte autour.",
          messages: [{ role: 'user', content: `ANCIENNE MÉMOIRE :\n${memo || '(vide)'}\n\nNOUVEAUX ÉCHANGES :\n${transcript}` }],
        }),
      });
      const j = await r.json();
      if (!r.ok) { console.error('anthropic memoire error', j); res.status(200).json({ memory: memo }); return; }
      const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
      res.status(200).json({ memory: text.slice(0, 1800) || memo });
      return;
    }
    const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const clean = (messages || [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map(m => {
        const text = m.content.slice(0, 2000);
        // image acceptée uniquement sur un message utilisateur, format et taille contrôlés (~3 Mo base64 max)
        const img = m.role === 'user' && m.image && typeof m.image.data === 'string'
          && IMG_TYPES.includes(m.image.media_type) && m.image.data.length < 4_000_000 ? m.image : null;
        if (img) {
          const blocks = [{ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } }];
          if (text) blocks.push({ type: 'text', text });
          return { role: m.role, content: blocks };
        }
        // jamais de contenu vide (l'API exige des messages non vides qui alternent) :
        // un ancien message-image sans texte devient un marqueur
        return { role: m.role, content: text || (m.role === 'user' ? "[l'enfant avait envoyé une image ici]" : '…') };
      });
    if (!clean.length || clean[clean.length - 1].role !== 'user') {
      res.status(400).json({ error: 'message manquant' }); return;
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        max_tokens: 1200,
        system: buildSystem(name) + `\n\nL'enfant connecté est : ${child === 'alix' ? 'Alix, 11 ans' : 'Adam, 13 ans'}.`
          + (prof ? `\n\nCe que tu sais de cet enfant (contexte fourni par son parent — utilise-le naturellement pour personnaliser tes réponses, tes exemples et tes encouragements, mais ne le récite jamais mot à mot et ne dis jamais "d'après ton profil" ou "ton parent m'a dit") :\n${prof}` : '')
          + (memo ? `\n\nTa mémoire des conversations passées avec cet enfant (utilise-la naturellement pour assurer la continuité — "la dernière fois tu me demandais…" — sans la réciter) :\n${memo}` : '')
          + (quizContext ? `\n\nMODE INTERROGE-MOI ACTIVÉ : l'enfant veut réviser en jouant. Pose UNE question de révision à la fois sur ce qu'il a vu (thèmes ci-dessous), attends sa réponse, corrige avec bienveillance et enthousiasme (donne la bonne réponse s'il se trompe, félicite s'il réussit), puis enchaîne sur la question suivante. Varie les thèmes et la difficulté, compte ses points (score sur le nombre de questions posées). Thèmes vus :\n${String(quizContext).slice(0, 1500)}` : ''),
        messages: clean,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('anthropic error', j);
      res.status(200).json({ reply: "Petit souci technique de mon côté — réessaie dans une minute !" });
      return;
    }
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    res.status(200).json({ reply: text || '…' });
  } catch (e) {
    console.error(e);
    res.status(200).json({ reply: "Petit souci technique — réessaie dans une minute !" });
  }
};
