import '@testing-library/jest-dom';
import { randomUUID } from 'crypto';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ApolloLink, Operation, createHttpLink } from '@apollo/client';
import { MockLink, MockedResponse } from '@apollo/client/testing';
import App from '../renderer/App';
import { releaseHeldBatch } from '../renderer/common/heldBatch';
import {
  GET_ALL_CHARACTERS,
  GET_SETS_AT_STREAM_STATION,
  GET_TOURNAMENTS_BY_ID,
  GET_YOUR_TOURNAMENTS,
  SEARCH_TOURNAMENT_NAMES,
} from '../renderer/common/StartggQueries';
import {
  RETRIEVAL_TIMEOUT_MS,
  STARTGG_REQUEST_TIMEOUT_MS,
  VOD_METADATA_TIMEOUT_MS,
} from '../common/retrieval';
import { setsResponse, tournamentSet } from '../test/fixtures';

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  createHttpLink: jest.fn(),
}));
jest.mock('../renderer/components/ThumbnailGenerator', () => () => null);
jest.mock('../renderer/common/thumbnailPortraits', () => ({
  THUMBNAIL_CHARACTERS: ['Fox', 'Marth', 'Sonic'],
  getThumbnailPortrait: () => null,
}));
jest.mock('../renderer/common/thumbnailDrawing', () => ({
  DEFAULT_THUMBNAIL_COLOR: '#223d55',
  DEFAULT_THUMBNAIL_RIGHT_COLOR: '#8b4c37',
  exportThumbnail: jest.fn(),
}));

const slug = 'tournament/test/event/singles';
const request = {
  query: GET_SETS_AT_STREAM_STATION,
  variables: { eventId: slug, page: 1 },
};

function tournamentNode(id: string, name: string, events: string[][]) {
  return {
    __typename: 'Tournament',
    id,
    name,
    startAt: 1767225600,
    events: events.map(([eventId, eventName, eventSlug]) => ({
      __typename: 'Event',
      id: eventId,
      name: eventName,
      slug: eventSlug,
      videogame: {
        __typename: 'Videogame',
        id: '1386',
        displayName: 'Super Smash Bros. Ultimate',
      },
    })),
  };
}

function setup(secret = '', mocks: MockedResponse[] = []) {
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: { randomUUID },
  });
  let savedKey = secret;
  const settings = new Map<string, unknown>([
    ['eventId', slug],
    ['vodUrl', 'https://www.twitch.tv/videos/123'],
    ['station', 'streamer'],
    ['characterMap', {}],
  ]);
  const store = {
    get: jest.fn((key: string) => settings.get(key)),
    set: jest.fn((key: string, value: unknown) => settings.set(key, value)),
    getSecret: jest.fn(async () => savedKey),
    setSecret: jest.fn(async (_key: string, value: string) => {
      savedKey = value;
    }),
  };
  const ipcRenderer = {
    getOutputDirectory: jest.fn().mockResolvedValue('/mock/output'),
    chooseOutputDirectory: jest.fn().mockResolvedValue(null),
    createFolder: jest.fn().mockResolvedValue('/mock/output'),
    retrieveVideoInformation: jest.fn().mockResolvedValue({ timestamp: 1000 }),
    cancelRetrieveVideoInformation: jest.fn(),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { store, ipcRenderer },
  });
  const operations: Operation[] = [];
  jest.mocked(createHttpLink).mockReturnValue(
    ApolloLink.from([
      new ApolloLink((operation, forward) => {
        operations.push(operation);
        return forward(operation);
      }),
      new MockLink(mocks),
    ])
  );
  return { store, ipcRenderer, operations };
}

describe('App settings and retrieval', () => {
  it('keeps API access, required source fields and output before retrieval in reading order', async () => {
    setup();
    render(<App />);
    const key = screen.getByLabelText('Start.gg API key', { exact: false });
    await waitFor(() => expect(key).toBeEnabled());
    const controls = [
      key,
      screen.getByRole('button', { name: 'Save API Key' }),
      screen.getByLabelText('Start.gg event', { exact: false }),
      screen.getByLabelText('VOD Link', { exact: false }),
      screen.getByLabelText('Stream Station', { exact: false }),
      screen.getByRole('button', { name: 'Choose Output Folder' }),
      screen.getByRole('button', { name: 'Retrieve Sets' }),
    ];
    controls.slice(1).forEach((control, index) => {
      expect(controls[index].compareDocumentPosition(control)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(
      screen.getByRole('region', { name: 'Start.gg access' })
    ).toContainElement(key);
    expect(controls[controls.length - 1]).toHaveAccessibleDescription(
      'Save a start.gg API key to retrieve sets.'
    );
  });

  it('locks retrieval and navigation until output-root selection validation completes', async () => {
    const { ipcRenderer, operations } = setup('test-key');
    let release!: () => void;
    const pending = new Promise<null>((resolve) => {
      release = () => resolve(null);
    });
    ipcRenderer.chooseOutputDirectory.mockReturnValueOnce(pending);
    render(<App />);
    const choose = screen.getByRole('button', { name: 'Choose Output Folder' });
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(choose).toBeEnabled());
    await waitFor(() => expect(retrieve).toBeEnabled());
    fireEvent.click(choose);
    expect(retrieve).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Source' })).toBeDisabled();
    fireEvent.click(retrieve);
    expect(operations).toHaveLength(0);
    await act(async () => {
      release();
    });
    expect(retrieve).toBeEnabled();
  });

  it('starts offline and requires a saved API key', async () => {
    const { ipcRenderer, operations } = setup();
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByLabelText('Start.gg API key', { exact: false })
      ).toBeEnabled()
    );
    expect(
      screen.getByRole('heading', { name: 'Tournament source' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Retrieve Sets' })
    ).toBeDisabled();
    expect(ipcRenderer.createFolder).toHaveBeenCalledWith();
    expect(operations).toHaveLength(0);
    expect(
      screen.getByText('Save a start.gg API key to retrieve sets.')
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Source' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Match review' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Output & YouTube' })
    ).toBeEnabled();
    expect(
      screen.getByLabelText('Start.gg API key', { exact: false })
    ).toHaveFocus();
    expect(
      screen.getByRole('link', { name: 'start.gg developer settings' })
    ).toHaveAttribute('href', 'https://start.gg/admin/profile/developer');
    expect(screen.getByText('start.gg developer settings')).toBeVisible();
    fireEvent.click(screen.getByText('Source format examples'));
    expect(
      screen.getByText('start.gg/tournament/name/event/name')
    ).toBeVisible();
  });

  it('saves a key through secure storage and preserves it and search values after remount', async () => {
    const { store } = setup();
    const view = render(<App />);
    const keyField = await screen.findByLabelText('Start.gg API key', {
      exact: false,
    });
    await waitFor(() => expect(keyField).toBeEnabled());
    fireEvent.change(keyField, { target: { value: 'test-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save API Key' }));
    await screen.findByText('API key saved.');
    expect(store.setSecret).toHaveBeenCalledWith('apikey', 'test-key');
    expect(screen.getByText('API key saved')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Change' })).toHaveFocus();
    expect(
      screen.queryByLabelText('Start.gg API key', { exact: false })
    ).not.toBeInTheDocument();
    view.unmount();

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    expect(
      screen.getByLabelText('Start.gg API key', { exact: false })
    ).toHaveValue('test-key');
    expect(
      screen.getByLabelText('Start.gg API key', { exact: false })
    ).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Save API Key' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Change' })).toHaveFocus();
    expect(
      screen.getByLabelText('Start.gg event', { exact: false })
    ).toHaveValue(slug);
    expect(screen.getByLabelText('VOD Link', { exact: false })).toHaveValue(
      'https://www.twitch.tv/videos/123'
    );
    expect(
      screen.getByLabelText('Stream Station', { exact: false })
    ).toHaveValue('streamer');
    expect(screen.getByRole('button', { name: 'Retrieve Sets' })).toBeEnabled();
    expect(store.set).not.toHaveBeenCalledWith('apikey', expect.anything());
  });

  it('explains unsaved key changes and preserves navigation locks while saving', async () => {
    const { store, operations } = setup('saved-key');
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.change(
      screen.getByLabelText('Start.gg API key', { exact: false }),
      {
        target: { value: 'changed-key' },
      }
    );
    expect(retrieve).toBeDisabled();
    expect(
      screen.getByText('Save API key changes before retrieving sets.')
    ).toBeVisible();
    let release!: () => void;
    store.setSecret.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        release = resolve;
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save API Key' }));
    expect(
      screen.getByRole('button', { name: 'Saving API key...' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Source' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Choose Output Folder' })
    ).toBeDisabled();
    expect(operations).toHaveLength(0);
    await act(async () => release());
    await waitFor(() => expect(retrieve).toBeEnabled());
  });

  it('keeps source validation visible outside help disclosures', async () => {
    setup('saved-key');
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Retrieve Sets' })
      ).toBeEnabled()
    );
    const event = screen.getByLabelText('Start.gg event', { exact: false });
    const vod = screen.getByLabelText('VOD Link', { exact: false });
    fireEvent.change(event, { target: { value: 'tournament/only' } });
    fireEvent.change(vod, { target: { value: 'https://youtu.be/abc' } });
    expect(event).not.toHaveAttribute('aria-invalid', 'true');
    expect(vod).toHaveAttribute('aria-invalid', 'false');
    expect(
      screen.getByRole('button', { name: 'Retrieve Sets' })
    ).toBeDisabled();
    fireEvent.blur(event);
    fireEvent.blur(vod);
    expect(
      screen.getByText('Paste a start.gg event link or pick a search result.')
    ).toBeVisible();
    fireEvent.focus(event);
    expect(
      screen.queryByText('Paste a start.gg event link or pick a search result.')
    ).not.toBeInTheDocument();
    expect(event).toHaveAttribute('aria-invalid', 'false');
    fireEvent.blur(event);
    expect(
      screen.getByText(
        'Use a Twitch VOD link such as twitch.tv/videos/123456789.'
      )
    ).toBeVisible();
    expect(
      screen.getByText('Correct the highlighted source fields.')
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Retrieve Sets' })
    ).toBeDisabled();
  });

  it('surfaces secure-store read and write failures without enabling retrieval', async () => {
    const { store } = setup();
    store.getSecret.mockRejectedValueOnce(
      new Error('test keychain unavailable')
    );
    store.setSecret.mockRejectedValueOnce(new Error('test save failed'));
    render(<App />);
    await screen.findByText(
      'Error loading settings: test keychain unavailable'
    );
    fireEvent.change(
      screen.getByLabelText('Start.gg API key', { exact: false }),
      { target: { value: 'test-key' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save API Key' }));
    await screen.findByText('Error saving API key: test save failed');
    expect(
      screen.getByRole('button', { name: 'Retrieve Sets' })
    ).toBeDisabled();
  });

  it('releases waiting state after a query failure and uses a newly saved key on retry', async () => {
    const { operations } = setup('first-test-key', [
      { request, error: new Error('test query failure') },
      { request, result: { data: setsResponse([]) } },
    ]);
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    fireEvent.click(retrieve);
    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent(
      'Error retrieving sets: Could not retrieve start.gg data. Check your API key, event slug and connection, then retry.'
    );
    await waitFor(() => expect(retrieve).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.change(
      screen.getByLabelText('Start.gg API key', { exact: false }),
      { target: { value: 'second-test-key' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save API Key' }));
    await screen.findByText('API key saved.');
    fireEvent.click(retrieve);
    await screen.findByText('No sets found');
    expect(
      operations.map(
        (operation) => operation.getContext().headers.authorization
      )
    ).toEqual(['Bearer first-test-key', 'Bearer second-test-key']);
  });

  it('surfaces metadata failures and retries without losing valid sets', async () => {
    const { ipcRenderer } = setup('test-key', [
      { request, result: { data: setsResponse([tournamentSet()]) } },
      { request, result: { data: setsResponse([tournamentSet()]) } },
    ]);
    ipcRenderer.retrieveVideoInformation.mockResolvedValueOnce({
      error: 'Could not read the VOD start time. Check the VOD URL and retry.',
    });
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    fireEvent.click(retrieve);
    await screen.findByText(
      'Error retrieving sets: Could not read the VOD start time. Check the VOD URL and retry.'
    );
    await waitFor(() => expect(retrieve).toBeEnabled());
    fireEvent.click(retrieve);
    await screen.findByRole('heading', { name: 'Tournament', level: 1 });
    expect(
      screen.getByText('Player A vs Player B - Finals - Tournament')
    ).toBeInTheDocument();
  });
});

describe('event lookup', () => {
  it('accepts pasted start.gg and Twitch links and retrieves canonical values', async () => {
    const { store, ipcRenderer } = setup('test-key', [
      { request, result: { data: setsResponse([tournamentSet()]) } },
    ]);
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    const event = screen.getByLabelText('Start.gg event', { exact: false });
    const vod = screen.getByLabelText('VOD Link', { exact: false });
    fireEvent.change(event, {
      target: {
        value: 'https://www.start.gg/tournament/test/event/singles/overview',
      },
    });
    fireEvent.change(vod, { target: { value: 'twitch.tv/videos/123?t=5m' } });
    expect(retrieve).toBeEnabled();
    fireEvent.blur(event);
    fireEvent.blur(vod);
    expect(event).toHaveValue(slug);
    expect(vod).toHaveValue('https://www.twitch.tv/videos/123');
    fireEvent.click(retrieve);
    await waitFor(() =>
      expect(ipcRenderer.retrieveVideoInformation).toHaveBeenCalledWith({
        vodUrl: 'https://www.twitch.tv/videos/123',
        requestId: expect.any(String),
      })
    );
    expect(store.set).toHaveBeenCalledWith('eventId', slug);
    expect(store.set).toHaveBeenCalledWith(
      'vodUrl',
      'https://www.twitch.tv/videos/123'
    );
  });

  it('lists your tournaments on focus and searches start.gg by name', async () => {
    const genesis = 'tournament/genesis-11/event/ultimate-singles';
    const { store } = setup('test-key', [
      {
        request: { query: GET_YOUR_TOURNAMENTS },
        result: {
          data: {
            currentUser: {
              __typename: 'User',
              id: 'user',
              tournaments: {
                __typename: 'TournamentConnection',
                nodes: [
                  tournamentNode('t1', 'Weekly 12', [
                    ['e1', 'Weekly Singles', slug],
                  ]),
                ],
              },
            },
            organizing: { __typename: 'TournamentConnection', nodes: [] },
          },
        },
      },
      {
        request: {
          query: SEARCH_TOURNAMENT_NAMES,
          variables: { name: 'genesis' },
        },
        result: {
          data: {
            scored: {
              __typename: 'TournamentConnection',
              nodes: [
                {
                  __typename: 'Tournament',
                  id: 't2',
                  name: 'Genesis 11',
                  startAt: 1767225600,
                },
              ],
            },
            recent: {
              __typename: 'TournamentConnection',
              nodes: [
                {
                  __typename: 'Tournament',
                  id: 't3',
                  name: 'Neutral Grounds',
                  startAt: 1767312000,
                },
              ],
            },
          },
        },
      },
      {
        request: {
          query: GET_TOURNAMENTS_BY_ID,
          variables: { ids: ['t2'], perPage: 1 },
        },
        result: {
          data: {
            tournaments: {
              __typename: 'TournamentConnection',
              nodes: [
                tournamentNode('t2', 'Genesis 11', [
                  ['e2', 'Ultimate Singles', genesis],
                  ['e3', 'Ultimate Doubles', `${genesis}-doubles`],
                ]),
              ],
            },
          },
        },
      },
      {
        request: {
          query: GET_SETS_AT_STREAM_STATION,
          variables: { eventId: genesis, page: 1 },
        },
        result: { data: setsResponse([]) },
      },
    ]);
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    const event = screen.getByLabelText('Start.gg event', { exact: false });
    fireEvent.change(event, { target: { value: '' } });
    fireEvent.focus(event);
    expect(
      await screen.findByRole('option', { name: /Weekly Singles/ })
    ).toBeVisible();

    fireEvent.change(event, { target: { value: 'genesis' } });
    expect(screen.getByText('Searching start.gg...')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /Weekly Singles/ })
    ).toBeVisible();
    expect(event).not.toHaveAccessibleDescription();
    fireEvent.click(
      await screen.findByRole('option', { name: /Ultimate Singles/ })
    );
    expect(event).toHaveValue(genesis);
    expect(screen.getByText('Genesis 11 · Ultimate Singles')).toBeVisible();
    fireEvent.click(retrieve);
    await screen.findByText('No sets found');
    expect(store.set).toHaveBeenCalledWith('eventId', genesis);
  });
});

describe('retrieval cancellation and deadlines', () => {
  afterEach(() => {
    jest.useRealTimers();
    releaseHeldBatch();
  });

  it('times out a hung query, aborts its signal and retries with the saved source intact', async () => {
    const { operations } = setup('fixture-key', [
      { request, result: { data: setsResponse([]) }, delay: 600_000 },
      { request, result: { data: setsResponse([]) } },
    ]);
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    jest.useFakeTimers();
    fireEvent.click(retrieve);
    await act(async () => {});
    expect(operations).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Match review' })).toBeDisabled();
    await act(async () => {
      jest.advanceTimersByTime(STARTGG_REQUEST_TIMEOUT_MS);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      /start.gg did not respond within 30 seconds/
    );
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('alert')).toBeVisible();
    expect(operations[0].getContext().fetchOptions.signal.aborted).toBe(true);
    expect(retrieve).toBeEnabled();
    expect(screen.getByLabelText('VOD Link', { exact: false })).toHaveValue(
      'https://www.twitch.tv/videos/123'
    );
    fireEvent.click(retrieve);
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByText('No sets found')).toBeVisible();
  });

  it('does not start a late fetch after a key-store wait times out', async () => {
    const { store, operations } = setup('fixture-key', [
      { request, result: { data: setsResponse([]) } },
    ]);
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    let finish!: (key: string) => void;
    store.getSecret.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    jest.useFakeTimers();
    fireEvent.click(retrieve);
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(STARTGG_REQUEST_TIMEOUT_MS);
    });
    expect(
      screen.getByText(/start.gg did not respond within 30 seconds/)
    ).toBeVisible();
    expect(retrieve).toBeEnabled();
    await act(async () => finish('fixture-key'));
    expect(operations).toHaveLength(0);
    fireEvent.click(retrieve);
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByText('No sets found')).toBeVisible();
  });

  it('bounds character metadata queries with the same network deadline', async () => {
    const { store, operations, ipcRenderer } = setup('fixture-key', [
      { request, result: { data: setsResponse([tournamentSet()]) } },
      {
        request: { query: GET_ALL_CHARACTERS, variables: { gameid: 1386 } },
        result: { data: { videogame: { characters: [] } } },
        delay: 600_000,
      },
    ]);
    const get = store.get.getMockImplementation()!;
    store.get.mockImplementation((key) =>
      key === 'characterMap' ? undefined : get(key)
    );
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    jest.useFakeTimers();
    fireEvent.click(retrieve);
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(operations).toHaveLength(2);
    await act(async () => {
      jest.advanceTimersByTime(STARTGG_REQUEST_TIMEOUT_MS);
    });
    expect(
      screen.getByText(/start.gg did not respond within 30 seconds/)
    ).toBeVisible();
    expect(operations[1].getContext().fetchOptions.signal.aborted).toBe(true);
    expect(ipcRenderer.retrieveVideoInformation).not.toHaveBeenCalled();
    expect(retrieve).toBeEnabled();
    expect(store.set).not.toHaveBeenCalledWith(
      'characterMap',
      expect.anything()
    );
  });

  it('cancels timed-out metadata and ignores its late result while a retry is waiting', async () => {
    const { ipcRenderer } = setup('fixture-key', [
      { request, result: { data: setsResponse([tournamentSet()]) } },
      { request, result: { data: setsResponse([tournamentSet()]) } },
    ]);
    let finishOld!: (value: { timestamp: number }) => void;
    ipcRenderer.retrieveVideoInformation
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve;
        })
      )
      .mockReturnValueOnce(new Promise(() => {}));
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    jest.useFakeTimers();
    fireEvent.click(retrieve);
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(ipcRenderer.retrieveVideoInformation).toHaveBeenCalledTimes(1);
    const first =
      ipcRenderer.retrieveVideoInformation.mock.calls[0][0].requestId;
    await act(async () => {
      jest.advanceTimersByTime(VOD_METADATA_TIMEOUT_MS);
    });
    expect(
      screen.getByText(/VOD metadata did not respond within 60 seconds/)
    ).toBeVisible();
    expect(ipcRenderer.cancelRetrieveVideoInformation).toHaveBeenCalledWith(
      first
    );
    expect(retrieve).toBeEnabled();
    fireEvent.click(retrieve);
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    const second =
      ipcRenderer.retrieveVideoInformation.mock.calls[1][0].requestId;
    expect(second).not.toBe(first);
    await act(async () => finishOld({ timestamp: 1000 }));
    expect(
      screen.getByRole('button', { name: 'Retrieving sets...' })
    ).toBeDisabled();
    expect(
      screen.queryByRole('heading', { name: 'Tournament' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel retrieval' }));
    await act(async () => {});
    expect(ipcRenderer.cancelRetrieveVideoInformation).toHaveBeenLastCalledWith(
      second
    );
    expect(
      screen.getByText(/Retrieval canceled. Retry when ready/)
    ).toBeVisible();
    expect(retrieve).toBeEnabled();
  });

  it.each(['unmount', 'pagehide'])(
    'cancels metadata on %s and never navigates on late completion',
    async (teardown) => {
      const { ipcRenderer } = setup('fixture-key', [
        { request, result: { data: setsResponse([tournamentSet()]) } },
      ]);
      let finish!: (value: { timestamp: number }) => void;
      ipcRenderer.retrieveVideoInformation.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        })
      );
      const view = render(<App />);
      const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
      await waitFor(() => expect(retrieve).toBeEnabled());
      fireEvent.click(retrieve);
      await waitFor(() =>
        expect(ipcRenderer.retrieveVideoInformation).toHaveBeenCalled()
      );
      const { requestId } =
        ipcRenderer.retrieveVideoInformation.mock.calls[0][0];
      if (teardown === 'unmount') view.unmount();
      else
        act(() => {
          window.dispatchEvent(new Event('pagehide'));
        });
      expect(ipcRenderer.cancelRetrieveVideoInformation).toHaveBeenCalledWith(
        requestId
      );
      await act(async () => finish({ timestamp: 1000 }));
      expect(
        screen.queryByRole('heading', { name: 'Tournament' })
      ).not.toBeInTheDocument();
    }
  );

  it('bounds complete pagination and rejects same-turn double submission', async () => {
    const pages = Math.ceil(RETRIEVAL_TIMEOUT_MS / 20_000) + 1;
    const { operations } = setup(
      'fixture-key',
      Array.from({ length: pages }, (_, index) => ({
        request: {
          ...request,
          variables: { ...request.variables, page: index + 1 },
        },
        result: {
          data: setsResponse([tournamentSet({ id: String(index) })], pages),
        },
        delay: 20_000,
      }))
    );
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    jest.useFakeTimers();
    act(() => {
      retrieve.click();
      retrieve.click();
    });
    await act(async () => {});
    expect(operations).toHaveLength(1);
    for (let elapsed = 0; elapsed < RETRIEVAL_TIMEOUT_MS; elapsed += 20_000) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(20_000);
      });
    }
    expect(screen.getByText(/Retrieval exceeded five minutes/)).toBeVisible();
    expect(retrieve).toBeEnabled();
    expect(
      operations[operations.length - 1].getContext().fetchOptions.signal.aborted
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Match review' })).toBeDisabled();
  });
});
