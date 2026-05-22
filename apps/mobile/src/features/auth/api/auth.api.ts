import { supabase } from '@/lib/supabase'
import type { SignInValues, SignUpValues } from '../schemas'

// Deep link the confirmation / OAuth callbacks return to (scheme: zyph).
export const AUTH_REDIRECT_URL = 'zyph://auth/callback'

export async function signUp({ email, password, displayName }: SignUpValues) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: AUTH_REDIRECT_URL,
    },
  })
  if (error) {
    throw error
  }
  return data
}

export async function signIn({ email, password }: SignInValues) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw error
  }
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}
