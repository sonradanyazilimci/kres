// =============================================================
//  Sistem Duyuruları (sistem-duyuru.js)
//  Sağlayıcının tüm kreşlere gönderdiği bilgilendirme bantları.
//  /sistemDuyurulari/{id} -> { baslik, metin, seviye, aktif, tarih }
//  Her panelde ve index.html'de gösterilir; kapatma localStorage'da tutulur.
// =============================================================

import {
  collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const KEY = "kapatilanSistemDuyurulari";
const SEVIYE_STIL = {
  bilgi:   ["#e5eff8", "#35648f", "ℹ️"],
  uyari:   ["#fdf1dd", "#9a6b1e", "⚠️"],
  onemli:  ["#fce8e4", "#b23b28", "🚨"]
};

function kapatilanlar() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function kapat(id) {
  try {
    const k = kapatilanlar();
    if (!k.includes(id)) { k.push(id); localStorage.setItem(KEY, JSON.stringify(k.slice(-50))); }
  } catch { /* yoksay */ }
}

export async function sistemDuyurulariOku() {
  try {
    const snap = await getDocs(collection(db, "sistemDuyurulari"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  } catch { return []; }
}

// Aktif + kapatılmamış duyuruları sayfanın en üstüne bant olarak ekle
export async function sistemDuyurulariniGoster() {
  const hepsi = await sistemDuyurulariOku();
  const kap = kapatilanlar();
  const gosterilecek = hepsi.filter((d) => d.aktif && !kap.includes(d.id));
  if (!gosterilecek.length) return;

  const sar = document.createElement("div");
  sar.id = "sistem-duyuru-sar";
  sar.style.cssText = "position:relative;z-index:45";
  gosterilecek.forEach((d) => {
    const [bg, fg, ikon] = SEVIYE_STIL[d.seviye] || SEVIYE_STIL.bilgi;
    const bant = document.createElement("div");
    bant.style.cssText = [
      "display:flex", "align-items:flex-start", "gap:10px",
      "padding:10px 16px", "font-size:.9rem", "font-weight:600",
      `background:${bg}`, `color:${fg}`, "border-bottom:1px solid rgba(0,0,0,.06)"
    ].join(";");
    bant.innerHTML = `<span>${ikon}</span>
      <span style="flex:1"><strong>${escapeHtml(d.baslik || "")}</strong>${d.metin ? " — " + escapeHtml(d.metin) : ""}</span>`;
    const x = document.createElement("button");
    x.textContent = "✕";
    x.setAttribute("aria-label", "Kapat");
    x.style.cssText = "background:none;border:none;font-weight:800;cursor:pointer;color:inherit;line-height:1";
    x.addEventListener("click", () => { kapat(d.id); bant.remove(); if (!sar.children.length) sar.remove(); });
    bant.appendChild(x);
    sar.appendChild(bant);
  });
  document.body.insertBefore(sar, document.body.firstChild);
}

function escapeHtml(s = "") {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// ---- Sağlayıcı yönetimi (yonetim.js kullanır) ----
export async function sistemDuyuruEkle({ baslik, metin, seviye }) {
  await addDoc(collection(db, "sistemDuyurulari"), {
    baslik, metin: metin || "", seviye: seviye || "bilgi", aktif: true, tarih: serverTimestamp()
  });
}
export function sistemDuyuruGuncelle(id, veri) {
  return updateDoc(doc(db, "sistemDuyurulari", id), veri);
}
export function sistemDuyuruSil(id) {
  return deleteDoc(doc(db, "sistemDuyurulari", id));
}
