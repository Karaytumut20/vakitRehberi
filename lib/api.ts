import AsyncStorage from '@react-native-async-storage/async-storage';

export async function fetchAladhanTimes(lat: string, lon: string) {
  const now = new Date();
  const y1 = now.getFullYear();
  const m1 = now.getMonth() + 1;
  let m2 = m1 + 1;
  let y2 = y1;
  if (m2 > 12) { m2 = 1; y2++; }

  // 15 günlük takvimin sorunsuz çalışması için bulunduğumuz ayı ve sonraki ayı çekiyoruz
  const [res1, res2] = await Promise.all([
    fetch(`https://api.aladhan.com/v1/calendar/${y1}/${m1}?latitude=${lat}&longitude=${lon}&method=13`),
    fetch(`https://api.aladhan.com/v1/calendar/${y2}/${m2}?latitude=${lat}&longitude=${lon}&method=13`)
  ]);

  const data1 = await res1.json();
  const data2 = await res2.json();

  if (data1.code !== 200 || data2.code !== 200) throw new Error('API Hatası');

  const combined = [...data1.data, ...data2.data];

  const hijriMonthsTR = ["Muharrem", "Safer", "Rebiülevvel", "Rebiülahir", "Cemaziyelevvel", "Cemaziyelahir", "Recep", "Şaban", "Ramazan", "Şevval", "Zilkade", "Zilhicce"];

  return combined.map((day: any) => {
    const cleanTime = (t: string) => t.split(' ')[0]; // '(+03)' gibi ekleri temizler
    const [d, m, y] = day.date.gregorian.date.split('-');
    
    // Hicri Tarih Hesaplama
    const hijriDay = day.date.hijri.day;
    const hijriMonthNum = parseInt(day.date.hijri.month.number, 10);
    const hijriYear = day.date.hijri.year;
    const hijriDateTR = `${hijriDay} ${hijriMonthsTR[hijriMonthNum - 1]} ${hijriYear}`;
    return {
      date: `${y}-${m}-${d}`,
      fajr: cleanTime(day.timings.Imsak), // Diyanet metodunda Imsak alınır
      sun: cleanTime(day.timings.Sunrise),
      dhuhr: cleanTime(day.timings.Dhuhr),
      asr: cleanTime(day.timings.Asr),
      maghrib: cleanTime(day.timings.Maghrib),
      isha: cleanTime(day.timings.Isha),
      hijriDate: hijriDateTR
    };
  });
}