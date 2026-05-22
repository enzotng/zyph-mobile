import { parseEcbXml } from './api/fx.api'
import { convertCents, crossRate } from './convert'

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope>
  <Cube>
    <Cube time='2026-05-22'>
      <Cube currency='USD' rate='1.0800'/>
      <Cube currency='GBP' rate='0.8500'/>
      <Cube currency='JPY' rate='160.00'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`

describe('parseEcbXml', () => {
  it('extracts the date and EUR-based rates including EUR=1', () => {
    const { date, rates } = parseEcbXml(SAMPLE_XML)
    expect(date).toBe('2026-05-22')
    expect(rates.EUR).toBe(1)
    expect(rates.USD).toBe(1.08)
    expect(rates.GBP).toBe(0.85)
  })

  it('throws on an empty or malformed feed', () => {
    expect(() => parseEcbXml('<Cube></Cube>')).toThrow('Incomplete exchange rate feed')
  })
})

describe('crossRate', () => {
  const { rates } = parseEcbXml(SAMPLE_XML)

  it('returns 1 for the same currency', () => {
    expect(crossRate('USD', 'USD', rates)).toBe(1)
  })

  it('computes USD -> EUR as 1 / USD rate', () => {
    expect(crossRate('USD', 'EUR', rates)).toBeCloseTo(1 / 1.08, 8)
  })

  it('throws on an unknown currency', () => {
    expect(() => crossRate('USD', 'XXX', rates)).toThrow('Unsupported currency: XXX')
  })
})

describe('convertCents', () => {
  const { rates } = parseEcbXml(SAMPLE_XML)

  it('returns the amount unchanged for the same currency', () => {
    expect(convertCents(4500, 'EUR', 'EUR', rates)).toBe(4500)
  })

  it('converts USD cents to EUR cents, rounded', () => {
    // 108.00 USD / 1.08 = 100.00 EUR
    expect(convertCents(10800, 'USD', 'EUR', rates)).toBe(10000)
  })

  it('converts EUR cents to GBP cents', () => {
    // 100.00 EUR * 0.85 = 85.00 GBP
    expect(convertCents(10000, 'EUR', 'GBP', rates)).toBe(8500)
  })
})
