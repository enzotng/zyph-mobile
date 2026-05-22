module.exports = (api) => {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // Unistyles 3 compile-time plugin. `root` points to the folder it processes.
    // It disables itself automatically when NODE_ENV=test (jest uses the mock).
    // babel-preset-expo already injects the Reanimated/Worklets plugin.
    plugins: [['react-native-unistyles/plugin', { root: 'src' }]],
  }
}
