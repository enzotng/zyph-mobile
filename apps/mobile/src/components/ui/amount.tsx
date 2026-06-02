import { Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { formatAmount, signedAmount } from '@/lib/money'

export type AmountProps = {
  cents: number
  currency?: string
  size?: number
  signed?: boolean
  neutral?: boolean
}

export function Amount({
  cents,
  currency = 'EUR',
  size = 16,
  signed = false,
  neutral = false,
}: AmountProps) {
  const { theme } = useUnistyles()

  const text = signed ? signedAmount(cents, currency) : formatAmount(cents, currency)

  let color: string
  if (neutral) {
    color = theme.colors.foreground
  } else if (cents < 0) {
    color = theme.colors.destructive
  } else if (cents > 0) {
    color = theme.colors.success
  } else {
    color = theme.colors.muted
  }

  return <Text style={[styles.amount, { fontSize: size, color }]}>{text}</Text>
}

const styles = StyleSheet.create(() => ({
  amount: {
    fontWeight: '700',
  },
}))
