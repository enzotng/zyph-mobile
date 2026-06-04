import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { initialOf } from './avatar'

type ChipProps = {
  label: string
  icon?: keyof typeof Ionicons.glyphMap
  selected?: boolean
  onPress?: () => void
}

export function Chip({ label, icon, selected = false, onPress }: ChipProps) {
  styles.useVariants({ selected })
  const { theme } = useUnistyles()

  const iconColor = selected ? theme.colors.primaryForeground : theme.colors.muted

  return (
    <Pressable
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon ? <Ionicons name={icon} size={16} color={iconColor} /> : null}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

type MemberChipProps = {
  name?: string
  initial?: string
  selected?: boolean
  onPress?: () => void
  size?: number
}

export function MemberChip({
  name,
  initial,
  selected = false,
  onPress,
  size = 44,
}: MemberChipProps) {
  // Enforce minimum tap target of 44
  const resolvedSize = Math.max(44, size)
  const displayInitial = initial ? initial.toUpperCase() : initialOf(name)

  return (
    <Pressable
      style={({ pressed }) => [
        styles.memberChip,
        { width: resolvedSize, height: resolvedSize, borderRadius: resolvedSize / 2 },
        selected ? styles.memberChipSelected : styles.memberChipUnselected,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
    >
      <Text
        style={[
          styles.memberInitial,
          selected ? styles.memberInitialSelected : styles.memberInitialUnselected,
        ]}
      >
        {displayInitial}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
    borderRadius: theme.radius.full,
    borderWidth: 1,
    variants: {
      selected: {
        true: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        false: {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      },
    },
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    variants: {
      selected: {
        true: { color: theme.colors.primaryForeground },
        false: { color: theme.colors.foreground },
      },
    },
  },
  memberChip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
  },
  memberChipUnselected: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1.5,
  },
  memberInitial: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  memberInitialSelected: {
    color: theme.colors.primaryForeground,
  },
  memberInitialUnselected: {
    color: theme.colors.muted,
  },
}))
