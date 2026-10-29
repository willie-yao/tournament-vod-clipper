/** @jest-environment node */
import path from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';
import OutputFiles, { containedPath, safeName } from '../main/outputFiles';

let scratch: string;
let root: string;
let files: OutputFiles;
beforeEach(async () => {
  scratch = await fs.mkdtemp(path.join(tmpdir(), 'vod-clipper-test-'));
  root = path.join(scratch, 'output');
  files = new OutputFiles(() => root);
  root = await files.root(true);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await fs.rm(scratch, { recursive: true, force: true });
});

it('uses one safe name for video, thumbnail and folder paths', async () => {
  const tournament = 'A: B: C/D?';
  const title = 'Player: A: B/C?*|"<>  ';
  const target = await files.target(tournament, title);
  expect(target.folderName).toBe(safeName(tournament));
  expect(target.videoName).toBe(`${safeName(title)}.mp4`);
  expect(target.videoName).not.toMatch(/[<>:"/\\|?*]/);
  await fs.writeFile(target.path, 'existing video');
  await files.saveThumbnail(target, Buffer.from('existing thumbnail'));
  expect(await files.video(target.folderName, target.videoName)).toBe(
    target.path
  );
  expect(await files.thumbnail(target)).toBe(
    path.join(root, target.folderName, 'thumbnails', `${safeName(title)}.jpg`)
  );
  expect(await files.videos(target.folderName)).toEqual([target.videoName]);
  expect(await files.tournament(tournament)).toBe(path.dirname(target.path));
  await expect(files.target(tournament, title)).rejects.toThrow(
    'already exists'
  );
  await expect(
    files.saveThumbnail(target, Buffer.from('replacement'))
  ).rejects.toMatchObject({ code: 'EEXIST' });
  expect(await fs.readFile(target.path, 'utf8')).toBe('existing video');
  const thumbnail = await files.thumbnail(target);
  if (!thumbnail) throw new Error('Missing fixture thumbnail.');
  expect(await fs.readFile(thumbnail, 'utf8')).toBe('existing thumbnail');
});

it('contains traversal names and rejects escaped reads and symlink writes', async () => {
  expect(() => containedPath(root, '..', 'outside')).toThrow('outside');
  const target = await files.target('../../outside', 'A/B');
  expect(path.relative(root, target.path).startsWith('..')).toBe(false);
  await expect(files.video('../outside', 'clip.mp4')).rejects.toThrow();
  await expect(files.video(target.folderName, '../clip.mp4')).rejects.toThrow();
  const outside = path.join(scratch, 'outside');
  await fs.mkdir(outside);
  await fs.symlink(outside, path.join(root, 'linked'), 'dir');
  await expect(files.target('linked', 'clip')).rejects.toThrow('outside');
  expect(await fs.readdir(outside)).toEqual([]);
  await fs.symlink(root, path.join(root, 'self'), 'dir');
  await expect(files.target('self', 'clip')).rejects.toThrow('direct folder');
});

it('does not create a missing tournament folder during a read-only open request', async () => {
  await expect(files.tournament('missing')).rejects.toThrow('no longer exists');
  expect(await fs.readdir(root)).not.toContain('missing');
});

it('preserves partial downloads instead of resuming or replacing them silently', async () => {
  const target = await files.target('Tournament', 'clip');
  await fs.writeFile(`${target.path}.part`, 'partial user data');
  await expect(files.target('Tournament', 'clip')).rejects.toThrow(
    'partial download'
  );
  expect(await fs.readFile(`${target.path}.part`, 'utf8')).toBe(
    'partial user data'
  );
});

it.each(['Nul\0Tournament', 'A: B: C', 'CON'])(
  'normalizes new tournament name %s before creating output',
  async (name) => {
    const target = await files.target(name, 'clip');
    expect(target.folderName).toBe(safeName(name));
  }
);

if (process.platform !== 'win32') {
  it('reads legacy names and the old colon-replaced thumbnail location without migration', async () => {
    const folder = 'League: Finals';
    const videoName = 'A: B: C.mp4';
    await fs.mkdir(path.join(root, folder));
    await fs.writeFile(path.join(root, folder, videoName), 'legacy video');
    const thumbnails = path.join(root, folder.replace(':', '#'), 'thumbnails');
    await fs.mkdir(thumbnails, { recursive: true });
    const legacyImage = path.join(thumbnails, 'A# B: C.jpg');
    await fs.writeFile(legacyImage, 'legacy thumbnail');
    expect(await files.folders()).toContain(folder);
    expect(await files.videos(folder)).toEqual([videoName]);
    expect(await files.thumbnail({ folderName: folder, videoName })).toBe(
      legacyImage
    );
    expect((await files.target(folder, 'new: clip')).folderName).toBe(folder);
    expect(await fs.readFile(path.join(root, folder, videoName), 'utf8')).toBe(
      'legacy video'
    );
  });
}

it('waits for mkdir and write completion and propagates a failed write', async () => {
  await fs.mkdir(path.join(root, 'Tournament'));
  let releaseMkdir!: () => void;
  let enteredMkdir!: () => void;
  const entered = new Promise<void>((resolve) => {
    enteredMkdir = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    releaseMkdir = resolve;
  });
  jest.spyOn(fs, 'mkdir').mockImplementationOnce(async () => {
    enteredMkdir();
    await gate;
    return undefined;
  });
  let done = false;
  const pending = files
    .saveThumbnail(
      { folderName: 'Tournament', videoName: 'clip.mp4' },
      Buffer.from('image')
    )
    .then(() => {
      done = true;
      return undefined;
    });
  await entered;
  expect(done).toBe(false);
  releaseMkdir();
  await pending;
  expect(done).toBe(true);

  let releaseWrite!: () => void;
  let enteredWrite!: () => void;
  const writing = new Promise<void>((resolve) => {
    enteredWrite = resolve;
  });
  const writeGate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  jest.spyOn(fs, 'writeFile').mockImplementationOnce(async () => {
    enteredWrite();
    await writeGate;
  });
  done = false;
  const writingPromise = files
    .saveThumbnail(
      { folderName: 'Tournament', videoName: 'next.mp4' },
      Buffer.from('image')
    )
    .then(() => {
      done = true;
      return undefined;
    });
  await writing;
  expect(done).toBe(false);
  releaseWrite();
  await writingPromise;
  jest.mocked(fs.writeFile).mockRejectedValueOnce(new Error('test disk full'));
  await expect(
    files.saveThumbnail(
      { folderName: 'Tournament', videoName: 'failed.mp4' },
      Buffer.from('image')
    )
  ).rejects.toThrow('test disk full');
});

it('reports an unwritable root and treats missing thumbnails explicitly', async () => {
  jest
    .spyOn(fs, 'access')
    .mockRejectedValueOnce(new Error('test root not writable'));
  await expect(files.root(true)).rejects.toThrow('test root not writable');
  expect(
    await files.thumbnail({ folderName: 'Tournament', videoName: 'clip.mp4' })
  ).toBeNull();
});
