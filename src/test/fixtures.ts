import {
  TournamentSet,
  formatSetMetadata,
  PLAYERS_FIRST_TITLE,
} from '../renderer/common/tournamentSets';

export function tournamentSet(
  overrides: Partial<TournamentSet> = {}
): TournamentSet {
  return {
    id: '1',
    startedAt: 1060,
    completedAt: 1120,
    fullRoundText: 'Finals',
    station: { id: 'station', number: 3 },
    slots: [
      { id: 'slot1', entrant: { id: 'a', name: 'Team | Player A' } },
      { id: 'slot2', entrant: { id: 'b', name: 'Player B' } },
    ],
    games: [],
    stream: { streamName: 'streamer' },
    ...overrides,
  };
}

export function setsResponse(sets: (TournamentSet | null)[], totalPages = 1) {
  return {
    event: {
      __typename: 'Event',
      id: 'event',
      name: 'Singles',
      tournament: { name: 'Tournament' },
      sets: { pageInfo: { totalPages }, nodes: sets },
    },
  };
}

export function vodMetadata() {
  return formatSetMetadata(
    tournamentSet(),
    'Tournament',
    1000,
    {},
    PLAYERS_FIRST_TITLE
  );
}
