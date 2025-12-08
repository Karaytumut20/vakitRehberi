export const DAILY_CONTENT = {
  verses: [
    { text: "Şüphesiz namaz, müminlere belirli vakitlerde farz kılınmıştır.", source: "Nisa Suresi, 103. Ayet" },
    { text: "Rabbiniz şöyle buyurdu: Bana dua edin, duanızı kabul edeyim.", source: "Mümin Suresi, 60. Ayet" },
    { text: "İyilik, yüzlerinizi doğu ve batı tarafına çevirmeniz değildir. Asıl iyilik, o kimsenin yaptığıdır ki...", source: "Bakara Suresi, 177. Ayet" }
  ],
  hadiths: [
    { text: "Namaz dinin direğidir.", source: "Hz. Muhammed (S.A.V)" },
    { text: "Sizin en hayırlınız, Kur'an'ı öğrenen ve öğreteninizdir.", source: "Buhari" },
    { text: "Temizlik imanın yarısıdır.", source: "Müslim" }
  ],
  // Vakte özel mesajlar
  prayerSpecific: {
    'İmsak': "Güneş doğmadan önceki bu bereketli vakitte dua etmeyi unutma.",
    'Güneş': "Güneş doğdu, günün hayırlı olsun. İşrak vaktini değerlendirebilirsin.",
    'Öğle': "Dünya işlerine kısa bir ara verip Ruhunu dinlendirme vakti.",
    'İkindi': "Günün yorgunluğunu secde ile atma vakti.",
    'Akşam': "Günü şükürle kapatma vakti.",
    'Yatsı': "Gecenin huzuru ve günün son ibadeti.",
  }
};

export function getRandomContent() {
  const randomVerse = DAILY_CONTENT.verses[Math.floor(Math.random() * DAILY_CONTENT.verses.length)];
  const randomHadith = DAILY_CONTENT.hadiths[Math.floor(Math.random() * DAILY_CONTENT.hadiths.length)];
  return { verse: randomVerse, hadith: randomHadith };
}