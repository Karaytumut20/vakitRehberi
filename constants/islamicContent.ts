// Dosya Yolu: src/constants/dailyContent.js

export const DAILY_CONTENT = {
  verses: [
    { text: "Şüphesiz namaz, müminlere belirli vakitlerde farz kılınmıştır.", source: "Nisa Suresi, 103. Ayet" },
    { text: "Rabbiniz şöyle buyurdu: Bana dua edin, duanızı kabul edeyim.", source: "Mümin Suresi, 60. Ayet" },
    { text: "İyilik, yüzlerinizi doğu ve batı tarafına çevirmeniz değildir. Asıl iyilik takvadır.", source: "Bakara Suresi, 177. Ayet" },
    { text: "Allah, sabredenlerle beraberdir.", source: "Bakara Suresi, 153. Ayet" },
    { text: "Bilsinler ki, kalpler ancak Allah'ı anmakla huzur bulur.", source: "Ra'd Suresi, 28. Ayet" },
    { text: "Biz insanı en güzel biçimde yarattık.", source: "Tin Suresi, 4. Ayet" },
    { text: "Şüphesiz güçlükle beraber bir kolaylık vardır.", source: "İnşirah Suresi, 5. Ayet" },
    { text: "O, hanginizin daha güzel amel yapacağını sınamak için ölümü ve hayatı yaratandır.", source: "Mülk Suresi, 2. Ayet" },
    { text: "Rabbimiz! Bize dünyada da iyilik ver, ahirette de iyilik ver.", source: "Bakara Suresi, 201. Ayet" },
    { text: "Kim zerre miktarı hayır işlerse onun karşılığını görür.", source: "Zilzal Suresi, 7. Ayet" },
    { text: "Allah size kolaylık diler, zorluk dilemez.", source: "Bakara Suresi, 185. Ayet" },
    { text: "Eğer şükrederseniz, elbette size nimetimi artırırım.", source: "İbrahim Suresi, 7. Ayet" },
    { text: "Müminler ancak kardeştirler.", source: "Hucurat Suresi, 10. Ayet" },
    { text: "Allah'ın rahmetinden ümidinizi kesmeyin.", source: "Zümer Suresi, 53. Ayet" },
    { text: "Sizin ilahınız tek bir ilahtır; O'ndan başka ilah yoktur.", source: "Bakara Suresi, 163. Ayet" },
    { text: "O (Kur'an), inananlar için bir hidayet ve rahmettir.", source: "Neml Suresi, 77. Ayet" },
    { text: "Ey iman edenler! Allah'tan korkun ve doğrularla beraber olun.", source: "Tevbe Suresi, 119. Ayet" },
    { text: "Göklerde ve yerde ne varsa hepsi Allah'ı tesbih eder.", source: "Haşr Suresi, 1. Ayet" },
    { text: "O, duaları işitendir, kabul edendir.", source: "Şura Suresi, 25. Ayet" },
    { text: "Yiyin, için fakat israf etmeyin. Çünkü O, israf edenleri sevmez.", source: "Araf Suresi, 31. Ayet" },
    { text: "Rabbin, kendisinden başkasına asla ibadet etmemenizi hükmetti.", source: "İsra Suresi, 23. Ayet" },
    { text: "Doğu da Allah'ındır, batı da. Nereye dönerseniz Allah'ın yüzü oradadır.", source: "Bakara Suresi, 115. Ayet" },
    { text: "Allah, adaleti, iyilik yapmayı ve yakınlara yardım etmeyi emreder.", source: "Nahl Suresi, 90. Ayet" },
    { text: "Kullarım sana beni sorduğunda, (bilsinler ki) ben çok yakınım.", source: "Bakara Suresi, 186. Ayet" },
    { text: "Ey Rabbimiz! Üzerimize sabır yağdır ve canımızı müslüman olarak al.", source: "Araf Suresi, 126. Ayet" },
    { text: "Şüphesiz Allah, tövbe edenleri ve temizlenenleri sever.", source: "Bakara Suresi, 222. Ayet" },
    { text: "Bizi doğru yola, kendilerine nimet verdiklerinin yoluna ilet.", source: "Fatiha Suresi, 6-7. Ayet" },
    { text: "De ki: O Allah tektir. Allah Samed'dir (Her şey O'na muhtaçtır).", source: "İhlas Suresi, 1-2. Ayet" },
    { text: "Size selam verildiği zaman, ondan daha güzeliyle veya aynısı ile karşılık verin.", source: "Nisa Suresi, 86. Ayet" },
    { text: "Ancak sana kulluk eder ve ancak senden yardım dileriz.", source: "Fatiha Suresi, 5. Ayet" }
  ],
  // Vakte özel mesajlar
  prayerSpecific: {
    'İmsak': "Güneş doğmadan önceki bu bereketli vakitte dua etmeyi unutma.",
    'Güneş': "Güneş doğdu, günün hayırlı olsun. İşrak vaktini değerlendirebilirsin.",
    'Öğle': "Dünya işlerine kısa bir ara verip ruhunu dinlendirme vakti.",
    'İkindi': "Günün yorgunluğunu secde ile atma vakti.",
    'Akşam': "Günü şükürle kapatma vakti.",
    'Yatsı': "Gecenin huzuru ve günün son ibadeti. Vitir namazını unutma.",
  }
};

/**
 * Rastgele bir Ayet döndürür.
 * (Hadisler kaldırıldı, sadece 'verse' döner)
 */
export function getRandomContent() {
  const randomVerse = DAILY_CONTENT.verses[Math.floor(Math.random() * DAILY_CONTENT.verses.length)];
  return { verse: randomVerse };
}

/**
 * Yılın gününe göre sabit bir Ayet döndürür.
 * Bugün uygulamaya giren herkes aynı ayeti görür.
 */
export function getDailyFixedContent() {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    const verseIndex = dayOfYear % DAILY_CONTENT.verses.length;

    return {
        verse: DAILY_CONTENT.verses[verseIndex]
    };
}