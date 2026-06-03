import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { DateField } from '@/components/date-field'
import { GateLocationField } from '@/components/gate-location-field'
import { LocationPicker } from '@/components/location-picker'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
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
  const { theme } = useUnistyles()
  const { data: event, isLoading } = useEvent(eventId)
  const update = useUpdateEvent(tripId)

  const {
    control,
    handleSubmit,
    getValues,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateEventValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: { title: '', startsAt: new Date().toISOString(), endsAt: '', notes: '' },
  })

  useEffect(() => {
    if (!event) {
      return
    }
    const gate = event.gate_location as { label?: string; lat?: number; lng?: number } | null
    reset({
      title: event.title,
      startsAt: event.starts_at ?? new Date().toISOString(),
      endsAt: event.ends_at ?? '',
      notes: event.notes ?? '',
      lat: event.lat ?? undefined,
      lng: event.lng ?? undefined,
      gateLocation:
        gate && typeof gate.lat === 'number' && typeof gate.lng === 'number'
          ? { label: gate.label ?? '', lat: gate.lat, lng: gate.lng }
          : null,
    })
  }, [event, reset])

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
        startsAt: values.startsAt,
        endsAt: values.endsAt || undefined,
        notes: values.notes,
        lat: values.lat,
        lng: values.lng,
        gateLocation: values.gateLocation ?? null,
      })
      router.back()
    } catch (error) {
      Alert.alert(
        "Mise à jour de l'événement impossible",
        error instanceof Error ? error.message : 'Veuillez réessayer.',
      )
    }
  }

  if (isLoading || !event) {
    return (
      <Screen title="Modifier l'événement" showBack>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title="Modifier l'événement" showBack scroll>
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextField
            label="Titre"
            placeholder="Dîner, vol, visite…"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.title?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="startsAt"
        render={({ field }) => (
          <DateField
            label="Début"
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
        <Text style={styles.toggleLabel}>Ajouter une heure de fin</Text>
      </Pressable>

      {hasEnd ? (
        <Controller
          control={control}
          name="endsAt"
          render={({ field }) => (
            <DateField
              label="Fin"
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
            label="Notes"
            placeholder="Table pour 4, code porte…"
            multiline
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.notes?.message}
          />
        )}
      />

      <LocationPicker
        label="Lieu"
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

      <Button
        label={update.isPending ? 'Enregistrement…' : 'Enregistrer'}
        onPress={handleSubmit(onSubmit)}
        disabled={update.isPending}
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
    color: theme.colors.foreground,
  },
}))
