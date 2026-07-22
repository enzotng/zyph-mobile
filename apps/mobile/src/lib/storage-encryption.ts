import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { createMMKV, type MMKV } from 'react-native-mmkv'

// Distinct from zyph.mmkv.encryptionKey, which is dedicated to the zyph-auth store.
const ENCRYPTION_KEY_ALIAS = 'zyph.storage.encryptionKey'

// 64 chars so `byte & 63` maps each random byte uniformly to one char (32 chars x 6 bits =
// 192 bits). Not hex: MMKV's AESCrypt silently truncates keys to 32 bytes, which would halve
// the entropy of a 64-char hex key. Not base64: no synchronous encoder is available.
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

let cachedKey: string | null = null

export function getStorageEncryptionKey(): string {
  if (cachedKey) {
    return cachedKey
  }

  const existing = SecureStore.getItem(ENCRYPTION_KEY_ALIAS)
  if (existing) {
    cachedKey = existing
    return existing
  }

  const bytes = Crypto.getRandomBytes(32)
  const key = Array.from(bytes, (byte) => KEY_ALPHABET.charAt(byte & 63)).join('')
  // AFTER_FIRST_UNLOCK keeps the key readable in background launches; THIS_DEVICE_ONLY keeps
  // it out of backups. If this write throws (keychain still locked), the key must not be
  // memoized: encrypting stores with a key that was never persisted would make them
  // unrecoverable.
  SecureStore.setItem(ENCRYPTION_KEY_ALIAS, key, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  })
  cachedKey = key

  return key
}

export function openEncryptedMMKV(id: string, options?: { discardExisting?: boolean }): MMKV {
  const encryptionKey = getStorageEncryptionKey()
  const enc = createMMKV({ id: `${id}-enc`, encryptionKey, encryptionType: 'AES-256' })

  // The legacy plaintext store must be opened through the same createMMKV path resolution
  // that created it (App Group container on iOS); existsMMKV/deleteMMKV resolve the default
  // Documents/mmkv directory and would never find it. Never pass a key here: opening a
  // plaintext store with a key (or an encrypted one without) corrupts it on the first write.
  const plain = createMMKV({ id })

  if (options?.discardExisting) {
    plain.clearAll()
    plain.trim()
    return enc
  }

  if (plain.getAllKeys().length > 0) {
    enc.importAllFrom(plain)
    plain.clearAll()
    plain.trim()
  }

  return enc
}
