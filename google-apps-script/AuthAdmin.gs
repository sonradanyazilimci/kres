/**
 * =============================================================
 *  AuthAdmin.gs — Süper-admin için Firebase Auth yönetimi
 * -------------------------------------------------------------
 *  Firebase istemci SDK'sı başka bir kullanıcının şifresini
 *  DEĞİŞTİREMEZ. Bu servis, Firebase projesinin SERVİS HESABI
 *  ile Identity Toolkit yönetici API'sini çağırır:
 *    - şifre belirleme
 *    - hesap silme
 *    - hesap pasifleştirme/aktifleştirme
 *  Spark planında çalışır (Cloud Functions gerekmez).
 *
 *  GÜVENLİK: Paylaşılan sır YOKTUR. İstek yalnızca geçerli bir
 *  Firebase kimlik jetonu ile gelir ve jetonun sahibi
 *  /superAdmins/{uid} içinde bulunmak zorundadır.
 *
 *  KURULUM
 *  1. https://script.google.com → Yeni proje → bu dosyayı yapıştır.
 *  2. Proje Ayarları → "Betik özellikleri":
 *       PROJE_ID = kres-245e9
 *       API_KEY  = (firebaseConfig.apiKey değeri)
 *       SA_JSON  = Firebase servis hesabı anahtarının TAM JSON'u
 *                  (Console → Proje Ayarları → Hizmet hesapları →
 *                   "Yeni özel anahtar oluştur")
 *  3. Dağıt → Yeni dağıtım → Web uygulaması
 *       - Yürüten: Ben
 *       - Erişimi olan: Herkes
 *     → yetkileri onayla → çıkan /exec adresini
 *       js/firebase-config.js > AUTH_ADMIN_URL alanına yaz.
 * =============================================================
 */

var P = PropertiesService.getScriptProperties();
var PROJE_ID = P.getProperty('PROJE_ID');
var API_KEY = P.getProperty('API_KEY');

function doGet() {
  return json({ ok: true, mesaj: 'Auth admin servisi çalışıyor.' });
}

function doPost(e) {
  try {
    if (!e || !e.postData) return json({ ok: false, hata: 'Boş istek.' });
    var req = JSON.parse(e.postData.contents);

    var uid = jetonDogrula(req.idToken);
    if (!uid) return json({ ok: false, hata: 'Geçersiz veya süresi dolmuş oturum.' });

    var token = saToken();
    if (!superAdminMi(uid, token)) return json({ ok: false, hata: 'Yetkisiz: süper-admin değilsiniz.' });

    if (req.islem === 'sifreBelirle') {
      if (!req.uid || !req.sifre || String(req.sifre).length < 6) {
        return json({ ok: false, hata: 'Geçerli uid ve en az 6 karakter şifre gerekli.' });
      }
      hesapGuncelle(token, { localId: req.uid, password: String(req.sifre) });
      return json({ ok: true });
    }
    if (req.islem === 'hesapSil') {
      if (!req.uid) return json({ ok: false, hata: 'uid gerekli.' });
      hesapSil(token, req.uid);
      return json({ ok: true });
    }
    if (req.islem === 'hesapDurum') {
      if (!req.uid) return json({ ok: false, hata: 'uid gerekli.' });
      hesapGuncelle(token, { localId: req.uid, disableUser: !!req.pasif });
      return json({ ok: true });
    }
    return json({ ok: false, hata: 'Bilinmeyen işlem: ' + req.islem });
  } catch (err) {
    return json({ ok: false, hata: String(err) });
  }
}

// ---- Firebase kimlik jetonunu doğrula (localId döndürür) ----
function jetonDogrula(idToken) {
  if (!idToken) return null;
  var r = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + API_KEY,
    { method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true }
  );
  if (r.getResponseCode() !== 200) return null;
  var u = JSON.parse(r.getContentText()).users;
  return (u && u[0]) ? u[0].localId : null;
}

// ---- /superAdmins/{uid} var mı? ----
function superAdminMi(uid, token) {
  var r = UrlFetchApp.fetch(
    'https://firestore.googleapis.com/v1/projects/' + PROJE_ID +
      '/databases/(default)/documents/superAdmins/' + encodeURIComponent(uid),
    { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }
  );
  return r.getResponseCode() === 200;
}

// ---- Identity Toolkit yönetici çağrıları ----
function hesapGuncelle(token, body) {
  var r = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/projects/' + PROJE_ID + '/accounts:update',
    { method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(body), muteHttpExceptions: true }
  );
  if (r.getResponseCode() !== 200) throw new Error('accounts:update ' + r.getContentText());
}
function hesapSil(token, uid) {
  var r = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/projects/' + PROJE_ID + '/accounts:delete',
    { method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ localId: uid }), muteHttpExceptions: true }
  );
  if (r.getResponseCode() !== 200) throw new Error('accounts:delete ' + r.getContentText());
}

// ---- Servis hesabı erişim jetonu (JWT -> token) ----
function saToken() {
  var sa = JSON.parse(P.getProperty('SA_JSON'));
  var now = Math.floor(Date.now() / 1000);
  var enc = function (s) { return Utilities.base64EncodeWebSafe(s).replace(/=+$/, ''); };
  var header = enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claim = enc(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  }));
  var unsigned = header + '.' + claim;
  var sig = enc(Utilities.computeRsaSha256Signature(unsigned, sa.private_key));
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }
  });
  return JSON.parse(res.getContentText()).access_token;
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
