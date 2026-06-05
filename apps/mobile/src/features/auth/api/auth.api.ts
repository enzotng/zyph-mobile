import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'

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

// Send a password-reset email. The recovery link returns to the auth deep link, where the PKCE
// code is exchanged and Supabase emits a PASSWORD_RECOVERY event (see use-auth).
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: AUTH_REDIRECT_URL,
  })
  if (error) {
    throw error
  }
}

// Set a new password for the recovery session. Emits USER_UPDATED, which ends the recovery flow.
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    throw error
  }
}

// Google OAuth via the PKCE flow: Supabase hands us the provider URL, we open it in an
// auth session, then exchange the returned code for a session. Resolves { cancelled: true }
// if the user backs out of the browser. Requires the Google provider enabled in Supabase.
export async function signInWithGoogle(): Promise<{ cancelled: boolean }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: AUTH_REDIRECT_URL, skipBrowserRedirect: true },
  })
  if (error) {
    throw error
  }
  if (!data?.url) {
    throw new Error('Could not start Google sign-in')
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URL)
  if (result.type !== 'success') {
    // 'cancel' / 'dismiss' - the user closed the browser; not an error.
    return { cancelled: true }
  }

  const { queryParams } = Linking.parse(result.url)
  const errorDescription = queryParams?.error_description ?? queryParams?.error
  if (typeof errorDescription === 'string') {
    throw new Error(errorDescription)
  }
  const code = queryParams?.code
  if (typeof code !== 'string') {
    throw new Error('Google sign-in returned no authorization code')
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    // On Android the global auth deep-link listener (use-auth) may have already consumed this
    // single-use code and signed the user in; only surface the error if no session resulted.
    const { data } = await supabase.auth.getSession()
    if (!data?.session) {
      throw exchangeError
    }
  }
  return { cancelled: false }
}
