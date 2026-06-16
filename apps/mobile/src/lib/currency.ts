// Flag + localized-name helpers for currency codes. The picker shows "<flag> <name>" + the ISO
// code instead of bare codes like "CAD".

// Fallback glyph for codes with no national flag (supranational / metals / specials: XOF, XAU...).
const FALLBACK_FLAG = '💱'
const REGIONAL_INDICATOR_BASE = 0x1f1e6 // codepoint of 🇦
const LETTER_A = 65

// Emoji flag from the first two letters of the ISO 4217 code (its country code for the vast
// majority: USD->US, CAD->CA, EUR->EU...). X-prefixed and non-alpha codes have no flag -> fallback.
export function currencyFlag(code: string): string {
  const c = code.toUpperCase()
  if (c.startsWith('X') || !/^[A-Z]{2}/.test(c)) {
    return FALLBACK_FLAG
  }
  const region = c.slice(0, 2)
  return String.fromCodePoint(
    ...[...region].map((ch) => REGIONAL_INDICATOR_BASE + ch.charCodeAt(0) - LETTER_A),
  )
}

// Cache one Intl.DisplayNames per locale (creating it is relatively costly). null when the runtime
// lacks the currency display-names data, in which case we fall back to the raw code.
const displayNamesByLocale = new Map<string, Intl.DisplayNames | null>()

function currencyDisplayNames(locale: string): Intl.DisplayNames | null {
  if (!displayNamesByLocale.has(locale)) {
    try {
      displayNamesByLocale.set(locale, new Intl.DisplayNames([locale], { type: 'currency' }))
    } catch {
      displayNamesByLocale.set(locale, null)
    }
  }
  return displayNamesByLocale.get(locale) ?? null
}

// Localized currency name ("Euro", "dollar des États-Unis"); falls back to the code if the runtime
// or the lookup cannot resolve it.
export function currencyName(code: string, locale = 'en'): string {
  try {
    return currencyDisplayNames(locale)?.of(code) ?? code
  } catch {
    return code
  }
}
