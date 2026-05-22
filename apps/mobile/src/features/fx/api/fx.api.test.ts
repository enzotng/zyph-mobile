import { fetchFxRates } from './fx.api'

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope>
  <Cube>
    <Cube time='2026-05-22'>
      <Cube currency='USD' rate='1.0800'/>
      <Cube currency='GBP' rate='0.8500'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fetchFxRates', () => {
  it('fetches and parses the ECB XML successfully', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(SAMPLE_XML),
    })

    const result = await fetchFxRates()

    expect(result.date).toBe('2026-05-22')
    expect(result.rates.EUR).toBe(1)
    expect(result.rates.USD).toBe(1.08)
    expect(result.rates.GBP).toBe(0.85)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
    )
  })

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
    })

    await expect(fetchFxRates()).rejects.toThrow('Failed to fetch exchange rates (503)')
  })

  it('throws when the network call itself rejects', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'))

    await expect(fetchFxRates()).rejects.toThrow('Network request failed')
  })
})
