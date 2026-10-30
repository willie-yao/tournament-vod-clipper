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
    openGoogleLogin: jest
      .fn()
      .mockResolvedValue({ access_token: 'test-token' }),
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
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled()
  );
  return api;
}

async function login() {
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));
  await screen.findByRole('button', { name: 'Sign in again' });
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
  expect(screen.getByRole('button', { name: 'Sign in again' })).toBeDisabled();
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
  api.openGoogleLogin.mockResolvedValueOnce({ access_token: 'new-test-token' });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
  await waitFor(() => expect(api.openGoogleLogin).toHaveBeenCalledTimes(2));
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
  expect(api.uploadThumbnail.mock.calls[2][0].accessToken).toBe(
    'new-test-token'
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

it('does not treat an absent OAuth token as a successful login', async () => {
  const api = await setup();
  api.openGoogleLogin.mockResolvedValueOnce({});
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));
  await screen.findByText(
    'Login failed: Google did not return an access token.'
  );
  expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeEnabled()
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
