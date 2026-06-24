import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Surface } from '@/components/ui'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { formatAmount } from '@/lib/money'

// Compact, share-aware money strip for the cockpit: the current user's net balance with a tone
// (owe / owed / settled) and a chevron through to the full balances. The big balance card and
// the settlement detail live in the Spend tab.
export function TripBalanceStrip({
  cents,
  currency,
  onPress,
}: {
  cents: number
  currency: string
  onPress: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  const settled = cents === 0
  const positive = cents > 0
  const tone = settled
    ? theme.colors.foreground
    : positive
      ? theme.colors.success
      : theme.colors.destructive
  const label = settled ? t('trip.settled') : positive ? t('trip.owed') : t('trip.owe')
  const amount = formatAmount(Math.abs(cents), currency)

  const press = () => {
    haptics.light()
    onPress()
  }

  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={settled ? label : `${label}, ${amount}`}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <Surface radius={theme.radius.lg} style={styles.strip}>
        <View
          style={[
            styles.iconTile,
            {
              backgroundColor: withAlpha(
                settled ? theme.colors.success : theme.colors.primary,
                0.12,
              ),
            },
          ]}
        >
          <Ionicons
            name={settled ? 'checkmark-done' : 'wallet-outline'}
            size={20}
            color={settled ? theme.colors.success : theme.colors.primary}
          />
        </View>
        <View style={styles.body}>
          <Text style={styles.label}>{label}</Text>
          {settled ? null : (
            <Text style={[styles.amount, { color: tone }]} numberOfLines={1}>
              {amount}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
      </Surface>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(3.5),
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  amount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
    letterSpacing: -0.2,
  },
  pressed: {
    opacity: 0.85,
  },
}))
