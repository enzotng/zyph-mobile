import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { createMMKV, type MMKV } from 'react-native-mmkv'

// The MMKV store is encrypted at rest; its AES key lives in the device keychain
// (SecureStore), so the session payload is never readable from the app sandbox.
const ENCRYPTION_KEY_ALIAS = 'zyph.mmkv.encryptionKey'

let storagePromise: Promise<MMKV> | null = null

async function resolveEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_ALIAS)
  if (existing) {
    return existing
  }

  const bytes = Crypto.getRandomBytes(32)
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  // Bind the key to this device and keep it out of iCloud/iTunes backups.
  await SecureStore.setItemAsync(ENCRYPTION_KEY_ALIAS, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })

  return key
}

function getEncryptedStorage(): Promise<MMKV> {
  if (!storagePromise) {
    storagePromise = resolveEncryptionKey()
      .then((encryptionKey) =>
        createMMKV({ id: 'zyph-auth', encryptionKey, encryptionType: 'AES-256' }),
      )
      .catch((error: unknown) => {
        // Don't cache a rejected promise — allow a retry on the next access.
        storagePromise = null
        throw error
      })
  }

  return storagePromise
}

// Async storage adapter consumed by supabase-js Auth.
export const secureSessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const storage = await getEncryptedStorage()
    return storage.getString(key) ?? null
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const storage = await getEncryptedStorage()
    storage.set(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    const storage = await getEncryptedStorage()
    storage.remove(key)
  },
}
