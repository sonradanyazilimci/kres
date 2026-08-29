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
import {
  $, el, escapeHtml, toast, tabloBos, openModal, closeModal, confirmDialog,
  formData, formatDate, firebaseHata, kurCikis
} from "./utils.js";

await sayfaKorumasi("superadmin");
$("#userAd").textContent = "Süper Yönetici";
kurCikis(() => cikisYap());

let kresler = [];
let kullanicilar = [];        // { uid, kresId, rol, ...profil }
const emailByUid = new Map();

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
  $("#ozet").innerHTML = `
    <div class="stat-izgara">
      ${statKart("🏫", kresler.length, "Kreş")}
      ${statKart("✅", aktif, "Aktif")}
      ${statKart("⏳", bekleyen, "Onay Bekleyen")}
      ${statKart("⏸️", kresler.length - aktif - bekleyen, "Pasif")}
      ${statKart("🧑‍💼", say("admin"), "Yönetici")}
      ${statKart("👩‍🏫", say("ogretmen"), "Öğretmen")}
      ${statKart("👪", say("veli"), "Veli")}
    </div>`;

  const t = $("#kres-tablo");
  if (!kresler.length) { tabloBos(t, "Henüz kreş yok"); return; }
  // Onay bekleyenler en üstte
  const sirali = [...kresler].sort((a, b) => (onayBekliyorMu(b) ? 1 : 0) - (onayBekliyorMu(a) ? 1 : 0));
  t.innerHTML = `
    <thead><tr><th>Kreş</th><th>Sahibi</th><th>Plan</th><th>Durum</th><th>Erişim Bitişi</th><th>İşlemler</th></tr></thead>
    <tbody>${sirali.map((k) => {
      const a = kresAktifMi(k);
      const bek = onayBekliyorMu(k);
      const kg = kalanGun(k);
      const durumRozet = bek ? "uyari" : a ? "basari" : "hata";
      const durumMetin = bek ? "Onay Bekliyor" : a ? "Aktif" : "Pasif";
      const bitisMetin = k.bitisTarihi?.toDate ? formatDate(k.bitisTarihi) + (a && kg != null ? ` (${kg}g)` : "") : "Süresiz";
      return `<tr>
        <td><strong>${escapeHtml(k.ad || "-")}</strong><br><span class="soluk">${escapeHtml(k.id)}</span></td>
        <td class="soluk">${escapeHtml(emailByUid.get(k.sahibiUid) || k.sahibiUid || "-")}</td>
        <td>${escapeHtml(k.plan || "-")}</td>
        <td><span class="rozet rozet--${durumRozet}">${durumMetin}</span></td>
        <td>${bek ? "-" : bitisMetin}</td>
        <td class="tablo-islem">
          ${bek ? `<button class="btn btn--primary btn--sm" data-onayla="${k.id}">Onayla</button>` : ""}
          <button class="btn btn--ghost btn--sm" data-detay="${k.id}">Detay</button>
          <button class="btn btn--secondary btn--sm" data-abonelik="${k.id}">Abonelik/Süre</button>
          ${!bek ? `<button class="btn btn--ghost btn--sm" data-uzat="${k.id}">+30g</button>` : ""}
          ${!bek ? `<button class="btn ${a ? "btn--danger" : "btn--primary"} btn--sm" data-durum="${k.id}">${a ? "Pasif" : "Aktif"}</button>` : ""}
          <button class="btn btn--danger btn--sm" data-sil="${k.id}">Sil</button>
        </td>
      </tr>`;
    }).join("")}</tbody>`;

  t.querySelectorAll("[data-onayla]").forEach((b) => b.addEventListener("click", () => sureModal(b.dataset.onayla, true)));
  t.querySelectorAll("[data-detay]").forEach((b) => b.addEventListener("click", () => kresDetay(b.dataset.detay)));
  t.querySelectorAll("[data-abonelik]").forEach((b) => b.addEventListener("click", () => sureModal(b.dataset.abonelik, false)));
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

  const kap = el("div", {},
    el("div", { class: "rapor-satir" }, el("strong", {}, "Kreş"), el("span", {}, k.ad + " (" + kid + ")")),
    el("div", { class: "rapor-satir" }, el("strong", {}, "Plan / Durum"),
      el("span", {}, `${k.plan} · ${kresAktifMi(k) ? "Aktif" : "Pasif"}`)),
    el("div", { class: "rapor-satir" }, el("strong", {}, "Öğrenci / Sınıf"),
      el("span", { id: "detay-sayilar" }, "yükleniyor...")),
    el("div", { class: "satir-arasi mt-1" },
      el("button", { class: "btn btn--primary btn--sm", onClick: () => kullaniciEkleFormu(kid) }, "+ Kullanıcı Ekle")),
    el("div", { class: "tablo-sar mt-1" },
      el("table", { class: "veri-tablo", id: "detay-kull-tablo" }))
  );
  openModal("Kreş Detayı — " + escapeHtml(k.ad), kap, { genis: true });

  const tb = kap.querySelector("#detay-kull-tablo");
  const rozet = { admin: "mor", ogretmen: "bilgi", veli: "basari" };
  tb.innerHTML = `<thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th></th></tr></thead>
    <tbody>${kullList.sort((a, b) => (a.rol || "").localeCompare(b.rol || "")).map((u) => `
      <tr>
        <td>${escapeHtml((u.ad || "") + " " + (u.soyad || ""))}</td>
        <td class="soluk">${escapeHtml(u.email || "-")}</td>
        <td><span class="rozet rozet--${rozet[u.rol] || "bilgi"}">${escapeHtml(u.rol || "?")}</span></td>
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
        "duyurular", "duyuruOkundu", "mesajlar", "odemeler", "fotograflar", "islemKayitlari"];
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

// ---------- bağla ----------
$("#yeniKresBtn").addEventListener("click", yeniKresFormu);
$("#superAdminBtn").addEventListener("click", superAdminEkle);

await yukle();
