// =============================================================
//  Firebase Yapılandırması
//  -------------------------------------------------------------
//  `firebaseConfig` içindeki değerleri kendi Firebase projenizin
//  ("kres-245e9") bilgileriyle doldurun.
//  Fotoğraf yükleme (Google Drive / Apps Script) artık GLOBAL değil,
//  her kreşin kendi ayarında tutulur (kreş dokümanı: driveUrl / driveSir).
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

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Süper-admin Auth yönetimi (şifre belirleme / hesap silme).
// Vendor tarafında dağıtılan Apps Script: google-apps-script/AuthAdmin.gs
// (Boş bırakılırsa süper-admin panelde "şifre belirle" yerine e-posta ile
//  sıfırlama gösterilir.)
export const AUTH_ADMIN_URL = "";
