import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createRef, useState } from 'react';
import VodPlayer, {
  PlayerHandle,
  PlayerState,
  twitchVideoId,
} from '../renderer/components/VodPlayer';
import ClipFields from '../renderer/components/ClipFields';
import { ClipDraft } from '../renderer/common/clipDraft';

function playerFixture() {
  const listeners = new Map<string, (payload?: unknown) => void>();
  const api = {
    time: 0,
    duration: 100000,
    paused: true,
    addEventListener: jest.fn(
      (event: string, callback: (payload?: unknown) => void) =>
        listeners.set(event, callback)
    ),
    removeEventListener: jest.fn((event: string) => listeners.delete(event)),
    seek: jest.fn((time: number) => {
      api.time = time;
    }),
    play: jest.fn(() => {
      api.paused = false;
    }),
    pause: jest.fn(() => {
      api.paused = true;
    }),
    destroy: jest.fn(),
    getCurrentTime: () => api.time,
    getDuration: () => api.duration,
    isPaused: () => api.paused,
  };
  const constructor = jest.fn(() => api);
  window.Twitch = {
    Player: Object.assign(constructor, {
      READY: 'ready',
      SEEK: 'seek',
      PLAYBACK_BLOCKED: 'blocked',
    }),
  };
  return { api, constructor, listeners };
}

afterEach(() => {
  window.Twitch = undefined;
  document.head
    .querySelectorAll('script[src="https://player.twitch.tv/js/embed/v1.js"]')
    .forEach((script) => script.remove());
  jest.useRealTimers();
});

it('observes actual player time, seeks without recreating the player, and supports long durations', async () => {
  const fixture = playerFixture();
  const ref = createRef<PlayerHandle>();
  const onState = jest.fn();
  const view = render(
    <VodPlayer
      ref={ref}
      url="https://www.twitch.tv/videos/123"
      initialTime={90000}
      onState={onState}
    />
  );
  await waitFor(() => expect(fixture.constructor).toHaveBeenCalledTimes(1));
  expect(fixture.constructor).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      video: '123',
      parent: ['localhost'],
      autoplay: false,
    })
  );
  act(() => fixture.listeners.get('ready')!());
  expect(fixture.api.seek).toHaveBeenCalledWith(90000);
  expect(onState).toHaveBeenLastCalledWith({
    ready: true,
    time: 90000,
    duration: 100000,
    paused: true,
  });
  act(() => ref.current!.seek(90060));
  expect(fixture.api.seek).toHaveBeenLastCalledWith(90060);
  act(() => ref.current!.toggle());
  expect(fixture.api.play).toHaveBeenCalledTimes(1);
  act(() => ref.current!.toggle());
  expect(fixture.api.pause).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({ time: 90060 })
    )
  );
  expect(fixture.constructor).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(fixture.api.removeEventListener).toHaveBeenCalledTimes(3);
  expect(fixture.api.destroy).toHaveBeenCalledTimes(1);
});

it('uses a confirmed paused-seek event when the Twitch time cache is stale', async () => {
  const fixture = playerFixture();
  const onState = jest.fn();
  render(
    <VodPlayer
      url="https://www.twitch.tv/videos/123"
      initialTime={75}
      onState={onState}
    />
  );
  await waitFor(() => expect(fixture.constructor).toHaveBeenCalled());
  act(() => fixture.listeners.get('ready')!());
  expect(fixture.api.getCurrentTime()).toBe(75);
  act(() => fixture.listeners.get('seek')!({ position: 120 }));
  expect(onState).toHaveBeenLastCalledWith(
    expect.objectContaining({ time: 120, paused: true })
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  expect(onState).toHaveBeenLastCalledWith(
    expect.objectContaining({ time: 120 })
  );
  fixture.api.time = 121;
  fixture.api.paused = false;
  await waitFor(() =>
    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({ time: 121, paused: false })
    )
  );
});

it('copies the observed playhead to elapsed boundaries and seeks edited boundaries through the player', async () => {
  const fixture = playerFixture();
  function ReviewFixture() {
    const ref = createRef<PlayerHandle>();
    const [state, setState] = useState<PlayerState>({
      ready: false,
      time: 0,
      duration: 0,
      paused: true,
    });
    const [draft, setDraft] = useState<ClipDraft>({
      start: '00:00:10',
      end: '25:01:00',
      title: 'Match',
    });
    return (
      <>
        <VodPlayer
          ref={ref}
          url="https://www.twitch.tv/videos/123"
          initialTime={90000}
          onState={setState}
        />
        <ClipFields
          draft={draft}
          onChange={setDraft}
          disabled={false}
          playerReady={state.ready}
          duration={state.duration || undefined}
          playhead={state.ready ? state.time : undefined}
          onSeek={(time) => ref.current!.seek(time)}
        />
      </>
    );
  }
  render(<ReviewFixture />);
  expect(
    screen.getByRole('button', { name: 'Set In from playhead' })
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Seek to In' })).toBeDisabled();
  await waitFor(() => expect(fixture.constructor).toHaveBeenCalled());
  act(() => fixture.listeners.get('ready')!());
  fireEvent.click(screen.getByRole('button', { name: 'Set In from playhead' }));
  expect(screen.getByLabelText('In time')).toHaveValue('25:00:00');
  fireEvent.click(screen.getByRole('button', { name: 'Seek to Out' }));
  expect(fixture.api.seek).toHaveBeenLastCalledWith(90060);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Set Out from playhead' })
    ).toBeEnabled()
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  fireEvent.click(
    screen.getByRole('button', { name: 'Set Out from playhead' })
  );
  expect(screen.getByLabelText('Out time')).toHaveValue('25:01:00');
});

it('does not enable playback controls merely because the iframe is ready', async () => {
  const fixture = playerFixture();
  fixture.api.duration = 0;
  const onState = jest.fn();
  render(
    <VodPlayer
      url="https://www.twitch.tv/videos/123"
      initialTime={0}
      onState={onState}
    />
  );
  await waitFor(() => expect(fixture.constructor).toHaveBeenCalled());
  act(() => fixture.listeners.get('ready')!());
  expect(onState).toHaveBeenLastCalledWith(
    expect.objectContaining({ ready: false })
  );
  expect(screen.getByRole('status')).toHaveTextContent('Connecting to Twitch');
});

it('retries a timed-out SDK request with a fresh script and ignores its retired callback', async () => {
  jest.useFakeTimers();
  const onState = jest.fn();
  render(
    <VodPlayer
      url="https://www.twitch.tv/videos/123"
      initialTime={10}
      onState={onState}
    />
  );
  const script = document.head.querySelector<HTMLScriptElement>(
    'script[src="https://player.twitch.tv/js/embed/v1.js"]'
  )!;
  const staleLoad = script.onload!;
  await act(async () => {
    jest.advanceTimersByTime(20000);
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Twitch has not responded.'
  );
  expect(script).not.toBeInTheDocument();
  expect(script.onload).toBeNull();
  expect(script.onerror).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
  const replacement = document.head.querySelector<HTMLScriptElement>(
    'script[src="https://player.twitch.tv/js/embed/v1.js"]'
  )!;
  expect(replacement).not.toBe(script);
  expect(replacement).toBeInTheDocument();
  const fixture = playerFixture();
  await act(async () => {
    staleLoad.call(script, new Event('load'));
  });
  expect(fixture.constructor).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.load(replacement);
  });
  expect(fixture.constructor).toHaveBeenCalledTimes(1);
  act(() => fixture.listeners.get('ready')!());
  expect(onState).toHaveBeenLastCalledWith(
    expect.objectContaining({ ready: true, time: 10 })
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Retry preview' })
  ).not.toBeInTheDocument();
});

it('clears the timeout warning when the player becomes usable after late READY', async () => {
  jest.useFakeTimers();
  const fixture = playerFixture();
  const onState = jest.fn();
  render(
    <VodPlayer
      url="https://www.twitch.tv/videos/123"
      initialTime={10}
      onState={onState}
    />
  );
  await act(async () => {});
  expect(fixture.constructor).toHaveBeenCalledTimes(1);
  act(() => {
    jest.advanceTimersByTime(20000);
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Twitch has not responded.'
  );
  act(() => fixture.listeners.get('ready')!());
  expect(onState).toHaveBeenLastCalledWith(
    expect.objectContaining({ ready: true })
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Retry preview' })
  ).not.toBeInTheDocument();
});

it('preserves an unrelated playback-blocked warning when late playback becomes usable', async () => {
  jest.useFakeTimers();
  const fixture = playerFixture();
  render(
    <VodPlayer
      url="https://www.twitch.tv/videos/123"
      initialTime={10}
      onState={jest.fn()}
    />
  );
  await act(async () => {});
  act(() => {
    jest.advanceTimersByTime(20000);
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Twitch has not responded.'
  );
  act(() => fixture.listeners.get('blocked')!());
  act(() => fixture.listeners.get('ready')!());
  act(() => {
    jest.advanceTimersByTime(250);
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Playback was blocked. Press Play in the Twitch player to continue.'
  );
  expect(screen.getByRole('button', { name: 'Retry preview' })).toBeEnabled();
});

it('reports invalid preview sources and offers recovery without throwing', async () => {
  const fixture = playerFixture();
  render(<VodPlayer url="not a URL" initialTime={0} onState={jest.fn()} />);
  await screen.findByText(/Preview requires a Twitch VOD URL/);
  expect(fixture.constructor).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Retry preview' })).toBeEnabled();
});

it.each([
  'https://evil.example/videos/123',
  'https://www.twitch.tv/channel',
  'javascript:alert(1)',
  'https://www.twitch.tv/videos/not-a-number',
])('rejects unsupported VOD source %s', (url) => {
  expect(twitchVideoId(url)).toBeNull();
});
