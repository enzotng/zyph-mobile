import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address')

// Min 8 chars with at least one letter and one digit (mirrors the Supabase policy).
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[a-zA-Z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number')

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'Name is required').max(60),
})

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
