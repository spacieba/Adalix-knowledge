// /api/data — la mini-base de données de La Fabrique (clé/valeur par appli)
// GET  /api/data?app=mon-appli&key=scores          → { value: ... }  (null si absent)
// GET  /api/data?app=mon-appli                     → { keys: [...] }
// POST /api/data  { app, key, value }              → { ok: true }
// Données publiques et partagées : jamais de secrets ni d'infos personnelles.
const SUPA_URL = 'https://qntpdaakdqaysxbeugxk.supabase.co';
const SUPA_KEY = 'sb_publishable_0m2Hob3cSEFz8UzLJrwBhw_AuW3EIOB';
const HEADERS = { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };
const clean = (s, n) => (s || '').toString().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, n);

module.exports = async (req, res) => {
  // CORS ouvert : les pages publiées et l'aperçu de la Fabrique (iframe sandbox) doivent pouvoir appeler l'API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method === 'GET') {
      const app = clean(req.query.app, 60);
      if (!app) { res.status(400).json({ error: 'app manquant' }); return; }
      const key = clean(req.query.key, 60);
      if (key) {
        const r = await fetch(`${SUPA_URL}/rest/v1/adalix_appdata?app=eq.${app}&k=eq.${key}&select=v`, { headers: HEADERS });
        const j = await r.json();
        res.status(200).json({ value: (Array.isArray(j) && j[0]) ? j[0].v : null });
      } else {
        const r = await fetch(`${SUPA_URL}/rest/v1/adalix_appdata?app=eq.${app}&select=k`, { headers: HEADERS });
        const j = await r.json();
        res.status(200).json({ keys: Array.isArray(j) ? j.map(x => x.k) : [] });
      }
      return;
    }
    if (req.method === 'POST') {
      const { app, key, value } = req.body || {};
      const a = clean(app, 60), k = clean(key, 60);
      if (!a || !k) { res.status(400).json({ error: 'app et key obligatoires (lettres, chiffres, tirets)' }); return; }
      const body = JSON.stringify(value === undefined ? null : value);
      if (body.length > 100000) { res.status(400).json({ error: 'valeur trop grosse (100 Ko max)' }); return; }
      const r = await fetch(`${SUPA_URL}/rest/v1/adalix_appdata?on_conflict=app,k`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ app: a, k, v: value === undefined ? null : value, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) { console.error('supabase error', await r.text()); res.status(200).json({ error: 'sauvegarde impossible — réessaie' }); return; }
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: 'GET ou POST' });
  } catch (e) {
    console.error(e);
    res.status(200).json({ error: 'petit souci — réessaie' });
  }
};
