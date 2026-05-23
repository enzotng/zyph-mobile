import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Alert } from 'react-native'

import { Button } from '@/components/button'
import { LocationPicker } from '@/components/location-picker'
import { PoiIconPicker } from '@/components/poi-icon-picker'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { type PoiValues, poiSchema, useCreatePoi } from '@/features/wayfinder'
import { paramString } from '@/lib/routing'

export default function NewPoiScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const createPoi = useCreatePoi(tripId)

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PoiValues>({
    resolver: zodResolver(poiSchema),
    defaultValues: { label: '', icon: 'pin', lat: 0, lng: 0 },
  })

  const lat = useWatch({ control, name: 'lat' })
  const lng = useWatch({ control, name: 'lng' })
  const coords = lat !== 0 || lng !== 0 ? { lat, lng } : null

  async function onSubmit(values: PoiValues) {
    if (values.lat === 0 && values.lng === 0) {
      Alert.alert('Pick a location', 'Drop a pin on the map first.')
      return
    }
    try {
      await createPoi.mutateAsync({
        tripId,
        label: values.label,
        icon: values.icon,
        lat: values.lat,
        lng: values.lng,
      })
      router.back()
    } catch (error) {
      Alert.alert('Could not add POI', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <Screen title="Add POI" scroll>
      <Controller
        control={control}
        name="label"
        render={({ field }) => (
          <TextField
            label="Label"
            placeholder="Gate 24B, Restroom, ATM…"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.label?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <PoiIconPicker label="Icon" value={field.value} onChange={field.onChange} />
        )}
      />

      <LocationPicker
        label="Location"
        value={coords}
        onChange={(next) => {
          setValue('lat', next.lat)
          setValue('lng', next.lng)
        }}
      />

      <Button
        label={createPoi.isPending ? 'Adding…' : 'Add POI'}
        onPress={handleSubmit(onSubmit)}
        disabled={createPoi.isPending}
      />
    </Screen>
  )
}
