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

/** True for a Postgres unique-constraint violation (e.g. a second outfit on one day). */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}
