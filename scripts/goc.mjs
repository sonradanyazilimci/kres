// =============================================================
//  Tek Seferlik Göç — goc.mjs
//  Eski DÜZ koleksiyonları (users, siniflar, ...) yeni ÇOK-KİRACILI
//  yapıya taşır:  /kresler/{demoKresId}/<alt>/...  +  /kullaniciDizini/{uid}
//  Ayrıca belirtilen UID'yi süper-admin yapar.
//
//  KULLANIM:
//    npm i firebase-admin
//    node scripts/goc.mjs ./serviceAccountKey.json [SUPERADMIN_UID]
//
//  serviceAccountKey.json:
//    Firebase Console → Proje Ayarları → Hizmet hesapları →
//    "Yeni özel anahtar oluştur" (Spark planda da çalışır).
// =============================================================

import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [keyPath, superUid] = process.argv.slice(2);
if (!keyPath) {
  console.error("Kullanım: node scripts/goc.mjs ./serviceAccountKey.json [SUPERADMIN_UID]");
  process.exit(1);
}

const sa = JSON.parse(await readFile(keyPath, "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const DUZ_KOLEKSIYONLAR = [
  "siniflar", "ogrenciler", "yoklamalar", "gunlukRaporlar",
  "duyurular", "mesajlar", "odemeler", "fotograflar"
];

async function main() {
  // 1) Eski kullanıcılar
  const usersSnap = await db.collection("users").get();
  if (usersSnap.empty) {
    console.log("Eski 'users' koleksiyonu boş. Göç edilecek veri yok.");
  }
  const kullanicilar = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const eskiAdmin = kullanicilar.find((u) => u.rol === "admin");

  // 2) Demo kreş dokümanı (abonelikli — deneme süresi dolmasın)
  const kresRef = db.collection("kresler").doc();
  await kresRef.set({
    ad: "Anaokul 360 (Demo)",
    telefon: "",
    sahibiUid: eskiAdmin ? eskiAdmin.id : (superUid || "bilinmiyor"),
    plan: "abonelik",
    durum: "aktif",
    denemeBitis: FieldValue.serverTimestamp(),
    marka: { renk: "#ff8a5c" },
    kvkkOnay: { surum: "1.0", tarih: FieldValue.serverTimestamp(), tarayici: "goc-script" },
    olusturma: FieldValue.serverTimestamp()
  });
  const kresId = kresRef.id;
  console.log("Demo kreş oluşturuldu:", kresId);

  // 3) Kullanıcıları taşı + dizin kayıtları
  //    (Süper-admin UID'yi kreş kullanıcısı YAPMA.)
  let taşınan = 0;
  for (const u of kullanicilar) {
    if (superUid && u.id === superUid) continue;
    await kresRef.collection("users").doc(u.id).set({ ...u, uid: u.id });
    await db.collection("kullaniciDizini").doc(u.id).set({ kresId, rol: u.rol || "veli" });
    taşınan++;
  }
  console.log(`${taşınan} kullanıcı taşındı + dizinlendi.`);

  // 4) Diğer düz koleksiyonlar
  for (const kol of DUZ_KOLEKSIYONLAR) {
    const snap = await db.collection(kol).get();
    if (snap.empty) { console.log(`${kol}: 0`); continue; }
    let n = 0;
    const batch = db.batch();
    for (const d of snap.docs) {
      batch.set(kresRef.collection(kol).doc(d.id), d.data());
      n++;
    }
    await batch.commit();
    console.log(`${kol}: ${n} taşındı`);
  }

  // 5) duyuruOkundu (id = veli uid)
  const okSnap = await db.collection("duyuruOkundu").get();
  for (const d of okSnap.docs) {
    await kresRef.collection("duyuruOkundu").doc(d.id).set(d.data());
  }
  if (!okSnap.empty) console.log(`duyuruOkundu: ${okSnap.size} taşındı`);

  // 6) Süper-admin
  if (superUid) {
    await db.collection("superAdmins").doc(superUid).set({
      eklendi: FieldValue.serverTimestamp(), not: "goc-script"
    });
    console.log("Süper-admin ayarlandı:", superUid);
  }

  console.log("\n✔ Göç tamam. Eski düz koleksiyonlar SİLİNMEDİ; test edip sonra elle silebilirsiniz.");
  console.log("  Demo kreş id:", kresId);
}

main().catch((e) => { console.error("HATA:", e); process.exit(1); });
