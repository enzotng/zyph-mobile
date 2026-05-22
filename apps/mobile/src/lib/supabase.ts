import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'

import { env } from './env'
import { secureSessionStorage } from './secure-storage'

export const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native; PKCE handles the mobile auth flow.
    detectSessionInUrl: false,
    flowType: 'pkce',
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
