// =============================================================
//  Anasayfa İçeriği (site-icerik.js)
//  /site/anasayfa dokümanındaki metinleri index.html'e uygular.
//  Süper-admin bu metinleri yonetim.html'den düzenler.
//  Doküman yoksa/eksikse VARSAYILAN metinler kullanılır.
// =============================================================

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// Alan tanımları: anahtar -> { etiket, cokSatir }
// yonetim.html'deki düzenleme formu da bu listeden üretilir.
export const ALANLAR = [
  { k: "heroSlogan", e: "Hero — üst rozet", cok: false },
  { k: "heroBaslik", e: "Hero — başlık", cok: false },
  { k: "heroLead", e: "Hero — açıklama", cok: true },
  { k: "heroNot", e: "Hero — küçük not", cok: false },
  { k: "ozellik1Baslik", e: "Özellik 1 — başlık", cok: false },
  { k: "ozellik1Metin", e: "Özellik 1 — metin", cok: true },
  { k: "ozellik2Baslik", e: "Özellik 2 — başlık", cok: false },
  { k: "ozellik2Metin", e: "Özellik 2 — metin", cok: true },
  { k: "ozellik3Baslik", e: "Özellik 3 — başlık", cok: false },
  { k: "ozellik3Metin", e: "Özellik 3 — metin", cok: true },
  { k: "ozellik4Baslik", e: "Özellik 4 — başlık", cok: false },
  { k: "ozellik4Metin", e: "Özellik 4 — metin", cok: true },
  { k: "ozellik5Baslik", e: "Özellik 5 — başlık", cok: false },
  { k: "ozellik5Metin", e: "Özellik 5 — metin", cok: true },
  { k: "ozellik6Baslik", e: "Özellik 6 — başlık", cok: false },
  { k: "ozellik6Metin", e: "Özellik 6 — metin", cok: true },
  { k: "fiyatNot", e: "Fiyat bölümü — açıklama", cok: true },
  { k: "iletisimEposta", e: "İletişim — e-posta", cok: false },
  { k: "iletisimTelefon", e: "İletişim — telefon", cok: false },
  { k: "iletisimSaat", e: "İletişim — çalışma saati", cok: false },
  { k: "footerMetin", e: "Footer — telif satırı", cok: false }
];

export const VARSAYILAN = {
  heroSlogan: "☁️ Bulut tabanlı kreş yazılımı",
  heroBaslik: "Kreşinizi tek panelden yönetin",
  heroLead: "Yoklama, günlük gelişim raporu, veli iletişimi, fotoğraf galerisi ve aidat takibi — hepsi bir arada. Yönetici, öğretmen ve veliler için ayrı paneller. Kurulum yok, her cihazdan çalışır, KVKK uyumlu.",
  heroNot: "Kredi kartı gerekmez · Dakikalar içinde kurulum",
  ozellik1Baslik: "Yoklama & Devamsızlık",
  ozellik1Metin: "Öğretmen sınıf yoklamasını tek dokunuşla alır (geldi / geç / gelmedi). Veli geçmişi görür.",
  ozellik2Baslik: "Günlük Gelişim Raporu",
  ozellik2Metin: "Yemek, uyku, tuvalet, ruh hali, günün etkinliği ve serbest not — her gün veliye ulaşır.",
  ozellik3Baslik: "Duyuru & Mesajlaşma",
  ozellik3Metin: "Okul geneli veya sınıfa özel duyurular, okundu takibi ve öğretmen–veli birebir mesajlaşma.",
  ozellik4Baslik: "Fotoğraf Galerisi",
  ozellik4Metin: "Sınıf fotoğrafları kendi Google Drive'ınıza yüklenir; depolama maliyeti size ait değil.",
  ozellik5Baslik: "Aidat & Ödeme Takibi",
  ozellik5Metin: "Öğrenci bazında aylık aidat kaydı, ödendi/bekliyor durumu; veli kendi ödeme geçmişini görür.",
  ozellik6Baslik: "KVKK Uyumlu",
  ozellik6Metin: "Açık rıza akışı, denetim günlüğü, tek tıkla veri dışa aktarma. Her kreşin verisi birbirinden yalıtık.",
  fiyatNot: "Deneme süresi bittiğinde veriniz silinmez; abonelikle kaldığınız yerden devam edersiniz.",
  iletisimEposta: "destek@kucukadimlar.app",
  iletisimTelefon: "0850 000 00 00",
  iletisimSaat: "Hafta içi 09:00 – 18:00",
  footerMetin: "Küçük Adımlar · Kreş & Anaokulu Yönetim Sistemi. Tüm hakları saklıdır."
};

const REF = () => doc(db, "site", "anasayfa");

// Kayıtlı içeriği (varsa) varsayılanların üstüne bindirerek döndür.
export async function anasayfaOku() {
  try {
    const s = await getDoc(REF());
    return { ...VARSAYILAN, ...(s.exists() ? s.data() : {}) };
  } catch {
    return { ...VARSAYILAN };
  }
}

// Sadece bilinen alanları, boş olmayanları yaz (merge).
export async function anasayfaYaz(veri) {
  const temiz = {};
  for (const { k } of ALANLAR) {
    const d = (veri[k] ?? "").toString().trim();
    if (d) temiz[k] = d;
  }
  temiz.guncelleme = serverTimestamp();
  await setDoc(REF(), temiz, { merge: true });
}

// index.html'deki [data-ic="anahtar"] düğümlerine metni yaz.
export function anasayfaUygula(veri) {
  document.querySelectorAll("[data-ic]").forEach((node) => {
    const k = node.getAttribute("data-ic");
    if (veri[k] != null && veri[k] !== "") node.textContent = veri[k];
  });
}

// index.html tek satırlık kullanım
export async function anasayfaYukle() {
  anasayfaUygula(await anasayfaOku());
}
