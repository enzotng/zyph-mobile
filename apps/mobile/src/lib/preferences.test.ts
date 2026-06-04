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

describe('getLanguagePreference', () => {
  it('returns "en" when "en" is stored', () => {
    mockMmkv.getString.mockReturnValue('en')
    jest.isolateModules(() => {
      const { getLanguagePreference } = requirePreferences()
      expect(getLanguagePreference()).toBe('en')
    })
  })

  it('returns "fr" when "fr" is stored', () => {
    mockMmkv.getString.mockReturnValue('fr')
    jest.isolateModules(() => {
      const { getLanguagePreference } = requirePreferences()
      expect(getLanguagePreference()).toBe('fr')
    })
  })

  it('returns "system" as fallback when the stored value is unknown', () => {
    mockMmkv.getString.mockReturnValue('de')
    jest.isolateModules(() => {
      const { getLanguagePreference } = requirePreferences()
      expect(getLanguagePreference()).toBe('system')
    })
  })

  it('returns "system" as fallback when the key is absent', () => {
    mockMmkv.getString.mockReturnValue(undefined)
    jest.isolateModules(() => {
      const { getLanguagePreference } = requirePreferences()
      expect(getLanguagePreference()).toBe('system')
    })
  })
})

describe('setLanguagePreference', () => {
  it('persists the preference to storage under the language key', () => {
    jest.isolateModules(() => {
      const { setLanguagePreference } = requirePreferences()
      setLanguagePreference('fr')
      expect(mockMmkv.set).toHaveBeenCalledWith('language', 'fr')
    })
  })
})

describe('getShareLocation', () => {
  it('returns true when the stored boolean for the trip is true', () => {
    mockMmkv.getBoolean.mockReturnValue(true)
    jest.isolateModules(() => {
      const { getShareLocation } = requirePreferences()
      expect(getShareLocation('trip-1')).toBe(true)
      expect(mockMmkv.getBoolean).toHaveBeenCalledWith('shareLocation:trip-1')
    })
  })

  it('returns false when the stored boolean for the trip is false', () => {
    mockMmkv.getBoolean.mockReturnValue(false)
    jest.isolateModules(() => {
      const { getShareLocation } = requirePreferences()
      expect(getShareLocation('trip-2')).toBe(false)
    })
  })

  it('returns false when no value is stored for the trip (undefined)', () => {
    mockMmkv.getBoolean.mockReturnValue(undefined)
    jest.isolateModules(() => {
      const { getShareLocation } = requirePreferences()
      expect(getShareLocation('trip-3')).toBe(false)
      expect(mockMmkv.getBoolean).toHaveBeenCalledWith('shareLocation:trip-3')
    })
  })
})

describe('setShareLocation', () => {
  it('persists true under the trip-scoped key when enabled', () => {
    jest.isolateModules(() => {
      const { setShareLocation } = requirePreferences()
      setShareLocation('trip-1', true)
      expect(mockMmkv.set).toHaveBeenCalledWith('shareLocation:trip-1', true)
    })
  })

  it('persists false under the trip-scoped key when disabled', () => {
    jest.isolateModules(() => {
      const { setShareLocation } = requirePreferences()
      setShareLocation('trip-2', false)
      expect(mockMmkv.set).toHaveBeenCalledWith('shareLocation:trip-2', false)
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
