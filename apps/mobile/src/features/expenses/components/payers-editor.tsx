import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TextField } from '@/components/text-field'
import { BottomSheet } from '@/components/ui'

import type { PayersEditor as PayersEditorState } from '../hooks/use-payers-editor'
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

// "Paid by" control. Single payer = a summary row (avatar + name) opening a bottom-sheet picker so
// every member is visible at once, with a discoverable link to switch to multiple payers; multiple
// payers = one amount row per member validated against the total by the shared remainder banner.
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
  const [sheetOpen, setSheetOpen] = useState(false)

  const nameOf = (member: Member) =>
    member.user_id === currentUserId ? t('common.you') : (member.display_name ?? t('common.member'))

  const selectedPayer = members.find((m) => m.id === editor.payerId)
  const selectedPayerName = selectedPayer ? nameOf(selectedPayer) : t('common.member')

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {editor.mode === 'single' ? (
        <>
          <MemberRow
            name={selectedPayerName}
            imageUrl={null}
            indicator="none"
            onPress={() => setSheetOpen(true)}
            accessibilityLabel={t('trip.paidBy', { name: selectedPayerName })}
            right={<Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />}
          />
          <Pressable
            onPress={() => editor.setMode('multiple')}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.link}>{t('payers.multipleLink')}</Text>
          </Pressable>

          <BottomSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title={t('payers.choosePayer')}
          >
            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList}>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  name={nameOf(member)}
                  imageUrl={null}
                  indicator="radio"
                  selected={member.id === editor.payerId}
                  onPress={() => {
                    editor.setPayerId(member.id)
                    setSheetOpen(false)
                  }}
                />
              ))}
            </ScrollView>
          </BottomSheet>
        </>
      ) : (
        <View style={styles.rows}>
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
                  style={styles.field}
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
          <Pressable
            onPress={() => editor.setMode('single')}
            accessibilityRole="button"
            hitSlop={6}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.link}>{t('payers.singleLink')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(1),
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  link: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: theme.colors.primary,
    paddingVertical: theme.gap(1),
  },
  pressed: {
    opacity: 0.7,
  },
  rows: {
    gap: theme.gap(1),
  },
  hint: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
  },
  field: {
    width: theme.gap(24),
    textAlign: 'right',
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetList: {
    paddingBottom: theme.gap(2),
  },
}))
