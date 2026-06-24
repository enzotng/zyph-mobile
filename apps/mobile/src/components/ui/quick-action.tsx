import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

import { Surface } from './surface'

type QuickActionProps = {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
  tone?: string
}

export function QuickAction({ icon, label, onPress, tone }: QuickActionProps) {
  const { theme } = useUnistyles()

  const resolvedColor = tone ?? theme.colors.primary
  const iconBg = withAlpha(resolvedColor, 0.14)

  const handlePress = () => {
    haptics.light()
    onPress?.()
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Surface style={styles.tile}>
        <Surface
          width={42}
          height={42}
          radius={theme.radius.md}
          color={iconBg}
          borderWidth={0}
          style={styles.iconWrapper}
        >
          <Ionicons name={icon} size={22} color={resolvedColor} />
        </Surface>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </Surface>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  pressable: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  tile: {
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(4),
    paddingHorizontal: theme.gap(2),
  },
  iconWrapper: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: theme.colors.foreground,
    textAlign: 'center',
  },
}))
