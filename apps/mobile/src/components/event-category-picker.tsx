import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { BottomSheet, ListRow, Surface } from '@/components/ui'
import {
  categoriesForFlag,
  iconForCode,
  labelKeyForCode,
  subcategoriesForFlag,
} from '@/features/taxonomy'
import { withAlpha } from '@/lib/color'

type EventCategoryPickerProps = {
  label: string
  category: string
  subcategory: string | null
  onChange: (next: { category: string; subcategory: string | null }) => void
}

const EVENT_ROOTS = categoriesForFlag('events')

// Root chips (one per events-flagged root) + an optional subcategory bottom sheet. Picking a new
// root clears the subcategory (a leaf must always belong to the selected root); the sheet lets the
// user refine or reset to "None".
export function EventCategoryPicker({
  label,
  category,
  subcategory,
  onChange,
}: EventCategoryPickerProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)

  const subs = subcategoriesForFlag(category, 'events')

  const check = (selected: boolean) => (
    <View style={styles.check}>
      {selected ? <Ionicons name="checkmark" size={20} color={theme.colors.primary} /> : null}
    </View>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {EVENT_ROOTS.map((root) => {
          const selected = root.code === category
          return (
            <Pressable
              key={root.code}
              onPress={() => onChange({ category: root.code, subcategory: null })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}
            >
              <Surface
                radius={theme.radius.md}
                color={selected ? withAlpha(theme.colors.primary, 0.12) : theme.colors.card}
                borderColor={selected ? theme.colors.primary : theme.colors.border}
                borderWidth={1.5}
                style={styles.chip}
              >
                <Ionicons
                  name={iconForCode(root.code, null)}
                  size={18}
                  color={selected ? theme.colors.primary : theme.colors.muted}
                />
                <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>
                  {t(labelKeyForCode(root.code))}
                </Text>
              </Surface>
            </Pressable>
          )
        })}
      </View>

      {subs.length > 0 ? (
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('events.form.subcategory')}
          style={({ pressed }) => (pressed ? styles.pressed : undefined)}
        >
          <Surface
            color={theme.colors.card}
            borderColor={theme.colors.border}
            borderWidth={1}
            radius={theme.radius.md}
            style={styles.field}
          >
            <Ionicons
              name={iconForCode(category, subcategory)}
              size={18}
              color={theme.colors.foreground}
            />
            <Text style={[styles.fieldText, !subcategory && styles.placeholder]} numberOfLines={1}>
              {subcategory ? t(labelKeyForCode(subcategory)) : t('events.form.subcategoryNone')}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.colors.muted} />
          </Surface>
        </Pressable>
      ) : null}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('events.form.subcategory')}
      >
        <ListRow
          title={t('events.form.subcategoryNone')}
          right={check(subcategory === null)}
          onPress={() => {
            onChange({ category, subcategory: null })
            setSheetOpen(false)
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: subcategory === null }}
        />
        {subs.map((leaf, index) => (
          <ListRow
            key={leaf.code}
            icon={leaf.icon}
            title={t(labelKeyForCode(leaf.code))}
            right={check(subcategory === leaf.code)}
            onPress={() => {
              onChange({ category, subcategory: leaf.code })
              setSheetOpen(false)
            }}
            last={index === subs.length - 1}
            accessibilityRole="radio"
            accessibilityState={{ selected: subcategory === leaf.code }}
          />
        ))}
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.gap(2) },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.foreground,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.gap(2) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
  },
  chipLabel: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    color: theme.colors.muted,
  },
  chipLabelActive: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
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
  placeholder: { color: theme.colors.muted },
  check: { width: 20, alignItems: 'center' },
  pressed: { opacity: 0.85 },
}))
