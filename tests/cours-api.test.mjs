/* Tests du module « Mes cours ». Charge les deux fichiers tels qu'ils seront servis,
   sans les modifier : on récupère leurs fonctions internes via new Function. */
import fs from 'fs';
import path from 'path';

const RACINE = process.argv[2];
let ko = 0, ok = 0;
const eq = (nom, a, b) => {
  const bon = JSON.stringify(a) === JSON.stringify(b);
  if (bon) { ok++; } else { ko++; console.log('  ✗ ' + nom + '\n     attendu : ' + JSON.stringify(b) + '\n     obtenu  : ' + JSON.stringify(a)); }
};
const vrai = (nom, c, info) => { if (c) ok++; else { ko++; console.log('  ✗ ' + nom + (info ? '\n     ' + info : '')); } };

/* ---------- api/cours.js ---------- */
const srcApi = fs.readFileSync(path.join(RACINE, 'api/cours.js'), 'utf8');
function chargeApi(fetchStub) {
  const mod = { exports: {} };
  const f = new Function('module', 'exports', 'fetch', 'process', 'console',
    srcApi + '\n;return {handler: module.exports, construitRessources, jsonDe, SITES, appelClaude};');
  return f(mod, mod.exports, fetchStub, { env: { ANTHROPIC_API_KEY: 'test-key' } }, console);
}

console.log('\n— construitRessources : aucun lien inventé —');
{
  const A = chargeApi(async () => ({}));
  const r = A.construitRessources([
    { site: 'lumni', requete: 'la Révolution française', titre: 'La Révolution', pourquoi: 'des vidéos courtes' },
    { site: 'site-qui-nexiste-pas', requete: 'x', titre: 'y' },
    { site: 'vikidia', requete: '' },
    { site: 'notabene', requete: 'Louis XVI' },
    { site: 'wikipedia', requete: 'a' }, { site: 'khan', requete: 'b' }, { site: 'arte', requete: 'c' },
  ]);
  eq('les sites inconnus sont écartés', r.some(x => /nexiste/.test(x.url)), false);
  eq('une requête vide est écartée', r.some(x => x.site === 'Vikidia'), false);
  vrai('le lien Lumni est construit', r[0].url === 'https://www.lumni.fr/recherche?q=la%20R%C3%A9volution%20fran%C3%A7aise', r[0].url);
  vrai('le lien YouTube est cadré sur la chaîne', /nota%20bene/.test(r[1].url), r[1].url);
  eq('au plus 4 ressources', r.length <= 4, true);
  vrai('toutes les URL sont en https', r.every(x => x.url.startsWith('https://')));
  const tous = Object.keys(A.SITES).map(k => A.SITES[k].url('test'));
  vrai('tous les sites du catalogue produisent une URL https', tous.every(u => u.startsWith('https://')), tous.filter(u => !u.startsWith('https://')).join());
}

console.log('\n— jsonDe : tolérant au bavardage du modèle —');
{
  const A = chargeApi(async () => ({}));
  eq('JSON nu', A.jsonDe('{"a":1}'), { a: 1 });
  eq('JSON dans un bloc de code', A.jsonDe('Voici :\n```json\n{"a":2}\n```'), { a: 2 });
  eq('JSON invalide', A.jsonDe('pas du json'), null);
  eq('texte vide', A.jsonDe(''), null);
}

console.log('\n— handler transcrire : de la photo au cours normalisé —');
{
  const reponseIA = {
    titre: 'La Révolution française', matiere: 'histoire', niveau: '4e', chapitre: '1789-1799',
    resume: 'Résumé du cours.', texte: '## Les causes\n- La crise financière\n',
    points_cles: ['a', 'b'], vocabulaire: [{ mot: 'Tiers État', def: 'le peuple' }, { mot: '', def: 'ignoré' }],
    a_retenir: [{ notion: 'Date clé', q: 'Quand ?', r: '1789' }, { notion: 'vide', q: '', r: '' }],
    ressources: [{ site: 'lumni', requete: 'Révolution française', titre: 'T', pourquoi: 'P' }],
    incertitudes: ['un mot page 2'],
  };
  let corpsEnvoye = null;
  const A = chargeApi(async (url, opts) => {
    corpsEnvoye = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(reponseIA) }], stop_reason: 'end_turn' }) };
  });
  const rep = () => { const o = { code: 0, body: null }; return { o, status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } }; };

  let R = rep();
  const photo = { media_type: 'image/jpeg', data: 'AAAA' };
  await A.handler({ method: 'POST', body: { mode: 'transcrire', child: 'alix', matiere: 'histoire', photos: [photo] } }, R);
  const c = R.o.body.cours;
  eq('statut 200', R.o.code, 200);
  eq('titre repris', c.titre, 'La Révolution française');
  eq('le vocabulaire incomplet est filtré', c.vocabulaire.length, 1);
  eq('les cartes vides sont filtrées', c.a_retenir.length, 1);
  eq('la ressource est devenue un lien', c.ressources[0].url.startsWith('https://www.lumni.fr/'), true);
  eq('les incertitudes remontent', c.incertitudes, ['un mot page 2']);
  vrai("l'image part bien en base64 vers l'API", corpsEnvoye.messages[0].content[0].source.data === 'AAAA');
  vrai("l'âge de l'enfant est dans le system prompt", /Alix, 11 ans/.test(corpsEnvoye.system));
  vrai('le catalogue de sites est dans le system prompt', /vikidia/.test(corpsEnvoye.system));
  vrai('le repli serveur est demandé', corpsEnvoye.fallbacks === 'default');

  R = rep();
  await A.handler({ method: 'POST', body: { mode: 'transcrire', child: 'adam', photos: [] } }, R);
  vrai('sans photo : message clair, pas de plantage', /photo/i.test(R.o.body.error || ''), JSON.stringify(R.o.body));

  R = rep();
  await A.handler({ method: 'POST', body: { mode: 'transcrire', child: 'adam', photos: [{ media_type: 'application/pdf', data: 'x' }] } }, R);
  vrai('un type de fichier non image est refusé', !!R.o.body.error);

  R = rep();
  await A.handler({ method: 'POST', body: { mode: 'transcrire', child: 'bob', photos: [photo] } }, R);
  eq('enfant inconnu refusé', R.o.code, 400);

  R = rep();
  await A.handler({ method: 'GET', body: {} }, R);
  eq('GET refusé', R.o.code, 405);
}

console.log('\n— handler : le refus du modèle est traduit pour un enfant —');
{
  const A = chargeApi(async () => ({ ok: true, status: 200, json: async () => ({ stop_reason: 'refusal', content: [] }) }));
  const o = { code: 0, body: null };
  const R = { status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } };
  await A.handler({ method: 'POST', body: { mode: 'transcrire', child: 'alix', photos: [{ media_type: 'image/jpeg', data: 'A' }] } }, R);
  vrai('message compréhensible, pas de trace technique', /parent/.test(o.body.error), o.body.error);
}

console.log('\n— appelClaude : repli quand le modèle configuré est absent —');
{
  const vus = []; let dernierCorps = null;
  const A = chargeApi(async (url, opts) => {
    const b = JSON.parse(opts.body); vus.push(b.model); dernierCorps = b;
    if (b.model === 'modele-inexistant') return { ok: false, status: 404, json: async () => ({ error: { message: 'model not found' } }) };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '{"ok":1}' }] }) };
  });
  const r = await A.appelClaude('k', { model: 'modele-inexistant', output_config: { effort: 'medium' }, messages: [] }, false);
  vrai('un 404 déclenche le repli sur le modèle éprouvé', vus[1] === 'claude-sonnet-4-5', vus.join(' → '));
  vrai('le repli réussit', r.ok === true);
  vrai('le repli abandonne output_config (absent des anciens modèles)', dernierCorps.output_config === undefined, JSON.stringify(dernierCorps.output_config));
}

console.log('\n— handler exos : normalisation des exercices —');
{
  const A = chargeApi(async () => ({
    ok: true, status: 200, json: async () => ({
      content: [{ type: 'text', text: JSON.stringify({ exercices: [
        { type: 'qcm', enonce: 'Q1', options: ['a', 'b', 'c', 'd'], reponse: '2', explication: 'E', notion: 'N' },
        { type: 'qcm', enonce: 'QCM cassé', options: ['seule'], reponse: '0' },
        { type: 'bizarre', enonce: 'Q2', reponse: 'R' },
        { enonce: '', reponse: 'vide' },
      ] }) }],
    }),
  }));
  const o = { code: 0, body: null };
  const R = { status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } };
  await A.handler({ method: 'POST', body: { mode: 'exos', child: 'adam', nb: 4, cours: { titre: 'T', texte: 'X' } } }, R);
  eq('les exercices invalides sont écartés', o.body.exercices.length, 2);
  eq('un type inconnu devient une question ouverte', o.body.exercices[1].type, 'reponse');
  eq('le QCM garde ses options', o.body.exercices[0].options.length, 4);
}

/* ---------- cours.js (client) ---------- */
console.log('\n— coursMd : rendu du cours, et sécurité —');
{
  const src = fs.readFileSync(path.join(RACINE, 'cours.js'), 'utf8');
  const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = new Function('esc', 'child', 'db', 'toast', 'modal', 'closeModal', 'familyCode', 'badFamilyCode', 'todayStr', '$', 'document', 'fetch', 'window',
    src + '\n;return {coursMd, matOf, BOX_JOURS, MATIERES};');
  const C = f(esc, null, {}, () => {}, () => {}, () => {}, '', () => {}, () => '2026-10-24', () => null,
    { querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null }, () => {},
    { matchMedia: () => ({ matches: false }) });

  eq('titre de partie', C.coursMd('## Les causes'), '<h4>Les causes</h4>');
  eq('sous-partie', C.coursMd('### Détail'), '<h5>Détail</h5>');
  eq('puces regroupées', C.coursMd('- un\n- deux'), '<ul><li>un</li><li>deux</li></ul>');
  eq('liste numérotée', C.coursMd('1. un\n2. deux'), '<ol><li>un</li><li>deux</li></ol>');
  eq('la liste se ferme avant un paragraphe', C.coursMd('- un\n\nfin'), '<ul><li>un</li></ul><p>fin</p>');
  eq('gras', C.coursMd('le **Tiers État**'), '<p>le <b>Tiers État</b></p>');
  eq('citation', C.coursMd('> une règle'), '<blockquote>une règle</blockquote>');
  eq('séparateur', C.coursMd('---'), '<hr>');
  eq('les balises sont neutralisées', C.coursMd('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  eq('un guillemet ne casse pas un attribut', C.coursMd('il a dit "oui"'), '<p>il a dit &quot;oui&quot;</p>');
  eq('texte vide', C.coursMd(''), '');
  eq('null ne plante pas', C.coursMd(null), '');
  vrai('les formules restent lisibles', C.coursMd('aire = π × r²') === '<p>aire = π × r²</p>');
  vrai('une multiplication ne devient pas de l\'italique', C.coursMd('3 * 4 * 5') === '<p>3 * 4 * 5</p>', C.coursMd('3 * 4 * 5'));

  eq('matière connue', C.matOf('maths').label, 'Maths');
  eq('matière inconnue → Autre', C.matOf('zzz').label, 'Autre');
  vrai('les intervalles de Leitner sont croissants',
    [1, 2, 3, 4, 5].every((b, i, a) => i === 0 || C.BOX_JOURS[b] > C.BOX_JOURS[a[i - 1]]));
}

console.log('\n' + (ko ? `❌ ${ko} échec(s), ${ok} test(s) passés` : `✅ ${ok} tests passés`));
process.exit(ko ? 1 : 0);
