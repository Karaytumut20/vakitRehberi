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
            '@': './',   // <-- alias düzeltilmiş hali
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      ],
      'expo-router/babel',
    ],
  };
};
