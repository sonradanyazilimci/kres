// =============================================================
//  Kreş Self-Servis Kayıt (kayit.js)
//  Yeni kreş başvurusu oluşturur (durum: "onayBekliyor").
//  Sağlayıcı yonetim.html'den onaylayınca erişim açılır.
// =============================================================

import {
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, addDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import { $, toast, formData, firebaseHata } from "./utils.js";
import { onAuthReady } from "./auth.js";
import { dizinOku, superAdminMi } from "./kres.js";

const form = $("#kayitForm");

// Başvuru sürerken yeni Auth hesabı oturum açar; aşağıdaki otomatik
// yönlendirme bunu görüp kullanıcıyı panele kaçırmasın diye bayrak.
let kayitSuruyor = false;

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// Yeni hesap oluşturulduktan hemen sonra Firestore SDK oturum jetonunu
// benimseyene kadar kısa bir pencere "permission-denied" döndürebilir
// (request.auth == null). permission-denied durumunda birkaç kez yeniden dene.
async function yenidenDene(fn, kez = 5, gecikme = 500) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err?.code !== "permission-denied" || i >= kez - 1) throw err;
      await bekle(gecikme);
    }
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = formData(form);
  if (v.sifre !== v.sifre2) { toast("Şifreler eşleşmiyor.", "error"); return; }
  if (!form.querySelector("#kvkkOnay").checked) { toast("Devam etmek için sözleşmeleri onaylayın.", "warning"); return; }

  const btn = $("#kayitGonder");
  btn.disabled = true; btn.textContent = "Başvuru gönderiliyor...";
  kayitSuruyor = true;

  try {
    // 1) Auth hesabı
    let uid;
    try {
      const cred = await createUserWithEmailAndPassword(auth, v.email, v.sifre);
      uid = cred.user.uid;
      // Firestore SDK'nın oturum jetonunu önbelleğe almasını garantiye al.
      await cred.user.getIdToken();
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        throw new Error("Bu e-posta zaten kayıtlı. Var olan hesapla giriş yapın.");
      }
      throw err;
    }

    // 2) Kreş dokümanı — ONAY BEKLİYOR (erişim yok; bitisTarihi onayla belirlenir)
    const kresRef = await yenidenDene(() => addDoc(collection(db, "kresler"), {
      ad: v.kresAd,
      telefon: v.telefon || "",
      sahibiUid: uid,
      plan: "deneme",
      durum: "onayBekliyor",
      bitisTarihi: null,
      basvuruTarihi: serverTimestamp(),
      marka: { renk: "#ff8a5c" },
      kvkkOnay: { surum: "1.0", tarih: serverTimestamp(), tarayici: navigator.userAgent.slice(0, 200) },
      olusturma: serverTimestamp()
    }));

    // 3) Dizin  4) Kreş içi yönetici profili
    await yenidenDene(() => setDoc(doc(db, "kullaniciDizini", uid), { kresId: kresRef.id, rol: "admin" }));
    await yenidenDene(() => setDoc(doc(db, "kresler", kresRef.id, "users", uid), {
      uid, ad: v.ad, soyad: v.soyad, email: v.email,
      rol: "admin", telefon: v.telefon || "",
      olusturmaTarihi: serverTimestamp()
    }));

    // Onay bekleyen başvuru — oturumu kapat, kullanıcı onay sonrası girsin.
    try { await signOut(auth); } catch { /* yoksay */ }
    // kayitSuruyor'u SIFIRLAMA: gecikmeli gelen "oturum açıldı" olayı
    // aşağıdaki otomatik yönlendirmeyi tetiklemesin; başarı ekranı kalsın.
    form.replaceWith(basariEkrani(v.email));
  } catch (err) {
    // Hata: yarım kalan oturumu kapat ki panele düşmesin.
    try { await signOut(auth); } catch { /* yoksay */ }
    toast(err.message || firebaseHata(err), "error", 6000);
    btn.disabled = false; btn.textContent = "Başvuruyu Gönder";
    kayitSuruyor = false;
  }
});

function basariEkrani(email) {
  const d = document.createElement("div");
  d.className = "kutu";
  d.style.textAlign = "center";
  d.innerHTML = `
    <div style="font-size:3rem">⏳</div>
    <h2 style="margin:8px 0">Başvurunuz alındı</h2>
    <p class="soluk">
      <strong>${email}</strong> ile başvurunuz sağlayıcı onayına gönderildi.
      Onaylandığında bilgilendirileceksiniz; ardından bu e-posta ve şifrenizle
      <a href="index.html">giriş yaparak</a> kreşinizi kurmaya başlayabilirsiniz.
    </p>
    <a href="index.html" class="btn btn--primary mt-1">Ana Sayfaya Dön</a>`;
  return d;
}

// Zaten giriş yapmışsa uygun panele gönder (başvuru sürerken değil)
onAuthReady(async (user) => {
  if (!user || kayitSuruyor) return;
  if (await superAdminMi(user.uid)) { window.location.href = "yonetim.html"; return; }
  const d = await dizinOku(user.uid);
  if (d?.kresId) window.location.href = d.rol === "veli" ? "veli.html"
    : d.rol === "ogretmen" ? "ogretmen.html" : "admin.html";
});
