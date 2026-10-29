import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import EditTimestampModal from '../renderer/components/EditTimestampModal';
import { vodMetadata } from '../test/fixtures';

describe('elapsed timestamp editor', () => {
  it('saves a 25-hour range as elapsed seconds and previews it without wrapping', () => {
    const onSave = jest.fn();
    render(
      <EditTimestampModal
        set={vodMetadata()}
        vodUrl="https://www.twitch.tv/videos/123"
        onClose={jest.fn()}
        onSave={onSave}
      />
    );
    fireEvent.change(screen.getByLabelText('Start Time'), {
      target: { value: '25:00:00' },
    });
    fireEvent.change(screen.getByLabelText('End Time'), {
      target: { value: '25:01:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Skip to start' }));
    expect(screen.getByTitle('Twitch VOD preview')).toHaveAttribute(
      'src',
      expect.stringContaining('t=25h0m0s')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(onSave).toHaveBeenCalledWith(90000, 90060, vodMetadata().title);
  });

  it.each([
    ['', '00:01:00'],
    ['-00:01:00', '00:01:00'],
    ['NaN', '00:01:00'],
    ['00:02:00', '00:01:00'],
    ['00:01:00', '00:01:00'],
    ['00:00:00', 'Infinity'],
  ])('prevents invalid save for %s to %s', (start, end) => {
    const onSave = jest.fn();
    render(
      <EditTimestampModal
        set={vodMetadata()}
        vodUrl="https://www.twitch.tv/videos/123"
        onClose={jest.fn()}
        onSave={onSave}
      />
    );
    fireEvent.change(screen.getByLabelText('Start Time'), {
      target: { value: start },
    });
    fireEvent.change(screen.getByLabelText('End Time'), {
      target: { value: end },
    });
    expect(screen.getByRole('button', { name: 'Change' })).toBeDisabled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
