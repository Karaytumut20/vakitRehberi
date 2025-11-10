// app/select-location.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location'; // <-- YENİ
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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

// ... (LocationData arayüzü aynı kalır)
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
  const [gpsLoading, setGpsLoading] = useState(false); // <-- YENİ (GPS yükleniyor)
  const router = useRouter();

  // Konum arama fonksiyonu (Aynı kalır)
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

  // --- YENİ (GPS Konum Bulma Fonksiyonu) ---
  async function handleFindMyGpsLocation() {
    setGpsLoading(true);
    setLocations([]);
    setErrorMsg(null);
    try {
      // 1. İzin iste
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Konum izni reddedildi. Lütfen ayarlardan izin verin.');
        setGpsLoading(false);
        return;
      }

      // 2. Konumu al
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Yüksek doğruluk daha yavaş olabilir
      });
      
      // 3. Konumu adrese çevir (Tersine Kodlama)
      let addressArray = await Location.reverseGeocodeAsync(location.coords);
      
      if (addressArray.length === 0) {
        throw new Error('Konum bilgisi adrese çevrilemedi.');
      }
      
      const address = addressArray[0];
      const city = address.city || address.subregion; // İl
      const district = address.subregion || address.district; // İlçe
      
      if (!city || !district) {
         throw new Error('Adresten il/ilçe bilgisi alınamadı.');
      }

      // 4. Bulunan il/ilçe ile otomatik arama yap
      const autoSearchQuery = `${city} ${district}`;
      setSearchQuery(autoSearchQuery); // Arama çubuğunu doldur
      
      // searchLocations fonksiyonunu çağır
      await searchLocationsWithQuery(autoSearchQuery);

    } catch (e: any) {
      setErrorMsg(e.message || 'GPS konum alınırken bir hata oluştu.');
      console.error(e);
    } finally {
      setGpsLoading(false);
    }
  }

  // (searchLocations'ı dışarıdan parametre alacak şekilde düzenledik)
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
  
  // Arama butonu tetikleyicisi
  const handleSearchPress = () => {
    searchLocationsWithQuery(searchQuery);
  }
  // ------------------------------------------

  // handleSelectLocation fonksiyonu (Aynı kalır)
  async function handleSelectLocation(location: LocationData) {
    // ... (kod aynı) ...
    try {
      const selectedLocation = JSON.stringify(location);
      await AsyncStorage.setItem('@selected_location', selectedLocation);
      Alert.alert('Başarılı', `${location.name} seçildi.`);
      if (router.canGoBack()) {
        router.back();
      }
    } catch (e) {
      Alert.alert('Hata', 'Konum kaydedilemedi.');
    }
  }

  // YENİ (Hata mesajı için state)
  const [errorMsg, setErrorMsg] = useState<string|null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Konum Ara (Diyanet)</Text>
      
      {/* --- YENİ (GPS Butonu) --- */}
      <TouchableOpacity 
        style={[styles.searchButton, styles.gpsButton]} 
        onPress={handleFindMyGpsLocation}
        disabled={gpsLoading || loading}
      >
        <Text style={styles.searchButtonText}>
          {gpsLoading ? 'Konum Aranıyor...' : '📍 Konumumu Kullan'}
        </Text>
      </TouchableOpacity>
      {/* ------------------------- */}
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Veya il/ilçe adı girin..." // <-- Metin değişti
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity 
            style={styles.searchButton} 
            onPress={handleSearchPress} // <-- Tetikleyici değişti
            disabled={gpsLoading || loading}
        >
          <Text style={styles.searchButtonText}>Ara</Text>
        </TouchableOpacity>
      </View>
      
      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text>Aranıyor...</Text>
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
             <Text style={styles.emptyText}>Lütfen bir konum arayın.</Text>
          )}
        />
      )}
    </View>
  );
}

// Stiller (Yeni GPS Butonu stili eklendi)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  // YENİ
  gpsButton: {
    marginBottom: 15,
    backgroundColor: '#28a745', // Yeşil renk
    paddingVertical: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  searchButton: {
    marginLeft: 10,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  locationButton: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  locationText: {
    fontSize: 18,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: 'gray',
  },
   // YENİ
  errorText: {
    textAlign: 'center',
    color: 'red',
    marginBottom: 10,
  }
});