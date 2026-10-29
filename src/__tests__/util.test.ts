import { isAuthCallbackUrl } from '../main/util';

describe('isAuthCallbackUrl', () => {
  it.each([
    'tournamentvodclipper://',
    'tournamentvodclipper:///',
    'tournamentvodclipper://?result=success',
  ])('accepts the root login callback %s', (url) => {
    expect(isAuthCallbackUrl(url)).toBe(true);
  });

  it.each([
    '',
    'not a URL',
    'https://example.com/',
    // eslint-disable-next-line no-script-url
    'javascript:alert(1)',
    'tournamentvodclipper://untrusted-host/',
    'tournamentvodclipper:///unexpected-path',
    'tournamentvodclipper://user:password@untrusted-host/',
  ])('rejects unexpected callback %s', (url) => {
    expect(isAuthCallbackUrl(url)).toBe(false);
  });
});
