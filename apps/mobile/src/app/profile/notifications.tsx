import { useTranslation } from 'react-i18next'
import { Switch, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { ListRow, Spinner, Surface } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/features/notifications'

type PrefKey = 'push' | 'members' | 'expenses' | 'settlements' | 'timeline' | 'packing'

export default function NotificationPreferencesScreen() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const { data, isLoading } = useNotificationPreferences(userId)
  const update = useUpdateNotificationPreferences(userId)

  // No row yet means every category is enabled (the server default).
  const resolved: Record<PrefKey, boolean> = {
    push: data?.push_enabled ?? true,
    members: data?.members_enabled ?? true,
    expenses: data?.expenses_enabled ?? true,
    settlements: data?.settlements_enabled ?? true,
    timeline: data?.timeline_enabled ?? true,
    packing: data?.packing_enabled ?? true,
  }

  function toggle(key: PrefKey, value: boolean) {
    const next = { ...resolved, [key]: value }
    update.mutate({
      userId,
      pushEnabled: next.push,
      membersEnabled: next.members,
      expensesEnabled: next.expenses,
      settlementsEnabled: next.settlements,
      timelineEnabled: next.timeline,
      packingEnabled: next.packing,
    })
  }

  function switchFor(key: PrefKey) {
    return (
      <Switch
        value={resolved[key]}
        onValueChange={(value) => toggle(key, value)}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        disabled={!userId}
        accessibilityLabel={t(`notifications.preferences.${key}`)}
      />
    )
  }

  if (isLoading) {
    return (
      <Screen title={t('notifications.preferences.title')}>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title={t('notifications.preferences.title')} scroll>
      <Surface
        color={theme.colors.card}
        borderColor={theme.colors.border}
        borderWidth={1}
        radius={theme.radius.lg}
        style={styles.card}
      >
        <ListRow
          icon="phone-portrait-outline"
          title={t('notifications.preferences.push')}
          subtitle={t('notifications.preferences.pushHint')}
          right={switchFor('push')}
          last
        />
      </Surface>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>{t('notifications.preferences.categories')}</Text>
        <Surface
          color={theme.colors.card}
          borderColor={theme.colors.border}
          borderWidth={1}
          radius={theme.radius.lg}
          style={styles.card}
        >
          <ListRow
            icon="people-outline"
            title={t('notifications.preferences.members')}
            right={switchFor('members')}
          />
          <ListRow
            icon="card-outline"
            title={t('notifications.preferences.expenses')}
            right={switchFor('expenses')}
          />
          <ListRow
            icon="swap-horizontal-outline"
            title={t('notifications.preferences.settlements')}
            right={switchFor('settlements')}
          />
          <ListRow
            icon="calendar-outline"
            title={t('notifications.preferences.timeline')}
            right={switchFor('timeline')}
          />
          <ListRow
            icon="bag-handle-outline"
            title={t('notifications.preferences.packing')}
            right={switchFor('packing')}
            last
          />
        </Surface>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    paddingHorizontal: theme.gap(4),
  },
  group: {
    gap: theme.gap(2),
  },
  groupTitle: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
}))
