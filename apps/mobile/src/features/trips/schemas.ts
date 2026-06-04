import { z } from 'zod'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

// No zod .default() here: the form supplies defaults via defaultValues, which keeps
// the schema input/output types identical (avoids the react-hook-form resolver mismatch).
// Travel dates are optional ('YYYY-MM-DD' or null) and date-only - they map straight to
// the trips.start_date / end_date `date` columns. Kept as strings (not Date objects) so the
// react-hook-form `values` stay referentially stable across renders.
export const createTripSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    destination: z.string().trim().max(120),
    currency: z.string().trim().length(3, 'Use a 3-letter code'),
    startDate: z.string().regex(ISO_DAY).nullable(),
    endDate: z.string().regex(ISO_DAY).nullable(),
  })
  .refine((v) => v.startDate === null || v.endDate === null || v.endDate >= v.startDate, {
    // Zero-padded ISO days compare lexically == chronologically. The UI also clamps the end
    // date (minimumDate), so this is a backstop that mirrors the DB trips_dates_check.
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })

export type CreateTripValues = z.infer<typeof createTripSchema>

// Trips store pure calendar dates ('YYYY-MM-DD'). Convert with the device's local calendar
// fields so the day the user picks is the day stored (no UTC off-by-one from a Date object).
export function dateToIsoDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isoDayToDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
