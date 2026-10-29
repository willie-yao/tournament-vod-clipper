import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import SetsView from '../renderer/pages/SetsView';
import { VODMetadata } from '../renderer/common/tournamentSets';
import { vodMetadata } from '../test/fixtures';

jest.mock('../renderer/components/ThumbnailGenerator', () => () => null);
jest.mock('html2canvas', () =>
  jest.fn(async () => ({ toDataURL: () => 'data:image/png;base64,' }))
);

function renderSet(set: VODMetadata) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to="/sets"
              state={{
                sets: [set],
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
  const downloadVideo = jest.fn().mockResolvedValue({});
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        downloadVideo,
        createThumbnailFolder: jest.fn(),
        saveThumbnail: jest.fn(),
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
});

it('preserves deselection when editing an already valid set', () => {
  const downloadVideo = jest.fn();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { downloadVideo } },
  });
  renderSet(vodMetadata());
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
