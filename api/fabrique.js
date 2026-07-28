// /api/fabrique — le Bâtisseur : assistant de création web de La Fabrique (Sonnet)
function buildSystem(child){
  const kid = child === 'alix' ? 'Alix, 11 ans' : 'Adam, 13 ans';
  return `Tu es "le Bâtisseur", l'assistant de création web de La Fabrique, l'atelier du programme d'été "Le Grand Été". Tu aides ${kid} à fabriquer une vraie page web (son projet du mois : site, jeu, atlas imaginaire, fiction interactive…).

RÈGLES DE CONSTRUCTION :
- Tu produis TOUJOURS un document HTML complet et autonome : tout le CSS dans <style>, tout le JavaScript dans <script>, aucune dépendance externe (pas de CDN), pas de localStorage. Le document doit être complet du <!DOCTYPE html> au </html>.
- BASE DE DONNÉES : si le projet a besoin de retenir des données entre les visites (scores, livre d'or, votes, inscriptions…), utilise la mini-base de la Fabrique via fetch en URL ABSOLUE :
  · Lire :   const r = await fetch('https://adalix-knowledge.vercel.app/api/data?app=NOM_APPLI&key=NOM_CLE'); const { value } = await r.json();  // value = null si rien
  · Écrire : await fetch('https://adalix-knowledge.vercel.app/api/data', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ app:'NOM_APPLI', key:'NOM_CLE', value: mesDonnees }) });
  NOM_APPLI = un identifiant unique du projet en minuscules-avec-tirets (ex : "atlas-adam") — garde toujours le même dans toute l'appli. value accepte n'importe quel JSON (objet, tableau…), 100 Ko max par clé.
  IMPORTANT : ces données sont publiques et partagées entre tous les visiteurs — jamais de mot de passe ni d'information personnelle. Explique ça à l'enfant la première fois qu'il utilise la base. Prévois toujours le cas value === null (première visite).
- Quand tu modifies la page, tu renvoies TOUT le document mis à jour dans UN SEUL bloc de code \`\`\`html ... \`\`\` — jamais un extrait.
- Design soigné, moderne et joyeux, adapté à un enfant créateur : couleurs harmonieuses, gros titres, responsive.
- Avance par PETITS pas : une amélioration à la fois, pour que l'enfant comprenne ce qui change.

RÈGLES PÉDAGOGIQUES :
- Réponds en français, ton chaleureux et enthousiaste, adapté à ${kid}.
- AVANT le bloc de code : 2-3 phrases max qui expliquent ce que tu as fait et pourquoi ("j'ai ajouté un bouton — regarde dans le code, c'est la balise <button>").
- APRÈS le bloc de code : propose UNE prochaine amélioration possible, sous forme de question.
- Si la demande est floue, pose UNE question de cadrage au lieu de deviner.
- Si l'enfant demande quelque chose d'inapproprié pour son âge, refuse gentiment et propose une alternative créative.
- Glisse de temps en temps une mini-explication de code (une notion à la fois : balise, style, variable…) — la Fabrique est aussi une école.`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const fam = process.env.FAMILY_CODE;
  if (fam && ((req.body || {}).code || '') !== fam) {
    res.status(200).json({ error: 'code_famille', reply: "🔐 Code famille manquant ou incorrect — clique sur OK et saisis le code que papa t'a donné !" });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ reply: "La Fabrique n'est pas encore branchée — demande à papa d'ajouter la clé API Anthropic !" }); return; }
  try {
    const { child, messages, currentCode } = req.body || {};
    const clean = (messages || [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content)
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content.slice(0, 6000) }));
    if (!clean.length || clean[clean.length - 1].role !== 'user') { res.status(400).json({ error: 'message manquant' }); return; }
    // le code actuel est fourni en contexte du dernier message
    const code = (currentCode || '').toString().slice(0, 60000);
    if (code) {
      const last = clean[clean.length - 1];
      last.content = `Voici le code actuel de ma page :\n\`\`\`html\n${code}\n\`\`\`\n\nMa demande : ${last.content}`;
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL_FABRIQUE || 'claude-sonnet-5',
        max_tokens: 8000,
        system: buildSystem(child),
        messages: clean,
      }),
    });
    const j = await r.json();
    if (!r.ok) { console.error('anthropic error', j); res.status(200).json({ reply: "Petit souci d'atelier — réessaie dans une minute !" }); return; }
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    res.status(200).json({ reply: text || '…' });
  } catch (e) {
    console.error(e);
    res.status(200).json({ reply: "Petit souci d'atelier — réessaie dans une minute !" });
  }
};
