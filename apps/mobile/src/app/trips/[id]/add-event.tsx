import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { DateField } from '@/components/date-field'
import { EventTypePicker } from '@/components/event-type-picker'
import { GateLocationField } from '@/components/gate-location-field'
import { LocationPicker } from '@/components/location-picker'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { type CreateEventValues, createEventSchema, useCreateEvent } from '@/features/timeline'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

const ONE_HOUR_MS = 3_600_000

export default function AddEventScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const createEvent = useCreateEvent(tripId)
  const [hasEnd, setHasEnd] = useState(false)
  const [initialStartsAt] = useState(() => new Date().toISOString())

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CreateEventValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: { title: '', type: 'event', startsAt: initialStartsAt, endsAt: '', notes: '' },
  })

  const lat = useWatch({ control, name: 'lat' })
  const lng = useWatch({ control, name: 'lng' })
  const coords = lat != null && lng != null ? { lat, lng } : null

  function toggleEnd() {
    // Keep form side effects out of the state updater (it can run twice in Strict Mode).
    const next = !hasEnd
    setHasEnd(next)
    if (next && !getValues('endsAt')) {
      const start = new Date(getValues('startsAt'))
      setValue('endsAt', new Date(start.getTime() + ONE_HOUR_MS).toISOString())
    } else if (!next) {
      setValue('endsAt', '')
    }
  }

  async function onSubmit(values: CreateEventValues) {
    try {
      await createEvent.mutateAsync({
        tripId,
        title: values.title,
        type: values.type,
        startsAt: values.startsAt,
        endsAt: values.endsAt || undefined,
        notes: values.notes,
        lat: values.lat,
        lng: values.lng,
        gateLocation: values.gateLocation ?? null,
      })
      haptics.success()
      router.back()
    } catch (error) {
      haptics.error()
      Alert.alert(
        t('events.add.errorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  return (
    <Screen
      title={t('events.add.title')}
      showBack
      scroll
      footer={
        <Button
          label={createEvent.isPending ? t('events.add.submitting') : t('events.add.submit')}
          icon="add"
          onPress={handleSubmit(onSubmit)}
          disabled={createEvent.isPending}
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
        name="type"
        render={({ field }) => (
          <EventTypePicker
            label={t('events.form.type')}
            value={field.value}
            onChange={field.onChange}
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
        accessibilityLabel={t('events.form.addEndTime')}
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
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
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
