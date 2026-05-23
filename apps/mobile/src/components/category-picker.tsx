import { Pressable, ScrollView, Text } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/features/expenses'

type CategoryPickerProps = {
  label?: string
  value: ExpenseCategory | null
  onChange: (next: ExpenseCategory | null) => void
}

const LABELS: Record<ExpenseCategory, string> = {
  food: 'Food',
  transport: 'Transport',
  lodging: 'Lodging',
  activity: 'Activity',
  shopping: 'Shopping',
  other: 'Other',
}

export function CategoryPicker({ label, value, onChange }: CategoryPickerProps) {
  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
      >
        <Pressable
          onPress={() => onChange(null)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === null }}
          style={[styles.chip, value === null ? styles.chipActive : null]}
        >
          <Text style={[styles.chipText, value === null ? styles.chipTextActive : null]}>None</Text>
        </Pressable>
        {EXPENSE_CATEGORIES.map((category) => {
          const selected = category === value
          return (
            <Pressable
              key={category}
              onPress={() => onChange(category)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>
                {LABELS[category]}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </>
  )
}

export function categoryLabel(category: ExpenseCategory | null | undefined): string | null {
  if (!category) {
    return null
  }
  return LABELS[category]
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
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(2),
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
    color: theme.colors.foreground,
    fontWeight: '500',
  },
  chipTextActive: {
    color: theme.colors.primaryForeground,
    fontWeight: '600',
  },
}))
