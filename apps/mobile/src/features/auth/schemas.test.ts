import { passwordSchema, signInSchema, signUpSchema } from './schemas'

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
})
