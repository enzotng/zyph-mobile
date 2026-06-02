import { Pressable, ScrollView, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Squircle } from '@/components/ui/squircle'

type CurrencySelectProps = {
  label?: string
  value: string
  currencies: string[]
  onChange: (currency: string) => void
}

export function CurrencySelect({ label, value, currencies, onChange }: CurrencySelectProps) {
  const { theme } = useUnistyles()

  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
      >
        {currencies.map((code) => {
          const active = code === value
          return (
            <Pressable
              key={code}
              onPress={() => onChange(code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Squircle
                radius={theme.radius.md}
                color={active ? theme.colors.primary : theme.colors.card}
                borderColor={active ? theme.colors.primary : theme.colors.border}
                style={styles.chip}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{code}</Text>
              </Squircle>
            </Pressable>
          )
        })}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create((theme) => ({
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  row: {
    gap: theme.gap(2),
    paddingVertical: theme.gap(1),
  },
  chip: {
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(4),
  },
  chipText: {
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  chipTextActive: {
    color: theme.colors.primaryForeground,
  },
}))
