/* eslint import/prefer-default-export: off */
import { URL, pathToFileURL } from 'url';
import path from 'path';
import { existsSync } from 'fs';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return pathToFileURL(path.resolve(__dirname, '../renderer/', htmlFileName))
    .href;
}

export function isAuthCallbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'tournamentvodclipper:' &&
      url.host === '' &&
      (url.pathname === '' || url.pathname === '/')
    );
  } catch {
    return false;
  }
}

export function legacyProfilePath(appData: string): string | null {
  const legacy = path.join(appData, 'electron-react-boilerplate');
  return existsSync(path.join(legacy, 'config.json')) ? legacy : null;
}

export function resolvePreloadPath(
  mainDirectory: string,
  packaged: boolean
): string {
  return packaged || process.env.NODE_ENV === 'production'
    ? path.join(mainDirectory, 'preload.js')
    : path.resolve(mainDirectory, '../../.erb/dll/preload.js');
}
