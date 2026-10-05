/**
 * supabase-js resolves with `{ data, error }` instead of throwing, so a bare
 * `await` inside try/catch never reaches the catch. Throw the first error in a
 * batch of results so callers can handle failures in one place.
 */
export function throwIfAnyError<T extends readonly unknown[]>(results: T): T {
  const failed = results.find((r) => (r as { error?: unknown }).error);
  if (failed) throw (failed as { error: unknown }).error;
  return results;
}
