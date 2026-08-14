import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Avatar, Spinner, Surface } from '@/components/ui'
import {
  type ClaimOption,
  type JoinTripValues,
  joinTripSchema,
  useClaimOptions,
  useClaimSlot,
} from '@/features/group'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

export default function JoinTripScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { theme } = useUnistyles()

  // Prefilled when opened from an invite deep link (zyph://trips/join?code=...).
  const linkCode = paramString(useLocalSearchParams<{ code?: string }>().code).toUpperCase()
  // The code the options query is keyed on. A deep link fills it immediately; typed codes only
  // land here on submit, so a half-typed code never spends a rate-limit attempt.
  const [submittedCode, setSubmittedCode] = useState(linkCode)
  // Carries the list it was about, so it cannot outlive it. Structural sharing keeps the same
  // reference when a refetch returns identical content, so a refusal that still applies stays put;
  // it disappears exactly when the list under it actually changed. Derived rather than cleared in
  // an effect, which would be a cascading render.
  const [claimError, setClaimError] = useState<{ message: string; forData: unknown } | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinTripValues>({
    resolver: zodResolver(joinTripSchema),
    defaultValues: { code: linkCode },
  })
  const code = useWatch({ control, name: 'code' })

  const options = useClaimOptions(submittedCode)
  const claimSlot = useClaimSlot()

  const data = options.data
  const alreadyIn = data?.myStatus === 'active'

  // An active member has nothing to choose: the code just takes them to the trip.
  useEffect(() => {
    if (alreadyIn && data) {
      router.replace({ pathname: '/trips/[id]', params: { id: data.tripId } })
    }
  }, [alreadyIn, data, router])

  async function claim(slotId: string | null) {
    setClaimError(null)
    const describing = data
    try {
      const tripId = await claimSlot.mutateAsync({ code: submittedCode, slotId })
      haptics.success()
      router.replace({ pathname: '/trips/[id]', params: { id: tripId } })
    } catch (error) {
      haptics.error()
      const message = error instanceof Error ? error.message : ''
      // Already in: the claim landed but its answer did not (a lost response, or a retry after
      // one). Reporting a failure here would strand someone who IS a member on this screen, so
      // refetch and let the active-member redirect above take them in.
      if (message.includes('already a member')) {
        void options.refetch()
        return
      }
      // The place was free when the list was drawn and is not any more. Refetching is what makes
      // it disappear, so the next tap cannot repeat the same refusal.
      const taken = message.includes('slot already claimed')
      setClaimError({
        message: taken ? t('joinTrip.slotTaken') : t('joinTrip.errorBody'),
        forData: describing,
      })
      if (taken) {
        void options.refetch()
      }
    }
  }

  // No code yet, or the backend refused it and we have nothing to show. A failed REFETCH keeps
  // the data it already had, and that list is still the right screen.
  if (!submittedCode || (options.error && !data)) {
    return (
      <Screen
        title={t('joinTrip.title')}
        showBack
        footer={
          <Button
            label={t('joinTrip.continue')}
            onPress={handleSubmit((values) =>
              // Re-submitting the same code has to refetch explicitly: setting identical state
              // changes nothing, and a failed query does not retry on its own (retry: false), so
              // the button would silently do nothing after a refusal.
              values.code === submittedCode
                ? void options.refetch()
                : setSubmittedCode(values.code),
            )}
            disabled={code.length < 4}
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
            <Surface
              width={64}
              height={64}
              radius={theme.radius.lg}
              borderWidth={0}
              color={withAlpha(theme.colors.primary, 0.1)}
              style={styles.hero}
            >
              <Ionicons name="enter-outline" size={32} color={theme.colors.primary} />
            </Surface>

            <Text style={styles.title}>{t('joinTrip.heading')}</Text>
            <Text style={styles.subtitle}>{t('joinTrip.subtitle')}</Text>

            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <View style={styles.codeWrap}>
                  <TextField
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder="ZYPH-XXXX"
                    value={field.value}
                    onChangeText={(value) => field.onChange(value.toUpperCase())}
                    onBlur={field.onBlur}
                    error={errors.code?.message}
                    style={styles.codeInput}
                  />
                </View>
              )}
            />

            {options.error ? (
              // "Check the code" is a dead end once the hourly cap is spent - the code may be
              // perfectly good and re-typing it cannot help.
              <Text style={styles.error}>
                {options.error.message.includes('rate limited')
                  ? t('joinTrip.rateLimited')
                  : t('joinTrip.errorBody')}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Screen>
    )
  }

  // The redirect above is still in flight on this render, so keep the choice hidden.
  if (options.isLoading || !data || alreadyIn) {
    return (
      <Screen title={t('joinTrip.title')} showBack>
        <View style={styles.joining}>
          <Spinner />
          <Text style={styles.title}>{t('joinTrip.joiningTitle')}</Text>
        </View>
      </Screen>
    )
  }

  // A dormant row of their own outranks the list: claim_trip_slot reactivates it and never reads
  // the slot id, so offering named places here would bind something other than what was tapped.
  const dormant = data.myStatus === 'removed' || data.myStatus === 'invited'

  return (
    <Screen title={t('joinTrip.title')} showBack>
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>
            {dormant ? t('joinTrip.reclaimTitle') : t('joinTrip.whoAreYou')}
          </Text>
          <Text style={styles.subtitle}>
            {dormant
              ? t('joinTrip.reclaimBody')
              : data.slots.length > 0
                ? t('joinTrip.isThisYou')
                : t('joinTrip.noFreeSlots')}
          </Text>
          <Text style={styles.trip}>{t('joinTrip.joiningAs', { trip: data.tripTitle })}</Text>

          {claimError && claimError.forData === data ? (
            <Text style={styles.error}>{claimError.message}</Text>
          ) : null}

          {dormant ? (
            <Button
              label={t('joinTrip.reclaimCta')}
              onPress={() => claim(null)}
              disabled={claimSlot.isPending}
              loading={claimSlot.isPending}
            />
          ) : (
            <>
              <View style={styles.slots}>
                {data.slots.map((slot) => (
                  <SlotCard
                    key={slot.slotId}
                    slot={slot}
                    disabled={claimSlot.isPending}
                    onPress={() => claim(slot.slotId)}
                  />
                ))}
              </View>
              <Button
                label={t('joinTrip.notInList')}
                variant={data.slots.length > 0 ? 'ghost' : 'primary'}
                onPress={() => claim(null)}
                disabled={claimSlot.isPending}
              />
            </>
          )}
        </ScrollView>
      </View>
    </Screen>
  )
}

function SlotCard({
  slot,
  disabled,
  onPress,
}: {
  slot: ClaimOption
  disabled: boolean
  onPress: () => void
}) {
  const { theme } = useUnistyles()
  const name = slot.slotName ?? ''
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}
    >
      <Avatar name={name} size={40} />
      <Text style={styles.slotName} numberOfLines={1}>
        {name}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  flex: {
    flex: 1,
    marginHorizontal: -theme.gap(6),
  },
  joining: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(4),
  },
  body: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(6),
    paddingBottom: theme.gap(6),
    gap: theme.gap(4),
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  trip: {
    fontFamily: theme.fonts.sans.medium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  error: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
    textAlign: 'center',
  },
  slots: {
    gap: theme.gap(2),
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  slotPressed: {
    opacity: 0.85,
  },
  slotName: {
    flex: 1,
    fontFamily: theme.fonts.sans.medium,
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  codeWrap: {
    width: '100%',
    marginTop: theme.gap(2),
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 2,
    fontFamily: theme.fonts.display.semibold,
  },
}))
