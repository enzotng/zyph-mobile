import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { TextField } from '@/components/text-field'
import { BottomSheet, Segmented, Surface } from '@/components/ui'
import { memberLabel } from '@/features/group'

import type { PayerMode, PayersEditor as PayersEditorState } from '../hooks/use-payers-editor'
import { MemberRow } from './member-row'
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

// "Paid by" as a compact field (showing the current payer or "Several") opening a bottom sheet: a
// single/multiple toggle, then either a single-select list or per-member amounts with the shared
// remainder banner. Lets it sit in a dense two-column row next to the category.
export function PayersEditor({
  label,
  editor,
  members,
  currentUserId,
  tripCurrency,
  baseCents,
}: PayersEditorProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const [open, setOpen] = useState(false)

  const nameOf = (member: Member) =>
    memberLabel(member, currentUserId, { you: t('common.you'), fallback: t('common.member') })

  const selectedPayer = members.find((m) => m.id === editor.payerId)
  const summary =
    editor.mode === 'single'
      ? selectedPayer
        ? nameOf(selectedPayer)
        : t('common.member')
      : t('payers.severalPeople')

  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? t('expenseForm.paidBy')}
      >
        <Surface
          color={theme.colors.card}
          borderColor={theme.colors.border}
          borderWidth={1}
          radius={theme.radius.md}
          style={styles.field}
        >
          <Text style={styles.fieldText} numberOfLines={1}>
            {summary}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.colors.muted} />
        </Surface>
      </Pressable>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('payers.choosePayer')}>
        <View style={styles.sheet}>
          <Segmented
            options={[
              { value: 'single', label: t('payers.onePerson') },
              { value: 'multiple', label: t('payers.severalPeople') },
            ]}
            value={editor.mode}
            onChange={(value) => editor.setMode(value as PayerMode)}
          />

          {editor.mode === 'single' ? (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  name={nameOf(member)}
                  imageUrl={null}
                  indicator="radio"
                  selected={member.id === editor.payerId}
                  onPress={() => {
                    editor.setPayerId(member.id)
                    setOpen(false)
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            // The hint + rows + remainder scroll together so the fixed Done button below always
            // stays reachable above the keyboard, even with many members on a small screen.
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.hint}>{t('payers.amountsIn', { currency: tripCurrency })}</Text>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  name={nameOf(member)}
                  imageUrl={null}
                  indicator="none"
                  right={
                    <TextField
                      value={editor.amountValueFor(member.id)}
                      onChangeText={(value) => editor.setAmountValue(member.id, value)}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      style={styles.amountInput}
                    />
                  }
                />
              ))}
              <RemainderBanner
                mode="exact"
                allocatedCents={editor.allocatedCents}
                remainderCents={editor.remainderCents}
                isBalanced={editor.isBalanced}
                baseCents={baseCents}
                tripCurrency={tripCurrency}
              />
            </ScrollView>
          )}

          <Button label={t('common.done')} onPress={() => setOpen(false)} />
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
  sheet: {
    gap: theme.gap(3),
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    paddingBottom: theme.gap(1),
  },
  hint: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
  },
  amountInput: {
    width: theme.gap(24),
    textAlign: 'right',
  },
}))
