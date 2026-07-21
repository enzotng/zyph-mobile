// storage-encryption.ts is preloaded by setupFiles once preferences.ts imports it, so tests
// re-require it via isolateModules (same pattern as preferences.test.ts). expo-secure-store is
// mocked explicitly: the jest-expo auto-mock returns {} (truthy) from getItem, which would make
// every "key present" branch pass vacuously.

const mockGetItem = jest.fn<string | null, [string]>()
const mockSetItem = jest.fn<void, [string, string, { keychainAccessible?: number }?]>()

jest.mock('expo-secure-store', () => ({
  getItem: mockGetItem,
  setItem: mockSetItem,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
}))

const mockGetRandomBytes = jest.fn<Uint8Array, [number]>()

jest.mock('expo-crypto', () => ({
  getRandomBytes: mockGetRandomBytes,
}))

type MockConfig = { id: string; encryptionKey?: string; encryptionType?: string }
type MockStore = {
  getAllKeys: jest.Mock
  importAllFrom: jest.Mock
  clearAll: jest.Mock
  trim: jest.Mock
}

const mockCreatedStores: { config: MockConfig; store: MockStore }[] = []
let mockPlainKeys: string[] = []
let mockImportError: Error | null = null

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn((config: MockConfig) => {
    const store: MockStore = {
      getAllKeys: jest.fn(() => (config.encryptionKey ? [] : mockPlainKeys)),
      importAllFrom: jest.fn(() => {
        if (mockImportError) {
          throw mockImportError
        }
        return 0
      }),
      clearAll: jest.fn(),
      trim: jest.fn(),
    }
    mockCreatedStores.push({ config, store })
    return store
  }),
}))

type StorageEncryptionModule = typeof import('./storage-encryption')

function requireStorageEncryption(): StorageEncryptionModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./storage-encryption') as StorageEncryptionModule
}

const STORED_KEY = 'K'.repeat(32)

beforeEach(() => {
  jest.clearAllMocks()
  jest.resetModules()
  mockCreatedStores.length = 0
  mockPlainKeys = []
  mockImportError = null
  mockGetItem.mockReturnValue(null)
})

describe('getStorageEncryptionKey', () => {
  it('generates a 32-char key from the 64-char alphabet and persists it', () => {
    mockGetRandomBytes.mockReturnValue(Uint8Array.from({ length: 32 }, (_, i) => i))
    jest.isolateModules(() => {
      const { getStorageEncryptionKey } = requireStorageEncryption()
      expect(getStorageEncryptionKey()).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef')
    })
    expect(mockSetItem).toHaveBeenCalledWith(
      'zyph.storage.encryptionKey',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef',
      { keychainAccessible: 1 },
    )
  })

  it('maps byte 255 to the last alphabet char (byte & 63, no modulo bias)', () => {
    mockGetRandomBytes.mockReturnValue(new Uint8Array(32).fill(255))
    jest.isolateModules(() => {
      const { getStorageEncryptionKey } = requireStorageEncryption()
      const key = getStorageEncryptionKey()
      expect(key).toBe('_'.repeat(32))
      expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/)
    })
  })

  it('reuses an existing key without writing or generating', () => {
    mockGetItem.mockReturnValue(STORED_KEY)
    jest.isolateModules(() => {
      const { getStorageEncryptionKey } = requireStorageEncryption()
      expect(getStorageEncryptionKey()).toBe(STORED_KEY)
    })
    expect(mockSetItem).not.toHaveBeenCalled()
    expect(mockGetRandomBytes).not.toHaveBeenCalled()
  })

  it('memoizes the key across calls', () => {
    mockGetItem.mockReturnValue(STORED_KEY)
    jest.isolateModules(() => {
      const { getStorageEncryptionKey } = requireStorageEncryption()
      getStorageEncryptionKey()
      getStorageEncryptionKey()
    })
    expect(mockGetItem).toHaveBeenCalledTimes(1)
  })

  it('does not memoize after a failed keychain write, so the next call retries', () => {
    mockGetRandomBytes.mockReturnValue(Uint8Array.from({ length: 32 }, (_, i) => i))
    mockSetItem.mockImplementationOnce(() => {
      throw new Error('keychain unavailable')
    })
    jest.isolateModules(() => {
      const { getStorageEncryptionKey } = requireStorageEncryption()
      expect(() => getStorageEncryptionKey()).toThrow('keychain unavailable')
      expect(getStorageEncryptionKey()).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef')
    })
    expect(mockSetItem).toHaveBeenCalledTimes(2)
  })
})

describe('openEncryptedMMKV', () => {
  beforeEach(() => {
    mockGetItem.mockReturnValue(STORED_KEY)
  })

  it('opens the encrypted store with the key and the legacy store without it', () => {
    jest.isolateModules(() => {
      const { openEncryptedMMKV } = requireStorageEncryption()
      const result = openEncryptedMMKV('zyph-copilot')
      expect(result).toBe(mockCreatedStores[0].store)
    })
    expect(mockCreatedStores[0].config).toStrictEqual({
      id: 'zyph-copilot-enc',
      encryptionKey: STORED_KEY,
      encryptionType: 'AES-256',
    })
    expect(mockCreatedStores[1].config).toStrictEqual({ id: 'zyph-copilot' })
  })

  it('imports a non-empty legacy store then empties it, in that order', () => {
    mockPlainKeys = ['chat-v2:t1']
    jest.isolateModules(() => {
      const { openEncryptedMMKV } = requireStorageEncryption()
      openEncryptedMMKV('zyph-copilot')
    })
    const [enc, plain] = mockCreatedStores
    expect(enc.store.importAllFrom).toHaveBeenCalledWith(plain.store)
    expect(plain.store.clearAll).toHaveBeenCalledTimes(1)
    expect(plain.store.trim).toHaveBeenCalledTimes(1)
    const importOrder = enc.store.importAllFrom.mock.invocationCallOrder[0]
    const clearOrder = plain.store.clearAll.mock.invocationCallOrder[0]
    expect(importOrder).toBeLessThan(clearOrder)
  })

  it('skips import and clear when the legacy store is empty', () => {
    jest.isolateModules(() => {
      const { openEncryptedMMKV } = requireStorageEncryption()
      openEncryptedMMKV('zyph-copilot')
    })
    const [enc, plain] = mockCreatedStores
    expect(enc.store.importAllFrom).not.toHaveBeenCalled()
    expect(plain.store.clearAll).not.toHaveBeenCalled()
  })

  it('discardExisting empties the legacy store without reading it', () => {
    mockPlainKeys = ['react-query']
    jest.isolateModules(() => {
      const { openEncryptedMMKV } = requireStorageEncryption()
      const result = openEncryptedMMKV('zyph-query-cache', { discardExisting: true })
      expect(result).toBe(mockCreatedStores[0].store)
    })
    const [enc, plain] = mockCreatedStores
    expect(plain.store.getAllKeys).not.toHaveBeenCalled()
    expect(enc.store.importAllFrom).not.toHaveBeenCalled()
    expect(plain.store.clearAll).toHaveBeenCalledTimes(1)
    expect(plain.store.trim).toHaveBeenCalledTimes(1)
  })

  it('does not empty the legacy store when the import throws', () => {
    mockPlainKeys = ['chat-v2:t1']
    mockImportError = new Error('import failed')
    jest.isolateModules(() => {
      const { openEncryptedMMKV } = requireStorageEncryption()
      expect(() => openEncryptedMMKV('zyph-copilot')).toThrow('import failed')
    })
    const plain = mockCreatedStores[1]
    expect(plain.store.clearAll).not.toHaveBeenCalled()
  })

  it('opens no store at all when the key cannot be persisted', () => {
    mockGetItem.mockReturnValue(null)
    mockGetRandomBytes.mockReturnValue(new Uint8Array(32))
    mockSetItem.mockImplementation(() => {
      throw new Error('keychain unavailable')
    })
    jest.isolateModules(() => {
      const { openEncryptedMMKV } = requireStorageEncryption()
      expect(() => openEncryptedMMKV('zyph-copilot')).toThrow('keychain unavailable')
    })
    expect(mockCreatedStores).toHaveLength(0)
  })
})
