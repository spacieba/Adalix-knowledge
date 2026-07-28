/* Génère map.js : chemins SVG des pays (vue Europe 50m + vue Monde 110m) avec noms français. */
const fs = require('fs');
const { feature } = require('topojson-client');
const { geoMercator, geoNaturalEarth1, geoPath } = require('d3-geo');

const FR_EUROPE = {
  'France':'France','Germany':'Allemagne','Spain':'Espagne','Portugal':'Portugal','Italy':'Italie',
  'United Kingdom':'Royaume-Uni','Ireland':'Irlande','Iceland':'Islande','Norway':'Norvège','Sweden':'Suède',
  'Finland':'Finlande','Denmark':'Danemark','Netherlands':'Pays-Bas','Belgium':'Belgique','Luxembourg':'Luxembourg',
  'Switzerland':'Suisse','Austria':'Autriche','Poland':'Pologne','Czechia':'Tchéquie','Czech Rep.':'Tchéquie',
  'Slovakia':'Slovaquie','Hungary':'Hongrie','Slovenia':'Slovénie','Croatia':'Croatie',
  'Bosnia and Herz.':'Bosnie-Herzégovine','Serbia':'Serbie','Montenegro':'Monténégro',
  'North Macedonia':'Macédoine du Nord','Macedonia':'Macédoine du Nord','Albania':'Albanie','Greece':'Grèce',
  'Bulgaria':'Bulgarie','Romania':'Roumanie','Moldova':'Moldavie','Ukraine':'Ukraine','Belarus':'Biélorussie',
  'Lithuania':'Lituanie','Latvia':'Lettonie','Estonia':'Estonie','Russia':'Russie','Turkey':'Turquie',
  'Cyprus':'Chypre','Malta':'Malte','Kosovo':'Kosovo',
};
const FR_MONDE = {
  'United States of America':'États-Unis','Canada':'Canada','Mexico':'Mexique','Brazil':'Brésil',
  'Argentina':'Argentine','Chile':'Chili','Peru':'Pérou','Colombia':'Colombie','Venezuela':'Venezuela',
  'Bolivia':'Bolivie','China':'Chine','Japan':'Japon','India':'Inde','Indonesia':'Indonésie',
  'Australia':'Australie','New Zealand':'Nouvelle-Zélande','Russia':'Russie','Kazakhstan':'Kazakhstan',
  'Mongolia':'Mongolie','South Korea':'Corée du Sud','North Korea':'Corée du Nord','Vietnam':'Vietnam',
  'Thailand':'Thaïlande','Philippines':'Philippines','Pakistan':'Pakistan','Afghanistan':'Afghanistan',
  'Iran':'Iran','Iraq':'Irak','Saudi Arabia':'Arabie saoudite','Israel':'Israël','Egypt':'Égypte',
  'Libya':'Libye','Algeria':'Algérie','Morocco':'Maroc','Tunisia':'Tunisie','Nigeria':'Nigéria',
  'Ethiopia':'Éthiopie','Kenya':'Kenya','Dem. Rep. Congo':'RD Congo','South Africa':'Afrique du Sud',
  'Madagascar':'Madagascar','Senegal':'Sénégal','Mali':'Mali','Niger':'Niger','Chad':'Tchad',
  'Sudan':'Soudan','Somalia':'Somalie','Turkey':'Turquie','Ukraine':'Ukraine','France':'France',
  'Germany':'Allemagne','Spain':'Espagne','United Kingdom':'Royaume-Uni','Italy':'Italie','Greenland':'Groenland',
};

const round = d => d.replace(/-?\d+\.\d+/g, m => (+m).toFixed(1));

function build(topoFile, frMap, projection, W, H, contextFilter){
  const topo = require(topoFile);
  const geo = feature(topo, topo.objects.countries);
  const path = geoPath(projection);
  const targets = [], context = [];
  const seen = new Set();
  for (const f of geo.features){
    const name = f.properties.name;
    const d = path(f);
    if (!d) continue;
    if (frMap[name] && !seen.has(frMap[name])){
      seen.add(frMap[name]);
      targets.push({ n: frMap[name], d: round(d) });
    } else if (contextFilter(f)) {
      context.push(round(d));
    }
  }
  const missing = [...new Set(Object.values(frMap))].filter(n=>!seen.has(n));
  if (missing.length) console.warn('NON TROUVÉS:', missing.join(', '));
  return { w: W, h: H, targets, context };
}

// Vue Europe : mercator ajustée sur les pays cibles (hors Russie, qui étirerait le cadre vers l'est)
const topoEU = require('world-atlas/countries-50m.json');
const geoEU = feature(topoEU, topoEU.objects.countries);
// emprise fixe : Europe continentale + Islande + Chypre (les Açores/Canaries n'étirent plus le cadre)
const bboxEU = { type:'MultiPoint', coordinates:[[-24,34],[36,34],[36,71],[-24,71]] };
const projEU = geoMercator().fitExtent([[8,8],[732,592]], bboxEU).clipExtent([[0,0],[740,600]]);
const EU_CONTEXT = new Set(['Morocco','Algeria','Tunisia','Libya','Egypt','Syria','Lebanon','Israel','Jordan',
  'Georgia','Armenia','Azerbaijan','Kazakhstan','Iran','Iraq','Greenland','Monaco','San Marino','Vatican',
  'Andorra','Liechtenstein','Faeroe Is.','Isle of Man','Jersey','Guernsey','Åland','Saudi Arabia']);
const europe = build('world-atlas/countries-50m.json', FR_EUROPE, projEU, 740, 600,
  f => EU_CONTEXT.has(f.properties.name));

// Vue Monde : 110m suffit
const projW = geoNaturalEarth1().fitSize([950, 480], {type:'Sphere'});
const monde = build('world-atlas/countries-110m.json', FR_MONDE, projW, 950, 480, () => true);

const out = 'window.MAPS = ' + JSON.stringify({ europe, monde }) + ';\n';
fs.writeFileSync('map.js', out);
console.log('map.js:', Math.round(out.length/1024), 'Ko | europe:', europe.targets.length, 'pays cibles,', europe.context.length, 'contexte | monde:', monde.targets.length, 'cibles');
