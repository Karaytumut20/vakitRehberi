// lib/supabase.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto'; // Bu, React Native için GEREKLİ

// 🚨 GÜVENLİK UYARISI: Lütfen bu anahtarı Supabase panelinden
// "Project API keys" -> "Rotate Key" ile DEĞİŞTİR ve YENİSİNİ buraya yapıştır.
// Bu anahtarı bir daha paylaşma.
const supabaseUrl = 'https://qzujuzfvrimrtejhhfbl.supabase.co';
const supabaseAnonKey = 'SENIN_YENI_ANON_KEYIN_BURAYA_GELECEK';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});