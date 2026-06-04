import { isoDayToDate } from './schemas'

// "14 - 16 juin" when both dates exist; null hides the date row (trips may have no dates).
// Month names follow the app i18n language (not the device locale). When start and end share
// the same month and year, the month is shown once ("14 - 16 juin").
export function formatTripDates(
  start: string | null,
  end: string | null,
  locale: string,
): string | null {
  if (!start) {
    return null
  }
  const startDate = isoDayToDate(start)
  const fullOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (!end || end === start) {
    return startDate.toLocaleDateString(locale, fullOpts)
  }
  const endDate = isoDayToDate(end)
  const sameMonth =
    startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()
  const startLabel = startDate.toLocaleDateString(locale, sameMonth ? { day: 'numeric' } : fullOpts)
  return `${startLabel} - ${endDate.toLocaleDateString(locale, fullOpts)}`
}

// A single day label, e.g. "14 juin", in the app i18n language. Returns null when undated.
export function formatDay(iso: string | null, locale: string): string | null {
  if (!iso) {
    return null
  }
  return isoDayToDate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
}
