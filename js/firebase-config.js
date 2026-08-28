// =============================================================
//  Firebase + Google Drive Yapılandırması
//  -------------------------------------------------------------
//  1) `firebaseConfig` içindeki YER TUTUCU değerleri kendi Firebase
//     projenizin ("kres") bilgileriyle değiştirin.
//     Firebase Console > Proje Ayarları > Genel > "Uygulamalarınız" > Web
//  2) Fotoğraflar Firebase Storage yerine Google Drive'a yüklenir.
//     `DRIVE_UPLOAD_URL` alanına, dağıttığınız Google Apps Script web
//     uygulamasının `/exec` adresini yazın (bkz. README + google-apps-script/Kod.gs).
//  Ayrıntılı adımlar için README.md dosyasına bakın.
// =============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyB1vl5VROaBRozcHLMCbhXcX8EzhoJivo8",
  authDomain: "kres-245e9.firebaseapp.com",
  projectId: "kres-245e9",
  messagingSenderId: "322905779286",
  appId: "1:322905779286:web:4278bdf8ecae3c0f711ff7"
};

// Uygulamanın çekirdek Firebase örnekleri (Storage KULLANILMIYOR — bkz. Drive)
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ---------- Google Drive (fotoğraf yükleme) ----------
// Apps Script web uygulaması dağıtım adresi. Örn:
// "https://script.google.com/macros/s/AKfycb.../exec"
export const DRIVE_UPLOAD_URL = "https://script.google.com/macros/s/AKfycbxyikXByIayxnYAwNFi0dCW8cL60qmZHg0MrG0gZwi-Ajai0tOgw74F-Eb02oF2VEoh/exec";

// İsteğe bağlı paylaşılan sır. Apps Script tarafında `YUKLEME_SIRRI` script
// özelliği ayarlıysa aynı değeri buraya yazın; değilse boş bırakın.
export const DRIVE_UPLOAD_SIR = "erhankenarerhankenar";

// Uygulama genelinde kullanılan sabitler
export const ROLES = {
  ADMIN: "admin",
  OGRETMEN: "ogretmen",
  VELI: "veli"
};

export const PANEL_BY_ROLE = {
  admin: "admin.html",
  ogretmen: "ogretmen.html",
  veli: "veli.html"
};
