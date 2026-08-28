// =============================================================
//  Yedekleme — yedekle.mjs
//  Tüm Firestore verisini (kresler alt-koleksiyonları dahil) JSON
//  olarak dışa aktarır. Spark planda çalışır (managed export GEREKMEZ).
//
//  KULLANIM:
//    npm i firebase-admin
//    node scripts/yedekle.mjs ./serviceAccountKey.json ./yedekler
//
//  Cron / Zamanlanmış görev ile günlük çalıştırın, ya da
//  .github/workflows/yedek.yml (GitHub Actions) kullanın.
// =============================================================

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [keyPath, hedefDizin = "./yedekler"] = process.argv.slice(2);
if (!keyPath) {
  console.error("Kullanım: node scripts/yedekle.mjs ./serviceAccountKey.json [hedefDizin]");
  process.exit(1);
}

const sa = JSON.parse(await (await import("node:fs/promises")).readFile(keyPath, "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Bir koleksiyonu (ve tüm alt-koleksiyonlarını) özyinelemeli topla
async function koleksiyonTopla(ref) {
  const snap = await ref.get();
  const cikti = {};
  for (const d of snap.docs) {
    const kayit = { _veri: d.data(), _alt: {} };
    const altlar = await d.ref.listCollections();
    for (const alt of altlar) {
      kayit._alt[alt.id] = await koleksiyonTopla(alt);
    }
    cikti[d.id] = kayit;
  }
  return cikti;
}

async function main() {
  const damga = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir(hedefDizin, { recursive: true });

  const kokKoleksiyonlar = await db.listCollections();
  const yedek = { tarih: new Date().toISOString(), koleksiyonlar: {} };
  for (const kol of kokKoleksiyonlar) {
    process.stdout.write(`${kol.id} ... `);
    yedek.koleksiyonlar[kol.id] = await koleksiyonTopla(kol);
    console.log("ok");
  }

  const dosya = path.join(hedefDizin, `yedek-${damga}.json`);
  await writeFile(dosya, JSON.stringify(yedek, null, 2), "utf8");
  console.log("\n✔ Yedek yazıldı:", dosya, `(${(JSON.stringify(yedek).length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => { console.error("HATA:", e); process.exit(1); });
