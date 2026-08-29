// =============================================================
//  Ek Modüller — ortak veri katmanı (moduller.js)
//  Randevu · Kurum Zili · Medikal Takip · Fiziksel Gelişim ·
//  Geri Bildirim · Ajanda · Öğrenciye Özel Doküman · Günün Özeti
//  Tüm roller (admin/ogretmen/veli) bu fonksiyonları paylaşır.
// =============================================================

import {
  getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { kol, bel } from "./kres.js";
import { el, isoDate, toDate } from "./utils.js";

// ---------- ortak yardımcılar ----------
async function guvenliGetir(ref) {
  try { return await getDoc(ref); }
  catch (e) {
    if (e?.code === "permission-denied") return { exists: () => false, data: () => ({}) };
    throw e;
  }
}
const dizi = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const sn = (x) => x?.seconds || (x?.toMillis ? x.toMillis() / 1000 : 0) || 0;
const suanSaat = () => new Date().toTimeString().slice(0, 5);

// =============================================================
//  1) RANDEVU MODÜLÜ
// =============================================================
export const RANDEVU_DURUM = {
  bekliyor:    { e: "Bekliyor",       r: "uyari"  },
  onaylandi:   { e: "Onaylandı",      r: "basari" },
  reddedildi:  { e: "Reddedildi",     r: "hata"   },
  iptal:       { e: "İptal edildi",   r: "hata"   },
  tamamlandi:  { e: "Tamamlandı",     r: "bilgi"  }
};

export function randevuOlustur({ veliUid, ogrenciId, personelUid, personelAd, tarih, saat, konu, veliNot }) {
  return addDoc(kol("randevular"), {
    veliUid, ogrenciId, personelUid, personelAd: personelAd || "",
    tarih, saat: saat || "", konu: konu || "", veliNot: veliNot || "",
    personelNot: "", durum: "bekliyor", olusturma: serverTimestamp()
  });
}

export async function randevulariGetir(filtre = {}) {
  let q = kol("randevular");
  if (filtre.personelUid) q = query(q, where("personelUid", "==", filtre.personelUid));
  else if (filtre.veliUid) q = query(q, where("veliUid", "==", filtre.veliUid));
  const liste = dizi(await getDocs(q));
  return liste.sort((a, b) => `${b.tarih} ${b.saat || ""}`.localeCompare(`${a.tarih} ${a.saat || ""}`));
}

export function randevuGuncelle(id, veri) { return updateDoc(bel("randevular", id), veri); }
export function randevuSil(id) { return deleteDoc(bel("randevular", id)); }

// =============================================================
//  2) KURUM ZİLİ ("Geliyorum" / "Geldim")
// =============================================================
export async function kapiGetir(ogrenciId, tarih = isoDate()) {
  const s = await guvenliGetir(bel("kapiBildirimleri", `${ogrenciId}_${tarih}`));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

// alan: "geliyorum" | "geldim"
export function kapiIsaretle({ ogrenciId, sinifId, veliUid, alan, tarih = isoDate() }) {
  const veri = { ogrenciId, sinifId: sinifId || "", veliUid, tarih };
  veri[alan + "At"] = serverTimestamp();
  return setDoc(bel("kapiBildirimleri", `${ogrenciId}_${tarih}`), veri, { merge: true });
}

export async function kapiSinifGunluk(sinifId, tarih = isoDate()) {
  const q = query(kol("kapiBildirimleri"), where("sinifId", "==", sinifId), where("tarih", "==", tarih));
  return dizi(await getDocs(q));
}

// =============================================================
//  3) MEDİKAL TAKİP
// =============================================================
export function ilacKaydet(id, veri) {
  return id
    ? updateDoc(bel("ilaclar", id), { ...veri, guncelleme: serverTimestamp() })
    : addDoc(kol("ilaclar"), { ...veri, olusturma: serverTimestamp() });
}
export function ilacSil(id) { return deleteDoc(bel("ilaclar", id)); }

export async function ilaclariGetir(filtre = {}) {
  let q = kol("ilaclar");
  if (filtre.sinifId) q = query(q, where("sinifId", "==", filtre.sinifId));
  else if (filtre.ogrenciId) q = query(q, where("ogrenciId", "==", filtre.ogrenciId));
  const liste = dizi(await getDocs(q));
  return liste.sort((a, b) => sn(b.olusturma) - sn(a.olusturma));
}

export function ilacUygula({ ilacId, ogrenciId, sinifId, uygulayanUid, saat, not }) {
  return addDoc(kol("ilacUygulamalari"), {
    ilacId, ogrenciId, sinifId: sinifId || "", uygulayanUid,
    tarih: isoDate(), saat: saat || suanSaat(), not: not || "",
    olusturma: serverTimestamp()
  });
}

export async function ilacUygulamalariGetir(filtre = {}) {
  let q = kol("ilacUygulamalari");
  if (filtre.sinifId) q = query(q, where("sinifId", "==", filtre.sinifId));
  else if (filtre.ogrenciId) q = query(q, where("ogrenciId", "==", filtre.ogrenciId));
  const liste = dizi(await getDocs(q));
  return liste.sort((a, b) => `${b.tarih} ${b.saat || ""}`.localeCompare(`${a.tarih} ${a.saat || ""}`));
}

export function ilacBugunAktif(ilac, gun = isoDate()) {
  if (ilac.aktif === false) return false;
  if (ilac.baslangic && gun < ilac.baslangic) return false;
  if (ilac.bitis && gun > ilac.bitis) return false;
  return true;
}

// =============================================================
//  4) FİZİKSEL GELİŞİM TAKİBİ (boy / kilo)
// =============================================================
export function olcumEkle(veri) {
  return addDoc(kol("olcumler"), { ...veri, olusturma: serverTimestamp() });
}
export function olcumSil(id) { return deleteDoc(bel("olcumler", id)); }

export async function olcumleriGetir(filtre = {}) {
  let q = kol("olcumler");
  if (filtre.sinifId) q = query(q, where("sinifId", "==", filtre.sinifId));
  else if (filtre.ogrenciId) q = query(q, where("ogrenciId", "==", filtre.ogrenciId));
  const liste = dizi(await getDocs(q));
  return liste.sort((a, b) => (a.tarih || "").localeCompare(b.tarih || ""));
}

export function bmiHesapla(boyCm, kiloKg) {
  const m = Number(boyCm) / 100;
  if (!m || !Number(kiloKg)) return null;
  return Number(kiloKg) / (m * m);
}

// Basit SVG çizgi grafiği. noktalar: [{x:"2026-01", y:96}, ...]
export function miniCizgiGrafik(noktalar, { birim = "", renk = "#ff8a5c", yBaslik = "" } = {}) {
  const G = 260, Y = 120, P = 26;
  const wrap = el("div", { class: "cizgi-grafik" });
  if (!noktalar || noktalar.length < 2) {
    wrap.appendChild(el("p", { class: "soluk" }, "Grafik için en az iki ölçüm gerekli."));
    return wrap;
  }
  const ys = noktalar.map((n) => Number(n.y));
  const min = Math.min(...ys), max = Math.max(...ys);
  const aralik = max - min || 1;
  const sx = (i) => P + (i * (G - 2 * P)) / (noktalar.length - 1);
  const sy = (v) => Y - P - ((v - min) / aralik) * (Y - 2 * P);
  const d = noktalar.map((n, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(n.y).toFixed(1)}`).join(" ");
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${G} ${Y}`);
  svg.setAttribute("class", "cizgi-grafik__svg");
  svg.setAttribute("role", "img");
  if (yBaslik) svg.setAttribute("aria-label", yBaslik);
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", renk);
  path.setAttribute("stroke-width", "2.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  noktalar.forEach((n, i) => {
    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("cx", sx(i)); c.setAttribute("cy", sy(n.y));
    c.setAttribute("r", "3"); c.setAttribute("fill", renk);
    svg.appendChild(c);
  });
  wrap.appendChild(svg);
  wrap.appendChild(el("div", { class: "cizgi-grafik__uc" },
    el("span", {}, `${min.toLocaleString("tr-TR")}${birim}`),
    el("span", {}, `${max.toLocaleString("tr-TR")}${birim}`)
  ));
  return wrap;
}

// =============================================================
//  5) GERİ BİLDİRİM MODÜLÜ (anket / onay / metin)
// =============================================================
export const ANKET_TUR = { metin: "Metin cevap", onay: "Onay (Evet / Hayır)", secim: "Çoktan seçmeli" };
export const ANKET_HEDEF = { veli: "Veliler", personel: "Personel", hepsi: "Herkes" };

export function anketKaydet(id, veri) {
  return id
    ? updateDoc(bel("anketler", id), { ...veri, guncelleme: serverTimestamp() })
    : addDoc(kol("anketler"), { ...veri, olusturma: serverTimestamp() });
}
export function anketSil(id) { return deleteDoc(bel("anketler", id)); }

export async function anketleriGetir() {
  const liste = dizi(await getDocs(kol("anketler")));
  return liste.sort((a, b) => sn(b.olusturma) - sn(a.olusturma));
}

// rol -> yalnızca ona (veya 'hepsi') açık anketler
export function anketleriRoleGore(anketler, rol) {
  const hedef = rol === "veli" ? "veli" : "personel";
  return anketler.filter((a) => a.aktif !== false && (a.hedef === "hepsi" || a.hedef === hedef));
}

export function anketYanitla({ anketId, tur, yanitlayanUid, yanitlayanRol, cevap }) {
  return setDoc(bel("anketYanitlari", `${anketId}_${yanitlayanUid}`), {
    anketId, tur, yanitlayanUid, yanitlayanRol, cevap, tarih: serverTimestamp()
  });
}

export async function anketYanitlariGetir(anketId) {
  const q = query(kol("anketYanitlari"), where("anketId", "==", anketId));
  return dizi(await getDocs(q));
}

export async function benimAnketYanitim(anketId, uid) {
  const s = await guvenliGetir(bel("anketYanitlari", `${anketId}_${uid}`));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

// =============================================================
//  6) AJANDA MODÜLÜ
// =============================================================
export const ONEMLI_GUNLER = [
  { md: "01-01", ad: "Yılbaşı" },
  { md: "03-18", ad: "Şehitler Günü" },
  { md: "04-23", ad: "Ulusal Egemenlik ve Çocuk Bayramı" },
  { md: "05-01", ad: "Emek ve Dayanışma Günü" },
  { md: "05-19", ad: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
  { md: "06-05", ad: "Dünya Çevre Günü" },
  { md: "08-30", ad: "Zafer Bayramı" },
  { md: "10-29", ad: "Cumhuriyet Bayramı" },
  { md: "11-10", ad: "Atatürk'ü Anma Günü" },
  { md: "11-20", ad: "Dünya Çocuk Hakları Günü" },
  { md: "11-24", ad: "Öğretmenler Günü" }
];
export const AJANDA_TUR = {
  etkinlik: { e: "Etkinlik", i: "🎈" },
  onemliGun: { e: "Önemli gün", i: "📌" },
  dogumGunu: { e: "Doğum günü", i: "🎂" },
  hatirlatma: { e: "Hatırlatma", i: "⏰" }
};

export function ajandaEkle(veri) {
  return addDoc(kol("ajandaOgeleri"), { ...veri, olusturma: serverTimestamp() });
}
export function ajandaSil(id) { return deleteDoc(bel("ajandaOgeleri", id)); }
export async function ajandaGetir() { return dizi(await getDocs(kol("ajandaOgeleri"))); }

// kisiler: [{ ad, soyad, dogumTarihi, _tip: 'ogrenci' | 'personel' }]
export function ajandaOtomatik(kisiler = []) {
  const yil = new Date().getFullYear();
  const cift = (n) => String(n).padStart(2, "0");
  const out = ONEMLI_GUNLER.map((g) => ({
    tarih: `${yil}-${g.md}`, baslik: g.ad, tur: "onemliGun", oto: true
  }));
  kisiler.forEach((k) => {
    const d = toDate(k.dogumTarihi);
    if (!d) return;
    out.push({
      tarih: `${yil}-${cift(d.getMonth() + 1)}-${cift(d.getDate())}`,
      baslik: `${k.ad || ""} ${k.soyad || ""}`.trim() + (k._tip === "personel" ? " · personel" : " · öğrenci"),
      tur: "dogumGunu", oto: true
    });
  });
  return out;
}

// Yaklaşan önce: bu yılın kalan günleri, sonra geçmiş (gelecek yıla sarkan) günler
export function ajandaSirala(ogeler) {
  const bugunMD = isoDate().slice(5);
  const anahtar = (o) => {
    const md = (o.tarih || "").slice(5);
    return (md >= bugunMD ? "0" : "1") + md + (o.baslik || "");
  };
  return [...ogeler].sort((a, b) => anahtar(a).localeCompare(anahtar(b), "tr"));
}

// =============================================================
//  7) ÖĞRENCİYE ÖZEL DOKÜMAN PAYLAŞIMI (Google Drive)
// =============================================================
export async function belgePaylas(file, {
  ogrenciId, sinifId, baslik, aciklama, yukleyenUid, driveUrl, driveSir
}) {
  const { driveDosyaYukle } = await import("./drive-upload.js");
  const up = await driveDosyaYukle(file, {
    url: driveUrl, sir: driveSir || "",
    klasor: `ogrenci-belge ${ogrenciId}`, ad: baslik || file.name
  });
  return addDoc(kol("belgePaylasimlari"), {
    ogrenciId, sinifId: sinifId || "",
    baslik: baslik || up.dosyaAdi, aciklama: aciklama || "",
    driveId: up.id, dosyaAdi: up.dosyaAdi,
    webViewLink: up.webViewLink, indirLink: up.indirLink,
    yukleyenUid, olusturma: serverTimestamp()
  });
}
export function belgeSil(id) { return deleteDoc(bel("belgePaylasimlari", id)); }
export async function belgeleriGetir(filtre = {}) {
  let q = kol("belgePaylasimlari");
  if (filtre.sinifId) q = query(q, where("sinifId", "==", filtre.sinifId));
  else if (filtre.ogrenciId) q = query(q, where("ogrenciId", "==", filtre.ogrenciId));
  const liste = dizi(await getDocs(q));
  return liste.sort((a, b) => sn(b.olusturma) - sn(a.olusturma));
}

// =============================================================
//  8) GÜNÜN ÖZETİ (yalnızca yönetici)
// =============================================================
export async function gunOzeti(tarih, { siniflar, ogrenciler }) {
  const [ySnap, rSnap] = await Promise.all([
    getDocs(query(kol("yoklamalar"), where("tarih", "==", tarih))),
    getDocs(query(kol("gunlukRaporlar"), where("tarih", "==", tarih)))
  ]);
  const yBySinif = {}, rBySinif = {};
  ySnap.docs.forEach((d) => { const s = d.data().sinifId; (yBySinif[s] ||= new Set()).add(d.data().ogrenciId); });
  rSnap.docs.forEach((d) => { const s = d.data().sinifId; (rBySinif[s] ||= new Set()).add(d.data().ogrenciId); });
  return siniflar.map((s) => {
    const toplam = ogrenciler.filter((o) => o.sinifId === s.id).length;
    const y = yBySinif[s.id]?.size || 0;
    const r = rBySinif[s.id]?.size || 0;
    return {
      sinif: s, ogretmenId: s.ogretmenId || null, toplam,
      yoklama: y, rapor: r,
      yoklamaTam: toplam > 0 && y >= toplam,
      raporTam: toplam > 0 && r >= toplam
    };
  });
}
