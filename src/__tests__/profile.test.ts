/** @jest-environment node */
import path from 'path';
import { existsSync } from 'fs';
import {
  legacyProfilePath,
  resolveHtmlPath,
  resolvePreloadPath,
} from '../main/util';

jest.mock('fs', () => ({ existsSync: jest.fn() }));

it('reuses an existing legacy settings directory without reading or moving its contents', () => {
  jest.mocked(existsSync).mockReturnValue(true);
  expect(legacyProfilePath('/profiles')).toBe(
    path.join('/profiles', 'electron-react-boilerplate')
  );
  expect(existsSync).toHaveBeenCalledWith(
    path.join('/profiles', 'electron-react-boilerplate', 'config.json')
  );
  jest.mocked(existsSync).mockReturnValue(false);
  expect(legacyProfilePath('/profiles')).toBeNull();
});

it('encodes packaged HTML paths containing spaces and URL punctuation', () => {
  const url = resolveHtmlPath('index space#.html');
  expect(url).toContain('index%20space%23.html');
});

it('uses built preload output for an unpackaged production launch, but the DLL in development', () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    expect(resolvePreloadPath('/project/release/app/dist/main', false)).toBe(
      path.join('/project/release/app/dist/main', 'preload.js')
    );
    process.env.NODE_ENV = 'development';
    expect(resolvePreloadPath('/project/src/main', false)).toBe(
      path.join('/project', '.erb/dll/preload.js')
    );
    expect(resolvePreloadPath('/resources/app/dist/main', true)).toBe(
      path.join('/resources/app/dist/main', 'preload.js')
    );
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
