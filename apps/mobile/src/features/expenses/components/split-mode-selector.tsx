import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { BottomSheet, ListRow } from '@/components/ui'

import { SPLIT_MODES, type SplitMode } from '../split-modes'

type SplitModeSelectorProps = {
  mode: SplitMode
  onChange: (mode: SplitMode) => void
}

// Compact "Egal v" dropdown (Tricount-style) opening a sheet of the four split modes, so the split
// section header stays a single line instead of a full-width segmented bar.
export function SplitModeSelector({ mode, onChange }: SplitModeSelectorProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('expenseForm.splitMode')}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={styles.triggerText}>{t(`expenseForm.mode_${mode}`)}</Text>
        <Ionicons name="chevron-down" size={16} color={theme.colors.muted} />
      </Pressable>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('expenseForm.splitMode')}>
        {SPLIT_MODES.map((m, index) => {
          const selected = m === mode
          return (
            <ListRow
              key={m}
              title={t(`expenseForm.mode_${m}`)}
              right={
                <View style={styles.check}>
                  {selected ? (
                    <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                  ) : null}
                </View>
              }
              onPress={() => {
                onChange(m)
                setOpen(false)
              }}
              last={index === SPLIT_MODES.length - 1}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            />
          )
        })}
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create((theme) => ({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
  },
  triggerText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  check: {
    width: 20,
    alignItems: 'center',
  },
}))
