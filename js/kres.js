// =============================================================
//  Kiracı (Kreş) Bağlamı — kres.js
//  Çok-kiracılı yapıda geçerli kreşin kimliğini, ayarlarını ve
//  alt-koleksiyon yol yardımcılarını sağlar.
//    /kullaniciDizini/{uid}      -> { kresId, rol }
//    /kresler/{kresId}           -> kreş ayarları + abonelik
//    /kresler/{kresId}/<alt>/... -> tüm kreş verisi
// =============================================================

import {
  doc, getDoc, collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

export const ROLLER = ["admin", "ogretmen", "veli"];
export const DENEME_GUN = 14;

let _kresId = null;
let _kres = null;

export function aktifKresId() { return _kresId; }
export function aktifKres() { return _kres; }

// ---------- Abonelik / deneme durumu ----------
export function kresAktifMi(kres = _kres) {
  if (!kres) return false;
  if (kres.durum !== "aktif") return false;
  if (kres.plan === "deneme") {
    const bitis = kres.denemeBitis?.toMillis?.() ?? 0;
    return bitis > Date.now();
  }
  return true;
}

export function denemeKalanGun(kres = _kres) {
  if (!kres || kres.plan !== "deneme") return null;
  const bitis = kres.denemeBitis?.toMillis?.() ?? 0;
  return Math.ceil((bitis - Date.now()) / 86400000);
}

// ---------- Dizin (uid -> kresId, rol) ----------
export async function dizinOku(uid) {
  if (!uid) return null;
  const s = await getDoc(doc(db, "kullaniciDizini", uid));
  return s.exists() ? s.data() : null;
}

export async function superAdminMi(uid) {
  if (!uid) return false;
  const s = await getDoc(doc(db, "superAdmins", uid));
  return s.exists();
}

// ---------- Bağlamı kur ----------
export async function kresBaglamiKur(kresId) {
  _kresId = kresId;
  const s = await getDoc(doc(db, "kresler", kresId));
  _kres = s.exists() ? { id: kresId, ...s.data() } : null;
  return _kres;
}

// ---------- Alt-koleksiyon yol yardımcıları ----------
export function kol(altKoleksiyon) {
  return collection(db, "kresler", _kresId, altKoleksiyon);
}
export function bel(altKoleksiyon, id) {
  return doc(db, "kresler", _kresId, altKoleksiyon, id);
}

// ---------- KVKK denetim (işlem) günlüğü — append-only ----------
export async function islemKaydet(uid, islem, detay = {}) {
  if (!_kresId) return;
  try {
    await addDoc(kol("islemKayitlari"), {
      kim: uid, islem, detay, tarih: serverTimestamp()
    });
  } catch { /* günlük yazılamazsa akışı bozma */ }
}

// ---------- Abonelik kilit ekranı (öğretmen/veli için tam ekran) ----------
export function kilitEkraniGoster(kres) {
  const mevcut = document.getElementById("abonelik-kilit");
  if (mevcut) return;
  const kap = document.createElement("div");
  kap.id = "abonelik-kilit";
  kap.style.cssText = [
    "position:fixed", "inset:0", "z-index:500", "display:grid", "place-items:center",
    "padding:24px", "background:rgba(45,35,25,.55)", "backdrop-filter:blur(3px)"
  ].join(";");
  kap.innerHTML = `
    <div style="max-width:420px;background:#fff;border-radius:22px;padding:32px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25)">
      <div style="font-size:3rem">🔒</div>
      <h2 style="margin:8px 0 6px">Aboneliğiniz pasif</h2>
      <p style="color:#857f78;line-height:1.6">
        ${kres?.ad ? "<strong>" + kres.ad + "</strong> " : ""}kreşinin deneme süresi doldu ya da aboneliği pasif durumda.
        Erişimin devam etmesi için kreş yöneticisiyle görüşün.
      </p>
      <button id="abonelik-cikis" style="margin-top:16px;background:#ff8a5c;color:#fff;border:none;font-weight:800;padding:12px 22px;border-radius:999px;cursor:pointer">Çıkış Yap</button>
    </div>`;
  document.body.appendChild(kap);
  kap.querySelector("#abonelik-cikis").addEventListener("click", async () => {
    const { cikisYap } = await import("./auth.js");
    cikisYap();
  });
}

// ---------- Abonelik uyarı bandı (yönetici için, üstte) ----------
export function denemeBandiGoster(kres) {
  const kalan = denemeKalanGun(kres);
  if (kalan === null) return;
  const aktif = kresAktifMi(kres);
  const bant = document.createElement("div");
  bant.className = "deneme-bandi";
  bant.style.cssText = [
    "position:sticky", "top:0", "z-index:60", "padding:10px 16px", "text-align:center",
    "font-weight:700", "font-size:.9rem",
    aktif ? "background:#fdf1dd;color:#9a6b1e" : "background:#fce8e4;color:#b23b28"
  ].join(";");
  bant.textContent = aktif
    ? `Deneme sürümü — ${kalan} gün kaldı. Kesintisiz devam için abonelik başlatın.`
    : "Deneme süreniz doldu. Panel salt-okunur modda; yeni kayıt/düzenleme yapılamaz.";
  document.body.prepend(bant);
}
