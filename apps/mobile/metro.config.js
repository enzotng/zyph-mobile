// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];
// 2. Resolve modules from the app first, then the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// 3. Keep colocated test files out of the app bundle: the expo-router route context matches
// every .ts(x) under src/app (its regex has no test exclusion), so a colocated screen test
// would be bundled as a route and drag jest-only dependencies into the native runtime.
// Jest does not go through Metro, so tests are unaffected.
const testFilePattern = /\/src\/.*\.test\.[jt]sx?$/;
config.resolver.blockList = Array.isArray(config.resolver.blockList)
  ? [...config.resolver.blockList, testFilePattern]
  : [config.resolver.blockList, testFilePattern].filter(Boolean);

module.exports = config;
