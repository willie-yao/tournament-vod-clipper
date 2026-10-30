/** @jest-environment node */
import { readFileSync } from 'fs';
import loadGoogleDesktopClient from '../../.erb/configs/googleDesktopClient';
import { scripts } from '../../package.json';

jest.mock('fs', () => ({ readFileSync: jest.fn() }));
const read = jest.mocked(readFileSync);
const installed = {
  client_id: 'new-desktop-fixture.apps.googleusercontent.com',
  client_secret: 'native-config-secret-fixture',
};
const env = { GOOGLE_DESKTOP_CLIENT_CONFIG: '/fixture/desktop-client.json' };

beforeEach(() => {
  read.mockReset().mockReturnValue(JSON.stringify({ installed }));
});

it('loads one installed Desktop configuration without mixing an older environment pair', () => {
  const client = loadGoogleDesktopClient({
    ...env,
    GOOGLE_DESKTOP_CLIENT_ID: 'old-fixture.apps.googleusercontent.com',
    GOOGLE_DESKTOP_CLIENT_SECRET: 'old-secret-fixture',
  });
  expect(client).toEqual({
    clientId: installed.client_id,
    clientSecret: installed.client_secret,
  });
  expect(read).toHaveBeenCalledWith(env.GOOGLE_DESKTOP_CLIENT_CONFIG, 'utf8');
});

it('supports an explicit matching native environment pair without reading a file', () => {
  expect(
    loadGoogleDesktopClient({
      GOOGLE_DESKTOP_CLIENT_ID: installed.client_id,
      GOOGLE_DESKTOP_CLIENT_SECRET: installed.client_secret,
    })
  ).toEqual({
    clientId: installed.client_id,
    clientSecret: installed.client_secret,
  });
  expect(read).not.toHaveBeenCalled();
});

it.each([
  { web: installed },
  { installed, web: installed },
  { installed: { client_id: installed.client_id } },
  { installed: { client_secret: installed.client_secret } },
  { installed: { ...installed, client_secret: '' } },
  { installed: { ...installed, client_id: 'invalid-client' } },
  { installed: null },
  [],
  null,
])(
  'rejects unexpected Desktop structure without printing input: %p',
  (data) => {
    read.mockReturnValue(JSON.stringify(data));
    expect(() => loadGoogleDesktopClient(env)).toThrow(
      'Desktop installed-client'
    );
    expect(() => loadGoogleDesktopClient(env)).not.toThrow(
      installed.client_secret
    );
  }
);

it('sanitizes file and JSON errors rather than including their contents or underlying error', () => {
  read.mockReturnValue(`invalid JSON: ${installed.client_secret}`);
  expect(() => loadGoogleDesktopClient(env)).toThrow('Could not read');
  expect(() => loadGoogleDesktopClient(env)).not.toThrow(
    installed.client_secret
  );
  read.mockImplementation(() => {
    throw new Error(installed.client_secret);
  });
  expect(() => loadGoogleDesktopClient(env)).toThrow('Could not read');
  expect(() => loadGoogleDesktopClient(env)).not.toThrow(
    installed.client_secret
  );
});

it.each([
  { GOOGLE_DESKTOP_CLIENT_ID: installed.client_id },
  { GOOGLE_DESKTOP_CLIENT_SECRET: installed.client_secret },
])(
  'rejects a partial environment pair without exposing its values',
  (partial) => {
    expect(() => loadGoogleDesktopClient(partial)).toThrow('Set both');
    expect(() => loadGoogleDesktopClient(partial)).not.toThrow(
      installed.client_secret
    );
  }
);

it('leaves ordinary builds explicitly unconfigured but requires native configuration for packaging', () => {
  expect(loadGoogleDesktopClient({})).toEqual({
    clientId: '',
    clientSecret: '',
  });
  expect(() =>
    loadGoogleDesktopClient({
      REQUIRE_GOOGLE_DESKTOP_CLIENT: 'true',
    })
  ).toThrow('Release builds require');
  expect(scripts['build:release']).toContain(
    'REQUIRE_GOOGLE_DESKTOP_CLIENT=true'
  );
  expect(scripts.package).toContain('npm run build:release');
  expect(scripts['package:mac:local']).toContain('npm run build:release');
});

it('does not log client configuration', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    loadGoogleDesktopClient(env);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  }
});
