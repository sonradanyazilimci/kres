// =============================================================
//  Kreş Self-Servis Kayıt (kayit.js)
//  Yeni kreş açar, 14 günlük deneme başlatır, sahibini yönetici yapar.
// =============================================================

import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, addDoc, setDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import { DENEME_GUN } from "./kres.js";
import { $, toast, formData, firebaseHata } from "./utils.js";

const form = $("#kayitForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = formData(form);
  if (v.sifre !== v.sifre2) { toast("Şifreler eşleşmiyor.", "error"); return; }
  if (!form.querySelector("#kvkkOnay").checked) { toast("Devam etmek için sözleşmeleri onaylayın.", "warning"); return; }

  const btn = $("#kayitGonder");
  btn.disabled = true; btn.textContent = "Kreş oluşturuluyor...";

  try {
    // 1) Auth hesabı
    let uid;
    try {
      const cred = await createUserWithEmailAndPassword(auth, v.email, v.sifre);
      uid = cred.user.uid;
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        throw new Error("Bu e-posta zaten kayıtlı. Var olan hesapla giriş yapın.");
      }
      throw err;
    }

    // 2) Kreş dokümanı (deneme)
    const bitis = Timestamp.fromMillis(Date.now() + DENEME_GUN * 86400000);
    const kresRef = await addDoc(collection(db, "kresler"), {
      ad: v.kresAd,
      telefon: v.telefon || "",
      sahibiUid: uid,
      plan: "deneme",
      durum: "aktif",
      denemeBaslangic: serverTimestamp(),
      denemeBitis: bitis,
      marka: { renk: "#ff8a5c" },
      kvkkOnay: { surum: "1.0", tarih: serverTimestamp(), tarayici: navigator.userAgent.slice(0, 200) },
      olusturma: serverTimestamp()
    });

    // 3) Dizin kaydı  4) Kreş içi yönetici profili
    await setDoc(doc(db, "kullaniciDizini", uid), { kresId: kresRef.id, rol: "admin" });
    await setDoc(doc(db, "kresler", kresRef.id, "users", uid), {
      uid, ad: v.ad, soyad: v.soyad, email: v.email,
      rol: "admin", telefon: v.telefon || "",
      olusturmaTarihi: serverTimestamp()
    });

    toast("Kreşiniz oluşturuldu! Yönlendiriliyorsunuz...", "success");
    setTimeout(() => (window.location.href = "admin.html"), 800);
  } catch (err) {
    toast(err.message || firebaseHata(err), "error", 6000);
    btn.disabled = false; btn.textContent = "Ücretsiz Başla";
  }
});

// Zaten giriş yapmışsa panele gönder
import { onAuthReady } from "./auth.js";
import { dizinOku, superAdminMi } from "./kres.js";
onAuthReady(async (user) => {
  if (!user) return;
  if (await superAdminMi(user.uid)) { window.location.href = "yonetim.html"; return; }
  const d = await dizinOku(user.uid);
  if (d?.kresId) window.location.href = d.rol === "veli" ? "veli.html"
    : d.rol === "ogretmen" ? "ogretmen.html" : "admin.html";
});
