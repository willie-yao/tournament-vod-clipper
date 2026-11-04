/** @jest-environment node */
import {
  ApolloClient,
  ApolloQueryResult,
  createHttpLink,
  InMemoryCache,
} from '@apollo/client';
import {
  RETRIEVAL_CANCELLED,
  STARTGG_REQUEST_TIMEOUT_MS,
} from '../common/retrieval';
import {
  GET_ALL_CHARACTERS,
  GET_SETS_AT_STREAM_STATION,
} from '../renderer/common/StartggQueries';
import startggRequest from '../renderer/common/startggRequest';
import { retrieveTournamentSets } from '../renderer/common/tournamentSets';
import { setsResponse, tournamentSet } from '../test/fixtures';

const slug = 'tournament/test/event/singles';

beforeEach(() => jest.useFakeTimers({ doNotFake: ['performance'] }));
afterEach(() => jest.useRealTimers());

it.each([1, 2])(
  'aborts the actual HTTP fetch when page %s hangs and does not return partial results',
  async (hangingPage) => {
    const signals: AbortSignal[] = [];
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const fetcher = jest.fn((_url, options: RequestInit) => {
      const { page } = JSON.parse(String(options.body)).variables;
      const { signal } = options;
      if (!signal) throw new Error('Missing fixture abort signal');
      signals.push(signal);
      if (page < hangingPage) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: setsResponse([tournamentSet()], 3),
            }),
            {
              headers: { 'content-type': 'application/json' },
              status: 200,
            }
          )
        );
      }
      started();
      return new Promise<Response>((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        })
      );
    });
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: createHttpLink({
        uri: 'https://offline.test/graphql',
        fetch: fetcher,
      }),
    });
    const query = jest.spyOn(client, 'query');
    const result = retrieveTournamentSets(client, slug, 'streamer').catch(
      (error: Error) => error.message
    );
    await ready;
    const underlying = query.mock.results[hangingPage - 1].value.catch(
      (error: Error) => error.message
    );
    expect(fetcher).toHaveBeenCalledTimes(hangingPage);
    jest.advanceTimersByTime(STARTGG_REQUEST_TIMEOUT_MS);
    expect(await result).toContain('within 30 seconds');
    expect(await underlying).toBe('aborted');
    jest.advanceTimersByTime(0);
    expect(signals[signals.length - 1].aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(hangingPage);
    expect(jest.getTimerCount()).toBe(0);
    client.stop();
  }
);

it.each([GET_SETS_AT_STREAM_STATION, GET_ALL_CHARACTERS])(
  'propagates parent cancellation to a query and isolates retry from a late response',
  async (query) => {
    const parent = new AbortController();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: createHttpLink({ fetch: jest.fn() }),
    });
    let complete!: (value: ApolloQueryResult<unknown>) => void;
    const run = jest.spyOn(client, 'query').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const first = startggRequest(client, { query }, parent.signal);
    const canceled = first.catch((error: Error) => error.message);
    const signal: AbortSignal =
      run.mock.calls[0][0].context?.fetchOptions.signal;
    parent.abort();
    expect(await canceled).toBe(RETRIEVAL_CANCELLED);
    expect(signal.aborted).toBe(true);
    run.mockResolvedValueOnce({
      data: { fixture: 'retry' },
      loading: false,
      networkStatus: 7,
    });
    expect(await startggRequest(client, { query })).toHaveProperty(
      'data.fixture',
      'retry'
    );
    complete({ data: { fixture: 'stale' }, loading: false, networkStatus: 7 });
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(0);
    expect(run.mock.calls[1][0].context?.queryDeduplication).toBe(false);
    client.stop();
  }
);

it('sanitizes provider failures and releases the request deadline', async () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createHttpLink({ fetch: jest.fn() }),
  });
  jest
    .spyOn(client, 'query')
    .mockRejectedValueOnce(new Error('fixture private payload'));
  await expect(
    startggRequest(client, { query: GET_ALL_CHARACTERS })
  ).rejects.toThrow('Check your API key, event slug and connection');
  expect(jest.getTimerCount()).toBe(0);
  client.stop();
});
