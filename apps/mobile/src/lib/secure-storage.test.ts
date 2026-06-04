// secure-storage.ts memoises `storagePromise` at module scope.
// We use jest.isolateModules so each test case gets a fresh module instance,
// ensuring the promise cache is always clean before the test starts.

// Stable mock references shared across isolateModules calls.
const mockGetItemAsync = jest.fn<Promise<string | null>, [string]>()
const mockSetItemAsync = jest.fn<Promise<void>, [string, string, object?]>()
const mockGetRandomBytes = jest.fn<Uint8Array, [number]>()

const mockMmkv = {
  getString: jest.fn<string | undefined, [string]>(),
  set: jest.fn<void, [string, string]>(),
  remove: jest.fn<void, [string]>(),
}
const mockCreateMMKV = jest.fn(() => mockMmkv)

// Register module mocks at the top level so they apply inside isolateModules.
jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...(args as [string])),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...(args as [string, string, object?])),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 3,
}))

jest.mock('expo-crypto', () => ({
  getRandomBytes: (...args: unknown[]) => mockGetRandomBytes(...(args as [number])),
}))

jest.mock('react-native-mmkv', () => ({
  createMMKV: (...args: unknown[]) => mockCreateMMKV(...(args as [])),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

// Helper: require the module inside an isolated registry.
function requireSecureStorage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./secure-storage') as typeof import('./secure-storage')
  return mod.secureSessionStorage
}

describe('secureSessionStorage - key already exists in SecureStore', () => {
  beforeEach(() => {
    mockGetItemAsync.mockResolvedValue('existing-encryption-key')
  })

  it('getItem delegates to the MMKV getString and returns the value', async () => {
    mockMmkv.getString.mockReturnValue('stored-value')
    let storage!: ReturnType<typeof requireSecureStorage>
    jest.isolateModules(() => {
      storage = requireSecureStorage()
    })

    const result = await storage.getItem('session-key')
    expect(mockMmkv.getString).toHaveBeenCalledWith('session-key')
    expect(result).toBe('stored-value')
  })

  it('getItem returns null when the key is absent in MMKV', async () => {
    mockMmkv.getString.mockReturnValue(undefined)
    let storage!: ReturnType<typeof requireSecureStorage>
    jest.isolateModules(() => {
      storage = requireSecureStorage()
    })

    const result = await storage.getItem('missing-key')
    expect(result).toBeNull()
  })

  it('setItem delegates to the MMKV set', async () => {
    let storage!: ReturnType<typeof requireSecureStorage>
    jest.isolateModules(() => {
      storage = requireSecureStorage()
    })

    await storage.setItem('session-key', 'session-value')
    expect(mockMmkv.set).toHaveBeenCalledWith('session-key', 'session-value')
  })

  it('removeItem delegates to the MMKV remove', async () => {
    let storage!: ReturnType<typeof requireSecureStorage>
    jest.isolateModules(() => {
      storage = requireSecureStorage()
    })

    await storage.removeItem('session-key')
    expect(mockMmkv.remove).toHaveBeenCalledWith('session-key')
  })

  it('does not call setItemAsync when an existing key is found', async () => {
    let storage!: ReturnType<typeof requireSecureStorage>
    jest.isolateModules(() => {
      storage = requireSecureStorage()
    })

    await storage.getItem('any-key')
    expect(mockSetItemAsync).not.toHaveBeenCalled()
    expect(mockGetRandomBytes).not.toHaveBeenCalled()
  })

  it('reuses the cached promise across multiple calls (storagePromise is memoised)', async () => {
    let storage!: ReturnType<typeof requireSecureStorage>
    jest.isolateModules(() => {
      storage = requireSecureStorage()
    })

    await storage.getItem('k1')
    await storage.setItem('k2', 'v2')
    // getItemAsync should only be called once despite two awaited operations.
    expect(mockGetItemAsync).toHaveBeenCalledTimes(1)
  })
})

describe('secureSessionStorage - no key in SecureStore (first run)', () => {
  beforeEach(() => {
    mockGetItemAsync.mockResolvedValue(null)
    mockSetItemAsync.mockResolvedValue(undefined)
    // Return 32 deterministic bytes so we can assert the derived hex key.
    mockGetRandomBytes.mockReturnValue(new Uint8Array(32).fill(0xab))
  })

  it('generates a new key and persists it with WHEN_UNLOCKED_THIS_DEVICE_ONLY', async () => {
    let storage!: ReturnType<typeof requireSecureStorage>
    jest.isolateModules(() => {
      storage = requireSecureStorage()
    })

    await storage.getItem('any-key')

    expect(mockGetRandomBytes).toHaveBeenCalledWith(32)
    const expectedKey = 'ab'.repeat(32)
    expect(mockSetItemAsync).toHaveBeenCalledWith('zyph.mmkv.encryptionKey', expectedKey, {
      keychainAccessible: 3,
    })
  })

  it('creates the MMKV store with the new AES-256 key', async () => {
    let storage!: ReturnType<typeof requireSecureStorage>
    jest.isolateModules(() => {
      storage = requireSecureStorage()
    })

    await storage.getItem('any-key')

    const expectedKey = 'ab'.repeat(32)
    expect(mockCreateMMKV).toHaveBeenCalledWith({
      id: 'zyph-auth',
      encryptionKey: expectedKey,
      encryptionType: 'AES-256',
    })
  })
})

describe('secureSessionStorage - key resolution failure clears the cached promise', () => {
  it('clears storagePromise on rejection so a subsequent call retries', async () => {
    // First call: getItemAsync rejects.
    mockGetItemAsync.mockRejectedValueOnce(new Error('keychain unavailable'))
    // Second call: getItemAsync resolves with an existing key.
    mockGetItemAsync.mockResolvedValueOnce('retry-key')
    mockMmkv.getString.mockReturnValue('retry-value')

    let storage!: ReturnType<typeof requireSecureStorage>
    jest.isolateModules(() => {
      storage = requireSecureStorage()
    })

    // First access should reject.
    await expect(storage.getItem('k')).rejects.toThrow('keychain unavailable')

    // Second access should succeed because storagePromise was cleared.
    const result = await storage.getItem('k')
    expect(result).toBe('retry-value')
    // getItemAsync must have been called twice (once per attempt).
    expect(mockGetItemAsync).toHaveBeenCalledTimes(2)
  })
})
