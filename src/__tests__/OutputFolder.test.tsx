import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import OutputFolder from '../renderer/common/OutputFolder';

it('announces the current root and only changes it after an explicit successful folder choice', async () => {
  const api = {
    getOutputDirectory: jest.fn().mockResolvedValue('/legacy/downloadedVODs'),
    createFolder: jest
      .fn()
      .mockRejectedValue(new Error('test read-only folder')),
    chooseOutputDirectory: jest.fn().mockResolvedValue('/chosen/output'),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: api },
  });
  const changed = jest.fn();
  render(<OutputFolder onChange={changed} />);
  await screen.findByText('downloadedVODs');
  expect(screen.getByText('/legacy/downloadedVODs')).not.toBeVisible();
  fireEvent.click(screen.getByText('Output folder'));
  expect(screen.getByText('/legacy/downloadedVODs')).toBeVisible();
  await screen.findByText(/Cannot write to the output folder/);
  expect(api.chooseOutputDirectory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Choose Output Folder' }));
  await screen.findByText('/chosen/output');
  expect(screen.getByText('output')).toBeVisible();
  expect(changed).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByText(/Cannot write to the output folder/)
  ).not.toBeInTheDocument();
});

it('keeps the existing root when the picker is cancelled', async () => {
  const api = {
    getOutputDirectory: jest.fn().mockResolvedValue('/legacy/downloadedVODs'),
    createFolder: jest.fn().mockResolvedValue('/legacy/downloadedVODs'),
    chooseOutputDirectory: jest.fn().mockResolvedValue(null),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: api },
  });
  const changed = jest.fn();
  render(<OutputFolder onChange={changed} />);
  await screen.findByText('downloadedVODs');
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Choose Output Folder' })
    ).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Choose Output Folder' }));
  await waitFor(() =>
    expect(api.chooseOutputDirectory).toHaveBeenCalledTimes(1)
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Choose Output Folder' })
    ).toBeEnabled()
  );
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByText('/legacy/downloadedVODs')).toBeInTheDocument();
});

it('does not open a picker while the initial root check is pending', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = {
    getOutputDirectory: jest.fn().mockResolvedValue('/legacy/downloadedVODs'),
    createFolder: jest.fn().mockReturnValue(gate),
    chooseOutputDirectory: jest.fn(),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: api },
  });
  render(<OutputFolder />);
  await screen.findByText('downloadedVODs');
  expect(
    screen.getByRole('button', { name: 'Choose Output Folder' })
  ).toBeDisabled();
  await act(async () => {
    release();
  });

  expect(
    screen.getByRole('button', { name: 'Choose Output Folder' })
  ).toBeEnabled();
  expect(api.chooseOutputDirectory).not.toHaveBeenCalled();
});

it('keeps long Windows paths discoverable through a focusable native disclosure', async () => {
  const directory =
    'C:\\Users\\Fixture\\Tournaments\\Long archive\\downloadedVODs';
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        getOutputDirectory: jest.fn().mockResolvedValue(directory),
        createFolder: jest.fn().mockResolvedValue(directory),
        chooseOutputDirectory: jest.fn().mockResolvedValue(null),
      },
    },
  });
  render(<OutputFolder />);
  await screen.findByText('downloadedVODs');
  expect(screen.getByText(directory)).not.toBeVisible();
  const summary = screen.getByText('Output folder').closest('summary');
  if (!summary) throw new Error('Output location disclosure is missing.');
  summary.focus();
  expect(summary).toHaveFocus();
  fireEvent.click(summary);
  expect(screen.getByText(directory)).toBeVisible();
  expect(screen.getByText(/Files are not moved/)).toBeVisible();
});
