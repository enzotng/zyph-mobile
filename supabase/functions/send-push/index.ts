// send-push: turns an in-app notification row into an Expo push (lock-screen) notification.
//
// Invoked by the AFTER INSERT trigger on public.notifications via pg_net (NOT by the app), so
// there is no user JWT (verify_jwt = false in config.toml). Authorisation is a shared secret in
// the `x-push-secret` header, checked against the PUSH_HOOK_SECRET function secret. It loads the
// notification with a service-role client, re-checks the recipient's push opt-out, fans the push
// out to all of the recipient's registered device tokens through Expo's push service.
//
// Copy is rendered per device in French or English from the push_tokens.locale column (set at
// register time from the app's active language), defaulting to French when locale is unset.

import { createClient } from "@supabase/supabase-js"

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

type Payload = Record<string, unknown>

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

type Lang = "en" | "fr"

// Maps a stored device locale (e.g. "en", "en-US", "fr") to a supported push language. Defaults
// to French (the app's default locale) for anything unset or unsupported.
function toLang(locale: string | null | undefined): Lang {
  return typeof locale === "string" && locale.toLowerCase().startsWith("en") ? "en" : "fr"
}

// Localized push copy per notification type, mirroring the in-app feed. settlement.created splits
// on the payload role (payer vs payee). Falls back to a generic line for any unknown type.
function pushCopy(type: string, payload: Payload, lang: Lang): { title: string; body: string } {
  const description = str(payload.description)
  const title = str(payload.title)
  const en = lang === "en"
  switch (type) {
    case "member.joined":
      return {
        title: "ZYPH",
        body: en ? "A new member joined the trip" : "Un nouveau membre a rejoint le voyage",
      }
    case "member.left":
      return { title: "ZYPH", body: en ? "A member left the trip" : "Un membre a quitté le voyage" }
    case "member.removed":
      return { title: "ZYPH", body: en ? "You were removed from a trip" : "Tu as été retiré d’un voyage" }
    case "expense.added":
      return {
        title: en ? "New expense" : "Nouvelle dépense",
        body: description ?? (en ? "An expense was added" : "Une dépense a été ajoutée"),
      }
    case "expense.updated":
      return {
        title: en ? "Expense updated" : "Dépense modifiée",
        body: description ?? (en ? "An expense was updated" : "Une dépense a été mise à jour"),
      }
    case "settlement.created":
      return payload.role === "to"
        ? { title: "ZYPH", body: en ? "You received a payment" : "Tu as reçu un paiement" }
        : { title: "ZYPH", body: en ? "Your payment was recorded" : "Ton paiement a été enregistré" }
    case "settlement.reversed":
      return { title: "ZYPH", body: en ? "A payment was reversed" : "Un paiement a été annulé" }
    case "event.added":
      return {
        title: en ? "New event" : "Nouvel événement",
        body: title ?? (en ? "An event was added" : "Un événement a été ajouté"),
      }
    case "packing.assigned":
      return {
        title: en ? "Packing" : "Bagages",
        body: en ? "A packing item was assigned to you" : "Un article de bagage t’a été attribué",
      }
    case "packing.nudged":
      return {
        title: en ? "Packing" : "Bagages",
        body: en ? "Reminder: an item to prepare" : "Rappel : un article à préparer",
      }
    case "packing.reminder":
      return {
        title: en ? "Packing" : "Bagages",
        body: en
          ? "Remember to prepare the shared trip gear"
          : "Pense à préparer le matériel partagé du voyage",
      }
    default:
      return { title: "ZYPH", body: en ? "New activity" : "Nouvelle activité" }
  }
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
  }
  // One message per device, each rendered in that device's own language.
  const messages = tokens.map((t: { token: string; locale: string | null }) => {
    const { title, body: bodyText } = pushCopy(notification.type, payload, toLang(t.locale))
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
