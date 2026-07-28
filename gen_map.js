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

/* ═══ Régions et départements de France (france-geojson, versions simplifiées) ═══ */
function buildFR(file, projection, W, H){
  const geo = JSON.parse(fs.readFileSync(file, 'utf8'));
  const path = geoPath(projection);
  const targets = [];
  for (const f of geo.features){
    const d = path(f);
    if (d) targets.push({ n: f.properties.nom, d: round(d) });
  }
  return { w: W, h: H, targets, context: [] };
}
const regionsGeo = JSON.parse(fs.readFileSync('/tmp/fgeo/regions-version-simplifiee.geojson', 'utf8'));
const projFR = geoMercator().fitExtent([[10,10],[630,630]], regionsGeo).clipExtent([[0,0],[640,640]]);
const regions = buildFR('/tmp/fgeo/regions-version-simplifiee.geojson', projFR, 640, 640);
const departements = buildFR('/tmp/fgeo/departements-version-simplifiee.geojson', projFR, 640, 640);

/* ═══ USA : états pré-projetés (us-atlas albers 975×610) ═══ */
const usTopo = require('us-atlas/states-albers-10m.json');
const usGeo = feature(usTopo, usTopo.objects.states);
const pathUS = geoPath(); // géométries déjà projetées
const usa_bg = { w: 975, h: 610, paths: usGeo.features.map(f => round(pathUS(f))).filter(Boolean) };
const { geoAlbersUsa } = require('d3-geo');
const projUS = geoAlbersUsa().scale(1300).translate([487.5, 305]);

/* ═══ Jeux de villes : positions projetées + facteur km/pixel local ═══ */
function cityGame(list, projection, D){
  return list.map(([n, lat, lon]) => {
    const p = projection([lon, lat]);
    const pN = projection([lon, lat + 0.5]);
    const k = (0.5 * 111.2) / Math.hypot(p[0]-pN[0], p[1]-pN[1]); // km par pixel autour de la ville
    return { n, x: +p[0].toFixed(1), y: +p[1].toFixed(1), k: +k.toFixed(2) };
  }).filter(c => isFinite(c.x) && isFinite(c.k));
}
const VF = [['Paris',48.85,2.35],['Marseille',43.30,5.37],['Lyon',45.76,4.84],['Toulouse',43.60,1.44],['Nice',43.70,7.27],['Nantes',47.22,-1.55],['Strasbourg',48.57,7.75],['Montpellier',43.61,3.88],['Bordeaux',44.84,-0.58],['Lille',50.63,3.06],['Rennes',48.11,-1.68],['Reims',49.26,4.03],['Le Havre',49.49,0.11],['Grenoble',45.19,5.72],['Dijon',47.32,5.04],['Angers',47.47,-0.55],['Nîmes',43.84,4.36],['Clermont-Ferrand',45.78,3.08],['Tours',47.39,0.69],['Limoges',45.83,1.26],['Amiens',49.89,2.30],['Perpignan',42.69,2.90],['Metz',49.12,6.18],['Nancy',48.69,6.18],['Besançon',47.24,6.02],['Caen',49.18,-0.37],['Orléans',47.90,1.90],['Rouen',49.44,1.10],['Brest',48.39,-4.49],['Toulon',43.12,5.93]];
const VE = [['Paris',48.85,2.35],['Londres',51.51,-0.13],['Berlin',52.52,13.40],['Madrid',40.42,-3.70],['Rome',41.90,12.50],['Lisbonne',38.72,-9.14],['Amsterdam',52.37,4.90],['Bruxelles',50.85,4.35],['Vienne',48.21,16.37],['Berne',46.95,7.45],['Prague',50.08,14.44],['Varsovie',52.23,21.01],['Budapest',47.50,19.04],['Athènes',37.98,23.73],['Stockholm',59.33,18.07],['Oslo',59.91,10.75],['Copenhague',55.68,12.57],['Helsinki',60.17,24.94],['Dublin',53.35,-6.26],['Édimbourg',55.95,-3.19],['Barcelone',41.39,2.17],['Milan',45.46,9.19],['Munich',48.14,11.58],['Zurich',47.37,8.54],['Kiev',50.45,30.52],['Bucarest',44.43,26.10],['Sofia',42.70,23.32],['Belgrade',44.79,20.45],['Istanbul',41.01,28.98],['Reykjavik',64.15,-21.94]];
const VM = [['New York',40.71,-74.01],['Los Angeles',34.05,-118.24],['Mexico',19.43,-99.13],['Rio de Janeiro',-22.91,-43.17],['Buenos Aires',-34.60,-58.38],['Lima',-12.05,-77.04],['Le Caire',30.04,31.24],['Lagos',6.52,3.38],['Nairobi',-1.29,36.82],['Johannesburg',-26.20,28.05],['Dakar',14.72,-17.47],['Moscou',55.76,37.62],['Pékin',39.90,116.41],['Shanghai',31.23,121.47],['Tokyo',35.68,139.69],['Séoul',37.57,126.98],['Bombay (Mumbai)',19.08,72.88],['New Delhi',28.61,77.21],['Bangkok',13.76,100.50],['Singapour',1.35,103.82],['Jakarta',-6.21,106.85],['Sydney',-33.87,151.21],['Auckland',-36.85,174.76],['Téhéran',35.69,51.39],['Bagdad',33.31,44.37],['Riyad',24.71,46.68],['Jérusalem',31.77,35.21],['Toronto',43.65,-79.38],['Casablanca',33.57,-7.59],['Kinshasa',-4.44,15.27]];
const VUSA = [['New York',40.71,-74.01],['Los Angeles',34.05,-118.24],['Chicago',41.88,-87.63],['Houston',29.76,-95.37],['Phoenix',33.45,-112.07],['Philadelphie',39.95,-75.17],['San Antonio',29.42,-98.49],['San Diego',32.72,-117.16],['Dallas',32.78,-96.80],['San Francisco',37.77,-122.42],['Seattle',47.61,-122.33],['Denver',39.74,-104.99],['Washington',38.91,-77.04],['Boston',42.36,-71.06],['Las Vegas',36.17,-115.14],['Détroit',42.33,-83.05],['Miami',25.76,-80.19],['Atlanta',33.75,-84.39],['La Nouvelle-Orléans',29.95,-90.07],['Minneapolis',44.98,-93.27],['Saint-Louis',38.63,-90.20],['Salt Lake City',40.76,-111.89],['Portland',45.52,-122.68],['Kansas City',39.10,-94.58],['Nashville',36.16,-86.78]];
const PHYS = [['L\'Everest',27.99,86.93],['Le Kilimandjaro',-3.07,37.35],['Le mont Blanc',45.83,6.86],['Le Sahara',23,10],['L\'embouchure de l\'Amazone',-0.5,-50],['Le Nil',19,31],['Le Mississippi',32,-91],['Le Grand Canyon',36.10,-112.11],['La Sibérie',65,100],['L\'Himalaya',28.5,84],['La cordillère des Andes',-20,-68],['Les Alpes',46.5,10],['Le désert de Gobi',42.5,103],['L\'Outback australien',-25,133],['Le Groenland',72,-40],['Madagascar',-19,47],['Le désert du Kalahari',-23,21],['Les montagnes Rocheuses',44,-110],['L\'Oural',60,59],['La forêt du Congo',-1,23],['La Grande Barrière de corail',-18,147],['Le lac Baïkal',53.5,108],['La mer Morte',31.5,35.5],['L\'Islande',64.9,-18.5]];

const cities = {
  vf:   { bg:'france',  D:4,  list: cityGame(VF, projFR, 4) },
  ve:   { bg:'europe',  D:12, list: cityGame(VE, projEU, 12) },
  vm:   { bg:'monde',   D:40, list: cityGame(VM, projW, 40) },
  vusa: { bg:'usa',     D:12, list: cityGame(VUSA, projUS, 12) },
  phys: { bg:'monde',   D:40, list: cityGame(PHYS, projW, 40) },
};
// fond France pour le jeu des villes : les contours de régions
const france_bg = { w: 640, h: 640, paths: regions.targets.map(t=>t.d) };

const out = 'window.MAPS = ' + JSON.stringify({ europe, monde, regions, departements, usa_bg, france_bg, cities }) + ';\n';
fs.writeFileSync('map.js', out);
console.log('map.js:', Math.round(out.length/1024), 'Ko | europe:', europe.targets.length, '| monde:', monde.targets.length,
  '| régions:', regions.targets.length, '| départements:', departements.targets.length, '| états US:', usa_bg.paths.length,
  '| villes:', Object.entries(cities).map(([k,v])=>k+'='+v.list.length).join(' '));
