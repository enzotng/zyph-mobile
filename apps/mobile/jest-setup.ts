// Runs after the test framework is set up, before each test file.
// @testing-library/react-native v13 ships its built-in matchers (toBeOnTheScreen, etc.)
// automatically, so no extra import is required here.
// Add global mocks (e.g. react-native-reanimated) here as features need them.

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
