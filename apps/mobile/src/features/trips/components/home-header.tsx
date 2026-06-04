import { Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Avatar } from '@/components/ui'

type HomeHeaderProps = {
  greeting: string
  subtitle: string
  avatarName?: string
  avatarUrl?: string | null
  onAvatarPress: () => void
}

// Left-aligned greeting + trip-count subtitle, with a tappable circular avatar on the right.
// Reproduces the safe-area top padding that AppHeader provides (the home screen drops the
// shared title bar in favour of this).
export function HomeHeader({
  greeting,
  subtitle,
  avatarName,
  avatarUrl,
  onAvatarPress,
}: HomeHeaderProps) {
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
      <Pressable onPress={onAvatarPress} accessibilityRole="button" hitSlop={8}>
        <Avatar name={avatarName} imageUrl={avatarUrl} size={44} />
      </Pressable>
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
