// Expo inlines EXPO_PUBLIC_* variables into the bundle at build time.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. Copy apps/mobile/.env.example to .env.',
  )
}

export const env = {
  supabaseUrl,
  supabaseKey,
} as const
