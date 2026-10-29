/* eslint no-await-in-loop: off, no-console: off */
const path = require('path');
const fs = require('fs/promises');
const { createHash, randomUUID } = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execute = promisify(execFile);
const root = path.resolve(__dirname, '../..');
const ytdlp = 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26';
const ffmpegMac =
  'https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2';
const ffmpegWin =
  'https://github.com/GyanD/codexffmpeg/releases/download/9.0.2/ffmpeg-9.0.2-essentials_build.zip';
const windowsHash =
  '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba';
const maxBytes = 256 * 1024 * 1024;
const artifacts = {
  'mac-arm64': [
    {
      name: 'yt-dlp',
      url: `${ytdlp}/yt-dlp_macos`,
      sha256:
        '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa',
    },
    {
      name: 'ffmpeg',
      url: `${ffmpegMac}/ffmpeg.zip`,
      sha256:
        'c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924',
      entry: 'ffmpeg',
    },
    {
      name: 'ffprobe',
      url: `${ffmpegMac}/ffprobe.zip`,
      sha256:
        'fcbe839537485eaee7a7a8bc5cbc0f90d53617e80943e8a5b2e31cb851197ea6',
      entry: 'ffprobe',
    },
  ],
  'win-x64': [
    {
      name: 'yt-dlp.exe',
      url: `${ytdlp}/yt-dlp.exe`,
      sha256:
        'f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d',
    },
    {
      name: 'ffmpeg.exe',
      url: ffmpegWin,
      sha256: windowsHash,
      entry: 'ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe',
    },
    {
      name: 'ffprobe.exe',
      url: ffmpegWin,
      sha256: windowsHash,
      entry: 'ffmpeg-9.0.2-essentials_build/bin/ffprobe.exe',
    },
  ],
};
const licenses = [
  {
    name: 'LICENSE-yt-dlp.txt',
    url: 'https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.10.26/LICENSE',
    sha256: '7e12e5df4bae12cb21581ba157ced20e1986a0508dd10d0e8a4ab9a4cf94e85c',
    license: true,
  },
  {
    name: 'LICENSE-FFmpeg-GPLv3.txt',
    url: 'https://raw.githubusercontent.com/FFmpeg/FFmpeg/n9.0.2/COPYING.GPLv3',
    sha256: '8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903',
    license: true,
  },
];

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function archiveFor(artifact) {
  const cache = path.join(root, 'native', '.cache');
  await fs.mkdir(cache, { recursive: true });
  const archive = path.join(cache, artifact.sha256);
  try {
    if ((await fs.stat(archive)).size > maxBytes) {
      throw new Error(
        `Native cache exceeds the size limit. Remove ${archive} and retry.`
      );
    }
    const bytes = await fs.readFile(archive);
    if (digest(bytes) !== artifact.sha256) {
      throw new Error(
        `Native cache checksum mismatch. Remove ${archive} and retry.`
      );
    }
    return archive;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  console.log(`Downloading pinned ${artifact.name}`);
  const response = await fetch(artifact.url, {
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok)
    throw new Error(
      `Native download failed: HTTP ${response.status} for ${artifact.url}`
    );
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new Error('Native artifact exceeds the download size limit.');
  }
  if (!response.body) throw new Error('Native download returned no body.');
  const chunks = [];
  let total = 0;
  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > maxBytes)
      throw new Error('Native artifact exceeds the download size limit.');
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks, total);
  if (digest(bytes) !== artifact.sha256) {
    throw new Error(`Native artifact checksum mismatch for ${artifact.name}.`);
  }
  const temporary = `${archive}.${randomUUID()}.download`;
  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx' });
    await fs.rename(temporary, archive);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return archive;
}

async function setupNativeTools(target) {
  if (!Object.hasOwn(artifacts, target)) {
    throw new Error(
      `No pinned native tools for ${target}. Supported targets: mac-arm64, win-x64.`
    );
  }
  const directory = path.join(root, 'native', target);
  await fs.mkdir(directory, { recursive: true });
  await fs.chmod(directory, 0o755);
  const selected = [...artifacts[target], ...licenses];
  for (let index = 0; index < selected.length; index += 1) {
    const artifact = selected[index];
    const archive = await archiveFor(artifact);
    const bytes = artifact.entry
      ? (
          await execute('tar', ['-xOf', archive, artifact.entry], {
            encoding: 'buffer',
            maxBuffer: maxBytes,
            timeout: 120000,
          })
        ).stdout
      : await fs.readFile(archive);
    if (!bytes.length)
      throw new Error(`Empty native artifact: ${artifact.name}`);
    const destination = path.join(directory, artifact.name);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, bytes, {
        flag: 'wx',
        mode: artifact.license ? 0o644 : 0o755,
      });
      await fs.chmod(temporary, artifact.license ? 0o644 : 0o755);
      await fs.rename(temporary, destination);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  await fs.copyFile(
    path.join(root, 'assets', 'native-tools-NOTICE.txt'),
    path.join(directory, 'NOTICE.txt')
  );
  console.log(`Verified pinned native tools for ${target}`);
  return directory;
}

function targetName(platform, arch) {
  return `${{ darwin: 'mac', win32: 'win' }[platform] || platform}-${arch}`;
}

exports.setupNativeTools = setupNativeTools;
exports.targetName = targetName;
exports.default = (context) => {
  const { Arch } = require('builder-util');
  return setupNativeTools(
    targetName(context.electronPlatformName, Arch[context.arch])
  );
};
if (require.main === module) {
  setupNativeTools(
    process.argv[2] || targetName(process.platform, process.arch)
  ).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
