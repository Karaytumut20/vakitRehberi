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

      // ❗ expo-router/babel KESİNLİKLE KULLANILMIYOR
      // SDK 50+ için kaldırıldı

      // Eğer kullanıyorsan Reanimated plugin'i her zaman en sonda olmalı
      // 'react-native-reanimated/plugin',
    ],
  };
};
