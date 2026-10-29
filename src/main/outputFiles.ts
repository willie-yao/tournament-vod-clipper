import path from 'path';
import { constants, promises as fs } from 'fs';
import { VideoFile } from '../common/files';

function isMissing(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

export function safeName(value: string): string {
  if (typeof value !== 'string') throw new Error('Invalid output name.');
  const name = value
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '#')
    .replace(/^[. ]+|[. ]+$/g, '');
  if (!name) throw new Error('Output names cannot be empty or just dots.');
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    ? `_${name}`
    : name;
}

export function containedPath(root: string, ...parts: string[]): string {
  const result = path.resolve(root, ...parts);
  const relative = path.relative(root, result);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('The requested file is outside the output directory.');
  }
  return result;
}

async function existing(root: string, file: string): Promise<string | null> {
  try {
    const real = await fs.realpath(file);
    containedPath(root, path.relative(root, real));
    return real;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

function component(value: string): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value === '.' ||
    value === '..' ||
    path.basename(value) !== value
  ) {
    throw new Error('Invalid output folder or file name.');
  }
  return value;
}

async function directory(root: string, name: string): Promise<string> {
  const folder = containedPath(root, component(name));
  await fs.mkdir(folder, { recursive: true });
  const real = await fs.realpath(folder);
  containedPath(root, path.relative(root, real));
  if (path.dirname(real) !== root) {
    throw new Error(
      'Output must be a direct folder within its parent directory.'
    );
  }
  return real;
}

/** Own output paths without renaming or overwriting existing user files. */
export default class OutputFiles {
  constructor(private readonly rootPath: () => string) {}

  async root(writable = false): Promise<string> {
    const root = path.resolve(this.rootPath());
    await fs.mkdir(root, { recursive: true });
    const real = await fs.realpath(root);
    if (writable) await fs.access(real, constants.W_OK);
    return real;
  }

  async tournament(name: string, writable = false): Promise<string> {
    const root = await this.root(writable);
    if (
      typeof name === 'string' &&
      name &&
      !name.includes('\0') &&
      name !== '.' &&
      name !== '..' &&
      path.basename(name) === name &&
      (process.platform !== 'win32' || safeName(name) === name)
    ) {
      const found = await existing(root, containedPath(root, name));
      if (found && (await fs.stat(found)).isDirectory()) {
        return writable ? directory(root, name) : found;
      }
    }
    const normalized = safeName(name);
    if (writable) return directory(root, normalized);
    const found = await existing(root, containedPath(root, normalized));
    if (!found || !(await fs.stat(found)).isDirectory()) {
      throw new Error('The output folder no longer exists.');
    }
    return found;
  }

  async folders(): Promise<string[]> {
    const root = await this.root();
    return (await fs.readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }

  async videos(folderName: string): Promise<string[]> {
    const root = await this.root();
    const folder = await existing(
      root,
      containedPath(root, component(folderName))
    );
    if (!folder)
      throw new Error('The selected output folder no longer exists.');
    return (await fs.readdir(folder, { withFileTypes: true }))
      .filter(
        (entry) =>
          entry.isFile() && path.extname(entry.name).toLowerCase() === '.mp4'
      )
      .map((entry) => entry.name)
      .sort();
  }

  async video(folderName: string, videoName: string): Promise<string> {
    const root = await this.root();
    const file = containedPath(
      root,
      component(folderName),
      component(videoName)
    );
    const real = await existing(root, file);
    const info = real ? await fs.stat(real) : null;
    if (!real || !info?.isFile() || info.size === 0) {
      throw new Error('The selected video is missing or empty.');
    }
    return real;
  }

  async target(
    tournamentName: string,
    title: string
  ): Promise<VideoFile & { path: string }> {
    const folder = await this.tournament(tournamentName, true);
    const videoName = `${safeName(title)}.mp4`;
    const file = containedPath(folder, videoName);
    const occupied = await Promise.all(
      [file, `${file}.part`].map(async (candidate) => {
        try {
          await fs.lstat(candidate);
          return true;
        } catch (error) {
          if (isMissing(error)) return false;
          throw error;
        }
      })
    );
    if (occupied.some(Boolean)) {
      throw new Error(
        'A clip or partial download with this name already exists. Choose a different title to keep the existing file.'
      );
    }
    return { folderName: path.basename(folder), videoName, path: file };
  }

  async saveThumbnail(file: VideoFile, buffer: Uint8Array): Promise<void> {
    const root = await this.root(true);
    const folder = await existing(
      root,
      containedPath(root, component(file.folderName))
    );
    if (!folder) throw new Error('The video output folder no longer exists.');
    const thumbnails = await directory(folder, 'thumbnails');
    const name = `${path.parse(component(file.videoName)).name}.jpg`;
    await fs.writeFile(containedPath(thumbnails, name), buffer, { flag: 'wx' });
  }

  async thumbnail(file: VideoFile): Promise<string | null> {
    const root = await this.root();
    const folder = component(file.folderName);
    const base = path.parse(component(file.videoName)).name;
    const candidates = [
      containedPath(root, folder, 'thumbnails', `${base}.jpg`),
      containedPath(
        root,
        folder.replace(':', '#'),
        'thumbnails',
        `${base.replace(':', '#')}.jpg`
      ),
    ];
    const found = await Promise.all(
      candidates.map((candidate) => existing(root, candidate))
    );
    return found.find((candidate) => candidate !== null) ?? null;
  }
}
