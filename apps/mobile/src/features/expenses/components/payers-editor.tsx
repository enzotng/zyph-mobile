import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { PaidBySelect } from '@/components/paid-by-select'
import { TextField } from '@/components/text-field'

import type { PayersEditor as PayersEditorState } from '../hooks/use-payers-editor'
import { RemainderBanner } from './remainder-banner'

type Member = { id: string; user_id: string | null; display_name: string | null }

type PayersEditorProps = {
  label?: string
  editor: PayersEditorState
  members: readonly Member[]
  currentUserId?: string
  // Multi-payer amounts are entered in trip currency, like the split shares.
  tripCurrency: string
  baseCents: number | null
}

// "Paid by" control: a single payer (chip row) or, toggled to multiple, a per-member amount entry
// validated against the trip-currency total via the shared remainder banner.
export function PayersEditor({
  label,
  editor,
  members,
  currentUserId,
  tripCurrency,
  baseCents,
}: PayersEditorProps) {
  const { t } = useTranslation()

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.toggle} accessibilityRole="tablist">
        <ToggleButton
          label={t('payers.single')}
          active={editor.mode === 'single'}
          onPress={() => editor.setMode('single')}
        />
        <ToggleButton
          label={t('payers.multiple')}
          active={editor.mode === 'multiple'}
          onPress={() => editor.setMode('multiple')}
        />
      </View>

      {editor.mode === 'single' ? (
        <PaidBySelect
          value={editor.payerId}
          members={members}
          currentUserId={currentUserId}
          onChange={editor.setPayerId}
        />
      ) : (
        <View style={styles.rows}>
          <Text style={styles.hint}>{t('payers.amountsIn', { currency: tripCurrency })}</Text>
          {members.map((member) => {
            const name =
              member.user_id === currentUserId
                ? t('common.you')
                : (member.display_name ?? t('common.member'))
            return (
              <View key={member.id} style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <View style={styles.field}>
                  <TextField
                    value={editor.amountValueFor(member.id)}
                    onChangeText={(value) => editor.setAmountValue(member.id, value)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
              </View>
            )
          })}
          <RemainderBanner
            mode="exact"
            allocatedCents={editor.allocatedCents}
            remainderCents={editor.remainderCents}
            isBalanced={editor.isBalanced}
            baseCents={baseCents}
            tripCurrency={tripCurrency}
          />
        </View>
      )}
    </View>
  )
}

function ToggleButton({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.toggleBtn, active ? styles.toggleBtnActive : null]}
    >
      <Text style={[styles.toggleText, active ? styles.toggleTextActive : null]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(2),
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  toggle: {
    flexDirection: 'row',
    gap: theme.gap(2),
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.gap(2),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  toggleBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  toggleText: {
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  toggleTextActive: {
    color: theme.colors.primaryForeground,
  },
  rows: {
    gap: theme.gap(2),
  },
  hint: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  field: {
    width: theme.gap(28),
  },
}))
