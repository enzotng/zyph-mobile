/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Discover app tests plus the calendar-feed edge function's colocated ics.test.ts: ics.ts is a
  // pure module (no Deno-only APIs) that lives outside src/, so it's not found by the default
  // rootDir-only discovery unless explicitly added here.
  roots: ['<rootDir>/src', '<rootDir>/../../supabase/functions/calendar-feed'],
  // Unistyles is a native module; load its official mock + the theme config first.
  setupFiles: ['<rootDir>/jest-env.js', 'react-native-unistyles/mocks', '<rootDir>/src/unistyles.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  // Mirror the tsconfig "@/*" path alias for Jest's module resolver (assets first).
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Collected only when --coverage is passed (gated to main/nightly in CI).
  // Screens/routing (app/**) are validated by E2E (Maestro, TECH-008), not unit tests;
  // generated types and barrel files carry no logic.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**',
    '!src/**/index.{ts,tsx}',
    '!src/lib/database.types.ts',
    // Thin Supabase client init with an AppState side-effect; nothing to unit test.
    '!src/lib/supabase.ts',
    '!src/test-utils/**',
    '!src/unistyles.ts',
    // Native-bridge code validated on-device / by E2E (like app/** above), not in unit
    // tests: device sensors (magnetometer/accelerometer/GPS), the camera scanner, and the
    // sensor-driven AR wayfinder overlay + live-location sharing.
    '!src/lib/sensors/**',
    '!src/components/receipt-scanner.tsx',
    // Native "Sign in with Apple" button (AppleAuthenticationButton) - validated on-device.
    '!src/features/auth/components/apple-button.tsx',
    '!src/features/wayfinder/components/**',
    '!src/features/wayfinder/hooks/use-share-location.ts',
    '!src/features/wayfinder/hooks/use-wayfinder.ts',
  ],
  // Enforce coverage on business logic (features/lib/components). Screens/routing are
  // covered by E2E (Maestro, TECH-008) and excluded above via collectCoverageFrom.
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
};
