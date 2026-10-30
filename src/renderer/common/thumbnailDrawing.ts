import { VODMetadata } from './tournamentSets';
import { getThumbnailPortrait, ThumbnailPortrait } from './thumbnailPortraits';

declare global {
  interface CanvasRenderingContext2D {
    letterSpacing: string;
  }
}

export const THUMBNAIL_WIDTH = 1280;
export const THUMBNAIL_HEIGHT = 720;
export const DEFAULT_THUMBNAIL_COLOR = '#223d55';
export interface ThumbnailStyle {
  color: string;
  logo: string;
  background: string;
}
export type ThumbnailContent = Pick<
  VODMetadata,
  | 'player1'
  | 'player2'
  | 'character1'
  | 'character2'
  | 'tournamentName'
  | 'roundText'
  | 'eventName'
>;

const condensed = 'Impact, "Offset Condensed", sans-serif';
const sans = '"Helvetica Neue", Arial, sans-serif';
const imageCache = new Map<string, Promise<HTMLImageElement>>();

async function loadImage(source: string): Promise<HTMLImageElement> {
  let pending = imageCache.get(source);
  if (!pending) {
    const image = new Image();
    image.src = source;
    pending = image
      .decode()
      .then(() => image)
      .catch((error) => {
        imageCache.delete(source);
        throw new Error(
          `Could not decode a thumbnail image: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
    imageCache.set(source, pending);
  }
  return pending;
}

export function fitThumbnailText(
  text: string,
  width: number,
  height: number,
  maximum: number,
  measure: (text: string, size: number) => number
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (let size = maximum; size >= 1; size -= 1) {
    const lines: string[] = [];
    let line = '';
    words.forEach((word) => {
      if (measure(line ? `${line} ${word}` : word, size) <= width) {
        line = line ? `${line} ${word}` : word;
      } else {
        if (line) lines.push(line);
        line = '';
        Array.from(word).forEach((character) => {
          if (line && measure(line + character, size) > width) {
            lines.push(line);
            line = '';
          }
          line += character;
        });
      }
    });
    if (line) lines.push(line);
    if (
      lines.length * size * 0.98 <= height &&
      lines.every((value) => measure(value, size) <= width)
    ) {
      if (lines.length === 2) {
        const boundaries: number[] = [];
        for (let index = 1; index < text.length; index += 1) {
          if (
            /\s/.test(text[index]) ||
            (/[a-z]/.test(text[index - 1]) && /[A-Z]/.test(text[index]))
          ) {
            boundaries.push(index);
          }
        }
        boundaries.sort(
          (a, b) =>
            Math.abs(a - text.length / 2) - Math.abs(b - text.length / 2)
        );
        const split = boundaries.find(
          (index) =>
            measure(text.slice(0, index).trim(), size) <= width &&
            measure(text.slice(index).trim(), size) <= width
        );
        if (split)
          return {
            size,
            lines: [text.slice(0, split).trim(), text.slice(split).trim()],
          };
      }
      return { size, lines };
    }
  }
  throw new Error('The thumbnail text cannot fit inside its label.');
}

function drawText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  maximum: number,
  family: string,
  color: string,
  weight = 400,
  align: CanvasTextAlign = 'left',
  tracking = 0
) {
  const fitted = fitThumbnailText(
    value,
    width,
    height,
    maximum,
    (line, size) => {
      context.font = `${weight} ${size}px ${family}`;
      context.letterSpacing = `${size * tracking}px`;
      return context.measureText(line.toUpperCase()).width;
    }
  );
  context.font = `${weight} ${fitted.size}px ${family}`;
  context.letterSpacing = `${fitted.size * tracking}px`;
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = 'alphabetic';
  const metrics = context.measureText(fitted.lines.join('').toUpperCase());
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  const lineHeight = fitted.size * 0.98;
  const total =
    ascent + descent + Math.max(0, fitted.lines.length - 1) * lineHeight;
  const baseline = y + (height - total) / 2 + ascent;
  let origin = x;
  if (align === 'right') origin += width;
  if (align === 'center') origin += width / 2;
  fitted.lines.forEach((line, index) =>
    context.fillText(line.toUpperCase(), origin, baseline + index * lineHeight)
  );
}

function polygon(context: CanvasRenderingContext2D, points: number[][]) {
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

export function thumbnailPortraitPlacement(
  portrait: ThumbnailPortrait,
  image: Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight'>,
  center: number,
  mirrored: boolean
) {
  const width =
    portrait.width || (image.naturalWidth / image.naturalHeight) * 1400;
  const height = (image.naturalHeight / image.naturalWidth) * width;
  return {
    x: center - (mirrored ? 1 - portrait.eyeX : portrait.eyeX) * width,
    y: 330 - portrait.eyeY * height,
    width,
    height,
  };
}

function drawPortrait(
  context: CanvasRenderingContext2D,
  portrait: ThumbnailPortrait | null,
  image: HTMLImageElement | undefined,
  character: string,
  center: number,
  mirrored: boolean
) {
  if (!portrait || !image) {
    drawText(
      context,
      '?',
      center - 210,
      135,
      420,
      310,
      300,
      sans,
      '#d6d6c6',
      400,
      'center'
    );
    const label =
      !character || character === 'Random Character'
        ? 'CHARACTER NOT REPORTED'
        : 'CHARACTER ART UNAVAILABLE';
    drawText(
      context,
      label,
      center - 210,
      468,
      420,
      40,
      27,
      '"Arial Narrow", Arial, sans-serif',
      '#d6d6c6',
      600,
      'center'
    );
    return;
  }
  const placement = thumbnailPortraitPlacement(
    portrait,
    image,
    center,
    mirrored
  );
  context.save();
  context.translate(
    placement.x + (mirrored ? placement.width : 0),
    placement.y
  );
  if (mirrored) context.scale(-1, 1);
  context.drawImage(image, 0, 0, placement.width, placement.height);
  context.restore();
}

/** Render the one Offset Duel composition used by previews and JPEG export. */
export async function renderThumbnail(
  content: ThumbnailContent,
  style: ThumbnailStyle
): Promise<HTMLCanvasElement> {
  const portraits = [
    getThumbnailPortrait(content.character1),
    getThumbnailPortrait(content.character2),
  ];
  const [font, first, second, background, logo] = await Promise.all([
    document.fonts.load('112px "Offset Condensed"'),
    portraits[0] ? loadImage(portraits[0].source) : undefined,
    portraits[1] ? loadImage(portraits[1].source) : undefined,
    style.background ? loadImage(style.background) : undefined,
    style.logo ? loadImage(style.logo) : undefined,
  ]);
  if (!font.length)
    throw new Error('The bundled thumbnail font is unavailable.');
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = THUMBNAIL_WIDTH;
  canvas.height = THUMBNAIL_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('The thumbnail drawing surface is unavailable.');
  context.imageSmoothingQuality = 'high';

  // Clip portraits to opposing fields with a shared eye line.
  const fields = [
    [
      [0, 82],
      [710, 82],
      [590, 660],
      [0, 660],
    ],
    [
      [730, 82],
      [1280, 82],
      [1280, 660],
      [610, 660],
    ],
  ];
  context.fillStyle = style.color;
  context.fillRect(0, 0, 1280, 720);
  if (background) {
    const scale = Math.max(
      1280 / background.naturalWidth,
      578 / background.naturalHeight
    );
    context.drawImage(
      background,
      (1280 - background.naturalWidth * scale) / 2,
      82 + (578 - background.naturalHeight * scale) / 2,
      background.naturalWidth * scale,
      background.naturalHeight * scale
    );
  }
  const mirror = Boolean(
    portraits[0] && portraits[0].name === portraits[1]?.name
  );
  fields.forEach((points, index) => {
    context.save();
    polygon(context, points);
    context.clip();
    context.globalAlpha = background ? 0.74 : 1;
    context.fillStyle = index === 0 ? style.color : '#8b4c37';
    context.fillRect(0, 82, 1280, 578);
    context.globalAlpha = 1;
    drawPortrait(
      context,
      portraits[index],
      index === 0 ? first : second,
      index === 0 ? content.character1 : content.character2,
      index === 0 ? 290 : 990,
      index === 1 && mirror
    );
    context.restore();
  });
  polygon(context, [
    [710, 82],
    [730, 82],
    [610, 660],
    [590, 660],
  ]);
  context.fillStyle = '#e8c788';
  context.fill();

  // Nameplates and labels stay outside the platform duration badge.
  context.fillStyle = '#f1e7d0';
  polygon(context, [
    [43, 526],
    [575, 526],
    [548.4, 650],
    [43, 650],
  ]);
  context.fill();
  polygon(context, [
    [731.6, 526],
    [1237, 526],
    [1237, 650],
    [705, 650],
  ]);
  context.fill();
  drawText(
    context,
    content.player1,
    68,
    531,
    479,
    112,
    112,
    condensed,
    '#192f40',
    400,
    'left',
    -0.025
  );
  drawText(
    context,
    content.player2,
    739,
    531,
    470,
    112,
    112,
    condensed,
    '#663a2b',
    400,
    'left',
    -0.025
  );
  context.fillStyle = '#142b3c';
  context.fillRect(0, 0, 1280, 82);
  context.fillRect(0, 660, 1280, 60);
  if (logo) {
    const scale = Math.min(48 / logo.naturalWidth, 48 / logo.naturalHeight);
    context.drawImage(
      logo,
      45,
      17,
      logo.naturalWidth * scale,
      logo.naturalHeight * scale
    );
  }
  const left = logo ? 110 : 45;
  drawText(
    context,
    content.tournamentName.toUpperCase(),
    left,
    18,
    780 - left,
    48,
    33,
    '"Arial Black", Arial, sans-serif',
    '#f3e8cd',
    900,
    'left',
    -0.04
  );
  drawText(
    context,
    (content.roundText || 'Match').toUpperCase(),
    835,
    16,
    400,
    50,
    36,
    condensed,
    '#edce95',
    400,
    'right',
    0.015
  );
  drawText(
    context,
    (content.eventName || 'Tournament match').toUpperCase(),
    45,
    669,
    1035,
    41,
    28,
    sans,
    '#b9c9d0',
    650,
    'left',
    0.035
  );
  return canvas;
}

export async function exportThumbnail(
  content: ThumbnailContent,
  style: ThumbnailStyle
): Promise<Uint8Array> {
  const canvas = await renderThumbnail(content, style);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result || result.type !== 'image/jpeg')
          reject(new Error('Could not encode the thumbnail JPEG.'));
        else resolve(result);
      },
      'image/jpeg',
      0.92
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}
