// trip-cover: returns a cover photo for a trip destination.
//
// Tries Google Places first (a real photo of the actual destination) when GOOGLE_MAPS_API_KEY is
// configured, then falls back to Unsplash (stock photo by query), then to nothing (the client
// shows a deterministic colour tile). Both provider keys are optional and stay server-side.
//
// Google: the Place Photo (New) endpoint is called with skipHttpRedirect=true so it returns a
// JSON { photoUri } pointing at a public googleusercontent URL - the API key is NEVER embedded in
// the returned URL, so storing it on the trip row leaks nothing.
//
// Unsplash: guidelines require hotlinking the returned URL, crediting the photographer, and
// pinging the download endpoint (fire-and-forget).
//
// Auth: verify_jwt is on by default, so only signed-in users can invoke this.

import { createClient } from '@supabase/supabase-js'

import { isWithinRateLimit } from '../_shared/rate-limit.ts'

const UNSPLASH = 'https://api.unsplash.com'
const GOOGLE_PLACES = 'https://places.googleapis.com/v1'
const UNSPLASH_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY') ?? ''
const GOOGLE_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? ''
const UTM = '?utm_source=zyph&utm_medium=referral'
// Fail fast rather than holding the request open if a photo provider stalls (the Google branch
// chains two calls, so a hang would compound). On timeout we just fall through to the next source.
const FETCH_TIMEOUT_MS = 4000

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Cover = { url: string | null; author: string | null; authorUrl: string | null }
const EMPTY: Cover = { url: null, author: null, authorUrl: null }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

// Google Places (New): Text Search the destination, take the first photo, then resolve it to a
// keyless public URL via the Photo endpoint (skipHttpRedirect). Returns null on any miss so the
// caller falls back to Unsplash.
async function tryGooglePlaces(destination: string): Promise<Cover | null> {
  try {
    const searchRes = await fetch(`${GOOGLE_PLACES}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.photos',
      },
      body: JSON.stringify({ textQuery: destination, languageCode: 'en' }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!searchRes.ok) {
      return null
    }
    const searchData = await searchRes.json()
    const photo = searchData?.places?.[0]?.photos?.[0]
    const photoName = str(photo?.name)
    if (!photoName) {
      return null
    }

    const photoRes = await fetch(
      `${GOOGLE_PLACES}/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true`,
      { headers: { 'X-Goog-Api-Key': GOOGLE_KEY }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    )
    if (!photoRes.ok) {
      return null
    }
    const photoData = await photoRes.json()
    const url = str(photoData?.photoUri)
    if (!url) {
      return null
    }

    const attribution = photo?.authorAttributions?.[0]
    return { url, author: str(attribution?.displayName), authorUrl: str(attribution?.uri) }
  } catch {
    return null
  }
}

// Unsplash: search the destination, return the hotlinked photo + photographer credit, and ping the
// download endpoint per the API guidelines. Returns EMPTY on any miss.
async function tryUnsplash(destination: string): Promise<Cover> {
  try {
    const search = new URL(`${UNSPLASH}/search/photos`)
    search.searchParams.set('query', destination)
    search.searchParams.set('per_page', '1')
    search.searchParams.set('orientation', 'landscape')
    search.searchParams.set('content_filter', 'high')

    const res = await fetch(search, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      return EMPTY
    }

    const data = await res.json()
    const photo = data?.results?.[0]
    if (!photo) {
      return EMPTY
    }

    const downloadLocation = photo?.links?.download_location
    if (downloadLocation) {
      fetch(downloadLocation, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }).catch(
        () => {},
      )
    }

    const authorHtml = photo?.user?.links?.html
    return {
      url: str(photo?.urls?.regular) ?? str(photo?.urls?.full),
      author: str(photo?.user?.name),
      authorUrl: authorHtml ? `${authorHtml}${UTM}` : null,
    }
  } catch {
    return EMPTY
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // Per-user rate limit so a signed-in caller cannot burn the photo provider quotas. User-scoped
  // client (built from the caller's bearer) so check_rate_limit sees auth.uid().
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    },
  )
  if (!(await isWithinRateLimit(userClient, 'trip-cover', 15, 60))) {
    return json({ error: 'Too many requests, please slow down.' }, 429)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const destination = typeof body?.destination === 'string' ? body.destination.trim() : ''
    if (!destination) {
      return json(EMPTY)
    }

    // 1) Real place photo from Google Places, when configured.
    if (GOOGLE_KEY) {
      const google = await tryGooglePlaces(destination)
      if (google) {
        return json(google)
      }
    }

    // 2) Unsplash stock photo, when configured.
    if (UNSPLASH_KEY) {
      return json(await tryUnsplash(destination))
    }

    // 3) Neither provider configured: the client falls back to a colour tile.
    return json(EMPTY)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
