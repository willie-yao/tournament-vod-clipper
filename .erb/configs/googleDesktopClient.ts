import { readFileSync } from 'fs';

interface DesktopClient {
  clientId: string;
  clientSecret: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validClient(
  value: unknown
): value is { client_id: string; client_secret: string } {
  return (
    isRecord(value) &&
    typeof value.client_id === 'string' &&
    value.client_id.endsWith('.apps.googleusercontent.com') &&
    typeof value.client_secret === 'string' &&
    Boolean(value.client_secret.trim())
  );
}

export default function loadGoogleDesktopClient(
  env: NodeJS.ProcessEnv = process.env
): DesktopClient {
  if (env.GOOGLE_DESKTOP_CLIENT_CONFIG) {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(env.GOOGLE_DESKTOP_CLIENT_CONFIG, 'utf8'));
    } catch {
      throw new Error(
        'Could not read the Google Desktop client configuration. Supply a valid installed-client JSON file.'
      );
    }
    if (!isRecord(data) || 'web' in data || !validClient(data.installed)) {
      throw new Error(
        'Google Desktop installed-client configuration with a client ID and native client secret is required. Web clients are not supported.'
      );
    }
    return {
      clientId: data.installed.client_id,
      clientSecret: data.installed.client_secret,
    };
  }

  const clientId = env.GOOGLE_DESKTOP_CLIENT_ID || '';
  const clientSecret = env.GOOGLE_DESKTOP_CLIENT_SECRET || '';
  if (
    (clientId || clientSecret) &&
    !validClient({ client_id: clientId, client_secret: clientSecret })
  ) {
    throw new Error(
      'Set both GOOGLE_DESKTOP_CLIENT_ID and GOOGLE_DESKTOP_CLIENT_SECRET, or supply GOOGLE_DESKTOP_CLIENT_CONFIG for one Desktop client.'
    );
  }
  if (!clientId && env.REQUIRE_GOOGLE_DESKTOP_CLIENT === 'true') {
    throw new Error(
      'Release builds require Google Desktop client configuration. Set GOOGLE_DESKTOP_CLIENT_CONFIG to the installed-client JSON file.'
    );
  }
  return { clientId, clientSecret };
}
