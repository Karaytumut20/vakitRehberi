import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SURAH_LIST } from '@/constants/surahs';

const BG_COLOR = '#090906';
const CARD_BG = '#14120f';
const GOLD = '#e1c564';
const TEXT_MUTED = '#888';
const TEXT_LIGHT = '#fff';

export default function QuranScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSurahs = SURAH_LIST.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toString() === searchQuery
  );

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Kur'an-ı Kerim</Text>
      </View>

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={TEXT_MUTED} style={styles.searchIcon} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Sure adı veya numarası ara..."
          placeholderTextColor={TEXT_MUTED}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <MaterialIcons name="close" size={20} color={TEXT_MUTED} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filteredSurahs.map((surah) => (
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
        {filteredSurahs.length === 0 && (
          <Text style={styles.emptyText}>Aradığınız kriterlere uygun sure bulunamadı.</Text>
        )}
        <View style={{ height: 40 }} /> 
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_COLOR },
  header: {
    padding: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '800', color: GOLD },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1814',
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1c56433',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  clearBtn: {
    padding: 4,
  },
  content: { padding: 16, gap: 12 },
  surahCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  numberBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(225,197,100,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(225,197,100,0.3)',
  },
  numberText: { color: GOLD, fontWeight: 'bold', fontSize: 16 },
  details: { flex: 1 },
  surahName: { color: TEXT_LIGHT, fontSize: 18, fontWeight: '700' },
  surahMeaning: { color: TEXT_MUTED, fontSize: 13, marginTop: 4 },
  emptyText: { color: TEXT_MUTED, textAlign: 'center', marginTop: 40, fontSize: 15 }
});