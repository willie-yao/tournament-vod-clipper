import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Alert, Button } from '@mui/material';

export interface PlayerState {
  ready: boolean;
  time: number;
  duration: number;
  paused: boolean;
}

export interface PlayerHandle {
  seek: (time: number) => void;
  toggle: () => void;
}

export interface TwitchPlayer {
  addEventListener: (
    event: string,
    callback: (payload?: unknown) => void
  ) => void;
  removeEventListener: (
    event: string,
    callback: (payload?: unknown) => void
  ) => void;
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPaused: () => boolean;
  destroy?: () => void;
}

interface TwitchSDK {
  Player: {
    new (id: string, options: Record<string, unknown>): TwitchPlayer;
    READY: string;
    PLAYBACK_BLOCKED: string;
    SEEK: string;
  };
}

declare global {
  interface Window {
    Twitch?: TwitchSDK;
  }
}

let sdkPromise: Promise<TwitchSDK> | undefined;

function loadSDK(): Promise<TwitchSDK> {
  if (window.Twitch) return Promise.resolve(window.Twitch);
  if (!sdkPromise) {
    sdkPromise = new Promise<TwitchSDK>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://player.twitch.tv/js/embed/v1.js';
      script.onload = () => {
        if (window.Twitch) resolve(window.Twitch);
        else reject(new Error('Twitch did not initialize its player.'));
      };
      script.onerror = () =>
        reject(
          new Error('Could not load Twitch. Check your connection and retry.')
        );
      document.head.appendChild(script);
    }).catch((error) => {
      sdkPromise = undefined;
      throw error;
    });
  }
  return sdkPromise;
}

export function twitchVideoId(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !['twitch.tv', 'www.twitch.tv', 'm.twitch.tv'].includes(url.hostname)
    )
      return null;
    return /^\/videos\/(\d+)\/?$/.exec(url.pathname)?.[1] || null;
  } catch {
    return null;
  }
}

interface Props {
  url: string;
  initialTime: number;
  onState: (state: PlayerState) => void;
}

const VodPlayer = forwardRef<PlayerHandle, Props>(
  ({ url, initialTime, onState }, ref) => {
    const id = `vod-${useId().replace(/:/g, '')}`;
    const container = useRef<HTMLDivElement>(null);
    const player = useRef<TwitchPlayer>();
    const ready = useRef(false);
    const onStateRef = useRef(onState);
    const initialTimeRef = useRef(initialTime);
    onStateRef.current = onState;
    initialTimeRef.current = initialTime;
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [revision, setRevision] = useState(0);

    useImperativeHandle(
      ref,
      () => ({
        seek(time) {
          if (ready.current && Number.isFinite(time)) {
            const duration = player.current?.getDuration() || Infinity;
            player.current?.seek(Math.min(duration, Math.max(0, time)));
          }
        },
        toggle() {
          if (!ready.current || !player.current) return;
          if (player.current.isPaused()) player.current.play();
          else player.current.pause();
        },
      }),
      []
    );

    useEffect(() => {
      let active = true;
      let instance: TwitchPlayer | undefined;
      let mediaReady = false;
      let pausedSeekTime: number | undefined;
      let timeout: ReturnType<typeof setTimeout>;
      const video = twitchVideoId(url);
      ready.current = false;
      setError('');
      setLoading(true);
      onStateRef.current({ ready: false, time: 0, duration: 0, paused: true });

      const observe = () => {
        if (!active || !ready.current || !instance) return;
        const paused = instance.isPaused();
        if (!paused) pausedSeekTime = undefined;
        // Twitch's cached time can lag a confirmed seek while paused.
        const time = pausedSeekTime ?? instance.getCurrentTime();
        const duration = instance.getDuration();
        if (Number.isFinite(time) && Number.isFinite(duration)) {
          if (duration > 0) {
            mediaReady = true;
            clearTimeout(timeout);
            setLoading(false);
          }
          onStateRef.current({
            ready: duration > 0,
            time,
            duration,
            paused,
          });
        }
      };
      const handleReady = () => {
        if (!active || !instance) return;
        ready.current = true;
        instance.seek(Math.max(0, initialTimeRef.current));
        observe();
      };
      const blocked = () => {
        if (active)
          setError(
            'Playback was blocked. Press Play in the Twitch player to continue.'
          );
      };
      const seeked = (payload?: unknown) => {
        const position: unknown =
          payload && typeof payload === 'object'
            ? Object.getOwnPropertyDescriptor(payload, 'position')?.value
            : undefined;
        if (
          typeof position === 'number' &&
          Number.isFinite(position) &&
          position >= 0
        ) {
          pausedSeekTime = position;
          observe();
        }
      };
      let sdk: TwitchSDK | undefined;
      const connect = async () => {
        try {
          if (!video)
            throw new Error(
              'Preview requires a Twitch VOD URL such as https://www.twitch.tv/videos/123.'
            );
          if (!['http:', 'https:'].includes(window.location.protocol))
            throw new Error(
              'Twitch preview requires the local app web host. Restart the app.'
            );
          sdk = await loadSDK();
          if (!active) return;
          instance = new sdk.Player(id, {
            video,
            parent: [window.location.hostname],
            width: '100%',
            height: '100%',
            autoplay: false,
            muted: true,
            time: `${Math.floor(initialTimeRef.current / 3600)}h${Math.floor(
              (initialTimeRef.current % 3600) / 60
            )}m${Math.floor(initialTimeRef.current % 60)}s`,
          });
          player.current = instance;
          instance.addEventListener(sdk.Player.READY, handleReady);
          instance.addEventListener(sdk.Player.PLAYBACK_BLOCKED, blocked);
          instance.addEventListener(sdk.Player.SEEK, seeked);
        } catch (failure) {
          if (active) {
            clearTimeout(timeout);
            setLoading(false);
            setError(
              failure instanceof Error ? failure.message : String(failure)
            );
          }
        }
      };
      timeout = setTimeout(() => {
        if (active && !mediaReady) {
          setLoading(false);
          setError(
            'Twitch has not responded. Check the player for an unavailable VOD or a connection error, then retry.'
          );
        }
      }, 20000);
      connect();
      const poll = setInterval(observe, 250);
      const host = container.current;
      return () => {
        active = false;
        ready.current = false;
        clearTimeout(timeout);
        clearInterval(poll);
        if (instance && sdk) {
          instance.removeEventListener(sdk.Player.READY, handleReady);
          instance.removeEventListener(sdk.Player.PLAYBACK_BLOCKED, blocked);
          instance.removeEventListener(sdk.Player.SEEK, seeked);
          instance.pause();
          instance.destroy?.();
        }
        player.current = undefined;
        host?.replaceChildren();
      };
    }, [url, id, revision]);

    return (
      <div className="vod-player">
        <div id={id} ref={container} className="vod-frame" />
        {loading && (
          <div className="player-loading" role="status">
            Connecting to Twitch preview...
          </div>
        )}
        {error && (
          <Alert
            severity="warning"
            action={
              <Button onClick={() => setRevision((value) => value + 1)}>
                Retry preview
              </Button>
            }
          >
            {error}
          </Alert>
        )}
      </div>
    );
  }
);
export default VodPlayer;
