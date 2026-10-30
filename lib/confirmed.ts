type Res = { error: { code?: string; message?: string } | null };

/** Runs a query filtered to confirmed members; retries without the filter
 *  if the email_confirmed column does not exist yet (migration not run). */
export async function confirmedOnly<T extends Res>(build: (filter: boolean) => PromiseLike<T>): Promise<T> {
  const res = await build(true);
  if (res.error && (res.error.code === "42703" || /email_confirmed/.test(res.error.message ?? ""))) {
    return build(false);
  }
  return res;
}
