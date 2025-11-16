module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      ],
      // 🚀 This is the correct way to include the Expo Router plugin 
      // for all recent SDKs (v49, v50, etc.):
      'expo-router/babel', 
      
      // If you are using Reanimated, ensure its plugin is the very last one.
      // 'react-native-reanimated/plugin', 
    ],
  };
};