// /api/image — génération d'images via Runware (Seedream)
const crypto = require('crypto');

const BLOCKLIST = /(nu|nude|naked|sexy|sang|blood|gore|violence|arme|gun|weapon|tuer|kill|mort |dead body|horreur|horror)/i;

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const fam = process.env.FAMILY_CODE;
  if (fam && ((req.body || {}).code || '') !== fam) {
    res.status(200).json({ error: 'code_famille', reply: "🔐 Code famille manquant ou incorrect — clique sur OK et saisis le code que papa t'a donné !" });
    return;
  }
  const key = process.env.RUNWARE_API_KEY;
  if (!key) { res.status(200).json({ error: "L'atelier d'images n'est pas encore activé." }); return; }
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') { res.status(400).json({ error: 'prompt manquant' }); return; }
    if (BLOCKLIST.test(prompt)) {
      res.status(200).json({ error: "Cette description n'est pas adaptée — essaie autre chose de joyeux ou d'imaginaire !" });
      return;
    }
    const taskUUID = crypto.randomUUID();
    const model = process.env.RUNWARE_MODEL || 'bytedance:5@0';
    const r = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
      body: JSON.stringify([
        {
          taskType: 'imageInference',
          taskUUID,
          positivePrompt: prompt.slice(0, 500) + ', style adapté aux enfants, coloré, lumineux',
          model,
          width: 1024,
          height: 1024,
          numberResults: 1,
        },
      ]),
    });
    const j = await r.json();
    const img = j && j.data && j.data.find(d => d.taskType === 'imageInference');
    if (img && img.imageURL) { res.status(200).json({ url: img.imageURL }); return; }
    console.error('runware response', JSON.stringify(j).slice(0, 800));
    res.status(200).json({ error: "La génération n'a pas abouti — réessaie avec une autre description." });
  } catch (e) {
    console.error(e);
    res.status(200).json({ error: 'Erreur technique, réessaie.' });
  }
};
