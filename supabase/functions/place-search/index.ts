// Address autocomplete — proxies OpenStreetMap Photon (keyless, type-ahead geocoder) so
// the third-party URL stays out of the app bundle and we can swap the provider or add
// rate-limiting server-side. Authenticated-only (verify_jwt) to avoid an open geocoding proxy.
//
// Architecture: app mobile → cette Edge Function → Photon (komoot) → suggestions → app.

import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

const PHOTON_URL = "https://photon.komoot.io/api"
const LIMIT = 6

type PhotonFeature = {
  geometry?: { coordinates?: unknown }
  properties?: Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

// Builds a human label from Photon's address parts, dropping the empty ones.
function toLabel(props: Record<string, unknown>): string {
  const name = asString(props.name)
  const street = [asString(props.housenumber), asString(props.street)].filter(Boolean).join(" ")
  const city = [asString(props.postcode), asString(props.city)].filter(Boolean).join(" ")
  return [name, street || null, city || null, asString(props.country)].filter(Boolean).join(", ")
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    let body: { query?: unknown; language?: unknown }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const query = typeof body.query === "string" ? body.query.trim() : ""
    const language = body.language === "fr" ? "fr" : "en"

    if (query.length < 2) {
      return Response.json({ error: "Query is too short" }, { status: 400 })
    }
    if (query.length > 200) {
      return Response.json({ error: "Query is too long (maximum 200 characters)" }, { status: 400 })
    }

    const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${LIMIT}&lang=${language}`

    let photonResponse: Response
    try {
      photonResponse = await fetch(url, {
        headers: { "User-Agent": "ZYPH/1.0 (travel app)" },
      })
    } catch (err) {
      console.error("Photon fetch failed", err)
      return Response.json({ error: "Geocoding provider unreachable" }, { status: 502 })
    }

    if (!photonResponse.ok) {
      console.error("Photon error", photonResponse.status)
      return Response.json(
        { error: `Geocoding provider returned ${photonResponse.status}` },
        { status: 502 },
      )
    }

    const json = (await photonResponse.json()) as { features?: PhotonFeature[] }
    const results = (json.features ?? []).flatMap((feature) => {
      const coords = feature.geometry?.coordinates
      if (!Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number") {
        return []
      }
      const label = toLabel(feature.properties ?? {})
      if (!label) {
        return []
      }
      return [{ label, lat: coords[1], lng: coords[0] }]
    })

    return Response.json({ results })
  }),
}
