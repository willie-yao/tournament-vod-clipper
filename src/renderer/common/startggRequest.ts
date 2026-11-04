import { ApolloClient, OperationVariables, QueryOptions } from '@apollo/client';
import {
  createRetrievalScope,
  RetrievalError,
  STARTGG_REQUEST_TIMEOUT_MS,
  withRetrievalAbort,
} from '../../common/retrieval';

export default async function startggRequest<T>(
  client: Pick<ApolloClient<object>, 'query'>,
  options: QueryOptions<OperationVariables, T>,
  parent?: AbortSignal
) {
  const scope = createRetrievalScope(
    STARTGG_REQUEST_TIMEOUT_MS,
    'start.gg did not respond within 30 seconds. Check your connection and retry.',
    parent
  );
  try {
    return await withRetrievalAbort(scope.signal, () =>
      client.query<T>({
        ...options,
        fetchPolicy: 'network-only',
        context: {
          ...options.context,
          // A retry must not reuse a still-settling canceled query.
          queryDeduplication: false,
          fetchOptions: { signal: scope.signal },
        },
      })
    );
  } catch (error) {
    if (error instanceof RetrievalError) throw error;
    throw new RetrievalError(
      'Could not retrieve start.gg data. Check your API key, event slug and connection, then retry.'
    );
  } finally {
    scope.dispose();
  }
}
