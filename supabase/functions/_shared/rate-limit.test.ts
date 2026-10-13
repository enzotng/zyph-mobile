import { isWithinRateLimit } from './rate-limit'

function clientAnswering(data: unknown) {
  return { rpc: jest.fn().mockResolvedValue({ data, error: null }) }
}

describe('isWithinRateLimit', () => {
  it('sends the bucket alone: the ceiling and the window belong to the server', async () => {
    const client = clientAnswering(true)

    await isWithinRateLimit(client, 'copilot')

    // toStrictEqual, because toHaveBeenCalledWith reads `_limit: undefined` as an absent key.
    expect(client.rpc.mock.calls[0]).toStrictEqual(['check_rate_limit', { _bucket: 'copilot' }])
  })

  it('blocks when the server refuses', async () => {
    await expect(isWithinRateLimit(clientAnswering(false), 'copilot')).resolves.toBe(false)
  })

  it('allows when the server accepts', async () => {
    await expect(isWithinRateLimit(clientAnswering(true), 'copilot')).resolves.toBe(true)
  })
})
