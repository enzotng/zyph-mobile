import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Surface } from '@/components/ui'
import { withAlpha } from '@/lib/color'
import { formatAmount } from '@/lib/money'

import type { SplitMode } from '../split-modes'

type RemainderBannerProps = {
  mode: SplitMode
  allocatedCents: number
  remainderCents: number
  isBalanced: boolean
  baseCents: number | null
  tripCurrency: string
}

// Live allocation feedback for exact/percent modes (equal/shares always balance, so it hides).
export function RemainderBanner({
  mode,
  allocatedCents,
  remainderCents,
  isBalanced,
  baseCents,
  tripCurrency,
}: RemainderBannerProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()

  if (mode === 'equal' || mode === 'shares') {
    return null
  }

  const tone = isBalanced ? theme.colors.success : theme.colors.warning
  const over = remainderCents < 0

  return (
    <Surface
      color={withAlpha(tone, 0.12)}
      borderWidth={0}
      radius={theme.radius.md}
      style={styles.banner}
    >
      <Ionicons name={isBalanced ? 'checkmark-circle' : 'alert-circle'} size={18} color={tone} />
      <Text style={[styles.text, { color: tone }]}>
        {isBalanced
          ? t('expenseForm.splitBalanced')
          : t(over ? 'expenseForm.splitRemainderOver' : 'expenseForm.splitRemainderLeft', {
              allocated: formatAmount(allocatedCents, tripCurrency),
              total: formatAmount(baseCents ?? 0, tripCurrency),
              remainder: formatAmount(Math.abs(remainderCents), tripCurrency),
            })}
      </Text>
    </Surface>
  )
}

const styles = StyleSheet.create((theme) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
  },
  text: {
    flex: 1,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
}))
