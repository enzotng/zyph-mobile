import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { CategoryPicker } from '@/components/category-picker'
import { CurrencySelect } from '@/components/currency-select'
import { ReceiptScanner } from '@/components/receipt-scanner'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { useAuth } from '@/features/auth'
import {
  type CreateExpenseValues,
  computeSplits,
  createExpenseSchema,
  type ExpenseCategory,
  formatAmount,
  type ParsedReceipt,
  toCents,
  useCreateExpense,
} from '@/features/expenses'
import { convertCents, crossRate, useFxRates } from '@/features/fx'
import { useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

const AMOUNT_RE = /^\d+([.,]\d{1,2})?$/

type ShareState = Record<string, { included: boolean; weight: number }>

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: trip } = useTrip(tripId)
  const { data: members } = useTripMembers(tripId)
  const { data: fx } = useFxRates()
  const createExpense = useCreateExpense(tripId)

  const tripCurrency = trip?.currency ?? 'EUR'
  const [picked, setPicked] = useState<string | null>(null)
  const currency = picked ?? tripCurrency

  // Only user-touched members are stored; everyone else defaults to included, weight 1.
  // Deriving the default (instead of seeding state) avoids a setState-in-effect and
  // means members who join while the form is open are included by default.
  const [overrides, setOverrides] = useState<ShareState>({})
  const stateFor = useCallback(
    (memberId: string) => overrides[memberId] ?? { included: true, weight: 1 },
    [overrides],
  )

  const [scannerOpen, setScannerOpen] = useState(false)
  const [category, setCategory] = useState<ExpenseCategory | null>(null)

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateExpenseValues>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: { description: '', amount: '' },
  })

  function applyScan(parsed: ParsedReceipt) {
    setScannerOpen(false)
    if (parsed.merchant) {
      setValue('description', parsed.merchant.slice(0, 120), { shouldValidate: true })
    }
    if (parsed.amountCents !== null) {
      setValue('amount', (parsed.amountCents / 100).toFixed(2), { shouldValidate: true })
    }
    if (parsed.currency && parsed.currency !== currency) {
      // Only switch to a currency the FX provider knows about.
      if (!fx || fx.rates[parsed.currency]) {
        setPicked(parsed.currency)
      }
    }
  }

  const amount = useWatch({ control, name: 'amount' })

  const currencies = useMemo(() => {
    const rest = fx
      ? Object.keys(fx.rates)
          .filter((c) => c !== tripCurrency)
          .sort()
      : []
    return [tripCurrency, ...rest]
  }, [fx, tripCurrency])

  const isForeign = currency !== tripCurrency
  const canConvert = !isForeign || Boolean(fx?.rates[currency] && fx?.rates[tripCurrency])

  // Trip-currency amount for the entered value, or null when it can't be resolved yet.
  const baseCents = useMemo(() => {
    if (!AMOUNT_RE.test((amount ?? '').trim())) {
      return null
    }
    const cents = toCents(amount)
    if (!isForeign) {
      return cents
    }
    if (!canConvert || !fx) {
      return null
    }
    return convertCents(cents, currency, tripCurrency, fx.rates)
  }, [amount, canConvert, currency, fx, isForeign, tripCurrency])

  const participants = useMemo(() => {
    if (!members) {
      return []
    }
    return members
      .filter((m) => stateFor(m.id).included)
      .map((m) => ({ memberId: m.id, weight: stateFor(m.id).weight }))
  }, [members, stateFor])

  // Live per-member shares for the preview (memberId -> cents).
  const shareByMember = useMemo(() => {
    if (baseCents === null) {
      return new Map<string, number>()
    }
    return new Map(computeSplits(baseCents, participants).map((s) => [s.memberId, s.shareCents]))
  }, [baseCents, participants])

  const blocked = (isForeign && !canConvert) || participants.length === 0

  function toggle(memberId: string) {
    setOverrides((s) => {
      const cur = s[memberId] ?? { included: true, weight: 1 }
      return { ...s, [memberId]: { ...cur, included: !cur.included } }
    })
  }

  function setWeight(memberId: string, weight: number) {
    setOverrides((s) => {
      const cur = s[memberId] ?? { included: true, weight: 1 }
      return { ...s, [memberId]: { ...cur, weight: Math.max(1, weight) } }
    })
  }

  async function onSubmit(values: CreateExpenseValues) {
    const amountCents = toCents(values.amount)
    let baseAmountCents = amountCents
    let fxRate = 1

    if (isForeign) {
      if (!fx) {
        Alert.alert('Rates unavailable', 'Exchange rates could not be loaded. Try again later.')
        return
      }
      try {
        baseAmountCents = convertCents(amountCents, currency, tripCurrency, fx.rates)
        fxRate = crossRate(currency, tripCurrency, fx.rates)
      } catch (error) {
        Alert.alert('Conversion failed', error instanceof Error ? error.message : 'Try again.')
        return
      }
    }

    const splits = computeSplits(baseAmountCents, participants)
    if (splits.length === 0) {
      Alert.alert('Select at least one person', 'An expense must be shared with someone.')
      return
    }

    try {
      await createExpense.mutateAsync({
        tripId,
        description: values.description,
        amountCents,
        currency,
        baseAmountCents,
        fxRate,
        splits,
        category,
      })
      router.back()
    } catch (error) {
      Alert.alert(
        'Could not add expense',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  // Wait for the trip + members so the currency starts on the trip's currency and the
  // split list is fully populated before the user interacts.
  if (!trip || !members) {
    return (
      <Screen title="Add expense">
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title="Add expense" scroll>
      <Pressable
        onPress={() => setScannerOpen(true)}
        accessibilityRole="button"
        style={styles.scanBtn}
      >
        <Ionicons name="scan-outline" size={20} color={theme.colors.primary} />
        <Text style={styles.scanLabel}>Scan receipt</Text>
      </Pressable>

      <ReceiptScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={applyScan}
      />

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextField
            label="Description"
            placeholder="Dinner"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.description?.message}
          />
        )}
      />

      <CurrencySelect
        label="Currency"
        value={currency}
        currencies={currencies}
        onChange={setPicked}
      />

      <CategoryPicker label="Category" value={category} onChange={setCategory} />

      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <TextField
            label={`Amount (${currency})`}
            placeholder="45.00"
            keyboardType="decimal-pad"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.amount?.message}
          />
        )}
      />

      {isForeign && !canConvert ? (
        <Text style={styles.warn}>Exchange rate for {currency} is unavailable.</Text>
      ) : null}

      <Text style={styles.sectionTitle}>Split between</Text>
      {members.map((member) => {
        const state = stateFor(member.id)
        const included = state.included
        const name = member.user_id === userId ? 'You' : (member.display_name ?? 'Member')
        const share = shareByMember.get(member.id)
        return (
          <View key={member.id} style={styles.memberRow}>
            <Pressable
              style={styles.memberLeft}
              onPress={() => toggle(member.id)}
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
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setWeight(member.id, state.weight - 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease shares"
                    hitSlop={6}
                  >
                    <Ionicons name="remove" size={18} color={theme.colors.foreground} />
                  </Pressable>
                  <Text style={styles.weight}>{state.weight}</Text>
                  <Pressable
                    onPress={() => setWeight(member.id, state.weight + 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Increase shares"
                    hitSlop={6}
                  >
                    <Ionicons name="add" size={18} color={theme.colors.foreground} />
                  </Pressable>
                </View>
                <Text style={styles.share}>
                  {share === undefined ? '—' : formatAmount(share, tripCurrency)}
                </Text>
              </View>
            ) : null}
          </View>
        )
      })}

      <Button
        label={createExpense.isPending ? 'Adding…' : 'Add expense'}
        onPress={handleSubmit(onSubmit)}
        disabled={createExpense.isPending || blocked}
      />
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warn: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.muted,
  },
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
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  weight: {
    minWidth: theme.gap(4),
    textAlign: 'center',
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  share: {
    minWidth: theme.gap(16),
    textAlign: 'right',
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    alignSelf: 'flex-start',
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scanLabel: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
}))
