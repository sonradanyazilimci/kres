// =============================================================
//  Yönetici Paneli (admin.js)
//  Kullanıcı / sınıf / öğrenci yönetimi, duyurular, ödemeler.
// =============================================================

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signOut as ikincilCikis,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, firebaseConfig } from "./firebase-config.js";
import { driveYukle } from "./drive-upload.js";
import { sayfaKorumasi, cikisYap } from "./auth.js";
import {
  kol, bel, aktifKresId, aktifKres, kresAktifMi, onayBekliyorMu, islemKaydet,
  denemeBandiGoster, kilitEkraniGoster, bildirimGonder
} from "./kres.js";
import { kurBildirimZili } from "./bildirim.js";
import { sistemDuyurulariniGoster } from "./sistem-duyuru.js";
import { temaBaslat } from "./tema.js";
import {
  $, $$, el, escapeHtml, toast, emptyState, tabloBos, openModal, closeModal,
  confirmDialog, formData, formatDate, formatDateTime, formatAy, paraFormat,
  yasHesapla, isoDate, firebaseHata, kurPanelGezinme, kurCikis, kullaniciRozeti,
  haftaBaslangici, haftaGunleri, haftaEtiket, haftaKaydir, waLink
} from "./utils.js";

temaBaslat();

// ---------- Durum ----------
let baglam = null;
let profil = null;
let yazma = true; // deneme süresi dolduysa false
const durum = {
  kullanicilar: [],
  siniflar: [],
  ogrenciler: [],
  duyurular: [],
  odemeler: [],
  fotograflar: [],
  talepler: [],
  izinBelgeleri: []
};

function yazmaKontrol() {
  if (!yazma) {
    toast("Erişim süreniz doldu ya da abonelik pasif. Yeni kayıt/düzenleme yapılamıyor.", "warning", 5000);
    return false;
  }
  return true;
}

// ---------- Başlangıç ----------
baglam = await sayfaKorumasi("admin");
profil = baglam.profil || { uid: baglam.uid, ad: "Yönetici", soyad: "", email: "" };
yazma = baglam.aktif;
kullaniciRozeti(profil);
kurCikis(() => cikisYap());
if (onayBekliyorMu(aktifKres())) kilitEkraniGoster(aktifKres());  // başvuru inceleniyor
else denemeBandiGoster(aktifKres());
kurBildirimZili({ profil, kresId: aktifKresId() });
sistemDuyurulariniGoster();

const nav = kurPanelGezinme({
  "genel-bakis": "Genel Bakış",
  "kullanicilar": "Kullanıcılar",
  "siniflar": "Sınıflar",
  "ogrenciler": "Öğrenciler",
  "duyurular": "Duyurular",
  "galeri": "Galeri",
  "odemeler": "Aidat / Ödeme",
  "talepler": "Talepler",
  "izinler": "İzin / Belge",
  "program": "Yemek & Program",
  "yilsonu": "Yıl Sonu",
  "ayarlar": "Ayarlar"
}, (ad) => {
  if (ad === "ayarlar") ayarlariDoldur();
  if (ad === "program") { menuYukle(); programYukle(); }
  if (ad === "yilsonu") yilSonuDoldur();
});

// (Başlangıç çağrıları dosyanın SONUNDA — tüm `const` yardımcılar
//  tanımlandıktan sonra çalışsın diye.)

// =============================================================
//  VERİ YÜKLEME
// =============================================================
async function hepsiniYukle() {
  const [uSnap, sSnap, oSnap, dSnap, odSnap, fSnap, tSnap, izSnap] = await Promise.all([
    getDocs(kol("users")),
    getDocs(kol("siniflar")),
    getDocs(kol("ogrenciler")),
    getDocs(kol("duyurular")),
    getDocs(kol("odemeler")),
    getDocs(kol("fotograflar")),
    getDocs(kol("talepler")),
    getDocs(kol("izinBelgeleri"))
  ]);
  durum.kullanicilar = uSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  durum.siniflar = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  durum.ogrenciler = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  durum.duyurular = dSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  durum.odemeler = odSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  durum.fotograflar = fSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  durum.talepler = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  durum.izinBelgeleri = izSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
}

// Yardımcılar
const sinifAdi = (id) => durum.siniflar.find((s) => s.id === id)?.ad || "—";
const kullaniciAdi = (id) => {
  const u = durum.kullanicilar.find((k) => k.id === id);
  return u ? `${u.ad} ${u.soyad}` : "—";
};
const ogrenciAdi = (id) => {
  const o = durum.ogrenciler.find((x) => x.id === id);
  return o ? `${o.ad} ${o.soyad}` : "—";
};
const veliler = () => durum.kullanicilar.filter((k) => k.rol === "veli");
const ogretmenler = () => durum.kullanicilar.filter((k) => k.rol === "ogretmen");

// Bildirim alıcı yardımcıları
const veliUidleriSinif = (sinifId) => [...new Set(
  durum.ogrenciler.filter((o) => o.sinifId === sinifId).flatMap((o) => o.veliIds || []))];
const tumVeliUidleri = () => veliler().map((k) => k.id);
const tumOgretmenUidleri = () => ogretmenler().map((k) => k.id);

// =============================================================
//  RENDER
// =============================================================
function render() {
  renderDashboard();
  renderKullanicilar();
  renderSiniflar();
  renderOgrenciSecicileri();
  renderOgrenciler();
  renderDuyuruHedef();
  renderDuyurular();
  renderFotoHedef();
  renderGaleri();
  renderOdemeSecicileri();
  renderTahakkukSecicileri();
  renderOdemeler();
  renderTahsilatOzeti();
  renderTalepler();
  renderIzinSiniflar();
  renderIzinler();
}

// ---------- Dashboard ----------
function renderDashboard() {
  const kartlar = [
    { ikon: "🧒", sayi: durum.ogrenciler.length, etiket: "Öğrenci" },
    { ikon: "👩‍🏫", sayi: ogretmenler().length, etiket: "Öğretmen" },
    { ikon: "👪", sayi: veliler().length, etiket: "Veli" },
    { ikon: "🏫", sayi: durum.siniflar.length, etiket: "Sınıf" }
  ];
  const c = $("#statKartlar");
  c.innerHTML = "";
  kartlar.forEach((k) => {
    c.appendChild(el("div", { class: "stat-kart" },
      el("div", { class: "stat-kart__ikon" }, k.ikon),
      el("div", {},
        el("div", { class: "stat-kart__sayi" }, String(k.sayi)),
        el("div", { class: "stat-kart__etiket" }, k.etiket)
      )
    ));
  });

  const tablo = $("#doluluk-tablo");
  if (!durum.siniflar.length) { tabloBos(tablo, "Henüz sınıf yok"); return; }
  tablo.innerHTML = `
    <thead><tr><th>Sınıf</th><th>Yaş Grubu</th><th>Öğretmen</th><th>Doluluk</th></tr></thead>
    <tbody>${durum.siniflar.map((s) => {
      const dolu = durum.ogrenciler.filter((o) => o.sinifId === s.id).length;
      const kap = s.kapasite || 0;
      return `<tr>
        <td data-label="Sınıf"><strong>${escapeHtml(s.ad)}</strong></td>
        <td data-label="Yaş Grubu">${escapeHtml(s.yasGrubu || "-")}</td>
        <td data-label="Öğretmen">${escapeHtml(s.ogretmenId ? kullaniciAdi(s.ogretmenId) : "Atanmadı")}</td>
        <td data-label="Doluluk">${dolu} / ${kap} ${kap && dolu >= kap ? '<span class="rozet rozet--hata">Dolu</span>' : ""}</td>
      </tr>`;
    }).join("")}</tbody>`;
}

// ---------- Kullanıcılar ----------
let kullaniciRolFiltre = "hepsi";
function renderKullanicilar() {
  const tablo = $("#kullanici-tablo");
  let liste = [...durum.kullanicilar].sort((a, b) => (a.ad || "").localeCompare(b.ad || "", "tr"));
  if (kullaniciRolFiltre !== "hepsi") liste = liste.filter((k) => k.rol === kullaniciRolFiltre);
  if (!liste.length) { tabloBos(tablo, "Kullanıcı bulunamadı"); return; }
  const rozet = { admin: "mor", ogretmen: "bilgi", veli: "basari" };
  tablo.innerHTML = `
    <thead><tr><th>Ad Soyad</th><th>E-posta</th><th>Telefon</th><th>Rol</th><th></th></tr></thead>
    <tbody>${liste.map((k) => `
      <tr>
        <td data-label="Ad Soyad"><strong>${escapeHtml(k.ad || "")} ${escapeHtml(k.soyad || "")}</strong></td>
        <td data-label="E-posta">${escapeHtml(k.email || "")}</td>
        <td data-label="Telefon">${escapeHtml(k.telefon || "-")}</td>
        <td data-label="Rol"><span class="rozet rozet--${rozet[k.rol] || "bilgi"}">${escapeHtml(k.rol)}</span></td>
        <td data-label="" class="tablo-islem">
          ${k.telefon ? `<button class="btn btn--ghost btn--sm" data-wa="${k.id}" title="WhatsApp">📱</button>` : ""}
          <button class="btn btn--ghost btn--sm" data-duzenle="${k.id}">Düzenle</button>
          <button class="btn btn--danger btn--sm" data-sil="${k.id}">Sil</button>
        </td>
      </tr>`).join("")}</tbody>`;

  tablo.querySelectorAll("[data-wa]").forEach((b) =>
    b.addEventListener("click", () => {
      const u = durum.kullanicilar.find((x) => x.id === b.dataset.wa);
      const l = waLink(u?.telefon);
      if (l) window.open(l, "_blank"); else toast("Geçerli telefon yok.", "warning");
    }));
  tablo.querySelectorAll("[data-duzenle]").forEach((b) =>
    b.addEventListener("click", () => kullaniciFormu(durum.kullanicilar.find((x) => x.id === b.dataset.duzenle))));
  tablo.querySelectorAll("[data-sil]").forEach((b) =>
    b.addEventListener("click", () => kullaniciSil(b.dataset.sil)));
}

// ---------- Sınıflar ----------
function renderSiniflar() {
  const tablo = $("#sinif-tablo");
  if (!durum.siniflar.length) { tabloBos(tablo, "Henüz sınıf yok"); return; }
  tablo.innerHTML = `
    <thead><tr><th>Ad</th><th>Yaş Grubu</th><th>Öğretmen</th><th>Kapasite</th><th>Kayıtlı</th><th></th></tr></thead>
    <tbody>${durum.siniflar.map((s) => {
      const dolu = durum.ogrenciler.filter((o) => o.sinifId === s.id).length;
      return `<tr>
        <td data-label="Ad"><strong>${escapeHtml(s.ad)}</strong></td>
        <td data-label="Yaş Grubu">${escapeHtml(s.yasGrubu || "-")}</td>
        <td data-label="Öğretmen">${escapeHtml(s.ogretmenId ? kullaniciAdi(s.ogretmenId) : "Atanmadı")}</td>
        <td data-label="Kapasite">${s.kapasite || "-"}</td>
        <td data-label="Kayıtlı">${dolu}</td>
        <td class="tablo-islem">
          <button class="btn btn--ghost btn--sm" data-duzenle="${s.id}">Düzenle</button>
          <button class="btn btn--danger btn--sm" data-sil="${s.id}">Sil</button>
        </td>
      </tr>`;
    }).join("")}</tbody>`;
  tablo.querySelectorAll("[data-duzenle]").forEach((b) =>
    b.addEventListener("click", () => sinifFormu(durum.siniflar.find((x) => x.id === b.dataset.duzenle))));
  tablo.querySelectorAll("[data-sil]").forEach((b) =>
    b.addEventListener("click", () => sinifSil(b.dataset.sil)));
}

// ---------- Öğrenci seçicileri (filtre + ödeme formu) ----------
function renderOgrenciSecicileri() {
  const f = $("#ogrenciSinifFiltre");
  const seciliF = f.value;
  f.innerHTML = `<option value="hepsi">Tüm sınıflar</option>` +
    durum.siniflar.map((s) => `<option value="${s.id}">${escapeHtml(s.ad)}</option>`).join("");
  if (seciliF) f.value = seciliF;
}

let ogrenciSinifFiltre = "hepsi";
function renderOgrenciler() {
  const tablo = $("#ogrenci-tablo");
  let liste = [...durum.ogrenciler].sort((a, b) => (a.ad || "").localeCompare(b.ad || "", "tr"));
  if (ogrenciSinifFiltre !== "hepsi") liste = liste.filter((o) => o.sinifId === ogrenciSinifFiltre);
  if (!liste.length) { tabloBos(tablo, "Öğrenci bulunamadı"); return; }
  tablo.innerHTML = `
    <thead><tr><th>Ad Soyad</th><th>Yaş</th><th>Sınıf</th><th>Veli(ler)</th><th>Alerji</th><th></th></tr></thead>
    <tbody>${liste.map((o) => `
      <tr>
        <td data-label="Ad Soyad"><strong>${escapeHtml(o.ad)} ${escapeHtml(o.soyad)}</strong></td>
        <td data-label="Yaş">${o.dogumTarihi ? yasHesapla(o.dogumTarihi) : "-"}</td>
        <td data-label="Sınıf">${escapeHtml(sinifAdi(o.sinifId))}</td>
        <td data-label="Veli(ler)">${(o.veliIds || []).map((v) => escapeHtml(kullaniciAdi(v))).join(", ") || "-"}</td>
        <td data-label="Alerji">${o.alerjiler ? `<span class="rozet rozet--uyari">${escapeHtml(o.alerjiler)}</span>` : "-"}</td>
        <td class="tablo-islem">
          <button class="btn btn--ghost btn--sm" data-duzenle="${o.id}">Düzenle</button>
          <button class="btn btn--danger btn--sm" data-sil="${o.id}">Sil</button>
        </td>
      </tr>`).join("")}</tbody>`;
  tablo.querySelectorAll("[data-duzenle]").forEach((b) =>
    b.addEventListener("click", () => ogrenciFormu(durum.ogrenciler.find((x) => x.id === b.dataset.duzenle))));
  tablo.querySelectorAll("[data-sil]").forEach((b) =>
    b.addEventListener("click", () => ogrenciSil(b.dataset.sil)));
}

// ---------- Duyurular ----------
function renderDuyuruHedef() {
  const s = $("#duyuruHedef");
  s.innerHTML = `<option value="okul">Tüm Okul</option>` +
    durum.siniflar.map((x) => `<option value="${x.id}">${escapeHtml(x.ad)} sınıfı</option>`).join("");
}

function renderDuyurular() {
  const c = $("#duyuru-liste");
  if (!durum.duyurular.length) { emptyState(c, "Henüz duyuru yok", "📢"); return; }
  c.innerHTML = "";
  durum.duyurular.forEach((d) => {
    const hedef = d.hedef === "okul" ? "Tüm Okul" : `${sinifAdi(d.hedef)} sınıfı`;
    c.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, d.baslik),
        el("span", { class: "liste-oge__tarih" }, formatDateTime(d.tarih))
      ),
      el("p", {}, d.icerik),
      el("div", { class: "satir-arasi mt-1" },
        el("span", { class: "rozet rozet--bilgi" }, hedef),
        el("button", { class: "btn btn--danger btn--sm", onClick: () => duyuruSil(d.id) }, "Sil")
      )
    ));
  });
}

// ---------- Galeri (Google Drive) ----------
function renderFotoHedef() {
  const s = $("#fotoHedef");
  if (!s) return;
  const secili = s.value;
  s.innerHTML = `<option value="okul">Tüm Okul</option>` +
    durum.siniflar.map((x) => `<option value="${x.id}">${escapeHtml(x.ad)} sınıfı</option>`).join("");
  if (secili) s.value = secili;
}

// Fotoğrafın Firestore Timestamp'ini "YYYY-MM-DD" anahtarına çevir
function fotoGunu(f) {
  const d = f.tarih?.toDate ? f.tarih.toDate() : (f.tarih ? new Date(f.tarih) : null);
  return d ? isoDate(d) : "";
}

let galeriTarih = isoDate();
function renderGaleri() {
  const c = $("#foto-izgara");
  if (!c) return;
  const tarihInput = $("#galeriTarih");
  if (tarihInput && !tarihInput.value) tarihInput.value = galeriTarih;
  const bilgi = $("#galeri-bilgi");
  const bugun = isoDate();
  const gununkiler = durum.fotograflar.filter((f) => fotoGunu(f) === galeriTarih);

  if (bilgi) {
    bilgi.textContent = galeriTarih === bugun
      ? `Bugünün fotoğrafları (${gununkiler.length}). Başka bir günü görmek için tarih seçin.`
      : `${formatDate(galeriTarih)} — ${gununkiler.length} fotoğraf.`;
  }

  if (!gununkiler.length) {
    emptyState(c, galeriTarih === bugun ? "Bugün için fotoğraf yok" : `${formatDate(galeriTarih)} için fotoğraf yok`, "📷");
    return;
  }
  c.innerHTML = "";
  gununkiler.forEach((f) => {
    const hedef = f.hedef === "okul" ? "Tüm Okul" : `${sinifAdi(f.hedef)} sınıfı`;
    c.appendChild(el("figure", { class: "foto-oge" },
      el("img", { src: f.url, alt: f.aciklama || "Fotoğraf", loading: "lazy" }),
      el("figcaption", {},
        el("div", {}, `${f.aciklama || ""}${f.aciklama ? " · " : ""}${formatDateTime(f.tarih)}`),
        el("div", { class: "satir-arasi mt-1" },
          el("span", { class: "rozet rozet--bilgi" }, hedef),
          el("button", { class: "btn btn--danger btn--sm", onClick: () => fotoSil(f) }, "Sil")
        )
      )
    ));
  });
}

async function fotoYukle(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  const dosya = $("#fotoDosya").files[0];
  if (!dosya) { toast("Bir fotoğraf seçin.", "warning"); return; }
  const hedef = $("#fotoHedef").value;
  const btn = $("#fotoYukleBtn");
  btn.disabled = true; btn.textContent = "Yükleniyor...";
  try {
    const klasor = hedef === "okul" ? "okul" : (sinifAdi(hedef) || hedef);
    const yuklenen = await driveYukle(dosya, {
      url: aktifKres()?.driveUrl, sir: aktifKres()?.driveSir, klasor
    });
    await addDoc(kol("fotograflar"), {
      hedef,
      driveId: yuklenen.id,
      url: yuklenen.goruntuUrl,
      webViewLink: yuklenen.webViewLink,
      aciklama: $("#fotoAciklama").value.trim(),
      yukleyenId: profil.uid,
      yukleyenRol: "admin",
      tarih: serverTimestamp()
    });
    e.target.reset();
    renderFotoHedef();
    toast("Fotoğraf yüklendi.", "success");
    await hepsiniYukle();
    renderGaleri();
  } catch (err) {
    toast(err.message || firebaseHata(err), "error", 6000);
  }
  btn.disabled = false; btn.textContent = "Yükle";
}

async function fotoSil(f) {
  const ok = await confirmDialog("Bu fotoğraf galeriden kaldırılsın mı? (Google Drive'daki dosya silinmez.)");
  if (!ok) return;
  try {
    await deleteDoc(bel("fotograflar", f.id));
    toast("Fotoğraf kaldırıldı.", "success");
    await hepsiniYukle();
    renderGaleri();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// ---------- Aidat / Ödeme ----------
function renderOdemeSecicileri() {
  const s = $("#odemeOgrenci");
  const secili = s.value;
  s.innerHTML = `<option value="">Seçin...</option>` +
    durum.ogrenciler.map((o) => `<option value="${o.id}">${escapeHtml(o.ad)} ${escapeHtml(o.soyad)} — ${escapeHtml(sinifAdi(o.sinifId))}</option>`).join("");
  if (secili) s.value = secili;
  if (!$("#odemeAy").value) $("#odemeAy").value = isoDate().slice(0, 7);
}

function renderTahakkukSecicileri() {
  const s = $("#tahakkukSinif");
  if (!s) return;
  const secili = s.value;
  s.innerHTML = `<option value="hepsi">Tüm sınıflar</option>` +
    durum.siniflar.map((x) => `<option value="${x.id}">${escapeHtml(x.ad)}</option>`).join("");
  if (secili) s.value = secili;
  if (!$("#tahakkukAy").value) $("#tahakkukAy").value = isoDate().slice(0, 7);
}

const ODEME_ROZET = { odendi: "basari", bildirildi: "bilgi", bekliyor: "uyari" };
const ODEME_METIN = { odendi: "Ödendi", bildirildi: "Ödedim bildirildi", bekliyor: "Bekliyor" };

let odemeDurumFiltre = "hepsi";
function renderOdemeler() {
  const tablo = $("#odeme-tablo");
  let liste = [...durum.odemeler];
  if (odemeDurumFiltre !== "hepsi") liste = liste.filter((o) => (o.durum || "bekliyor") === odemeDurumFiltre);
  // "Ödedim bildirildi" en üste
  liste.sort((a, b) => (b.durum === "bildirildi" ? 1 : 0) - (a.durum === "bildirildi" ? 1 : 0));
  if (!liste.length) { tabloBos(tablo, "Kayıt yok"); return; }
  tablo.innerHTML = `
    <thead><tr><th>Öğrenci</th><th>Veli</th><th>Ay</th><th>Tutar</th><th>Durum</th><th>Bildirim</th><th></th></tr></thead>
    <tbody>${liste.map((o) => {
      const d = o.durum || "bekliyor";
      const bild = o.bildirim
        ? `${escapeHtml(o.bildirim.yontem || "-")}${o.bildirim.not ? " · " + escapeHtml(o.bildirim.not) : ""}<br><span class="soluk">${escapeHtml(formatDateTime(o.bildirim.tarih))}</span>`
        : "—";
      return `<tr${d === "bildirildi" ? ' class="satir-vurgu"' : ""}>
        <td data-label="Öğrenci"><strong>${escapeHtml(ogrenciAdi(o.ogrenciId))}</strong></td>
        <td data-label="Veli">${escapeHtml(kullaniciAdi(o.veliId))}</td>
        <td data-label="Ay">${escapeHtml(formatAy(o.ay))}${o.aciklama ? `<br><span class="soluk">${escapeHtml(o.aciklama)}</span>` : ""}</td>
        <td data-label="Tutar">${paraFormat(o.tutar)}</td>
        <td data-label="Durum"><span class="rozet rozet--${ODEME_ROZET[d] || "uyari"}">${ODEME_METIN[d] || d}</span></td>
        <td data-label="Bildirim" class="soluk">${bild}</td>
        <td class="tablo-islem">
          ${d !== "odendi" ? `<button class="btn btn--primary btn--sm" data-onayla="${o.id}">Ödendi onayla</button>` : `<button class="btn btn--ghost btn--sm" data-geri="${o.id}">Geri al</button>`}
          ${d === "odendi" ? `<button class="btn btn--ghost btn--sm" data-makbuz="${o.id}">🧾 Makbuz</button>` : ""}
          <button class="btn btn--danger btn--sm" data-sil="${o.id}">Sil</button>
        </td>
      </tr>`;
    }).join("")}</tbody>`;
  tablo.querySelectorAll("[data-onayla]").forEach((b) =>
    b.addEventListener("click", () => odemeDurumAyarla(b.dataset.onayla, "odendi")));
  tablo.querySelectorAll("[data-geri]").forEach((b) =>
    b.addEventListener("click", () => odemeDurumAyarla(b.dataset.geri, "bekliyor")));
  tablo.querySelectorAll("[data-makbuz]").forEach((b) =>
    b.addEventListener("click", () => makbuzYazdir(durum.odemeler.find((x) => x.id === b.dataset.makbuz))));
  tablo.querySelectorAll("[data-sil]").forEach((b) =>
    b.addEventListener("click", () => odemeSil(b.dataset.sil)));
}

// ---------- Tahsilat özeti (borçlu / ay bazlı rapor) ----------
function renderTahsilatOzeti() {
  const kap = $("#tahsilat-ozet");
  if (!kap) return;
  const ods = durum.odemeler;
  if (!ods.length) { kap.innerHTML = `<p class="soluk">Henüz aidat kaydı yok.</p>`; return; }
  const tp = (arr) => arr.reduce((t, x) => t + (Number(x.tutar) || 0), 0);
  const odenen = ods.filter((o) => o.durum === "odendi");
  const bekleyen = ods.filter((o) => o.durum !== "odendi");
  const borcluIds = [...new Set(bekleyen.map((o) => o.ogrenciId))];

  // Ay bazlı
  const aylar = [...new Set(ods.map((o) => o.ay))].sort().reverse();
  const ayRows = aylar.map((ay) => {
    const g = ods.filter((o) => o.ay === ay);
    const gOd = g.filter((o) => o.durum === "odendi");
    return `<tr>
      <td data-label="Ay">${escapeHtml(formatAy(ay))}</td>
      <td data-label="Tahakkuk">${paraFormat(tp(g))}</td>
      <td data-label="Tahsil">${paraFormat(tp(gOd))}</td>
      <td data-label="Bekleyen">${paraFormat(tp(g) - tp(gOd))}</td>
    </tr>`;
  }).join("");

  // Borçlu öğrenciler
  const borclular = borcluIds.map((oid) => {
    const bo = bekleyen.filter((o) => o.ogrenciId === oid);
    return { oid, borc: tp(bo), aySayi: bo.length, veliId: bo[0]?.veliId };
  }).sort((a, b) => b.borc - a.borc);
  const borcluRows = borclular.map((b) => {
    const veli = durum.kullanicilar.find((u) => u.id === b.veliId);
    return `<tr>
    <td data-label="Öğrenci"><strong>${escapeHtml(ogrenciAdi(b.oid))}</strong></td>
    <td data-label="Veli">${escapeHtml(kullaniciAdi(b.veliId))}</td>
    <td data-label="Ay">${b.aySayi}</td>
    <td data-label="Borç"><strong>${paraFormat(b.borc)}</strong></td>
    <td class="tablo-islem">${veli?.telefon ? `<button class="btn btn--ghost btn--sm" data-wa-borc="${b.oid}">📱 Hatırlat</button>` : ""}</td>
  </tr>`;
  }).join("");

  kap.innerHTML = `
    <div class="stat-izgara" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:16px">
      ${statMini("💰", paraFormat(tp(ods)), "Toplam Tahakkuk")}
      ${statMini("✅", paraFormat(tp(odenen)), "Tahsil Edilen")}
      ${statMini("⏳", paraFormat(tp(bekleyen)), "Bekleyen")}
      ${statMini("👤", String(borcluIds.length), "Borçlu Öğrenci")}
    </div>
    <div class="tablo-sar mb-2"><table class="veri-tablo tablo-kart">
      <thead><tr><th>Ay</th><th>Tahakkuk</th><th>Tahsil</th><th>Bekleyen</th></tr></thead>
      <tbody>${ayRows}</tbody></table></div>
    ${borclular.length ? `<h3 style="font-size:1rem;margin:6px 0">Borçlu Listesi</h3>
      <div class="tablo-sar"><table class="veri-tablo tablo-kart">
        <thead><tr><th>Öğrenci</th><th>Veli</th><th>Ay</th><th>Borç</th><th></th></tr></thead>
        <tbody>${borcluRows}</tbody></table></div>` : `<p class="soluk">Borçlu öğrenci yok. 🎉</p>`}`;

  kap.querySelectorAll("[data-wa-borc]").forEach((btn) => btn.addEventListener("click", () => {
    const b = borclular.find((x) => x.oid === btn.dataset.waBorc);
    const veli = durum.kullanicilar.find((u) => u.id === b?.veliId);
    const mesaj = `Sayın ${veli?.ad || ""} ${veli?.soyad || ""}, ${ogrenciAdi(b.oid)} için ${paraFormat(b.borc)} tutarında (${b.aySayi} ay) aidat borcunuz bulunmaktadır. Bilginize sunarız.`;
    const l = waLink(veli?.telefon, mesaj);
    if (l) window.open(l, "_blank"); else toast("Geçerli telefon yok.", "warning");
  }));
}
const statMini = (i, deger, etiket) => `<div class="stat-kart">
  <div class="stat-kart__ikon">${i}</div>
  <div><div class="stat-kart__sayi">${deger}</div><div class="stat-kart__etiket">${etiket}</div></div></div>`;

// ---------- Aidat makbuzu (yazdır / PDF) ----------
function makbuzYazdir(o) {
  if (!o) return;
  const k = aktifKres() || {};
  const w = window.open("", "_blank", "width=520,height=680");
  if (!w) { toast("Açılır pencere engellendi. İzin verin.", "warning"); return; }
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
    <title>Aidat Makbuzu</title>
    <style>
      body{font-family:'Segoe UI',system-ui,sans-serif;color:#2d2d2d;margin:0;padding:32px}
      .mk{max-width:440px;margin:0 auto;border:2px solid #f0e2d4;border-radius:16px;padding:28px}
      h1{font-size:1.3rem;margin:0 0 4px}
      .alt{color:#888;font-size:.85rem;margin-bottom:20px}
      .satir{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dashed #eee;font-size:.95rem}
      .satir b{color:#555}
      .tutar{font-size:1.5rem;font-weight:800;margin:16px 0;text-align:center;color:#f26d3d}
      .rozet{display:inline-block;background:#e3f5ec;color:#2f7d54;font-weight:700;padding:3px 12px;border-radius:999px;font-size:.8rem}
      .imza{margin-top:28px;text-align:right;color:#888;font-size:.8rem}
      @media print{body{padding:0}.mk{border:none}}
    </style></head><body>
    <div class="mk">
      <h1>${escapeHtml(k.ad || "Kreş")}</h1>
      <div class="alt">Aidat Ödeme Makbuzu${k.telefon ? " · " + escapeHtml(k.telefon) : ""}</div>
      <div class="satir"><b>Öğrenci</b><span>${escapeHtml(ogrenciAdi(o.ogrenciId))}</span></div>
      <div class="satir"><b>Veli</b><span>${escapeHtml(kullaniciAdi(o.veliId))}</span></div>
      <div class="satir"><b>Dönem</b><span>${escapeHtml(formatAy(o.ay))}</span></div>
      ${o.aciklama ? `<div class="satir"><b>Açıklama</b><span>${escapeHtml(o.aciklama)}</span></div>` : ""}
      <div class="satir"><b>Ödeme yöntemi</b><span>${escapeHtml(o.bildirim?.yontem || "—")}</span></div>
      <div class="satir"><b>Onay tarihi</b><span>${escapeHtml(o.onay?.tarih ? formatDateTime(o.onay.tarih) : formatDate(new Date()))}</span></div>
      <div class="tutar">${paraFormat(o.tutar)}</div>
      <div style="text-align:center"><span class="rozet">✓ Ödendi</span></div>
      <div class="imza">Bu belge ${escapeHtml(k.ad || "kreş")} tarafından düzenlenmiştir.</div>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
  </body></html>`;
  w.document.write(html);
  w.document.close();
}

// =============================================================
//  YEMEK LİSTESİ (haftalık menü)
// =============================================================
let menuHafta = haftaBaslangici();

async function menuYukle() {
  $("#menuHafta").textContent = haftaEtiket(menuHafta);
  let veri = {};
  try { const s = await getDoc(bel("menuler", menuHafta)); if (s.exists()) veri = s.data(); } catch { /* yoksay */ }
  const gunler = haftaGunleri(menuHafta);
  const kap = $("#menu-tablo");
  kap.innerHTML = "";
  gunler.forEach((g, i) => {
    const mv = (veri.gunler && veri.gunler[i]) || {};
    kap.appendChild(el("div", { class: "hafta-gun" },
      el("div", { class: "hafta-gun__baslik" }, `${g.isim} · ${formatDate(g.tarih)}`),
      haftaAlan("🥪 Kahvaltı", "kahvalti", mv.kahvalti, i),
      haftaAlan("🍲 Öğle Yemeği", "ogle", mv.ogle, i),
      haftaAlan("🍎 İkindi", "ikindi", mv.ikindi, i)
    ));
  });
}
function haftaAlan(etiket, alan, deger, gi) {
  return el("label", { class: "hafta-alan" },
    el("span", {}, etiket),
    el("input", { type: "text", value: deger || "", dataset: { gun: String(gi), alan } }));
}
async function menuKaydet() {
  if (!yazmaKontrol()) return;
  const gunSayi = haftaGunleri(menuHafta).length;
  const gunler = [];
  for (let i = 0; i < gunSayi; i++) {
    const g = {};
    $$(`#menu-tablo input[data-gun="${i}"]`).forEach((inp) => { g[inp.dataset.alan] = inp.value.trim(); });
    gunler.push(g);
  }
  try {
    await setDoc(bel("menuler", menuHafta), { hafta: menuHafta, gunler, guncelleme: serverTimestamp() });
    toast("Yemek listesi kaydedildi.", "success");
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  HAFTALIK SINIF PROGRAMI
// =============================================================
let programHafta = haftaBaslangici();
let programSinifId = null;

async function programYukle() {
  const s = $("#programSinif");
  s.innerHTML = durum.siniflar.map((x) => `<option value="${x.id}">${escapeHtml(x.ad)}</option>`).join("");
  if (!programSinifId && durum.siniflar[0]) programSinifId = durum.siniflar[0].id;
  if (programSinifId) s.value = programSinifId;
  $("#programHafta").textContent = haftaEtiket(programHafta);
  const kap = $("#program-tablo");
  if (!programSinifId) { kap.innerHTML = `<p class="soluk">Önce sınıf oluşturun.</p>`; return; }
  let veri = {};
  try { const snap = await getDoc(bel("programlar", `${programSinifId}_${programHafta}`)); if (snap.exists()) veri = snap.data(); } catch { /* yoksay */ }
  const gunler = haftaGunleri(programHafta);
  kap.innerHTML = "";
  gunler.forEach((g, i) => {
    kap.appendChild(el("div", { class: "hafta-gun" },
      el("div", { class: "hafta-gun__baslik" }, `${g.isim} · ${formatDate(g.tarih)}`),
      el("label", { class: "hafta-alan" }, el("span", {}, "🎨 Etkinlikler"),
        el("input", { type: "text", value: (veri.gunler && veri.gunler[i]) || "", dataset: { gun: String(i) },
          placeholder: "Örn: Sabah sporu, boyama, hikaye saati" }))));
  });
}
async function programKaydet() {
  if (!yazmaKontrol() || !programSinifId) return;
  const gunler = Array.from($("#program-tablo").querySelectorAll("input[data-gun]"))
    .sort((a, b) => Number(a.dataset.gun) - Number(b.dataset.gun))
    .map((inp) => inp.value.trim());
  try {
    await setDoc(bel("programlar", `${programSinifId}_${programHafta}`), {
      sinifId: programSinifId, hafta: programHafta, gunler, guncelleme: serverTimestamp()
    });
    toast("Program kaydedildi.", "success");
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  YIL SONU: sınıf terfi + toplu veli mesajı
// =============================================================
function yilSonuDoldur() {
  const opts = durum.siniflar.map((x) => `<option value="${x.id}">${escapeHtml(x.ad)}</option>`).join("");
  $("#terfiKaynak").innerHTML = `<option value="">Seçin...</option>` + opts;
  $("#terfiHedef").innerHTML = `<option value="">Seçin...</option>` + opts +
    `<option value="__mezun">Mezun / Ayrıldı (sınıftan çıkar)</option>`;
  $("#tmHedef").innerHTML = `<option value="okul">Tüm veliler</option>` +
    durum.siniflar.map((x) => `<option value="${x.id}">${escapeHtml(x.ad)} velileri</option>`).join("");
}

async function terfiYap(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  const v = formData(e.target);
  if (!v.kaynak || !v.hedef || v.kaynak === v.hedef) { toast("Geçerli kaynak ve hedef seçin.", "warning"); return; }
  const ogrs = durum.ogrenciler.filter((o) => o.sinifId === v.kaynak);
  if (!ogrs.length) { toast("Kaynak sınıfta öğrenci yok.", "warning"); return; }
  const hedefAd = v.hedef === "__mezun" ? "Mezun / Ayrıldı" : sinifAdi(v.hedef);
  if (!await confirmDialog(`${ogrs.length} öğrenci "${sinifAdi(v.kaynak)}" sınıfından "${hedefAd}" konumuna taşınacak. Onaylıyor musunuz?`, { onayMetni: "Taşı", tehlike: false })) return;
  const btn = $("#terfiBtn"); btn.disabled = true; btn.textContent = "Taşınıyor...";
  try {
    for (const o of ogrs) {
      await updateDoc(bel("ogrenciler", o.id), { sinifId: v.hedef === "__mezun" ? null : v.hedef });
    }
    await islemKaydet(profil.uid, "sinif-terfi", { kaynak: v.kaynak, hedef: v.hedef, sayi: ogrs.length });
    toast(`${ogrs.length} öğrenci taşındı.`, "success");
    await hepsiniYukle(); render(); yilSonuDoldur();
  } catch (err) { toast(firebaseHata(err), "error"); }
  btn.disabled = false; btn.textContent = "Öğrencileri Taşı";
}

async function topluMesajGonder(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  const v = formData(e.target);
  const btn = $("#tmBtn"); btn.disabled = true; btn.textContent = "Gönderiliyor...";
  try {
    await addDoc(kol("duyurular"), {
      baslik: v.baslik, icerik: v.icerik,
      hedef: v.hedef === "okul" ? "okul" : v.hedef,
      yayinlayanId: profil.uid, tarih: serverTimestamp()
    });
    const alicilar = v.hedef === "okul" ? tumVeliUidleri() : veliUidleriSinif(v.hedef);
    bildirimGonder(alicilar, "duyuru", v.baslik, v.icerik.slice(0, 90), "duyurular");
    e.target.reset(); yilSonuDoldur();
    toast(`Mesaj ${alicilar.length} veliye iletildi.`, "success");
    await hepsiniYukle(); renderDuyurular();
  } catch (err) { toast(firebaseHata(err), "error"); }
  btn.disabled = false; btn.textContent = "Gönder";
}

// =============================================================
//  OLAY BAĞLAMA
// =============================================================
function gorselleriBagla() {
  // Kullanıcı filtresi
  $("#kullaniciFiltre").querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      $("#kullaniciFiltre").querySelectorAll("button").forEach((x) => x.classList.remove("aktif"));
      b.classList.add("aktif");
      kullaniciRolFiltre = b.dataset.rol;
      renderKullanicilar();
    });
  });
  $("#yeniKullaniciBtn").addEventListener("click", () => kullaniciFormu());
  $("#yeniSinifBtn").addEventListener("click", () => sinifFormu());
  $("#yeniOgrenciBtn").addEventListener("click", () => ogrenciFormu());
  $("#ogrenciSinifFiltre").addEventListener("change", (e) => {
    ogrenciSinifFiltre = e.target.value;
    renderOgrenciler();
  });
  $("#duyuruForm").addEventListener("submit", duyuruYayinla);
  $("#fotoForm").addEventListener("submit", fotoYukle);
  $("#odemeForm").addEventListener("submit", odemeEkle);
  $("#tahakkukForm").addEventListener("submit", tahakkukYap);
  $("#izinForm").addEventListener("submit", izinGonder);

  // Yemek listesi
  $("#menuKaydet").addEventListener("click", menuKaydet);
  $("#menuOnceki").addEventListener("click", () => { menuHafta = haftaKaydir(menuHafta, -1); menuYukle(); });
  $("#menuSonraki").addEventListener("click", () => { menuHafta = haftaKaydir(menuHafta, 1); menuYukle(); });
  // Sınıf programı
  $("#programKaydet").addEventListener("click", programKaydet);
  $("#programSinif").addEventListener("change", (e) => { programSinifId = e.target.value; programYukle(); });
  $("#programOnceki").addEventListener("click", () => { programHafta = haftaKaydir(programHafta, -1); programYukle(); });
  $("#programSonraki").addEventListener("click", () => { programHafta = haftaKaydir(programHafta, 1); programYukle(); });
  // Yıl sonu
  $("#terfiForm").addEventListener("submit", terfiYap);
  $("#topluMesajForm").addEventListener("submit", topluMesajGonder);

  // Global arama
  const ara = $("#globalAra");
  ara.addEventListener("input", () => globalArama(ara.value.trim()));
  ara.addEventListener("focus", () => { if (ara.value.trim()) globalArama(ara.value.trim()); });
  document.addEventListener("click", (e) => {
    const sar = $("#globalAra")?.closest(".global-ara-sar");
    if (sar && !sar.contains(e.target)) $("#globalAraSonuc").hidden = true;
  });
}

// ---------- Global hızlı arama ----------
function globalArama(q) {
  const kap = $("#globalAraSonuc");
  if (!q || q.length < 2) { kap.hidden = true; return; }
  const n = q.toLocaleLowerCase("tr");
  const eslesir = (s) => (s || "").toLocaleLowerCase("tr").includes(n);
  const ogr = durum.ogrenciler.filter((o) => eslesir(`${o.ad} ${o.soyad}`)).slice(0, 6);
  const kul = durum.kullanicilar.filter((u) => eslesir(`${u.ad} ${u.soyad}`) || eslesir(u.email)).slice(0, 6);
  if (!ogr.length && !kul.length) {
    kap.innerHTML = `<div class="global-ara-bos">Sonuç yok</div>`;
    kap.hidden = false; return;
  }
  const rol = { admin: "Yönetici", ogretmen: "Öğretmen", veli: "Veli" };
  kap.innerHTML =
    ogr.map((o) => `<button class="global-ara-oge" data-ogr="${o.id}">
      <span>🧒 ${escapeHtml(o.ad)} ${escapeHtml(o.soyad)}</span>
      <span class="soluk">${escapeHtml(sinifAdi(o.sinifId))}</span></button>`).join("") +
    kul.map((u) => `<button class="global-ara-oge" data-kul="${u.id}">
      <span>👤 ${escapeHtml(u.ad)} ${escapeHtml(u.soyad)}</span>
      <span class="soluk">${escapeHtml(rol[u.rol] || u.rol)}</span></button>`).join("");
  kap.querySelectorAll("[data-ogr]").forEach((b) => b.addEventListener("click", () => {
    kap.hidden = true; $("#globalAra").value = "";
    ogrenciFormu(durum.ogrenciler.find((x) => x.id === b.dataset.ogr));
  }));
  kap.querySelectorAll("[data-kul]").forEach((b) => b.addEventListener("click", () => {
    kap.hidden = true; $("#globalAra").value = "";
    kullaniciFormu(durum.kullanicilar.find((x) => x.id === b.dataset.kul));
  }));
  kap.hidden = false;

  // Galeri tarih filtresi
  $("#galeriTarih").addEventListener("change", (e) => {
    galeriTarih = e.target.value || isoDate();
    renderGaleri();
  });
  $("#galeriBugun").addEventListener("click", () => {
    galeriTarih = isoDate();
    $("#galeriTarih").value = galeriTarih;
    renderGaleri();
  });

  // Ödeme durum filtresi
  $("#odemeDurumFiltre").addEventListener("change", (e) => {
    odemeDurumFiltre = e.target.value;
    renderOdemeler();
  });

  // Talep durum filtresi
  $("#talepDurumFiltre").addEventListener("change", (e) => {
    talepDurumFiltre = e.target.value;
    renderTalepler();
  });
}

// =============================================================
//  KULLANICI CRUD
// =============================================================
function kullaniciFormu(mevcut = null) {
  const duzenle = !!mevcut;
  const form = el("form", { id: "kullaniciFormModal" },
    el("div", { class: "form-satir" },
      alan("Ad", "ad", "text", mevcut?.ad, true),
      alan("Soyad", "soyad", "text", mevcut?.soyad, true)
    ),
    alan("E-posta", "email", "email", mevcut?.email, true, duzenle),
    el("div", { class: "form-grup" },
      el("label", {}, "Rol"),
      el("select", { name: "rol", required: "" },
        ...["veli", "ogretmen", "admin"].map((r) =>
          el("option", { value: r, ...(mevcut?.rol === r ? { selected: "" } : {}) },
            r === "veli" ? "Veli" : r === "ogretmen" ? "Öğretmen" : "Yönetici"))
      )
    ),
    alan("Telefon", "telefon", "tel", mevcut?.telefon),
    !duzenle ? el("div", { class: "form-grup" },
      el("label", {}, "Geçici Şifre"),
      el("input", { name: "sifre", type: "text", required: "", minlength: "6", value: rastgeleSifre() }),
      el("p", { class: "form-yardim" }, "Kullanıcı oluşturulunca e-posta ile şifre belirleme bağlantısı gönderilir; bu geçici şifre yedektir.")
    ) : null,
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" },
      duzenle ? "Güncelle" : "Kullanıcı Oluştur")
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!duzenle && !yazmaKontrol()) return;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    const veri = formData(form);
    try {
      if (duzenle) {
        await updateDoc(bel("users", mevcut.id), {
          ad: veri.ad, soyad: veri.soyad, rol: veri.rol, telefon: veri.telefon || ""
        });
        await updateDoc(doc(db, "kullaniciDizini", mevcut.id), { rol: veri.rol });
        await islemKaydet(profil.uid, "kullanici-guncelle", { hedef: mevcut.id, rol: veri.rol });
        toast("Kullanıcı güncellendi.", "success");
      } else {
        const uid = await authHesabiOlustur(veri.email, veri.sifre);
        await setDoc(bel("users", uid), {
          uid, ad: veri.ad, soyad: veri.soyad, email: veri.email,
          rol: veri.rol, telefon: veri.telefon || "",
          olusturmaTarihi: serverTimestamp()
        });
        await setDoc(doc(db, "kullaniciDizini", uid), { kresId: aktifKresId(), rol: veri.rol });
        try { await sendPasswordResetEmail(getAuth(), veri.email); } catch { /* yoksay */ }
        await islemKaydet(profil.uid, "kullanici-olustur", { hedef: uid, email: veri.email, rol: veri.rol });
        toast(`Kullanıcı oluşturuldu. Şifre belirleme e-postası ${veri.email} adresine gönderildi. (Geçici şifre: ${veri.sifre})`, "success", 8000);
      }
      closeModal();
      await hepsiniYukle();
      render();
    } catch (err) {
      toast(firebaseHata(err), "error");
      btn.disabled = false;
    }
  });

  openModal(duzenle ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı", form);
}

async function kullaniciSil(id) {
  if (!yazmaKontrol()) return;
  if (id === profil.uid) { toast("Kendi hesabınızı silemezsiniz.", "warning"); return; }
  const k = durum.kullanicilar.find((x) => x.id === id);
  const ok = await confirmDialog(
    `${k.ad} ${k.soyad} kullanıcısının kaydı silinsin mi? (Firebase Authentication hesabı konsoldan ayrıca silinmelidir.)`);
  if (!ok) return;
  try {
    await deleteDoc(bel("users", id));
    await deleteDoc(doc(db, "kullaniciDizini", id));
    await islemKaydet(profil.uid, "kullanici-sil", { hedef: id, email: k.email });
    toast("Kullanıcı kaydı silindi.", "success");
    await hepsiniYukle();
    render();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// İkincil Firebase uygulaması ile Auth hesabı oluştur (yöneticinin oturumunu bozmadan)
async function authHesabiOlustur(email, sifre) {
  const ikincil = initializeApp(firebaseConfig, "ikincil-" + Date.now());
  const ikincilAuth = getAuth(ikincil);
  try {
    const cred = await createUserWithEmailAndPassword(ikincilAuth, email, sifre);
    await ikincilCikis(ikincilAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(ikincil);
  }
}

function rastgeleSifre() {
  return "kres" + Math.random().toString(36).slice(2, 8);
}

// =============================================================
//  SINIF CRUD
// =============================================================
function sinifFormu(mevcut = null) {
  const duzenle = !!mevcut;
  const form = el("form", {},
    alan("Sınıf Adı", "ad", "text", mevcut?.ad, true),
    alan("Yaş Grubu", "yasGrubu", "text", mevcut?.yasGrubu, false, false, "Örn: 3-4 Yaş"),
    el("div", { class: "form-grup" },
      el("label", {}, "Öğretmen"),
      el("select", { name: "ogretmenId" },
        el("option", { value: "" }, "Atanmadı"),
        ...ogretmenler().map((o) =>
          el("option", { value: o.id, ...(mevcut?.ogretmenId === o.id ? { selected: "" } : {}) },
            `${o.ad} ${o.soyad}`))
      )
    ),
    alan("Kapasite", "kapasite", "number", mevcut?.kapasite),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" },
      duzenle ? "Güncelle" : "Sınıf Oluştur")
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!yazmaKontrol()) return;
    const veri = formData(form);
    const kayit = {
      ad: veri.ad, yasGrubu: veri.yasGrubu || "",
      ogretmenId: veri.ogretmenId || null,
      kapasite: Number(veri.kapasite) || 0
    };
    try {
      if (duzenle) { await updateDoc(bel("siniflar", mevcut.id), kayit); toast("Sınıf güncellendi.", "success"); }
      else { await addDoc(kol("siniflar"), kayit); toast("Sınıf oluşturuldu.", "success"); }
      closeModal();
      await hepsiniYukle();
      render();
    } catch (err) { toast(firebaseHata(err), "error"); }
  });

  openModal(duzenle ? "Sınıfı Düzenle" : "Yeni Sınıf", form);
}

async function sinifSil(id) {
  const dolu = durum.ogrenciler.filter((o) => o.sinifId === id).length;
  if (dolu) { toast("Bu sınıfta öğrenci var. Önce öğrencileri taşıyın.", "warning"); return; }
  const ok = await confirmDialog(`"${sinifAdi(id)}" sınıfı silinsin mi?`);
  if (!ok) return;
  try {
    await deleteDoc(bel("siniflar", id));
    toast("Sınıf silindi.", "success");
    await hepsiniYukle();
    render();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  ÖĞRENCİ CRUD
// =============================================================
function ogrenciFormu(mevcut = null) {
  const duzenle = !!mevcut;
  const seciliVeliler = new Set(mevcut?.veliIds || []);
  const form = el("form", {},
    el("div", { class: "form-satir" },
      alan("Ad", "ad", "text", mevcut?.ad, true),
      alan("Soyad", "soyad", "text", mevcut?.soyad, true)
    ),
    alan("Doğum Tarihi", "dogumTarihi", "date", mevcut?.dogumTarihi),
    el("div", { class: "form-grup" },
      el("label", {}, "Sınıf"),
      el("select", { name: "sinifId", required: "" },
        el("option", { value: "" }, "Seçin..."),
        ...durum.siniflar.map((s) =>
          el("option", { value: s.id, ...(mevcut?.sinifId === s.id ? { selected: "" } : {}) }, s.ad))
      )
    ),
    el("div", { class: "form-grup" },
      el("label", {}, "Veli(ler)"),
      veliler().length
        ? el("div", { class: "checkbox-liste" },
            ...veliler().map((v) => el("label", {},
              el("input", { type: "checkbox", name: "veliIds[]", value: v.id, ...(seciliVeliler.has(v.id) ? { checked: "" } : {}) }),
              `${v.ad} ${v.soyad} (${v.email})`)))
        : el("p", { class: "form-yardim" }, "Önce veli hesabı oluşturun.")
    ),
    alan("Alerji / Sağlık Notu", "alerjiler", "text", mevcut?.alerjiler, false, false, "Örn: Fıstık alerjisi"),
    el("div", { class: "form-grup" },
      el("label", {}, "Notlar"),
      el("textarea", { name: "notlar" }, mevcut?.notlar || "")
    ),
    el("div", { class: "form-grup" },
      el("label", {}, "Fotoğraf"),
      el("input", { name: "foto", type: "file", accept: "image/*" }),
      mevcut?.fotoUrl ? el("p", { class: "form-yardim" }, "Mevcut fotoğraf korunur (yeni seçilmezse).") : null
    ),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" },
      duzenle ? "Güncelle" : "Öğrenci Kaydet")
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!yazmaKontrol()) return;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    const veri = formData(form);
    const dosya = form.querySelector("input[name=foto]").files[0];
    try {
      let fotoUrl = mevcut?.fotoUrl || "";
      const kayit = {
        ad: veri.ad, soyad: veri.soyad,
        dogumTarihi: veri.dogumTarihi || null,
        sinifId: veri.sinifId,
        veliIds: veri.veliIds || [],
        alerjiler: veri.alerjiler || "",
        notlar: veri.notlar || "",
        fotoUrl,
        fotoDriveId: mevcut?.fotoDriveId || null
      };
      let ref;
      if (duzenle) {
        await updateDoc(bel("ogrenciler", mevcut.id), kayit);
        ref = { id: mevcut.id };
      } else {
        ref = await addDoc(kol("ogrenciler"), kayit);
      }
      if (dosya) {
        const yuklenen = await driveYukle(dosya, {
          url: aktifKres()?.driveUrl, sir: aktifKres()?.driveSir, klasor: "ogrenci-fotograflari"
        });
        await updateDoc(bel("ogrenciler", ref.id), {
          fotoUrl: yuklenen.goruntuUrl,
          fotoDriveId: yuklenen.id
        });
      }
      toast(duzenle ? "Öğrenci güncellendi." : "Öğrenci kaydedildi.", "success");
      closeModal();
      await hepsiniYukle();
      render();
    } catch (err) {
      toast(firebaseHata(err), "error");
      btn.disabled = false; btn.textContent = "Kaydet";
    }
  });

  openModal(duzenle ? "Öğrenciyi Düzenle" : "Yeni Öğrenci", form, { genis: true });
}

async function ogrenciSil(id) {
  const o = durum.ogrenciler.find((x) => x.id === id);
  const ok = await confirmDialog(`${o.ad} ${o.soyad} öğrencisinin kaydı silinsin mi?`);
  if (!ok) return;
  try {
    await deleteDoc(bel("ogrenciler", id));
    toast("Öğrenci silindi.", "success");
    await hepsiniYukle();
    render();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  DUYURU
// =============================================================
async function duyuruYayinla(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  const veri = formData(e.target);
  try {
    await addDoc(kol("duyurular"), {
      baslik: veri.baslik,
      icerik: veri.icerik,
      hedef: veri.hedef || "okul",
      yayinlayanId: profil.uid,
      tarih: serverTimestamp()
    });
    e.target.reset();
    renderDuyuruHedef();
    toast("Duyuru yayınlandı.", "success");
    const alicilar = (veri.hedef || "okul") === "okul"
      ? [...tumVeliUidleri(), ...tumOgretmenUidleri()]
      : veliUidleriSinif(veri.hedef);
    bildirimGonder(alicilar, "duyuru", "Yeni duyuru", veri.baslik, "duyurular");
    await hepsiniYukle();
    renderDuyurular();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

async function duyuruSil(id) {
  const ok = await confirmDialog("Bu duyuru silinsin mi?");
  if (!ok) return;
  try {
    await deleteDoc(bel("duyurular", id));
    toast("Duyuru silindi.", "success");
    await hepsiniYukle();
    renderDuyurular();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  AİDAT / ÖDEME
// =============================================================
async function odemeEkle(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  const veri = formData(e.target);
  const ogr = durum.ogrenciler.find((o) => o.id === veri.ogrenciId);
  if (!ogr) { toast("Öğrenci seçin.", "warning"); return; }
  const veliId = (ogr.veliIds || [])[0] || null;
  if (!veliId) { toast("Bu öğrencinin velisi tanımlı değil.", "warning"); return; }
  try {
    await addDoc(kol("odemeler"), {
      veliId,
      ogrenciId: ogr.id,
      ay: veri.ay,
      tutar: Number(veri.tutar) || 0,
      aciklama: "",
      durum: veri.durum || "bekliyor",
      tarih: serverTimestamp()
    });
    e.target.reset();
    renderOdemeSecicileri();
    toast("Ödeme kaydı eklendi.", "success");
    if ((veri.durum || "bekliyor") !== "odendi") {
      bildirimGonder(veliId, "aidat", "Yeni aidat kaydı",
        `${formatAy(veri.ay)} · ${paraFormat(Number(veri.tutar) || 0)}`, "odemeler");
    }
    await hepsiniYukle();
    renderOdemeler();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// Toplu tahakkuk: seçilen sınıftaki (velisi olan) her öğrenciye bir aidat kaydı
async function tahakkukYap(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  const v = formData(e.target);
  const tutar = Number(v.tutar) || 0;
  const ay = v.ay;
  if (!ay || !tutar) { toast("Ay ve tutar girin.", "warning"); return; }
  let hedefOgrenciler = durum.ogrenciler;
  if (v.sinifId !== "hepsi") hedefOgrenciler = hedefOgrenciler.filter((o) => o.sinifId === v.sinifId);

  const btn = $("#tahakkukBtn");
  btn.disabled = true; btn.textContent = "Oluşturuluyor...";
  let eklenen = 0, atlanan = 0, velisiz = 0;
  const bildirilecek = [];
  try {
    for (const o of hedefOgrenciler) {
      const veliId = (o.veliIds || [])[0] || null;
      if (!veliId) { velisiz++; continue; }
      const varMi = durum.odemeler.some((x) => x.ogrenciId === o.id && x.ay === ay);
      if (varMi) { atlanan++; continue; }
      await addDoc(kol("odemeler"), {
        veliId, ogrenciId: o.id, ay, tutar,
        aciklama: v.aciklama || "",
        durum: "bekliyor",
        tarih: serverTimestamp()
      });
      eklenen++;
      bildirilecek.push(veliId);
    }
    await islemKaydet(profil.uid, "aidat-tahakkuk", { ay, tutar, eklenen, atlanan });
    if (bildirilecek.length) {
      bildirimGonder([...new Set(bildirilecek)], "aidat", "Yeni aidat tahakkuku",
        `${formatAy(ay)} · ${paraFormat(tutar)}`, "odemeler");
    }
    toast(`${eklenen} aidat kaydı oluşturuldu. ${atlanan} zaten vardı, ${velisiz} öğrencinin velisi yok.`, "success", 7000);
    e.target.reset();
    await hepsiniYukle();
    renderTahakkukSecicileri();
    renderOdemeler();
  } catch (err) { toast(firebaseHata(err), "error"); }
  btn.disabled = false; btn.textContent = "Tahakkuku Oluştur";
}

async function odemeDurumAyarla(id, yeni) {
  const o = durum.odemeler.find((x) => x.id === id);
  try {
    const guncelleme = { durum: yeni };
    if (yeni === "odendi") guncelleme.onay = { tarih: serverTimestamp(), onaylayanId: profil.uid };
    await updateDoc(bel("odemeler", id), guncelleme);
    o.durum = yeni;
    if (yeni === "odendi") o.onay = { tarih: new Date() };
    renderOdemeler();
    toast(yeni === "odendi" ? "Ödeme onaylandı." : "Geri alındı.", "success");
  } catch (err) { toast(firebaseHata(err), "error"); }
}

async function odemeSil(id) {
  const ok = await confirmDialog("Bu ödeme kaydı silinsin mi?");
  if (!ok) return;
  try {
    await deleteDoc(bel("odemeler", id));
    toast("Kayıt silindi.", "success");
    await hepsiniYukle();
    renderOdemeler();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  TALEPLER (öğretmen -> yönetim)
// =============================================================
const TALEP_ROZET = { yeni: "uyari", inceleniyor: "bilgi", tamamlandi: "basari", reddedildi: "hata" };
const TALEP_METIN = { yeni: "Yeni", inceleniyor: "İnceleniyor", tamamlandi: "Tamamlandı", reddedildi: "Reddedildi" };

let talepDurumFiltre = "acik";
function renderTalepler() {
  const c = $("#talep-liste");
  if (!c) return;
  let liste = [...durum.talepler];
  if (talepDurumFiltre === "acik") liste = liste.filter((t) => t.durum === "yeni" || t.durum === "inceleniyor");
  else if (talepDurumFiltre !== "hepsi") liste = liste.filter((t) => t.durum === talepDurumFiltre);
  if (!liste.length) { emptyState(c, "Talep yok", "📨"); return; }
  c.innerHTML = "";
  liste.forEach((t) => {
    const oge = el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, t.baslik),
        el("span", { class: "liste-oge__tarih" }, formatDateTime(t.tarih))
      ),
      el("p", {}, t.icerik),
      el("div", { class: "satir-arasi mt-1" },
        el("span", { class: `rozet rozet--${TALEP_ROZET[t.durum] || "uyari"}` }, TALEP_METIN[t.durum] || t.durum),
        el("span", { class: "rozet" }, "Öğretmen: " + kullaniciAdi(t.ogretmenId)),
        t.sinifId ? el("span", { class: "rozet rozet--bilgi" }, sinifAdi(t.sinifId)) : null,
        t.oncelik ? el("span", { class: "rozet" }, "Öncelik: " + t.oncelik) : null
      ),
      t.yanit ? el("div", { class: "rapor-kart__metin mt-1" }, el("strong", {}, "Yanıt: "), document.createTextNode(t.yanit)) : null,
      el("div", { class: "satir-arasi mt-1" },
        el("button", { class: "btn btn--primary btn--sm", onClick: () => talepYanitla(t) }, "Yanıtla / Durum"),
        el("button", { class: "btn btn--danger btn--sm", onClick: () => talepSil(t.id) }, "Sil")
      )
    );
    c.appendChild(oge);
  });
}

function talepYanitla(t) {
  const form = el("form", {},
    el("div", { class: "form-grup" }, el("label", {}, "Durum"),
      el("select", { name: "durum" },
        ...["yeni", "inceleniyor", "tamamlandi", "reddedildi"].map((d) =>
          el("option", { value: d, ...(t.durum === d ? { selected: "" } : {}) }, TALEP_METIN[d])))),
    el("div", { class: "form-grup" }, el("label", {}, "Yanıt (öğretmene görünür)"),
      el("textarea", { name: "yanit" }, t.yanit || "")),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Kaydet")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!yazmaKontrol()) return;
    const v = formData(form);
    try {
      await updateDoc(bel("talepler", t.id), {
        durum: v.durum, yanit: v.yanit || "", guncelleme: serverTimestamp()
      });
      closeModal();
      toast("Güncellendi.", "success");
      bildirimGonder(t.ogretmenId, "talep", "Talebiniz güncellendi",
        `${t.baslik} — ${TALEP_METIN[v.durum] || v.durum}`, "istek");
      await hepsiniYukle();
      renderTalepler();
    } catch (err) { toast(firebaseHata(err), "error"); }
  });
  openModal("Talep — " + escapeHtml(t.baslik), form);
}

async function talepSil(id) {
  if (!await confirmDialog("Bu talep silinsin mi?")) return;
  try {
    await deleteDoc(bel("talepler", id));
    toast("Silindi.", "success");
    await hepsiniYukle();
    renderTalepler();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  İZİN / BELGE (veli onayı)
// =============================================================
function renderIzinSiniflar() {
  const c = $("#izinSiniflar");
  if (!c) return;
  c.innerHTML = "";
  if (!durum.siniflar.length) { c.appendChild(el("p", { class: "form-yardim" }, "Önce sınıf oluşturun.")); return; }
  durum.siniflar.forEach((s) => {
    c.appendChild(el("label", {},
      el("input", { type: "checkbox", name: "hedefSiniflar[]", value: s.id }),
      `${s.ad}${s.yasGrubu ? " (" + s.yasGrubu + ")" : ""}`));
  });
}

function izinYanitKol(belgeId) {
  return collection(db, "kresler", aktifKresId(), "izinBelgeleri", belgeId, "yanitlar");
}
const izinYanitCache = {};   // belgeId -> [{veliUid, ogrenciId, karar, not, tarih}]
async function izinYanitlariGetir(belgeId) {
  const snap = await getDocs(izinYanitKol(belgeId));
  izinYanitCache[belgeId] = snap.docs.map((d) => ({ veliUid: d.id, ...d.data() }));
  return izinYanitCache[belgeId];
}

function renderIzinler() {
  const c = $("#izin-liste");
  if (!c) return;
  if (!durum.izinBelgeleri.length) { emptyState(c, "Henüz belge yok", "📝"); return; }
  c.innerHTML = "";
  durum.izinBelgeleri.forEach((b) => {
    const hedefAdlar = (b.hedefSiniflar || []).map((id) => sinifAdi(id)).join(", ") || "—";
    // Bu belgenin ilgilendirdiği öğrenci sayısı (velisi olan)
    const ilgiliOgr = durum.ogrenciler.filter((o) =>
      (b.hedefSiniflar || []).includes(o.sinifId) && (o.veliIds || []).length);
    const kutu = el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, `${turEtiket(b.tur)} · ${b.baslik}`),
        el("span", { class: "liste-oge__tarih" }, formatDateTime(b.tarih))
      ),
      el("p", {}, b.metin),
      el("div", { class: "satir-arasi mt-1" },
        el("span", { class: "rozet rozet--bilgi" }, "Sınıf: " + hedefAdlar),
        b.etkinlikTarihi ? el("span", { class: "rozet" }, "Tarih: " + formatDate(b.etkinlikTarihi)) : null,
        el("span", { class: "rozet" }, `${ilgiliOgr.length} öğrenci`)
      ),
      el("div", { class: "satir-arasi mt-1", id: "izin-ozet-" + b.id },
        el("button", { class: "btn btn--ghost btn--sm", onClick: () => izinDetayGoster(b, kutu) }, "Yanıtları gör"),
        el("button", { class: "btn btn--danger btn--sm", onClick: () => izinSil(b.id) }, "Sil")
      )
    );
    c.appendChild(kutu);
  });
}

async function izinDetayGoster(b, kutu) {
  const yanitlar = await izinYanitlariGetir(b.id);
  const onay = yanitlar.filter((y) => y.karar === "onay").length;
  const ret = yanitlar.filter((y) => y.karar === "ret").length;
  const ilgiliOgr = durum.ogrenciler.filter((o) =>
    (b.hedefSiniflar || []).includes(o.sinifId) && (o.veliIds || []).length);
  const bekleyen = Math.max(0, ilgiliOgr.length - yanitlar.length);

  const tablo = el("table", { class: "veri-tablo tablo-kart" });
  tablo.innerHTML = `<thead><tr><th>Öğrenci</th><th>Veli</th><th>Karar</th><th>Not</th><th>Tarih</th><th></th></tr></thead>
    <tbody>${ilgiliOgr.map((o) => {
      const y = yanitlar.find((x) => x.veliUid === (o.veliIds || [])[0]) || yanitlar.find((x) => x.ogrenciId === o.id);
      const kararRozet = !y ? '<span class="rozet rozet--uyari">Bekliyor</span>'
        : y.karar === "onay" ? '<span class="rozet rozet--basari">Onay</span>'
        : '<span class="rozet rozet--hata">Ret</span>';
      return `<tr>
        <td data-label="Öğrenci">${escapeHtml(o.ad)} ${escapeHtml(o.soyad)}</td>
        <td data-label="Veli">${escapeHtml(kullaniciAdi((o.veliIds || [])[0]))}</td>
        <td data-label="Karar">${kararRozet}</td>
        <td data-label="Not" class="soluk">${escapeHtml(y?.not || "")}</td>
        <td data-label="Tarih" class="soluk">${y?.tarih ? escapeHtml(formatDateTime(y.tarih)) : "—"}</td>
        <td class="tablo-islem">${y ? `<button class="btn btn--ghost btn--sm" data-sifirla="${y.veliUid}">Yanıtı sıfırla</button>` : ""}</td>
      </tr>`;
    }).join("")}</tbody>`;

  tablo.querySelectorAll("[data-sifirla]").forEach((btn) =>
    btn.addEventListener("click", () => izinYanitSifirla(b, btn.dataset.sifirla)));

  openModal(`Yanıtlar — ${escapeHtml(b.baslik)}`, el("div", {},
    el("div", { class: "satir-arasi mb-1" },
      el("span", { class: "rozet rozet--basari" }, `Onay: ${onay}`),
      el("span", { class: "rozet rozet--hata" }, `Ret: ${ret}`),
      el("span", { class: "rozet rozet--uyari" }, `Bekleyen: ${bekleyen}`)
    ),
    el("div", { class: "tablo-sar" }, tablo)
  ), { genis: true });
}

async function izinYanitSifirla(belge, veliUid) {
  if (!await confirmDialog("Bu velinin yanıtı silinsin mi? Veli yeniden yanıt verebilir.", { onayMetni: "Sıfırla", tehlike: true })) return;
  try {
    await deleteDoc(doc(izinYanitKol(belge.id), veliUid));
    delete izinYanitCache[belge.id];
    toast("Yanıt sıfırlandı.", "success");
    closeModal();
    izinDetayGoster(belge);
  } catch (err) { toast(firebaseHata(err), "error"); }
}

async function izinGonder(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  const v = formData(e.target);
  const hedef = v["hedefSiniflar"] || [];
  if (!hedef.length) { toast("En az bir sınıf seçin.", "warning"); return; }
  const btn = $("#izinBtn");
  btn.disabled = true; btn.textContent = "Gönderiliyor...";
  try {
    await addDoc(kol("izinBelgeleri"), {
      tur: v.tur || "belge",
      baslik: v.baslik,
      metin: v.metin,
      hedefSiniflar: hedef,
      etkinlikTarihi: v.etkinlikTarihi || null,
      olusturanId: profil.uid,
      tarih: serverTimestamp()
    });
    await islemKaydet(profil.uid, "izin-belge-gonder", { baslik: v.baslik, tur: v.tur });
    e.target.reset();
    renderIzinSiniflar();
    toast("Belge gönderildi. Veliler panellerinde görecek.", "success");
    const alicilar = [...new Set(hedef.flatMap((sid) => veliUidleriSinif(sid)))];
    bildirimGonder(alicilar, "izin", "Yeni izin / belge", v.baslik, "izinler");
    await hepsiniYukle();
    renderIzinler();
  } catch (err) { toast(firebaseHata(err), "error"); }
  btn.disabled = false; btn.textContent = "Gönder";
}

async function izinSil(id) {
  if (!await confirmDialog("Bu belge ve tüm yanıtları silinsin mi?")) return;
  try {
    // önce yanıtlar
    const snap = await getDocs(izinYanitKol(id));
    for (const d of snap.docs) await deleteDoc(d.ref);
    await deleteDoc(bel("izinBelgeleri", id));
    toast("Silindi.", "success");
    await hepsiniYukle();
    renderIzinler();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

function turEtiket(t) {
  return t === "gezi" ? "🚌 Gezi" : t === "izin" ? "✋ İzin" : "📄 Belge";
}

// =============================================================
//  AYARLAR
// =============================================================
let ayarlarBagli = false;
async function ayarlariDoldur() {
  const k = aktifKres() || {};
  // Abonelik özeti
  const ozet = $("#abonelik-ozet");
  const plan = k.plan === "deneme" ? "Deneme" : (k.plan || "-");
  const durumMetin = onayBekliyorMu(k) ? "Onay Bekliyor" : (kresAktifMi(k) ? "Aktif" : "Pasif");
  const bitis = k.bitisTarihi?.toDate ? formatDateTime(k.bitisTarihi) : "Süresiz";
  ozet.innerHTML = `Plan: <strong>${escapeHtml(plan)}</strong> · Durum: <strong>${escapeHtml(durumMetin)}</strong>`
    + (onayBekliyorMu(k) ? "" : ` · Erişim bitişi: ${escapeHtml(bitis)}`);

  $("#kresAd").value = k.ad || "";
  $("#kresTelefon").value = k.telefon || "";
  $("#kresRenk").value = k.marka?.renk || "#ff8a5c";
  $("#driveUrl").value = k.driveUrl || "";
  $("#driveSir").value = k.driveSir || "";

  // İşlem kayıtları (son 50)
  try {
    const snap = await getDocs(kol("islemKayitlari"));
    const kayitlar = snap.docs.map((d) => d.data())
      .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0)).slice(0, 50);
    const t = $("#islem-tablo");
    if (!kayitlar.length) tabloBos(t, "Kayıt yok");
    else t.innerHTML = `<thead><tr><th>Tarih</th><th>İşlem</th><th>Detay</th></tr></thead><tbody>`
      + kayitlar.map((x) => `<tr><td>${escapeHtml(formatDateTime(x.tarih))}</td><td>${escapeHtml(x.islem || "")}</td><td class="soluk">${escapeHtml(JSON.stringify(x.detay || {}))}</td></tr>`).join("")
      + `</tbody>`;
  } catch { /* yoksay */ }

  if (ayarlarBagli) return;
  ayarlarBagli = true;

  $("#kresBilgiForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!yazmaKontrol()) return;
    const v = formData(e.target);
    try {
      await updateDoc(doc(db, "kresler", aktifKresId()), {
        ad: v.ad, telefon: v.telefon || "", "marka.renk": v.renk || "#ff8a5c"
      });
      Object.assign(aktifKres(), { ad: v.ad, telefon: v.telefon || "" });
      await islemKaydet(profil.uid, "kres-ayar-guncelle", {});
      toast("Kaydedildi.", "success");
    } catch (err) { toast(firebaseHata(err), "error"); }
  });

  $("#driveForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!yazmaKontrol()) return;
    const v = formData(e.target);
    try {
      await updateDoc(doc(db, "kresler", aktifKresId()), {
        driveUrl: v.driveUrl || "", driveSir: v.driveSir || ""
      });
      Object.assign(aktifKres(), { driveUrl: v.driveUrl || "", driveSir: v.driveSir || "" });
      toast("Fotoğraf servisi ayarları kaydedildi.", "success");
    } catch (err) { toast(firebaseHata(err), "error"); }
  });

  $("#driveTestBtn").addEventListener("click", async () => {
    const url = $("#driveUrl").value.trim();
    const sonuc = $("#drive-test-sonuc");
    if (!url) { sonuc.textContent = "Önce /exec adresini girin."; return; }
    sonuc.textContent = "Kontrol ediliyor...";
    try {
      const r = await fetch(url, { method: "GET" });
      const j = await r.json();
      sonuc.textContent = j.ok ? "✓ Servis çalışıyor: " + (j.mesaj || "OK") : "Beklenmeyen yanıt.";
    } catch {
      sonuc.textContent = "✕ Adrese ulaşılamadı. Dağıtım 'Herkes' erişimli mi, adres /exec ile mi bitiyor?";
    }
  });

  $("#veriDisaAktarBtn").addEventListener("click", veriDisaAktar);
}

async function veriDisaAktar() {
  toast("Veri toplanıyor...", "info");
  const altlar = ["users", "siniflar", "ogrenciler", "yoklamalar", "gunlukRaporlar",
    "duyurular", "mesajlar", "odemeler", "fotograflar", "talepler", "izinBelgeleri",
    "gozlemler", "menuler", "programlar", "devamsizlikBildirimleri", "islemKayitlari"];
  const cikti = { kres: aktifKres(), disaAktarma: new Date().toISOString() };
  try {
    for (const alt of altlar) {
      const snap = await getDocs(kol(alt));
      cikti[alt] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    const blob = new Blob([JSON.stringify(cikti, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kres-veri-${isoDate()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    await islemKaydet(profil.uid, "veri-disa-aktar", {});
    toast("Dışa aktarıldı.", "success");
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  KÜÇÜK YARDIMCI: form alanı üretici
// =============================================================
function alan(etiket, ad, tur = "text", deger = "", zorunlu = false, saltOkunur = false, ipucu = "") {
  return el("div", { class: "form-grup" },
    el("label", {}, etiket),
    el("input", {
      name: ad, type: tur, value: deger ?? "",
      ...(zorunlu ? { required: "" } : {}),
      ...(saltOkunur ? { readonly: "" } : {}),
      ...(ipucu ? { placeholder: ipucu } : {}),
      ...(tur === "number" ? { min: "0" } : {})
    }),
    ipucu ? el("p", { class: "form-yardim" }, ipucu) : null
  );
}

// =============================================================
//  BAŞLANGIÇ
// =============================================================
await hepsiniYukle();
gorselleriBagla();
render();
