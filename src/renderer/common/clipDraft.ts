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
  player1: string;
  player2: string;
  character1: string;
  character2: string;
  roundText: string;
}

export function draftFor(set: VODMetadata): ClipDraft {
  return {
    start: formatClipTime(set.startTime),
    end: formatClipTime(set.endTime),
    title: set.title,
    player1: set.player1,
    player2: set.player2,
    character1: set.character1,
    character2: set.character2,
    roundText: set.roundText || '',
  };
}

export function draftChanged(set: VODMetadata, draft: ClipDraft) {
  const saved = draftFor(set);
  return (Object.keys(saved) as (keyof ClipDraft)[]).some(
    (key) => saved[key] !== draft[key]
  );
}

export function thumbnailDraftError(draft: ClipDraft) {
  return draft.player1.trim() && draft.player2.trim()
    ? null
    : 'Enter both player names for the thumbnail.';
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
