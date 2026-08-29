// =============================================================
//  Kimlik Doğrulama + Kiracı Yönlendirme (auth.js)
//  Çok-kiracılı: giriş sonrası /kullaniciDizini/{uid} -> kresId + rol
//  okunur, kreş bağlamı kurulur, role göre panele yönlendirilir.
// =============================================================

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import { firebaseHata } from "./utils.js";
import { dizinOku, superAdminMi, kresBaglamiKur, kresAktifMi } from "./kres.js";

let _baglamCache = null;

export const PANEL = {
  admin: "admin.html",
  ogretmen: "ogretmen.html",
  veli: "veli.html",
  superadmin: "yonetim.html"
};

export function hedefSayfa(rol) {
  return PANEL[rol] || "index.html";
}

// ---------- Oturum durumu ----------
export function onAuthReady(callback) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) _baglamCache = null;
    callback(user);
  });
}

// ---------- Oturumdaki kullanıcının bağlamını çöz ----------
// { uid, rol, kresId, kres, aktif, profil }  (superadmin için kresId=null)
export async function oturumBaglami(user, taze = false) {
  if (!user) return null;
  if (!taze && _baglamCache && _baglamCache.uid === user.uid) return _baglamCache;

  // Önce süper-admin mi?
  if (await superAdminMi(user.uid)) {
    _baglamCache = { uid: user.uid, rol: "superadmin", kresId: null, kres: null, aktif: true, profil: null };
    return _baglamCache;
  }

  const dizin = await dizinOku(user.uid);
  if (!dizin || !dizin.kresId) return null; // hiçbir kreşe bağlı değil

  const kres = await kresBaglamiKur(dizin.kresId);
  const pRef = doc(db, "kresler", dizin.kresId, "users", user.uid);
  const pSnap = await getDoc(pRef);
  _baglamCache = {
    uid: user.uid,
    rol: dizin.rol,
    kresId: dizin.kresId,
    kres,
    aktif: kresAktifMi(kres),
    profil: pSnap.exists() ? { uid: user.uid, ...pSnap.data() } : null
  };
  // Son giriş zamanını kaydet (kullanım metrikleri; rol değişmediği için kural izin verir)
  if (pSnap.exists() && kresAktifMi(kres)) {
    updateDoc(pRef, { sonGiris: serverTimestamp() }).catch(() => { /* yoksay */ });
  }
  return _baglamCache;
}

// ---------- Giriş ----------
export async function girisYap(email, sifre) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, sifre);
    const b = await oturumBaglami(cred.user, true);
    if (!b) {
      await signOut(auth);
      throw new Error("Hesabınız bir kreşe bağlı değil. Yöneticinize ya da destek ekibine başvurun.");
    }
    return b;
  } catch (err) {
    throw new Error(firebaseHata(err));
  }
}

// ---------- Şifre sıfırlama e-postası ----------
export async function sifreSifirla(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    throw new Error(firebaseHata(err));
  }
}

// ---------- Çıkış ----------
export async function cikisYap(yonlendir = "index.html") {
  _baglamCache = null;
  await signOut(auth);
  if (yonlendir) window.location.href = yonlendir;
}

// ---------- Sayfa koruması ----------
// izinliRoller: "admin" | ["admin","ogretmen"] | "superadmin"
// Çözüldüğünde oturum bağlamını döndürür. Yanlış rol -> kendi paneline atar.
export function sayfaKorumasi(izinliRoller) {
  const izinli = Array.isArray(izinliRoller) ? izinliRoller : [izinliRoller];
  return new Promise((resolve) => {
    onAuthReady(async (user) => {
      if (!user) { window.location.replace("index.html"); return; }
      let b;
      try {
        b = await oturumBaglami(user, true);
      } catch {
        b = null;
      }
      if (!b) { window.location.replace("index.html"); return; }
      if (!izinli.includes(b.rol)) {
        window.location.replace(hedefSayfa(b.rol));
        return;
      }
      resolve(b);
    });
  });
}
