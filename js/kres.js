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
// durum: "onayBekliyor" | "aktif" | "pasif"
// plan : "deneme" | "abonelik"
// bitisTarihi: Timestamp | (yok/null => süresiz)
export function kresAktifMi(kres = _kres) {
  if (!kres) return false;
  if (kres.durum !== "aktif") return false;
  const bitis = kres.bitisTarihi?.toMillis?.();
  if (bitis == null) return true;            // süresiz erişim
  return bitis > Date.now();
}

export function onayBekliyorMu(kres = _kres) {
  return !!kres && kres.durum === "onayBekliyor";
}

// Erişim bitişine kalan gün (süresizse null)
export function kalanGun(kres = _kres) {
  const bitis = kres?.bitisTarihi?.toMillis?.();
  if (bitis == null) return null;
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

// ---------- Bildirim gönder (uygulama içi çan) ----------
// hedefUidler: string | string[] ; link: "veli.html#gorunum-raporlar" gibi
export async function bildirimGonder(hedefUidler, tur, baslik, metin = "", link = "") {
  if (!_kresId) return;
  const liste = [...new Set([].concat(hedefUidler).filter(Boolean))];
  await Promise.all(liste.map((hedefUid) =>
    addDoc(kol("bildirimler"), {
      hedefUid, tur, baslik, metin, link,
      okundu: false, tarih: serverTimestamp()
    }).catch(() => { /* bildirim yazılamazsa akışı bozma */ })
  ));
}

// ---------- Tam ekran kilit (öğretmen/veli + onay bekleyen yönetici) ----------
export function kilitEkraniGoster(kres) {
  if (document.getElementById("abonelik-kilit")) return;
  const bekliyor = onayBekliyorMu(kres);
  const kap = document.createElement("div");
  kap.id = "abonelik-kilit";
  kap.style.cssText = [
    "position:fixed", "inset:0", "z-index:500", "display:grid", "place-items:center",
    "padding:24px", "background:rgba(45,35,25,.55)", "backdrop-filter:blur(3px)"
  ].join(";");
  kap.innerHTML = `
    <div style="max-width:440px;background:#fff;border-radius:22px;padding:32px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25)">
      <div style="font-size:3rem">${bekliyor ? "⏳" : "🔒"}</div>
      <h2 style="margin:8px 0 6px">${bekliyor ? "Başvurunuz inceleniyor" : "Aboneliğiniz pasif"}</h2>
      <p style="color:#857f78;line-height:1.6">
        ${kres?.ad ? "<strong>" + kres.ad + "</strong> " : ""}${bekliyor
          ? "kreş kaydınız alındı. Sağlayıcı onayından sonra panelinize erişebileceksiniz. Onaylandığında bu sayfayı yenileyin."
          : "kreşinin erişim süresi doldu ya da aboneliği pasif. Devam için sağlayıcı ile görüşün."}
      </p>
      <button id="abonelik-cikis" style="margin-top:16px;background:#ff8a5c;color:#fff;border:none;font-weight:800;padding:12px 22px;border-radius:999px;cursor:pointer">Çıkış Yap</button>
    </div>`;
  document.body.appendChild(kap);
  kap.querySelector("#abonelik-cikis").addEventListener("click", async () => {
    const { cikisYap } = await import("./auth.js");
    cikisYap();
  });
}

// ---------- Yöneticiye üstte uyarı bandı ----------
export function denemeBandiGoster(kres) {
  if (!kres || onayBekliyorMu(kres)) return;
  const kalan = kalanGun(kres);
  if (kalan == null) return;                 // süresiz -> banner yok
  const aktif = kresAktifMi(kres);
  const deneme = kres.plan === "deneme";
  let metin;
  if (!aktif) {
    metin = deneme
      ? "Deneme süreniz doldu. Panel salt-okunur; kayıt/düzenleme yapılamaz."
      : "Aboneliğiniz sona erdi. Panel salt-okunur; yenilemek için sağlayıcıyla görüşün.";
  } else if (deneme) {
    metin = `Deneme sürümü — ${kalan} gün kaldı. Kesintisiz devam için abonelik başlatın.`;
  } else if (kalan <= 7) {
    metin = `Aboneliğiniz ${kalan} gün sonra bitiyor. Yenilemek için sağlayıcıyla görüşün.`;
  } else {
    return;                                  // aboneliğe daha çok var -> banner yok
  }
  const bant = document.createElement("div");
  bant.className = "deneme-bandi";
  bant.style.cssText = [
    "position:sticky", "top:0", "z-index:60", "padding:10px 16px", "text-align:center",
    "font-weight:700", "font-size:.9rem",
    aktif ? "background:#fdf1dd;color:#9a6b1e" : "background:#fce8e4;color:#b23b28"
  ].join(";");
  bant.textContent = metin;
  document.body.prepend(bant);
}
