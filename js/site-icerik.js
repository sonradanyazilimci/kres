// =============================================================
//  Anasayfa İçeriği (site-icerik.js)
//  /site/anasayfa dokümanındaki metinleri index.html'e uygular.
//  Süper-admin bu metinleri yonetim.html'den düzenler.
//  Doküman yoksa/eksikse VARSAYILAN metinler kullanılır.
// =============================================================

import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
  heroLead: "Yoklama, günlük ve aylık gelişim raporu, veli iletişimi, fotoğraf galerisi, aidat & tahsilat takibi — hepsi bir arada. Yönetici, öğretmen ve veliler için ayrı paneller. Panel içi bildirimler, koyu tema, %100 mobil; kurulum yok, çevrimdışı açılır, KVKK uyumlu.",
  heroNot: "Kredi kartı gerekmez · Dakikalar içinde kurulum",
  ozellik1Baslik: "Yoklama & Devamsızlık Bildirimi",
  ozellik1Metin: "Öğretmen yoklamayı tek dokunuşla alır (geldi / geç / gelmedi), \"tümü geldi\" kısayoluyla saniyeler sürer. Veli, çocuğunu getiremeyeceği günü önceden bildirir; öğretmene anında düşer.",
  ozellik2Baslik: "Günlük & Aylık Gelişim Raporu",
  ozellik2Metin: "Yemek, uyku, tuvalet, ruh hali, etkinlik ve not; hazır kalıplar ve \"dünkü raporu kopyala\" ile hızlı. Tüm sınıfa toplu rapor girin. Veli, ay sonunda grafikli gelişim özetini görür.",
  ozellik3Baslik: "Bildirim & İletişim Merkezi",
  ozellik3Metin: "Okul geneli veya sınıfa özel duyurular, okundu takibi ve birebir mesajlaşma; panel içi bildirim zili her rolde. Önemli hatırlatmaları WhatsApp'tan tek tıkla gönderin.",
  ozellik4Baslik: "Fotoğraf Galerisi",
  ozellik4Metin: "Sınıf fotoğrafları kendi Google Drive'ınıza yüklenir; depolama maliyeti ve kota derdi yok. Veli galeriyi günlere göre gezer.",
  ozellik5Baslik: "Aidat, Tahsilat & Makbuz",
  ozellik5Metin: "Öğrenci bazında aylık aidat, toplu tahakkuk, tahsilat özeti ve borçlu listesi. Yazdırılabilir / PDF makbuz. Veli \"ödedim\" bildirir, yönetici onaylar.",
  ozellik6Baslik: "İzin Onayı & KVKK",
  ozellik6Metin: "İzin ve izin belgesi onayları veliye ulaşır; veli onayladıktan sonra değiştirilemez. Açık rıza akışı, denetim günlüğü, tek tıkla dışa aktarma; her kreşin verisi yalıtık.",
  fiyatNot: "Deneme süresi bittiğinde veriniz silinmez; abonelikle kaldığınız yerden devam edersiniz.",
  iletisimEposta: "destek@anaokul360.app",
  iletisimTelefon: "0850 000 00 00",
  iletisimSaat: "Hafta içi 09:00 – 18:00",
  footerMetin: "Anaokul 360 · Kreş & Anaokulu Yönetim Sistemi. Tüm hakları saklıdır."
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

// Kayıtlı ham içeriği döndür (varsayılanlarla BİRLEŞTİRMEDEN).
export async function anasayfaHam() {
  try {
    const s = await getDoc(REF());
    return s.exists() ? s.data() : {};
  } catch {
    return {};
  }
}

// Kayıtlı içeriği tamamen sil → sayfa dosyadaki VARSAYILAN metinlere döner.
export async function anasayfaSil() {
  await deleteDoc(REF());
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
