import type {
  BatchFilter,
  DownloadResult,
  SetsState,
  Workspace,
} from '../pages/SetsView';
import type { ClipDraft } from './clipDraft';
import type { VODMetadata } from './tournamentSets';

export interface HeldBatch {
  source: SetsState;
  sets: VODMetadata[];
  drafts: Record<string, ClipDraft>;
  workspace: Workspace;
  filter: BatchFilter;
  search: string;
  results: Record<string, DownloadResult>;
  downloadThumbnails: boolean;
  thumbnailColor: string;
  thumbnailRightColor: string;
  thumbnailLogo: string;
  thumbnailBg: string;
}

// The batch survives navigation in memory, but is never written to disk.
let held: HeldBatch | undefined;

export function heldBatch() {
  return held;
}

function revokeImages(batch: HeldBatch, keep?: HeldBatch) {
  [batch.thumbnailLogo, batch.thumbnailBg].forEach((url) => {
    if (url && url !== keep?.thumbnailLogo && url !== keep?.thumbnailBg)
      URL.revokeObjectURL(url);
  });
}

export function holdBatch(batch: HeldBatch) {
  if (held && held.source !== batch.source) revokeImages(held, batch);
  held = batch;
}

export function releaseHeldBatch() {
  if (held) revokeImages(held);
  held = undefined;
}

// Held download results describe files in the previous output folder.
export function forgetHeldDownloads() {
  if (held) held = { ...held, results: {} };
}
