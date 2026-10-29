export function getClipRangeError(
  startTime: unknown,
  endTime: unknown
): string | null {
  if (
    typeof startTime !== 'number' ||
    typeof endTime !== 'number' ||
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime)
  ) {
    return 'Enter valid start and end times.';
  }
  if (startTime < 0 || endTime < 0) {
    return 'Times must be zero or greater.';
  }
  if (endTime <= startTime) {
    return 'End time must be after start time.';
  }
  return null;
}

export function formatClipTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '';
  const absolute = Math.floor(Math.abs(seconds));
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const remainder = absolute % 60;
  const time = [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
  return seconds < 0 ? `-${time}` : time;
}

export function parseClipTime(value: string): number | null {
  const match = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const seconds =
    Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Number.isFinite(seconds) ? seconds : null;
}
