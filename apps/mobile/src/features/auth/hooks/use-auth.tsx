import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import * as Linking from 'expo-linking'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'

import { supabase } from '@/lib/supabase'

// Complete the PKCE flow when the app is opened via the auth deep link
// (email confirmation / OAuth callback: zyph://auth/callback?code=...).
function exchangeCodeFromUrl(url: string | null) {
  if (!url) {
    return
  }
  const { queryParams } = Linking.parse(url)
  const code = queryParams?.code
  if (typeof code === 'string') {
    // An expired/used link just fails to sign in; onAuthStateChange stays unchanged.
    void supabase.auth.exchangeCodeForSession(code).catch(() => undefined)
  }
}

type AuthContextValue = {
  session: Session | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    // onAuthStateChange fires an initial event (INITIAL_SESSION) right after
    // subscribing, so it seeds the session and clears the loading state too.
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        // Drop all cached user data so the next account starts clean.
        queryClient.clear()
      }
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => data.subscription.unsubscribe()
  }, [queryClient])

  useEffect(() => {
    void Linking.getInitialURL().then(exchangeCodeFromUrl)
    const sub = Linking.addEventListener('url', ({ url }) => exchangeCodeFromUrl(url))
    return () => sub.remove()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ session, isLoading }), [session, isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
