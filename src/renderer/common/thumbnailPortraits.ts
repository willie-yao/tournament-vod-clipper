declare const require: NodeRequire & {
  context: (
    directory: string,
    recursive: boolean,
    pattern: RegExp
  ) => {
    (key: string): string;
    keys: () => string[];
  };
};

const images = require.context('../components/characters', false, /\.png$/);
const normalize = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
const names = new Map(
  images.keys().map((key) => [normalize(key.slice(2, -4)), key])
);
const aliases: Record<string, string> = {
  simon: 'simonbelmont',
  rosalinaluma: 'rosalina',
};

// Normalized identifying focal point and width, including composite portraits.
const focalPoints: Record<string, [number, number, number]> = {
  lucina: [1710 / 3232, 300 / 1584, 2250],
  link: [1115 / 1980, 665 / 1744, 1550],
  fox: [665 / 1496, 440 / 1728, 850],
  mario: [0.285, 0.41, 880],
  peach: [0.58, 0.31, 1500],
  wolf: [0.59, 0.26, 1050],
  cloud: [0.235, 0.32, 2000],
  kirby: [0.5, 0.32, 700],
  marth: [0.52, 0.23, 3000],
  donkeykong: [0.57, 0.285, 1100],
  bowser: [0.67, 0.4475, 1100],
  pikachu: [0.35, 0.4, 830],
  samus: [0.55, 0.3, 1500],
  snake: [0.86, 0.24, 1900],
  mewtwo: [0.65, 0.258, 1100],
  rob: [0.7, 0.17, 1200],
  kazuya: [0.556, 0.218, 1400],
  jigglypuff: [0.605, 0.54, 700],
  olimar: [0.475, 0.42, 1350],
  ridley: [0.271, 0.405, 1200],
  sonic: [0.62, 0.32, 900],
  minmin: [0.48, 0.47, 2200],
  steve: [0.594, 0.177, 900],
  ness: [0.529, 0.255, 750],
  pokemontrainer: [0.537, 0.23, 1000],
  banjokazooie: [0.388, 0.39, 850],
  bayonetta: [0.464, 0.296, 3100],
  bowserjr: [0.394, 0.204, 700],
  byleth: [0.57, 0.214, 1950],
  chrom: [0.391, 0.267, 2235],
  corrin: [0.707, 0.244, 2280],
  daisy: [0.376, 0.288, 1000],
  darkpit: [0.633, 0.343, 1850],
  darksamus: [0.591, 0.235, 1650],
  diddykong: [0.55, 0.287, 800],
  drmario: [0.304, 0.231, 785],
  duckhunt: [0.367, 0.565, 520],
  falco: [0.637, 0.296, 900],
  ganondorf: [0.487, 0.215, 2455],
  greninja: [0.359, 0.383, 1000],
  hero: [0.338, 0.27, 1450],
  iceclimbers: [0.466, 0.35, 900],
  ike: [0.404, 0.26, 2270],
  incineroar: [0.353, 0.264, 1150],
  inkling: [0.455, 0.274, 1100],
  isabelle: [0.573, 0.39, 550],
  joker: [0.353, 0.308, 2200],
  kingdedede: [0.595, 0.273, 950],
  kingkrool: [0.54, 0.185, 1050],
  littlemac: [0.347, 0.261, 950],
  lucario: [0.403, 0.291, 800],
  lucas: [0.62, 0.328, 750],
  luigi: [0.738, 0.256, 800],
  megaman: [0.27, 0.292, 850],
  metaknight: [0.56, 0.697, 900],
  miibrawler: [0.739, 0.191, 943],
  miigunner: [0.57, 0.224, 1050],
  miiswordfighter: [0.455, 0.279, 900],
  mrgamewatch: [0.29, 0.36, 850],
  pacman: [0.436, 0.26, 600],
  palutena: [0.499, 0.391, 2600],
  pichu: [0.254, 0.517, 600],
  piranhaplant: [0.7, 0.28, 650],
  pit: [0.408, 0.358, 1905],
  pyramythra: [0.504, 0.205, 1800],
  richter: [0.549, 0.395, 1600],
  robin: [0.554, 0.293, 1300],
  rosalina: [0.241, 0.32, 1000],
  roy: [0.259, 0.328, 1500],
  ryu: [0.547, 0.196, 1400],
  sephiroth: [0.503, 0.324, 2500],
  sheik: [0.429, 0.263, 2100],
  shulk: [0.259, 0.404, 1500],
  simonbelmont: [0.478, 0.25, 2408],
  sora: [0.466, 0.314, 1900],
  terry: [0.42, 0.228, 1785],
  toonlink: [0.466, 0.428, 750],
  villager: [0.317, 0.371, 750],
  wario: [0.427, 0.29, 700],
  wiifittrainer: [0.827, 0.164, 1130],
  yoshi: [0.65, 0.27, 650],
  younglink: [0.676, 0.267, 1000],
  zelda: [0.501, 0.217, 2100],
  zerosuitsamus: [0.516, 0.247, 1840],
};

export interface ThumbnailPortrait {
  name: string;
  source: string;
  eyeX: number;
  eyeY: number;
  width?: number;
}

export function getThumbnailPortrait(
  character: string
): ThumbnailPortrait | null {
  const normalized = normalize(character);
  if (!normalized || normalized === 'randomcharacter') return null;
  const canonical = aliases[normalized] || normalized;
  const key = names.get(canonical);
  if (!key) return null;
  const [eyeX, eyeY, width] = focalPoints[canonical] || [0.5, 0.2];
  return { name: key.slice(2, -4), source: images(key), eyeX, eyeY, width };
}
