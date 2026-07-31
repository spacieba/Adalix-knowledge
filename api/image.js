// /api/image — atelier d'images via Runware (Seedream) : styles, formats, image de référence, prompt magique
const crypto = require('crypto');

// Filtre de sécurité. IMPORTANT : il travaille sur des MOTS ENTIERS (l'ancienne version,
// une simple regex de fragments, bloquait "nuage", "nuit", "menu", "sanglier", "mortier"…).
// On ne bloque que ce qui est réellement problématique : ni "arme", ni "sang", ni "violence"
// (un chevalier, un dragon ou une scène d'aventure sont parfaitement légitimes à 11-15 ans).
const BLOCKED_WORDS = [
  // sexuel
  'nu', 'nue', 'nus', 'nues', 'nude', 'nudes', 'naked', 'topless', 'sexy', 'sexe', 'sex',
  'porn', 'porno', 'pornographie', 'pornographique', 'erotique', 'erotic', 'nsfw',
  'seins', 'nichons', 'fesses', 'lingerie',
  // violence extrême / horreur graphique
  'gore', 'sanglant', 'sanglante', 'ensanglante', 'ensanglantee', 'mutile', 'mutilee', 'mutilation',
  'decapite', 'decapitee', 'decapitation', 'cadavre', 'cadavres', 'corpse', 'dead body',
  'torture', 'torturer', 'massacre', 'meurtre', 'murder', 'egorge', 'egorgee',
  // atteintes à soi / aux autres
  'suicide', 'suicider', 'pendaison', 'automutilation', 'scarification',
  'viol', 'violer', 'violee',
  // drogues
  'drogue', 'drogues', 'cocaine', 'crack', 'seringue', 'shooteuse',
  // haine
  'nazi', 'nazie', 'nazis', 'hitler', 'croix gammee', 'swastika', 'kkk',
];
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const BLOCK_RE = new RegExp('(^|[^a-z0-9])(' + BLOCKED_WORDS.join('|') + ')([^a-z0-9]|$)');
const isBlocked = s => BLOCK_RE.test(norm(s));

// styles proposés aux enfants (le suffixe est ajouté au prompt)
const STYLES = {
  libre: '',
  ghibli: ', style Studio Ghibli, aquarelle douce et détaillée, lumière chaleureuse, atmosphère poétique',
  realiste: ', photographie ultra réaliste, très détaillée, lumière naturelle, mise au point parfaite',
  cartoon: ', cartoon moderne, contours nets, couleurs vives et joyeuses, expressif',
  comics: ', style comics américain, encrage marqué, couleurs franches, composition dynamique, onomatopées',
  aquarelle: ', peinture à l\'aquarelle, papier texturé, couleurs délicates qui se fondent, touches lumineuses',
  manga: ', style anime manga japonais, cel-shading, grands yeux expressifs, traits élégants',
  pixel: ', pixel art 16-bit, palette rétro de jeu vidéo, adorable et précis',
  pixar: ', film d\'animation 3D style Pixar, rendu doux et lumineux, personnages expressifs et attachants',
  fantasy: ', illustration héroïc-fantasy épique, détails riches, lumière dramatique, ambiance de légende',
  kawaii: ', style kawaii tout mignon, couleurs pastel, formes rondes, absolument adorable',
};

// formats autorisés (multiples de 64)
const FORMATS = {
  carre: [1024, 1024],
  paysage: [1344, 768],
  portrait: [768, 1344],
  affiche: [960, 1280],
};

async function enhancePrompt(key, prompt, res) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL_LIGHT || 'claude-haiku-4-5',
      max_tokens: 200,
      system: "Tu transformes la description d'image d'un enfant en un prompt riche pour un générateur d'images. Garde l'idée et la langue française, ajoute des détails visuels concrets (composition, lumière, ambiance, couleurs, détails). 40-60 mots maximum, une seule phrase descriptive, sans style artistique (il est choisi à part), sans texte autour : réponds UNIQUEMENT avec le prompt. Contenu toujours adapté aux enfants.",
      messages: [{ role: 'user', content: prompt.slice(0, 400) }],
    }),
  });
  const j = await r.json();
  if (!r.ok) { console.error('anthropic enhance error', j); res.status(200).json({ error: 'La baguette magique a raté — réessaie !' }); return; }
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
  res.status(200).json({ prompt: text.slice(0, 500) || prompt });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const fam = process.env.FAMILY_CODE;
  if (fam && ((req.body || {}).code || '') !== fam) {
    res.status(200).json({ error: 'code_famille', reply: "🔐 Code famille manquant ou incorrect — clique sur OK et saisis le code que papa t'a donné !" });
    return;
  }
  try {
    const { prompt, mode, style, format, reference } = req.body || {};
    if (!prompt || typeof prompt !== 'string') { res.status(400).json({ error: 'prompt manquant' }); return; }
    if (isBlocked(prompt)) {
      res.status(200).json({ error: "Cette description n'est pas adaptée — essaie autre chose de joyeux ou d'imaginaire !" });
      return;
    }
    // ✨ prompt magique : on enrichit la description (Haiku), pas de génération
    if (mode === 'enhance') {
      const akey = process.env.ANTHROPIC_API_KEY;
      if (!akey) { res.status(200).json({ prompt }); return; }
      await enhancePrompt(akey, prompt, res);
      return;
    }
    const key = process.env.RUNWARE_API_KEY;
    if (!key) { res.status(200).json({ error: "L'atelier d'images n'est pas encore activé." }); return; }
    const suffix = STYLES[style] !== undefined ? STYLES[style] : '';
    const [width, height] = FORMATS[format] || FORMATS.carre;
    const model = process.env.RUNWARE_MODEL || 'bytedance:5@0';
    // image de référence (transformer une photo/un dessin) : base64 jpeg/png/webp, ~3 Mo max
    const ref = reference && typeof reference.data === 'string' && reference.data.length < 4_000_000
      && ['image/jpeg', 'image/png', 'image/webp'].includes(reference.media_type)
      ? `data:${reference.media_type};base64,${reference.data}` : null;
    const base = {
      taskType: 'imageInference',
      taskUUID: crypto.randomUUID(),
      // NB : on n'ajoute PLUS ", adapté aux enfants" au prompt — cette phrase poussait le
      // modèle à glisser des enfants dans l'image (gênant pour un croquis de mode).
      // Le garde-fou reste le filtre isBlocked() ci-dessus + la présence d'un parent.
      positivePrompt: prompt.slice(0, 500) + suffix,
      model, width, height, numberResults: 1,
      outputType: 'dataURI', outputFormat: 'JPG',
    };
    const call = async task => {
      const r = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
        body: JSON.stringify([task]),
      });
      return r.json();
    };
    let j = await call(ref ? { ...base, seedImage: ref, strength: 0.65 } : base);
    let img = j && j.data && j.data.find(d => d.taskType === 'imageInference');
    // certains modèles attendent referenceImages plutôt que seedImage : second essai
    if (!img && ref) {
      console.error('runware seedImage failed', JSON.stringify(j).slice(0, 500));
      j = await call({ ...base, referenceImages: [ref] });
      img = j && j.data && j.data.find(d => d.taskType === 'imageInference');
    }
    const out = img && (img.imageDataURI || img.imageURL);
    if (out) { res.status(200).json({ url: out }); return; }
    console.error('runware response', JSON.stringify(j).slice(0, 800));
    res.status(200).json({ error: "La génération n'a pas abouti — réessaie avec une autre description." });
  } catch (e) {
    console.error(e);
    res.status(200).json({ error: 'Erreur technique, réessaie.' });
  }
};
