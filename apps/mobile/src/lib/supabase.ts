import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'

import type { Database } from './database.types'
import { env } from './env'
import { secureSessionStorage } from './secure-storage'
import { guardAnonymousRequests, trackStoredSession } from './session-guard'

// The value supabase-js defaults to, passed explicitly so the tracker reads the key auth writes:
// any other value would sign every user out.
const SESSION_KEY = `sb-${new URL(env.supabaseUrl).hostname.split('.')[0]}-auth-token`
const session = trackStoredSession(secureSessionStorage, SESSION_KEY)

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
  auth: {
    storage: session.storage,
    storageKey: SESSION_KEY,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native; PKCE handles the mobile auth flow.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    fetch: guardAnonymousRequests(
      (input, init) => fetch(input, init),
      env.supabaseKey,
      session.hasSession,
    ),
  },
})

// Refresh the session only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh()
  } else {
    void supabase.auth.stopAutoRefresh()
  }
})
