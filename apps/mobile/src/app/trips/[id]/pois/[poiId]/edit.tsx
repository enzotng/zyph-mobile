import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { LocationPicker } from '@/components/location-picker'
import { PoiIconPicker } from '@/components/poi-icon-picker'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Spinner } from '@/components/ui'
import { type PoiIcon, type PoiValues, poiSchema, usePoi, useUpdatePoi } from '@/features/wayfinder'
import { paramString } from '@/lib/routing'

export default function EditPoiScreen() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ id: string; poiId: string }>()
  const tripId = paramString(params.id)
  const poiId = paramString(params.poiId)
  const router = useRouter()
  const { data: poi, isLoading } = usePoi(poiId)
  const updatePoi = useUpdatePoi(tripId)

  const formValues: PoiValues | undefined = poi
    ? {
        label: poi.label,
        icon: poi.icon as PoiIcon,
        lat: poi.lat,
        lng: poi.lng,
      }
    : undefined

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PoiValues>({
    resolver: zodResolver(poiSchema),
    defaultValues: { label: '', icon: 'pin', lat: 0, lng: 0 },
    values: formValues,
  })

  const lat = useWatch({ control, name: 'lat' })
  const lng = useWatch({ control, name: 'lng' })
  const coords = lat !== 0 || lng !== 0 ? { lat, lng } : null

  async function onSubmit(values: PoiValues) {
    try {
      await updatePoi.mutateAsync({
        poiId,
        label: values.label,
        icon: values.icon,
        lat: values.lat,
        lng: values.lng,
      })
      router.back()
    } catch (error) {
      Alert.alert(
        t('poiForm.saveError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  if (isLoading) {
    return (
      <Screen title={t('poiForm.editTitle')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  return (
    <Screen
      title={t('poiForm.editTitle')}
      showBack
      scroll
      footer={
        <Button
          label={updatePoi.isPending ? t('poiForm.saving') : t('poiForm.save')}
          onPress={handleSubmit(onSubmit)}
          disabled={updatePoi.isPending}
        />
      }
    >
      <Controller
        control={control}
        name="label"
        render={({ field }) => (
          <TextField
            label={t('poiForm.label')}
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

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
