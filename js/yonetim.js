// =============================================================
//  Sağlayıcı (Süper-Admin) Paneli — yonetim.js
//  Tüm kreşleri ve kullanıcıları yönetir: kreş + yönetici oluşturma,
//  personel ekleme/silme, şifre sıfırlama, abonelik, kreş silme.
// =============================================================

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signOut as ikincilCikis,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, Timestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db, firebaseConfig } from "./firebase-config.js";
import { sayfaKorumasi, cikisYap } from "./auth.js";
import { kresAktifMi, onayBekliyorMu, kalanGun } from "./kres.js";
import { ALANLAR, anasayfaOku, anasayfaYaz } from "./site-icerik.js";
import {
  sistemDuyurulariniGoster, sistemDuyurulariOku,
  sistemDuyuruEkle, sistemDuyuruGuncelle, sistemDuyuruSil
} from "./sistem-duyuru.js";
import { temaBaslat } from "./tema.js";
import {
  $, el, escapeHtml, toast, tabloBos, openModal, closeModal, confirmDialog,
  formData, formatDate, formatDateTime, firebaseHata, kurCikis, paraFormat, isoDate
} from "./utils.js";

temaBaslat();
await sayfaKorumasi("superadmin");
$("#userAd").textContent = "Süper Yönetici";
kurCikis(() => cikisYap());
sistemDuyurulariniGoster();

let kresler = [];
let kullanicilar = [];        // { uid, kresId, rol, ...profil }
let odemeler = [];            // { id, kresId, tarih, tutar, yontem, not, ... }
const emailByUid = new Map();

const YONTEMLER = ["Havale / EFT", "Kredi Kartı", "Nakit", "Diğer"];
const toplamTahsilat = () => odemeler.reduce((t, o) => t + (Number(o.tutar) || 0), 0);
function sonOdeme(kresId) {
  return odemeler
    .filter((o) => o.kresId === kresId)
    .sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""))[0] || null;
}

// ---------- İkincil app ile Auth hesabı ----------
async function authHesabiOlustur(email, sifre) {
  const sec = initializeApp(firebaseConfig, "ya-" + Date.now() + Math.random().toString(36).slice(2, 5));
  const sa = getAuth(sec);
  try {
    const c = await createUserWithEmailAndPassword(sa, email, sifre);
    await ikincilCikis(sa);
    return c.user.uid;
  } finally {
    await deleteApp(sec);
  }
}
const rastgeleSifre = () => "kres" + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);

// =============================================================
//  YÜKLEME
// =============================================================
async function yukle() {
  const kSnap = await getDocs(collection(db, "kresler"));
  kresler = kSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.olusturma?.seconds || 0) - (a.olusturma?.seconds || 0));

  const dSnap = await getDocs(collection(db, "kullaniciDizini"));
  const dizin = dSnap.docs.map((d) => ({ uid: d.id, ...d.data() }));

  // her kreşin kullanıcı profilleri
  kullanicilar = [];
  emailByUid.clear();
  await Promise.all(kresler.map(async (k) => {
    const uSnap = await getDocs(collection(db, "kresler", k.id, "users"));
    uSnap.docs.forEach((u) => {
      const p = { uid: u.id, kresId: k.id, ...u.data() };
      kullanicilar.push(p);
      if (p.email) emailByUid.set(u.id, p.email);
    });
  }));
  // dizinde olup profili olmayanlar (nadir)
  dizin.forEach((d) => {
    if (!kullanicilar.some((x) => x.uid === d.uid)) {
      kullanicilar.push({ uid: d.uid, kresId: d.kresId, rol: d.rol, email: "", ad: "(profil yok)", soyad: "" });
    }
  });

  // Abonelik tahsilatları (her kreşin aboneOdemeleri alt koleksiyonu)
  odemeler = [];
  await Promise.all(kresler.map(async (k) => {
    try {
      const oSnap = await getDocs(collection(db, "kresler", k.id, "aboneOdemeleri"));
      oSnap.docs.forEach((o) => odemeler.push({ id: o.id, kresId: k.id, ...o.data() }));
    } catch { /* yoksay */ }
  }));

  render();
}

function kresAdi(id) { return kresler.find((k) => k.id === id)?.ad || "—"; }

// =============================================================
//  RENDER
// =============================================================
function render() {
  const aktif = kresler.filter((k) => kresAktifMi(k)).length;
  const bekleyen = kresler.filter((k) => onayBekliyorMu(k)).length;
  const say = (r) => kullanicilar.filter((u) => u.rol === r).length;
  const yakinda = kresler.filter((k) => { const g = kalanGun(k); return g != null && g >= 0 && g <= 14; })
    .sort((a, b) => kalanGun(a) - kalanGun(b));
  $("#ozet").innerHTML = `
    <div class="stat-izgara">
      ${statKart("🏫", kresler.length, "Kreş")}
      ${statKart("✅", aktif, "Aktif")}
      ${statKart("⏳", bekleyen, "Onay Bekleyen")}
      ${statKart("⏰", yakinda.length, "Yakında Bitecek")}
      ${statKart("💰", paraFormat(toplamTahsilat()), "Toplam Tahsilat")}
      ${statKart("👩‍🏫", say("ogretmen"), "Öğretmen")}
      ${statKart("👪", say("veli"), "Veli")}
    </div>`;

  // Yaklaşan bitişler kutusu
  const yb = $("#yaklasan-bitisler");
  if (yb) {
    yb.innerHTML = yakinda.length ? `<div class="kutu" style="border-color:var(--uyari)">
      <div class="kutu__ust"><h2>⏰ Aboneliği Yakında Bitecek Kreşler</h2></div>
      <div class="tablo-sar"><table class="veri-tablo tablo-kart">
        <thead><tr><th>Kreş</th><th>Sahibi</th><th>Kalan</th><th></th></tr></thead>
        <tbody>${yakinda.map((k) => {
          const g = kalanGun(k);
          return `<tr>
            <td data-label="Kreş"><strong>${escapeHtml(k.ad || "-")}</strong></td>
            <td data-label="Sahibi" class="soluk">${escapeHtml(emailByUid.get(k.sahibiUid) || k.sahibiUid || "-")}</td>
            <td data-label="Kalan"><span class="rozet rozet--${g <= 3 ? "hata" : "uyari"}">${g} gün</span></td>
            <td class="tablo-islem"><button class="btn btn--ghost btn--sm" data-yb-uzat="${k.id}">+30g</button></td>
          </tr>`;
        }).join("")}</tbody></table></div></div>` : "";
    yb.querySelectorAll("[data-yb-uzat]").forEach((b) =>
      b.addEventListener("click", () => sureUzat(b.dataset.ybUzat, 30)));
  }

  const t = $("#kres-tablo");
  if (!kresler.length) { tabloBos(t, "Henüz kreş yok"); return; }
  // Onay bekleyenler en üstte
  const sirali = [...kresler].sort((a, b) => (onayBekliyorMu(b) ? 1 : 0) - (onayBekliyorMu(a) ? 1 : 0));
  t.innerHTML = `
    <thead><tr><th>Kreş</th><th>Sahibi</th><th>Plan</th><th>Durum</th><th>Erişim Bitişi</th><th>Son Ödeme</th><th>İşlemler</th></tr></thead>
    <tbody>${sirali.map((k) => {
      const a = kresAktifMi(k);
      const bek = onayBekliyorMu(k);
      const kg = kalanGun(k);
      const durumRozet = bek ? "uyari" : a ? "basari" : "hata";
      const durumMetin = bek ? "Onay Bekliyor" : a ? "Aktif" : "Pasif";
      const bitisMetin = k.bitisTarihi?.toDate ? formatDate(k.bitisTarihi) + (a && kg != null ? ` (${kg}g)` : "") : "Süresiz";
      const so = sonOdeme(k.id);
      const soMetin = so ? `${paraFormat(so.tutar)} · ${escapeHtml(formatDate(so.tarih))}` : "—";
      return `<tr>
        <td data-label="Kreş"><strong>${escapeHtml(k.ad || "-")}</strong><br><span class="soluk">${escapeHtml(k.id)}</span></td>
        <td data-label="Sahibi" class="soluk">${escapeHtml(emailByUid.get(k.sahibiUid) || k.sahibiUid || "-")}</td>
        <td data-label="Plan">${escapeHtml(k.plan || "-")}</td>
        <td data-label="Durum"><span class="rozet rozet--${durumRozet}">${durumMetin}</span></td>
        <td data-label="Erişim Bitişi">${bek ? "-" : bitisMetin}</td>
        <td data-label="Son Ödeme" class="soluk">${soMetin}</td>
        <td data-label="İşlemler" class="tablo-islem">
          ${bek ? `<button class="btn btn--primary btn--sm" data-onayla="${k.id}">Onayla</button>` : ""}
          <button class="btn btn--ghost btn--sm" data-detay="${k.id}">Detay</button>
          <button class="btn btn--secondary btn--sm" data-abonelik="${k.id}">Abonelik/Süre</button>
          <button class="btn btn--ghost btn--sm" data-odeme="${k.id}">＋ Ödeme</button>
          ${!bek ? `<button class="btn btn--ghost btn--sm" data-uzat="${k.id}">+30g</button>` : ""}
          ${!bek ? `<button class="btn ${a ? "btn--danger" : "btn--primary"} btn--sm" data-durum="${k.id}">${a ? "Pasif" : "Aktif"}</button>` : ""}
          <button class="btn btn--danger btn--sm" data-sil="${k.id}">Sil</button>
        </td>
      </tr>`;
    }).join("")}</tbody>`;

  t.querySelectorAll("[data-onayla]").forEach((b) => b.addEventListener("click", () => sureModal(b.dataset.onayla, true)));
  t.querySelectorAll("[data-detay]").forEach((b) => b.addEventListener("click", () => kresDetay(b.dataset.detay)));
  t.querySelectorAll("[data-abonelik]").forEach((b) => b.addEventListener("click", () => sureModal(b.dataset.abonelik, false)));
  t.querySelectorAll("[data-odeme]").forEach((b) => b.addEventListener("click", () => odemeEkleModal(b.dataset.odeme)));
  t.querySelectorAll("[data-uzat]").forEach((b) => b.addEventListener("click", () => sureUzat(b.dataset.uzat, 30)));
  t.querySelectorAll("[data-durum]").forEach((b) => b.addEventListener("click", () => durumCevir(b.dataset.durum)));
  t.querySelectorAll("[data-sil]").forEach((b) => b.addEventListener("click", () => kresSil(b.dataset.sil)));
}
const statKart = (i, n, e) => `<div class="stat-kart"><div class="stat-kart__ikon">${i}</div>
  <div><div class="stat-kart__sayi">${n}</div><div class="stat-kart__etiket">${e}</div></div></div>`;

// =============================================================
//  YENİ KREŞ + YÖNETİCİ
// =============================================================
function yeniKresFormu() {
  const form = el("form", {},
    el("div", { class: "form-grup" }, el("label", {}, "Kreş Adı"),
      el("input", { name: "ad", required: "" })),
    el("div", { class: "form-satir" },
      el("div", { class: "form-grup" }, el("label", {}, "Telefon"), el("input", { name: "telefon", type: "tel" })),
      el("div", { class: "form-grup" }, el("label", {}, "Plan"),
        el("select", { name: "plan" },
          el("option", { value: "deneme" }, "Deneme"),
          el("option", { value: "abonelik" }, "Abonelik")))),
    el("div", { class: "form-grup" }, el("label", {}, "Süre (gün, 0 = süresiz)"),
      el("input", { name: "gun", type: "number", min: "0", value: "365" })),
    el("hr", { style: "border:none;border-top:1px solid var(--kenar);margin:14px 0" }),
    el("p", { class: "form-yardim" }, "Kreş yöneticisi (admin) hesabı:"),
    el("div", { class: "form-satir" },
      el("div", { class: "form-grup" }, el("label", {}, "Ad"), el("input", { name: "yad", required: "" })),
      el("div", { class: "form-grup" }, el("label", {}, "Soyad"), el("input", { name: "ysoyad", required: "" }))),
    el("div", { class: "form-grup" }, el("label", {}, "E-posta"),
      el("input", { name: "yemail", type: "email", required: "" })),
    el("div", { class: "form-grup" }, el("label", {}, "Şifre"),
      el("input", { name: "ysifre", type: "text", required: "", minlength: "6", value: rastgeleSifre() })),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Kreş + Yönetici Oluştur")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Oluşturuluyor...";
    const v = formData(form);
    try {
      const uid = await authHesabiOlustur(v.yemail, v.ysifre);
      const gun = Math.max(0, parseInt(v.gun, 10) || 0);
      const kresRef = await addDoc(collection(db, "kresler"), {
        ad: v.ad, telefon: v.telefon || "", sahibiUid: uid,
        plan: v.plan, durum: "aktif",
        bitisTarihi: gun === 0 ? null : Timestamp.fromMillis(Date.now() + gun * 86400000),
        marka: { renk: "#ff8a5c" },
        kvkkOnay: { surum: "1.0", tarih: serverTimestamp(), tarayici: "superadmin" },
        olusturma: serverTimestamp()
      });
      await setDoc(doc(db, "kullaniciDizini", uid), { kresId: kresRef.id, rol: "admin" });
      await setDoc(doc(db, "kresler", kresRef.id, "users", uid), {
        uid, ad: v.yad, soyad: v.ysoyad, email: v.yemail, rol: "admin",
        telefon: "", olusturmaTarihi: serverTimestamp()
      });
      try { await sendPasswordResetEmail(auth, v.yemail); } catch { /* yoksay */ }
      closeModal();
      toast(`Kreş oluşturuldu. Giriş: ${v.yemail} · Şifre: ${v.ysifre}`, "success", 9000);
      yukle();
    } catch (err) {
      toast(firebaseHata(err), "error"); btn.disabled = false; btn.textContent = "Kreş + Yönetici Oluştur";
    }
  });
  openModal("Yeni Kreş", form);
}

// =============================================================
//  KREŞ DETAYI + KULLANICI YÖNETİMİ
// =============================================================
async function kresDetay(kid) {
  const k = kresler.find((x) => x.id === kid);
  const kullList = kullanicilar.filter((u) => u.kresId === kid);
  let ogrSay = "…", sinifSay = "…";

  // Kullanım metrikleri
  const gs = kullList.map((u) => u.sonGiris?.toMillis?.() || 0).filter(Boolean);
  const sonAktivite = gs.length ? Math.max(...gs) : 0;
  const haftaOnce = Date.now() - 7 * 86400000;
  const aktif7 = gs.filter((t) => t >= haftaOnce).length;
  const rolSay = (r) => kullList.filter((u) => u.rol === r).length;

  const kap = el("div", {},
    el("div", { class: "rapor-satir" }, el("strong", {}, "Kreş"), el("span", {}, k.ad + " (" + kid + ")")),
    el("div", { class: "rapor-satir" }, el("strong", {}, "Plan / Durum"),
      el("span", {}, `${k.plan} · ${kresAktifMi(k) ? "Aktif" : "Pasif"}`)),
    el("div", { class: "rapor-satir" }, el("strong", {}, "Kullanıcılar"),
      el("span", {}, `${rolSay("admin")} yönetici · ${rolSay("ogretmen")} öğretmen · ${rolSay("veli")} veli`)),
    el("div", { class: "rapor-satir" }, el("strong", {}, "Son aktivite"),
      el("span", {}, sonAktivite ? formatDateTime(new Date(sonAktivite)) : "—")),
    el("div", { class: "rapor-satir" }, el("strong", {}, "Son 7 günde aktif"),
      el("span", {}, `${aktif7} kişi`)),
    el("div", { class: "rapor-satir" }, el("strong", {}, "Öğrenci / Sınıf"),
      el("span", { id: "detay-sayilar" }, "yükleniyor...")),
    el("div", { class: "satir-arasi mt-1" },
      el("button", { class: "btn btn--primary btn--sm", onClick: () => kullaniciEkleFormu(kid) }, "+ Kullanıcı Ekle")),
    el("div", { class: "tablo-sar mt-1" },
      el("table", { class: "veri-tablo tablo-kart", id: "detay-kull-tablo" })),
    el("div", { class: "kutu__ust mt-2", style: "margin-bottom:8px" },
      el("h3", {}, "Abonelik Ödemeleri"),
      el("button", { class: "btn btn--primary btn--sm", onClick: () => odemeEkleModal(kid) }, "＋ Ödeme")),
    el("div", { class: "tablo-sar", id: "detay-odeme-sar" })
  );
  openModal("Kreş Detayı — " + escapeHtml(k.ad), kap, { genis: true });

  const odemeSar = kap.querySelector("#detay-odeme-sar");
  const kresOdemeleri = odemeler.filter((o) => o.kresId === kid)
    .sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""));
  if (!kresOdemeleri.length) {
    odemeSar.innerHTML = `<p class="soluk" style="padding:14px">Bu kreş için ödeme kaydı yok.</p>`;
  } else {
    const toplam = kresOdemeleri.reduce((t, o) => t + (Number(o.tutar) || 0), 0);
    odemeSar.innerHTML = `<table class="veri-tablo">
      <thead><tr><th>Tarih</th><th>Tutar</th><th>Yöntem</th><th>Not</th></tr></thead>
      <tbody>${kresOdemeleri.map((o) => `<tr>
        <td>${escapeHtml(formatDate(o.tarih))}</td>
        <td><strong>${paraFormat(o.tutar)}</strong></td>
        <td>${escapeHtml(o.yontem || "—")}</td>
        <td class="soluk">${escapeHtml(o.not || "—")}${o.uzatmaGun ? ` · +${o.uzatmaGun}g` : ""}</td>
      </tr>`).join("")}
      <tr><td><strong>Toplam</strong></td><td colspan="3"><strong>${paraFormat(toplam)}</strong></td></tr>
      </tbody></table>`;
  }

  const tb = kap.querySelector("#detay-kull-tablo");
  const rozet = { admin: "mor", ogretmen: "bilgi", veli: "basari" };
  tb.innerHTML = `<thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th></th></tr></thead>
    <tbody>${kullList.sort((a, b) => (a.rol || "").localeCompare(b.rol || "")).map((u) => `
      <tr>
        <td data-label="Ad">${escapeHtml((u.ad || "") + " " + (u.soyad || ""))}</td>
        <td data-label="E-posta" class="soluk">${escapeHtml(u.email || "-")}</td>
        <td data-label="Rol"><span class="rozet rozet--${rozet[u.rol] || "bilgi"}">${escapeHtml(u.rol || "?")}</span></td>
        <td class="tablo-islem">
          <button class="btn btn--ghost btn--sm" data-sifre="${u.uid}" ${u.email ? "" : "disabled"}>Şifre sıfırla</button>
          <button class="btn btn--danger btn--sm" data-kull-sil="${u.uid}">Sil</button>
        </td>
      </tr>`).join("")}</tbody>`;
  tb.querySelectorAll("[data-sifre]").forEach((b) => b.addEventListener("click", () => sifreSifirlaKull(b.dataset.sifre)));
  tb.querySelectorAll("[data-kull-sil]").forEach((b) => b.addEventListener("click", () => kullaniciSil(kid, b.dataset.kullSil)));

  try {
    const [o, s] = await Promise.all([
      getDocs(collection(db, "kresler", kid, "ogrenciler")),
      getDocs(collection(db, "kresler", kid, "siniflar"))
    ]);
    ogrSay = o.size; sinifSay = s.size;
    const el2 = kap.querySelector("#detay-sayilar");
    if (el2) el2.textContent = `${ogrSay} öğrenci · ${sinifSay} sınıf`;
  } catch { /* yoksay */ }
}

function kullaniciEkleFormu(kid) {
  const form = el("form", {},
    el("div", { class: "form-satir" },
      el("div", { class: "form-grup" }, el("label", {}, "Ad"), el("input", { name: "ad", required: "" })),
      el("div", { class: "form-grup" }, el("label", {}, "Soyad"), el("input", { name: "soyad", required: "" }))),
    el("div", { class: "form-grup" }, el("label", {}, "E-posta"),
      el("input", { name: "email", type: "email", required: "" })),
    el("div", { class: "form-satir" },
      el("div", { class: "form-grup" }, el("label", {}, "Rol"),
        el("select", { name: "rol" },
          el("option", { value: "ogretmen" }, "Öğretmen"),
          el("option", { value: "veli" }, "Veli"),
          el("option", { value: "admin" }, "Yönetici"))),
      el("div", { class: "form-grup" }, el("label", {}, "Şifre"),
        el("input", { name: "sifre", type: "text", required: "", minlength: "6", value: rastgeleSifre() }))),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Kullanıcı Oluştur")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    const v = formData(form);
    try {
      const uid = await authHesabiOlustur(v.email, v.sifre);
      await setDoc(doc(db, "kresler", kid, "users", uid), {
        uid, ad: v.ad, soyad: v.soyad, email: v.email, rol: v.rol,
        telefon: "", olusturmaTarihi: serverTimestamp()
      });
      await setDoc(doc(db, "kullaniciDizini", uid), { kresId: kid, rol: v.rol });
      try { await sendPasswordResetEmail(auth, v.email); } catch { /* yoksay */ }
      closeModal();
      toast(`Kullanıcı oluşturuldu. ${v.email} · Şifre: ${v.sifre}`, "success", 9000);
      yukle();
    } catch (err) { toast(firebaseHata(err), "error"); btn.disabled = false; }
  });
  openModal("Kullanıcı Ekle", form);
}

async function sifreSifirlaKull(uid) {
  const email = emailByUid.get(uid);
  if (!email) { toast("E-posta bilinmiyor.", "warning"); return; }
  if (!await confirmDialog(`${email} adresine şifre belirleme e-postası gönderilsin mi?`, { onayMetni: "Gönder", tehlike: false })) return;
  try {
    await sendPasswordResetEmail(auth, email);
    toast("Şifre sıfırlama e-postası gönderildi.", "success");
  } catch (err) { toast(firebaseHata(err), "error"); }
}

async function kullaniciSil(kid, uid) {
  const email = emailByUid.get(uid) || uid;
  if (!await confirmDialog(`${email} kullanıcısının kaydı silinsin mi? (Firebase Authentication hesabı konsoldan ayrıca silinmelidir.)`)) return;
  try {
    await deleteDoc(doc(db, "kresler", kid, "users", uid));
    await deleteDoc(doc(db, "kullaniciDizini", uid));
    closeModal();
    toast("Kullanıcı kaydı silindi.", "success");
    yukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  ABONELİK / SÜRE
// =============================================================
// Plan + gün sayısı seç → durum "aktif", bitisTarihi = now + gün (0 = süresiz)
async function sureModal(id, onay) {
  const k = kresler.find((x) => x.id === id);
  const form = el("form", {},
    el("p", { class: "soluk mb-1" }, onay
      ? `"${k.ad}" başvurusunu onaylayıp erişim veriyorsunuz.`
      : `"${k.ad}" için plan ve süreyi belirleyin.`),
    el("div", { class: "form-satir" },
      el("div", { class: "form-grup" }, el("label", {}, "Plan"),
        el("select", { name: "plan" },
          el("option", { value: "deneme" }, "Deneme"),
          el("option", { value: "abonelik" }, "Abonelik"))),
      el("div", { class: "form-grup" }, el("label", {}, "Süre (gün)"),
        el("input", { name: "gun", type: "number", min: "0", value: onay ? "14" : "365" }))),
    el("p", { class: "form-yardim" }, "0 gün = süresiz erişim (bitiş tarihi yok)."),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" },
      onay ? "Onayla ve Erişim Ver" : "Uygula")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    const v = formData(form);
    const gun = Math.max(0, parseInt(v.gun, 10) || 0);
    try {
      await updateDoc(doc(db, "kresler", id), {
        plan: v.plan,
        durum: "aktif",
        bitisTarihi: gun === 0 ? null : Timestamp.fromMillis(Date.now() + gun * 86400000)
      });
      closeModal();
      toast(onay ? "Kreş onaylandı, erişim verildi." : "Güncellendi.", "success");
      yukle();
    } catch (err) { toast(firebaseHata(err), "error"); btn.disabled = false; }
  });
  openModal(onay ? "Kreşi Onayla" : "Abonelik / Süre", form);
}

// Hızlı uzatma: mevcut bitişe (yoksa şimdiye) gün ekle
async function sureUzat(id, gun) {
  const k = kresler.find((x) => x.id === id);
  const taban = Math.max(k.bitisTarihi?.toMillis?.() ?? 0, Date.now());
  try {
    await updateDoc(doc(db, "kresler", id), {
      durum: "aktif",
      bitisTarihi: Timestamp.fromMillis(taban + gun * 86400000)
    });
    toast(`Erişim ${gun} gün uzatıldı.`, "success"); yukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

async function durumCevir(id) {
  const k = kresler.find((x) => x.id === id);
  const yeni = k.durum === "aktif" ? "pasif" : "aktif";
  if (!await confirmDialog(`"${k.ad}" ${yeni === "pasif" ? "pasife alınsın" : "aktifleştirilsin"} mi?`, { onayMetni: "Evet", tehlike: yeni === "pasif" })) return;
  try {
    await updateDoc(doc(db, "kresler", id), { durum: yeni });
    toast("Durum güncellendi.", "success"); yukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  KREŞ SİL (cascade)
// =============================================================
async function kresSil(id) {
  const k = kresler.find((x) => x.id === id);
  const govde = el("div", { class: "confirm-box" },
    el("p", {}, `"${k.ad}" kreşi ve TÜM verisi kalıcı olarak silinecek. Bu işlem geri alınamaz.`),
    el("p", { class: "form-yardim" }, `Onaylamak için kreş adını yazın: `),
    el("input", { id: "silOnay", class: "", style: "width:100%;padding:10px;border:2px solid var(--kenar);border-radius:8px" }),
    el("div", { class: "confirm-box__actions" },
      el("button", { class: "btn btn--ghost", onClick: () => closeModal() }, "Vazgeç"),
      el("button", { class: "btn btn--danger", id: "silBaslat" }, "Kalıcı olarak sil"))
  );
  openModal("Kreş Sil", govde);
  govde.querySelector("#silBaslat").addEventListener("click", async () => {
    if (govde.querySelector("#silOnay").value.trim() !== (k.ad || "").trim()) {
      toast("Kreş adı eşleşmedi.", "warning"); return;
    }
    const btn = govde.querySelector("#silBaslat");
    btn.disabled = true; btn.textContent = "Siliniyor...";
    try {
      const altlar = ["users", "siniflar", "ogrenciler", "yoklamalar", "gunlukRaporlar",
        "duyurular", "duyuruOkundu", "mesajlar", "odemeler", "fotograflar",
        "aboneOdemeleri", "talepler", "izinBelgeleri", "gozlemler", "menuler", "programlar",
        "bildirimler", "devamsizlikBildirimleri", "islemKayitlari"];
      for (const alt of altlar) {
        const snap = await getDocs(collection(db, "kresler", id, alt));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const b = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
          await b.commit();
        }
      }
      // dizin kayıtları
      const dizinSil = kullanicilar.filter((u) => u.kresId === id);
      for (const u of dizinSil) await deleteDoc(doc(db, "kullaniciDizini", u.uid));
      await deleteDoc(doc(db, "kresler", id));
      closeModal();
      toast("Kreş ve tüm verisi silindi. (Auth hesapları konsoldan temizlenmeli.)", "success", 8000);
      yukle();
    } catch (err) { toast(firebaseHata(err), "error"); btn.disabled = false; btn.textContent = "Kalıcı olarak sil"; }
  });
}

// =============================================================
//  SÜPER-ADMIN EKLE
// =============================================================
async function superAdminEkle() {
  const form = el("form", {},
    el("p", { class: "form-yardim" }, "Eklenecek kişinin Firebase Auth UID'sini girin (Authentication → Users)."),
    el("div", { class: "form-grup" }, el("label", {}, "UID"), el("input", { name: "uid", required: "" })),
    el("div", { class: "form-grup" }, el("label", {}, "Not"), el("input", { name: "not", value: "" })),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Süper-admin Yap")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = formData(form);
    try {
      await setDoc(doc(db, "superAdmins", v.uid.trim()), { not: v.not || "", eklendi: serverTimestamp() });
      closeModal();
      toast("Süper-admin eklendi.", "success");
    } catch (err) { toast(firebaseHata(err), "error"); }
  });
  openModal("Süper-admin Ekle", form);
}

// =============================================================
//  ABONELİK TAHSİLAT DEFTERİ
// =============================================================
async function odemeEkleModal(kid) {
  const k = kresler.find((x) => x.id === kid);
  if (!k) return;
  const form = el("form", {},
    el("p", { class: "soluk mb-1" }, `"${k.ad}" için abonelik ödemesi kaydı.`),
    el("div", { class: "form-satir" },
      el("div", { class: "form-grup" }, el("label", {}, "Tarih"),
        el("input", { name: "tarih", type: "date", required: "", value: isoDate() })),
      el("div", { class: "form-grup" }, el("label", {}, "Tutar (₺)"),
        el("input", { name: "tutar", type: "number", min: "0", step: "0.01", required: "" }))),
    el("div", { class: "form-satir" },
      el("div", { class: "form-grup" }, el("label", {}, "Yöntem"),
        el("select", { name: "yontem" }, ...YONTEMLER.map((y) => el("option", { value: y }, y)))),
      el("div", { class: "form-grup" }, el("label", {}, "Aboneliği uzat (gün, 0 = uzatma)"),
        el("input", { name: "uzat", type: "number", min: "0", value: "0" }))),
    el("div", { class: "form-grup" }, el("label", {}, "Not"),
      el("input", { name: "not", placeholder: "Örn: Ağustos ayı aboneliği" })),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Ödemeyi Kaydet")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    const v = formData(form);
    const uzat = Math.max(0, parseInt(v.uzat, 10) || 0);
    try {
      await addDoc(collection(db, "kresler", kid, "aboneOdemeleri"), {
        tarih: v.tarih || isoDate(),
        tutar: Number(v.tutar) || 0,
        yontem: v.yontem || "Diğer",
        not: v.not || "",
        uzatmaGun: uzat,
        kaydeden: auth.currentUser?.uid || "",
        olusturma: serverTimestamp()
      });
      if (uzat > 0) {
        const taban = Math.max(k.bitisTarihi?.toMillis?.() ?? 0, Date.now());
        await updateDoc(doc(db, "kresler", kid), {
          durum: "aktif",
          bitisTarihi: Timestamp.fromMillis(taban + uzat * 86400000)
        });
      }
      closeModal();
      toast(uzat > 0 ? `Ödeme kaydedildi, erişim ${uzat} gün uzatıldı.` : "Ödeme kaydedildi.", "success");
      yukle();
    } catch (err) {
      toast(firebaseHata(err), "error"); btn.disabled = false; btn.textContent = "Ödemeyi Kaydet";
    }
  });
  openModal("Ödeme Ekle — " + escapeHtml(k.ad), form);
}

function odemelerModal() {
  const liste = [...odemeler].sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""));
  const kap = el("div", {},
    el("div", { class: "stat-izgara mb-2", style: "grid-template-columns:repeat(auto-fit,minmax(150px,1fr))" },
      el("div", { class: "stat-kart" }, el("div", { class: "stat-kart__ikon" }, "💰"),
        el("div", {}, el("div", { class: "stat-kart__sayi" }, paraFormat(toplamTahsilat())),
          el("div", { class: "stat-kart__etiket" }, "Toplam Tahsilat"))),
      el("div", { class: "stat-kart" }, el("div", { class: "stat-kart__ikon" }, "🧾"),
        el("div", {}, el("div", { class: "stat-kart__sayi" }, String(odemeler.length)),
          el("div", { class: "stat-kart__etiket" }, "Kayıt")))
    ),
    el("div", { class: "tablo-sar" }, el("table", { class: "veri-tablo kres-mobil", id: "odemeler-tablo" }))
  );
  openModal("Abonelik Ödemeleri", kap, { genis: true });
  const tb = kap.querySelector("#odemeler-tablo");
  if (!liste.length) { tabloBos(tb, "Henüz ödeme kaydı yok"); return; }
  tb.innerHTML = `<thead><tr><th>Tarih</th><th>Kreş</th><th>Tutar</th><th>Yöntem</th><th>Not</th></tr></thead>
    <tbody>${liste.map((o) => `<tr>
      <td data-label="Tarih">${escapeHtml(formatDate(o.tarih))}</td>
      <td data-label="Kreş">${escapeHtml(kresAdi(o.kresId))}</td>
      <td data-label="Tutar"><strong>${paraFormat(o.tutar)}</strong></td>
      <td data-label="Yöntem">${escapeHtml(o.yontem || "—")}</td>
      <td data-label="Not" class="soluk">${escapeHtml(o.not || "—")}${o.uzatmaGun ? ` · +${o.uzatmaGun}g` : ""}</td>
    </tr>`).join("")}</tbody>`;
}

// =============================================================
//  ANASAYFA İÇERİĞİ
// =============================================================
async function anasayfaModal() {
  const v = await anasayfaOku();
  const form = el("form", { class: "anasayfa-form" },
    el("p", { class: "soluk mb-1" }, "Bu metinler index.html anasayfasında görünür. Boş bırakılan alanlar varsayılana döner."),
    ...ALANLAR.map(({ k, e, cok }) =>
      el("div", { class: "form-grup" },
        el("label", {}, e),
        cok
          ? el("textarea", { name: k, rows: "2" }, v[k] || "")
          : el("input", { name: k, value: v[k] || "" })
      )
    ),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Kaydet")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    try {
      await anasayfaYaz(formData(form));
      closeModal();
      toast("Anasayfa içeriği güncellendi.", "success");
    } catch (err) {
      toast(firebaseHata(err), "error"); btn.disabled = false; btn.textContent = "Kaydet";
    }
  });
  openModal("Anasayfa İçeriği", form, { genis: true });
}

// =============================================================
//  SİSTEM DUYURUSU (tüm kreşlere)
// =============================================================
async function sistemDuyuruModal() {
  const mevcut = await sistemDuyurulariOku();
  const form = el("form", {},
    el("div", { class: "form-grup" }, el("label", {}, "Başlık"),
      el("input", { name: "baslik", required: "" })),
    el("div", { class: "form-grup" }, el("label", {}, "Metin"),
      el("input", { name: "metin", placeholder: "Kısa açıklama" })),
    el("div", { class: "form-grup" }, el("label", {}, "Seviye"),
      el("select", { name: "seviye" },
        el("option", { value: "bilgi" }, "Bilgi"),
        el("option", { value: "uyari" }, "Uyarı"),
        el("option", { value: "onemli" }, "Önemli"))),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Yayınla")
  );
  const liste = el("div", { class: "mt-2", id: "sd-liste" });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = formData(form);
    try {
      await sistemDuyuruEkle(v);
      form.reset();
      toast("Sistem duyurusu yayınlandı.", "success");
      sistemDuyuruListe(liste);
    } catch (err) { toast(firebaseHata(err), "error"); }
  });
  openModal("Sistem Duyurusu", el("div", {}, form,
    el("div", { class: "kutu__ust mt-2", style: "margin-bottom:6px" }, el("h3", {}, "Yayınlananlar")),
    liste), { genis: true });
  sistemDuyuruListe(liste, mevcut);
}

async function sistemDuyuruListe(kap, hazir) {
  const liste = hazir || await sistemDuyurulariOku();
  if (!liste.length) { kap.innerHTML = `<p class="soluk">Duyuru yok.</p>`; return; }
  kap.innerHTML = "";
  liste.forEach((d) => {
    kap.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, `${d.baslik}`),
        el("span", { class: "liste-oge__tarih" }, formatDateTime(d.tarih))),
      d.metin ? el("p", {}, d.metin) : null,
      el("div", { class: "satir-arasi mt-1" },
        el("span", { class: `rozet rozet--${d.seviye === "onemli" ? "hata" : d.seviye === "uyari" ? "uyari" : "bilgi"}` }, d.seviye || "bilgi"),
        el("span", { class: `rozet ${d.aktif ? "rozet--basari" : ""}` }, d.aktif ? "Aktif" : "Pasif"),
        el("button", { class: "btn btn--ghost btn--sm", onClick: async () => { await sistemDuyuruGuncelle(d.id, { aktif: !d.aktif }); sistemDuyuruListe(kap); } },
          d.aktif ? "Pasife al" : "Aktifleştir"),
        el("button", { class: "btn btn--danger btn--sm", onClick: async () => { if (await confirmDialog("Silinsin mi?")) { await sistemDuyuruSil(d.id); sistemDuyuruListe(kap); } } }, "Sil"))
    ));
  });
}

// ---------- bağla ----------
$("#yeniKresBtn").addEventListener("click", yeniKresFormu);
$("#superAdminBtn").addEventListener("click", superAdminEkle);
$("#odemelerBtn").addEventListener("click", odemelerModal);
$("#anasayfaBtn").addEventListener("click", anasayfaModal);
$("#sistemDuyuruBtn").addEventListener("click", sistemDuyuruModal);

await yukle();
