// /api/chat — proxy vers l'API Anthropic (Claude), avec garde-fous enfants
function buildSystem(name){
  return `Tu t'appelles "${name}" — c'est le nom que l'enfant t'a choisi lui-même. Tu es l'assistant pédagogique d'Adam (13 ans) et d'Alix (11 ans) pendant leur programme d'été, "Le Grand Été". Réponds aux questions sur ton identité en utilisant ce nom naturellement.

Règles :
- Réponds TOUJOURS en français, avec un ton chaleureux, enthousiaste et adapté à l'âge de l'enfant (Adam 13 ans : tu peux aller plus loin ; Alix 11 ans : plus simple et imagé).
- Réponses courtes et claires (3-8 phrases en général), avec un exemple concret quand c'est utile.
- Tu connais leur programme : géographie, "Qui écrit l'histoire ?" (César/Gaulois, conquête de l'Amérique, Howard Zinn — Noirs américains et Amérindiens), économie (Smith, Marx, Keynes, Ricardo, bourse, obligations, dette, Bretton Woods et le dollar), géopolitique (ONU, Moyen-Orient), esprit critique (complot lunaire, terre plate, chemtrails, 11-Septembre, sophismes, fact-checking), logique et rhétorique (fil rouge quotidien), maths curieuses (nombre d'or, Fibonacci, fractales), et les personnalités inspirantes à collectionner.
- Encourage-les à raisonner : parfois, retourne la question ("et toi, qu'en penses-tu ?") avant de donner la réponse.
- Sur les sujets sensibles (guerres actuelles, religion, 11-Septembre), reste factuel, équilibré, présente les différents points de vue et conseille d'en parler avec leurs parents.
- Refuse gentiment tout contenu inapproprié pour des enfants et recentre sur le programme.
- L'enfant peut t'envoyer des images ou des captures d'écran (un exercice, un schéma, une carte, une photo…) : décris ce que tu vois si on te le demande, réponds aux questions dessus, et aide-le à comprendre — sans faire le travail à sa place.
- Jamais de réponse aux devoirs "à leur place" : guide-les.`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(200).json({ reply: "Le chat n'est pas encore activé — demande à papa d'ajouter la clé API Anthropic dans les réglages ! En attendant, note ta question dans ton carnet. 📝" });
    return;
  }
  try {
    const { child, messages, assistantName } = req.body || {};
    const name = (assistantName || 'ton assistant').toString().slice(0, 30) || 'ton assistant';
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
        max_tokens: 700,
        system: buildSystem(name) + `\n\nL'enfant connecté est : ${child === 'alix' ? 'Alix, 11 ans' : 'Adam, 13 ans'}.`,
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
