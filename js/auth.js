// =============================================================
//  Kimlik Doğrulama ve Rol Yönetimi (auth.js)
//  Giriş, çıkış, oturum durumu, rol kontrolü ve sayfa koruması.
// =============================================================

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db, PANEL_BY_ROLE } from "./firebase-config.js";
import { firebaseHata } from "./utils.js";

// Oturum boyunca kullanıcı profilini önbelleğe al
let _profilCache = null;

// ---------- Oturum durumu ----------
// callback(user | null) — Firebase Auth hazır olduğunda çağrılır.
export function onAuthReady(callback) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) _profilCache = null;
    callback(user);
  });
}

// ---------- Giriş ----------
export async function girisYap(email, sifre) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, sifre);
    const profil = await kullaniciProfili(cred.user.uid, true);
    if (!profil) {
      await signOut(auth);
      throw new Error("Hesabınız sistemde tanımlı değil. Yöneticinize başvurun.");
    }
    return profil;
  } catch (err) {
    throw new Error(firebaseHata(err));
  }
}

// ---------- Çıkış ----------
export async function cikisYap(yonlendir = "index.html") {
  _profilCache = null;
  await signOut(auth);
  if (yonlendir) window.location.href = yonlendir;
}

// ---------- Kullanıcı profili (users koleksiyonu) ----------
export async function kullaniciProfili(uid, taze = false) {
  if (!uid) return null;
  if (!taze && _profilCache && _profilCache.uid === uid) return _profilCache;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  _profilCache = { uid, ...snap.data() };
  return _profilCache;
}

// ---------- Role göre panel yolu ----------
export function panelYolu(rol) {
  return PANEL_BY_ROLE[rol] || "index.html";
}

// ---------- Role göre yönlendir ----------
export function roleGoreYonlendir(rol) {
  window.location.href = panelYolu(rol);
}

// ---------- Sayfa koruması ----------
// Bir panel sayfasının başında çağrılır. İzinli rol(ler)e sahip
// olmayan veya giriş yapmamış kullanıcı index.html'e atılır.
// Çözümlendiğinde geçerli kullanıcı profilini döndürür.
export function sayfaKorumasi(izinliRoller) {
  const izinli = Array.isArray(izinliRoller) ? izinliRoller : [izinliRoller];
  return new Promise((resolve) => {
    onAuthReady(async (user) => {
      if (!user) {
        window.location.replace("index.html");
        return;
      }
      const profil = await kullaniciProfili(user.uid, true);
      if (!profil || !izinli.includes(profil.rol)) {
        // Yanlış rol: kendi paneline (varsa) veya ana sayfaya gönder
        window.location.replace(profil ? panelYolu(profil.rol) : "index.html");
        return;
      }
      resolve(profil);
    });
  });
}
