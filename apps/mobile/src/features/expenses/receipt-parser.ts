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

const SUBTOTAL_KEYWORDS = ['sous-total', 'sous total', 'subtotal']

function extractAmount(lines: string[]): number | null {
  // Pass 1: collect amounts from lines with a TOTAL keyword, skipping subtotals.
  const totalCents: number[] = []
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (SUBTOTAL_KEYWORDS.some((kw) => lower.includes(kw))) {
      continue
    }
    if (TOTAL_KEYWORDS.some((kw) => lower.includes(kw))) {
      const matches = line.match(AMOUNT_RE)
      if (matches) {
        for (const m of matches) {
          const cents = normalizeAmount(m)
          if (cents !== null) {
            totalCents.push(cents)
          }
        }
      }
    }
  }
  if (totalCents.length > 0) {
    return Math.max(...totalCents)
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

export type ParsedItem = {
  label: string
  amountCents: number
}

export type ParsedReceiptItems = ParsedReceipt & {
  items: ParsedItem[]
}

// Lines that look like a single article: optional "qty x" prefix, label words,
// then a money amount possibly flanked by a currency symbol on either side.
const ITEM_LINE_RE =
  /^(?:(\d+)\s*[xX×]\s*)?(.+?)\s+[€$£¥]?\s*(\d{1,4}(?:[ .,]\d{3})*[.,]\d{2})\s*[€$£¥]?$/

// Phrases that mark a line as a total / tax / payment / discount - not an item.
const NON_ITEM_KEYWORDS = [
  'total ttc',
  'montant total',
  'total a payer',
  'total à payer',
  'grand total',
  'subtotal',
  'sous-total',
  'sous total',
  'total',
  'amount due',
  'amount',
  'somme',
  'a payer',
  'à payer',
  'tva',
  'tax',
  'taxe',
  'service',
  'pourboire',
  'tip',
  'remise',
  'discount',
  'rabais',
  'rendu',
  'change',
  'monnaie',
  'cb',
  'carte',
  'espece',
  'espèce',
  'cash',
  'paiement',
  'payment',
  'reglement',
  'règlement',
  'remboursement',
  'refund',
  'ticket',
  'merci',
  'thank you',
  'merchant',
  'commercant',
  'commerçant',
]

function isItemLineLabel(label: string): boolean {
  const lower = label.toLowerCase()
  if (lower.length < 2) {
    return false
  }
  // A label must contain at least one letter (filters out lines that are purely
  // numeric like dates, ticket ids, etc.).
  if (!/[a-zA-Zàâçéèêëîïôûùüÿœ]/.test(label)) {
    return false
  }
  return !NON_ITEM_KEYWORDS.some((kw) => lower.includes(kw))
}

export function parseReceiptItems(text: string): ParsedReceiptItems {
  const base = parseReceipt(text)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const items: ParsedItem[] = []
  for (const line of lines) {
    const match = line.match(ITEM_LINE_RE)
    if (!match) {
      continue
    }
    const [, quantity, rawLabel, rawAmount] = match
    const label = rawLabel.trim()
    if (!isItemLineLabel(label)) {
      continue
    }
    const cents = normalizeAmount(rawAmount)
    if (cents === null || cents <= 0) {
      continue
    }
    const display = quantity && quantity !== '1' ? `${quantity} × ${label}` : label
    items.push({ label: display, amountCents: cents })
  }

  return { ...base, items }
}
