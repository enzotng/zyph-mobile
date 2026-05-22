// preferences.ts calls createMMKV at module scope. Because unistyles.ts (in
// setupFiles) imports preferences.ts, the module is already cached before this
// test file runs. We therefore use jest.isolateModules to get a fresh module
// instance with our mocks in effect.

const mockSetAdaptiveThemes = jest.fn()
const mockSetTheme = jest.fn()

jest.mock('react-native-unistyles', () => ({
  UnistylesRuntime: {
    setAdaptiveThemes: mockSetAdaptiveThemes,
    setTheme: mockSetTheme,
  },
}))

const mockMmkv = {
  getBoolean: jest.fn<boolean | undefined, [string]>(),
  getString: jest.fn<string | undefined, [string]>(),
  set: jest.fn<void, [string, unknown]>(),
}

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => mockMmkv),
}))

type PreferencesModule = typeof import('./preferences')

function requirePreferences(): PreferencesModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./preferences') as PreferencesModule
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.resetModules()
})

describe('hasSeenOnboarding', () => {
  it('returns true when the stored boolean is true', () => {
    mockMmkv.getBoolean.mockReturnValue(true)
    jest.isolateModules(() => {
      const { hasSeenOnboarding } = requirePreferences()
      expect(hasSeenOnboarding()).toBe(true)
    })
  })

  it('returns false when the stored boolean is false', () => {
    mockMmkv.getBoolean.mockReturnValue(false)
    jest.isolateModules(() => {
      const { hasSeenOnboarding } = requirePreferences()
      expect(hasSeenOnboarding()).toBe(false)
    })
  })

  it('returns false when the key is absent (undefined)', () => {
    mockMmkv.getBoolean.mockReturnValue(undefined)
    jest.isolateModules(() => {
      const { hasSeenOnboarding } = requirePreferences()
      expect(hasSeenOnboarding()).toBe(false)
    })
  })
})

describe('setOnboardingSeen', () => {
  it('persists true to storage under the onboardingSeen key', () => {
    jest.isolateModules(() => {
      const { setOnboardingSeen } = requirePreferences()
      setOnboardingSeen()
      expect(mockMmkv.set).toHaveBeenCalledWith('onboardingSeen', true)
    })
  })
})

describe('getThemePreference', () => {
  it('returns "light" when "light" is stored', () => {
    mockMmkv.getString.mockReturnValue('light')
    jest.isolateModules(() => {
      const { getThemePreference } = requirePreferences()
      expect(getThemePreference()).toBe('light')
    })
  })

  it('returns "dark" when "dark" is stored', () => {
    mockMmkv.getString.mockReturnValue('dark')
    jest.isolateModules(() => {
      const { getThemePreference } = requirePreferences()
      expect(getThemePreference()).toBe('dark')
    })
  })

  it('returns "system" as fallback when the stored value is unknown', () => {
    mockMmkv.getString.mockReturnValue('something-else')
    jest.isolateModules(() => {
      const { getThemePreference } = requirePreferences()
      expect(getThemePreference()).toBe('system')
    })
  })

  it('returns "system" as fallback when the key is absent', () => {
    mockMmkv.getString.mockReturnValue(undefined)
    jest.isolateModules(() => {
      const { getThemePreference } = requirePreferences()
      expect(getThemePreference()).toBe('system')
    })
  })
})

describe('setThemePreference', () => {
  it('persists the preference to storage', () => {
    jest.isolateModules(() => {
      const { setThemePreference } = requirePreferences()
      setThemePreference('dark')
      expect(mockMmkv.set).toHaveBeenCalledWith('theme', 'dark')
    })
  })

  it('calls applyThemePreference after persisting (setAdaptiveThemes is invoked)', () => {
    jest.isolateModules(() => {
      const { setThemePreference } = requirePreferences()
      setThemePreference('light')
      expect(mockSetAdaptiveThemes).toHaveBeenCalledWith(false)
      expect(mockSetTheme).toHaveBeenCalledWith('light')
    })
  })
})

describe('applyThemePreference', () => {
  it('enables adaptive themes when preference is "system"', () => {
    jest.isolateModules(() => {
      const { applyThemePreference } = requirePreferences()
      applyThemePreference('system')
      expect(mockSetAdaptiveThemes).toHaveBeenCalledWith(true)
      expect(mockSetTheme).not.toHaveBeenCalled()
    })
  })

  it('disables adaptive themes and sets theme when preference is "light"', () => {
    jest.isolateModules(() => {
      const { applyThemePreference } = requirePreferences()
      applyThemePreference('light')
      expect(mockSetAdaptiveThemes).toHaveBeenCalledWith(false)
      expect(mockSetTheme).toHaveBeenCalledWith('light')
    })
  })

  it('disables adaptive themes and sets theme when preference is "dark"', () => {
    jest.isolateModules(() => {
      const { applyThemePreference } = requirePreferences()
      applyThemePreference('dark')
      expect(mockSetAdaptiveThemes).toHaveBeenCalledWith(false)
      expect(mockSetTheme).toHaveBeenCalledWith('dark')
    })
  })
})
