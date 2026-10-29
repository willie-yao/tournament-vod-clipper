import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { createHttpLink } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import App from '../renderer/App';
import { GET_ALL_CHARACTERS } from '../renderer/common/StartggQueries';

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  createHttpLink: jest.fn(),
}));

describe('App', () => {
  it('renders the home screen with mocked Electron and start.gg boundaries', async () => {
    const get = jest.fn();
    const set = jest.fn();
    const createFolder = jest.fn();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        store: { get, set },
        ipcRenderer: { createFolder },
      },
    });
    jest.mocked(createHttpLink).mockReturnValue(
      new MockLink([
        {
          request: {
            query: GET_ALL_CHARACTERS,
            variables: { gameid: 1386 },
          },
          result: {
            data: {
              videogame: {
                characters: [{ id: 1, name: 'Mario' }],
              },
            },
          },
        },
      ])
    );

    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Tournament VOD Clipper' })
    ).toBeInTheDocument();
    expect(createFolder).toHaveBeenCalledWith('downloadedVODs');
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith('characterMap', { 1: 'Mario' })
    );
    expect(
      screen.getByRole('button', { name: 'Retrieve Sets' })
    ).toBeDisabled();
  });
});
