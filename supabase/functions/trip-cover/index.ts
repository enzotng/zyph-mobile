// trip-cover: returns an Unsplash cover photo for a trip destination.
//
// The Unsplash Access Key stays server-side (Supabase secret UNSPLASH_ACCESS_KEY).
// We return the hotlinked photo URL + photographer attribution (Unsplash API
// guidelines require hotlinking and crediting the photographer) and trigger the
// download endpoint. The caller stores url/author/authorUrl on the trip row.
//
// Auth: verify_jwt is on by default, so only signed-in users can invoke this.

import { createClient } from '@supabase/supabase-js'

import { isWithinRateLimit } from '../_shared/rate-limit.ts'

const UNSPLASH = 'https://api.unsplash.com'
const ACCESS_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY') ?? ''
const UTM = '?utm_source=zyph&utm_medium=referral'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (!ACCESS_KEY) {
    return json({ error: 'UNSPLASH_ACCESS_KEY is not configured' }, 500)
  }

  // Per-user rate limit so a signed-in caller cannot burn the Unsplash quota. User-scoped client
  // (built from the caller's bearer) so check_rate_limit sees auth.uid().
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
      return json({ url: null, author: null, authorUrl: null })
    }

    const search = new URL(`${UNSPLASH}/search/photos`)
    search.searchParams.set('query', destination)
    search.searchParams.set('per_page', '1')
    search.searchParams.set('orientation', 'landscape')
    search.searchParams.set('content_filter', 'high')

    const res = await fetch(search, {
      headers: { Authorization: `Client-ID ${ACCESS_KEY}`, 'Accept-Version': 'v1' },
    })
    if (!res.ok) {
      return json({ url: null, author: null, authorUrl: null })
    }

    const data = await res.json()
    const photo = data?.results?.[0]
    if (!photo) {
      return json({ url: null, author: null, authorUrl: null })
    }

    // Required by the Unsplash guidelines whenever a photo is used (fire-and-forget).
    const downloadLocation = photo?.links?.download_location
    if (downloadLocation) {
      fetch(downloadLocation, {
        headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
      }).catch(() => {})
    }

    const authorHtml = photo?.user?.links?.html
    return json({
      url: photo?.urls?.regular ?? photo?.urls?.full ?? null,
      author: photo?.user?.name ?? null,
      authorUrl: authorHtml ? `${authorHtml}${UTM}` : null,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
