import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Chip } from '@/components/ui'

export type ChipOption<T extends string> = {
  value: T
  label: string
}

type SingleProps<T extends string> = {
  label: string
  options: ChipOption<T>[]
  value: T | null
  // Tapping the selected chip clears the field (passes null) - the field is optional.
  onChange: (value: T | null) => void
}

// A labelled wrap of single-select chips. Re-tapping the current value unsets it (null),
// which the trip-profile fields use to mean "no preference".
export function SingleChipField<T extends string>({
  label,
  options,
  value,
  onChange,
}: SingleProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value
          return (
            <Chip
              key={option.value}
              label={option.label}
              selected={selected}
              onPress={() => onChange(selected ? null : option.value)}
            />
          )
        })}
      </View>
    </View>
  )
}

type MultiProps<T extends string> = {
  label: string
  options: ChipOption<T>[]
  values: T[]
  onChange: (values: T[]) => void
}

// A labelled wrap of multi-select chips. Toggling adds/removes the value, preserving order.
export function MultiChipField<T extends string>({
  label,
  options,
  values,
  onChange,
}: MultiProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = values.includes(option.value)
          return (
            <Chip
              key={option.value}
              label={option.label}
              selected={selected}
              onPress={() =>
                onChange(
                  selected ? values.filter((v) => v !== option.value) : [...values, option.value],
                )
              }
            />
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(2),
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.foreground,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
}))
