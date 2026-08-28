// =============================================================
//  Google Drive Fotoğraf Yükleme (drive-upload.js)
//  -------------------------------------------------------------
//  Fotoğraflar Firebase Storage yerine, tek bir Google Drive
//  hesabına (kreş sahibinin hesabı) yüklenir. Yükleme, dağıtılan
//  bir Google Apps Script web uygulaması üzerinden yapılır.
//  Bkz. google-apps-script/Kod.gs ve README (Adım 4).
// =============================================================

import { DRIVE_UPLOAD_URL, DRIVE_UPLOAD_SIR } from "./firebase-config.js";

// ---------- Yardımcı: görseli küçült + JPEG'e çevir ----------
// Büyük fotoğrafları makul boyuta indirir; base64 yükü küçülür.
export function resmiKucult(file, maxKenar = 1600, kalite = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Yalnızca görsel dosyaları yüklenebilir."));
      return;
    }
    const img = new Image();
    const okuyucu = new FileReader();
    okuyucu.onload = () => { img.src = okuyucu.result; };
    okuyucu.onerror = () => reject(new Error("Dosya okunamadı."));
    img.onload = () => {
      let { width, height } = img;
      const oran = Math.min(1, maxKenar / Math.max(width, height));
      width = Math.round(width * oran);
      height = Math.round(height * oran);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", kalite);
      resolve({
        base64: dataUrl.split(",")[1],
        tur: "image/jpeg",
        genislik: width,
        yukseklik: height
      });
    };
    img.onerror = () => reject(new Error("Görsel çözümlenemedi."));
    okuyucu.readAsDataURL(file);
  });
}

// ---------- Drive'a yükle ----------
// file: <input type=file> dosyası
// klasor: Drive'da oluşturulacak alt klasör adı (örn. sınıf adı veya "okul")
// Döner: { id, goruntuUrl, webViewLink }
export async function driveYukle(file, { klasor = "genel", ad } = {}) {
  if (!DRIVE_UPLOAD_URL || DRIVE_UPLOAD_URL.startsWith("BURAYA_")) {
    throw new Error("Google Drive yükleme adresi ayarlanmamış (firebase-config.js > DRIVE_UPLOAD_URL).");
  }
  const kucuk = await resmiKucult(file);
  const dosyaAdi = (ad || file.name || "foto").replace(/[^\w.\-]+/g, "_").slice(0, 80).replace(/\.\w+$/, "") + ".jpg";

  const govde = JSON.stringify({
    sir: DRIVE_UPLOAD_SIR || "",
    klasor,
    ad: dosyaAdi,
    tur: kucuk.tur,
    base64: kucuk.base64
  });

  let yanit;
  try {
    // Content-Type ayarlanMIYOR: "basit istek" olur, CORS ön kontrolü tetiklenmez.
    yanit = await fetch(DRIVE_UPLOAD_URL, { method: "POST", body: govde });
  } catch (e) {
    throw new Error("Drive servisine ulaşılamadı. Web uygulaması dağıtımını ve erişim ayarını (‘Herkes’) kontrol edin.");
  }
  let sonuc;
  try {
    sonuc = await yanit.json();
  } catch {
    throw new Error("Drive servisinden geçersiz yanıt alındı.");
  }
  if (!sonuc.ok) throw new Error(sonuc.hata || "Drive yükleme başarısız.");

  return {
    id: sonuc.id,
    goruntuUrl: sonuc.goruntuUrl || `https://drive.google.com/thumbnail?id=${sonuc.id}&sz=w1600`,
    webViewLink: sonuc.webViewLink || `https://drive.google.com/file/d/${sonuc.id}/view`
  };
}
