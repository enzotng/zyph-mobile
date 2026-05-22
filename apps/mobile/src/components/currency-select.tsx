import { Pressable, ScrollView, Text } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

type CurrencySelectProps = {
  label?: string
  value: string
  currencies: string[]
  onChange: (currency: string) => void
}

export function CurrencySelect({ label, value, currencies, onChange }: CurrencySelectProps) {
  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {currencies.map((code) => {
          const active = code === value
          return (
            <Pressable
              key={code}
              style={[styles.chip, active ? styles.chipActive : null]}
              onPress={() => onChange(code)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{code}</Text>
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
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  chipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  chipText: {
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  chipTextActive: {
    color: theme.colors.primaryForeground,
  },
}))
