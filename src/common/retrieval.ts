export const STARTGG_REQUEST_TIMEOUT_MS = 30_000;
export const VOD_METADATA_TIMEOUT_MS = 60_000;
export const RETRIEVAL_TIMEOUT_MS = 5 * 60_000;
export const RETRIEVAL_CANCELLED = 'Retrieval canceled. Retry when ready.';
export const VOD_METADATA_FAILED =
  'Could not read the VOD start time. Check the VOD URL, connection and installed media tools, then retry.';

export type VideoInformationResult = { timestamp: number } | { error: string };

export class RetrievalError extends Error {}

export function retrievalAbortError(signal: AbortSignal): RetrievalError {
  return signal.reason instanceof RetrievalError
    ? signal.reason
    : new RetrievalError(RETRIEVAL_CANCELLED);
}

/** Link a short-lived deadline to its owning retrieval. */
export function createRetrievalScope(
  timeout: number,
  message: string,
  parent?: AbortSignal
) {
  const controller = new AbortController();
  const cancel = () =>
    controller.abort(new RetrievalError(RETRIEVAL_CANCELLED));
  const abortFromParent = () =>
    controller.abort(parent && retrievalAbortError(parent));
  const timer = setTimeout(
    () => controller.abort(new RetrievalError(message)),
    timeout
  );
  parent?.addEventListener('abort', abortFromParent, { once: true });
  if (parent?.aborted) abortFromParent();
  return {
    signal: controller.signal,
    cancel,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', abortFromParent);
    },
  };
}

/** Settle promptly on abort even if a transport delays its rejection. */
export function withRetrievalAbort<T>(
  signal: AbortSignal,
  work: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(retrievalAbortError(signal));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    const cleanup = () => signal.removeEventListener('abort', abort);
    try {
      work()
        .then((value) => {
          cleanup();
          return signal.aborted ? abort() : resolve(value);
        })
        .catch((error: unknown) => {
          cleanup();
          reject(signal.aborted ? retrievalAbortError(signal) : error);
        });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
