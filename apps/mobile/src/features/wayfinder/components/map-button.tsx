import { Ionicons } from '@expo/vector-icons'
import { Pressable } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Surface } from '@/components/ui'
import { haptics } from '@/lib/haptics'

export type MapButtonTone = 'default' | 'primary'

type MapButtonProps = {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  // 'default' matches today's look (fill + border, foreground icon); 'primary' fills with the
  // theme's primary colour and uses primaryForeground for the icon, for the emphasised control
  // in a stacked column (e.g. the map's "add place" button).
  tone?: MapButtonTone
}

export function MapButton({ icon, label, onPress, tone = 'default' }: MapButtonProps) {
  const { theme } = useUnistyles()
  const primary = tone === 'primary'
  return (
    <Pressable
      onPress={() => {
        haptics.selection()
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <Surface
        radius={theme.radius.full}
        color={primary ? theme.colors.primary : theme.colors.background}
        borderColor={primary ? theme.colors.primary : theme.colors.border}
        borderWidth={1}
        style={styles.button}
      >
        <Ionicons
          name={icon}
          size={20}
          color={primary ? theme.colors.primaryForeground : theme.colors.foreground}
        />
      </Surface>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  button: {
    width: theme.gap(11),
    height: theme.gap(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
}))
