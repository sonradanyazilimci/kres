// =============================================================
//  Tema (açık / koyu) — tema.js
//  temaBaslat(): kayıtlı temayı uygular + tüm panellere geçiş düğmesi ekler.
// =============================================================

const KEY = "kresTema";

function oku() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function yaz(t) {
  try { localStorage.setItem(KEY, t); } catch { /* yoksay */ }
}

export function temaUygula(t) {
  const kok = document.documentElement;
  if (t === "koyu") kok.setAttribute("data-theme", "dark");
  else kok.removeAttribute("data-theme");
  document.querySelectorAll("[data-tema-dugme]").forEach((b) => {
    b.textContent = t === "koyu" ? "☀️" : "🌙";
    b.setAttribute("aria-label", t === "koyu" ? "Açık tema" : "Koyu tema");
  });
}

export function temaDegistir() {
  const yeni = document.documentElement.getAttribute("data-theme") === "dark" ? "acik" : "koyu";
  yaz(yeni);
  temaUygula(yeni);
}

// Geçiş düğmesini panel başlığına ekle
function dugmeEkle() {
  if (document.querySelector("[data-tema-dugme]")) return;
  const yuva = document.querySelector(".panel-ust") || document.querySelector(".site-nav__links");
  if (!yuva) return;
  const b = document.createElement("button");
  b.className = "tema-dugme";
  b.setAttribute("data-tema-dugme", "");
  b.type = "button";
  b.addEventListener("click", temaDegistir);
  const rozet = yuva.querySelector(".kullanici-rozet");
  if (rozet) yuva.insertBefore(b, rozet);
  else yuva.appendChild(b);
}

export function temaBaslat() {
  const kayitli = oku() || "acik";
  temaUygula(kayitli);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", dugmeEkle);
  } else {
    dugmeEkle();
  }
}
