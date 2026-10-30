import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SetsView from '../renderer/pages/SetsView';
import { VODMetadata } from '../renderer/common/tournamentSets';
import { vodMetadata } from '../test/fixtures';
import { exportThumbnail } from '../renderer/common/thumbnailDrawing';

jest.mock(
  '../renderer/components/ThumbnailGenerator',
  () =>
    ({ title }: { title: string }) =>
      <div id={title} />
);
jest.mock('../renderer/common/thumbnailDrawing', () => ({
  DEFAULT_THUMBNAIL_COLOR: '#223d55',
  exportThumbnail: jest.fn(async () => new Uint8Array([255, 216, 255])),
}));

function renderSets(sets: VODMetadata[] = [vodMetadata()]) {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/SetsView',
          state: {
            sets,
            vodUrl: 'https://www.twitch.tv/videos/123',
            tournamentName: 'Tournament',
            station: 'streamer',
            skippedSets: 0,
          },
        },
      ]}
    >
      <SetsView />
    </MemoryRouter>
  );
}

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

const second = () => ({
  ...vodMetadata(),
  id: '2',
  title: 'Second clip',
  player1: 'Player C',
});
const selection = (title = vodMetadata().title) =>
  screen.getByRole('checkbox', { name: `Select ${title}` });
const downloadButton = () =>
  screen.getByRole('button', {
    name: /Download \d+ clips|Retry incomplete clips/,
  });
const nextButton = () =>
  screen.getByRole('button', { name: 'Continue to Upload' });
const changeTime = (label: 'In time' | 'Out time', value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  downloadAPI();
  window.Twitch = undefined;
});

it('exports real set, round and event metadata with the shared default thumbnail settings', async () => {
  const api = downloadAPI();
  const set = {
    ...vodMetadata(),
    eventName: 'Ultimate Singles',
    roundText: 'Winners Final',
  };
  renderSets([set]);
  fireEvent.click(downloadButton());
  await screen.findByText('1 of 1 selected clips ready.');
  expect(exportThumbnail).toHaveBeenLastCalledWith(set, {
    color: '#223d55',
    logo: '',
    background: '',
  });
  expect(api.saveThumbnail).toHaveBeenCalledWith({
    folderName: 'Tournament',
    videoName: 'clip.mp4',
    buf: new Uint8Array([255, 216, 255]),
  });
});

it('keeps invalid records visible and correcting a 25-hour range does not select it', async () => {
  const api = downloadAPI();
  renderSets([
    {
      ...vodMetadata(),
      startTime: -60,
      needsCorrection: 'Times must be zero or greater.',
      download: false,
    },
  ]);
  expect(downloadButton()).toBeDisabled();
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select all valid clips' })
  );
  expect(selection()).not.toBeChecked();
  changeTime('In time', '25:00:00');
  changeTime('Out time', '25:01:00');
  fireEvent.click(screen.getByRole('button', { name: 'Apply to clip' }));
  expect(selection()).not.toBeChecked();
  expect(downloadButton()).toBeDisabled();
  fireEvent.click(selection());
  fireEvent.click(downloadButton());
  await screen.findByText('1 of 1 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledWith(
    expect.objectContaining({ startTime: 90000, endTime: 90060 })
  );
});

it('shares inspection, selection, applied titles and drafts between list and thumbnails', () => {
  renderSets([vodMetadata(), second()]);
  fireEvent.click(selection());
  fireEvent.click(screen.getByRole('button', { name: 'Inspect Second clip' }));
  expect(selection()).not.toBeChecked();
  expect(selection('Second clip')).toBeChecked();
  fireEvent.change(screen.getByLabelText('Video title'), {
    target: { value: 'Shared title' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Thumbnails' }));
  expect(screen.getByLabelText('Video title')).toHaveValue('Shared title');
  expect(selection()).not.toBeChecked();
  expect(selection('Second clip')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Apply to clip' }));
  expect(selection('Shared title')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'List' }));
  expect(selection('Shared title')).toBeChecked();
  expect(screen.getByLabelText('Video title')).toHaveValue('Shared title');
  expect(
    screen.getByRole('heading', { name: 'Player C vs Player B' })
  ).toBeInTheDocument();
});

it('preserves deselection when an already valid clip is edited', () => {
  renderSets();
  fireEvent.click(selection());
  fireEvent.change(screen.getByLabelText('Video title'), {
    target: { value: 'Edited title' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply to clip' }));
  expect(selection('Edited title')).not.toBeChecked();
  expect(downloadButton()).toBeDisabled();
});

it('preserves each review draft and batch context across previous/next, return and layout changes', async () => {
  renderSets([vodMetadata(), second()]);
  fireEvent.click(screen.getByRole('button', { name: 'Thumbnails' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  changeTime('In time', '00:00:45');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  changeTime('Out time', '00:03:00');
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(screen.getByLabelText('In time')).toHaveValue('00:00:45');
  fireEvent.click(screen.getByRole('button', { name: 'Back to batch' }));
  expect(screen.getByRole('button', { name: 'Thumbnails' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(selection()).toBeChecked();
  expect(downloadButton()).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Inspect Second clip' }));
  expect(screen.getByLabelText('Out time')).toHaveValue('00:03:00');
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  expect(screen.getByLabelText('Out time')).toHaveValue('00:03:00');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

it.each([
  ['', '00:02:00'],
  ['-00:01:00', '00:02:00'],
  ['NaN', '00:02:00'],
  ['00:02:00', '00:01:00'],
  ['00:01:00', '00:01:00'],
  ['00:00:00', 'Infinity'],
])(
  'blocks unapplied invalid boundaries %s to %s without discarding the draft',
  (start, end) => {
    renderSets();
    changeTime('In time', start);
    changeTime('Out time', end);
    expect(
      screen.getByRole('button', { name: 'Apply to clip' })
    ).toBeDisabled();
    expect(downloadButton()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Thumbnails' }));
    expect(screen.getByLabelText('In time')).toHaveValue(start);
    expect(screen.getByLabelText('Out time')).toHaveValue(end);
  }
);

it('waits for thumbnail writes, prevents duplicate submission and gates continuation', async () => {
  const api = downloadAPI();
  let releaseVideo!: (file: { folderName: string; videoName: string }) => void;
  let releaseWrite!: () => void;
  api.downloadVideo.mockReturnValueOnce(
    new Promise((resolve) => {
      releaseVideo = resolve;
    })
  );
  api.saveThumbnail.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      releaseWrite = resolve;
    })
  );
  renderSets([vodMetadata(), second()]);
  const download = downloadButton();
  fireEvent.click(download);
  fireEvent.click(download);
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  expect(download).toBeDisabled();
  expect(nextButton()).toBeDisabled();
  await act(async () =>
    releaseVideo({ folderName: 'Tournament', videoName: 'first.mp4' })
  );
  await waitFor(() => expect(api.saveThumbnail).toHaveBeenCalledTimes(1));
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  await act(async () => releaseWrite());
  await screen.findByText('2 of 2 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledTimes(2);
  expect(nextButton()).toBeEnabled();
  expect(downloadButton()).toBeDisabled();
});

it('reports partial failure and retries only missing downloads after switching layouts', async () => {
  const api = downloadAPI();
  api.downloadVideo.mockRejectedValueOnce(new Error('test download failed'));
  renderSets([vodMetadata(), second()]);
  fireEvent.click(downloadButton());
  await screen.findByText(
    '1 of 2 selected clips ready. Review failed items and retry.'
  );
  expect(nextButton()).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Thumbnails' }));
  expect(screen.getAllByText('test download failed').length).toBeGreaterThan(0);
  fireEvent.click(downloadButton());
  await screen.findByText('2 of 2 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledTimes(3);
  expect(nextButton()).toBeEnabled();
});

it('retries a failed thumbnail without downloading the confirmed video again', async () => {
  const api = downloadAPI();
  api.saveThumbnail.mockRejectedValueOnce(new Error('test thumbnail failed'));
  renderSets();
  fireEvent.click(downloadButton());
  await screen.findByText(
    '0 of 1 selected clips ready. Review failed items and retry.'
  );
  fireEvent.click(downloadButton());
  await screen.findByText('1 of 1 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  expect(api.saveThumbnail).toHaveBeenCalledTimes(2);
});

it('can opt out of failed thumbnails without losing confirmed video progress', async () => {
  const api = downloadAPI();
  api.saveThumbnail.mockRejectedValueOnce(new Error('test thumbnail failed'));
  renderSets();
  fireEvent.click(downloadButton());
  await screen.findByText(
    '0 of 1 selected clips ready. Review failed items and retry.'
  );
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Create thumbnails for the batch' })
  );
  fireEvent.click(downloadButton());
  await screen.findByText('1 of 1 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  expect(api.saveThumbnail).toHaveBeenCalledTimes(1);
});

it('locks downloads and navigation while a new output root is being validated, then clears readiness', async () => {
  const api = downloadAPI();
  renderSets();
  fireEvent.click(downloadButton());
  await screen.findByText('1 of 1 selected clips ready.');
  fireEvent.click(screen.getAllByRole('button', { name: 'Output options' })[0]);
  let release!: (value: string) => void;
  api.chooseOutputDirectory.mockReturnValueOnce(
    new Promise<string>((resolve) => {
      release = resolve;
    })
  );
  const choose = screen.getByRole('button', { name: 'Choose Output Folder' });
  await waitFor(() => expect(choose).toBeEnabled());
  fireEvent.click(choose);
  expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  await act(async () => release('/chosen/output'));
  expect(screen.getByText('Output folder: /chosen/output')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(nextButton()).toBeDisabled());
  expect(downloadButton()).toBeEnabled();
});

it('keeps all exception records visible in list and grid and shows a useful empty search', () => {
  renderSets([
    vodMetadata(),
    {
      ...second(),
      download: false,
      endTime: null,
      needsCorrection: 'Enter valid start and end times.',
    },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Exceptions 1' }));
  expect(
    screen.getByRole('button', { name: 'Inspect Second clip' })
  ).toBeInTheDocument();
  expect(selection('Second clip')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Thumbnails' }));
  expect(selection('Second clip')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Find player or title'), {
    target: { value: 'no such player' },
  });
  expect(
    screen.getByRole('heading', { name: 'No matching sets' })
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(selection()).toBeInTheDocument();
});
