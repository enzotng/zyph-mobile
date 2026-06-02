import { z } from 'zod'

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(120),
  // Decimal string entered by the user; converted to integer cents on submit.
  amount: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, 'Enter a valid amount'),
})

export type CreateExpenseValues = z.infer<typeof createExpenseSchema>

export function toCents(amount: string): number {
  // String-based to avoid float rounding errors on money values.
  const [intPart = '0', decPart = ''] = amount.replace(',', '.').split('.')
  const cents = Number.parseInt(decPart.padEnd(2, '0').slice(0, 2), 10)
  return Number.parseInt(intPart, 10) * 100 + (Number.isNaN(cents) ? 0 : cents)
}

// Canonical money formatting now lives in lib/money; re-exported here to keep
// the existing `@/features/expenses` import surface stable.
export { formatAmount } from '@/lib/money'
