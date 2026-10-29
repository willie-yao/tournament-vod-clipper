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
  await screen.findByText('Output folder: /legacy/downloadedVODs');
  await screen.findByText(/Cannot write to the output folder/);
  expect(api.chooseOutputDirectory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Choose Output Folder' }));
  await screen.findByText('Output folder: /chosen/output');
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
  await screen.findByText('Output folder: /legacy/downloadedVODs');
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
  expect(
    screen.getByText('Output folder: /legacy/downloadedVODs')
  ).toBeInTheDocument();
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
  await screen.findByText('Output folder: /legacy/downloadedVODs');
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
