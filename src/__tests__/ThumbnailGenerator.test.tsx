import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ThumbnailGenerator from '../renderer/components/ThumbnailGenerator';
import { renderThumbnail } from '../renderer/common/thumbnailDrawing';
import { vodMetadata } from '../test/fixtures';

jest.mock('../renderer/common/thumbnailDrawing', () => ({
  renderThumbnail: jest.fn(),
}));

it('surfaces a render failure without leaving the thumbnail marked as busy', async () => {
  jest
    .mocked(renderThumbnail)
    .mockRejectedValueOnce(new Error('test font failure'));
  render(
    <ThumbnailGenerator
      set={vodMetadata()}
      style={{ color: '#223d55', logo: '', background: '' }}
    />
  );
  expect(screen.getByRole('img')).toHaveAttribute('aria-busy', 'true');
  const image = await screen.findByRole('img', {
    name: 'Thumbnail unavailable: test font failure',
  });
  expect(image).toHaveAttribute('aria-busy', 'false');
  expect(image).toHaveAttribute('data-thumbnail-ready', 'false');
});
