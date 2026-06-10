import type { TFunction } from 'i18next'
import {
  makeChangePasswordSchema,
  makePasswordSchema,
  makeSignInSchema,
  makeSignUpSchema,
} from './schemas'

// The schemas are i18n factories; validation messages are irrelevant here, so the
// mock t just echoes the key.
const t = ((key: string) => key) as unknown as TFunction
const passwordSchema = makePasswordSchema(t)
const signInSchema = makeSignInSchema(t)
const signUpSchema = makeSignUpSchema(t)
const changePasswordSchema = makeChangePasswordSchema(t)

describe('auth schemas', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(passwordSchema.safeParse('Ab1cd').success).toBe(false)
  })

  it('requires at least one letter and one digit', () => {
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(false)
    expect(passwordSchema.safeParse('12345678').success).toBe(false)
    expect(passwordSchema.safeParse('abcd1234').success).toBe(true)
  })

  it('trims and lowercases the email', () => {
    const result = signInSchema.safeParse({ email: '  USER@Example.com ', password: 'x' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
    }
  })

  it('requires a display name on sign up', () => {
    const result = signUpSchema.safeParse({
      email: 'a@b.com',
      password: 'abcd1234',
      displayName: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('accepts matching passwords on change', () => {
    const result = changePasswordSchema.safeParse({
      password: 'abcd1234',
      confirmPassword: 'abcd1234',
    })
    expect(result.success).toBe(true)
  })

  it('rejects mismatched passwords on change, with the error on confirmPassword', () => {
    const result = changePasswordSchema.safeParse({
      password: 'abcd1234',
      confirmPassword: 'abcd9999',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword'])
    }
  })
})
