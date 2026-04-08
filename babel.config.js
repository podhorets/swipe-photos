module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource replaces the separate nativewind/babel plugin in NativeWind v4
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      // Reanimated plugin must be last
      'react-native-reanimated/plugin',
    ],
  };
};
