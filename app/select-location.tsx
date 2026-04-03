import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface LocationData { id: string; name: string; }

export default function SelectLocationScreen() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  async function searchLocationsWithQuery(query: string) {
    if (query.trim().length < 3) return Alert.alert('Hata', 'Lütfen en az 3 harf girin.');
    setLoading(true); setLocations([]); setErrorMsg(null);
    try {
      const queryParams = encodeURIComponent(query);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${queryParams}&format=json&limit=15&accept-language=tr`, { headers: { 'User-Agent': 'VakitRehberi/1.0' } });
      if (!response.ok) throw new Error('Arama hatası');
      const data = await response.json();
      const formattedData = data.map((item: any) => ({
        id: `${item.lat},${item.lon}`, 
        name: item.display_name.split(',').slice(0, 3).join(',').trim()
      }));
      const unique = formattedData.filter((v: any, i: number, a: any[]) => a.findIndex(t => t.name === v.name) === i);
      setLocations(unique);
    } catch (e) { setErrorMsg('Konumlar aranırken bir sorun oluştu.'); } 
    finally { setLoading(false); }
  }

  async function handleFindMyGpsLocation() {
    setGpsLoading(true); setLocations([]); setErrorMsg(null);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setErrorMsg('Konum izni reddedildi.'); setGpsLoading(false); return; }
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let addressArray = await Location.reverseGeocodeAsync(loc.coords);
      const addr = addressArray[0];
      handleSelectLocation({
        id: `${loc.coords.latitude},${loc.coords.longitude}`,
        name: `${addr.district || addr.city || 'Bulunan Konum'}, ${addr.region || ''}`
      });
    } catch (e: any) { setErrorMsg('GPS konum alınamadı.'); }
    finally { setGpsLoading(false); }
  }

  async function handleSelectLocation(location: LocationData) {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await AsyncStorage.setItem('@selected_location', JSON.stringify(location));
      await AsyncStorage.removeItem('@cached_prayer_data');
      Alert.alert('Başarılı', `${location.name} seçildi.`);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) { Alert.alert('Hata', 'Konum kaydedilemedi.'); }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Konum Seç</Text>
      <TouchableOpacity style={[styles.button, styles.gpsButton]} onPress={handleFindMyGpsLocation} disabled={gpsLoading || loading}>
        <Text style={styles.buttonText}>{gpsLoading ? 'Konum Alınıyor...' : '📍 Konumumu Kullan'}</Text>
      </TouchableOpacity>
      <View style={styles.searchContainer}>
        <TextInput style={styles.searchInput} placeholder="Şehir veya ülke girin (örn: Londra)" placeholderTextColor="#777" value={searchQuery} onChangeText={setSearchQuery} />
        <TouchableOpacity style={styles.button} onPress={() => searchLocationsWithQuery(searchQuery)} disabled={gpsLoading || loading}>
          <Text style={styles.buttonText}>Ara</Text>
        </TouchableOpacity>
      </View>
      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#D4AF37" /><Text style={styles.loadingText}>Aranıyor...</Text></View> :
        <FlatList data={locations} keyExtractor={(item) => item.id} renderItem={({ item }) => (
          <TouchableOpacity style={styles.locationButton} onPress={() => handleSelectLocation(item)}>
            <Text style={styles.locationText}>{item.name}</Text>
          </TouchableOpacity>
        )} ListEmptyComponent={() => <Text style={styles.emptyText}>Lütfen arama yapın.</Text>} />
      }
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#0D0D0D', padding: 20, paddingTop: 50 }, title: { fontSize: 26, color: '#D4AF37', fontWeight: 'bold', textAlign: 'center', marginBottom: 25 }, button: { backgroundColor: '#D4AF37', paddingVertical: 14, paddingHorizontal: 15, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }, gpsButton: { marginBottom: 15 }, buttonText: { color: '#000000', fontWeight: 'bold', fontSize: 16 }, searchContainer: { flexDirection: 'row', marginBottom: 20, gap: 10 }, searchInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#FFFFFF', borderColor: '#333', borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16 }, locationButton: { backgroundColor: '#1A1A1A', padding: 18, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2E2E2E' }, locationText: { color: '#FFFFFF', fontSize: 18 }, emptyText: { textAlign: 'center', marginTop: 20, color: '#777', fontSize: 15 }, center: { justifyContent: 'center', alignItems: 'center', marginTop: 20 }, loadingText: { marginTop: 10, color: '#D4AF37', fontSize: 16 }, errorText: { textAlign: 'center', color: '#FF5555', marginBottom: 10 } });