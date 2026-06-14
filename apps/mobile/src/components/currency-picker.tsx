import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TextField } from '@/components/text-field'
import { BottomSheet, ListRow, Surface } from '@/components/ui'
import { currencyFlag, currencyName } from '@/lib/currency'

type CurrencyPickerProps = {
  label?: string
  value: string
  currencies: string[]
  onChange: (currency: string) => void
  // Compact: a small flag + code pill (for sitting inline next to the amount field) instead of the
  // full-width flag + name field. Same sheet.
  compact?: boolean
}

// Tappable field showing "<flag> <name>" + the ISO code; opens a searchable bottom sheet of
// currencies (flag + localized name + code, checkmark on the selection). Same {label, value,
// currencies, onChange} contract as the old chip-row select it replaces.
export function CurrencyPicker({
  label,
  value,
  currencies,
  onChange,
  compact = false,
}: CurrencyPickerProps) {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return currencies
    }
    return currencies.filter(
      (code) =>
        code.toLowerCase().includes(q) || currencyName(code, locale).toLowerCase().includes(q),
    )
  }, [currencies, query, locale])

  function close() {
    setOpen(false)
    setQuery('')
  }

  function select(code: string) {
    onChange(code)
    close()
  }

  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? t('currencyPicker.title')}
      >
        {compact ? (
          <Surface
            color={theme.colors.card}
            borderColor={theme.colors.border}
            borderWidth={1}
            radius={theme.radius.md}
            style={styles.compactField}
          >
            <Text style={styles.compactText}>{`${currencyFlag(value)}  ${value}`}</Text>
            <Ionicons name="chevron-down" size={16} color={theme.colors.muted} />
          </Surface>
        ) : (
          <Surface
            color={theme.colors.card}
            borderColor={theme.colors.border}
            borderWidth={1}
            radius={theme.radius.md}
            style={styles.field}
          >
            <Text style={styles.fieldText} numberOfLines={1}>
              {`${currencyFlag(value)}  ${currencyName(value, locale)}`}
            </Text>
            <Text style={styles.fieldCode}>{value}</Text>
            <Ionicons name="chevron-down" size={18} color={theme.colors.muted} />
          </Surface>
        )}
      </Pressable>

      <BottomSheet open={open} onClose={close} title={t('currencyPicker.title')}>
        <View style={styles.sheet}>
          <TextField
            placeholder={t('currencyPicker.search')}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <Text style={styles.empty}>{t('currencyPicker.noResults')}</Text>
            ) : (
              filtered.map((code, index) => {
                const selected = code === value
                return (
                  <ListRow
                    key={code}
                    title={`${currencyFlag(code)}  ${currencyName(code, locale)}`}
                    detail={code}
                    right={
                      <View style={styles.check}>
                        {selected ? (
                          <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                        ) : null}
                      </View>
                    }
                    onPress={() => select(code)}
                    last={index === filtered.length - 1}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={code}
                  />
                )
              })
            )}
          </ScrollView>
        </View>
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
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(3),
  },
  fieldText: {
    flex: 1,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  fieldCode: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  compactField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    minHeight: 48,
    paddingHorizontal: theme.gap(3),
  },
  compactText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  sheet: {
    gap: theme.gap(3),
  },
  list: {
    maxHeight: 360,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: theme.gap(6),
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
  },
  check: {
    width: 20,
    alignItems: 'center',
  },
}))
