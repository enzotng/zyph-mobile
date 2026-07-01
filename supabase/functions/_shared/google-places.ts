// Google Places (New) client + normalizer shared by itinerary edge functions.
//
// searchPlaces: Nearby Search via POST https://places.googleapis.com/v1/places:searchNearby
// normalizeGooglePlace: maps a raw Places API place object to the canonical Poi shape.

const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby"
// No spaces in the field mask — whitespace breaks the X-Goog-FieldMask header.
const FIELD_MASK =
  "places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.photos,places.formattedAddress,places.currentOpeningHours.openNow"

const TIMEOUT_MS = 25_000
const ATTEMPTS = 2

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

export type Poi = {
  placeId: string
  name: string
  lat: number
  lng: number
  rating: number | null // 0..5
  ratingCount: number | null
  priceLevel: number | null // 0..4, null if unspecified
  types: string[]
  photoName: string | null // Google photo resource name "places/X/photos/Y"
  address: string | null
  openNow: boolean | null
}

export type PoiSearchOpts = { lat: number; lng: number; includedTypes: string[]; max: number }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Maps a raw Google Places API place object to Poi. Returns null if required fields are missing or
// non-finite so the caller can filter. Fully null-safe — raw fields may be absent.
export function normalizeGooglePlace(raw: unknown): Poi | null {
  if (raw === null || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>

  const id = r["id"]
  if (typeof id !== "string" || !id) return null

  const displayName = r["displayName"]
  const name =
    displayName !== null && typeof displayName === "object"
      ? (displayName as Record<string, unknown>)["text"]
      : undefined
  if (typeof name !== "string" || !name) return null

  const location = r["location"]
  if (location === null || typeof location !== "object") return null
  const loc = location as Record<string, unknown>
  const lat = loc["latitude"]
  const lng = loc["longitude"]
  if (typeof lat !== "number" || !isFinite(lat) || typeof lng !== "number" || !isFinite(lng)) {
    return null
  }

  const rating = typeof r["rating"] === "number" ? r["rating"] : null
  const ratingCount = typeof r["userRatingCount"] === "number" ? r["userRatingCount"] : null

  const priceLevelRaw = r["priceLevel"]
  const priceLevel =
    typeof priceLevelRaw === "string" && priceLevelRaw in PRICE_LEVEL_MAP
      ? PRICE_LEVEL_MAP[priceLevelRaw]
      : null

  const typesRaw = r["types"]
  const types = Array.isArray(typesRaw)
    ? typesRaw.filter((t): t is string => typeof t === "string")
    : []

  const photos = r["photos"]
  let photoName: string | null = null
  if (Array.isArray(photos) && photos.length > 0) {
    const first = photos[0]
    if (first !== null && typeof first === "object") {
      const n = (first as Record<string, unknown>)["name"]
      photoName = typeof n === "string" ? n : null
    }
  }

  const address = typeof r["formattedAddress"] === "string" ? r["formattedAddress"] : null

  const openingHours = r["currentOpeningHours"]
  let openNow: boolean | null = null
  if (openingHours !== null && typeof openingHours === "object") {
    const oh = openingHours as Record<string, unknown>
    openNow = typeof oh["openNow"] === "boolean" ? oh["openNow"] : null
  }

  return { placeId: id, name, lat, lng, rating, ratingCount, priceLevel, types, photoName, address, openNow }
}

// Calls Google Places Nearby Search with a per-attempt timeout; retries once on a transient
// network error / 429 / 5xx with a 500 ms backoff. Throws if every attempt fails.
async function callGoogleWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)
      // Retry once on a transient upstream status; drain the body so the socket can be reused.
      if ((response.status === 429 || response.status >= 500) && attempt < ATTEMPTS) {
        await response.text().catch(() => undefined)
        await sleep(500 * attempt)
        continue
      }
      return response
    } catch (error) {
      clearTimeout(timer)
      lastError = error
      if (attempt < ATTEMPTS) {
        await sleep(500 * attempt)
        continue
      }
    }
  }
  throw lastError ?? new Error("Google Places request failed")
}

// Searches for nearby places matching the given types and returns a normalized Poi list.
// Throws on a non-ok final response (the edge handler catches and degrades to an empty list).
export async function searchPlaces(apiKey: string, opts: PoiSearchOpts): Promise<Poi[]> {
  const response = await callGoogleWithRetry(GOOGLE_PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: opts.includedTypes,
      maxResultCount: opts.max,
      rankPreference: "POPULARITY",
      locationRestriction: {
        circle: {
          center: { latitude: opts.lat, longitude: opts.lng },
          radius: 5000.0,
        },
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    throw new Error(`Google Places returned ${response.status}: ${errText}`)
  }

  const json = (await response.json()) as { places?: unknown[] }
  // `places` may be absent when there are no results — return [] rather than throwing.
  if (!Array.isArray(json.places)) return []

  return json.places.flatMap((p) => {
    const normalized = normalizeGooglePlace(p)
    return normalized ? [normalized] : []
  })
}
