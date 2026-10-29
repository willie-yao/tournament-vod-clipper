import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import SetsView from '../renderer/pages/SetsView';
import { VODMetadata } from '../renderer/common/tournamentSets';
import { vodMetadata } from '../test/fixtures';

jest.mock(
  '../renderer/components/ThumbnailGenerator',
  () =>
    ({ title }: { title: string }) =>
      <div id={title} />
);
jest.mock('html2canvas', () =>
  jest.fn(async () => ({ toDataURL: () => 'data:image/jpeg;base64,' }))
);

function renderSet(set: VODMetadata | VODMetadata[]) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to="/sets"
              state={{
                sets: Array.isArray(set) ? set : [set],
                vodUrl: 'https://www.twitch.tv/videos/123',
                tournamentName: 'Tournament',
                skippedSets: 0,
              }}
            />
          }
        />
        <Route path="/sets" element={<SetsView />} />
      </Routes>
    </MemoryRouter>
  );
}

it('keeps invalid sets unselected until corrected and sends elapsed seconds to download IPC', async () => {
  const downloadVideo = jest
    .fn()
    .mockResolvedValue({ folderName: 'Tournament', videoName: 'clip.mp4' });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        getOutputDirectory: jest.fn().mockResolvedValue('/mock/output'),
        chooseOutputDirectory: jest.fn().mockResolvedValue(null),
        createFolder: jest.fn().mockResolvedValue('/mock/output'),
        downloadVideo,
        saveThumbnail: jest.fn().mockResolvedValue(undefined),
      },
    },
  });
  renderSet({
    ...vodMetadata(),
    startTime: -60,
    needsCorrection: 'Times must be zero or greater.',
    download: false,
  });
  expect(screen.getByText(/^Needs correction:/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download VODs' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
  expect(screen.getByRole('button', { name: 'Download VODs' })).toBeDisabled();
  expect(downloadVideo).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: /^Edit / }));
  fireEvent.change(screen.getByLabelText('Start Time'), {
    target: { value: '25:00:00' },
  });
  fireEvent.change(screen.getByLabelText('End Time'), {
    target: { value: '25:01:00' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Download VODs' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Download VODs' }));
  await waitFor(() =>
    expect(downloadVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: 90000,
        endTime: 90060,
      })
    )
  );
  await screen.findByText('1 of 1 selected clips ready.');
});

function downloadAPI() {
  const api = {
    getOutputDirectory: jest.fn().mockResolvedValue('/mock/output'),
    chooseOutputDirectory: jest.fn().mockResolvedValue(null),
    createFolder: jest.fn().mockResolvedValue('/mock/output'),
    downloadVideo: jest
      .fn()
      .mockResolvedValue({ folderName: 'Tournament', videoName: 'clip.mp4' }),
    saveThumbnail: jest.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: api },
  });
  return api;
}

beforeEach(() => {
  downloadAPI();
});

it('preserves deselection when editing an already valid set', async () => {
  const downloadVideo = jest.fn();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        downloadVideo,
        getOutputDirectory: jest.fn().mockResolvedValue('/mock/output'),
        createFolder: jest.fn().mockResolvedValue('/mock/output'),
      },
    },
  });
  renderSet(vodMetadata());
  await screen.findByText('Output folder: /mock/output');
  fireEvent.click(screen.getByText(vodMetadata().title));
  expect(screen.getByRole('button', { name: 'Download VODs' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /^Edit / }));
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Edited title' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));

  expect(screen.getByText('Edited title')).toBeInTheDocument();
  screen
    .getAllByRole('checkbox')
    .forEach((checkbox) => expect(checkbox).not.toBeChecked());
  expect(screen.getByRole('button', { name: 'Download VODs' })).toBeDisabled();
  expect(downloadVideo).not.toHaveBeenCalled();
});

it('waits for each thumbnail write, prevents duplicate submission and gates continuation until the whole batch is ready', async () => {
  const api = downloadAPI();
  let releaseVideo!: (file: { folderName: string; videoName: string }) => void;
  let releaseWrite!: () => void;
  const video = new Promise<{ folderName: string; videoName: string }>(
    (resolve) => {
      releaseVideo = resolve;
    }
  );
  const write = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  api.downloadVideo.mockReturnValueOnce(video);
  api.saveThumbnail.mockReturnValueOnce(write);
  renderSet([
    vodMetadata(),
    { ...vodMetadata(), id: '2', title: 'Second clip' },
  ]);
  const download = screen.getByRole('button', { name: 'Download VODs' });
  const next = screen.getByRole('button', { name: 'Continue to Upload' });
  fireEvent.click(download);
  fireEvent.click(download);
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  expect(download).toBeDisabled();
  expect(next).toBeDisabled();
  await act(async () => {
    releaseVideo({ folderName: 'Tournament', videoName: 'first.mp4' });
  });
  await waitFor(() => expect(api.saveThumbnail).toHaveBeenCalledTimes(1));
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  expect(next).toBeDisabled();
  await act(async () => {
    releaseWrite();
  });
  await screen.findByText('2 of 2 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledTimes(2);
  expect(next).toBeEnabled();
  expect(download).toBeDisabled();
});

it('reports partial failure and retries only missing downloads', async () => {
  const api = downloadAPI();
  api.downloadVideo.mockRejectedValueOnce(new Error('test download failed'));
  renderSet([
    vodMetadata(),
    { ...vodMetadata(), id: '2', title: 'Second clip' },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Download VODs' }));
  await screen.findByText(
    '1 of 2 selected clips ready. Review failed items and retry.'
  );
  expect(
    screen.getByRole('button', { name: 'Continue to Upload' })
  ).toBeDisabled();
  expect(screen.getByText('test download failed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download VODs' }));
  await screen.findByText('2 of 2 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledTimes(3);
  expect(
    screen.getByRole('button', { name: 'Continue to Upload' })
  ).toBeEnabled();
});

it('does not re-download a confirmed clip when retrying its failed thumbnail', async () => {
  const api = downloadAPI();
  api.saveThumbnail.mockRejectedValueOnce(
    new Error('test thumbnail write failed')
  );
  renderSet(vodMetadata());
  fireEvent.click(screen.getByRole('button', { name: 'Download VODs' }));
  await screen.findByText(
    '0 of 1 selected clips ready. Review failed items and retry.'
  );
  expect(
    screen.getByRole('button', { name: 'Continue to Upload' })
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Download VODs' }));
  await screen.findByText('1 of 1 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  expect(api.saveThumbnail).toHaveBeenCalledTimes(2);
});

it('can opt out of a failed thumbnail without losing confirmed video progress', async () => {
  const api = downloadAPI();
  api.saveThumbnail.mockRejectedValueOnce(new Error('test thumbnail failed'));
  renderSet(vodMetadata());
  fireEvent.click(screen.getByRole('button', { name: 'Download VODs' }));
  await screen.findByText(
    '0 of 1 selected clips ready. Review failed items and retry.'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Thumbnail Options' }));
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Download Thumbnails' })
  );
  fireEvent.keyDown(screen.getByRole('dialog'), {
    key: 'Escape',
    code: 'Escape',
  });
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Download VODs' }));
  await screen.findByText('1 of 1 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  expect(api.saveThumbnail).toHaveBeenCalledTimes(1);
});

it('cannot start a download or navigate while a new output root is still being validated', async () => {
  const api = downloadAPI();
  let release!: (value: string) => void;
  const pending = new Promise<string>((resolve) => {
    release = resolve;
  });
  api.chooseOutputDirectory.mockReturnValueOnce(pending);
  renderSet(vodMetadata());
  const choose = screen.getByRole('button', { name: 'Choose Output Folder' });
  await waitFor(() => expect(choose).toBeEnabled());
  fireEvent.click(choose);
  const download = screen.getByRole('button', { name: 'Download VODs' });
  expect(download).toBeDisabled();
  expect(screen.getByRole('button', { name: 'back' })).toBeDisabled();
  fireEvent.click(download);
  expect(api.downloadVideo).not.toHaveBeenCalled();
  await act(async () => {
    release('/chosen/output');
  });
  expect(download).toBeEnabled();
  expect(screen.getByText('Output folder: /chosen/output')).toBeInTheDocument();
});
