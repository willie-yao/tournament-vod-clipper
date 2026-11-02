import '@testing-library/jest-dom';
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ClipRange from '../renderer/components/ClipRange';
import ClipFields from '../renderer/components/ClipFields';
import { draftFor } from '../renderer/common/clipDraft';
import { vodMetadata } from '../test/fixtures';

function Fixture({
  disabled = false,
  start = 60,
  end = 120,
}: {
  disabled?: boolean;
  start?: number;
  end?: number;
}) {
  const saved = { ...vodMetadata(), startTime: start, endTime: end };
  const [draft, setDraft] = useState(() => draftFor(saved));
  return (
    <>
      <ClipRange
        saved={saved}
        draft={draft}
        onChange={setDraft}
        disabled={disabled}
        duration={100000}
      />
      <ClipFields
        saved={draftFor(saved)}
        draft={draft}
        onChange={setDraft}
        disabled={disabled}
        duration={100000}
      />
    </>
  );
}

Fixture.defaultProps = { disabled: false, start: 60, end: 120 };

class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

beforeEach(() => {
  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    value: TestPointerEvent,
  });
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: { configurable: true, value: jest.fn() },
    releasePointerCapture: { configurable: true, value: jest.fn() },
  });
});

afterEach(() => jest.restoreAllMocks());

it('adjusts elapsed time by keyboard, retains focus and compares the saved range', () => {
  render(<Fixture />);
  const handle = screen.getByRole('slider', { name: 'Clip In boundary' });
  const saved = document.querySelector('.trim-saved') as HTMLElement;
  const savedPosition = saved.style.cssText;
  handle.focus();
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(screen.getByLabelText('In time')).toHaveValue('00:01:01');
  expect(handle).toHaveAttribute('aria-valuenow', '61');
  expect(handle).toHaveFocus();
  expect(screen.getByText('+00:00:01', { exact: false })).toBeVisible();
  expect(saved.style.cssText).toBe(savedPosition);
  fireEvent.keyDown(handle, { key: 'Home' });
  expect(screen.getByLabelText('In time')).toHaveValue('00:00:00');
  fireEvent.keyDown(handle, { key: 'End' });
  expect(handle).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent(
    'End time must be after start time.'
  );
});

it('coalesces pointer updates and publishes the final position without changing the saved range', () => {
  const request = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockReturnValue(7);
  const cancel = jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation();
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 240,
    bottom: 34,
    width: 240,
    height: 34,
    toJSON: () => ({}),
  });
  render(<Fixture />);
  const handle = screen.getByRole('slider', { name: 'Clip In boundary' });
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 80 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 120 });
  expect(request).toHaveBeenCalledTimes(1);
  act(() => request.mock.calls[0][0](16));
  expect(screen.getByLabelText('In time')).toHaveValue('00:01:30');
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 140 });
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: 144 });
  expect(screen.getByLabelText('In time')).toHaveValue('00:01:48');
  expect(cancel).toHaveBeenCalledWith(7);
  expect(document.querySelector('.trim-saved')).toHaveStyle({
    left: '33.33333333333333%',
  });
});

it('keeps long elapsed times, invalid manual drafts and disabled controls honest', () => {
  const view = render(<Fixture start={90000} end={90060} />);
  const handle = screen.getByRole('slider', { name: 'Clip In boundary' });
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  expect(screen.getByLabelText('In time')).toHaveValue('24:59:59');
  fireEvent.change(screen.getByLabelText('Out time'), {
    target: { value: '00:01:00' },
  });
  expect(handle).toHaveAttribute('aria-invalid', 'true');
  view.rerender(<Fixture disabled start={90000} end={90060} />);
  expect(handle).toBeDisabled();
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(screen.getByLabelText('In time')).toHaveValue('24:59:59');
});

it('focuses a clicked handle without inventing a draft boundary', () => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 240,
    bottom: 34,
    width: 240,
    height: 34,
    toJSON: () => ({}),
  });
  render(<Fixture />);
  const handle = screen.getByRole('slider', { name: 'Clip In boundary' });
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 83 });
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: 83 });
  expect(handle).toHaveFocus();
  expect(screen.getByLabelText('In time')).toHaveValue('00:01:00');
  expect(
    screen.queryByText('· draft', { exact: false })
  ).not.toBeInTheDocument();
});
it('cancels a pending pointer update when the control unmounts', () => {
  jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(9);
  const cancel = jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation();
  const view = render(<Fixture />);
  const handle = screen.getByRole('slider', { name: 'Clip In boundary' });
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 80 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 120 });
  view.unmount();
  expect(cancel).toHaveBeenCalledWith(9);
});

it('keeps End within a fractional VOD duration using whole elapsed seconds', () => {
  const saved = vodMetadata();
  const change = jest.fn();
  render(
    <ClipRange
      saved={saved}
      draft={draftFor(saved)}
      onChange={change}
      disabled={false}
      duration={120.75}
    />
  );
  const handle = screen.getByRole('slider', { name: 'Clip Out boundary' });
  fireEvent.keyDown(handle, { key: 'End' });
  expect(handle).toHaveAttribute('aria-valuemax', '120');
  expect(change).toHaveBeenLastCalledWith({
    ...draftFor(saved),
    end: '00:02:00',
  });
});
