import path from 'path';
import { constants, promises as fs } from 'fs';
import { SpawnOptions } from 'child_process';
import { create, Flags } from 'youtube-dl-exec';

const onExit: (callback: () => void) => () => void = require('signal-exit');

export interface NativeContext {
  packaged: boolean;
  built: boolean;
  appPath: string;
  resourcesPath: string;
  platform: NodeJS.Platform;
  arch: string;
}

export function nativeToolDirectory(context: NativeContext): string {
  let target: string;
  if (context.platform === 'darwin' && context.arch === 'arm64') {
    target = 'mac-arm64';
  } else if (context.platform === 'win32' && context.arch === 'x64') {
    target = 'win-x64';
  } else {
    throw new Error(
      'Native tools are supported for macOS arm64 and Windows x64.'
    );
  }
  if (context.packaged) return path.join(context.resourcesPath, 'bin');
  const root = context.built
    ? path.resolve(context.appPath, '../..')
    : context.appPath;
  return path.join(root, 'native', target);
}

export async function runYtDlp(
  url: string,
  flags: Flags,
  context: NativeContext,
  options?: SpawnOptions
): Promise<unknown> {
  const directory = nativeToolDirectory(context);
  const extension = context.platform === 'win32' ? '.exe' : '';
  const binaries = ['yt-dlp', 'ffmpeg', 'ffprobe'].map((name) =>
    path.join(directory, `${name}${extension}`)
  );
  try {
    await Promise.all(binaries.map((file) => fs.access(file, constants.X_OK)));
  } catch {
    throw new Error(
      'Native media tools are missing or not executable. Run npm run setup:desktop for development, or rebuild the app package.'
    );
  }
  const command = create(binaries[0]).exec(
    url,
    {
      ...flags,
      ffmpegLocation: directory,
      ignoreConfig: true,
      noUpdate: true,
      noPlaylist: true,
    },
    { windowsHide: true, ...options }
  );
  const removeCleanup = onExit(() => {
    command.kill();
  });
  try {
    const result = await command;
    return result.stdout.startsWith('{')
      ? JSON.parse(result.stdout)
      : result.stdout;
  } catch (error) {
    const stderr: unknown =
      error && typeof error === 'object'
        ? Object.getOwnPropertyDescriptor(error, 'stderr')?.value
        : undefined;
    if (typeof stderr === 'string' && stderr.trim()) {
      throw new Error(stderr.trim());
    }
    throw error;
  } finally {
    removeCleanup();
  }
}
