module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // babel-preset-expo auto-includes the reanimated/worklets plugin
  }
}
