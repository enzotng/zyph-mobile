import { redirectShareIntentPath } from './share-intent'

jest.mock('expo-share-intent', () => ({
  getShareExtensionKey: () => 'zyphShareKey',
}))

describe('redirectShareIntentPath', () => {
  it('redirects the share-intent sentinel deep link to home', () => {
    expect(redirectShareIntentPath('dataUrl=zyphShareKey')).toBe('/')
  })

  it('passes a normal deep link through unchanged', () => {
    expect(redirectShareIntentPath('/trips/abc/import-email')).toBe('/trips/abc/import-email')
  })

  it('passes an unknown path through so genuine 404s still resolve', () => {
    expect(redirectShareIntentPath('/does/not/exist')).toBe('/does/not/exist')
  })
})
