import type { TFunction } from 'i18next'
import { z } from 'zod'

export function makeUpdateProfileSchema(t: TFunction) {
  return z.object({
    displayName: z.string().trim().min(1, t('profile.validation.nameRequired')).max(80),
    preferredCurrency: z.string().trim().min(3, t('profile.validation.currency')).max(3),
  })
}

export type UpdateProfileValues = z.infer<ReturnType<typeof makeUpdateProfileSchema>>
