/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Unistyles is a native module; load its official mock + the theme config first.
  setupFiles: ['react-native-unistyles/mocks', '<rootDir>/src/unistyles.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  // Collected only when --coverage is passed (gated to main/nightly in CI).
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
