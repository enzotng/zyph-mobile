import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { haptics } from '@/lib/haptics'

import { Surface } from './surface'

type SegmentedOption = {
  label: string
  value: string
}

type SegmentedProps = {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
}

export function Segmented({ options, value, onChange }: SegmentedProps) {
  const { theme } = useUnistyles()
  const optionRadius = theme.radius.md - 4

  return (
    <Surface radius={theme.radius.md} style={styles.container}>
      {options.map((option) => {
        const selected = option.value === value
        const label = (
          <Text style={[styles.label, selected ? styles.labelActive : styles.labelInactive]}>
            {option.label}
          </Text>
        )
        return (
          <Pressable
            key={option.value}
            style={({ pressed }) => [styles.pressable, pressed && !selected && styles.pressed]}
            onPress={() => {
              if (!selected) {
                haptics.selection()
                onChange(option.value)
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            {selected ? (
              <Surface
                radius={optionRadius}
                color={theme.colors.background}
                borderWidth={0}
                style={styles.option}
              >
                {label}
              </Surface>
            ) : (
              <View style={styles.option}>{label}</View>
            )}
          </Pressable>
        )
      })}
    </Surface>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: 'row',
    padding: theme.gap(1),
    gap: theme.gap(1),
  },
  pressable: {
    flex: 1,
  },
  option: {
    paddingVertical: theme.gap(2),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    fontFamily: theme.fonts.sans.regular,
  },
  labelActive: {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
  },
  labelInactive: {
    color: theme.colors.muted,
  },
}))
