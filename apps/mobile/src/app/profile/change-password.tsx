import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import {
  type ChangePasswordValues,
  makeChangePasswordSchema,
  updatePassword,
} from '@/features/auth'

export default function ChangePasswordScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const schema = useMemo(() => makeChangePasswordSchema(t), [t])

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(values: ChangePasswordValues) {
    setSubmitting(true)
    try {
      await updatePassword(values.password)
      Alert.alert(t('profile.passwordChanged'), undefined, [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
    } catch (error) {
      Alert.alert(
        t('profile.changePasswordError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
      setSubmitting(false)
    }
  }

  return (
    <Screen
      title={t('profile.changePassword')}
      showBack
      scroll
      footer={
        <Button
          label={submitting ? t('common.saving') : t('common.save')}
          onPress={handleSubmit(onSubmit)}
          disabled={submitting}
        />
      }
    >
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label={t('profile.newPassword')}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field }) => (
          <TextField
            label={t('profile.confirmPassword')}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.confirmPassword?.message}
          />
        )}
      />
    </Screen>
  )
}
