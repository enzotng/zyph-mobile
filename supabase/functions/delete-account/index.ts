// delete-account: tears down the signed-in user's account with the SERVICE ROLE.
//
// The destructive part lives in the delete_my_account() RPC (block owned shared trips, delete
// solo trips, soft-remove guest memberships preserving everyone else's balances, anonymise the
// profile). It returns whether the user still has shared history: if so we DISABLE + scrub the
// auth user (keep the row so co-travellers' splits stay attributed); otherwise we erase it.
//
// verify_jwt gates this function and we resolve the user from their own bearer token, so a caller
// can only ever delete their own account.

import { createClient } from "@supabase/supabase-js"

// ~100 years; long enough to be permanent without relying on a magic "forever" value.
const BAN_DURATION = "876000h"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured" }, 500)
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Resolve the caller from their own bearer token (verify_jwt also gates this function).
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!token) {
    return json({ error: "Unauthorized" }, 401)
  }
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) {
    return json({ error: "Unauthorized" }, 401)
  }
  const userId = userData.user.id

  // 1) Database teardown (idempotent: safe to retry if a later step fails).
  const { data: hasFootprint, error: rpcError } = await admin.rpc("delete_my_account", {
    _user_id: userId,
  })
  if (rpcError) {
    // The RPC raises 'owns shared trips' when the user still owns trips other travellers are in.
    if (typeof rpcError.message === "string" && rpcError.message.includes("owns shared trips")) {
      return json({ error: "owns_shared_trips" }, 409)
    }
    console.error("delete_my_account failed", rpcError.message)
    return json({ error: "Account deletion failed" }, 500)
  }

  // 2) Best-effort: the avatar Storage object is not covered by any FK cascade.
  await admin.storage
    .from("avatars")
    .remove([`${userId}/avatar`])
    .catch(() => undefined)

  // 3) Disable or erase the auth user.
  if (hasFootprint) {
    // Shared expense history depends on this user: keep the row, disable login, scrub the email.
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      email: `deleted+${userId}@deleted.zyph.app`,
      user_metadata: {},
      ban_duration: BAN_DURATION,
    })
    if (banError) {
      console.error("Account ban failed", banError.message)
      return json({ error: "Account deletion failed" }, 500)
    }
    // Best-effort: revoke the user's sessions/refresh tokens so the banned account cannot mint a
    // new token (the live access token still lapses on its own short TTL).
    await admin.auth.admin.signOut(token, "global").catch(() => undefined)
  } else {
    // No shared history: erase the auth user entirely (cascades the now-empty profile).
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error("Account delete failed", deleteError.message)
      return json({ error: "Account deletion failed" }, 500)
    }
  }

  return json({ success: true })
})
