// Runs after the test framework is set up, before each test file.
// @testing-library/react-native v13 ships its built-in matchers (toBeOnTheScreen, etc.)
// automatically, so no extra import is required here.
// Add global mocks (e.g. react-native-reanimated) here as features need them.

// Bind react-i18next so useTranslation().t returns real strings in tests (English).
// We init a minimal instance directly to avoid the app module's expo-localization /
// preferences dependencies; locale resources are the source of truth.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from '@/lib/i18n/locales/en'
import { fr } from '@/lib/i18n/locales/fr'

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}

// Lightweight Skia mock: the CanvasKit/WASM runtime is not loaded in unit tests. Canvas
// and Path render to nothing and Skia.Path.Make() returns a no-op path, so Skia-backed
// components (Squircle, the Wayfinder overlay) can render in tests without the native module.
jest.mock('@shopify/react-native-skia', () => {
  const noopPath = () => ({
    moveTo: () => undefined,
    lineTo: () => undefined,
    close: () => undefined,
  })
  const target: Record<PropertyKey, unknown> = {
    __esModule: true,
    Skia: { Path: { Make: noopPath } },
  }
  return new Proxy(target, {
    get: (obj, prop) => (prop in obj ? obj[prop] : () => null),
  })
})

// @react-native-community/netinfo: native module absent in unit tests. Use the package's
// own jest mock so onlineManager wiring and useIsOnline can load without the native side.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
)

// react-native-reanimated: the native worklets runtime is absent in unit tests, so its
// real entry crashes on import. Provide a lightweight mock - Animated.View/Text are plain
// RN views, layout-animation builders and hooks are chainable no-ops, and any other export
// resolves to a callable/indexable no-op so reanimated-using components render in tests.
jest.mock('react-native-reanimated', () => {
  const { Text, View } = require('react-native')
  const anything = (): unknown =>
    new Proxy(() => undefined, {
      get: () => anything(),
      apply: () => anything(),
    })
  const target: Record<PropertyKey, unknown> = {
    __esModule: true,
    default: { View, Text, createAnimatedComponent: (component: unknown) => component },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
    withTiming: (value: unknown) => value,
    withSpring: (value: unknown) => value,
    withDelay: (_delay: unknown, value: unknown) => value,
    runOnJS: (fn: unknown) => fn,
    interpolate: () => 0,
    interpolateColor: () => 'rgba(0, 0, 0, 0)',
  }
  return new Proxy(target, {
    get: (obj, prop) => (prop in obj ? obj[prop] : anything()),
  })
})
