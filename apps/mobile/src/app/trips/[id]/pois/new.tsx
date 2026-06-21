import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'

import { Button } from '@/components/button'
import { LocationPicker } from '@/components/location-picker'
import { PoiIconPicker } from '@/components/poi-icon-picker'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { type PoiValues, poiSchema, useCreatePoi } from '@/features/wayfinder'
import { paramString } from '@/lib/routing'

export default function NewPoiScreen() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ id: string; lat?: string; lng?: string; name?: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const createPoi = useCreatePoi(tripId)

  // Optional prefill when arriving from a tap on the map (add-place mode).
  const prefillLat = Number(paramString(params.lat))
  const prefillLng = Number(paramString(params.lng))
  const hasPrefill =
    Number.isFinite(prefillLat) &&
    Number.isFinite(prefillLng) &&
    (prefillLat !== 0 || prefillLng !== 0)

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PoiValues>({
    resolver: zodResolver(poiSchema),
    defaultValues: {
      label: paramString(params.name),
      icon: 'pin',
      lat: hasPrefill ? prefillLat : 0,
      lng: hasPrefill ? prefillLng : 0,
    },
  })

  const lat = useWatch({ control, name: 'lat' })
  const lng = useWatch({ control, name: 'lng' })
  const coords = lat !== 0 || lng !== 0 ? { lat, lng } : null

  async function onSubmit(values: PoiValues) {
    if (values.lat === 0 && values.lng === 0) {
      Alert.alert(t('poiForm.pickLocationTitle'), t('poiForm.pickLocationBody'))
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
      Alert.alert(
        t('poiForm.addError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  return (
    <Screen
      title={t('poiForm.addTitle')}
      scroll
      footer={
        <Button
          label={createPoi.isPending ? t('poiForm.adding') : t('poiForm.add')}
          onPress={handleSubmit(onSubmit)}
          disabled={createPoi.isPending}
        />
      }
    >
      <Controller
        control={control}
        name="label"
        render={({ field }) => (
          <TextField
            label={t('poiForm.label')}
            placeholder={t('poiForm.labelPlaceholder')}
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
          <PoiIconPicker label={t('poiForm.icon')} value={field.value} onChange={field.onChange} />
        )}
      />

      <LocationPicker
        label={t('poiForm.location')}
        value={coords}
        onChange={(next) => {
          setValue('lat', next.lat)
          setValue('lng', next.lng)
        }}
      />
    </Screen>
  )
}
