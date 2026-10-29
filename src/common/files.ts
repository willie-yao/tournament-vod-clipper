export interface VideoFile {
  folderName: string;
  videoName: string;
}

export interface VideoUpload extends VideoFile {
  title: string;
  description: string;
  visibility: string;
  accessToken: string;
}

export function getVideoTitleError(title: unknown): string | null {
  if (typeof title !== 'string' || !title.trim() || [...title].length > 100) {
    return 'YouTube titles must contain 1 to 100 characters.';
  }
  if (/[<>]/.test(title)) return 'YouTube titles cannot contain < or >.';
  return null;
}
