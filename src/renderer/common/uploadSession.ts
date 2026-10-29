import { getVideoTitleError } from '../../common/files';
import type { ElectronHandler } from '../../main/preload';

export interface UploadItem {
  videoName: string;
  title: string;
  videoId?: string;
  thumbnailDone: boolean;
  thumbnailSkipped: boolean;
  playlistDone: boolean;
  error: string;
}

export interface UploadSession {
  playlistId?: string;
  metadata?: { description: string; visibility: string };
  items: UploadItem[];
}

type UploadAPI = Pick<
  ElectronHandler['ipcRenderer'],
  | 'createPlaylist'
  | 'uploadSingleVideo'
  | 'uploadThumbnail'
  | 'addVideoToPlaylist'
>;

interface Options {
  folderName: string;
  description: string;
  visibility: string;
  accessToken: string;
}

function confirmedId(response: { id: string }): string {
  if (!response || typeof response.id !== 'string' || !response.id) {
    throw new Error(
      'YouTube did not confirm an ID. Check your channel and playlist before retrying.'
    );
  }
  return response.id;
}

export function uploadComplete(item: UploadItem): boolean {
  return Boolean(item.videoId) && item.thumbnailDone && item.playlistDone;
}

/** Retry only unfinished steps; a confirmed video ID is never uploaded again. */
export async function uploadSession(
  session: UploadSession,
  options: Options,
  api: UploadAPI,
  report: () => void
): Promise<void> {
  session.items.forEach((item) => {
    const error = !item.videoId && getVideoTitleError(item.title);
    if (error) throw new Error(`${item.videoName}: ${error}`);
  });
  if (!session.playlistId) {
    session.playlistId = confirmedId(
      await api.createPlaylist({
        playlistName: options.folderName,
        ...options,
      })
    );
    session.metadata = {
      description: options.description,
      visibility: options.visibility,
    };
    report();
  }
  const uploadOptions = { ...options, ...session.metadata };

  for (let index = 0; index < session.items.length; index += 1) {
    const item = session.items[index];
    const errors: string[] = [];
    item.error = '';
    try {
      if (!item.videoId) {
        item.videoId = confirmedId(
          // eslint-disable-next-line no-await-in-loop
          await api.uploadSingleVideo({
            ...uploadOptions,
            videoName: item.videoName,
            title: item.title,
          })
        );
        report();
      }
    } catch (error) {
      item.error = `Video upload not confirmed: ${
        error instanceof Error ? error.message : String(error)
      } Check your channel before retrying.`;
      report();
    }

    if (item.videoId) {
      if (!item.thumbnailDone) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const result = await api.uploadThumbnail({
            ...options,
            videoName: item.videoName,
            videoId: item.videoId,
          });
          if (result?.status !== 'uploaded' && result?.status !== 'skipped') {
            throw new Error('Thumbnail upload was not confirmed.');
          }
          item.thumbnailDone = true;
          item.thumbnailSkipped = result.status === 'skipped';
        } catch (error) {
          errors.push(
            `Thumbnail: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      if (!item.playlistDone) {
        try {
          confirmedId(
            // eslint-disable-next-line no-await-in-loop
            await api.addVideoToPlaylist({
              playlistId: session.playlistId,
              videoId: item.videoId,
              accessToken: options.accessToken,
            })
          );
          item.playlistDone = true;
        } catch (error) {
          errors.push(
            `Playlist: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      item.error = errors.join(' ');
      report();
    }
  }
}
