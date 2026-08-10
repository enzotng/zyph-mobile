import * as Notifications from 'expo-notifications'

import i18n from '@/lib/i18n'

import { deletePushToken, registerPushToken } from './api/notifications.api'
import { registerForPushNotifications, unregisterForPushNotifications } from './push'

jest.mock('./api/notifications.api', () => ({
  registerPushToken: jest.fn(() => Promise.resolve()),
  deletePushToken: jest.fn(() => Promise.resolve()),
}))

// The global mock reports a simulator with a denied permission; this suite needs a real device
// that granted push, and an EAS project id for getExpoPushTokenAsync.
jest.mock('expo-device', () => ({ isDevice: true }))
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } }, easConfig: null },
}))

const mockRegister = registerPushToken as jest.MockedFunction<typeof registerPushToken>
const mockDelete = deletePushToken as jest.MockedFunction<typeof deletePushToken>
const TOKEN = 'ExpoPushToken[test]'

describe('push locale follows the app language', () => {
  beforeEach(async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' })
    await i18n.changeLanguage('en')
    jest.clearAllMocks()
  })

  it('registers the token with the language active at the time', async () => {
    await registerForPushNotifications()

    expect(mockRegister).toHaveBeenCalledWith(TOKEN, expect.any(String), 'en')
  })

  it('rewrites the stored locale when the language changes', async () => {
    await registerForPushNotifications()
    mockRegister.mockClear()

    await i18n.changeLanguage('fr')

    expect(mockRegister).toHaveBeenCalledWith(TOKEN, expect.any(String), 'fr')
  })

  it('does not write a locale once the device token has been removed', async () => {
    await registerForPushNotifications()
    await unregisterForPushNotifications()
    mockRegister.mockClear()

    await i18n.changeLanguage('fr')

    expect(mockRegister).not.toHaveBeenCalled()
  })

  // i18next emits languageChanged even when the language is unchanged, so the settings picker
  // would otherwise write the same locale again on every tap.
  it('ignores a language change that resolves to the same language', async () => {
    await registerForPushNotifications()
    mockRegister.mockClear()

    await i18n.changeLanguage('en')

    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('retries on the next change after a failed rewrite', async () => {
    await registerForPushNotifications()
    mockRegister.mockRejectedValueOnce(new Error('offline'))
    await i18n.changeLanguage('fr')
    mockRegister.mockClear()

    await i18n.changeLanguage('en')

    expect(mockRegister).toHaveBeenCalledWith(TOKEN, expect.any(String), 'en')
  })

  // The guard must key off what the database actually received, not off the language at the end
  // of registration - otherwise a change landing mid-register is taken for already applied.
  it('still corrects the locale when the language changed during registration', async () => {
    mockRegister.mockImplementationOnce(async () => {
      await i18n.changeLanguage('fr')
    })
    await registerForPushNotifications()
    mockRegister.mockClear()

    await i18n.changeLanguage('fr')

    expect(mockRegister).toHaveBeenCalledWith(TOKEN, expect.any(String), 'fr')
  })

  it('does not re-register the token while sign-out is still removing it', async () => {
    await registerForPushNotifications()
    mockRegister.mockClear()
    let finishDelete: () => void = () => {}
    mockDelete.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishDelete = resolve
        }),
    )

    const signingOut = unregisterForPushNotifications()
    await i18n.changeLanguage('fr')
    finishDelete()
    await signingOut

    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('swallows a failed locale rewrite', async () => {
    await registerForPushNotifications()
    mockRegister.mockClear()
    mockRegister.mockRejectedValueOnce(new Error('offline'))

    await expect(i18n.changeLanguage('fr')).resolves.toBeDefined()
  })
})
