// =============================================================
//  Kurulum Sihirbazı (kurulum.js)
//  Yalnızca ilk kurulum için: bağlantı testi, ilk yönetici,
//  Google Drive servis testi ve örnek veri.
//  Kurulum bittikten sonra kurulum.html dosyasını silin.
// =============================================================

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, setDoc, addDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  firebaseConfig, DRIVE_UPLOAD_URL, DRIVE_UPLOAD_SIR, auth, db
} from "./firebase-config.js";
import { driveYukle } from "./drive-upload.js";
import { $, el, toast, firebaseHata } from "./utils.js";

const yerTutucu = (v) => !v || String(v).includes("BURAYA");

// =============================================================
//  ADIM 1 — Yapılandırma kontrolü
// =============================================================
function konfigKontrol() {
  const alanlar = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"];
  const liste = $("#konfig-liste");
  liste.innerHTML = "";
  let eksik = 0;
  alanlar.forEach((k) => {
    const dolu = !yerTutucu(firebaseConfig[k]);
    if (!dolu) eksik++;
    liste.appendChild(el("li", { class: "kontrol-satir" },
      el("span", { class: `nokta ${dolu ? "nokta--ok" : "nokta--yok"}` }, dolu ? "✓" : "✕"),
      el("code", {}, `firebaseConfig.${k}`),
      el("span", { class: "soluk" }, dolu ? "tanımlı" : "EKSİK — firebase-config.js")
    ));
  });
  const driveOk = !yerTutucu(DRIVE_UPLOAD_URL);
  liste.appendChild(el("li", { class: "kontrol-satir" },
    el("span", { class: `nokta ${driveOk ? "nokta--ok" : "nokta--yok"}` }, driveOk ? "✓" : "✕"),
    el("code", {}, "DRIVE_UPLOAD_URL"),
    el("span", { class: "soluk" }, driveOk ? "tanımlı" : "EKSİK — firebase-config.js (Adım 3'te alınır)")
  ));

  $("#konfig-ozet").textContent = eksik
    ? `${eksik} Firebase alanı eksik. Devam etmeden önce js/firebase-config.js dosyasını doldurun.`
    : "Firebase alanları dolu görünüyor. Bağlantıyı test edebilirsiniz.";
  $("#konfig-ozet").className = eksik ? "uyari-kutu" : "basari-kutu";
}

async function baglantiTest() {
  const btn = $("#baglantiTestBtn");
  btn.disabled = true; btn.textContent = "Test ediliyor...";
  try {
    await getDocs(collection(db, "users"));
    sonucYaz("#baglanti-sonuc", "basari", "Bağlantı ve Firestore okuma başarılı. (Kurallar henüz açık.)");
  } catch (e) {
    if (e?.code === "permission-denied") {
      sonucYaz("#baglanti-sonuc", "basari", "Firebase'e bağlanıldı. Firestore kuralları aktif — bu beklenen bir durum.");
    } else {
      sonucYaz("#baglanti-sonuc", "hata", "Bağlantı hatası: " + firebaseHata(e) +
        "  · firebase-config.js değerlerini ve projede Firestore'un etkin olduğunu kontrol edin.");
    }
  }
  btn.disabled = false; btn.textContent = "Bağlantıyı test et";
}

// =============================================================
//  ADIM 2 — İlk yönetici
// =============================================================
async function yoneticiOlustur(e) {
  e.preventDefault();
  const f = e.target;
  const veri = {
    ad: f.ad.value.trim(),
    soyad: f.soyad.value.trim(),
    email: f.email.value.trim(),
    sifre: f.sifre.value,
    telefon: f.telefon.value.trim()
  };
  const btn = f.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Oluşturuluyor...";
  try {
    let uid;
    try {
      const cred = await createUserWithEmailAndPassword(auth, veri.email, veri.sifre);
      uid = cred.user.uid;
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        const cred = await signInWithEmailAndPassword(auth, veri.email, veri.sifre);
        uid = cred.user.uid;
      } else {
        throw err;
      }
    }
    await setDoc(doc(db, "users", uid), {
      uid, ad: veri.ad, soyad: veri.soyad, email: veri.email,
      rol: "admin", telefon: veri.telefon || "",
      olusturmaTarihi: serverTimestamp()
    });
    sonucYaz("#yonetici-sonuc", "basari",
      `Yönetici hazır. UID: ${uid} — Artık "kres" projesinde Firestore kurallarını yayınlayabilirsiniz.`);
    $("#panelLinkler").hidden = false;
  } catch (err) {
    sonucYaz("#yonetici-sonuc", "hata", firebaseHata(err) +
      "  · Firestore hâlâ ‘test modunda’ mı? Kuralları yayınladıysanız bu adım artık konsoldan yapılmalıdır.");
  }
  btn.disabled = false; btn.textContent = "Yöneticiyi oluştur";
}

// =============================================================
//  ADIM 3 — Google Drive servis testi
// =============================================================
async function driveGetTest() {
  const url = $("#driveUrl").value.trim();
  if (!url) { toast("Önce Apps Script /exec adresini girin.", "warning"); return; }
  const btn = $("#driveGetBtn");
  btn.disabled = true; btn.textContent = "Kontrol ediliyor...";
  try {
    const r = await fetch(url, { method: "GET" });
    const j = await r.json();
    if (j.ok) sonucYaz("#drive-sonuc", "basari", "Servis çalışıyor: " + (j.mesaj || "OK") +
      "  · Bu adresi firebase-config.js > DRIVE_UPLOAD_URL alanına yazın.");
    else sonucYaz("#drive-sonuc", "hata", "Beklenmeyen yanıt: " + JSON.stringify(j));
  } catch (err) {
    sonucYaz("#drive-sonuc", "hata",
      "Adrese ulaşılamadı. Dağıtımın ‘Web uygulaması’ ve erişimin ‘Herkes’ olduğundan, adresin /exec ile bittiğinden emin olun.");
  }
  btn.disabled = false; btn.textContent = "Servisi test et (GET)";
}

async function driveYuklemeTest(e) {
  e.preventDefault();
  const dosya = $("#driveDosya").files[0];
  if (!dosya) { toast("Bir görsel seçin.", "warning"); return; }
  if (yerTutucu(DRIVE_UPLOAD_URL)) {
    sonucYaz("#drive-yukleme-sonuc", "hata",
      "firebase-config.js > DRIVE_UPLOAD_URL hâlâ boş. Doldurup sayfayı yenileyin.");
    return;
  }
  const btn = $("#driveYuklemeBtn");
  btn.disabled = true; btn.textContent = "Yükleniyor...";
  try {
    const sonuc = await driveYukle(dosya, { klasor: "kurulum-testi" });
    const kap = $("#drive-yukleme-sonuc");
    kap.hidden = false;
    kap.className = "basari-kutu";
    kap.innerHTML = "";
    kap.append(
      el("p", {}, "Yükleme başarılı. Görsel Drive'da ‘Küçük Adımlar Kreş Fotoğrafları/kurulum-testi’ klasöründe."),
      el("img", { src: sonuc.goruntuUrl, alt: "Test", style: "max-width:220px;border-radius:12px;margin-top:8px" }),
      el("p", { class: "soluk mt-1" }, sonuc.webViewLink)
    );
  } catch (err) {
    sonucYaz("#drive-yukleme-sonuc", "hata", err.message || String(err));
  }
  btn.disabled = false; btn.textContent = "Test fotoğrafı yükle";
}

// =============================================================
//  ADIM 4 — Örnek veri (isteğe bağlı)
// =============================================================
async function ikincilAuthHesabi(email, sifre) {
  const ikincil = initializeApp(firebaseConfig, "kurulum-ikincil-" + Date.now());
  const ikincilAuth = getAuth(ikincil);
  try {
    const cred = await createUserWithEmailAndPassword(ikincilAuth, email, sifre);
    await signOut(ikincilAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(ikincil);
  }
}

async function ornekVeri() {
  const btn = $("#ornekBtn");
  btn.disabled = true; btn.textContent = "Oluşturuluyor...";
  try {
    const sifre = "ornek123";
    const dmg = Date.now().toString().slice(-5);

    // --- 2 öğretmen ---
    const ogrTanim = [{ ad: "Ayşe", soyad: "Demir" }, { ad: "Fatma", soyad: "Kaya" }];
    const ogr = [];
    for (let i = 0; i < ogrTanim.length; i++) {
      const email = `ogretmen${i + 1}.${dmg}@ornek.com`;
      const uid = await ikincilAuthHesabi(email, sifre);
      await setDoc(doc(db, "users", uid), {
        uid, ad: ogrTanim[i].ad, soyad: ogrTanim[i].soyad, email,
        rol: "ogretmen", telefon: "", olusturmaTarihi: serverTimestamp()
      });
      ogr.push({ uid, email });
    }

    // --- 2 sınıf ---
    const s1 = await addDoc(collection(db, "siniflar"),
      { ad: "Papatyalar", yasGrubu: "2-3 Yaş", ogretmenId: ogr[0].uid, kapasite: 12 });
    const s2 = await addDoc(collection(db, "siniflar"),
      { ad: "Kelebekler", yasGrubu: "3-4 Yaş", ogretmenId: ogr[1].uid, kapasite: 15 });
    const sinifIds = [s1.id, s2.id];

    // --- 4 veli ---
    const velTanim = [
      { ad: "Mehmet", soyad: "Yılmaz" }, { ad: "Zeynep", soyad: "Şahin" },
      { ad: "Ali", soyad: "Çelik" }, { ad: "Elif", soyad: "Aydın" }
    ];
    const vel = [];
    for (let i = 0; i < velTanim.length; i++) {
      const email = `veli${i + 1}.${dmg}@ornek.com`;
      const uid = await ikincilAuthHesabi(email, sifre);
      await setDoc(doc(db, "users", uid), {
        uid, ad: velTanim[i].ad, soyad: velTanim[i].soyad, email,
        rol: "veli", telefon: "", olusturmaTarihi: serverTimestamp()
      });
      vel.push({ uid, email });
    }

    // --- 4 öğrenci (sınıf başına 2, her biri bir veliye bağlı) ---
    const ogrenciTanim = [
      { ad: "Deniz", soyad: "Yılmaz", s: 0, v: 0, d: "2022-03-14" },
      { ad: "Ada", soyad: "Şahin", s: 0, v: 1, d: "2022-07-02" },
      { ad: "Kaan", soyad: "Çelik", s: 1, v: 2, d: "2021-05-20" },
      { ad: "Mira", soyad: "Aydın", s: 1, v: 3, d: "2021-11-09" }
    ];
    for (const o of ogrenciTanim) {
      await addDoc(collection(db, "ogrenciler"), {
        ad: o.ad, soyad: o.soyad, dogumTarihi: o.d,
        sinifId: sinifIds[o.s], veliIds: [vel[o.v].uid],
        fotoUrl: "", fotoDriveId: null, alerjiler: "", notlar: "Örnek kayıt."
      });
    }

    const bilgi = [
      ...ogr.map((x, i) => `Öğretmen${i + 1}: ${x.email}`),
      ...vel.map((x, i) => `Veli${i + 1}: ${x.email}`)
    ].join(" · ");
    sonucYaz("#ornek-sonuc", "basari",
      `Örnek veri eklendi: 2 sınıf, 2 öğretmen, 4 veli, 4 öğrenci. Ortak şifre: ${sifre}  ·  ${bilgi}`);
  } catch (err) {
    sonucYaz("#ornek-sonuc", "hata", firebaseHata(err) +
      "  · Bu adım için Firestore ‘test modunda’ olmalı ya da kurallar henüz yayınlanmamış olmalı.");
  }
  btn.disabled = false; btn.textContent = "Örnek veri oluştur";
}

// =============================================================
//  Yardımcı + bağlama
// =============================================================
function sonucYaz(sel, tur, mesaj) {
  const kap = $(sel);
  kap.hidden = false;
  kap.className = tur === "basari" ? "basari-kutu" : tur === "hata" ? "hata-kutu" : "uyari-kutu";
  kap.textContent = mesaj;
}

konfigKontrol();
$("#driveUrl").value = yerTutucu(DRIVE_UPLOAD_URL) ? "" : DRIVE_UPLOAD_URL;
$("#baglantiTestBtn").addEventListener("click", baglantiTest);
$("#yoneticiForm").addEventListener("submit", yoneticiOlustur);
$("#driveGetBtn").addEventListener("click", driveGetTest);
$("#driveYuklemeForm").addEventListener("submit", driveYuklemeTest);
$("#ornekBtn").addEventListener("click", ornekVeri);

onAuthStateChanged(auth, (u) => {
  $("#oturum-durum").textContent = u
    ? `Bu sayfada oturum açık: ${u.email}`
    : "Bu sayfada oturum kapalı.";
  if (u) $("#panelLinkler").hidden = false;
});
