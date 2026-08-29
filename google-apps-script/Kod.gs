/**
 * =============================================================
 *  Anaokul 360 — Google Drive Fotoğraf Yükleme Servisi
 * -------------------------------------------------------------
 *  Bu betik, kreşin Google hesabına (erhankenar4@gmail.com) ait
 *  Drive'a fotoğraf yükleyen küçük bir web servisidir. Uygulama
 *  (ogretmen.js / admin.js) fotoğrafı buraya POST eder; betik
 *  dosyayı Drive'a kaydeder, "bağlantıya sahip herkes görüntüler"
 *  olarak paylaşır ve görüntü URL'sini geri döndürür.
 *
 *  KURULUM
 *  1. https://script.google.com → Yeni proje. Bu dosyanın içeriğini
 *     `Kod.gs` içine yapıştırın.
 *  2. (İsteğe bağlı ama önerilir) Proje Ayarları → "Betik özellikleri"
 *     → `YUKLEME_SIRRI` adında bir özellik ekleyin, değeri rastgele
 *     uzun bir metin olsun. Aynı değeri `js/firebase-config.js`
 *     içindeki `DRIVE_UPLOAD_SIR` alanına yazın.
 *  3. Dağıt → Yeni dağıtım → Tür: "Web uygulaması"
 *       - Yürüten: "Ben (erhankenar4@gmail.com)"
 *       - Erişimi olan: "Herkes"
 *     Dağıt → yetkileri onaylayın → çıkan `/exec` adresini kopyalayıp
 *     `js/firebase-config.js` içindeki `DRIVE_UPLOAD_URL` alanına yazın.
 *  4. Kodu her değiştirdiğinizde: Dağıt → Dağıtımları yönet → mevcut
 *     dağıtımı düzenleyip yeni sürüm yayınlayın (URL sabit kalır).
 * =============================================================
 */

var KOK_KLASOR_ADI = "Anaokul 360 Fotoğrafları";
var MAKS_BYTE = 12 * 1024 * 1024; // ~12 MB ham dosya sınırı

function doGet() {
  return ciktiJSON({ ok: true, mesaj: "Kreş fotoğraf yükleme servisi çalışıyor." });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ciktiJSON({ ok: false, hata: "Boş istek." });
    }
    var veri = JSON.parse(e.postData.contents);

    // İsteğe bağlı paylaşılan sır kontrolü
    var sir = PropertiesService.getScriptProperties().getProperty("YUKLEME_SIRRI");
    if (sir && String(veri.sir || "") !== sir) {
      return ciktiJSON({ ok: false, hata: "Yetkisiz istek." });
    }

    if (!veri.base64 || !veri.ad) {
      return ciktiJSON({ ok: false, hata: "Eksik alan: base64 / ad." });
    }

    var bytes = Utilities.base64Decode(veri.base64);
    if (bytes.length > MAKS_BYTE) {
      return ciktiJSON({ ok: false, hata: "Dosya çok büyük." });
    }

    var altAd = temizle(veri.klasor || "genel");
    var klasor = altKlasorGetir(altAd);

    var blob = Utilities.newBlob(bytes, veri.tur || "image/jpeg", temizle(veri.ad) || "foto.jpg");
    var dosya = klasor.createFile(blob);
    dosya.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var id = dosya.getId();
    return ciktiJSON({
      ok: true,
      id: id,
      goruntuUrl: "https://drive.google.com/thumbnail?id=" + id + "&sz=w1600",
      webViewLink: "https://drive.google.com/file/d/" + id + "/view"
    });
  } catch (err) {
    return ciktiJSON({ ok: false, hata: String(err) });
  }
}

function altKlasorGetir(ad) {
  var kok = klasorGetir(DriveApp, KOK_KLASOR_ADI);
  return klasorGetir(kok, ad);
}

function klasorGetir(ust, ad) {
  var it = ust.getFoldersByName(ad);
  return it.hasNext() ? it.next() : ust.createFolder(ad);
}

function temizle(s) {
  return String(s).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function ciktiJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
