import type { YouTubeSession } from './youtube';

export interface VideoFile {
  folderName: string;
  videoName: string;
}

export interface VideoUpload extends VideoFile, YouTubeSession {
  title: string;
  description: string;
  visibility: string;
}

export const MAX_VIDEO_TITLE_LENGTH = 100;

export function getVideoTitleError(title: unknown): string | null {
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    [...title].length > MAX_VIDEO_TITLE_LENGTH
  ) {
    return 'YouTube titles must contain 1 to 100 characters.';
  }
  if (/[<>]/.test(title)) return 'YouTube titles cannot contain < or >.';
  return null;
}
