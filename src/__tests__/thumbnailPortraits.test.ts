/** @jest-environment node */
import { readFileSync } from 'fs';
import {
  getThumbnailPortrait,
  THUMBNAIL_CHARACTERS,
} from '../renderer/common/thumbnailPortraits';
import { thumbnailPortraitPlacement } from '../renderer/common/thumbnailDrawing';

jest.mock('../renderer/common/thumbnailPortraits', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');
  const vm = jest.requireActual<typeof import('vm')>('vm');
  const typescript =
    jest.requireActual<typeof import('typescript')>('typescript');
  const source = path.join(
    __dirname,
    '../renderer/common/thumbnailPortraits.ts'
  );
  const assets = path.join(__dirname, '../renderer/components/characters');
  const imageModules = Object.assign((key: string) => path.join(assets, key), {
    keys: () =>
      fs
        .readdirSync(assets)
        .filter((name) => name.endsWith('.webp'))
        // Webpack lists each module under a relative and a full path.
        .flatMap((name) => [
          `./${name}`,
          `src/renderer/components/characters/${name}`,
        ]),
  });
  const metadata = {};
  const compiled = typescript.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS },
  }).outputText;
  // Keep the real preset metadata; substitute only Webpack's asset URL loader.
  vm.runInNewContext(
    compiled,
    { exports: metadata, require: { context: () => imageModules } },
    { filename: source }
  );
  return metadata;
});

// Landmarks below are in the original artwork's pixels.
const ORIGINAL_WIDTH = { Ness: 884, Link: 1980, Fox: 1496 };

function dimensions(source: string) {
  const webp = readFileSync(source);
  return {
    naturalWidth: webp.readUIntLE(24, 3) + 1,
    naturalHeight: webp.readUIntLE(27, 3) + 1,
  };
}

it('keeps the actual Ness mouth and chin above the nameplate', () => {
  const portrait = getThumbnailPortrait('Ness');
  if (!portrait) throw new Error('The bundled Ness portrait is missing.');
  const image = dimensions(portrait.source);
  const placement = thumbnailPortraitPlacement(portrait, image, 290, false);
  const scale = placement.width / ORIGINAL_WIDTH.Ness;
  expect(placement.y + 470 * scale).toBeLessThan(506);
  expect(placement.y + 550 * scale).toBeLessThan(526);
});

it.each([
  { side: 'left', center: 290, mirrored: false },
  { side: 'right', center: 990, mirrored: false },
  { side: 'mirror opponent', center: 990, mirrored: true },
])(
  'keeps the actual Link eyes and chin above the nameplate on the $side',
  ({ center, mirrored }) => {
    const link = getThumbnailPortrait('Link');
    const fox = getThumbnailPortrait('Fox');
    if (!link || !fox)
      throw new Error('The bundled portrait metadata is missing.');
    const image = dimensions(link.source);
    expect(image).toEqual({ naturalWidth: 1550, naturalHeight: 1365 });
    const placement = thumbnailPortraitPlacement(link, image, center, mirrored);
    const scale = placement.width / ORIGINAL_WIDTH.Link;

    // Independent landmarks from the artwork, not from its focal preset.
    const eyes = [
      { x: 1058, y: 646 },
      { x: 1178, y: 686 },
    ].map((point) => ({
      x:
        placement.x +
        (mirrored ? ORIGINAL_WIDTH.Link - point.x : point.x) * scale,
      y: placement.y + point.y * scale,
    }));
    eyes.forEach((point) => {
      expect(point.x).toBeGreaterThan(center - 130);
      expect(point.x).toBeLessThan(center + 130);
      expect(point.y).toBeGreaterThan(162);
      expect(point.y).toBeLessThan(446);
    });
    expect(placement.y + 870 * scale).toBeLessThan(506);
    expect(Math.abs(eyes[1].x - eyes[0].x)).toBeGreaterThan(70);
    expect(Math.abs(eyes[1].x - eyes[0].x)).toBeLessThan(130);

    const foxImage = dimensions(fox.source);
    const opposing = thumbnailPortraitPlacement(
      fox,
      foxImage,
      center === 290 ? 990 : 290,
      false
    );
    const foxEye = opposing.y + (440 * opposing.width) / ORIGINAL_WIDTH.Fox;
    expect(Math.abs((eyes[0].y + eyes[1].y) / 2 - foxEye)).toBeLessThan(5);
  }
);

it('lists each bundled character once by its display name', () => {
  expect(THUMBNAIL_CHARACTERS.filter((name) => name === 'Mii Brawler')).toEqual(
    ['Mii Brawler']
  );
  expect(THUMBNAIL_CHARACTERS.some((name) => name.includes('/'))).toBe(false);
});
