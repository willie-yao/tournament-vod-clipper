import { ApolloClient } from '@apollo/client';
import { getClipRangeError } from '../../common/clipTime';
import { RetrievalError } from '../../common/retrieval';
import generateSetTitle, { TitleFormat } from './setTitle';
import startggRequest from './startggRequest';
import {
  GET_SETS_AT_STATION,
  GET_SETS_AT_STREAM_STATION,
} from './StartggQueries';

export {
  PLAYERS_FIRST_TITLE,
  TOURNAMENT_FIRST_TITLE,
  TitleFormat,
} from './setTitle';
export type CharacterMap = Record<number, string>;

interface Entrant {
  id: string | number;
  name: string | null;
}

export interface TournamentSet {
  id: string | number;
  startedAt: number | null;
  completedAt: number | null;
  fullRoundText: string | null;
  station?: { id: string | number; number: number } | null;
  slots: ({ id?: string | number; entrant: Entrant | null } | null)[] | null;
  games:
    | ({
        selections:
          | ({
              selectionValue: number | null;
              selectionType?: string;
              entrant: { id: string | number } | null;
            } | null)[]
          | null;
      } | null)[]
    | null;
  stream?: { streamName: string | null } | null;
}

interface SetsResponse {
  event: {
    name?: string | null;
    tournament: { name: string } | null;
    sets: {
      pageInfo: { totalPages: number };
      nodes: (TournamentSet | null)[];
    } | null;
  } | null;
}

export interface VODMetadata {
  id: string;
  title: string;
  originalTitle?: string;
  startTime: number | null;
  endTime: number | null;
  needsCorrection: string | null;
  download: boolean;
  player1: string;
  player2: string;
  character1: string;
  character2: string;
  tournamentName: string;
  roundText?: string;
  eventName?: string;
}

/** Retrieve every page, then filter stream matches and discard duplicate IDs. */
export async function retrieveTournamentSets(
  client: Pick<ApolloClient<object>, 'query'>,
  eventId: string,
  station: string,
  signal?: AbortSignal
) {
  const input = station.trim();
  if (!input)
    throw new RetrievalError('Enter a station number or stream channel.');
  const numeric = Number(input);
  const stationNumber = Number.isNaN(numeric) ? null : numeric;
  if (
    stationNumber !== null &&
    (!Number.isInteger(stationNumber) ||
      stationNumber < 1 ||
      stationNumber > 2147483647)
  ) {
    throw new RetrievalError('Station numbers must be positive integers.');
  }

  const sets: TournamentSet[] = [];
  const seen = new Set<string>();
  let tournamentName = '';
  let eventName = '';
  let skippedSets = 0;
  let page = 1;
  let totalPages = 1;
  do {
    // eslint-disable-next-line no-await-in-loop
    const { data } = await startggRequest<SetsResponse>(
      client,
      {
        query:
          stationNumber === null
            ? GET_SETS_AT_STREAM_STATION
            : GET_SETS_AT_STATION,
        variables: {
          eventId,
          page,
          ...(stationNumber === null
            ? {}
            : { stationNumbers: [stationNumber] }),
        },
      },
      signal
    );
    const { event } = data;
    if (!event?.tournament?.name || !event.sets) {
      throw new RetrievalError(
        'Tournament event not found or set data is unavailable.'
      );
    }
    tournamentName = event.tournament.name;
    eventName = event.name || '';
    totalPages = event.sets.pageInfo?.totalPages;
    if (
      !Number.isInteger(totalPages) ||
      totalPages < 0 ||
      !Array.isArray(event.sets.nodes)
    ) {
      throw new RetrievalError(
        'The tournament returned invalid pagination data.'
      );
    }

    const pageSets = event.sets.nodes.filter(
      (set): set is TournamentSet => set !== null
    );
    skippedSets += event.sets.nodes.length - pageSets.length;
    pageSets.forEach((set) => {
      if (
        (stationNumber !== null ||
          set.stream?.streamName?.toLowerCase() === input.toLowerCase()) &&
        !seen.has(String(set.id))
      ) {
        seen.add(String(set.id));
        sets.push(set);
      }
    });
    page += 1;
  } while (page <= totalPages);

  return { tournamentName, eventName, sets, skippedSets };
}

/** Keep incomplete matches visible, but require correction before downloading. */
export function formatSetMetadata(
  set: TournamentSet,
  tournamentName: string,
  vodTimestamp: number,
  characterMap: CharacterMap,
  titleFormat: TitleFormat,
  eventName?: string
): VODMetadata {
  const entrants = [set.slots?.[0]?.entrant, set.slots?.[1]?.entrant];
  const playerNames = entrants.map((entrant) =>
    entrant?.name?.split('|').pop()?.trim()
  );
  const players: [string, string] = [
    playerNames[0] || 'Unknown player',
    playerNames[1] || 'Unknown player',
  ];
  const characterNames = entrants.map((entrant) => {
    const names = new Set<string>();
    if (!entrant) return [];
    (set.games ?? []).forEach((game) => {
      (game?.selections ?? []).forEach((selection) => {
        if (
          selection?.entrant &&
          String(selection.entrant.id) === String(entrant.id) &&
          (!selection.selectionType ||
            selection.selectionType === 'CHARACTER') &&
          selection.selectionValue !== null
        ) {
          const name = characterMap[selection.selectionValue];
          if (name) names.add(name);
        }
      });
    });
    return [...names];
  });
  const { title, originalTitle } = generateSetTitle({
    players,
    characters: [characterNames[0], characterNames[1]],
    round: set.fullRoundText || 'Match',
    tournament: tournamentName,
    format: titleFormat,
  });
  const startTime =
    typeof set.startedAt === 'number' && Number.isFinite(set.startedAt)
      ? set.startedAt - vodTimestamp
      : null;
  const endTime =
    typeof set.completedAt === 'number' && Number.isFinite(set.completedAt)
      ? set.completedAt - vodTimestamp
      : null;
  const needsCorrection =
    getClipRangeError(startTime, endTime) ||
    (playerNames.some((name) => !name)
      ? 'Player information is missing. Confirm the title.'
      : null);

  return {
    id: String(set.id),
    title,
    ...(title !== originalTitle ? { originalTitle } : {}),
    startTime,
    endTime,
    needsCorrection,
    download: needsCorrection === null,
    player1: players[0],
    player2: players[1],
    character1: characterNames[0][0] || 'Random Character',
    character2: characterNames[1][0] || 'Random Character',
    tournamentName,
    roundText: set.fullRoundText || 'Match',
    eventName,
  };
}
