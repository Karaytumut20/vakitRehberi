// lib/supabase.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
// Bu satır React Native (telefon) için gereklidir
import 'react-native-url-polyfill/auto';

// 🚨 GÜVENLİK UYARISI: Lütfen bu anahtarı Supabase panelinden
// "Settings" -> "API" -> "Rotate Key" ile DEĞİŞTİR ve YENİSİNİ buraya yapıştır.
const supabaseUrl = 'https://qzujuzfvrimrtejhhfbl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dWp1emZ2cmltcnRlamhoZmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MjUyNjAsImV4cCI6MjA3ODMwMTI2MH0.q_ACreVHbdap_nA262OGzxlVPywcGa27PchyUqnjhNs';

// React Native (istemci) tarafında 'supabase' istemcisini oluşturuyoruz
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});