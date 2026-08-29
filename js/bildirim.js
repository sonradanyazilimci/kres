// =============================================================
//  Uygulama İçi Bildirim Merkezi (bildirim.js)
//  Her panelde çan + okunmamış sayacı + açılır liste.
//  kurBildirimZili({ profil, kresId }) ile başlatılır.
// =============================================================

import {
  collection, doc, query, where, onSnapshot, updateDoc, writeBatch, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { el, toast, formatDateTime } from "./utils.js";

const TUR_IKON = {
  rapor: "📝", duyuru: "📢", mesaj: "💬", aidat: "💳",
  izin: "📄", talep: "📨", devamsizlik: "🚸", odeme: "✅", genel: "🔔"
};

let _abone = null;
let _kayitlar = [];

export function kurBildirimZili({ profil, kresId }) {
  if (!profil?.uid || !kresId) return;
  if (document.getElementById("bildirimBtn")) return;

  const yuva = document.querySelector(".panel-ust") || document.body;
  const rozet = yuva.querySelector(".kullanici-rozet");

  const sayac = el("span", { class: "bildirim-sayac", hidden: "" }, "0");
  const btn = el("button", { class: "bildirim-btn", id: "bildirimBtn", "aria-label": "Bildirimler" }, "🔔", sayac);
  const panel = el("div", { class: "bildirim-panel", id: "bildirimPanel", hidden: "" });

  if (rozet) yuva.insertBefore(btn, rozet); else yuva.appendChild(btn);
  yuva.appendChild(panel);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) render(panel, profil, kresId);
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) panel.hidden = true;
  });

  // Gerçek zamanlı dinle (composite index gerektirmesin diye sadece hedefUid filtresi)
  const q = query(collection(db, "kresler", kresId, "bildirimler"), where("hedefUid", "==", profil.uid));
  _abone = onSnapshot(q, (snap) => {
    _kayitlar = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
    const okunmamis = _kayitlar.filter((x) => !x.okundu).length;
    sayac.textContent = okunmamis > 99 ? "99+" : String(okunmamis);
    sayac.hidden = okunmamis === 0;
    btn.classList.toggle("bildirim-btn--dolu", okunmamis > 0);
    if (!panel.hidden) render(panel, profil, kresId);
  }, () => { /* dinleme hatası — sessiz */ });
}

export function bildirimZiliniKapat() {
  if (_abone) { _abone(); _abone = null; }
}

function render(panel, profil, kresId) {
  const son = _kayitlar.slice(0, 30);
  panel.innerHTML = "";
  panel.appendChild(el("div", { class: "bildirim-panel__ust" },
    el("strong", {}, "Bildirimler"),
    _kayitlar.some((x) => !x.okundu)
      ? el("button", { class: "btn btn--ghost btn--sm", onClick: () => tumunuOku(kresId, profil) }, "Tümünü okundu yap")
      : null
  ));
  if (!son.length) {
    panel.appendChild(el("div", { class: "bildirim-bos" }, "Henüz bildirim yok"));
    return;
  }
  const liste = el("div", { class: "bildirim-liste" });
  son.forEach((b) => {
    const oge = el("button", { class: `bildirim-oge ${b.okundu ? "" : "bildirim-oge--yeni"}` },
      el("span", { class: "bildirim-oge__ikon" }, TUR_IKON[b.tur] || "🔔"),
      el("span", { class: "bildirim-oge__govde" },
        el("strong", {}, b.baslik || "Bildirim"),
        b.metin ? el("span", { class: "soluk" }, b.metin) : null,
        el("span", { class: "bildirim-oge__zaman" }, formatDateTime(b.tarih))
      )
    );
    oge.addEventListener("click", async () => {
      if (!b.okundu) {
        try { await updateDoc(doc(db, "kresler", kresId, "bildirimler", b.id), { okundu: true }); } catch { /* yoksay */ }
      }
      panel.hidden = true;
      if (b.link) yonlendir(b.link);
    });
    liste.appendChild(oge);
  });
  panel.appendChild(liste);

  if (_kayitlar.length > 30) {
    panel.appendChild(el("button", { class: "btn btn--ghost btn--sm bildirim-temizle", onClick: () => eskileriSil(kresId) },
      "Okunmuş eski bildirimleri temizle"));
  }
}

// link biçimi: "raporlar" (aynı panelde görünüm) | "veli.html#odemeler" | "admin.html"
function yonlendir(link) {
  if (link.includes(".html")) { window.location.href = link; return; }
  const hedef = link.replace(/^#?gorunum-/, "");
  const nav = document.querySelector(`.yan-menu a[data-gorunum="${hedef}"]`);
  if (nav) nav.click();
}

async function tumunuOku(kresId, profil) {
  const acik = _kayitlar.filter((x) => !x.okundu);
  try {
    for (let i = 0; i < acik.length; i += 400) {
      const b = writeBatch(db);
      acik.slice(i, i + 400).forEach((x) =>
        b.update(doc(db, "kresler", kresId, "bildirimler", x.id), { okundu: true }));
      await b.commit();
    }
  } catch { toast("Bildirimler güncellenemedi.", "error"); }
}

async function eskileriSil(kresId) {
  const silinecek = _kayitlar.filter((x) => x.okundu).slice(20); // en yeni 20 okunmuşu koru
  try {
    for (const x of silinecek) await deleteDoc(doc(db, "kresler", kresId, "bildirimler", x.id)).catch(() => {});
    toast("Eski bildirimler temizlendi.", "success");
  } catch { /* yoksay */ }
}
