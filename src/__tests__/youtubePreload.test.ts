/** @jest-environment node */
jest.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: jest.fn() },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
}));

it('exposes only status-based YouTube connection methods and session-bound uploads', async () => {
  const { contextBridge, ipcRenderer } = jest.requireMock('electron');
  Object.defineProperty(process, 'isMainFrame', {
    configurable: true,
    value: true,
  });
  await import('../main/preload');
  const api = contextBridge.exposeInMainWorld.mock.calls.find(
    ([name]: [string]) => name === 'electron'
  )[1].ipcRenderer;
  const status = {
    state: 'connected',
    channel: { id: 'fixture', title: 'Fixture channel' },
    sessionId: 'session-fixture',
    message: 'Connected',
  };
  ipcRenderer.invoke.mockResolvedValue(status);
  expect(await api.getYouTubeStatus()).toEqual(status);
  expect(await api.connectYouTube()).toEqual(status);
  expect(await api.disconnectYouTube()).toEqual(status);
  expect(ipcRenderer.invoke.mock.calls.slice(0, 3)).toEqual([
    ['get-youtube-status'],
    ['connect-youtube'],
    ['disconnect-youtube'],
  ]);
  expect(api).not.toHaveProperty('openGoogleLogin');
  const listener = jest.fn();
  const unsubscribe = api.onYouTubeStatus(listener);
  const subscription = ipcRenderer.on.mock.calls[0][1];
  subscription({}, status);
  expect(listener).toHaveBeenCalledWith(status);
  unsubscribe();
  expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
    'youtube-status',
    subscription
  );
  const args = { sessionId: 'session-fixture', channelId: 'fixture' };
  await api.uploadSingleVideo(args);
  expect(ipcRenderer.invoke).toHaveBeenLastCalledWith(
    'upload-single-video',
    args
  );
});
