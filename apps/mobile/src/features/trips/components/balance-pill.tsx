import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { signedAmount } from '@/lib/money'

type BalancePillProps = {
  cents: number
  currency: string
}

// A translucent pill (light text on a dark glass fill) for the signed balance over a photo,
// with a sign-driven trend icon.
export function BalancePill({ cents, currency }: BalancePillProps) {
  const icon = cents > 0 ? 'trending-up' : cents < 0 ? 'trending-down' : 'remove'

  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={13} color="#FFFFFF" />
      <Text style={styles.text}>{signedAmount(cents, currency)}</Text>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
    paddingVertical: theme.gap(1.5),
    paddingHorizontal: theme.gap(2.5),
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  text: {
    color: '#FFFFFF',
    fontFamily: theme.fonts.display.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
}))
