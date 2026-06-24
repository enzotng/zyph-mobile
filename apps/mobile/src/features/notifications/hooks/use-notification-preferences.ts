import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getNotificationPreferences,
  type NotificationPreferenceInput,
  upsertNotificationPreferences,
} from '../api/notifications.api'
import type { NotificationPreferences } from '../schemas'

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

// Snapshot of the cached row captured in onMutate so onError can roll the Switch back. null is
// a legitimate cached value (no preferences row yet = all categories on).
type PreferencesSnapshot = { previous: NotificationPreferences | null | undefined }

export function useUpdateNotificationPreferences(userId: string) {
  const queryClient = useQueryClient()
  const queryKey = notificationPreferencesQueryKey(userId)
  return useMutation({
    mutationFn: (input: NotificationPreferenceInput) => upsertNotificationPreferences(input),
    // Optimistically reflect the toggle so the Switch flips instantly; a failed upsert is rolled
    // back in onError rather than silently reverting on the next refetch.
    onMutate: async (input): Promise<PreferencesSnapshot> => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<NotificationPreferences | null>(queryKey)
      // Write the full row (the UI always sends the complete set), seeding one when none exists
      // yet so the very first toggle flips the Switch optimistically too.
      queryClient.setQueryData<NotificationPreferences>(queryKey, (current) => ({
        user_id: input.userId,
        updated_at: current?.updated_at ?? new Date().toISOString(),
        push_enabled: input.pushEnabled,
        members_enabled: input.membersEnabled,
        expenses_enabled: input.expensesEnabled,
        settlements_enabled: input.settlementsEnabled,
        timeline_enabled: input.timelineEnabled,
        packing_enabled: input.packingEnabled,
      }))
      return { previous }
    },
    onError: (_error, _input, context) => {
      // Roll the cache back to the pre-mutation snapshot so the Switch returns to its real value.
      if (context) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}
