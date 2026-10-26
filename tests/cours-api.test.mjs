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
function chargeApi(fetchStub, env) {
  const mod = { exports: {} };
  const f = new Function('module', 'exports', 'fetch', 'process', 'console',
    srcApi + '\n;return {handler: module.exports, construitRessources, jsonDe, SITES, appelClaude};');
  return f(mod, mod.exports, fetchStub, { env: Object.assign({ ANTHROPIC_API_KEY: 'test-key' }, env || {}) }, console);
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

/* ---------- le code famille ----------
   Il est tapé par un enfant sur un clavier de téléphone, qui ajoute volontiers une
   majuscule au premier caractère ou un espace à la fin. Un refus silencieux laissait
   croire que « rien ne se passe » — c'est arrivé au premier vrai essai. */
console.log('\n— le code famille —');
{
  const repondeur = () => { const R = { code: 0, body: null }; R.status = c => { R.code = c; return R; }; R.json = b => { R.body = b; return R; }; return R; };
  const photo = { media_type: 'image/jpeg', data: 'AAA' };
  const appel = async (code, fam) => {
    const A = chargeApi(async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: '{"titre":"T","texte":"x"}' }] }) }), { FAMILY_CODE: fam });
    const R = repondeur();
    await A.handler({ method: 'POST', body: { mode: 'transcrire', child: 'alix', photos: [photo], code } }, R);
    return R.body || {};
  };

  eq('le bon code passe', (await appel('Maison42', 'Maison42')).error, undefined);
  eq('un mauvais code est refusé', (await appel('pas-le-bon', 'Maison42')).error, 'code_famille');
  eq('le code vide est refusé', (await appel('', 'Maison42')).error, 'code_famille');
  eq('le code absent est refusé', (await appel(undefined, 'Maison42')).error, 'code_famille');
  // ce que fait un clavier de téléphone
  eq('une majuscule ajoutée par le clavier passe', (await appel('maison42', 'Maison42')).error, undefined);
  eq('une majuscule en trop passe aussi', (await appel('MAISON42', 'Maison42')).error, undefined);
  eq('un espace collé à la fin passe', (await appel('Maison42 ', 'Maison42')).error, undefined);
  eq('un espace au début passe', (await appel('  Maison42', 'Maison42')).error, undefined);
  // sans code configuré, on ne bloque personne
  eq('sans FAMILY_CODE, rien n\'est exigé', (await appel(undefined, undefined)).error, undefined);
  // le tiret oblige à changer de clavier sur un téléphone, et certains le remplacent
  // par un tiret typographique : lettres et chiffres seuls comptent
  eq('un tiret manquant passe', (await appel('bleuet2024', 'bleuet-2024')).error, undefined);
  eq('un tiret typographique passe', (await appel('bleuet\u20132024', 'bleuet-2024')).error, undefined);
  eq('un espace à la place du tiret passe', (await appel('bleuet 2024', 'bleuet-2024')).error, undefined);
  // la tolérance ne va pas jusqu'à laisser passer n'importe quoi
  eq('un code tronqué reste refusé', (await appel('Maison4', 'Maison42')).error, 'code_famille');
  eq('des chiffres faux restent refusés', (await appel('bleuet-2025', 'bleuet-2024')).error, 'code_famille');
  eq('un code vide reste refusé face à un code à symboles', (await appel('', '!!!')).error, 'code_famille');
  eq('un code fait de symboles se compare à l\'identique', (await appel('!!!', '!!!')).error, undefined);
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

console.log('\n— transcrire : les mots mal orthographiés remontent —');
{
  const reponseIA = {
    titre: 'T', matiere: 'francais', texte: 'x', points_cles: [], vocabulaire: [], a_retenir: [],
    ressources: [], incertitudes: [],
    mots_a_revoir: [
      { ecrit: 'bato', correct: 'bateau', syllabes: 'ba-teau', type: 'phonetique' },
      { ecrit: 'chat', correct: 'chat', type: 'visuel' },          // identique : pas une faute
      { ecrit: 'fame', correct: 'femme', type: 'nimportequoi' },   // type inconnu
      { ecrit: '', correct: 'seul' },                              // incomplet
    ],
  };
  const A = chargeApi(async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(reponseIA) }], stop_reason: 'end_turn' }) }));
  const o = { code: 0, body: null };
  const R = { status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } };
  await A.handler({ method: 'POST', body: { mode: 'transcrire', child: 'alix', photos: [{ media_type: 'image/jpeg', data: 'A' }] } }, R);
  const m = o.body.cours.mots_a_revoir;
  eq('seuls les vrais écarts sont gardés', m.length, 2);
  eq('le mot juste est conservé', m[0].correct, 'bateau');
  eq('le découpage en syllabes suit', m[0].syllabes, 'ba-teau');
  eq('un type inconnu devient « autre »', m[1].type, 'autre');
  vrai('un mot écrit correctement n\'est pas signalé', !m.some(x => x.correct === 'chat'));
}

console.log('\n— dictée : un texte à écrire et un texte à dire —');
{
  let corps = null;
  const A = chargeApi(async (url, opts) => {
    corps = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify({
      titre: 'Le chat', texte: 'Le chat dort, paisible.', a_dire: 'Le chat dort virgule paisible point', pieges: ['accords'],
    }) }] }) };
  });
  const o = { code: 0, body: null };
  const R = { status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } };
  await A.handler({ method: 'POST', body: { mode: 'dictee', child: 'alix', longueur: 3,
    mots: [{ mot: 'femme', erreur: 'fame' }, { mot: '' }] } }, R);
  eq('statut 200', o.code, 200);
  eq('le texte à écrire garde sa ponctuation', o.body.dictee.texte, 'Le chat dort, paisible.');
  vrai('le texte à dire énonce la ponctuation', /virgule/.test(o.body.dictee.a_dire));
  vrai('ses propres mots sont transmis au modèle', /femme/.test(corps.system) && /fame/.test(corps.system), corps.system.slice(-300));
  vrai('les mots vides ne polluent pas la consigne', !/- \n/.test(corps.system));
  vrai('la voix de synthèse est prise en compte dans la consigne', /voix de synthèse/.test(corps.system));

  // longueur hors bornes
  await A.handler({ method: 'POST', body: { mode: 'dictee', child: 'alix', longueur: 99, mots: [] } }, R);
  vrai('une dictée démesurée est ramenée à 6 phrases', /6 phrases/.test(corps.system), (corps.system.match(/- \d+ phrases/) || [])[0]);
}

console.log('\n— correction de dictée : on classe, on ne compte pas —');
{
  const A = chargeApi(async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify({
    fautes: [
      { attendu: 'chat', ecrit: 'chas', type: 'phonetique', explication: 'Un t muet.', syllabes: 'chat' },
      { attendu: 'dort', ecrit: 'dor', type: 'zzz', explication: 'Le verbe prend un t.' },
      { attendu: '', ecrit: 'x', type: 'visuel' },
    ],
    mots_justes: 99, total_mots: 4, commentaire: 'Bravo pour « paisible ».',
  }) }] }) }));
  const o = { code: 0, body: null };
  const R = { status(c) { o.code = c; return this; }, json(b) { o.body = b; return this; } };

  await A.handler({ method: 'POST', body: { mode: 'corriger_dictee', child: 'alix', attendu: 'Le chat dort.', reponse: 'Le chas dor' } }, R);
  eq('les écarts sans mot attendu sont écartés', o.body.fautes.length, 2);
  eq('un type inconnu devient « autre »', o.body.fautes[1].type, 'autre');
  eq('les mots justes ne dépassent pas le total', o.body.justes, 4);
  vrai('la règle est transmise à l\'enfant', /t muet/.test(o.body.fautes[0].explication));
  vrai('le commentaire est conservé', /paisible/.test(o.body.commentaire));

  await A.handler({ method: 'POST', body: { mode: 'corriger_dictee', child: 'alix', attendu: 'Le chat.', reponse: '   ' } }, R);
  vrai('une copie vide est signalée sans planter', /Écris/.test(o.body.error), JSON.stringify(o.body));

  await A.handler({ method: 'POST', body: { mode: 'corriger_dictee', child: 'alix', reponse: 'x' } }, R);
  eq('sans texte attendu : refus propre', o.code, 400);
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
