// app/select-location.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
// YENİ IMPORT: Bildirimleri iptal etmek için eklendi
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface LocationData {
  id: string;
  name: string;
  city: string;
  region: string;
  country: string;
}

export default function SelectLocationScreen() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  async function searchLocations() {
    if (searchQuery.trim().length < 3) {
      Alert.alert('Hata', 'Lütfen en az 3 harf girin.');
      return;
    }
    setLoading(true);
    setLocations([]);
    try {
      const response = await fetch(
        `https://prayertimes.api.abdus.dev/api/diyanet/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) throw new Error('Arama sırasında bir hata oluştu.');

      const data = await response.json();

      const formattedData: LocationData[] = data.map((item: any) => ({
        id: item.id.toString(),
        city: item.city,
        region: item.region,
        country: item.country,
        name: `${item.city}${item.region !== item.city ? ' / ' + item.region : ''}`,
      }));

      setLocations(formattedData);
    } catch (e) {
      Alert.alert('Hata', 'Konumlar aranırken bir sorun oluştu.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function searchLocationsWithQuery(query: string) {
    if (query.trim().length < 3) {
      Alert.alert('Hata', 'Lütfen en az 3 harf girin.');
      return;
    }
    setLoading(true);
    setLocations([]);
    try {
      const response = await fetch(
        `https://prayertimes.api.abdus.dev/api/diyanet/search?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error('Arama sırasında hata oluştu.');

      const data = await response.json();
      const formattedData: LocationData[] = data.map((item: any) => ({
        id: item.id.toString(),
        city: item.city,
        region: item.region,
        country: item.country,
        name: `${item.city}${item.region !== item.city ? ' / ' + item.region : ''}`,
      }));

      setLocations(formattedData);
    } catch (e) {
      Alert.alert('Hata', 'Konumlar aranırken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  }

  async function handleFindMyGpsLocation() {
    setGpsLoading(true);
    setLocations([]);
    setErrorMsg(null);

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Konum izni reddedildi. Lütfen ayarlardan izin verin.');
        setGpsLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let addressArray = await Location.reverseGeocodeAsync(location.coords);

      if (addressArray.length === 0) {
        throw new Error('Konum bilgisi adrese çevrilemedi.');
      }

      const address = addressArray[0];
      const city = address.city || address.subregion;
      const district = address.subregion || address.district;

      if (!city || !district) {
        throw new Error('Adresten il/ilçe bilgisi alınamadı.');
      }

      const autoSearchQuery = `${city} ${district}`;
      setSearchQuery(autoSearchQuery);

      await searchLocationsWithQuery(autoSearchQuery);
    } catch (e: any) {
      setErrorMsg(e.message || 'GPS konum alınırken bir hata oluştu.');
      console.error(e);
    } finally {
      setGpsLoading(false);
    }
  }

  // --- BU FONKSİYON GÜNCELLENDİ ---
  async function handleSelectLocation(location: LocationData) {
    try {
      // 1. ADIM: Konum seçildiği an tüm eski bildirimleri iptal et
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('LOG: Yeni konum seçildi, planlanmış tüm eski bildirimler iptal edildi.');

      // 2. ADIM: Yeni konumu kaydet
      const selectedLocation = JSON.stringify(location);
      await AsyncStorage.setItem('@selected_location', selectedLocation);
      
      Alert.alert('Başarılı', `${location.name} seçildi.`);

      // 3. ADIM: Ana sayfaya dön
      if (router.canGoBack()) {
        router.back();
      }
    } catch (e) {
      Alert.alert('Hata', 'Konum kaydedilemedi veya bildirimler iptal edilemedi.');
      console.error('handleSelectLocation error:', e);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Konum Seç (Diyanet)</Text>

      <TouchableOpacity
        style={[styles.button, styles.gpsButton]}
        onPress={handleFindMyGpsLocation}
        disabled={gpsLoading || loading}
      >
        <Text style={styles.buttonText}>
          {gpsLoading ? 'Konum Alınıyor...' : '📍 Konumumu Kullan'}
        </Text>
      </TouchableOpacity>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="İl veya ilçe adı girin..."
          placeholderTextColor="#777"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={() => searchLocationsWithQuery(searchQuery)}
          disabled={gpsLoading || loading}
        >
          <Text style={styles.buttonText}>Ara</Text>
        </TouchableOpacity>
      </View>

      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={styles.loadingText}>Aranıyor...</Text>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => handleSelectLocation(item)}
            >
              <Text style={styles.locationText}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <Text style={styles.emptyText}>Lütfen arama yapın.</Text>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 26,
    color: '#D4AF37',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
  },
  button: {
    backgroundColor: '#D4AF37',
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsButton: {
    marginBottom: 15,
  },
  buttonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  locationButton: {
    backgroundColor: '#1A1A1A',
    padding: 18,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2E2E2E',
  },
  locationText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#777',
    fontSize: 15,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#D4AF37',
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    color: '#FF5555',
    marginBottom: 10,
  },
});