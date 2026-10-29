import {
  formatClipTime,
  getClipRangeError,
  parseClipTime,
} from '../common/clipTime';

describe('elapsed clip times', () => {
  it.each([
    [0, '00:00:00'],
    [3661, '01:01:01'],
    [90000, '25:00:00'],
  ])('round-trips %s seconds without date wrapping', (seconds, text) => {
    expect(formatClipTime(Number(seconds))).toBe(text);
    expect(parseClipTime(String(text))).toBe(seconds);
  });

  it('does not turn a negative offset into a valid late-night time', () => {
    expect(formatClipTime(-60)).toBe('-00:01:00');
    expect(parseClipTime('-00:01:00')).toBeNull();
  });

  it.each(['', 'NaN', 'Infinity', '01:60:00', '01:00:60', '-1:00:00'])(
    'rejects invalid duration %s',
    (value) => expect(parseClipTime(value)).toBeNull()
  );

  it.each<[unknown, unknown]>([
    [null, 60],
    [0, null],
    [undefined, 60],
    [NaN, 60],
    [0, Infinity],
    [-1, 60],
    [0, -1],
    [60, 0],
    [60, 60],
    ['00:00:00', '00:01:00'],
  ])('rejects invalid boundaries %s, %s', (start, end) => {
    expect(getClipRangeError(start, end)).not.toBeNull();
  });

  it('accepts zero and 25-hour boundaries', () => {
    expect(getClipRangeError(0, 60)).toBeNull();
    expect(getClipRangeError(90000, 90060)).toBeNull();
    expect(formatClipTime(null)).toBe('');
    expect(formatClipTime(Infinity)).toBe('');
  });
});
