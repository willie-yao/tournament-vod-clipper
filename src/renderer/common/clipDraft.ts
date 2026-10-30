import {
  formatClipTime,
  getClipRangeError,
  parseClipTime,
} from '../../common/clipTime';
import { getVideoTitleError } from '../../common/files';
import { VODMetadata } from './tournamentSets';

export interface ClipDraft {
  start: string;
  end: string;
  title: string;
}

export function draftFor(set: VODMetadata): ClipDraft {
  return {
    start: formatClipTime(set.startTime),
    end: formatClipTime(set.endTime),
    title: set.title,
  };
}

export function draftChanged(set: VODMetadata, draft: ClipDraft) {
  const saved = draftFor(set);
  return (
    saved.start !== draft.start ||
    saved.end !== draft.end ||
    saved.title !== draft.title
  );
}

export function draftError(draft: ClipDraft, duration?: number) {
  const start = parseClipTime(draft.start);
  const end = parseClipTime(draft.end);
  if (!draft.start.trim())
    return 'An In time is missing. Enter it or use the playhead.';
  if (!draft.end.trim())
    return 'An Out time is missing. Enter it or use the playhead.';
  return (
    getClipRangeError(start, end) ||
    (duration && end !== null && end > duration
      ? 'Out is beyond the VOD duration.'
      : null) ||
    getVideoTitleError(draft.title)
  );
}
