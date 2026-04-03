import { View, StyleSheet, TouchableOpacity, ScrollView, TextStyle } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { MaterialCommunityIcons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const gold = '#e1c564';
  const goldDark = '#e1af64ff';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Keşfet</ThemedText>
        <ThemedText style={styles.subtitle}>İslami yaşam araçları ve pratik bilgiler</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <TouchableOpacity 
          style={styles.card}
          onPress={() => router.push('/monthly')}
        >
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(225,197,100,0.1)' }]}>
             <MaterialIcons name="date-range" size={28} color={gold} />
          </View>
          <View style={styles.cardTextContainer}>
            <ThemedText style={styles.cardTitle}>Aylık Takvim</ThemedText>
            <ThemedText style={styles.cardDesc}>Bu aya ait tüm namaz vakitlerini görüntüle</ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#555" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.card}
          onPress={() => router.push('/qibla')}
        >
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(0,180,216,0.1)' }]}>
             <FontAwesome5 name="compass" size={28} color="#00b4d8" />
          </View>
          <View style={styles.cardTextContainer}>
            <ThemedText style={styles.cardTitle}>Kıble Pusulası</ThemedText>
            <ThemedText style={styles.cardDesc}>Dünyanın neresinde olursan ol kıbleyi bul</ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#555" />
        </TouchableOpacity>

        <View style={styles.comingSoonContainer}>
          <TouchableOpacity 
            style={[styles.card, { opacity: 0.6 }]}
            disabled={true}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
               <MaterialCommunityIcons name="hands-pray" size={28} color="#fff" />
            </View>
            <View style={styles.cardTextContainer}>
              <ThemedText style={styles.cardTitle}>Dualar & Zikirler</ThemedText>
              <ThemedText style={styles.cardDesc}>Hisnul Müslim dua kütüphanesi</ThemedText>
            </View>
            <View style={styles.comingSoonBadge}>
              <ThemedText style={styles.comingSoonText}>Yakında</ThemedText>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090906',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e1c564',
  } as TextStyle,
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4,
  } as TextStyle,
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14120f',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1c56422',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  } as TextStyle,
  cardDesc: {
    fontSize: 13,
    color: '#888',
  } as TextStyle,
  comingSoonContainer: {
    marginTop: 8,
  },
  comingSoonBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  } as TextStyle,
});
