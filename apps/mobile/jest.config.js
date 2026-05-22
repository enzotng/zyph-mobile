/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  moduleNameMapper: {
    // CSS / global stylesheet side-effect imports are not JS; stub them.
    '\\.(css|sass|scss)$': '<rootDir>/jest/style-mock.js',
  },
  // Collected only when --coverage is passed (gated to main/nightly in CI).
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
