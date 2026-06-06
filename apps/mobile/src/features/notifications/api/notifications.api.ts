import { supabase } from '@/lib/supabase'

import type { Notification, NotificationPreferences } from '../schemas'

// Lists the signed-in user's notifications, newest first. RLS scopes rows to the recipient,
// so no user-id filter is needed here. Capped at 100 - a trip app never accrues more that
// matter, and the badge counts unread within this set.
export async function listNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    throw error
  }
  return data
}

// read_at is set server-side via a SECURITY DEFINER RPC scoped to auth.uid(); there is no
// client UPDATE policy on notifications.
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', { _id: id })
  if (error) {
    throw error
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read')
  if (error) {
    throw error
  }
}

// Returns the user's preferences row, or null when none exists yet (absence means every
// category is enabled - the server defaults).
export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    throw error
  }
  return data
}

export type NotificationPreferenceInput = {
  userId: string
  pushEnabled: boolean
  membersEnabled: boolean
  expensesEnabled: boolean
  settlementsEnabled: boolean
  timelineEnabled: boolean
}

// Upserts the full preferences row (the UI always sends the complete set), so a toggle can
// never leave a column at a stale default.
export async function upsertNotificationPreferences(
  input: NotificationPreferenceInput,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: input.userId,
        push_enabled: input.pushEnabled,
        members_enabled: input.membersEnabled,
        expenses_enabled: input.expensesEnabled,
        settlements_enabled: input.settlementsEnabled,
        timeline_enabled: input.timelineEnabled,
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}
