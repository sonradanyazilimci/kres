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
  doc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, firebaseConfig } from "./firebase-config.js";
import { driveYukle } from "./drive-upload.js";
import { sayfaKorumasi, cikisYap } from "./auth.js";
import {
  kol, bel, aktifKresId, aktifKres, kresAktifMi, onayBekliyorMu, islemKaydet,
  denemeBandiGoster, kilitEkraniGoster
} from "./kres.js";
import {
  $, el, escapeHtml, toast, emptyState, tabloBos, openModal, closeModal,
  confirmDialog, formData, formatDateTime, formatAy, paraFormat,
  yasHesapla, isoDate, firebaseHata, kurPanelGezinme, kurCikis, kullaniciRozeti
} from "./utils.js";

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
  fotograflar: []
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

const nav = kurPanelGezinme({
  "genel-bakis": "Genel Bakış",
  "kullanicilar": "Kullanıcılar",
  "siniflar": "Sınıflar",
  "ogrenciler": "Öğrenciler",
  "duyurular": "Duyurular",
  "galeri": "Galeri",
  "odemeler": "Ödemeler",
  "ayarlar": "Ayarlar"
}, (ad) => { if (ad === "ayarlar") ayarlariDoldur(); });

// (Başlangıç çağrıları dosyanın SONUNDA — tüm `const` yardımcılar
//  tanımlandıktan sonra çalışsın diye.)

// =============================================================
//  VERİ YÜKLEME
// =============================================================
async function hepsiniYukle() {
  const [uSnap, sSnap, oSnap, dSnap, odSnap, fSnap] = await Promise.all([
    getDocs(kol("users")),
    getDocs(kol("siniflar")),
    getDocs(kol("ogrenciler")),
    getDocs(kol("duyurular")),
    getDocs(kol("odemeler")),
    getDocs(kol("fotograflar"))
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
  renderOdemeler();
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
        <td><strong>${escapeHtml(s.ad)}</strong></td>
        <td>${escapeHtml(s.yasGrubu || "-")}</td>
        <td>${escapeHtml(s.ogretmenId ? kullaniciAdi(s.ogretmenId) : "Atanmadı")}</td>
        <td>${dolu} / ${kap} ${kap && dolu >= kap ? '<span class="rozet rozet--hata">Dolu</span>' : ""}</td>
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
        <td><strong>${escapeHtml(k.ad || "")} ${escapeHtml(k.soyad || "")}</strong></td>
        <td>${escapeHtml(k.email || "")}</td>
        <td>${escapeHtml(k.telefon || "-")}</td>
        <td><span class="rozet rozet--${rozet[k.rol] || "bilgi"}">${escapeHtml(k.rol)}</span></td>
        <td class="tablo-islem">
          <button class="btn btn--ghost btn--sm" data-duzenle="${k.id}">Düzenle</button>
          <button class="btn btn--danger btn--sm" data-sil="${k.id}">Sil</button>
        </td>
      </tr>`).join("")}</tbody>`;

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
        <td><strong>${escapeHtml(s.ad)}</strong></td>
        <td>${escapeHtml(s.yasGrubu || "-")}</td>
        <td>${escapeHtml(s.ogretmenId ? kullaniciAdi(s.ogretmenId) : "Atanmadı")}</td>
        <td>${s.kapasite || "-"}</td>
        <td>${dolu}</td>
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
        <td><strong>${escapeHtml(o.ad)} ${escapeHtml(o.soyad)}</strong></td>
        <td>${o.dogumTarihi ? yasHesapla(o.dogumTarihi) : "-"}</td>
        <td>${escapeHtml(sinifAdi(o.sinifId))}</td>
        <td>${(o.veliIds || []).map((v) => escapeHtml(kullaniciAdi(v))).join(", ") || "-"}</td>
        <td>${o.alerjiler ? `<span class="rozet rozet--uyari">${escapeHtml(o.alerjiler)}</span>` : "-"}</td>
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

function renderGaleri() {
  const c = $("#foto-izgara");
  if (!c) return;
  if (!durum.fotograflar.length) { emptyState(c, "Henüz fotoğraf yok", "📷"); return; }
  c.innerHTML = "";
  durum.fotograflar.forEach((f) => {
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

// ---------- Ödemeler ----------
function renderOdemeSecicileri() {
  const s = $("#odemeOgrenci");
  const secili = s.value;
  s.innerHTML = `<option value="">Seçin...</option>` +
    durum.ogrenciler.map((o) => `<option value="${o.id}">${escapeHtml(o.ad)} ${escapeHtml(o.soyad)} — ${escapeHtml(sinifAdi(o.sinifId))}</option>`).join("");
  if (secili) s.value = secili;
  if (!$("#odemeAy").value) $("#odemeAy").value = isoDate().slice(0, 7);
}

function renderOdemeler() {
  const tablo = $("#odeme-tablo");
  if (!durum.odemeler.length) { tabloBos(tablo, "Ödeme kaydı yok"); return; }
  tablo.innerHTML = `
    <thead><tr><th>Öğrenci</th><th>Veli</th><th>Ay</th><th>Tutar</th><th>Durum</th><th></th></tr></thead>
    <tbody>${durum.odemeler.map((o) => `
      <tr>
        <td><strong>${escapeHtml(ogrenciAdi(o.ogrenciId))}</strong></td>
        <td>${escapeHtml(kullaniciAdi(o.veliId))}</td>
        <td>${escapeHtml(formatAy(o.ay))}</td>
        <td>${paraFormat(o.tutar)}</td>
        <td><span class="rozet rozet--${o.durum === "odendi" ? "basari" : "uyari"}">${o.durum === "odendi" ? "Ödendi" : "Bekliyor"}</span></td>
        <td class="tablo-islem">
          <button class="btn btn--ghost btn--sm" data-cevir="${o.id}">${o.durum === "odendi" ? "Bekliyor yap" : "Ödendi yap"}</button>
          <button class="btn btn--danger btn--sm" data-sil="${o.id}">Sil</button>
        </td>
      </tr>`).join("")}</tbody>`;
  tablo.querySelectorAll("[data-cevir]").forEach((b) =>
    b.addEventListener("click", () => odemeDurumCevir(b.dataset.cevir)));
  tablo.querySelectorAll("[data-sil]").forEach((b) =>
    b.addEventListener("click", () => odemeSil(b.dataset.sil)));
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
//  ÖDEME
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
      durum: veri.durum || "bekliyor",
      tarih: serverTimestamp()
    });
    e.target.reset();
    renderOdemeSecicileri();
    toast("Ödeme kaydı eklendi.", "success");
    await hepsiniYukle();
    renderOdemeler();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

async function odemeDurumCevir(id) {
  const o = durum.odemeler.find((x) => x.id === id);
  const yeni = o.durum === "odendi" ? "bekliyor" : "odendi";
  try {
    await updateDoc(bel("odemeler", id), { durum: yeni });
    o.durum = yeni;
    renderOdemeler();
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
    "duyurular", "mesajlar", "odemeler", "fotograflar", "islemKayitlari"];
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
