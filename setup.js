const fs = require("fs");
const path = require("path");

console.log(
  "🚀 Vakit Rehberi - Aladhan API Geçişi ve Hata Çözümleri Başlıyor...\n",
);

// 1. APP.JSON (iOS AdMob Çökme Düzeltmesi)
const appJsonPath = path.join(__dirname, "app.json");
if (fs.existsSync(appJsonPath)) {
  let appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
  if (appJson["react-native-google-mobile-ads"]) {
    // Kendi iOS Admob ID'nizi alana kadar uygulamanın çökmemesi için Google Test ID'si eklenir
    appJson["react-native-google-mobile-ads"]["ios_app_id"] =
      "ca-app-pub-3940256099942544~1458002511";
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log("✅ app.json güncellendi (iOS AdMob Test ID'si eklendi).");
  }
}

// 2. LIB/API.TS (Aladhan API Bağlantı Dosyasının Oluşturulması)
const apiCode = [
  "import AsyncStorage from '@react-native-async-storage/async-storage';",
  "",
  "export async function fetchAladhanTimes(lat: string, lon: string) {",
  "  const now = new Date();",
  "  const y1 = now.getFullYear();",
  "  const m1 = now.getMonth() + 1;",
  "  let m2 = m1 + 1;",
  "  let y2 = y1;",
  "  if (m2 > 12) { m2 = 1; y2++; }",
  "",
  "  // 15 günlük takvimin sorunsuz çalışması için bulunduğumuz ayı ve sonraki ayı çekiyoruz",
  "  const [res1, res2] = await Promise.all([",
  "    fetch(`https://api.aladhan.com/v1/calendar/${y1}/${m1}?latitude=${lat}&longitude=${lon}&method=13`),",
  "    fetch(`https://api.aladhan.com/v1/calendar/${y2}/${m2}?latitude=${lat}&longitude=${lon}&method=13`)",
  "  ]);",
  "",
  "  const data1 = await res1.json();",
  "  const data2 = await res2.json();",
  "",
  "  if (data1.code !== 200 || data2.code !== 200) throw new Error('API Hatası');",
  "",
  "  const combined = [...data1.data, ...data2.data];",
  "  return combined.map((day: any) => {",
  "    const cleanTime = (t: string) => t.split(' ')[0]; // '(+03)' gibi ekleri temizler",
  "    const [d, m, y] = day.date.gregorian.date.split('-');",
  "    return {",
  "      date: `${y}-${m}-${d}`,",
  "      fajr: cleanTime(day.timings.Imsak), // Diyanet metodunda Imsak alınır",
  "      sun: cleanTime(day.timings.Sunrise),",
  "      dhuhr: cleanTime(day.timings.Dhuhr),",
  "      asr: cleanTime(day.timings.Asr),",
  "      maghrib: cleanTime(day.timings.Maghrib),",
  "      isha: cleanTime(day.timings.Isha)",
  "    };",
  "  });",
  "}",
].join("\n");

const apiPath = path.join(__dirname, "lib/api.ts");
if (!fs.existsSync(path.dirname(apiPath)))
  fs.mkdirSync(path.dirname(apiPath), { recursive: true });
fs.writeFileSync(apiPath, apiCode, "utf8");
console.log("✅ lib/api.ts oluşturuldu (Aladhan Entegrasyonu).");

// 3. APP/SELECT-LOCATION.TSX (Yeni Arama ve Koordinat Mantığı)
const selectCode = [
  "import AsyncStorage from '@react-native-async-storage/async-storage';",
  "import * as Location from 'expo-location';",
  "import * as Notifications from 'expo-notifications';",
  "import { useRouter } from 'expo-router';",
  "import { useState } from 'react';",
  "import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';",
  "",
  "interface LocationData { id: string; name: string; }",
  "",
  "export default function SelectLocationScreen() {",
  "  const [locations, setLocations] = useState<LocationData[]>([]);",
  "  const [loading, setLoading] = useState(false);",
  "  const [searchQuery, setSearchQuery] = useState('');",
  "  const [gpsLoading, setGpsLoading] = useState(false);",
  "  const [errorMsg, setErrorMsg] = useState<string | null>(null);",
  "  const router = useRouter();",
  "",
  "  async function searchLocationsWithQuery(query: string) {",
  "    if (query.trim().length < 3) return Alert.alert('Hata', 'Lütfen en az 3 harf girin.');",
  "    setLoading(true); setLocations([]); setErrorMsg(null);",
  "    try {",
  "      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Turkey')}&format=json&limit=10`, { headers: { 'User-Agent': 'VakitRehberi/1.0' } });",
  "      if (!response.ok) throw new Error('Arama hatası');",
  "      const data = await response.json();",
  "      const formattedData = data.map((item: any) => ({",
  "        id: `${item.lat},${item.lon}`, // Aladhan API için koordinatları kaydediyoruz",
  "        name: item.display_name.split(',').slice(0, 2).join(',')",
  "      }));",
  "      const unique = formattedData.filter((v: any, i: number, a: any[]) => a.findIndex(t => t.name === v.name) === i);",
  "      setLocations(unique);",
  "    } catch (e) { setErrorMsg('Konumlar aranırken bir sorun oluştu.'); } ",
  "    finally { setLoading(false); }",
  "  }",
  "",
  "  async function handleFindMyGpsLocation() {",
  "    setGpsLoading(true); setLocations([]); setErrorMsg(null);",
  "    try {",
  "      let { status } = await Location.requestForegroundPermissionsAsync();",
  "      if (status !== 'granted') { setErrorMsg('Konum izni reddedildi.'); setGpsLoading(false); return; }",
  "      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });",
  "      let addressArray = await Location.reverseGeocodeAsync(loc.coords);",
  "      const addr = addressArray[0];",
  "      handleSelectLocation({",
  "        id: `${loc.coords.latitude},${loc.coords.longitude}`,",
  "        name: `${addr.district || addr.city || 'Bulunan Konum'}, ${addr.region || ''}`",
  "      });",
  "    } catch (e: any) { setErrorMsg('GPS konum alınamadı.'); }",
  "    finally { setGpsLoading(false); }",
  "  }",
  "",
  "  async function handleSelectLocation(location: LocationData) {",
  "    try {",
  "      await Notifications.cancelAllScheduledNotificationsAsync();",
  "      await AsyncStorage.setItem('@selected_location', JSON.stringify(location));",
  "      await AsyncStorage.removeItem('@cached_prayer_data');",
  "      Alert.alert('Başarılı', `${location.name} seçildi.`);",
  "      if (router.canGoBack()) router.back();",
  "      else router.replace('/');",
  "    } catch (e) { Alert.alert('Hata', 'Konum kaydedilemedi.'); }",
  "  }",
  "",
  "  return (",
  "    <View style={styles.container}>",
  "      <Text style={styles.title}>Konum Seç</Text>",
  "      <TouchableOpacity style={[styles.button, styles.gpsButton]} onPress={handleFindMyGpsLocation} disabled={gpsLoading || loading}>",
  "        <Text style={styles.buttonText}>{gpsLoading ? 'Konum Alınıyor...' : '📍 Konumumu Kullan'}</Text>",
  "      </TouchableOpacity>",
  "      <View style={styles.searchContainer}>",
  '        <TextInput style={styles.searchInput} placeholder="İl veya ilçe adı girin..." placeholderTextColor="#777" value={searchQuery} onChangeText={setSearchQuery} />',
  "        <TouchableOpacity style={styles.button} onPress={() => searchLocationsWithQuery(searchQuery)} disabled={gpsLoading || loading}>",
  "          <Text style={styles.buttonText}>Ara</Text>",
  "        </TouchableOpacity>",
  "      </View>",
  "      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}",
  '      {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#D4AF37" /><Text style={styles.loadingText}>Aranıyor...</Text></View> :',
  "        <FlatList data={locations} keyExtractor={(item) => item.id} renderItem={({ item }) => (",
  "          <TouchableOpacity style={styles.locationButton} onPress={() => handleSelectLocation(item)}>",
  "            <Text style={styles.locationText}>{item.name}</Text>",
  "          </TouchableOpacity>",
  "        )} ListEmptyComponent={() => <Text style={styles.emptyText}>Lütfen arama yapın.</Text>} />",
  "      }",
  "    </View>",
  "  );",
  "}",
  "const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#0D0D0D', padding: 20, paddingTop: 50 }, title: { fontSize: 26, color: '#D4AF37', fontWeight: 'bold', textAlign: 'center', marginBottom: 25 }, button: { backgroundColor: '#D4AF37', paddingVertical: 14, paddingHorizontal: 15, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }, gpsButton: { marginBottom: 15 }, buttonText: { color: '#000000', fontWeight: 'bold', fontSize: 16 }, searchContainer: { flexDirection: 'row', marginBottom: 20, gap: 10 }, searchInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#FFFFFF', borderColor: '#333', borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16 }, locationButton: { backgroundColor: '#1A1A1A', padding: 18, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2E2E2E' }, locationText: { color: '#FFFFFF', fontSize: 18 }, emptyText: { textAlign: 'center', marginTop: 20, color: '#777', fontSize: 15 }, center: { justifyContent: 'center', alignItems: 'center', marginTop: 20 }, loadingText: { marginTop: 10, color: '#D4AF37', fontSize: 16 }, errorText: { textAlign: 'center', color: '#FF5555', marginBottom: 10 } });",
].join("\n");
fs.writeFileSync(
  path.join(__dirname, "app/select-location.tsx"),
  selectCode,
  "utf8",
);
console.log("✅ app/select-location.tsx güncellendi.");

// 4. LIB/NOTIFICATIONS.TS (iOS 64 Bildirim Limiti Çökmesi Çözümü)
const notifPath = path.join(__dirname, "lib/notifications.ts");
if (fs.existsSync(notifPath)) {
  let notifCode = fs.readFileSync(notifPath, "utf8");
  notifCode = notifCode.replace(
    "monthlyTimes.slice(0, 15)",
    "monthlyTimes.slice(0, 12)",
  );
  fs.writeFileSync(notifPath, notifCode, "utf8");
  console.log(
    "✅ lib/notifications.ts güncellendi (iOS bildirim çökme riski giderildi).",
  );
}

// 5. APP/(TABS)/INDEX.TSX
const indexPath = path.join(__dirname, "app/(tabs)/index.tsx");
if (fs.existsSync(indexPath)) {
  let indexCode = fs.readFileSync(indexPath, "utf8");

  if (!indexCode.includes("fetchAladhanTimes")) {
    indexCode = indexCode.replace(
      "import { useFocusEffect, useRouter } from 'expo-router';",
      "import { useFocusEffect, useRouter } from 'expo-router';\nimport { fetchAladhanTimes } from '@/lib/api';",
    );
  }

  // Geçmiş uygulamadan kalan (Diyanet ID) önbelleğini temizleme ve kullanıcıyı yeni sisteme geçirme (GİZLİ BUG FİXİ)
  if (!indexCode.includes("!location.id.includes(',')")) {
    indexCode = indexCode.replace(
      "setSelectedLocation(location);",
      "setSelectedLocation(location);\n\n      if (!location.id.includes(',')) {\n        await AsyncStorage.removeItem('@selected_location');\n        await AsyncStorage.removeItem('@cached_prayer_data');\n        router.push('/select-location');\n        return;\n      }",
    );
  }

  // Eski fetch() fonksiyonunu Aladhan ile değiştir
  const oldFetchStart = "const res = await fetch(";
  const oldFetchEnd = "const monthly: MonthlyPrayerDay[] = await res.json();";
  const regex = new RegExp(
    `const res = await fetch\\([\\s\\S]*?const monthly: MonthlyPrayerDay\\[\\] = await res\\.json\\(\\);`,
    "m",
  );

  const newFetch =
    "const [lat, lon] = locationId.split(',');\n      const monthly = await fetchAladhanTimes(lat, lon);";
  indexCode = indexCode.replace(regex, newFetch);
  fs.writeFileSync(indexPath, indexCode, "utf8");
  console.log("✅ app/(tabs)/index.tsx güncellendi.");
}

// 6. APP/(TABS)/EXPLORE.TSX
const explorePath = path.join(__dirname, "app/(tabs)/explore.tsx");
if (fs.existsSync(explorePath)) {
  let exploreCode = fs.readFileSync(explorePath, "utf8");

  if (!exploreCode.includes("fetchAladhanTimes")) {
    exploreCode = exploreCode.replace(
      "import { useEffect, useState } from 'react';",
      "import { useEffect, useState } from 'react';\nimport { fetchAladhanTimes } from '@/lib/api';",
    );
  }

  const exploreRegex = new RegExp(
    `const res = await fetch\\([\\s\\S]*?const monthly: PrayerDay\\[\\] = await res\\.json\\(\\);`,
    "m",
  );
  const newExploreFetch =
    "const [lat, lon] = loc.id.split(',');\n        const monthly = await fetchAladhanTimes(lat, lon);";
  exploreCode = exploreCode.replace(exploreRegex, newExploreFetch);
  fs.writeFileSync(explorePath, exploreCode, "utf8");
  console.log("✅ app/(tabs)/explore.tsx güncellendi.");
}

console.log(
  "\n🎉 Tüm kritik düzeltmeler ve API geçişleri başarıyla tamamlandı!",
);
