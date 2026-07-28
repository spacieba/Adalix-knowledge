// /api/publish — pousse la création de l'enfant sur GitHub (repo Adalix-knowledge, dossier fabrique/)
// La page est ensuite servie par Vercel : https://adalix-knowledge.vercel.app/fabrique/<enfant>/
const OWNER = 'spacieba';
const REPO = 'Adalix-knowledge';

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const fam = process.env.FAMILY_CODE;
  if (fam && ((req.body || {}).code || '') !== fam) {
    res.status(200).json({ error: 'code_famille', reply: "🔐 Code famille manquant ou incorrect — clique sur OK et saisis le code que papa t'a donné !" });
    return;
  }
  const token = process.env.GITHUB_FABRIQUE_TOKEN;
  if (!token) {
    res.status(200).json({ error: "La publication n'est pas encore branchée — demande à papa d'ajouter la clé GITHUB_FABRIQUE_TOKEN dans les réglages Vercel !" });
    return;
  }
  try {
    const { child, html } = req.body || {};
    if (!['adam', 'alix'].includes(child)) { res.status(400).json({ error: 'enfant inconnu' }); return; }
    if (typeof html !== 'string' || !html.trim() || html.length > 900000) { res.status(400).json({ error: 'page vide ou trop lourde' }); return; }
    const path = `fabrique/${child}/index.html`;
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
    const headers = { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'adalix-fabrique' };
    // sha actuel (nécessaire pour mettre à jour un fichier existant)
    let sha;
    const cur = await fetch(api, { headers });
    if (cur.ok) { const j = await cur.json(); sha = j.sha; }
    const put = await fetch(api, {
      method: 'PUT', headers,
      body: JSON.stringify({
        message: `🏭 Publication de ${child} via La Fabrique`,
        content: Buffer.from(html, 'utf8').toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    });
    const pj = await put.json();
    if (!put.ok) { console.error('github error', pj); res.status(200).json({ error: 'GitHub a refusé la publication — réessaie dans une minute.' }); return; }
    res.status(200).json({
      url: `https://adalix-knowledge.vercel.app/fabrique/${child}/`,
      commitUrl: (pj.commit && pj.commit.html_url) || '',
      fileUrl: `https://github.com/${OWNER}/${REPO}/blob/main/${path}`,
    });
  } catch (e) {
    console.error(e);
    res.status(200).json({ error: 'Petit souci de publication — réessaie dans une minute.' });
  }
};
