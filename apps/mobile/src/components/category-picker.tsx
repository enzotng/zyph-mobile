import { Pressable, ScrollView, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Squircle } from '@/components/ui/squircle'
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
  const { theme } = useUnistyles()

  function renderChip(key: string, text: string, selected: boolean, onPress: () => void) {
    return (
      <Pressable
        key={key}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <Squircle
          radius={theme.radius.md}
          color={selected ? theme.colors.primary : theme.colors.card}
          borderColor={selected ? theme.colors.primary : theme.colors.border}
          style={styles.chip}
        >
          <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{text}</Text>
        </Squircle>
      </Pressable>
    )
  }

  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
      >
        {renderChip('none', 'None', value === null, () => onChange(null))}
        {EXPENSE_CATEGORIES.map((category) =>
          renderChip(category, LABELS[category], category === value, () => onChange(category)),
        )}
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
