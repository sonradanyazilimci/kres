/* =============================================================
 *  Küçük Adımlar Kreş — Service Worker (PWA)
 *  Uygulama kabuğunu önbelleğe alır; Firebase/Google isteklerine
 *  hiç karışmaz (her zaman ağdan).
 * ============================================================= */

const SURUM = "kres-v1";
const KABUK = [
  "./",
  "./index.html",
  "./admin.html",
  "./ogretmen.html",
  "./veli.html",
  "./css/style.css",
  "./js/firebase-config.js",
  "./js/utils.js",
  "./js/auth.js",
  "./js/admin.js",
  "./js/ogretmen.js",
  "./js/veli.js",
  "./js/drive-upload.js",
  "./js/pwa.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SURUM).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((anahtarlar) => Promise.all(anahtarlar.filter((k) => k !== SURUM).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const istek = e.request;
  if (istek.method !== "GET") return;

  const url = new URL(istek.url);

  // Firebase, Google, gstatic, Apps Script → dokunma, doğrudan ağ.
  const disKaynak = /(^|\.)(googleapis\.com|gstatic\.com|firebaseio\.com|firebaseapp\.com|google\.com|cloudfunctions\.net)$/i;
  if (url.origin !== self.location.origin || disKaynak.test(url.hostname)) {
    return; // varsayılan tarayıcı davranışı
  }

  // Aynı origin statik dosyalar: önce önbellek, arkada güncelle (stale-while-revalidate).
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

// Sayfadan "hemen güncelle" mesajı
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
