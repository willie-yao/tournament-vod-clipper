jest.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: jest.fn() },
  ipcRenderer: {
    invoke: jest.fn(),
    send: jest.fn(),
  },
}));

const { contextBridge, ipcRenderer } = jest.requireMock('electron');
let api: typeof window.electron.ipcRenderer;

beforeAll(async () => {
  Object.defineProperty(process, 'isMainFrame', {
    configurable: true,
    value: true,
  });
  await import('../main/preload');
  api = contextBridge.exposeInMainWorld.mock.calls.find(
    ([name]: [string]) => name === 'electron'
  )[1].ipcRenderer;
});

beforeEach(() => {
  ipcRenderer.invoke.mockReset();
  ipcRenderer.send.mockClear();
});
afterEach(() => jest.restoreAllMocks());

it.each(['success', 'failure'])(
  'releases unload cleanup after metadata %s',
  async (outcome) => {
    const remove = jest.spyOn(window, 'removeEventListener');
    if (outcome === 'success')
      ipcRenderer.invoke.mockResolvedValueOnce({ timestamp: 1000 });
    else
      ipcRenderer.invoke.mockRejectedValueOnce(
        new Error('fixture IPC failure')
      );
    const args = { requestId: 'fixture', vodUrl: 'https://offline.test/video' };
    const result = api.retrieveVideoInformation(args);
    expect(await result.catch((error: Error) => error.message)).toEqual(
      outcome === 'success' ? { timestamp: 1000 } : 'fixture IPC failure'
    );
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'retrieve-video-information',
      args
    );
    expect(remove).toHaveBeenCalledWith('unload', expect.any(Function));
    window.dispatchEvent(new Event('unload'));
    expect(ipcRenderer.send).not.toHaveBeenCalled();
  }
);

it('cancels pending metadata on unload and supports explicit request-scoped cancellation', async () => {
  let finish!: (value: { timestamp: number }) => void;
  ipcRenderer.invoke.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const result = api.retrieveVideoInformation({
    requestId: 'fixture',
    vodUrl: 'https://offline.test/video',
  });
  window.dispatchEvent(new Event('unload'));
  expect(ipcRenderer.send).toHaveBeenCalledWith(
    'cancel-retrieve-video-information',
    'fixture'
  );
  ipcRenderer.send.mockClear();
  api.cancelRetrieveVideoInformation('fixture');
  expect(ipcRenderer.send).toHaveBeenCalledWith(
    'cancel-retrieve-video-information',
    'fixture'
  );
  ipcRenderer.send.mockClear();
  window.dispatchEvent(new Event('unload'));
  expect(ipcRenderer.send).not.toHaveBeenCalled();
  finish({ timestamp: 1000 });
  await result;
});
