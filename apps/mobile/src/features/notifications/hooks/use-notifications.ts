import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.api'
import type { Notification } from '../schemas'

export const notificationsQueryKey = ['notifications'] as const

export function useNotifications() {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: listNotifications,
    staleTime: 30_000,
  })
}

// Shares the notifications cache (same key) and derives the unread badge count, so the badge
// and the list never disagree and only one request is made.
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: listNotifications,
    staleTime: 30_000,
    select: (data: Notification[]) => data.filter((n) => n.read_at === null).length,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
    },
  })
}
