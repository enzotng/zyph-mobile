import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TextField } from '@/components/text-field'
import { Surface } from '@/components/ui'
import { formatAmount } from '@/lib/money'

import type { SplitEditor } from '../hooks/use-split-editor'

type Member = { id: string; user_id: string | null; display_name: string | null }

type SplitMemberRowProps = {
  member: Member
  split: SplitEditor
  tripCurrency: string
  currentUserId?: string
}

// One member row in the split editor: checkbox + name, then a mode-dependent control (none for
// equal, a weight stepper for shares, an amount field for exact, a % field for percent) + the live
// computed share.
export function SplitMemberRow({
  member,
  split,
  tripCurrency,
  currentUserId,
}: SplitMemberRowProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()

  const included = split.isIncluded(member.id)
  const weight = split.weightFor(member.id)
  const share = split.shareByMember.get(member.id)
  const name =
    member.user_id === currentUserId ? t('common.you') : (member.display_name ?? t('common.member'))

  return (
    <View style={styles.memberRow}>
      <Pressable
        style={styles.memberLeft}
        onPress={() => split.toggle(member.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: included }}
      >
        <Ionicons
          name={included ? 'checkbox' : 'square-outline'}
          size={22}
          color={included ? theme.colors.primary : theme.colors.muted}
        />
        <Text style={styles.memberName}>{name}</Text>
      </Pressable>

      {included ? (
        <View style={styles.memberRight}>
          {split.mode === 'shares' ? (
            <Surface
              color="transparent"
              borderColor={theme.colors.border}
              borderWidth={1}
              radius={theme.radius.md}
              style={styles.stepper}
            >
              <Pressable
                onPress={() => split.setWeight(member.id, weight - 1)}
                accessibilityRole="button"
                accessibilityLabel={t('expenseForm.decreaseShares')}
                hitSlop={6}
              >
                <Ionicons name="remove" size={18} color={theme.colors.foreground} />
              </Pressable>
              <Text style={styles.weight}>{weight}</Text>
              <Pressable
                onPress={() => split.setWeight(member.id, weight + 1)}
                accessibilityRole="button"
                accessibilityLabel={t('expenseForm.increaseShares')}
                hitSlop={6}
              >
                <Ionicons name="add" size={18} color={theme.colors.foreground} />
              </Pressable>
            </Surface>
          ) : null}

          {split.mode === 'exact' ? (
            <TextField
              keyboardType="decimal-pad"
              placeholder="0.00"
              value={split.exactValueFor(member.id)}
              onChangeText={(raw) => split.setExactValue(member.id, raw)}
              style={styles.amountInput}
            />
          ) : null}

          {split.mode === 'percent' ? (
            <>
              <TextField
                keyboardType="decimal-pad"
                placeholder="0"
                value={split.percentValueFor(member.id)}
                onChangeText={(raw) => split.setPercentValue(member.id, raw)}
                style={styles.percentInput}
              />
              <Text style={styles.percentSign}>%</Text>
            </>
          ) : null}

          <Text style={styles.share}>
            {share === undefined ? '-' : formatAmount(share, tripCurrency)}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(2),
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    flex: 1,
  },
  memberName: {
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.foreground,
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingHorizontal: theme.gap(2),
    paddingVertical: theme.gap(1),
  },
  weight: {
    minWidth: theme.gap(4),
    textAlign: 'center',
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.foreground,
  },
  amountInput: {
    width: theme.gap(20),
    textAlign: 'right',
  },
  percentInput: {
    width: theme.gap(14),
    textAlign: 'right',
  },
  percentSign: {
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.muted,
  },
  share: {
    minWidth: theme.gap(16),
    textAlign: 'right',
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.foreground,
  },
}))
