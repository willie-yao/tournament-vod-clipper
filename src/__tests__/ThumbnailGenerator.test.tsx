import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ThumbnailGenerator from '../renderer/components/ThumbnailGenerator';
import { renderThumbnail } from '../renderer/common/thumbnailDrawing';
import { vodMetadata } from '../test/fixtures';

jest.mock('../renderer/common/thumbnailDrawing', () => ({
  renderThumbnail: jest.fn(),
}));

beforeEach(() => jest.mocked(renderThumbnail).mockReset());

it('surfaces a render failure without leaving the thumbnail marked as busy', async () => {
  jest
    .mocked(renderThumbnail)
    .mockRejectedValueOnce(new Error('test font failure'));
  render(
    <ThumbnailGenerator
      set={vodMetadata()}
      style={{
        color: '#223d55',
        rightColor: '#8b4c37',
        logo: '',
        background: '',
      }}
    />
  );
  expect(screen.getByRole('img')).toHaveAttribute('aria-busy', 'true');
  const image = await screen.findByRole('img', {
    name: 'Thumbnail unavailable: test font failure',
  });
  expect(image).toHaveAttribute('aria-busy', 'false');
  expect(image).toHaveAttribute('data-thumbnail-ready', 'false');
});

it('rerenders the live preview when only the right field color changes', async () => {
  jest
    .mocked(renderThumbnail)
    .mockRejectedValue(new Error('Controlled render'));
  const style = {
    color: '#223d55',
    rightColor: '#8b4c37',
    logo: '',
    background: '',
  };
  const view = render(<ThumbnailGenerator set={vodMetadata()} style={style} />);
  await screen.findByRole('img', {
    name: 'Thumbnail unavailable: Controlled render',
  });
  const updated = { ...style, rightColor: '#336699' };
  view.rerender(<ThumbnailGenerator set={vodMetadata()} style={updated} />);
  await screen.findByRole('img', {
    name: 'Thumbnail unavailable: Controlled render',
  });
  expect(renderThumbnail).toHaveBeenCalledTimes(2);
  expect(renderThumbnail).toHaveBeenLastCalledWith(
    expect.objectContaining({ player1: vodMetadata().player1 }),
    updated
  );
});
