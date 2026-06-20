import { redirectSystemPath } from './+native-intent'

jest.mock('expo-share-intent', () => ({
  getShareExtensionKey: () => 'zyphShareKey',
}))

describe('redirectSystemPath', () => {
  it('redirects the share-intent sentinel deep link to home', () => {
    expect(redirectSystemPath({ path: 'dataUrl=zyphShareKey', initial: false })).toBe('/')
  })

  it('passes a normal deep link through unchanged', () => {
    expect(redirectSystemPath({ path: '/trips/abc/import-email', initial: true })).toBe(
      '/trips/abc/import-email',
    )
  })

  it('passes an unknown path through so genuine 404s still resolve', () => {
    expect(redirectSystemPath({ path: '/does/not/exist', initial: false })).toBe('/does/not/exist')
  })
})
