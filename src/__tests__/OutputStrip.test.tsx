import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OutputStrip, { pathSegments } from '../renderer/components/OutputStrip';

describe('pathSegments', () => {
  it.each([
    [
      '/Users/sam/personal/tournament-vod-clipper/downloadedVODs',
      ['~', 'personal', 'tournament-vod-clipper'],
      'downloadedVODs',
    ],
    [
      'C:\\Users\\sam\\Videos\\downloadedVODs',
      ['~', 'Videos'],
      'downloadedVODs',
    ],
    ['/home/sam/downloadedVODs', ['~'], 'downloadedVODs'],
    ['/Volumes/Archive/a/b/c/clips', ['Volumes', '…', 'b', 'c'], 'clips'],
    ['/Users/sam', ['Users'], 'sam'],
    [
      '/Users/sam/vods/2026/Genesis 11 Top 64 Through Grand Finals',
      ['…', '2026'],
      'Genesis 11 Top 64 Through Grand Finals',
    ],
  ])('splits %s', (directory, parents, leaf) => {
    expect(pathSegments(directory)).toEqual({ parents, leaf });
  });
});

function setup(chosen: string | null) {
  const api = {
    getOutputDirectory: jest.fn().mockResolvedValue('/Users/sam/old/clips'),
    createFolder: jest.fn().mockResolvedValue('/Users/sam/old/clips'),
    chooseOutputDirectory: jest.fn().mockResolvedValue(chosen),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: api },
  });
  return api;
}

it('splices a newly chosen folder in over the old path', async () => {
  setup('/Users/sam/new/downloadedVODs');
  const choosing = jest.fn();
  render(<OutputStrip onChoosingChange={choosing} />);
  const strip = await screen.findByRole('button', {
    name: 'Change output folder, currently clips',
  });
  expect(strip).toHaveAccessibleDescription(
    /\/Users\/sam\/old\/clips\. Choose an existing downloadedVODs folder/
  );
  fireEvent.click(strip);
  await screen.findByRole('button', {
    name: 'Change output folder, currently downloadedVODs',
  });
  expect(choosing.mock.calls).toEqual([[true], [false]]);
  await waitFor(() =>
    expect(strip.querySelector('[data-splice]')).not.toBeNull()
  );
  const path = strip.querySelector('[data-splice]') as HTMLElement;
  expect(path.querySelector('.is-cut')).toHaveTextContent('clips');
  expect(path.querySelector('.is-cut')).toHaveAttribute('aria-hidden', 'true');
  fireEvent.animationEnd(path);
  expect(strip.querySelector('[data-splice]')).toBeNull();
  expect(strip.querySelector('.is-cut')).toBeNull();
  expect(strip.querySelector('.output-strip-cut')).toBeNull();
});

it('keeps the current path without a splice when the picker is cancelled', async () => {
  const api = setup(null);
  render(<OutputStrip />);
  const strip = await screen.findByRole('button', {
    name: 'Change output folder, currently clips',
  });
  fireEvent.click(strip);
  await screen.findByText('Change');
  expect(api.chooseOutputDirectory).toHaveBeenCalledTimes(1);
  expect(strip.querySelector('[data-splice]')).toBeNull();
  expect(strip).toHaveAccessibleName('Change output folder, currently clips');
});
