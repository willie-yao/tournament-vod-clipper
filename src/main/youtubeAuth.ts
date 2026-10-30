import { randomBytes } from 'crypto';
import {
  ClientAuthentication,
  CodeChallengeMethod,
  Credentials,
  OAuth2Client,
} from 'google-auth-library';
import type {
  YouTubeChannel,
  YouTubeSession,
  YouTubeStatus,
} from '../common/youtube';
import googleLoopback, { GoogleAuthError } from './googleLoopback';

export const YOUTUBE_CREDENTIALS_KEY = 'youtubeCredentials';
export const YOUTUBE_SCOPE =
  'https://www.googleapis.com/auth/youtube.force-ssl';
const storageMessage =
  'YouTube secure storage is unavailable. Unlock your system keychain and reconnect. No plaintext credentials will be saved.';
const reconnectMessage =
  'YouTube access has expired or was revoked. Reconnect YouTube, then retry only the failed steps.';

interface Dependencies {
  clientId: string;
  store: {
    get(key: string): unknown;
    set(key: string, value: string): void;
    delete(key: string): void;
  };
  encryption: {
    isEncryptionAvailable(): boolean;
    getSelectedStorageBackend?(): string;
    encryptString(value: string): Buffer;
    decryptString(value: Buffer): string;
  };
  openBrowser(url: string): Promise<void>;
  identify(accessToken: string, signal: AbortSignal): Promise<YouTubeChannel>;
  onStatus(status: YouTubeStatus): void;
  createClient?: (signal: AbortSignal) => OAuth2Client;
}

interface ActiveSession {
  controller: AbortController;
  client: OAuth2Client;
  channel: YouTubeChannel;
  sessionId: string;
  refreshToken: string;
}

function responseStatus(error: unknown): unknown {
  return (
    (error as { response?: { status?: unknown }; code?: unknown } | null)
      ?.response?.status ?? (error as { code?: unknown } | null)?.code
  );
}

function revoked(error: unknown): boolean {
  return (
    responseStatus(error) === 401 ||
    (error as { response?: { data?: { error?: unknown } } } | null)?.response
      ?.data?.error === 'invalid_grant'
  );
}

/** Own the single desktop account and never expose its credentials over IPC. */
export default class YouTubeAuth {
  private initialized = false;

  private active?: ActiveSession;

  private generation = 0;

  private pending?: AbortController;

  private current: YouTubeStatus = {
    state: 'disconnected',
    message:
      'Connect your YouTube channel to upload. Sign-in opens your browser.',
  };

  constructor(private readonly dependencies: Dependencies) {}

  private publish(status: YouTubeStatus) {
    this.current = status;
    this.dependencies.onStatus(status);
    return status;
  }

  private requireStorage() {
    const { encryption } = this.dependencies;
    if (
      !encryption.isEncryptionAvailable() ||
      encryption.getSelectedStorageBackend?.() === 'basic_text'
    ) {
      throw new GoogleAuthError(storageMessage);
    }
  }

  private createClient(signal: AbortSignal) {
    return (
      this.dependencies.createClient?.(signal) ??
      new OAuth2Client({
        clientId: this.dependencies.clientId,
        clientAuthentication: ClientAuthentication.None,
        transporterOptions: {
          timeout: 30_000,
          signal,
          retryConfig: { retry: 0 },
        },
      })
    );
  }

  private save(session: ActiveSession) {
    this.requireStorage();
    try {
      const encrypted = this.dependencies.encryption.encryptString(
        JSON.stringify({
          clientId: this.dependencies.clientId,
          refreshToken: session.refreshToken,
          channel: session.channel,
        })
      );
      this.dependencies.store.set(
        YOUTUBE_CREDENTIALS_KEY,
        encrypted.toString('base64')
      );
    } catch {
      throw new GoogleAuthError(storageMessage);
    }
  }

  private activate(session: ActiveSession) {
    this.active = session;
    session.client.on('tokens', (tokens: Credentials) => {
      // Old refreshes must not restore a disconnected or replaced account.
      if (this.active !== session || !tokens.refresh_token) return;
      session.refreshToken = tokens.refresh_token;
      session.client.credentials.refresh_token = tokens.refresh_token;
      try {
        this.save(session);
      } catch {
        this.active = undefined;
        this.publish({ state: 'storage-error', message: storageMessage });
        throw new GoogleAuthError(storageMessage);
      }
    });
    return this.publish({
      state: 'connected',
      channel: session.channel,
      sessionId: session.sessionId,
      message: `Connected to ${session.channel.title}`,
    });
  }

  status(): YouTubeStatus {
    if (this.initialized) return this.current;
    this.initialized = true;
    if (!this.dependencies.clientId.trim()) {
      return this.publish({
        state: 'not-configured',
        message:
          'YouTube sign-in is not configured in this build. The maintainer must supply a Google Desktop app client ID. You do not need your own Google Cloud project.',
      });
    }
    try {
      const saved = this.dependencies.store.get(YOUTUBE_CREDENTIALS_KEY);
      if (saved === undefined) return this.current;
      this.requireStorage();
      if (typeof saved !== 'string' || !saved)
        throw new GoogleAuthError(storageMessage);
      const data = JSON.parse(
        this.dependencies.encryption.decryptString(Buffer.from(saved, 'base64'))
      );
      if (
        data?.clientId !== this.dependencies.clientId ||
        typeof data?.refreshToken !== 'string' ||
        !data.refreshToken ||
        typeof data?.channel?.id !== 'string' ||
        !data.channel.id ||
        typeof data?.channel?.title !== 'string' ||
        !data.channel.title
      ) {
        return this.publish({
          state: 'reconnect-required',
          message:
            'The saved YouTube connection does not match this build. Reconnect YouTube.',
        });
      }
      const controller = new AbortController();
      const client = this.createClient(controller.signal);
      client.setCredentials({ refresh_token: data.refreshToken });
      return this.activate({
        controller,
        client,
        refreshToken: data.refreshToken,
        channel: { id: data.channel.id, title: data.channel.title },
        sessionId: randomBytes(24).toString('base64url'),
      });
    } catch {
      return this.publish({ state: 'storage-error', message: storageMessage });
    }
  }

  async connect(): Promise<YouTubeStatus> {
    if (this.status().state === 'not-configured') return this.current;
    if (this.pending)
      throw new GoogleAuthError(
        'Google sign-in is already in progress. Finish or cancel it first.'
      );
    try {
      this.requireStorage();
    } catch {
      this.publish({ state: 'storage-error', message: storageMessage });
      throw new GoogleAuthError(storageMessage);
    }
    this.disconnect();
    const { generation } = this;
    const pending = new AbortController();
    this.pending = pending;
    this.publish({
      state: 'connecting',
      message: 'Finish Google sign-in in your browser, or cancel here.',
    });
    const checkCurrent = () => {
      if (this.generation !== generation || pending.signal.aborted) {
        throw new GoogleAuthError(
          'Google sign-in was canceled. No connection was saved.'
        );
      }
    };
    try {
      const client = this.createClient(pending.signal);
      const authorization = await googleLoopback(
        ({ redirectUri, state, challenge }) =>
          this.dependencies.openBrowser(
            client.generateAuthUrl({
              redirect_uri: redirectUri,
              scope: [YOUTUBE_SCOPE],
              access_type: 'offline',
              prompt: 'consent select_account',
              state,
              code_challenge: challenge,
              code_challenge_method: CodeChallengeMethod.S256,
            })
          ),
        pending.signal
      );
      checkCurrent();
      const { tokens } = await client.getToken({
        code: authorization.code,
        codeVerifier: authorization.verifier,
        redirect_uri: authorization.redirectUri,
      });
      checkCurrent();
      if (
        !tokens.access_token ||
        !tokens.refresh_token ||
        (tokens.scope && !tokens.scope.split(' ').includes(YOUTUBE_SCOPE))
      ) {
        throw new GoogleAuthError(
          'Google did not grant persistent YouTube access. Reconnect and approve the requested YouTube permission.'
        );
      }
      client.setCredentials(tokens);
      const channel = await this.dependencies.identify(
        tokens.access_token,
        pending.signal
      );
      checkCurrent();
      if (!channel.id || !channel.title) {
        throw new GoogleAuthError(
          'No YouTube channel was found. Create or select your YouTube channel, then reconnect.'
        );
      }
      const session = {
        controller: pending,
        client,
        channel,
        refreshToken: tokens.refresh_token,
        sessionId: randomBytes(24).toString('base64url'),
      };
      this.save(session);
      return this.activate(session);
    } catch (error) {
      let message =
        'Could not connect YouTube. Check your connection and YouTube channel, then reconnect.';
      if (this.generation !== generation) {
        message = 'Google sign-in was canceled. No connection was saved.';
      } else if (error instanceof GoogleAuthError) {
        message = error.message;
      } else if (responseStatus(error) === 403) {
        message =
          'Could not connect YouTube. Check the granted permissions, YouTube Data API setup, and project quota.';
      }
      if (this.generation === generation) {
        this.publish({
          state: message === storageMessage ? 'storage-error' : 'disconnected',
          message,
        });
      }
      throw new GoogleAuthError(message);
    } finally {
      if (this.pending === pending) this.pending = undefined;
    }
  }

  disconnect(): YouTubeStatus {
    this.initialized = true;
    this.generation += 1;
    this.pending?.abort();
    this.pending = undefined;
    const { active } = this;
    this.active = undefined;
    active?.controller.abort();
    try {
      this.dependencies.store.delete(YOUTUBE_CREDENTIALS_KEY);
    } catch {
      this.publish({
        state: 'storage-error',
        message:
          'YouTube was disconnected in memory, but its saved connection could not be removed. Check local profile permissions and disconnect again.',
      });
      throw new GoogleAuthError(this.current.message);
    }
    return this.publish({
      state: this.dependencies.clientId.trim()
        ? 'disconnected'
        : 'not-configured',
      message:
        'The local YouTube connection was removed. Google access was not revoked; manage it in your Google account permissions.',
    });
  }

  stop() {
    this.generation += 1;
    this.pending?.abort();
    this.pending = undefined;
    const { active } = this;
    this.active = undefined;
    active?.controller.abort();
  }

  /** Fetch/refresh in main, then make exactly one API mutation with this session. */
  async request<T>(
    expected: YouTubeSession,
    action: string,
    request: (headers: { Authorization: string }) => Promise<{ data: T }>
  ): Promise<T> {
    this.status();
    const session = this.active;
    const checkSession = () => {
      if (
        !session ||
        this.active !== session ||
        expected?.sessionId !== session.sessionId ||
        expected?.channelId !== session.channel.id
      ) {
        throw new GoogleAuthError(
          'The YouTube connection changed. Reconnect the original channel and manually retry failed steps.'
        );
      }
      return session;
    };
    const authorized = checkSession();
    try {
      const access = await authorized.client.getAccessToken();
      checkSession();
      if (!access.token) {
        throw new GoogleAuthError(reconnectMessage, 401);
      }
      const response = await request({
        Authorization: `Bearer ${access.token}`,
      });
      if (response?.data == null)
        throw new GoogleAuthError(
          'Missing YouTube confirmation. Check your channel and playlist before retrying.'
        );
      return response.data;
    } catch (error) {
      if (revoked(error) && this.active === session) {
        this.disconnect();
        this.publish({
          state: 'reconnect-required',
          message: reconnectMessage,
        });
      }
      if (error instanceof GoogleAuthError) throw error;
      let hint = 'Check your connection, account, and the local file.';
      if (revoked(error)) {
        hint = reconnectMessage;
      } else if (responseStatus(error) === 403) {
        hint = 'Check account permissions and YouTube quota.';
      }
      throw new GoogleAuthError(`Could not ${action}. ${hint}`);
    }
  }
}
