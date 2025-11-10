// supabase/functions/import-all-locations/index.ts
// (Deno kütüphaneleri BURADA olmalı)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const EMUSHAF_API = 'https://ezanvakti.emushaf.net';

// Supabase istemcisini oluştur
const supabaseClient = createClient(
  // Deno.env.get() parantez içine değişken ADI alır, URL'in kendisini değil.
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Veya RLS kurallarını atlamak için 'SUPABASE_SERVICE_ROLE_KEY'
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// API'den veri çekmek için yardımcı bir fonksiyon
async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`);
  }
  return await response.json();
}

serve(async (req) => {
  try {
    console.log('Konumları içe aktarma başladı...');

    // 1. Ülkeleri çek
    const countries = await fetchJson(`${EMUSHAF_API}/ulkeler`);
    
    // 2. Türkiye'nin ID'sini bul
    const turkey = countries.find((c: any) => c.UlkeAdi === 'TÜRKİYE');
    if (!turkey) {
      throw new Error('TÜRKİYE bulunamadı.');
    }
    const turkeyId = turkey.UlkeID;
    console.log(`Türkiye ID bulundu: ${turkeyId}`);

    // 3. Türkiye'nin tüm şehirlerini (İller) çek
    const cities = await fetchJson(`${EMUSHAF_API}/sehirler/${turkeyId}`);
    console.log(`${cities.length} adet şehir (il) bulundu.`);

    let allLocationsToInsert: any[] = [];
    
    // 4. Her bir şehir için ilçeleri çek
    for (const city of cities) {
      console.log(`${city.SehirAdi} için ilçeler çekiliyor...`);
      const districts = await fetchJson(`${EMUSHAF_API}/ilceler/${city.SehirID}`);

      // 5. İlçeleri veritabanı formatımıza hazırla
      const formattedDistricts = districts.map((dist: any) => ({
        city_name: city.SehirAdi, // İl Adı
        district_name: dist.IlceAdi, // İlçe Adı
        diyanet_location_id: dist.IlceID // Bu, vakitleri çekmek için gereken ID
      }));
      
      allLocationsToInsert = allLocationsToInsert.concat(formattedDistricts);
    }

    console.log(`Toplam ${allLocationsToInsert.length} adet ilçe bulundu.`);

    // 6. Tüm ilçeleri Supabase'e kaydet
    for (let i = 0; i < allLocationsToInsert.length; i += 500) {
      const chunk = allLocationsToInsert.slice(i, i + 500);
      
      const { error } = await supabaseClient
        .from('locations') // Kendi 'locations' tablomuz
        .insert(chunk);

      if (error) {
        throw new Error(`Supabase'e kayıt sırasında hata: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({ message: `İşlem tamamlandı. ${allLocationsToInsert.length} konum veritabanına eklendi.` }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});