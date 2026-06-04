import { z } from 'zod'

// A settlement is recorded in the trip currency; the decimal string is converted to integer
// cents via the shared toCents helper from the expenses feature, like the expense form.
export const recordSettlementSchema = z.object({
  fromMemberId: z.string().min(1),
  toMemberId: z.string().min(1),
  amount: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, 'Enter a valid amount'),
})

export type RecordSettlementValues = z.infer<typeof recordSettlementSchema>
