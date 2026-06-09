import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getNotificationPreferences,
  type NotificationPreferenceInput,
  upsertNotificationPreferences,
} from '../api/notifications.api'

export function notificationPreferencesQueryKey(userId: string) {
  return ['notification-preferences', userId] as const
}

export function useNotificationPreferences(userId: string) {
  return useQuery({
    queryKey: notificationPreferencesQueryKey(userId),
    queryFn: () => getNotificationPreferences(userId),
    enabled: Boolean(userId),
  })
}

export function useUpdateNotificationPreferences(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NotificationPreferenceInput) => upsertNotificationPreferences(input),
    onSuccess: (data) => {
      queryClient.setQueryData(notificationPreferencesQueryKey(userId), data)
    },
  })
}
