// app/select-location.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  View,
} from 'react-native';

// Diyanet API'sinden (abdus.dev) gelecek konum verisinin tipi
interface LocationData {
  id: string; // Diyanet Konum ID'si (Örn: 9541)
  name: string; // Tarafımızdan oluşturulan birleşik isim (Örn: "İSTANBUL / İSTANBUL")
  
  // Orijinal API yanıtından gelen veriler (kaydetmek için)
  city: string; // "İSTANBUL"
  region: string; // "İSTANBUL" (veya "ŞİLE")
  country: string; // "TÜRKİYE"
}

export default function SelectLocationScreen() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // Konum arama fonksiyonu (yeni API)
  async function searchLocations() {
    if (searchQuery.trim().length < 3) {
      Alert.alert('Hata', 'Lütfen en az 3 harf girin.');
      return;
    }
    setLoading(true);
    setLocations([]);
    try {
      // Yeni Diyanet API'sine istek atıyoruz
      const response = await fetch(
        `https://prayertimes.api.abdus.dev/api/diyanet/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) throw new Error('Arama sırasında bir hata oluştu.');

      const data = await response.json();
      
      // API'den dönen veriyi arayüzümüze uygun hale getiriyoruz
      const formattedData: LocationData[] = data.map((item: any) => ({
        id: item.id.toString(),
        city: item.city,
        region: item.region,
        country: item.country,
        // Ekranda göstermek için birleşik bir isim oluşturuyoruz
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

  // Kullanıcı bir konuma tıkladığında
  async function handleSelectLocation(location: LocationData) {
    try {
      // Artık 'name' (örn: "İSTANBUL / İSTANBUL") ve 'id' (örn: "9541") kaydediyoruz
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Konum Ara (Diyanet)</Text>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="İl veya ilçe adı girin..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.searchButton} onPress={searchLocations}>
          <Text style={styles.searchButtonText}>Ara</Text>
        </TouchableOpacity>
      </View>

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

// Stiller (app/select-location.tsx dosyanızdan kopyalandı)
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
});