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
      // ❌ Bunu kaldırdık: 'expo-router/babel'
      require.resolve("expo-router/plugin"), // ✅ SDK 50+ için doğru kullanım
    ],
  };
};
A