// Per-user rate limiting shared by the LLM / geocoding edge functions. Calls the check_rate_limit
// RPC with the user-scoped client (so auth.uid() resolves to the caller). Fails OPEN on any error
// so a transient DB issue - or the RPC not yet being deployed - never blocks the feature.

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>
}

export async function isWithinRateLimit(
  supabase: RpcClient,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      _bucket: bucket,
      _limit: limit,
      _window_seconds: windowSeconds,
    })
    if (error) {
      // Surface a misconfigured/undeployed RPC instead of silently disabling all limits.
      console.error(`check_rate_limit error for "${bucket}"`, error)
      return true
    }
    // `false` means blocked: either over the limit, or no authenticated user (the RPC denies a
    // null auth.uid()). Both correctly stop the call; the caller answers 429.
    return data !== false
  } catch (err) {
    console.error(`check_rate_limit threw for "${bucket}"`, err)
    return true
  }
}
