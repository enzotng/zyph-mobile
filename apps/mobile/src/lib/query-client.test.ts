import { queryClient } from './query-client'

describe('queryClient', () => {
  it('uses offlineFirst network mode for queries', () => {
    const options = queryClient.getDefaultOptions()
    expect(options.queries?.networkMode).toBe('offlineFirst')
  })

  it('sets staleTime to 30 000 ms', () => {
    const options = queryClient.getDefaultOptions()
    expect(options.queries?.staleTime).toBe(30_000)
  })

  it('retries failed queries twice', () => {
    const options = queryClient.getDefaultOptions()
    expect(options.queries?.retry).toBe(2)
  })

  it('uses offlineFirst network mode for mutations', () => {
    const options = queryClient.getDefaultOptions()
    expect(options.mutations?.networkMode).toBe('offlineFirst')
  })
})
