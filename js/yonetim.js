// =============================================================
//  Sağlayıcı (Süper-Admin) Paneli — yonetim.js
//  Tüm kreşleri listeler; abonelik/deneme durumunu yönetir.
// =============================================================

import {
  collection, doc, getDoc, getDocs, updateDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db } from "./firebase-config.js";
import { sayfaKorumasi, cikisYap } from "./auth.js";
import { kresAktifMi } from "./kres.js";
import {
  $, el, escapeHtml, toast, tabloBos, confirmDialog, formatDate, firebaseHata, kurCikis
} from "./utils.js";

const baglam = await sayfaKorumasi("superadmin");
$("#userAd").textContent = "Süper Yönetici";
kurCikis(() => cikisYap());

let kresler = [];

async function yukle() {
  const snap = await getDocs(collection(db, "kresler"));
  kresler = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.olusturma?.seconds || 0) - (a.olusturma?.seconds || 0));
  render();
}

function render() {
  const t = $("#kres-tablo");
  const aktifSayi = kresler.filter((k) => kresAktifMi(k)).length;
  $("#ozet").textContent = `${kresler.length} kreş · ${aktifSayi} aktif · ${kresler.length - aktifSayi} pasif`;

  if (!kresler.length) { tabloBos(t, "Henüz kreş kaydı yok"); return; }
  t.innerHTML = `
    <thead><tr><th>Kreş</th><th>Sahibi (UID)</th><th>Plan</th><th>Durum</th><th>Deneme Bitişi</th><th>İşlemler</th></tr></thead>
    <tbody>${kresler.map((k) => {
      const aktif = kresAktifMi(k);
      return `<tr>
        <td><strong>${escapeHtml(k.ad || "-")}</strong><br><span class="soluk">${escapeHtml(k.id)}</span></td>
        <td class="soluk">${escapeHtml(k.sahibiUid || "-")}</td>
        <td>${escapeHtml(k.plan || "-")}</td>
        <td><span class="rozet rozet--${aktif ? "basari" : "hata"}">${aktif ? "Aktif" : "Pasif"}</span></td>
        <td>${k.denemeBitis?.toDate ? formatDate(k.denemeBitis) : "-"}</td>
        <td class="tablo-islem">
          <button class="btn btn--secondary btn--sm" data-abonelik="${k.id}">Abonelik başlat</button>
          <button class="btn btn--ghost btn--sm" data-uzat="${k.id}">+30 gün</button>
          <button class="btn ${aktif ? "btn--danger" : "btn--primary"} btn--sm" data-durum="${k.id}">${aktif ? "Pasif yap" : "Aktif yap"}</button>
        </td>
      </tr>`;
    }).join("")}</tbody>`;

  t.querySelectorAll("[data-abonelik]").forEach((b) => b.addEventListener("click", () => abonelikBaslat(b.dataset.abonelik)));
  t.querySelectorAll("[data-uzat]").forEach((b) => b.addEventListener("click", () => denemeUzat(b.dataset.uzat)));
  t.querySelectorAll("[data-durum]").forEach((b) => b.addEventListener("click", () => durumCevir(b.dataset.durum)));
}

async function abonelikBaslat(id) {
  const k = kresler.find((x) => x.id === id);
  if (!await confirmDialog(`"${k.ad}" için ücretli aboneliğe geçilsin mi?`, { onayMetni: "Evet, başlat", tehlike: false })) return;
  try {
    await updateDoc(doc(db, "kresler", id), { plan: "abonelik", durum: "aktif" });
    toast("Abonelik başlatıldı.", "success");
    yukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

async function denemeUzat(id) {
  const k = kresler.find((x) => x.id === id);
  const mevcut = k.denemeBitis?.toMillis?.() ?? Date.now();
  const yeni = Timestamp.fromMillis(Math.max(mevcut, Date.now()) + 30 * 86400000);
  try {
    await updateDoc(doc(db, "kresler", id), { denemeBitis: yeni, durum: "aktif", plan: "deneme" });
    toast("Deneme 30 gün uzatıldı.", "success");
    yukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

async function durumCevir(id) {
  const k = kresler.find((x) => x.id === id);
  const yeni = k.durum === "aktif" ? "pasif" : "aktif";
  if (!await confirmDialog(`"${k.ad}" ${yeni === "pasif" ? "pasife alınsın" : "aktifleştirilsin"} mi?`, { onayMetni: "Evet", tehlike: yeni === "pasif" })) return;
  try {
    await updateDoc(doc(db, "kresler", id), { durum: yeni });
    toast("Durum güncellendi.", "success");
    yukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

await yukle();
