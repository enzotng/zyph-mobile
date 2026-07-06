import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { DateField } from '@/components/date-field'
import { EventCategoryPicker } from '@/components/event-category-picker'
import { GateLocationField } from '@/components/gate-location-field'
import { LocationPicker } from '@/components/location-picker'
import { MemberChips } from '@/components/member-chips'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Spinner } from '@/components/ui'
import { useTripMembers } from '@/features/group'
import {
  type CreateEventValues,
  createEventSchema,
  useEvent,
  useUpdateEvent,
} from '@/features/timeline'
import { paramString } from '@/lib/routing'

export default function EditEventScreen() {
  const params = useGlobalSearchParams<{ id: string; eventId: string }>()
  const tripId = paramString(params.id)
  const eventId = paramString(params.eventId)
  const router = useRouter()
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { data: event, isLoading } = useEvent(eventId)
  const update = useUpdateEvent(tripId)
  const members = useTripMembers(tripId)
  const activeMembers = useMemo(
    () =>
      (members.data ?? [])
        .filter((m) => m.status === 'active' && m.user_id)
        .map((m) => ({ userId: m.user_id, displayName: m.display_name, avatarUrl: m.avatar_url })),
    [members.data],
  )

  const [defaultStart] = useState(() => new Date().toISOString())
  // null = not touched by the user yet, so the selector mirrors the event's current subset
  // ([] = "everyone"). Once the user taps a chip this holds the edited value instead, so a
  // background refetch of `event` never clobbers an in-progress edit (same intent as the form's
  // own `keepDirtyValues` below, but for a field that lives outside react-hook-form).
  const [touchedParticipants, setTouchedParticipants] = useState<string[] | null>(null)
  const selected = touchedParticipants ?? event?.participants ?? []

  // RHF syncs form values from this object whenever it changes; no useEffect needed.
  const formValues = useMemo<CreateEventValues | undefined>(() => {
    if (!event) {
      return undefined
    }
    const gate = event.gate_location as { label?: string; lat?: number; lng?: number } | null
    return {
      title: event.title,
      category: event.category,
      subcategory: event.subcategory,
      startsAt: event.starts_at ?? defaultStart,
      endsAt: event.ends_at ?? '',
      notes: event.notes ?? '',
      lat: event.lat ?? undefined,
      lng: event.lng ?? undefined,
      gateLocation:
        gate && typeof gate.lat === 'number' && typeof gate.lng === 'number'
          ? { label: gate.label ?? '', lat: gate.lat, lng: gate.lng }
          : null,
    }
  }, [event, defaultStart])

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CreateEventValues>({
    resolver: zodResolver(createEventSchema),
    values: formValues,
    // Keep the user's in-progress edits if the source data refetches mid-edit.
    resetOptions: { keepDirtyValues: true },
    defaultValues: {
      title: '',
      category: 'other',
      subcategory: null,
      startsAt: defaultStart,
      endsAt: '',
      notes: '',
    },
  })

  const lat = useWatch({ control, name: 'lat' })
  const lng = useWatch({ control, name: 'lng' })
  const endsAt = useWatch({ control, name: 'endsAt' })
  const coords = lat != null && lng != null ? { lat, lng } : null
  const hasEnd = Boolean(endsAt)

  function toggleEnd() {
    if (hasEnd) {
      setValue('endsAt', '')
      return
    }
    const start = new Date(getValues('startsAt'))
    setValue('endsAt', new Date(start.getTime() + 3_600_000).toISOString())
  }

  async function onSubmit(values: CreateEventValues) {
    try {
      await update.mutateAsync({
        eventId,
        title: values.title,
        category: values.category,
        subcategory: values.subcategory,
        startsAt: values.startsAt,
        endsAt: values.endsAt || undefined,
        notes: values.notes,
        lat: values.lat,
        lng: values.lng,
        gateLocation: values.gateLocation ?? null,
        participants: selected.length === 0 ? null : selected,
      })
      router.back()
    } catch (error) {
      Alert.alert(
        t('events.edit.errorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  if (isLoading || !event) {
    return (
      <Screen title={t('events.edit.title')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  return (
    <Screen
      title={t('events.edit.title')}
      showBack
      scroll
      footer={
        <Button
          label={update.isPending ? t('common.saving') : t('common.save')}
          onPress={handleSubmit(onSubmit)}
          disabled={update.isPending}
        />
      }
    >
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextField
            label={t('events.form.title')}
            placeholder={t('events.form.titlePlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.title?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <EventCategoryPicker
            label={t('events.form.type')}
            category={field.value ?? 'other'}
            subcategory={getValues('subcategory') ?? null}
            onChange={({ category, subcategory }) => {
              field.onChange(category)
              setValue('subcategory', subcategory)
            }}
          />
        )}
      />

      <Controller
        control={control}
        name="startsAt"
        render={({ field }) => (
          <DateField
            label={t('events.form.start')}
            value={new Date(field.value)}
            onChange={(date) => field.onChange(date.toISOString())}
            error={errors.startsAt?.message}
          />
        )}
      />

      <Pressable
        style={styles.toggle}
        onPress={toggleEnd}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasEnd }}
      >
        <Ionicons
          name={hasEnd ? 'checkbox' : 'square-outline'}
          size={22}
          color={hasEnd ? theme.colors.primary : theme.colors.muted}
        />
        <Text style={styles.toggleLabel}>{t('events.form.addEndTime')}</Text>
      </Pressable>

      {hasEnd ? (
        <Controller
          control={control}
          name="endsAt"
          render={({ field }) => (
            <DateField
              label={t('events.form.end')}
              value={new Date(field.value || getValues('startsAt'))}
              onChange={(date) => field.onChange(date.toISOString())}
              error={errors.endsAt?.message}
            />
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextField
            label={t('events.form.notes')}
            placeholder={t('events.form.notesPlaceholder')}
            multiline
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.notes?.message}
          />
        )}
      />

      <LocationPicker
        label={t('events.form.location')}
        value={coords}
        onChange={(next) => {
          setValue('lat', next.lat)
          setValue('lng', next.lng)
        }}
      />

      <Controller
        control={control}
        name="gateLocation"
        render={({ field }) => (
          <GateLocationField value={field.value ?? null} onChange={field.onChange} />
        )}
      />

      <MemberChips
        members={activeMembers}
        selected={selected}
        onChange={setTouchedParticipants}
        label={t('smartImport.participantsLabel')}
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
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  toggleLabel: {
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.foreground,
  },
}))
