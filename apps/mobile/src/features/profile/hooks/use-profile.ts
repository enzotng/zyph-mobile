import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/features/auth'
import { getProfile } from '../api/profile.api'

// The profile (name, email, preferred currency) rarely changes within a session.
const FIVE_MINUTES = 5 * 60 * 1000

export function useProfile() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    // getProfile throws without a session; only run once signed in.
    enabled: Boolean(session),
    staleTime: FIVE_MINUTES,
  })
}
