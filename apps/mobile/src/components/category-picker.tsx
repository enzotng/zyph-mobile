import { useTranslation } from 'react-i18next'
import { ScrollView, Text } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Chip } from '@/components/ui'
import { CATEGORY_ICON, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/features/expenses'

type CategoryPickerProps = {
  label?: string
  value: ExpenseCategory | null
  onChange: (next: ExpenseCategory | null) => void
}

// Category selector built on the shared Chip primitive (same look, haptics and category icons as
// the expense-feed filter), so picking a category feels identical wherever it appears.
export function CategoryPicker({ label, value, onChange }: CategoryPickerProps) {
  const { t } = useTranslation()

  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Chip
          label={t('categories.none')}
          selected={value === null}
          onPress={() => onChange(null)}
        />
        {EXPENSE_CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={t(`categories.${category}`)}
            icon={CATEGORY_ICON[category]}
            selected={category === value}
            onPress={() => onChange(category)}
          />
        ))}
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
}))
