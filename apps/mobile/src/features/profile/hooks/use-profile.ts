import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth'
import { getProfile, updateProfile } from '../api/profile.api'

// The profile (name, email, preferred currency) rarely changes within a session.
const FIVE_MINUTES = 5 * 60 * 1000

export const profileQueryKey = ['profile'] as const

export function useProfile() {
  const { session } = useAuth()
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: getProfile,
    // getProfile throws without a session; only run once signed in.
    enabled: Boolean(session),
    staleTime: FIVE_MINUTES,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      // Seed the cache so the profile tab reflects the new values immediately.
      queryClient.setQueryData(profileQueryKey, updated)
    },
  })
}
