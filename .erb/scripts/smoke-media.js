/* eslint no-console: off */
require('ts-node/register/transpile-only');
const path = require('path');
const fs = require('fs/promises');
const { createReadStream } = require('fs');
const http = require('http');
const { tmpdir } = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { setupNativeTools, targetName } = require('./native-tools');
const { runYtDlp } = require('../../src/main/nativeTools');
const { getClipRangeError } = require('../../src/common/clipTime');
const OutputFiles = require('../../src/main/outputFiles').default;

const execute = promisify(execFile);

async function smoke() {
  const directory = await setupNativeTools(
    targetName(process.platform, process.arch)
  );
  const extension = process.platform === 'win32' ? '.exe' : '';
  const ffmpeg = path.join(directory, `ffmpeg${extension}`);
  const ffprobe = path.join(directory, `ffprobe${extension}`);
  const commands = [
    [path.join(directory, `yt-dlp${extension}`), ['--version']],
    [ffmpeg, ['-version']],
    [ffprobe, ['-version']],
  ];
  for (let index = 0; index < commands.length; index += 1) {
    const [binary, args] = commands[index];
    // eslint-disable-next-line no-await-in-loop
    const result = await execute(binary, args, { timeout: 60000 });
    console.log(result.stdout.split('\n')[0]);
  }
  const scratch = await fs.mkdtemp(path.join(tmpdir(), 'vod-clipper-smoke-'));
  const source = path.join(scratch, 'source.mp4');
  const server = http.createServer(async (request, response) => {
    if (request.url !== '/source.mp4') {
      response.writeHead(404).end();
      return;
    }
    const { size } = await fs.stat(source);
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '');
    const start = range ? Number(range[1]) : 0;
    const end =
      range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      response.writeHead(416).end();
      return;
    }
    response.writeHead(range ? 206 : 200, {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(source, { start, end })
      .on('error', () => response.destroy())
      .pipe(response);
  });
  try {
    await execute(
      ffmpeg,
      [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=160x90:rate=10',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=1000:sample_rate=44100',
        '-t',
        '5',
        '-c:v',
        'libx264',
        '-g',
        '10',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        source,
      ],
      { timeout: 60000 }
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const startTime = 1;
    const endTime = 3;
    const error = getClipRangeError(startTime, endTime);
    if (error) throw new Error(error);
    const files = new OutputFiles(() => path.join(scratch, 'output'));
    const target = await files.target('Synthetic: smoke', 'Local: clip');
    await runYtDlp(
      `http://127.0.0.1:${address.port}/source.mp4`,
      {
        downloadSections: `*${startTime}-${endTime}`,
        output: target.path.replace(/%/g, '%%'),
        noOverwrites: true,
      },
      {
        packaged: false,
        built: false,
        appPath: path.resolve(__dirname, '../..'),
        resourcesPath: '',
        platform: process.platform,
        arch: process.arch,
      },
      { timeout: 60000 }
    );
    const file = await files.video(target.folderName, target.videoName);
    const result = await execute(
      ffprobe,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file],
      { timeout: 60000 }
    );
    const duration = Number(JSON.parse(result.stdout).format.duration);
    if (
      !Number.isFinite(duration) ||
      Math.abs(duration - (endTime - startTime)) > 0.3
    ) {
      throw new Error(
        `Synthetic clip duration ${duration}s differs from the requested interval.`
      );
    }
    console.log(
      `Synthetic HTTP clip passed: ${duration.toFixed(
        3
      )}s; real path ownership and elapsed-time validation retained.`
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(scratch, { recursive: true, force: true });
  }
}
smoke().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
