import { ApolloClient, InMemoryCache } from '@apollo/client';
import { MockLink, MockedResponse } from '@apollo/client/testing';
import {
  GET_SETS_AT_STATION,
  GET_SETS_AT_STREAM_STATION,
} from '../renderer/common/StartggQueries';
import {
  formatSetMetadata,
  retrieveTournamentSets,
  PLAYERS_FIRST_TITLE,
  TOURNAMENT_FIRST_TITLE,
} from '../renderer/common/tournamentSets';
import { setsResponse, tournamentSet } from '../test/fixtures';

const slug = 'tournament/test/event/singles';
const clientWith = (mocks: MockedResponse[]) =>
  new ApolloClient({ cache: new InMemoryCache(), link: new MockLink(mocks) });

describe('retrieveTournamentSets', () => {
  it.each([1, 2, 3])('retrieves all %s stream pages once', async (pages) => {
    const client = clientWith(
      Array.from({ length: pages }, (_, index) => ({
        request: {
          query: GET_SETS_AT_STREAM_STATION,
          variables: { eventId: slug, page: index + 1 },
        },
        result: {
          data: setsResponse([tournamentSet({ id: String(index + 1) })], pages),
        },
      }))
    );
    const query = jest.spyOn(client, 'query');

    const result = await retrieveTournamentSets(client, slug, 'Streamer');

    expect(result.sets.map((set) => set.id)).toEqual(
      Array.from({ length: pages }, (_, i) => String(i + 1))
    );
    expect(query).toHaveBeenCalledTimes(pages);
    expect(result.eventName).toBe('Singles');
    expect(
      query.mock.calls.every(
        ([options]) => options.fetchPolicy === 'network-only'
      )
    ).toBe(true);
  });

  it.each([1, 2, 3])(
    'uses an integer station and retrieves all %s station pages',
    async (pages) => {
      const client = clientWith(
        Array.from({ length: pages }, (_, index) => ({
          request: {
            query: GET_SETS_AT_STATION,
            variables: { eventId: slug, page: index + 1, stationNumbers: [3] },
          },
          result: {
            data: setsResponse(
              [tournamentSet({ id: String(index + 1) })],
              pages
            ),
          },
        }))
      );
      expect(
        (await retrieveTournamentSets(client, slug, '3')).sets
      ).toHaveLength(pages);
    }
  );

  it('refreshes changed results, ignores other streams and deduplicates IDs', async () => {
    const request = {
      query: GET_SETS_AT_STREAM_STATION,
      variables: { eventId: slug, page: 1 },
    };
    const client = clientWith([
      {
        request,
        result: {
          data: setsResponse([
            tournamentSet(),
            tournamentSet(),
            null,
            tournamentSet({ id: 'other', stream: null }),
          ]),
        },
      },
      {
        request,
        result: { data: setsResponse([tournamentSet({ id: 'new' })]) },
      },
    ]);
    const first = await retrieveTournamentSets(client, slug, 'streamer');
    expect(first.sets).toHaveLength(1);
    expect(first.skippedSets).toBe(1);
    expect(
      (await retrieveTournamentSets(client, slug, 'streamer')).sets[0].id
    ).toBe('new');
  });

  it('reports a missing event and propagates query errors', async () => {
    const request = {
      query: GET_SETS_AT_STREAM_STATION,
      variables: { eventId: slug, page: 1 },
    };
    const client = clientWith([
      { request, result: { data: { event: null } } },
      { request, error: new Error('test network failure') },
    ]);
    await expect(
      retrieveTournamentSets(client, slug, 'streamer')
    ).rejects.toThrow('not found');
    await expect(
      retrieveTournamentSets(client, slug, 'streamer')
    ).rejects.toThrow('test network failure');
  });

  it.each(['0', '-1', '1.5', 'Infinity'])(
    'rejects invalid station number %s',
    async (station) => {
      const client = clientWith([]);
      await expect(
        retrieveTournamentSets(client, slug, station)
      ).rejects.toThrow('positive integers');
    }
  );
});

describe('formatSetMetadata', () => {
  it('carries real labels and preserves the first reported portrait while retaining all picks in the title', () => {
    const result = formatSetMetadata(
      tournamentSet({
        games: [
          {
            selections: [1, 2].map((selectionValue) => ({
              entrant: { id: 'a' },
              selectionType: 'CHARACTER',
              selectionValue,
            })),
          },
        ],
      }),
      'Tournament',
      1000,
      { 1: 'Mario', 2: 'Luigi' },
      PLAYERS_FIRST_TITLE,
      'Ultimate Singles'
    );
    expect(result).toMatchObject({
      tournamentName: 'Tournament',
      eventName: 'Ultimate Singles',
      roundText: 'Finals',
      character1: 'Mario',
      character2: 'Random Character',
    });
    expect(result.title).toContain('Mario, Luigi');
  });

  it('retains sparse selections and missing entrants without losing neighboring sets', () => {
    const sets = [
      tournamentSet({ games: [{ selections: [] }] }),
      tournamentSet({
        id: '2',
        games: [
          {
            selections: [
              {
                entrant: { id: 'a' },
                selectionValue: 1,
                selectionType: 'CHARACTER',
              },
            ],
          },
        ],
      }),
      tournamentSet({ id: '3', slots: [null, { entrant: null }] }),
    ].map((set) =>
      formatSetMetadata(
        set,
        'Tournament',
        1000,
        { 1: 'Mario' },
        PLAYERS_FIRST_TITLE
      )
    );
    expect(sets).toHaveLength(3);
    expect(sets[0].character1).toBe('Random Character');
    expect(sets[1].character1).toBe('Mario');
    expect(sets[1].character2).toBe('Random Character');
    expect(sets[1].download).toBe(true);
    expect(sets[2].player1).toBe('Unknown player');
    expect(sets[2].needsCorrection).toContain('Player information');
    expect(sets[2].download).toBe(false);
  });

  it.each([null, NaN, Infinity, 940])(
    'flags incomplete or mismatched timestamps %s',
    (startedAt) => {
      const result = formatSetMetadata(
        tournamentSet({ startedAt }),
        'Tournament',
        1000,
        {},
        PLAYERS_FIRST_TITLE
      );
      expect(result.download).toBe(false);
      expect(result.needsCorrection).not.toBeNull();
      expect(result.startTime).toBe(startedAt === 940 ? -60 : null);
    }
  );

  it('preserves elapsed seconds beyond 24 hours and the chosen title format', () => {
    const result = formatSetMetadata(
      tournamentSet({ startedAt: 91000, completedAt: 91060 }),
      'Tournament',
      1000,
      {},
      TOURNAMENT_FIRST_TITLE
    );
    expect(result.startTime).toBe(90000);
    expect(result.endTime).toBe(90060);
    expect(result.title).toBe('Tournament: Player A vs Player B - Finals');
    expect(result.download).toBe(true);
  });
});
