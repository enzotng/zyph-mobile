import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline-first posture; PowerSync local-first sync lands in a later sprint.
      networkMode: 'offlineFirst',
      staleTime: 30_000,
      retry: 2,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})
