export type ParsedReceipt = {
  merchant: string | null
  amountCents: number | null
  currency: string | null
  date: string | null
}

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
  '¥': 'JPY',
  '₣': 'CHF',
}

const CURRENCY_BY_CODE: Record<string, string> = {
  EUR: 'EUR',
  USD: 'USD',
  GBP: 'GBP',
  JPY: 'JPY',
  CHF: 'CHF',
  CAD: 'CAD',
  AUD: 'AUD',
}

const TOTAL_KEYWORDS = [
  'total ttc',
  'montant total',
  'total a payer',
  'total à payer',
  'grand total',
  'total',
  'amount due',
  'amount',
  'somme',
  'a payer',
  'à payer',
]

const AMOUNT_RE = /(\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{2}))/g

function normalizeAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(/[ .](?=\d{3}([^\d]|$))/g, '')
  const dot = cleaned.lastIndexOf('.')
  const comma = cleaned.lastIndexOf(',')
  const sep = Math.max(dot, comma)
  if (sep === -1) {
    const cents = Number.parseInt(cleaned, 10)
    return Number.isFinite(cents) ? cents * 100 : null
  }
  const intPart = cleaned.slice(0, sep).replace(/[.,]/g, '')
  const decPart = cleaned.slice(sep + 1)
  const value = Number.parseFloat(`${intPart}.${decPart}`)
  if (!Number.isFinite(value)) {
    return null
  }
  return Math.round(value * 100)
}

function detectCurrency(text: string): string | null {
  for (const [symbol, code] of Object.entries(CURRENCY_BY_SYMBOL)) {
    if (text.includes(symbol)) {
      return code
    }
  }
  const upper = text.toUpperCase()
  for (const code of Object.keys(CURRENCY_BY_CODE)) {
    if (new RegExp(`\\b${code}\\b`).test(upper)) {
      return code
    }
  }
  return null
}

function extractDate(text: string): string | null {
  // Match DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD. 2-digit years assumed 2000-2099.
  const candidates = text.match(/\b(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})\b/g) ?? []
  for (const match of candidates) {
    const parts = match.split(/[/.\-]/).map((p) => Number.parseInt(p, 10))
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      continue
    }
    const [a, b, c] = parts as [number, number, number]
    let year: number
    let month: number
    let day: number
    if (a > 31) {
      year = a
      month = b
      day = c
    } else {
      day = a
      month = b
      year = c < 100 ? 2000 + c : c
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2099) {
      continue
    }
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  }
  return null
}

function extractAmount(lines: string[]): number | null {
  // Pass 1: look for a TOTAL-keyword line and pick its largest amount.
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (TOTAL_KEYWORDS.some((kw) => lower.includes(kw))) {
      const matches = line.match(AMOUNT_RE)
      if (matches && matches.length > 0) {
        const cents = matches.map(normalizeAmount).filter((n): n is number => n !== null)
        if (cents.length > 0) {
          return Math.max(...cents)
        }
      }
    }
  }
  // Pass 2: fall back to the largest amount in the document.
  const allCents: number[] = []
  for (const line of lines) {
    const matches = line.match(AMOUNT_RE)
    if (matches) {
      for (const m of matches) {
        const cents = normalizeAmount(m)
        if (cents !== null) {
          allCents.push(cents)
        }
      }
    }
  }
  return allCents.length > 0 ? Math.max(...allCents) : null
}

function extractMerchant(lines: string[]): string | null {
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip lines that are purely numeric, dates, or very short.
    if (trimmed.length < 3) {
      continue
    }
    if (/^[\d\s.,/\-:€$£¥]+$/.test(trimmed)) {
      continue
    }
    return trimmed.slice(0, 80)
  }
  return null
}

export function parseReceipt(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  return {
    merchant: extractMerchant(lines),
    amountCents: extractAmount(lines),
    currency: detectCurrency(text),
    date: extractDate(text),
  }
}
