// send-push: turns an in-app notification row into an Expo push (lock-screen) notification.
//
// Invoked by the AFTER INSERT trigger on public.notifications via pg_net (NOT by the app), so
// there is no user JWT (verify_jwt = false in config.toml). Authorisation is a shared secret in
// the `x-push-secret` header, checked against the PUSH_HOOK_SECRET function secret. It loads the
// notification with a service-role client, re-checks the recipient's push opt-out, fans the push
// out to all of the recipient's registered device tokens through Expo's push service.
//
// Copy is rendered per device in French or English from the push_tokens.locale column, which the
// app writes on register and refreshes whenever the active language changes. See lang.ts for the
// fallback, which mirrors the app's.

import { createClient } from "@supabase/supabase-js"

import { type Payload, pushCopy, str } from "./copy.ts"
import { toLang } from "./lang.ts"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

// No CORS headers on purpose: this function is only ever called server-to-server by the
// notifications trigger (pg_net), never from a browser, so there is no preflight to satisfy and
// no reason to advertise the endpoint cross-origin.
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

  // Fail closed: an unset secret rejects every request (push stays off) rather than opening up.
  const secret = Deno.env.get("PUSH_HOOK_SECRET") ?? ""
  if (!secret) {
    console.warn("PUSH_HOOK_SECRET is not set - rejecting (push is disabled until configured)")
  }
  if (!secret || req.headers.get("x-push-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401)
  }

  let body: { notificationId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }
  const notificationId = str(body.notificationId)
  if (!notificationId) {
    return json({ error: "notificationId is required" }, 400)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured" }, 500)
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: notification, error: notifError } = await supabase
    .from("notifications")
    .select("id, recipient_id, type, payload, trip_id")
    .eq("id", notificationId)
    .single()
  if (notifError || !notification) {
    return json({ error: "Notification not found" }, 404)
  }

  // Re-check the global push opt-out (the trigger pre-filters, but stay authoritative).
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("push_enabled")
    .eq("user_id", notification.recipient_id)
    .maybeSingle()
  if (prefs && prefs.push_enabled === false) {
    return json({ skipped: "push disabled" })
  }

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token, locale")
    .eq("user_id", notification.recipient_id)
  if (!tokens || tokens.length === 0) {
    return json({ skipped: "no device tokens" })
  }

  const payload = (notification.payload ?? {}) as Payload
  // Deep-link hints carried to the app's tap handler, mirroring the in-app feed's routing.
  const data = {
    notificationId: notification.id,
    type: notification.type,
    tripId: notification.trip_id,
    expenseId: str(payload.expenseId),
    eventId: str(payload.eventId),
    // The tap handler keeps the detached recipient out of a trip RLS now hides from it, and this
    // is its only way to tell that recipient apart from the rest of the group.
    detachedUserId: str(payload.detachedUserId),
  }
  // One message per device, each rendered in that device's own language.
  const messages = tokens.map((t: { token: string; locale: string | null }) => {
    const { title, body: bodyText } = pushCopy(
      notification.type,
      payload,
      toLang(t.locale),
      notification.recipient_id,
    )
    return { to: t.token, sound: "default", title, body: bodyText, data }
  })

  let expoResponse: Response
  try {
    expoResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    })
  } catch (err) {
    console.error("Expo push fetch failed", err)
    return json({ error: "Push provider unreachable" }, 502)
  }

  if (!expoResponse.ok) {
    console.error("Expo push error", expoResponse.status)
    return json({ error: `Push provider returned ${expoResponse.status}` }, 502)
  }

  return json({ sent: messages.length })
})
