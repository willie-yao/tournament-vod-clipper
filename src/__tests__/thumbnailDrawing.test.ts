import {
  exportThumbnail,
  fitThumbnailText,
  renderThumbnail,
  thumbnailPortraitPlacement,
} from '../renderer/common/thumbnailDrawing';

jest.mock('../renderer/common/thumbnailPortraits', () => ({
  getThumbnailPortrait: (name: string) =>
    !name || ['Random Character', 'Unlisted'].includes(name)
      ? null
      : {
          name,
          source: `/${name}.png`,
          eyeX: 0.4,
          eyeY: 0.25,
          width: 850,
        },
}));

const content = {
  player1: 'Orbit',
  player2: 'Mica',
  character1: 'Lucina',
  character2: 'Fox',
  tournamentName: 'Harbor Weekly #42',
  eventName: 'Ultimate Singles',
  roundText: 'Winners Final',
};
const style = { color: '#223d55', logo: '', background: '' };
const fillText = jest.fn();
const drawImage = jest.fn();
const scale = jest.fn();
const fontLoad = jest.fn();
const decode = jest.fn();
let encode: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fontLoad.mockResolvedValue([{}]);
  decode.mockResolvedValue(undefined);
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: fontLoad, ready: Promise.resolve() },
  });
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: decode,
  });
  jest
    .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
    .mockReturnValue(1496);
  jest
    .spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get')
    .mockReturnValue(1728);
  const context = {
    font: '',
    letterSpacing: '0px',
    fillStyle: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    imageSmoothingQuality: 'high',
    measureText(text: string) {
      const size = Number(/([\d.]+)px/.exec(context.font)?.[1] || 12);
      return {
        width: Array.from(text).length * size * 0.45,
        actualBoundingBoxAscent: size * 0.75,
        actualBoundingBoxDescent: size * 0.1,
      };
    },
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    clip: jest.fn(),
    fill: jest.fn(),
    fillRect: jest.fn(),
    translate: jest.fn(),
    scale,
    fillText,
    drawImage,
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => context,
  });
  encode = jest.fn((callback: BlobCallback, type: string) => {
    const blob = new Blob([], { type });
    Object.defineProperty(blob, 'arrayBuffer', {
      value: async () => new Uint8Array([255, 216, 255]).buffer,
    });
    callback(blob);
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: encode,
  });
});

afterEach(() => jest.restoreAllMocks());

it('draws the approved dimensions and real labels without a central match symbol', async () => {
  const canvas = await renderThumbnail(content, style);
  expect([canvas.width, canvas.height]).toEqual([1280, 720]);
  const labels = fillText.mock.calls.map(([label]) => label);
  expect(labels).toEqual(
    expect.arrayContaining([
      'ORBIT',
      'MICA',
      'HARBOR WEEKLY #42',
      'WINNERS FINAL',
      'ULTIMATE SINGLES',
    ])
  );
  expect(labels).not.toEqual(expect.arrayContaining(['VS']));
  expect(labels).not.toEqual(expect.arrayContaining(['X']));
  expect(drawImage).toHaveBeenCalledTimes(2);
});

it('uses an explicit missing-pick fallback and distinguishes unavailable artwork from missing metadata', async () => {
  await renderThumbnail(
    { ...content, character1: 'Random Character', character2: 'Unlisted' },
    style
  );
  const labels = fillText.mock.calls.map(([label]) => label);
  expect(labels.filter((label) => label === '?')).toHaveLength(2);
  expect(labels).toContain('CHARACTER NOT REPORTED');
  expect(labels).toContain('CHARACTER ART UNAVAILABLE');
  expect(drawImage).not.toHaveBeenCalled();
});

it('keeps mirrored portraits on the same eye line without mirroring the text', async () => {
  const portrait = {
    name: 'Fox',
    source: '/Fox.png',
    eyeX: 0.4,
    eyeY: 0.25,
    width: 850,
  };
  const image = { naturalWidth: 1496, naturalHeight: 1728 };
  const left = thumbnailPortraitPlacement(portrait, image, 290, false);
  const right = thumbnailPortraitPlacement(portrait, image, 990, true);
  expect(left.y + portrait.eyeY * left.height).toBe(330);
  expect(right.y + portrait.eyeY * right.height).toBe(330);
  expect(right.x + (1 - portrait.eyeX) * right.width).toBe(990);
  await renderThumbnail(
    { ...content, character1: 'Fox', character2: 'Fox' },
    style
  );
  expect(scale).toHaveBeenCalledTimes(1);
  expect(scale).toHaveBeenCalledWith(-1, 1);
  expect(fillText.mock.calls.map(([label]) => label)).toContain('MICA');
});

it('fits long tags and labels without dropping characters or exceeding their box', () => {
  const original = 'NOTABLYLONGPLAYERTAGTHATSTAYSINTACT';
  const measure = (value: string, size: number) => value.length * size * 0.5;
  const fitted = fitThumbnailText(original, 470, 112, 112, measure);
  expect(fitted.lines.join('')).toBe(original);
  expect(fitted.lines.length).toBeGreaterThan(1);
  expect(fitted.lines.length * fitted.size * 0.98).toBeLessThanOrEqual(112);
  expect(fitted.lines.every((line) => measure(line, fitted.size) <= 470)).toBe(
    true
  );
});

it('balances a long camel-case player tag at its existing word boundary', () => {
  const fitted = fitThumbnailText(
    'NotablyLongPlayerTag',
    470,
    112,
    112,
    (value, size) => value.length * size * 0.5
  );
  expect(fitted.lines).toEqual(['NotablyLong', 'PlayerTag']);
});

it('waits for font loading and image decoding before drawing or encoding the JPEG', async () => {
  let releaseFont!: (fonts: object[]) => void;
  let releaseImage!: () => void;
  fontLoad.mockReturnValueOnce(
    new Promise((resolve) => {
      releaseFont = resolve;
    })
  );
  decode.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      releaseImage = resolve;
    })
  );
  const result = exportThumbnail(
    { ...content, character1: 'Pending', character2: 'Random Character' },
    style
  );
  await Promise.resolve();
  expect(drawImage).not.toHaveBeenCalled();
  expect(encode).not.toHaveBeenCalled();
  releaseFont([{}]);
  await Promise.resolve();
  expect(drawImage).not.toHaveBeenCalled();
  releaseImage();
  await expect(result).resolves.toEqual(new Uint8Array([255, 216, 255]));
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(encode).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);
});

it('surfaces a missing font rather than reporting a successful fallback export', async () => {
  fontLoad.mockResolvedValueOnce([]);
  await expect(exportThumbnail(content, style)).rejects.toThrow(
    'font is unavailable'
  );
  expect(encode).not.toHaveBeenCalled();
});
