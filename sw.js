/* =============================================================
 *  Anaokul 360 — Service Worker (PWA)
 *  Uygulama kabuğunu önbelleğe alır; Firebase/Google isteklerine
 *  ve fotoğraf servisine (Apps Script) hiç karışmaz.
 * ============================================================= */

const SURUM = "kres-v14";
const KABUK = [
  "./",
  "./index.html",
  "./kayit.html",
  "./admin.html",
  "./ogretmen.html",
  "./veli.html",
  "./yonetim.html",
  "./aydinlatma-metni.html",
  "./kvkk-politikasi.html",
  "./veri-sozlesmesi.html",
  "./css/style.css",
  "./js/firebase-config.js",
  "./js/utils.js",
  "./js/kres.js",
  "./js/auth.js",
  "./js/admin.js",
  "./js/ogretmen.js",
  "./js/veli.js",
  "./js/kayit.js",
  "./js/yonetim.js",
  "./js/site-icerik.js",
  "./js/bildirim.js",
  "./js/sistem-duyuru.js",
  "./js/tema.js",
  "./js/drive-upload.js",
  "./js/pwa.js",
  "./manifest.webmanifest",
  "./img/logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SURUM)
      .then((c) => Promise.allSettled(KABUK.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== SURUM).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const istek = e.request;
  if (istek.method !== "GET") return;
  const url = new URL(istek.url);

  const disKaynak = /(^|\.)(googleapis\.com|gstatic\.com|firebaseio\.com|firebaseapp\.com|google\.com|googleusercontent\.com|cloudfunctions\.net)$/i;
  if (url.origin !== self.location.origin || disKaynak.test(url.hostname)) return;

  e.respondWith(
    caches.match(istek).then((onbellek) => {
      const ag = fetch(istek).then((yanit) => {
        if (yanit && yanit.status === 200 && yanit.type === "basic") {
          const kopya = yanit.clone();
          caches.open(SURUM).then((c) => c.put(istek, kopya));
        }
        return yanit;
      }).catch(() => onbellek);
      return onbellek || ag;
    })
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
