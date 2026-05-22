// European Central Bank daily reference rates: free, no API key, base currency EUR.
// Flat XML of <Cube currency='USD' rate='1.08'/> entries under a single dated Cube.
const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

export type FxRates = {
  // ISO date the rates were published (Europe/CET), e.g. '2026-05-22'.
  date: string
  // EUR-based rates; EUR itself is always 1.
  rates: Record<string, number>
}

// ECB attributes use single quotes; tolerate double quotes too for safety.
const RATE_RE = /currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g
const DATE_RE = /time=['"](\d{4}-\d{2}-\d{2})['"]/

export function parseEcbXml(xml: string): FxRates {
  const rates: Record<string, number> = { EUR: 1 }
  for (const match of xml.matchAll(RATE_RE)) {
    const code = match[1]
    const rate = Number.parseFloat(match[2])
    if (code && Number.isFinite(rate) && rate > 0) {
      rates[code] = rate
    }
  }
  const date = xml.match(DATE_RE)?.[1]
  // Reject empty/garbage responses: the daily feed always carries a publication date
  // and at least one foreign currency. Failing here keeps the previous valid cache
  // rather than storing a useless set for 12h.
  if (!date || Object.keys(rates).length <= 1) {
    throw new Error('Incomplete exchange rate feed')
  }
  return { date, rates }
}

export async function fetchFxRates(): Promise<FxRates> {
  const response = await fetch(ECB_DAILY_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rates (${response.status})`)
  }
  return parseEcbXml(await response.text())
}
