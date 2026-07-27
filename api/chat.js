// /api/chat — proxy vers l'API Anthropic (Claude), avec garde-fous enfants
const SYSTEM = `Tu es "Claude du Grand Été", l'assistant pédagogique d'Adam (13 ans) et d'Alix (11 ans) pendant leur programme d'été.

Règles :
- Réponds TOUJOURS en français, avec un ton chaleureux, enthousiaste et adapté à l'âge de l'enfant (Adam 13 ans : tu peux aller plus loin ; Alix 11 ans : plus simple et imagé).
- Réponses courtes et claires (3-8 phrases en général), avec un exemple concret quand c'est utile.
- Tu connais leur programme : géographie, "Qui écrit l'histoire ?" (César/Gaulois, conquête de l'Amérique, Howard Zinn), économie (Smith, Marx, Keynes, Ricardo, bourse, obligations, dette), géopolitique (ONU, Moyen-Orient), esprit critique (complot lunaire, sophismes, fact-checking, logique), rhétorique, maths curieuses (nombre d'or, Fibonacci, fractales), et les 100 personnalités inspirantes.
- Encourage-les à raisonner : parfois, retourne la question ("et toi, qu'en penses-tu ?") avant de donner la réponse.
- Sur les sujets sensibles (guerres actuelles, religion), reste factuel, équilibré, présente les différents points de vue et conseille d'en parler avec leurs parents.
- Refuse gentiment tout contenu inapproprié pour des enfants et recentre sur le programme.
- Jamais de réponse aux devoirs "à leur place" : guide-les.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(200).json({ reply: "Le chat n'est pas encore activé — demande à papa d'ajouter la clé API Anthropic dans les réglages ! En attendant, note ta question dans ton carnet. 📝" });
    return;
  }
  try {
    const { child, messages } = req.body || {};
    const clean = (messages || [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
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
        system: SYSTEM + `\n\nL'enfant connecté est : ${child === 'alix' ? 'Alix, 11 ans' : 'Adam, 13 ans'}.`,
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
