// =============================================================
//  PWA kaydı + "Uygulamayı yükle" düğmesi (pwa.js)
//  Her sayfada <script type="module" src="js/pwa.js"> ile çağrılır.
// =============================================================

// --- Service worker kaydı ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => {
      console.warn("[PWA] Service worker kaydı başarısız:", e);
    });
  });
}

// --- Yükleme (Add to Home Screen) ---
let yuklemeOlayi = null;

function yukleDugmesiGoster(goster) {
  let btn = document.getElementById("pwaYukleBtn");
  if (goster) {
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "pwaYukleBtn";
      btn.type = "button";
      btn.textContent = "📲 Uygulamayı yükle";
      btn.style.cssText = [
        "position:fixed", "left:50%", "transform:translateX(-50%)",
        "bottom:calc(16px + env(safe-area-inset-bottom))", "z-index:400",
        "background:#ff8a5c", "color:#fff", "border:none", "font:inherit",
        "font-weight:800", "padding:12px 20px", "border-radius:999px",
        "box-shadow:0 8px 24px rgba(60,45,30,.28)", "cursor:pointer"
      ].join(";");
      btn.addEventListener("click", async () => {
        if (!yuklemeOlayi) return;
        btn.disabled = true;
        yuklemeOlayi.prompt();
        try { await yuklemeOlayi.userChoice; } catch { /* yoksay */ }
        yuklemeOlayi = null;
        btn.remove();
      });
      document.body.appendChild(btn);
    }
  } else if (btn) {
    btn.remove();
  }
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  yuklemeOlayi = e;
  // Zaten kurulu değilse düğmeyi göster
  const kurulu = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  if (!kurulu) yukleDugmesiGoster(true);
});

window.addEventListener("appinstalled", () => {
  yuklemeOlayi = null;
  yukleDugmesiGoster(false);
});
