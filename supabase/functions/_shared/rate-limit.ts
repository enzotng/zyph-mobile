// Per-user rate limiting shared by the LLM / geocoding edge functions. Calls the check_rate_limit
// RPC with the user-scoped client (so auth.uid() resolves to the caller). Each bucket's ceiling and
// window live server-side in private.rate_limit_policies, and a bucket with no policy is refused.
// Fails OPEN on any error so a transient DB issue never blocks the feature.

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>
}

export async function isWithinRateLimit(supabase: RpcClient, bucket: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", { _bucket: bucket })
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
