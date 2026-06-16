import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TextField } from '@/components/text-field'
import { Amount, Surface } from '@/components/ui'
import { memberLabel } from '@/features/group'

import type { SplitEditor } from '../hooks/use-split-editor'
import { MemberRow } from './member-row'

type Member = { id: string; user_id: string | null; display_name: string | null }

type SplitMemberRowProps = {
  member: Member
  split: SplitEditor
  tripCurrency: string
  currentUserId?: string
}

// One member in the split editor, on the shared MemberRow: checkbox + avatar + name, then a
// mode-dependent trailing control (nothing for equal, a stepper for shares, an amount field for
// exact, a % field for percent) followed by the live computed share. Excluded members dim out.
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
  const name = memberLabel(member, currentUserId, {
    you: t('common.you'),
    fallback: t('common.member'),
  })

  const right = included ? (
    <>
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

      {share === undefined ? (
        <Text style={styles.dash}>—</Text>
      ) : (
        <Amount cents={share} currency={tripCurrency} size={15} neutral />
      )}
    </>
  ) : undefined

  return (
    <MemberRow
      name={name}
      imageUrl={null}
      indicator="check"
      selected={included}
      dimmed={!included}
      onPress={() => split.toggle(member.id)}
      right={right}
    />
  )
}

const styles = StyleSheet.create((theme) => ({
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
  dash: {
    minWidth: theme.gap(10),
    textAlign: 'right',
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.muted,
  },
}))
