import {
  createRetrievalScope,
  RetrievalError,
  RETRIEVAL_CANCELLED,
  withRetrievalAbort,
} from '../common/retrieval';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it.each(['success', 'failure', 'timeout', 'cancel'] as const)(
  'releases deadline and abort listeners after %s',
  async (outcome) => {
    const parent = new AbortController();
    const removeParent = jest.spyOn(parent.signal, 'removeEventListener');
    const scope = createRetrievalScope(100, 'fixture deadline', parent.signal);
    const removeAbort = jest.spyOn(scope.signal, 'removeEventListener');
    let succeed!: (value: string) => void;
    let fail!: (error: Error) => void;
    const result = withRetrievalAbort(
      scope.signal,
      () =>
        new Promise<string>((resolve, reject) => {
          succeed = resolve;
          fail = reject;
        })
    );
    const settled = result.catch((error: Error) => error.message);
    if (outcome === 'success') succeed('complete');
    if (outcome === 'failure') fail(new Error('fixture error'));
    if (outcome === 'timeout') jest.advanceTimersByTime(100);
    if (outcome === 'cancel') parent.abort();
    expect(await settled).toBe(
      {
        success: 'complete',
        failure: 'fixture error',
        timeout: 'fixture deadline',
        cancel: RETRIEVAL_CANCELLED,
      }[outcome]
    );
    scope.dispose();
    expect(jest.getTimerCount()).toBe(0);
    expect(removeParent).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(removeAbort).toHaveBeenCalledWith('abort', expect.any(Function));
  }
);

it('does not start work for an already canceled owner', async () => {
  const parent = new AbortController();
  parent.abort();
  const scope = createRetrievalScope(100, 'fixture deadline', parent.signal);
  const work = jest.fn();
  await expect(withRetrievalAbort(scope.signal, work)).rejects.toBeInstanceOf(
    RetrievalError
  );
  expect(work).not.toHaveBeenCalled();
  scope.dispose();
  expect(jest.getTimerCount()).toBe(0);
});
