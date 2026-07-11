import { z } from 'zod'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
// Decimal money string entered by the user ('12', '12.5', '12,50'); '' means "not set".
// Exported so any other budget/amount input (e.g. the analytics quick-set field) can validate
// against the same rule before converting to cents, instead of trusting toCents() with raw input.
export const MONEY = /^\d+([.,]\d{1,2})?$/

// Allowed values for the per-trip profile. Scalars are mirrored 1:1 by the DB CHECK
// constraints (migration 20260628004209_trip_profile); interests/dietary are validated
// only here (no DB CHECK), so extending those lists is a code-only change.
export const TRIP_TYPES = [
  'beach',
  'city_break',
  'road_trip',
  'nature',
  'ski',
  'cultural',
  'foodie',
  'adventure',
  'wellness',
  'family',
  'festival',
  'business',
  'backpacking',
] as const
export type TripType = (typeof TRIP_TYPES)[number]

export const BUDGET_LEVELS = ['low', 'medium', 'high', 'luxury'] as const
export type BudgetLevel = (typeof BUDGET_LEVELS)[number]

export const PACES = ['relaxed', 'balanced', 'packed'] as const
export type Pace = (typeof PACES)[number]

export const INTERESTS = [
  'food',
  'nightlife',
  'museums',
  'nature',
  'shopping',
  'sports',
  'history',
  'art',
  'music',
  'photography',
  'relaxation',
  'local_culture',
] as const
export type Interest = (typeof INTERESTS)[number]

export const DIETARY = [
  'vegetarian',
  'vegan',
  'gluten_free',
  'halal',
  'kosher',
  'lactose_free',
  'nut_allergy',
  'pescatarian',
] as const
export type Dietary = (typeof DIETARY)[number]

// No zod .default() here: the form supplies defaults via defaultValues, which keeps
// the schema input/output types identical (avoids the react-hook-form resolver mismatch).
// Travel dates are optional ('YYYY-MM-DD' or null) and date-only - they map straight to
// the trips.start_date / end_date `date` columns. Kept as strings (not Date objects) so the
// react-hook-form `values` stay referentially stable across renders.
const tripBase = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  destination: z.string().trim().max(120),
  currency: z.string().trim().length(3, 'Use a 3-letter code'),
  startDate: z.string().regex(ISO_DAY).nullable(),
  endDate: z.string().regex(ISO_DAY).nullable(),
  // Coordinates of the picked place (autocomplete); null for a free-text destination. Bounded
  // so a non-finite / out-of-range value can never be persisted or reach the weather URL.
  latitude: z.number().finite().min(-90).max(90).nullable(),
  longitude: z.number().finite().min(-180).max(180).nullable(),
})

// Zero-padded ISO days compare lexically == chronologically. The UI also clamps the end
// date (minimumDate), so this is a backstop that mirrors the DB trips_dates_check.
const datesOrdered = (v: { startDate: string | null; endDate: string | null }) =>
  v.startDate === null || v.endDate === null || v.endDate >= v.startDate
const datesError = {
  message: 'End date must be on or after the start date',
  path: ['endDate'],
}

export const createTripSchema = tripBase.refine(datesOrdered, datesError)

export type CreateTripValues = z.infer<typeof createTripSchema>

// New-trip form: the create fields plus the two "light" profile fields collected at creation
// (trip type + budget level). The remaining profile fields are edited later on the dedicated
// preferences screen. Kept separate so editing a trip (createTripSchema) never touches profile.
export const newTripSchema = tripBase
  .extend({
    tripType: z.enum(TRIP_TYPES).nullable(),
    budgetLevel: z.enum(BUDGET_LEVELS).nullable(),
  })
  .refine(datesOrdered, datesError)

export type NewTripValues = z.infer<typeof newTripSchema>

// Trip preferences form (the preferences screen). budgetTotal is a decimal string in the trip
// currency ('' = not set), converted to integer cents on submit (see toCents). interests/dietary
// are validated against the app consts; the DB stores them as text[] with no CHECK.
export const tripPreferencesSchema = z.object({
  tripType: z.enum(TRIP_TYPES).nullable(),
  budgetLevel: z.enum(BUDGET_LEVELS).nullable(),
  budgetTotal: z
    .string()
    .trim()
    .refine((v) => v === '' || MONEY.test(v), 'Enter a valid amount'),
  pace: z.enum(PACES).nullable(),
  interests: z.array(z.enum(INTERESTS)),
  dietary: z.array(z.enum(DIETARY)),
})

export type TripPreferencesValues = z.infer<typeof tripPreferencesSchema>

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
