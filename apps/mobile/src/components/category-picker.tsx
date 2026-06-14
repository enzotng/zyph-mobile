import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { BottomSheet, ListRow, Surface } from '@/components/ui'
import { CATEGORY_ICON, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/features/expenses'

type CategoryPickerProps = {
  label?: string
  value: ExpenseCategory | null
  onChange: (next: ExpenseCategory | null) => void
}

// Compact field (icon + label + chevron) opening a bottom sheet of categories, so it can sit in a
// dense two-column row next to "Paid by" - matching the flat expense form.
export function CategoryPicker({ label, value, onChange }: CategoryPickerProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const [open, setOpen] = useState(false)

  const select = (next: ExpenseCategory | null) => {
    onChange(next)
    setOpen(false)
  }

  const check = (selected: boolean) => (
    <View style={styles.check}>
      {selected ? <Ionicons name="checkmark" size={20} color={theme.colors.primary} /> : null}
    </View>
  )

  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? t('expenseForm.category')}
      >
        <Surface
          color={theme.colors.card}
          borderColor={theme.colors.border}
          borderWidth={1}
          radius={theme.radius.md}
          style={styles.field}
        >
          {value ? (
            <Ionicons name={CATEGORY_ICON[value]} size={18} color={theme.colors.foreground} />
          ) : null}
          <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
            {value ? t(`categories.${value}`) : t('categories.none')}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.colors.muted} />
        </Surface>
      </Pressable>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('expenseForm.category')}>
        <ListRow
          title={t('categories.none')}
          right={check(value === null)}
          onPress={() => select(null)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === null }}
        />
        {EXPENSE_CATEGORIES.map((category, index) => (
          <ListRow
            key={category}
            icon={CATEGORY_ICON[category]}
            title={t(`categories.${category}`)}
            right={check(value === category)}
            onPress={() => select(category)}
            last={index === EXPENSE_CATEGORIES.length - 1}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === category }}
          />
        ))}
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create((theme) => ({
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    minHeight: 48,
    paddingHorizontal: theme.gap(3),
  },
  fieldText: {
    flex: 1,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  placeholder: {
    color: theme.colors.muted,
  },
  check: {
    width: 20,
    alignItems: 'center',
  },
}))
