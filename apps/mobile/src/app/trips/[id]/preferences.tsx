import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { MultiChipField, SingleChipField } from '@/components/chip-select-field'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/features/auth'
import { toCents } from '@/features/expenses'
import {
  BUDGET_LEVELS,
  type BudgetLevel,
  DIETARY,
  type Dietary,
  INTERESTS,
  type Interest,
  PACES,
  type Pace,
  TRIP_TYPES,
  type TripPreferencesValues,
  type TripType,
  tripPreferencesSchema,
  useTrip,
  useUpdateTripPreferences,
} from '@/features/trips'
import { haptics } from '@/lib/haptics'
import { formatAmount } from '@/lib/money'
import { paramString } from '@/lib/routing'

const EMPTY_PREFS: TripPreferencesValues = {
  tripType: null,
  budgetLevel: null,
  budgetTotal: '',
  pace: null,
  interests: [],
  dietary: [],
}

export default function TripPreferencesScreen() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { session } = useAuth()
  const { data: trip, isLoading } = useTrip(tripId)
  const updatePrefs = useUpdateTripPreferences()

  const isOwner = Boolean(trip && session?.user.id === trip.owner_id)

  const tripTypeOptions = useMemo(
    () =>
      TRIP_TYPES.map((value) => ({
        value,
        label: t(`tripPreferences.options.tripTypes.${value}`),
      })),
    [t],
  )
  const budgetLevelOptions = useMemo(
    () =>
      BUDGET_LEVELS.map((value) => ({
        value,
        label: t(`tripPreferences.options.budgetLevels.${value}`),
      })),
    [t],
  )
  const paceOptions = useMemo(
    () => PACES.map((value) => ({ value, label: t(`tripPreferences.options.paces.${value}`) })),
    [t],
  )
  const interestOptions = useMemo(
    () =>
      INTERESTS.map((value) => ({ value, label: t(`tripPreferences.options.interests.${value}`) })),
    [t],
  )
  const dietaryOptions = useMemo(
    () => DIETARY.map((value) => ({ value, label: t(`tripPreferences.options.dietary.${value}`) })),
    [t],
  )

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TripPreferencesValues>({
    resolver: zodResolver(tripPreferencesSchema),
    // Keep in-progress edits if the trip query refetches mid-edit (matches the trip edit screen).
    resetOptions: { keepDirtyValues: true },
    // Casts: the DB CHECK + app validation guarantee the stored strings are valid members of the
    // union; the generated types only know `string | null`. `?? []` covers a trip cached before
    // the columns existed (arrays undefined until it refetches).
    values: trip
      ? {
          tripType: (trip.trip_type ?? null) as TripType | null,
          budgetLevel: (trip.budget_level ?? null) as BudgetLevel | null,
          budgetTotal:
            trip.budget_total_cents != null ? (trip.budget_total_cents / 100).toFixed(2) : '',
          pace: (trip.pace ?? null) as Pace | null,
          interests: (trip.interests ?? []) as Interest[],
          dietary: (trip.dietary ?? []) as Dietary[],
        }
      : EMPTY_PREFS,
  })

  async function onSubmit(values: TripPreferencesValues) {
    try {
      const budgetTotalCents = values.budgetTotal.trim() === '' ? null : toCents(values.budgetTotal)
      await updatePrefs.mutateAsync({
        id: tripId,
        tripType: values.tripType,
        budgetLevel: values.budgetLevel,
        budgetTotalCents,
        pace: values.pace,
        interests: values.interests,
        dietary: values.dietary,
      })
      haptics.success()
      router.back()
    } catch (error) {
      haptics.error()
      Alert.alert(
        t('tripPreferences.saveError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  if (isLoading) {
    return (
      <Screen title={t('tripPreferences.title')} showBack>
        <Spinner />
      </Screen>
    )
  }

  if (!trip) {
    return (
      <Screen showBack>
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('tripForm.notFound')}</Text>
        </View>
      </Screen>
    )
  }

  // Members (non-owners) get a read-only summary: the preferences are useful to everyone, but
  // only the owner can edit (also enforced by the trips_update_owner RLS).
  if (!isOwner) {
    const orNotSet = (value: string) => value || t('tripPreferences.notSet')
    return (
      <Screen title={t('tripPreferences.title')} showBack scroll>
        <View style={styles.summary}>
          <SummaryRow
            label={t('tripPreferences.tripType')}
            value={orNotSet(
              trip.trip_type ? t(`tripPreferences.options.tripTypes.${trip.trip_type}`) : '',
            )}
          />
          <SummaryRow
            label={t('tripPreferences.budgetLevel')}
            value={orNotSet(
              trip.budget_level
                ? t(`tripPreferences.options.budgetLevels.${trip.budget_level}`)
                : '',
            )}
          />
          <SummaryRow
            label={t('tripPreferences.budgetTotalShort')}
            value={orNotSet(
              trip.budget_total_cents != null
                ? formatAmount(trip.budget_total_cents, trip.currency)
                : '',
            )}
          />
          <SummaryRow
            label={t('tripPreferences.pace')}
            value={orNotSet(trip.pace ? t(`tripPreferences.options.paces.${trip.pace}`) : '')}
          />
          <SummaryRow
            label={t('tripPreferences.interests')}
            value={orNotSet(
              (trip.interests ?? [])
                .map((v) => t(`tripPreferences.options.interests.${v}`))
                .join(', '),
            )}
          />
          <SummaryRow
            label={t('tripPreferences.dietary')}
            value={orNotSet(
              (trip.dietary ?? []).map((v) => t(`tripPreferences.options.dietary.${v}`)).join(', '),
            )}
          />
          <Text style={styles.ownerNote}>{t('tripPreferences.ownerOnlyNote')}</Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen
      title={t('tripPreferences.title')}
      showBack
      scroll
      footer={
        <Button
          label={updatePrefs.isPending ? t('common.saving') : t('common.save')}
          onPress={handleSubmit(onSubmit)}
          disabled={updatePrefs.isPending}
          loading={updatePrefs.isPending}
        />
      }
    >
      <View style={styles.form}>
        <Controller
          control={control}
          name="tripType"
          render={({ field }) => (
            <SingleChipField
              label={t('tripPreferences.tripType')}
              options={tripTypeOptions}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="budgetLevel"
          render={({ field }) => (
            <SingleChipField
              label={t('tripPreferences.budgetLevel')}
              options={budgetLevelOptions}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="budgetTotal"
          render={({ field }) => (
            <TextField
              label={t('tripPreferences.budgetTotal', { currency: trip.currency })}
              placeholder={t('tripPreferences.budgetTotalPlaceholder')}
              keyboardType="decimal-pad"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.budgetTotal?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="pace"
          render={({ field }) => (
            <SingleChipField
              label={t('tripPreferences.pace')}
              options={paceOptions}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="interests"
          render={({ field }) => (
            <MultiChipField
              label={t('tripPreferences.interests')}
              options={interestOptions}
              values={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="dietary"
          render={({ field }) => (
            <MultiChipField
              label={t('tripPreferences.dietary')}
              options={dietaryOptions}
              values={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </View>
    </Screen>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  form: {
    gap: theme.gap(5),
  },
  summary: {
    gap: theme.gap(4),
  },
  summaryRow: {
    gap: theme.gap(1),
  },
  summaryLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  summaryValue: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  ownerNote: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    marginTop: theme.gap(2),
  },
}))
