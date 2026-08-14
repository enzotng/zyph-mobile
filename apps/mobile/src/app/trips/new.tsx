import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { SingleChipField } from '@/components/chip-select-field'
import { CurrencyPicker } from '@/components/currency-picker'
import { DestinationField } from '@/components/destination-field'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { TripDatesField } from '@/components/trip-dates-field'
import { Chip, Surface } from '@/components/ui'
import { useFxRates } from '@/features/fx'
import { useAddGhostMembers } from '@/features/group'
import {
  BUDGET_LEVELS,
  type NewTripValues,
  newTripSchema,
  TRIP_TYPES,
  useCreateTrip,
} from '@/features/trips'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

function FieldIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useUnistyles()
  return (
    <Surface
      width={40}
      height={40}
      radius={theme.radius.sm}
      borderWidth={0}
      color={withAlpha(theme.colors.primary, 0.12)}
      style={styles.fieldIcon}
    >
      <Ionicons name={name} size={20} color={theme.colors.primary} />
    </Surface>
  )
}

export default function NewTripScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const createTrip = useCreateTrip()
  const addGhosts = useAddGhostMembers()
  // Step 2 is local state rather than a route: the form lives here and a back gesture from a
  // pushed screen would drop everything typed so far.
  const [step, setStep] = useState<'details' | 'people'>('details')
  const [names, setNames] = useState<string[]>([])
  const [pendingName, setPendingName] = useState('')
  // Derived, not stored: a stored flag described the last add rather than the list, so it
  // disappeared as soon as a third distinct name followed two identical ones.
  const duplicate = useMemo(() => {
    const lower = names.map((n) => n.toLowerCase())
    return new Set(lower).size !== lower.length
  }, [names])
  // Held here, not in DestinationField: step 1 unmounts while step 2 is up, and the geocode-loss
  // hint must survive the round trip (edd76bf).
  const [everLocated, setEverLocated] = useState(false)
  const { data: fx } = useFxRates()
  // Offer every currency the ECB feed provides (all are guaranteed convertible), anchored on EUR.
  const currencies = useMemo(() => {
    const rest = fx
      ? Object.keys(fx.rates)
          .filter((c) => c !== 'EUR')
          .sort()
      : []
    return ['EUR', ...rest]
  }, [fx])
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<NewTripValues>({
    resolver: zodResolver(newTripSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      destination: '',
      currency: 'EUR',
      startDate: null,
      endDate: null,
      latitude: null,
      longitude: null,
      tripType: null,
      budgetLevel: null,
    },
  })

  const startDate = useWatch({ control, name: 'startDate' })
  const endDate = useWatch({ control, name: 'endDate' })
  const destination = useWatch({ control, name: 'destination' })
  const latitude = useWatch({ control, name: 'latitude' })
  const longitude = useWatch({ control, name: 'longitude' })

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

  async function onSubmit(values: NewTripValues, withNames: string[]) {
    try {
      const trip = await createTrip.mutateAsync(values)
      // The places are seeded after the trip exists and never block it: a failure here is a name
      // the group re-adds in two taps, not a reason to lose the trip they just filled in.
      const failed =
        withNames.length > 0
          ? await addGhosts.mutateAsync({ tripId: trip.id, names: withNames })
          : []
      haptics.success()
      if (failed.length > 0) {
        Alert.alert(
          t('newTrip.ghostAddFailedTitle'),
          t('newTrip.ghostAddFailed', { names: failed.join(', ') }),
        )
      }
      router.replace({ pathname: '/trips/[id]', params: { id: trip.id } })
    } catch (error) {
      haptics.error()
      Alert.alert(
        t('newTrip.errorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  // A name typed but not yet added is still a name the user meant. Dropping it because they
  // pressed Create instead of Add would be silent data loss on the most natural gesture.
  function withPending() {
    const pending = pendingName.trim()
    return pending ? [...names, pending] : names
  }

  function addName() {
    const name = pendingName.trim()
    if (!name) {
      return
    }
    // A duplicate is legitimate - two people really can share a first name - so the warning above
    // is advisory. Refusing it would make the group invent labels the ledger carries forever.
    setNames((current) => [...current, name])
    setPendingName('')
  }

  if (step === 'people') {
    const busy = createTrip.isPending || addGhosts.isPending
    return (
      <Screen
        title={t('newTrip.title')}
        showBack
        onBack={() => setStep('details')}
        footer={
          <View style={styles.actions}>
            <Button
              label={t('newTrip.submit')}
              onPress={handleSubmit((values) => onSubmit(values, withPending()))}
              disabled={busy}
              loading={busy}
            />
            <Button
              label={t('newTrip.later')}
              variant="ghost"
              onPress={handleSubmit((values) => onSubmit(values, []))}
              disabled={busy}
            />
          </View>
        }
      >
        <View style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <Text style={styles.stepTitle}>{t('newTrip.whoIsGoing')}</Text>
            <Text style={styles.stepBody}>{t('newTrip.whoIsGoingBody')}</Text>

            <View style={styles.chips}>
              <Chip label={t('newTrip.you')} icon="person" />
              {names.map((name, index) => (
                <Chip
                  // Duplicates are allowed, so the name alone is not a key.
                  key={`${name}-${index}`}
                  label={name}
                  icon="close"
                  accessibilityLabel={t('newTrip.removeName', { name })}
                  onPress={() => setNames((current) => current.filter((_, i) => i !== index))}
                />
              ))}
            </View>

            <View style={styles.addRow}>
              <View style={styles.fieldInput}>
                <TextField
                  placeholder={t('newTrip.addNamePlaceholder')}
                  value={pendingName}
                  onChangeText={setPendingName}
                  onSubmitEditing={addName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                />
              </View>
              <Button label={t('common.add')} variant="secondary" onPress={addName} />
            </View>

            {duplicate ? <Text style={styles.warning}>{t('newTrip.duplicateName')}</Text> : null}
          </ScrollView>
        </View>
      </Screen>
    )
  }

  return (
    <Screen
      title={t('newTrip.title')}
      showBack
      footer={
        <Button
          label={t('newTrip.continue')}
          // Deliberately NOT gated on isValid: a button that cannot be pressed cannot say why.
          // handleSubmit runs the resolver and RHF paints the offending field (spec 7.1).
          onPress={handleSubmit(() => setStep('people'))}
          disabled={createTrip.isPending}
        />
      }
    >
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <Controller
            control={control}
            name="title"
            render={({ field }) => (
              <View style={styles.fieldRow}>
                <FieldIcon name="airplane-outline" />
                <View style={styles.fieldInput}>
                  <TextField
                    label={t('tripForm.title')}
                    placeholder={t('tripForm.titlePlaceholder')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.title?.message}
                  />
                </View>
              </View>
            )}
          />

          <View style={styles.fieldRow}>
            <FieldIcon name="location-outline" />
            <View style={styles.fieldInput}>
              <DestinationField
                label={t('tripForm.destination')}
                value={destination}
                error={errors.destination?.message}
                hasCoordinates={latitude !== null && longitude !== null}
                everGeolocated={everLocated}
                onChangeText={(text) => {
                  setValue('destination', text, { shouldValidate: true })
                  setValue('latitude', null)
                  setValue('longitude', null)
                }}
                onSelectPlace={(place) => {
                  setValue('destination', place.label, { shouldValidate: true })
                  setValue('latitude', place.lat)
                  setValue('longitude', place.lng)
                  setEverLocated(true)
                }}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <View>
                <CurrencyPicker
                  label={t('tripForm.currency')}
                  value={field.value}
                  currencies={currencies}
                  onChange={field.onChange}
                />
                {errors.currency?.message ? (
                  <Text style={styles.error}>{errors.currency.message}</Text>
                ) : null}
              </View>
            )}
          />

          <TripDatesField
            startDate={startDate}
            endDate={endDate}
            onChange={(next) => {
              setValue('startDate', next.startDate, { shouldValidate: true })
              setValue('endDate', next.endDate, { shouldValidate: true })
            }}
            error={errors.endDate?.message}
          />

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
        </ScrollView>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  flex: {
    flex: 1,
    marginHorizontal: -theme.gap(6),
  },
  body: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(4),
    paddingBottom: theme.gap(6),
    gap: theme.gap(4),
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.gap(3),
  },
  fieldIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.gap(1),
  },
  fieldInput: {
    flex: 1,
  },
  error: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.destructive,
    marginTop: theme.gap(1),
  },
  actions: {
    gap: theme.gap(2),
  },
  stepTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },
  stepBody: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.gap(2),
  },
  warning: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.warning,
  },
}))
