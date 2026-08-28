// =============================================================
//  Yardımcı Fonksiyonlar (utils.js)
//  Tarih biçimlendirme, toast bildirimleri, DOM kısayolları,
//  yükleme (spinner) ve boş durum yardımcıları.
// =============================================================

// ---------- DOM Kısayolları ----------
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== null && value !== undefined) {
      node.setAttribute(key, value);
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

// ---------- Güvenli HTML ----------
export function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ---------- Tarih / Saat ----------
const AYLAR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];
const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

// Firestore Timestamp | Date | ISO string -> Date
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "number") return new Date(value);
  return new Date(value);
}

// 2026-08-28 (input[type=date] ve sorgu anahtarı için)
export function isoDate(date = new Date()) {
  const d = toDate(date) || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 28 Ağustos 2026
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return "-";
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

// 28 Ağustos 2026, Cuma 14:30
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "-";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}, ${GUNLER[d.getDay()]} ${hh}:${mm}`;
}

// Yaş hesabı (doğum tarihinden)
export function yasHesapla(dogumTarihi) {
  const d = toDate(dogumTarihi);
  if (!d) return "-";
  const bugun = new Date();
  let yas = bugun.getFullYear() - d.getFullYear();
  const m = bugun.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && bugun.getDate() < d.getDate())) yas--;
  return yas;
}

// "2026-08" -> "Ağustos 2026"
export function formatAy(ayStr) {
  if (!ayStr || !ayStr.includes("-")) return ayStr || "-";
  const [y, m] = ayStr.split("-");
  return `${AYLAR[Number(m) - 1]} ${y}`;
}

export function paraFormat(tutar) {
  const n = Number(tutar) || 0;
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

// ---------- Toast Bildirimleri ----------
function toastContainer() {
  let c = document.getElementById("toast-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "toast-container";
    c.className = "toast-container";
    document.body.appendChild(c);
  }
  return c;
}

export function toast(mesaj, tur = "info", sure = 3500) {
  const c = toastContainer();
  const ikon = { success: "✓", error: "✕", info: "ℹ", warning: "!" }[tur] || "ℹ";
  const t = el("div", { class: `toast toast--${tur}`, role: "status" },
    el("span", { class: "toast__icon" }, ikon),
    el("span", { class: "toast__msg" }, mesaj)
  );
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add("toast--show"));
  setTimeout(() => {
    t.classList.remove("toast--show");
    setTimeout(() => t.remove(), 300);
  }, sure);
}

// ---------- Yükleme (Spinner) ----------
export function spinner(boyut = "md") {
  return el("div", { class: `spinner spinner--${boyut}`, "aria-label": "Yükleniyor" });
}

export function setLoading(container, aktif = true, mesaj = "Yükleniyor...") {
  if (!container) return;
  if (aktif) {
    container.innerHTML = "";
    container.appendChild(
      el("div", { class: "loading-state" }, spinner("lg"), el("p", {}, mesaj))
    );
  }
}

// ---------- Boş Durum ----------
export function emptyState(container, mesaj = "Kayıt bulunamadı", ikon = "📭") {
  if (!container) return;
  container.innerHTML = "";
  container.appendChild(
    el("div", { class: "empty-state" },
      el("div", { class: "empty-state__icon" }, ikon),
      el("p", {}, mesaj)
    )
  );
}

// ---------- Boş tablo (tabloyu DOM'dan silmeden) ----------
export function tabloBos(tablo, mesaj = "Kayıt bulunamadı") {
  if (!tablo) return;
  tablo.innerHTML =
    `<tbody><tr><td style="padding:34px;text-align:center;color:var(--metin-soluk)">${escapeHtml(mesaj)}</td></tr></tbody>`;
}

// ---------- Modal Yardımcısı ----------
export function openModal(baslik, contentNode, { genis = false } = {}) {
  closeModal();
  const overlay = el("div", { class: "modal-overlay", id: "app-modal" });
  const modal = el("div", { class: `modal ${genis ? "modal--wide" : ""}` },
    el("div", { class: "modal__header" },
      el("h3", {}, baslik),
      el("button", { class: "modal__close", "aria-label": "Kapat", onClick: closeModal }, "✕")
    ),
    el("div", { class: "modal__body" }, contentNode)
  );
  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", escToClose);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("modal-overlay--show"));
  setTimeout(() => overlay.classList.add("modal-overlay--show"), 30);
  return { overlay, modal, close: closeModal };
}

function escToClose(e) {
  if (e.key === "Escape") closeModal();
}

export function closeModal() {
  const existing = document.getElementById("app-modal");
  if (existing) {
    existing.classList.remove("modal-overlay--show");
    document.removeEventListener("keydown", escToClose);
    setTimeout(() => existing.remove(), 200);
  }
}

// ---------- Onay Kutusu ----------
export function confirmDialog(mesaj, { onayMetni = "Evet, sil", tehlike = true } = {}) {
  return new Promise((resolve) => {
    const body = el("div", { class: "confirm-box" },
      el("p", {}, mesaj),
      el("div", { class: "confirm-box__actions" },
        el("button", { class: "btn btn--ghost", onClick: () => { closeModal(); resolve(false); } }, "Vazgeç"),
        el("button", {
          class: `btn ${tehlike ? "btn--danger" : "btn--primary"}`,
          onClick: () => { closeModal(); resolve(true); }
        }, onayMetni)
      )
    );
    openModal("Onay", body);
  });
}

// ---------- Form Verisi ----------
export function formData(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      (data[k] ||= []).push(value);
    } else {
      data[key] = typeof value === "string" ? value.trim() : value;
    }
  });
  return data;
}

// ---------- Baş harfler (avatar) ----------
export function basHarfler(ad = "", soyad = "") {
  return ((ad[0] || "") + (soyad[0] || "")).toUpperCase() || "?";
}

// ---------- Panel gezinmesi (yan menü + görünüm değiştirme) ----------
// Yan menüdeki `a[data-gorunum]` linkleri ile `#gorunum-<ad>` bölümlerini
// eşleştirir. İsteğe bağlı `basliklar` haritası sayfa başlığını günceller.
// `onDegisim(ad)` her görünüm değişiminde çağrılır (tembel yükleme için).
export function kurPanelGezinme(basliklar = {}, onDegisim = () => {}) {
  const linkler = $$("a[data-gorunum]");
  const baslikEl = document.getElementById("sayfaBaslik");

  function goster(ad) {
    $$(".gorunum").forEach((g) => g.classList.toggle("aktif", g.id === `gorunum-${ad}`));
    linkler.forEach((l) => l.classList.toggle("aktif", l.dataset.gorunum === ad));
    if (baslikEl && basliklar[ad]) baslikEl.textContent = basliklar[ad];
    window.scrollTo({ top: 0, behavior: "smooth" });
    onDegisim(ad);
  }

  linkler.forEach((l) => {
    l.addEventListener("click", (e) => {
      e.preventDefault();
      goster(l.dataset.gorunum);
    });
  });

  return { goster };
}

// ---------- Çıkış butonlarını bağla ----------
export function kurCikis(cikisFn) {
  ["cikisBtn", "cikisBtnMobil"].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", (e) => { e.preventDefault(); cikisFn(); });
  });
}

// ---------- Kullanıcı rozetini doldur ----------
export function kullaniciRozeti(profil) {
  const ad = document.getElementById("userAd");
  const av = document.getElementById("userAvatar");
  if (ad) ad.textContent = `${profil.ad || ""} ${profil.soyad || ""}`.trim() || profil.email;
  if (av) av.textContent = basHarfler(profil.ad, profil.soyad);
}

// ---------- Firebase hata mesajlarını Türkçeleştir ----------
export function firebaseHata(err) {
  const kod = err?.code || "";
  const map = {
    "auth/invalid-email": "Geçersiz e-posta adresi.",
    "auth/user-disabled": "Bu hesap devre dışı bırakılmış.",
    "auth/user-not-found": "Kullanıcı bulunamadı.",
    "auth/wrong-password": "Hatalı şifre.",
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/email-already-in-use": "Bu e-posta adresi zaten kullanılıyor.",
    "auth/weak-password": "Şifre en az 6 karakter olmalı.",
    "auth/too-many-requests": "Çok fazla deneme yapıldı. Lütfen sonra tekrar deneyin.",
    "auth/network-request-failed": "Ağ hatası. İnternet bağlantınızı kontrol edin.",
    "permission-denied": "Bu işlem için yetkiniz yok.",
    "unavailable": "Sunucuya ulaşılamıyor. Lütfen tekrar deneyin."
  };
  return map[kod] || err?.message || "Beklenmeyen bir hata oluştu.";
}
