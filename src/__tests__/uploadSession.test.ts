import { getVideoTitleError } from '../common/files';
import {
  UploadSession,
  uploadSession,
  uploadComplete,
} from '../renderer/common/uploadSession';

const options = {
  folderName: 'Tournament',
  description: 'description',
  visibility: 'private',
  accessToken: 'test-token',
};
const createSession = (): UploadSession => ({
  items: ['one.mp4', 'two.mp4'].map((videoName) => ({
    videoName,
    title: videoName.slice(0, -4),
    thumbnailDone: false,
    thumbnailSkipped: false,
    playlistDone: false,
    error: '',
  })),
});
const createAPI = () => ({
  createPlaylist: jest.fn().mockResolvedValue({ id: 'playlist' }),
  uploadSingleVideo: jest
    .fn()
    .mockImplementation(async ({ videoName }: { videoName: string }) => ({
      id: videoName,
    })),
  uploadThumbnail: jest.fn().mockResolvedValue({ status: 'uploaded' }),
  addVideoToPlaylist: jest.fn().mockResolvedValue({ id: 'membership' }),
});

it('validates every title before any request', async () => {
  const session = createSession();
  const api = createAPI();
  session.items[1].title = 'x'.repeat(101);
  await expect(uploadSession(session, options, api, jest.fn())).rejects.toThrow(
    '1 to 100'
  );
  expect(api.createPlaylist).not.toHaveBeenCalled();
  expect(api.uploadSingleVideo).not.toHaveBeenCalled();
  expect(getVideoTitleError('')).not.toBeNull();
  expect(getVideoTitleError('<invalid>')).not.toBeNull();
  expect(getVideoTitleError('x'.repeat(100))).toBeNull();
});

it('serializes video and follow-up requests before beginning the next item', async () => {
  const session = createSession();
  const api = createAPI();
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  api.uploadSingleVideo.mockImplementationOnce(async () => {
    entered();
    await gate;
    return { id: 'one' };
  });
  const pending = uploadSession(session, options, api, jest.fn());
  await started;
  expect(api.uploadSingleVideo).toHaveBeenCalledTimes(1);
  expect(api.uploadThumbnail).not.toHaveBeenCalled();
  release();
  await pending;
  expect(session.items.every(uploadComplete)).toBe(true);
  expect(api.uploadThumbnail.mock.invocationCallOrder[0]).toBeLessThan(
    api.uploadSingleVideo.mock.invocationCallOrder[1]
  );
  expect(api.addVideoToPlaylist.mock.invocationCallOrder[0]).toBeLessThan(
    api.uploadSingleVideo.mock.invocationCallOrder[1]
  );
});

it('does not upload videos after playlist creation fails and permits a manual retry', async () => {
  const session = createSession();
  const api = createAPI();
  api.createPlaylist.mockRejectedValueOnce(new Error('test playlist rejected'));
  await expect(uploadSession(session, options, api, jest.fn())).rejects.toThrow(
    'test playlist rejected'
  );
  expect(api.uploadSingleVideo).not.toHaveBeenCalled();
  await uploadSession(session, options, api, jest.fn());
  expect(session.items.every(uploadComplete)).toBe(true);
});

it.each([
  'uploadSingleVideo',
  'uploadThumbnail',
  'addVideoToPlaylist',
] as const)(
  'retains successes and retries only unfinished steps after %s fails',
  async (stage) => {
    const session = createSession();
    const api = createAPI();
    api[stage].mockRejectedValueOnce(new Error('test stage failure'));
    await uploadSession(session, options, api, jest.fn());
    expect(session.items[0].error).toContain('test stage failure');
    expect(uploadComplete(session.items[1])).toBe(true);
    const ids = session.items.map((item) => item.videoId);
    await uploadSession(
      session,
      { ...options, accessToken: 'new-test-token' },
      api,
      jest.fn()
    );
    expect(session.items.every(uploadComplete)).toBe(true);
    expect(api.uploadSingleVideo).toHaveBeenCalledTimes(
      stage === 'uploadSingleVideo' ? 3 : 2
    );
    expect(session.items[1].videoId).toBe(ids[1]);
    expect(api.createPlaylist).toHaveBeenCalledTimes(1);
  }
);

it('does not treat absent IDs as success and marks missing optional thumbnails as skipped', async () => {
  const session = createSession();
  const api = createAPI();
  api.uploadSingleVideo.mockResolvedValueOnce({ id: '' });
  api.uploadThumbnail.mockResolvedValue({ status: 'skipped' });
  await uploadSession(session, options, api, jest.fn());
  expect(session.items[0].videoId).toBeUndefined();
  expect(session.items[0].error).toContain('not confirm');
  expect(session.items[1].thumbnailSkipped).toBe(true);
  expect(uploadComplete(session.items[1])).toBe(true);
});
