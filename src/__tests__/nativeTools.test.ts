/** @jest-environment node */
import path from 'path';
import { promises as fs } from 'fs';
import { create } from 'youtube-dl-exec';
import {
  NativeContext,
  nativeToolDirectory,
  runYtDlp,
} from '../main/nativeTools';

jest.mock('youtube-dl-exec', () => ({ create: jest.fn() }));
jest.mock('signal-exit', () => jest.fn(() => jest.fn()));
const onExit = jest.requireMock('signal-exit');
const context: NativeContext = {
  packaged: false,
  built: false,
  appPath: '/project',
  resourcesPath: '/resources',
  platform: 'darwin',
  arch: 'arm64',
};
afterEach(() => jest.restoreAllMocks());

it('resolves source, built and packaged native directories without relying on cwd', () => {
  expect(nativeToolDirectory(context)).toBe(
    path.join('/project', 'native', 'mac-arm64')
  );
  expect(
    nativeToolDirectory({
      ...context,
      built: true,
      appPath: '/project/release/app',
    })
  ).toBe(path.join('/project', 'native', 'mac-arm64'));
  expect(nativeToolDirectory({ ...context, packaged: true })).toBe(
    path.join('/resources', 'bin')
  );
  expect(
    nativeToolDirectory({ ...context, platform: 'win32', arch: 'x64' })
  ).toBe(path.join('/project', 'native', 'win-x64'));
  expect(() => nativeToolDirectory({ ...context, platform: 'linux' })).toThrow(
    'supported'
  );
});

it('uses the pinned executable and explicit FFmpeg directory, ignoring user downloader configuration', async () => {
  jest.spyOn(fs, 'access').mockResolvedValue(undefined);
  const child = Object.assign(
    Promise.resolve({ stdout: '{"timestamp":1000}' }),
    { kill: jest.fn() }
  );
  const command = Object.assign(jest.fn(), {
    exec: jest.fn().mockReturnValue(child),
  });
  jest.mocked(create).mockReturnValue(command);
  const result = await runYtDlp(
    'https://example.test/video',
    { dumpSingleJson: true },
    context,
    { timeout: 12345 }
  );
  expect(result).toEqual({ timestamp: 1000 });
  expect(create).toHaveBeenCalledWith(
    path.join('/project', 'native', 'mac-arm64', 'yt-dlp')
  );
  expect(command.exec).toHaveBeenCalledWith(
    'https://example.test/video',
    expect.objectContaining({
      dumpSingleJson: true,
      ffmpegLocation: path.join('/project', 'native', 'mac-arm64'),
      ignoreConfig: true,
      noUpdate: true,
      noPlaylist: true,
    }),
    { windowsHide: true, timeout: 12345 }
  );
});

it.each([false, true])(
  'kills pending native work on parent exit and removes cleanup after rejection=%s',
  async (shouldReject) => {
    jest.spyOn(fs, 'access').mockResolvedValue(undefined);
    let settle!: (result: { stdout: string }) => void;
    let fail!: (error: Error) => void;
    const child = Object.assign(
      new Promise<{ stdout: string }>((resolve, reject) => {
        settle = resolve;
        fail = reject;
      }),
      { kill: jest.fn() }
    );
    const command = Object.assign(jest.fn(), {
      exec: jest.fn().mockReturnValue(child),
    });
    jest.mocked(create).mockReturnValue(command);
    let registered!: () => void;
    const registration = new Promise<void>((resolve) => {
      registered = resolve;
    });
    let cleanup!: () => void;
    const remove = jest.fn();
    onExit.mockImplementationOnce((callback: () => void) => {
      cleanup = callback;
      registered();
      return remove;
    });
    const result = runYtDlp('https://example.test/video', {}, context);
    const outcome = result.then(
      (value) => ({ ok: true, value }),
      (error: Error) => ({ ok: false, message: error.message })
    );
    await registration;
    cleanup();
    expect(child.kill).toHaveBeenCalledTimes(1);
    if (shouldReject) {
      fail(new Error('fixture command failed'));
    } else {
      settle({ stdout: 'plain output' });
    }
    expect(await outcome).toEqual(
      shouldReject
        ? { ok: false, message: 'fixture command failed' }
        : { ok: true, value: 'plain output' }
    );
    expect(remove).toHaveBeenCalledTimes(1);
  }
);

it('fails explicitly before spawning if native tools are unavailable', async () => {
  jest
    .spyOn(fs, 'access')
    .mockRejectedValue(new Error('missing fixture binary'));
  jest.mocked(create).mockClear();
  await expect(
    runYtDlp('https://example.test/video', {}, context)
  ).rejects.toThrow('setup:desktop');
  expect(create).not.toHaveBeenCalled();
});

it('preserves downloader stderr as the useful rejection message', async () => {
  jest.spyOn(fs, 'access').mockResolvedValue(undefined);
  const failure = Object.assign(new Error('generic process exit status'), {
    stderr: 'fixture command failed\n',
  });
  const command = Object.assign(jest.fn(), {
    exec: jest
      .fn()
      .mockImplementation(() =>
        Object.assign(Promise.reject(failure), { kill: jest.fn() })
      ),
  });
  jest.mocked(create).mockReturnValue(command);
  await expect(
    runYtDlp('https://example.test/video', {}, context)
  ).rejects.toThrow('fixture command failed');
});
