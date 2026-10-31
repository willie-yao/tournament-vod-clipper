import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import YTUploadView from '../renderer/pages/YTUploadView';
import type { YouTubeStatus } from '../common/youtube';

const connected: Extract<YouTubeStatus, { state: 'connected' }> = {
  state: 'connected',
  channel: { id: 'channel-fixture', title: 'Fixture tournament channel' },
  sessionId: 'session-fixture',
  message: 'Connected to Fixture tournament channel',
};

let fixtureNumber = 0;
async function setup() {
  const folderName = `Tournament${fixtureNumber}`;
  fixtureNumber += 1;
  const api = {
    getOutputDirectory: jest.fn().mockResolvedValue('/mock/output'),
    chooseOutputDirectory: jest.fn().mockResolvedValue(null),
    createFolder: jest.fn().mockResolvedValue('/mock/output'),
    getTournamentFolders: jest.fn().mockResolvedValue([folderName]),
    getVideosInFolder: jest.fn().mockResolvedValue(['one.mp4', 'two.mp4']),
    getYouTubeStatus: jest
      .fn()
      .mockResolvedValue({
        state: 'disconnected',
        message: 'Connect in your browser.',
      }),
    connectYouTube: jest.fn().mockResolvedValue(connected),
    disconnectYouTube: jest
      .fn()
      .mockResolvedValue({
        state: 'disconnected',
        message: 'Local connection removed.',
      }),
    onYouTubeStatus: jest.fn((_listener: (status: YouTubeStatus) => void) =>
      jest.fn()
    ),
    createPlaylist: jest.fn().mockResolvedValue({ id: 'playlist' }),
    uploadSingleVideo: jest
      .fn()
      .mockImplementation(async ({ videoName }: { videoName: string }) => ({
        id: videoName,
      })),
    uploadThumbnail: jest.fn().mockResolvedValue({ status: 'uploaded' }),
    addVideoToPlaylist: jest.fn().mockResolvedValue({ id: 'membership' }),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: api },
  });
  render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/upload" state={{ folderName }} />}
        />
        <Route path="/upload" element={<YTUploadView />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByLabelText('Title: one.mp4');
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Connect YouTube' })
    ).toBeEnabled()
  );
  return api;
}

async function login() {
  fireEvent.click(screen.getByRole('button', { name: 'Connect YouTube' }));
  await screen.findByRole('button', { name: 'Reconnect YouTube' });
}

it('serializes the whole upload flow and ignores repeated clicks while busy', async () => {
  const api = await setup();
  await login();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  api.uploadSingleVideo.mockImplementationOnce(async () => {
    await gate;
    return { id: 'first' };
  });
  const upload = screen.getByRole('button', { name: 'Upload' });
  fireEvent.click(upload);
  fireEvent.click(upload);
  await waitFor(() => expect(api.uploadSingleVideo).toHaveBeenCalledTimes(1));
  expect(api.createPlaylist).toHaveBeenCalledTimes(1);
  expect(upload).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Reconnect YouTube' })
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Choose Output Folder' })
  ).toBeDisabled();
  await act(async () => {
    release();
  });
  await screen.findByText('2 of 2 videos confirmed; 2 fully processed.');
  expect(api.uploadSingleVideo).toHaveBeenCalledTimes(2);
});

it('reports partial video success and recovers after re-login without resubmitting confirmed videos', async () => {
  const api = await setup();
  api.uploadThumbnail.mockRejectedValueOnce(
    new Error('test thumbnail rejected')
  );
  await login();
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
  await screen.findByText('2 of 2 videos confirmed; 1 fully processed.');
  expect(
    screen.getByText('Thumbnail: test thumbnail rejected')
  ).toBeInTheDocument();
  api.connectYouTube.mockResolvedValueOnce({
    ...connected,
    sessionId: 'reconnected-session',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reconnect YouTube' }));
  await waitFor(() => expect(api.connectYouTube).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Retry Failed Steps' })
    ).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry Failed Steps' }));
  await screen.findByText('2 of 2 videos confirmed; 2 fully processed.');
  expect(api.uploadSingleVideo).toHaveBeenCalledTimes(2);
  expect(api.createPlaylist).toHaveBeenCalledTimes(1);
  expect(api.uploadThumbnail).toHaveBeenCalledTimes(3);
  expect(api.uploadThumbnail.mock.calls[2][0].sessionId).toBe(
    'reconnected-session'
  );
  expect(api.uploadThumbnail.mock.calls[2][0]).not.toHaveProperty(
    'accessToken'
  );
});

it('rejects invalid titles before creating a playlist or video', async () => {
  const api = await setup();
  await login();
  fireEvent.change(screen.getByLabelText('Title: one.mp4'), {
    target: { value: 'x'.repeat(101) },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
  await screen.findByText(
    'one.mp4: YouTube titles must contain 1 to 100 characters.'
  );
  expect(api.createPlaylist).not.toHaveBeenCalled();
  expect(api.uploadSingleVideo).not.toHaveBeenCalled();
});

it('shows missing configuration honestly without enabling uploads', async () => {
  const api = await setup();
  act(() =>
    api.onYouTubeStatus.mock.calls[0][0]({
      state: 'not-configured',
      message: 'The maintainer must supply Desktop client configuration.',
    })
  );
  expect(
    screen.getByText('The maintainer must supply Desktop client configuration.')
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Connect YouTube' })
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  expect(api.connectYouTube).not.toHaveBeenCalled();
});

it('locks upload and navigation during output-root validation and warns about unconfirmed playlist mutations', async () => {
  const api = await setup();
  await login();
  let release!: (value: string) => void;
  const pending = new Promise<string>((resolve) => {
    release = resolve;
  });
  api.chooseOutputDirectory.mockReturnValueOnce(pending);
  fireEvent.click(screen.getByRole('button', { name: 'Choose Output Folder' }));
  const upload = screen.getByRole('button', { name: 'Upload' });
  expect(upload).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Source' })).toBeDisabled();
  fireEvent.click(upload);
  expect(api.createPlaylist).not.toHaveBeenCalled();
  expect(api.uploadSingleVideo).not.toHaveBeenCalled();
  api.getOutputDirectory.mockResolvedValue('/chosen/output');
  await act(async () => {
    release('/chosen/output');
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Reconnect YouTube' })
    ).toBeEnabled()
  );
  expect(upload).toBeDisabled();
  expect(
    screen.getByText(/check both your YouTube channel and playlist/i)
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /Playlist creation or membership may already have succeeded/i
    )
  ).toBeInTheDocument();
});

it('displays restart status and supports local disconnect without exposing credentials', async () => {
  const api = await setup();
  act(() => api.onYouTubeStatus.mock.calls[0][0](connected));
  expect(
    screen.getByRole('heading', { name: connected.channel.title })
  ).toBeInTheDocument();
  expect(screen.getByText(/Channel channel-fixture/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
  await screen.findByText('Local connection removed.');
  expect(api.disconnectYouTube).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
});

it('blocks retrying a partial batch on another channel', async () => {
  const api = await setup();
  await login();
  api.uploadThumbnail.mockRejectedValueOnce(new Error('thumbnail rejected'));
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
  await screen.findByText('2 of 2 videos confirmed; 1 fully processed.');
  api.connectYouTube.mockResolvedValueOnce({
    ...connected,
    channel: { id: 'different-channel', title: 'Different channel' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reconnect YouTube' }));
  await screen.findByText(/This batch belongs to another YouTube channel/);
  expect(
    screen.getByRole('button', { name: 'Retry Failed Steps' })
  ).toBeDisabled();
  expect(api.uploadSingleVideo).toHaveBeenCalledTimes(2);
});

it('lets the user cancel pending browser sign-in', async () => {
  const api = await setup();
  let release!: () => void;
  api.connectYouTube.mockReturnValueOnce(
    new Promise((resolve) => {
      release = () =>
        resolve({ state: 'disconnected', message: 'Sign-in canceled.' });
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Connect YouTube' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Cancel sign-in' })
  );
  await waitFor(() => expect(api.disconnectYouTube).toHaveBeenCalledTimes(1));
  await act(async () => release());
  await screen.findByText('Sign-in canceled.');
  expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
});
