import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApolloLink, Operation, createHttpLink } from '@apollo/client';
import { MockLink, MockedResponse } from '@apollo/client/testing';
import App from '../renderer/App';
import { GET_SETS_AT_STREAM_STATION } from '../renderer/common/StartggQueries';
import { setsResponse, tournamentSet } from '../test/fixtures';

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  createHttpLink: jest.fn(),
}));
jest.mock('../renderer/components/ThumbnailGenerator', () => () => null);

const slug = 'tournament/test/event/singles';
const request = {
  query: GET_SETS_AT_STREAM_STATION,
  variables: { eventId: slug, page: 1 },
};

function setup(secret = '', mocks: MockedResponse[] = []) {
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
    createFolder: jest.fn(),
    retrieveVideoInformation: jest.fn().mockResolvedValue(1000),
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
  it('starts offline and requires a saved API key', async () => {
    const { ipcRenderer, operations } = setup();
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByLabelText('Start.gg API key', { exact: false })
      ).toBeEnabled()
    );
    expect(
      screen.getByRole('heading', { name: 'Tournament VOD Clipper' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Retrieve Sets' })
    ).toBeDisabled();
    expect(ipcRenderer.createFolder).toHaveBeenCalledWith('downloadedVODs');
    expect(operations).toHaveLength(0);
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
    view.unmount();

    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByLabelText('Start.gg API key', { exact: false })
      ).toHaveValue('test-key')
    );
    expect(screen.getByLabelText('Start.GG Event Slug')).toHaveValue(slug);
    expect(screen.getByLabelText('VOD Link')).toHaveValue(
      'https://www.twitch.tv/videos/123'
    );
    expect(screen.getByLabelText('Stream Station')).toHaveValue('streamer');
    expect(screen.getByRole('button', { name: 'Retrieve Sets' })).toBeEnabled();
    expect(store.set).not.toHaveBeenCalledWith('apikey', expect.anything());
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
    await screen.findByText('Error retrieving sets: test query failure');
    await waitFor(() => expect(retrieve).toBeEnabled());
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
    ipcRenderer.retrieveVideoInformation.mockRejectedValueOnce(
      new Error('test VOD failure')
    );
    render(<App />);
    const retrieve = screen.getByRole('button', { name: 'Retrieve Sets' });
    await waitFor(() => expect(retrieve).toBeEnabled());
    fireEvent.click(retrieve);
    await screen.findByText('Error retrieving sets: test VOD failure');
    await waitFor(() => expect(retrieve).toBeEnabled());
    fireEvent.click(retrieve);
    await screen.findByRole('heading', { name: 'Select Sets to Download' });
    expect(
      screen.getByText('Player A vs Player B - Finals - Tournament')
    ).toBeInTheDocument();
  });
});
