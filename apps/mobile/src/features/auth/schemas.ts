import type { TFunction } from 'i18next'
import { z } from 'zod'

export function makeEmailSchema(t: TFunction) {
  return z.string().trim().toLowerCase().email(t('auth.validation.email'))
}

// Min 8 chars with at least one letter and one digit (mirrors the Supabase policy).
export function makePasswordSchema(t: TFunction) {
  return z
    .string()
    .min(8, t('auth.validation.passwordMin'))
    .regex(/[a-zA-Z]/, t('auth.validation.passwordLetter'))
    .regex(/[0-9]/, t('auth.validation.passwordNumber'))
}

export function makeSignInSchema(t: TFunction) {
  return z.object({
    email: makeEmailSchema(t),
    password: z.string().min(1, t('auth.validation.passwordRequired')),
  })
}

export function makeSignUpSchema(t: TFunction) {
  return z.object({
    email: makeEmailSchema(t),
    password: makePasswordSchema(t),
    displayName: z.string().trim().min(1, t('auth.validation.nameRequired')).max(60),
  })
}

export type SignInValues = z.infer<ReturnType<typeof makeSignInSchema>>
export type SignUpValues = z.infer<ReturnType<typeof makeSignUpSchema>>
