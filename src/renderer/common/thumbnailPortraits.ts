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

// Normalized eye position and rendered width for differing asset silhouettes.
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
  kazuya: [0.64, 0.22, 1700],
  jigglypuff: [0.605, 0.54, 700],
  olimar: [0.475, 0.42, 1350],
  ridley: [0.58, 0.2, 1800],
  sonic: [0.62, 0.32, 900],
  minmin: [0.48, 0.47, 2200],
  steve: [0.48, 0.15, 900],
  ness: [0.54, 0.22, 1000],
  pokemontrainer: [0.48, 0.2, 1300],
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
