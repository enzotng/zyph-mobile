import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Avatar } from '@/components/ui'

type HomeHeaderProps = {
  greeting: string
  subtitle: string
  avatarName?: string
  avatarUrl?: string | null
  onAvatarPress: () => void
  unreadCount?: number
  onNotificationsPress?: () => void
  notificationsLabel?: string
  onAddPress?: () => void
  addLabel?: string
}

// Left-aligned greeting + trip-count subtitle, with a notifications bell (unread badge) and a
// tappable circular avatar on the right. Reproduces the safe-area top padding that AppHeader
// provides (the home screen drops the shared title bar in favour of this).
export function HomeHeader({
  greeting,
  subtitle,
  avatarName,
  avatarUrl,
  onAvatarPress,
  unreadCount = 0,
  onNotificationsPress,
  notificationsLabel,
  onAddPress,
  addLabel,
}: HomeHeaderProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()

  return (
    <View style={styles.header}>
      <View style={styles.text}>
        <Text style={styles.greeting} numberOfLines={1}>
          {greeting}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.actions}>
        {onAddPress ? (
          <Pressable
            onPress={onAddPress}
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            hitSlop={8}
            style={styles.bell}
          >
            <Ionicons name="add" size={26} color={theme.colors.foreground} />
          </Pressable>
        ) : null}
        {onNotificationsPress ? (
          <Pressable
            onPress={onNotificationsPress}
            accessibilityRole="button"
            accessibilityLabel={notificationsLabel}
            hitSlop={8}
            style={styles.bell}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.colors.foreground} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
        <Pressable
          onPress={onAvatarPress}
          accessibilityRole="button"
          accessibilityLabel={t('tabs.profile')}
          hitSlop={8}
        >
          <Avatar name={avatarName} imageUrl={avatarUrl} size={44} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(3),
    paddingTop: rt.insets.top + theme.gap(2),
    paddingBottom: theme.gap(2),
    paddingHorizontal: theme.gap(6),
  },
  text: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  bell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: 10,
    color: theme.colors.primaryForeground,
  },
  greeting: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xl,
    color: theme.colors.foreground,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
}))
