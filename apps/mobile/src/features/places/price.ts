import type { TFunction } from 'i18next'

import type { Poi } from './poi.types'

// A real price range string ("10-20 EUR"), a one-sided "from"/"up to" string when only one bound
// is known, or null when neither bound is known - in which case the caller falls back to the
// '$'.repeat price-level display. Pure + shared by the detail sheet and the cockpit hero card, so
// both surfaces render a price identically.
export function formatPriceRange(poi: Poi, t: TFunction): string | null {
  const { priceStart, priceEnd, priceCurrency } = poi
  if (priceStart === null && priceEnd === null) {
    return null
  }
  const currency = priceCurrency ? ` ${priceCurrency}` : ''
  if (priceStart !== null && priceEnd !== null) {
    return `${priceStart}-${priceEnd}${currency}`
  }
  if (priceStart !== null) {
    return t('activities.priceFrom', { price: `${priceStart}${currency}` })
  }
  return t('activities.priceUpTo', { price: `${priceEnd}${currency}` })
}
