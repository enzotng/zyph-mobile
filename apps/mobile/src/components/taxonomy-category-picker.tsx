import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
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

type TaxonomyCategoryPickerProps = {
  label: string
  flag: 'events' | 'expenses'
  category: string | null
  subcategory: string | null
  onChange: (next: { category: string | null; subcategory: string | null }) => void
  allowNone?: boolean
}

const NONE_ICON = 'close-circle-outline'

// Root chips (one per flag-visible root, optionally led by a "None" chip when `allowNone`) + an
// optional subcategory bottom sheet. Picking a new root clears the subcategory (a leaf must
// always belong to the selected root); the sheet lets the user refine or reset to "None".
export function TaxonomyCategoryPicker({
  label,
  flag,
  category,
  subcategory,
  onChange,
  allowNone = false,
}: TaxonomyCategoryPickerProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)

  const roots = useMemo(() => categoriesForFlag(flag), [flag])
  const subs = useMemo(
    () => (category ? subcategoriesForFlag(category, flag) : []),
    [category, flag],
  )

  const check = (selected: boolean) => (
    <View style={styles.check}>
      {selected ? <Ionicons name="checkmark" size={20} color={theme.colors.primary} /> : null}
    </View>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {allowNone ? (
          <Pressable
            onPress={() => onChange({ category: null, subcategory: null })}
            accessibilityRole="button"
            accessibilityState={{ selected: category === null }}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Surface
              radius={theme.radius.md}
              color={category === null ? withAlpha(theme.colors.primary, 0.12) : theme.colors.card}
              borderColor={category === null ? theme.colors.primary : theme.colors.border}
              borderWidth={1.5}
              style={styles.chip}
            >
              <Ionicons
                name={NONE_ICON}
                size={18}
                color={category === null ? theme.colors.primary : theme.colors.muted}
              />
              <Text style={[styles.chipLabel, category === null && styles.chipLabelActive]}>
                {t('categories.none')}
              </Text>
            </Surface>
          </Pressable>
        ) : null}
        {roots.map((root) => {
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

      {category !== null && subs.length > 0 ? (
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

      {category !== null ? (
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
      ) : null}
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
