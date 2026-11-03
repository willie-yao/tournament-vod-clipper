/// <reference lib="es2022.intl" />

import { MAX_VIDEO_TITLE_LENGTH } from '../../common/files';

export const PLAYERS_FIRST_TITLE = 'Players - Round - Tournament Name';
export const TOURNAMENT_FIRST_TITLE = 'Tournament Name: Players - Round';
export type TitleFormat =
  | typeof PLAYERS_FIRST_TITLE
  | typeof TOURNAMENT_FIRST_TITLE;

interface TitleFields {
  players: [string, string];
  characters: [string[], string[]];
  round: string;
  tournament: string;
  format: TitleFormat;
}

const length = (text: string) => [...text].length;
const compact = (text: string) => text.replace(/\s+/gu, ' ').trim();
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const characterAliases = new Map([
  ['donkeykong', 'DK'],
  ['zerosuitsamus', 'ZSS'],
  ['mrgamewatch', 'G&W'],
  ['pokemontrainer', 'PT'],
  ['iceclimbers', 'ICs'],
  ['wiifittrainer', 'Wii Fit'],
]);

function characterAlias(name: string) {
  const key = name
    .normalize('NFD')
    .replace(/[^a-z]/gi, '')
    .toLowerCase();
  return characterAliases.get(key) || name;
}

function shortRound(round: string) {
  return round
    .replace(
      /\b(winners?|losers?)\s+(quarter[ -]?finals?|semi[ -]?finals?|finals?|round\s+\d+)\b/gi,
      (_, bracket: string, stage: string) => {
        const side = bracket[0].toUpperCase();
        const normalized = stage.toLowerCase();
        if (normalized.startsWith('quarter')) return `${side}QF`;
        if (normalized.startsWith('semi')) return `${side}SF`;
        if (normalized.startsWith('round'))
          return `${side}R${stage.replace(/\D/g, '')}`;
        return `${side}F`;
      }
    )
    .replace(/\bgrand[ -]?finals?\b/gi, 'GF');
}

function shortTournament(tournament: string) {
  return tournament
    .replace(/\bSuper Smash Bros\.?\s+Ultimate\b/gi, 'SSBU')
    .replace(/\bSuper Smash Bros\.?\s+Melee\b/gi, 'SSBM')
    .replace(/\bChampionships?\b/gi, 'Champs')
    .replace(/\bInternational\b/gi, 'Intl.')
    .replace(/\bTournament\b/gi, 'Tourney');
}

/** Clip a single field at grapheme boundaries, marking any lost text. */
function shorten(text: string, budget: number, suffix = '') {
  if (length(text) <= budget) return text;
  let prefix = '';
  const room = budget - length(suffix) - 1;
  // eslint-disable-next-line no-restricted-syntax
  for (const { segment } of segmenter.segment(text)) {
    if (length(prefix) + length(segment) > room) break;
    prefix += segment;
  }
  return `${prefix.trimEnd()}~${suffix}`;
}

function shortenTournament(tournament: string, budget: number) {
  const edition = tournament.match(/\s+\S*\p{N}\S*$/u)?.[0] || '';
  return shorten(
    tournament,
    budget,
    length(edition) < budget / 2 ? edition : ''
  );
}

function shortenRound(round: string, budget: number) {
  const identity = round.match(/\b\d+\b|\breset\b/gi)?.join(' ') || '';
  const suffix = identity ? ` ${identity}` : '';
  return shorten(round, budget, length(suffix) < budget / 2 ? suffix : '');
}

/** Fit generated fields only; custom titles remain subject to normal validation. */
export default function generateSetTitle(fields: TitleFields) {
  let { players, round, tournament } = fields;
  let characters = fields.characters.map((names) => names.join(', '));
  const render = () => {
    const entrants = players.map((player, index) =>
      characters[index] ? `${player} (${characters[index]})` : player
    );
    const match = `${entrants[0]} vs ${entrants[1]} - ${round}`;
    return fields.format === TOURNAMENT_FIRST_TITLE
      ? `${tournament}: ${match}`
      : `${match} - ${tournament}`;
  };
  const originalTitle = render();
  const result = () => ({ title: render(), originalTitle });
  const fits = () => length(render()) <= MAX_VIDEO_TITLE_LENGTH;
  if (fits()) return result();

  // Prefer known abbreviations before removing any field detail.
  round = shortRound(round);
  if (fits()) return result();
  characters = fields.characters.map((names) =>
    names.map(characterAlias).join(', ')
  );
  if (fits()) return result();
  players = [compact(players[0]), compact(players[1])];
  round = shortRound(compact(round));
  tournament = shortTournament(compact(tournament));
  characters = fields.characters.map((names) =>
    names.map((name) => characterAlias(compact(name))).join('/')
  );
  if (fits()) return result();

  // Keep an event prefix and edition before sacrificing picks or player tags.
  tournament = shortenTournament(
    tournament,
    Math.max(
      24,
      length(tournament) - (length(render()) - MAX_VIDEO_TITLE_LENGTH)
    )
  );
  if (fits()) return result();
  characters = fields.characters.map((names, index) =>
    names.length > 1 ? `${names.length} chars` : characters[index]
  );
  if (fits()) return result();
  characters = ['', ''];
  if (fits()) return result();

  // Unusual round labels yield before the two competitors share the remainder.
  round = shortenRound(
    round,
    Math.max(20, length(round) - (length(render()) - MAX_VIDEO_TITLE_LENGTH))
  );
  if (fits()) return result();
  const available =
    MAX_VIDEO_TITLE_LENGTH -
    (length(render()) - length(players[0]) - length(players[1]));
  const firstBudget = Math.min(
    length(players[0]),
    Math.max(Math.floor(available / 2), available - length(players[1]))
  );
  players = [
    shorten(players[0], firstBudget),
    shorten(players[1], available - firstBudget),
  ];
  return result();
}
