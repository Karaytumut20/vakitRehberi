// app/select-location.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router'; // Yönlendirme için
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase'; // Supabase istemcimiz

// Supabase'den gelecek 'locations' verisinin tipi
interface LocationData {
  id: string;
  city_name: string;
  district_name: string;
}

export default function SelectLocationScreen() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter(); // Ana ekrana geri dönmek için

  // Ekran açıldığında Supabase'den tüm konumları çek
  useEffect(() => {
    fetchLocations();
  }, []);

  async function fetchLocations() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('city_name', { ascending: true }); // A'dan Z'ye sırala

      if (error) throw error;
      if (data) setLocations(data);

    } catch (e) {
      Alert.alert('Hata', 'Konumlar yüklenirken bir sorun oluştu.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Kullanıcı bir konuma tıkladığında
  async function handleSelectLocation(location: LocationData) {
    try {
      // Seçilen konumu JSON formatında hafızaya kaydet
      const selectedLocation = JSON.stringify(location);
      await AsyncStorage.setItem('@selected_location', selectedLocation);
      
      Alert.alert('Başarılı', `${location.city_name} / ${location.district_name} seçildi.`);

      // Eğer yönlendirme (router) geri gidebiliyorsa geri git
      // (Ana ekrandan geldiysek geri döner)
      if (router.canGoBack()) {
        router.back();
      }

    } catch (e) {
      Alert.alert('Hata', 'Konum kaydedilemedi.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Konumlar Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Konum Seçiniz</Text>
      <FlatList
        data={locations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => handleSelectLocation(item)}
          >
            <Text style={styles.locationText}>{item.city_name} / {item.district_name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
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
});