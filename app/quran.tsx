import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const BG_COLOR = '#090906';
const CARD_BG = '#14120f';
const GOLD = '#e1c564';
const TEXT_MUTED = '#888';
const TEXT_LIGHT = '#fff';

export default function QuranScreen() {
  const router = useRouter();

  const surahs = [
    { id: 1, name: 'Fatiha', meaning: 'Açılış', verses: 7 },
    { id: 2, name: 'Bakara', meaning: 'İnek', verses: 286 },
    { id: 3, name: 'Ali İmran', meaning: 'İmran Ailesi', verses: 200 },
    { id: 4, name: 'Nisa', meaning: 'Kadınlar', verses: 176 },
    { id: 18, name: 'Kehf', meaning: 'Mağara', verses: 110 },
    { id: 36, name: 'Yasin', meaning: 'Ey İnsan', verses: 83 },
    { id: 56, name: 'Vakıa', meaning: 'Olay', verses: 96 },
    { id: 67, name: 'Mülk', meaning: 'Hükümranlık', verses: 30 },
    { id: 78, name: 'Nebe', meaning: 'Haber', verses: 40 },
    { id: 112, name: 'İhlas', meaning: 'Samimiyet', verses: 4 },
    { id: 113, name: 'Felak', meaning: 'Sabah', verses: 5 },
    { id: 114, name: 'Nas', meaning: 'İnsanlar', verses: 6 },
  ];

  const handlePressSurah = (surah: any) => {
    router.push({
      pathname: '/quran-detail',
      params: { 
        id: surah.id, 
        name: surah.name, 
        versesCount: surah.verses 
      }
    });
  };

  // DÜZELTME: SafeAreaView yerine View
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={28} color={GOLD} />
        </TouchableOpacity>
        <Text style={styles.title}>Kur'an-ı Kerim</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.infoText}>
          Okumak istediğiniz surenin üzerine dokunun.
        </Text>
        
        {surahs.map((surah) => (
          <TouchableOpacity 
            key={surah.id} 
            style={styles.surahCard}
            onPress={() => handlePressSurah(surah)}
          >
            <View style={styles.numberBox}>
              <Text style={styles.numberText}>{surah.id}</Text>
            </View>
            <View style={styles.details}>
              <Text style={styles.surahName}>{surah.name} Suresi</Text>
              <Text style={styles.surahMeaning}>{surah.meaning} • {surah.verses} Ayet</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={GOLD} />
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} /> 
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_COLOR },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1c56433',
  },
  backBtn: { marginRight: 16 },
  title: { fontSize: 24, fontWeight: '700', color: GOLD },
  content: { padding: 16, gap: 12 },
  infoText: { color: TEXT_MUTED, fontSize: 14, marginBottom: 12, textAlign: 'center' },
  surahCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1c56422',
  },
  numberBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e1c56422',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  numberText: { color: GOLD, fontWeight: 'bold', fontSize: 16 },
  details: { flex: 1 },
  surahName: { color: TEXT_LIGHT, fontSize: 18, fontWeight: '600' },
  surahMeaning: { color: TEXT_MUTED, fontSize: 13, marginTop: 4 },
});