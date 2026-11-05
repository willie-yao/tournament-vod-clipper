import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SetsView, { SetsState } from '../renderer/pages/SetsView';
import AppShell from '../renderer/common/AppShell';
import OutputFolder from '../renderer/common/OutputFolder';
import { holdBatch, releaseHeldBatch } from '../renderer/common/heldBatch';
import {
  VODMetadata,
  formatSetMetadata,
  PLAYERS_FIRST_TITLE,
} from '../renderer/common/tournamentSets';
import { tournamentSet, vodMetadata } from '../test/fixtures';
import { exportThumbnail } from '../renderer/common/thumbnailDrawing';

jest.mock(
  '../renderer/components/ThumbnailGenerator',
  () =>
    ({ title }: { title: string }) =>
      <div id={title} />
);
jest.mock('../renderer/common/thumbnailPortraits', () => ({
  THUMBNAIL_CHARACTERS: ['Fox', 'Marth', 'Sonic'],
  getThumbnailPortrait: () => null,
}));
jest.mock('../renderer/common/thumbnailDrawing', () => ({
  DEFAULT_THUMBNAIL_COLOR: '#223d55',
  DEFAULT_THUMBNAIL_RIGHT_COLOR: '#8b4c37',
  exportThumbnail: jest.fn(async () => new Uint8Array([255, 216, 255])),
}));

const setsState = (sets: VODMetadata[]): SetsState => ({
  sets,
  vodUrl: 'https://www.twitch.tv/videos/123',
  tournamentName: 'Tournament',
  station: 'streamer',
  skippedSets: 0,
});

function renderSets(sets: VODMetadata[] = [vodMetadata()]) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/SetsView', state: setsState(sets) }]}
    >
      <SetsView />
    </MemoryRouter>
  );
}

function renderTabs(state: SetsState) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/SetsView', state }]}>
      <Routes>
        <Route path="/SetsView" element={<SetsView />} />
        <Route
          path="/YTUploadView"
          element={
            <AppShell current="output">
              <OutputFolder />
            </AppShell>
          }
        />
        <Route
          path="/"
          element={
            <AppShell current="source">
              <main />
            </AppShell>
          }
        />
      </Routes>
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
  screen.queryByRole('button', { name: 'Continue to Upload' });
const changeTime = (label: 'In time' | 'Out time', value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  downloadAPI();
  window.Twitch = undefined;
});

afterEach(() => {
  releaseHeldBatch();
  Reflect.deleteProperty(document, 'startViewTransition');
  Reflect.deleteProperty(window, 'matchMedia');
  jest.restoreAllMocks();
});

it('shows the source VOD link in the page heading without a source sidebar', () => {
  renderSets();
  expect(
    screen.queryByRole('complementary', { name: 'Source and output' })
  ).not.toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Open source VOD ↗' });
  expect(link.closest('header')).toHaveClass('app-heading');
  expect(link).toHaveAttribute('href', 'https://www.twitch.tv/videos/123');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noreferrer');
});

it('opens the existing batch output settings from the batch footer', async () => {
  renderSets();
  fireEvent.click(screen.getByRole('button', { name: 'Output options' }));
  const dialog = screen.getByRole('dialog', {
    name: 'Thumbnail & output options',
  });
  expect(within(dialog).getByLabelText('Left field color')).toBeVisible();
  expect(within(dialog).getByLabelText('Right field color')).toBeVisible();
  const done = within(dialog).getByRole('button', { name: 'Done' });
  await waitFor(() => expect(done).toBeEnabled());
  fireEvent.click(done);
  await waitFor(() => expect(dialog).not.toBeVisible());
});

it('keeps one footer count summary without thumbnail mode copy', () => {
  renderSets([vodMetadata(), second()]);
  const footer = screen.getByRole('contentinfo');
  expect(
    within(footer).getByRole('heading', { name: '2 clips in this batch' })
  ).toBeVisible();
  expect(within(footer).queryByText('2')).not.toBeInTheDocument();
  expect(
    within(footer).queryByText(/thumbnails included|video only/)
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'Generate thumbnails',
    })
  );
  expect(
    within(footer).queryByText(/thumbnails included|video only/)
  ).not.toBeInTheDocument();
  expect(downloadButton()).toHaveTextContent('Download 2 clips');
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select all valid clips' })
  );
  expect(
    within(footer).getByRole('heading', { name: '0 clips in this batch' })
  ).toBeVisible();
  expect(within(footer).queryByText('0')).not.toBeInTheDocument();
  expect(downloadButton()).toBeDisabled();
});

it('orders fields, Apply and Review while carrying unapplied drafts into review', () => {
  renderSets();
  const inspector = screen.getByRole('complementary', {
    name: 'Inspected match',
  });
  const apply = within(inspector).getByRole('button', {
    name: 'Apply to clip',
  });
  const review = within(inspector).getByRole('button', {
    name: 'Review clip & timestamps →',
  });
  ['In time', 'Out time', 'Video title'].forEach((label) => {
    expect(
      within(inspector).getByLabelText(label).compareDocumentPosition(apply)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(apply.compareDocumentPosition(review)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING
  );
  changeTime('In time', '00:00:45');
  expect(apply).toBeEnabled();
  expect(review).toBeEnabled();
  fireEvent.click(review);
  expect(
    screen.getByRole('heading', { name: 'Player A vs Player B' })
  ).toHaveFocus();
  expect(screen.getByLabelText('In time')).toHaveValue('00:00:45');
  expect(screen.getByRole('button', { name: 'Apply to clip' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Back to batch' }));
  expect(screen.getByLabelText('In time')).toHaveValue('00:00:45');
  expect(selection()).toBeChecked();
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
    rightColor: '#8b4c37',
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

it.each([1, 2])(
  'removes repeated helper copy with %s exceptions while keeping accessible validation',
  (count) => {
    renderSets([
      vodMetadata(),
      ...Array.from({ length: count }, (_, index) => ({
        ...second(),
        id: `invalid-${index}`,
        title: `Incomplete clip ${index}`,
        endTime: null,
        download: false,
        needsCorrection: 'Enter valid start and end times.',
      })),
    ]);
    [
      /Inspecting keeps selection unchanged/,
      /Correct invalid selected ranges before downloading/,
      /Apply pending edits to selected clips before downloading/,
      /Elapsed HH:mm:ss/,
      /^Saved ranges$/,
      /^\d+ needs? correction$/,
      /valid ranges/,
    ].forEach((copy) => {
      expect(screen.queryByText(copy)).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('region', { name: 'Saved clip ranges' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Exceptions ${count}` })
    ).toBeVisible();
    expect(
      screen.getAllByText('Enter valid start and end times.')
    ).toHaveLength(count);
    expect(screen.getByLabelText('In time')).not.toHaveAttribute(
      'aria-describedby'
    );
    expect(screen.getByLabelText('Out time')).not.toHaveAttribute(
      'aria-describedby'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Review clip & timestamps →' })
    );
    expect(screen.queryByText(/Elapsed HH:mm:ss/)).not.toBeInTheDocument();
    changeTime('Out time', '00:00:30');
    expect(screen.getByLabelText('Out time')).toHaveAccessibleDescription(
      'End time must be after start time.'
    );
    expect(
      screen.getByRole('slider', { name: 'Clip Out boundary' })
    ).toHaveAccessibleDescription(/End time must be after start time/);
    expect(
      screen.queryByText('Range needs correction')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Apply to clip' })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to batch' }));
    expect(
      screen.getByText('End time must be after start time.')
    ).toBeVisible();
    expect(
      screen.queryByText(/Apply pending edits to selected clips/)
    ).not.toBeInTheDocument();
    expect(downloadButton()).toBeDisabled();
  }
);

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

it.each([
  ['List', 'title'],
  ['Thumbnails', 'title'],
  ['Thumbnails', 'thumbnail'],
] as const)(
  'opens review from the inspected %s %s without changing selection or drafts',
  (view, entry) => {
    renderSets([vodMetadata(), second()]);
    fireEvent.click(selection());
    fireEvent.click(screen.getByRole('button', { name: view }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Inspect Second clip' })
    );
    expect(
      screen.queryByRole('button', { name: 'Back to batch' })
    ).not.toBeInTheDocument();
    expect(selection()).not.toBeChecked();
    expect(selection('Second clip')).toBeChecked();
    changeTime('In time', '00:01:15');
    fireEvent.click(
      screen.getByRole('button', {
        name:
          view === 'Thumbnails' && entry === 'title'
            ? 'Review match Second clip'
            : 'Review Second clip',
      })
    );
    expect(
      screen.getByRole('button', {
        name: `Back to ${view === 'List' ? 'list' : 'thumbnails'}`,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Player C vs Player B' })
    ).toHaveFocus();
    expect(screen.getByLabelText('In time')).toHaveValue('00:01:15');
    fireEvent.click(screen.getByRole('button', { name: 'Back to batch' }));
    expect(screen.getByRole('button', { name: view })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(selection()).not.toBeChecked();
    expect(selection('Second clip')).toBeChecked();
    expect(screen.getByLabelText('In time')).toHaveValue('00:01:15');
  }
);

it('opens review on repeated activation while the inspection transition is pending', async () => {
  const updates: Array<() => void> = [];
  let finish!: () => void;
  const skip = jest.fn();
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: jest.fn((update: () => void) => {
      updates.push(update);
      return {
        skipTransition: skip,
        finished: new Promise<void>((resolve) => {
          finish = resolve;
        }),
      };
    }),
  });
  renderSets([vodMetadata(), second()]);
  const match = screen.getByRole('button', { name: 'Inspect Second clip' });
  fireEvent.click(match);
  fireEvent.click(match);
  expect(skip).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole('heading', { name: 'Player C vs Player B' })
  ).toHaveFocus();
  act(() => updates[0]());
  expect(
    screen.getByRole('heading', { name: 'Player C vs Player B' })
  ).toHaveFocus();
  expect(
    screen.getByRole('button', { name: 'Back to list' })
  ).toBeInTheDocument();
  await act(async () => finish());
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

it('keeps full title reference and manual overrides through review, Apply and download', async () => {
  const api = downloadAPI();
  const set = formatSetMetadata(
    tournamentSet({ fullRoundText: 'Winners Quarter-Final' }),
    'A Very Long Regional Championship Series '.repeat(4),
    1000,
    {},
    PLAYERS_FIRST_TITLE
  );
  renderSets([set]);
  expect(screen.getByLabelText('Video title')).toHaveValue(set.title);
  expect(screen.getByText(set.originalTitle!.trim())).toBeInTheDocument();
  const invalid = 'Custom '.repeat(15);
  fireEvent.change(screen.getByLabelText('Video title'), {
    target: { value: invalid },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  expect(screen.getByLabelText('Video title')).toHaveValue(invalid);
  expect(screen.getByText(set.originalTitle!.trim())).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Apply to clip' })).toBeDisabled();
  const custom = 'Handwritten title '.padEnd(100, 'x');
  fireEvent.change(screen.getByLabelText('Video title'), {
    target: { value: custom },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply to clip' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to batch' }));
  fireEvent.click(screen.getByRole('button', { name: 'Thumbnails' }));
  expect(screen.getByLabelText('Video title')).toHaveValue(custom);
  fireEvent.click(downloadButton());
  await screen.findByText('1 of 1 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledWith(
    expect.objectContaining({ title: custom })
  );
  expect(exportThumbnail).toHaveBeenCalledWith(
    expect.objectContaining({
      player1: set.player1,
      player2: set.player2,
      roundText: 'Winners Quarter-Final',
      tournamentName: set.tournamentName,
      originalTitle: set.originalTitle,
    }),
    expect.anything()
  );
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
  expect(nextButton()).toBeNull();
  await act(async () =>
    releaseVideo({ folderName: 'Tournament', videoName: 'first.mp4' })
  );
  await waitFor(() => expect(api.saveThumbnail).toHaveBeenCalledTimes(1));
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  expect(screen.getAllByText('Saving thumbnail...').length).toBeGreaterThan(0);
  expect(screen.getByText('0 of 2 ready · 1 clip files saved')).toBeVisible();
  expect(nextButton()).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Inspect Second clip' })
  ).toBeDisabled();
  expect(
    within(
      screen.getByRole('complementary', { name: 'Inspected match' })
    ).getByRole('heading', { name: 'Player A vs Player B' })
  ).toBeInTheDocument();
  await act(async () => releaseWrite());
  await screen.findByText('2 of 2 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledTimes(2);
  expect(nextButton()).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: /Download \d+ clips/ })
  ).toBeNull();
});

it('reports partial failure and retries only missing downloads after switching layouts', async () => {
  const api = downloadAPI();
  api.downloadVideo.mockRejectedValueOnce(new Error('test download failed'));
  renderSets([vodMetadata(), second()]);
  fireEvent.click(downloadButton());
  await screen.findByText(
    '1 of 2 selected clips ready. Review failed items and retry.'
  );
  expect(nextButton()).toBeNull();
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
  expect(
    screen.getAllByText('Clip saved; thumbnail failed: test thumbnail failed')
  ).toHaveLength(2);
  expect(screen.getByText('0 of 1 ready · 1 clip files saved')).toBeVisible();
  fireEvent.click(downloadButton());
  await screen.findByText('1 of 1 selected clips ready.');
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  expect(api.saveThumbnail).toHaveBeenCalledTimes(2);
});

it('keeps handle edits as per-set drafts through review, next, grid and Apply', () => {
  renderSets([vodMetadata(), second()]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  const handle = screen.getByRole('slider', { name: 'Clip In boundary' });
  handle.focus();
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(screen.getByLabelText('In time')).toHaveValue('00:01:01');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  changeTime('Out time', '00:03:00');
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(screen.getByLabelText('In time')).toHaveValue('00:01:01');
  fireEvent.click(screen.getByRole('button', { name: 'Back to batch' }));
  expect(downloadButton()).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Thumbnails' }));
  expect(screen.getByLabelText('In time')).toHaveValue('00:01:01');
  fireEvent.click(screen.getByRole('button', { name: 'Apply to clip' }));
  expect(selection()).toBeChecked();
  expect(downloadButton()).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Inspect Second clip' }));
  expect(screen.getByLabelText('Out time')).toHaveValue('00:03:00');
});

it('marks only the title invalid in review when the title alone is wrong', () => {
  renderSets();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  fireEvent.change(screen.getByLabelText('Video title'), {
    target: { value: '' },
  });
  expect(screen.getByLabelText('In time')).toHaveAttribute(
    'aria-invalid',
    'false'
  );
  expect(screen.getByLabelText('Out time')).toHaveAttribute(
    'aria-invalid',
    'false'
  );
});

it('explains that an excluded clip with unapplied edits needs Apply before it can return', () => {
  renderSets();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  fireEvent.click(selection());
  changeTime('Out time', '00:02:30');
  expect(selection()).toBeDisabled();
  expect(selection()).toHaveAccessibleDescription(
    'Apply to clip before adding it back to the batch.'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Apply to clip' }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Changes applied. Batch selection is unchanged.'
  );
  expect(selection()).toBeEnabled();
  expect(
    screen.queryByText('Apply to clip before adding it back to the batch.')
  ).not.toBeInTheDocument();
  fireEvent.click(selection());
  expect(selection()).toBeChecked();
});

it('uses an immediate focused review when reduced motion disables View Transitions', () => {
  const start = jest.fn();
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: start,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({ matches: true }),
  });
  renderSets();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  expect(start).not.toHaveBeenCalled();
  expect(
    screen.getByRole('heading', { name: 'Player A vs Player B' })
  ).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Back to batch' }));
  expect(
    screen.getByRole('heading', { name: 'Player A vs Player B' })
  ).toHaveFocus();
  Reflect.deleteProperty(window, 'matchMedia');
});

it('keeps the latest workspace and focus when transition callbacks arrive after rapid navigation', async () => {
  const updates: Array<() => void> = [];
  const finish: Array<() => void> = [];
  const skip = jest.fn();
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: jest.fn((update: () => void) => {
      updates.push(update);
      return {
        skipTransition: skip,
        finished: new Promise<void>((resolve) => finish.push(resolve)),
      };
    }),
  });
  renderSets([
    vodMetadata(),
    second(),
    { ...second(), id: '3', player1: 'Player D', title: 'Third clip' },
  ]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Thumbnails' }));
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  act(() => updates[0]());
  changeTime('In time', '00:00:45');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  act(() => updates[1]());
  expect(
    screen.getByRole('heading', { name: 'Player D vs Player B' })
  ).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Back to batch' }));
  act(() => updates[2]());
  expect(screen.getByRole('button', { name: 'Thumbnails' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(
    screen.getByRole('button', { name: `Inspect ${vodMetadata().title}` })
  );
  act(() => updates[2]());
  expect(screen.getByLabelText('In time')).toHaveValue('00:00:45');
  expect(skip).toHaveBeenCalled();
  await act(async () => finish.forEach((resolve) => resolve()));
});

it('falls back to the real review controls if starting a transition throws', () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation();
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: () => {
      throw new Error('Transition unsupported');
    },
  });
  renderSets();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  expect(
    screen.getByRole('slider', { name: 'Clip In boundary' })
  ).toBeEnabled();
  expect(
    screen.getByRole('heading', { name: 'Player A vs Player B' })
  ).toHaveFocus();
  expect(warning).toHaveBeenCalledWith(
    'Review transition unavailable; using the current view.',
    expect.any(Error)
  );
});

it('cancels pending review navigation when downloading locks the rendered batch', async () => {
  const updates: Array<() => void> = [];
  const finish: Array<() => void> = [];
  const skip = jest.fn();
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: jest.fn((update: () => void) => {
      updates.push(update);
      return {
        skipTransition: skip,
        finished: new Promise<void>((resolve) => finish.push(resolve)),
      };
    }),
  });
  const api = downloadAPI();
  let release!: (file: { folderName: string; videoName: string }) => void;
  api.downloadVideo.mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    })
  );
  renderSets();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  const download = downloadButton();
  download.focus();
  fireEvent.click(download);
  expect(download).toBeDisabled();
  act(() => updates[0]());
  expect(
    screen.getByRole('heading', { name: 'Tournament', exact: true, level: 1 })
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Back to batch' })).toBeNull();
  expect(download).toHaveFocus();
  expect(selection()).toBeChecked();
  expect(skip).toHaveBeenCalled();

  await act(async () =>
    release({ folderName: 'Tournament', videoName: 'clip.mp4' })
  );
  await screen.findByText('1 of 1 selected clips ready.');
  await act(async () => finish[0]());
  fireEvent.click(screen.getByRole('button', { name: 'Thumbnails' }));
  act(() => updates[1]());
  await act(async () => finish[1]());
  expect(screen.getByRole('button', { name: 'Thumbnails' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.queryByRole('button', { name: 'Back to batch' })).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  act(() => updates[2]());
  await act(async () => finish[2]());
  expect(
    screen.getByRole('heading', { name: 'Player A vs Player B' })
  ).toHaveFocus();
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
    screen.getByRole('checkbox', { name: 'Generate thumbnails' })
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
  fireEvent.change(screen.getByLabelText('Left field color'), {
    target: { value: '#112233' },
  });
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  expect(
    screen.getByRole('button', { name: 'Reset to default' })
  ).toBeEnabled();
  fireEvent.click(choose);
  expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Reset to default' })
  ).toBeDisabled();
  expect(screen.getByLabelText('Left field color')).toBeDisabled();
  expect(screen.getByLabelText('Right field color')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Select logo' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Select background image' })
  ).toBeDisabled();
  await act(async () => release('/chosen/output'));
  fireEvent.click(screen.getByText('Output folder'));
  expect(screen.getByText('/chosen/output')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(downloadButton()).toBeEnabled());
  expect(nextButton()).toBeNull();
});

it('keeps both field colors in the selected settings layout and invalidates old thumbnail readiness', async () => {
  const api = downloadAPI();
  renderSets();
  fireEvent.click(downloadButton());
  await screen.findByText('1 of 1 selected clips ready.');
  expect(nextButton()).toBeEnabled();
  fireEvent.click(screen.getAllByRole('button', { name: 'Output options' })[0]);
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('1280 × 720 JPEG')).toBeVisible();
  expect(dialog.getByLabelText('Left field color')).toHaveValue('#223d55');
  expect(dialog.getByLabelText('Right field color')).toHaveValue('#8b4c37');
  expect(dialog.getByRole('button', { name: 'Remove logo' })).toBeDisabled();
  expect(
    dialog.getByRole('button', { name: 'Remove background' })
  ).toBeDisabled();
  fireEvent.change(dialog.getByLabelText('Right field color'), {
    target: { value: '#336699' },
  });
  fireEvent.click(dialog.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(downloadButton()).toBeEnabled());
  expect(nextButton()).toBeNull();
  expect(selection()).toBeChecked();
  fireEvent.click(downloadButton());
  await screen.findByText('1 of 1 selected clips ready.');
  expect(exportThumbnail).toHaveBeenLastCalledWith(vodMetadata(), {
    color: '#223d55',
    rightColor: 'rgb(51, 102, 153)',
    logo: '',
    background: '',
  });
  expect(api.downloadVideo).toHaveBeenCalledTimes(1);
  expect(api.saveThumbnail).toHaveBeenCalledTimes(2);
  expect(nextButton()).toBeEnabled();
  fireEvent.click(screen.getAllByRole('button', { name: 'Output options' })[0]);
  fireEvent.change(screen.getByLabelText('Left field color'), {
    target: { value: '#405060' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(downloadButton()).toBeEnabled());
  expect(nextButton()).toBeNull();
});

function openColorSettings() {
  renderSets();
  fireEvent.click(screen.getByRole('button', { name: 'Output options' }));
  return within(screen.getByRole('dialog'));
}

it('resets both field colors to their defaults and can undo the reset', () => {
  const dialog = openColorSettings();
  const reset = dialog.getByRole('button', { name: 'Reset to default' });
  const undo = dialog.getByRole('button', { name: 'Undo' });
  expect(reset).toBeDisabled();
  expect(undo).toBeDisabled();
  fireEvent.change(dialog.getByLabelText('Left field color'), {
    target: { value: '#112233' },
  });
  expect(reset).toBeEnabled();
  fireEvent.click(reset);
  expect(dialog.getByLabelText('Left field color')).toHaveValue('#223d55');
  expect(dialog.getByLabelText('Right field color')).toHaveValue('#8b4c37');
  expect(reset).toBeDisabled();
  fireEvent.click(undo);
  expect(dialog.getByLabelText('Left field color')).toHaveValue(
    'rgb(17, 34, 51)'
  );
  expect(reset).toBeEnabled();
});

it('undoes field color edits one step at a time and groups quick edits', () => {
  const now = jest.spyOn(Date, 'now');
  const dialog = openColorSettings();
  const undo = dialog.getByRole('button', { name: 'Undo' });
  const edit = (label: string, value: string, at: number) => {
    now.mockReturnValue(at);
    fireEvent.change(dialog.getByLabelText(label), { target: { value } });
  };
  edit('Left field color', '#111111', 10000);
  edit('Left field color', '#222222', 10100);
  edit('Right field color', '#333333', 12000);
  expect(undo).toBeEnabled();
  fireEvent.click(undo);
  expect(dialog.getByLabelText('Right field color')).toHaveValue('#8b4c37');
  expect(dialog.getByLabelText('Left field color')).toHaveValue('#222222');
  fireEvent.click(undo);
  expect(dialog.getByLabelText('Left field color')).toHaveValue('#223d55');
  expect(undo).toBeDisabled();
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

describe('batch kept across pages', () => {
  const matchReview = () =>
    screen.getByRole('button', { name: 'Match review' });

  it('restores applied edits, drafts, selection and workspace after leaving the page', () => {
    renderTabs(setsState([vodMetadata(), second()]));
    changeTime('In time', '00:00:45');
    fireEvent.click(screen.getByRole('button', { name: 'Apply to clip' }));
    fireEvent.click(selection());
    fireEvent.click(screen.getByRole('button', { name: 'Thumbnails' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Inspect Second clip' })
    );
    changeTime('Out time', '00:03:00');
    fireEvent.click(
      screen.getByRole('button', { name: 'Review clip & timestamps →' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Output & YouTube' }));
    expect(screen.queryByLabelText('Out time')).not.toBeInTheDocument();
    fireEvent.click(matchReview());
    expect(screen.getByLabelText('Out time')).toHaveValue('00:03:00');
    expect(screen.getByRole('button', { name: 'Apply to clip' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to thumbnails' }));
    expect(screen.getByRole('button', { name: 'Thumbnails' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(selection()).not.toBeChecked();
    expect(selection('Second clip')).toBeChecked();
    fireEvent.click(
      screen.getByRole('button', { name: `Inspect ${vodMetadata().title}` })
    );
    expect(screen.getByLabelText('In time')).toHaveValue('00:00:45');
    expect(
      screen.getByRole('button', { name: 'Apply to clip' })
    ).toBeDisabled();
  });

  it('forgets held downloads when the output folder changes on another page', async () => {
    const api = downloadAPI();
    renderTabs(setsState([vodMetadata()]));
    fireEvent.click(downloadButton());
    await screen.findByText('1 of 1 selected clips ready.');
    fireEvent.click(screen.getByRole('button', { name: 'Output & YouTube' }));
    api.chooseOutputDirectory.mockResolvedValueOnce('/chosen/output');
    const choose = screen.getByRole('button', { name: 'Choose Output Folder' });
    await waitFor(() => expect(choose).toBeEnabled());
    fireEvent.click(choose);
    await screen.findByText('/chosen/output');
    fireEvent.click(matchReview());
    expect(nextButton()).toBeNull();
    expect(downloadButton()).toHaveTextContent('Download 1 clips');
  });

  it('starts fresh when a new retrieval replaces the held batch', () => {
    const first = renderTabs(setsState([vodMetadata()]));
    changeTime('In time', '00:00:45');
    fireEvent.click(screen.getByRole('button', { name: 'Apply to clip' }));
    first.unmount();
    renderTabs(setsState([second()]));
    expect(screen.getByLabelText('Video title')).toHaveValue('Second clip');
    expect(screen.queryByText('Player A vs Player B')).not.toBeInTheDocument();
  });

  it('enables Match review only while a batch is held', () => {
    const state = setsState([vodMetadata()]);
    const view = render(
      <MemoryRouter>
        <AppShell current="output">
          <main />
        </AppShell>
      </MemoryRouter>
    );
    expect(matchReview()).toBeDisabled();
    view.unmount();
    holdBatch({
      source: state,
      sets: state.sets,
      drafts: {},
      workspace: { inspectedId: '1', layout: 'list', review: false },
      filter: 'all',
      search: '',
      results: {},
      downloadThumbnails: true,
      thumbnailColor: '',
      thumbnailRightColor: '',
      thumbnailLogo: '',
      thumbnailBg: '',
    });
    render(
      <MemoryRouter>
        <AppShell current="output">
          <main />
        </AppShell>
      </MemoryRouter>
    );
    expect(matchReview()).toBeEnabled();
  });
});

it('jumps between clips from the pager queue menu', () => {
  renderSets([vodMetadata(), second()]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Review clip & timestamps →' })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Batch queue, clip 1 of 2' })
  );
  fireEvent.click(screen.getByRole('menuitem', { name: /Player C/ }));
  expect(
    screen.getByRole('button', { name: 'Batch queue, clip 2 of 2' })
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Video title')).toHaveValue('Second clip');
});

describe('per-clip thumbnail fields', () => {
  const openReview = () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'Review clip & timestamps →' })
    );
  const apply = () => screen.getByRole('button', { name: 'Apply to clip' });
  const type = (label: string, value: string) =>
    fireEvent.change(
      /character/.test(label)
        ? screen.getByRole('combobox', { name: label })
        : screen.getByLabelText(label),
      { target: { value } }
    );

  it('shows clip thumbnail fields in review and batch controls in the batch view', () => {
    renderSets();
    expect(screen.getByText('Batch thumbnails')).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Generate thumbnails' })
    ).toBeVisible();
    openReview();
    expect(screen.queryByText('Batch thumbnails')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thumbnail' })).toBeVisible();
    ['Left player', 'Right player', 'Round'].forEach((label) =>
      expect(screen.getByLabelText(label)).toBeVisible()
    );
    expect(
      screen.getByRole('combobox', { name: 'Left character' })
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Right character' })
    ).toBeVisible();
  });

  it('keeps edits as a draft until Apply and previews them live', () => {
    const set = vodMetadata();
    renderSets();
    openReview();
    expect(apply()).toBeDisabled();
    type('Left player', 'New Left');
    type('Right character', 'Fox');
    type('Round', 'Grand Finals');
    expect(apply()).toBeEnabled();
    expect(
      screen.getByLabelText(`Thumbnail for New Left vs ${set.player2}`)
    ).toBeVisible();
    fireEvent.click(apply());
    expect(apply()).toBeDisabled();
    expect(screen.getByLabelText('Left player')).toHaveValue('New Left');
    expect(
      screen.getByRole('combobox', { name: 'Right character' })
    ).toHaveValue('Fox');
    expect(screen.getByLabelText('Round')).toHaveValue('Grand Finals');
    fireEvent.click(screen.getByRole('button', { name: 'Back to batch' }));
    expect(
      screen.getAllByLabelText(`Thumbnail for New Left vs ${set.player2}`)
        .length
    ).toBeGreaterThan(0);
  });

  it('swaps names and characters', () => {
    renderSets();
    openReview();
    type('Left player', 'Alpha');
    type('Right player', 'Beta');
    type('Left character', 'Fox');
    type('Right character', 'Marth');
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }));
    expect(screen.getByLabelText('Left player')).toHaveValue('Beta');
    expect(screen.getByLabelText('Right player')).toHaveValue('Alpha');
    expect(
      screen.getByRole('combobox', { name: 'Left character' })
    ).toHaveValue('Marth');
    expect(
      screen.getByRole('combobox', { name: 'Right character' })
    ).toHaveValue('Fox');
  });

  it('blocks Apply when a name is cleared', () => {
    renderSets();
    openReview();
    type('Left player', ' ');
    expect(
      screen.getByText('Enter both player names for the thumbnail.')
    ).toBeVisible();
    expect(apply()).toBeDisabled();
  });

  it('hints when the title no longer contains the draft names', () => {
    renderSets();
    openReview();
    const hint = 'The video title still uses the previous player names.';
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
    type('Left player', 'Someone Else');
    expect(screen.getByText(hint)).toBeVisible();
    type('Video title', 'Someone Else vs Player B');
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });

  it('re-saves only the thumbnail after an applied thumbnail edit', async () => {
    const api = downloadAPI();
    renderSets();
    fireEvent.click(downloadButton());
    await screen.findByText('1 of 1 selected clips ready.');
    expect(api.saveThumbnail).toHaveBeenCalledTimes(1);
    openReview();
    type('Left character', 'Fox');
    fireEvent.click(apply());
    fireEvent.click(screen.getByRole('button', { name: 'Back to batch' }));
    await waitFor(() => expect(downloadButton()).toBeEnabled());
    fireEvent.click(downloadButton());
    await screen.findByText('1 of 1 selected clips ready.');
    expect(api.downloadVideo).toHaveBeenCalledTimes(1);
    expect(api.saveThumbnail).toHaveBeenCalledTimes(2);
    expect(exportThumbnail).toHaveBeenLastCalledWith(
      expect.objectContaining({ character1: 'Fox' }),
      expect.anything()
    );
  });
});
