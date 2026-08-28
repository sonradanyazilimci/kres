# Küçük Adımlar Kreş — Yönetim Uygulaması

Firebase (Auth + Firestore) altyapılı, framework kullanmayan (saf HTML + CSS +
Vanilla JS / ES6 modülleri) bir kreş yönetim uygulaması. Üç rol: **admin**,
**ogretmen**, **veli**.

**Fotoğraflar Firebase Storage yerine Google Drive'a yüklenir** — kreşin Google
hesabına ait Drive'da tek bir klasörde toplanır (bkz. Adım 4).

- `index.html` — Kreş tanıtım sitesi + giriş modalı
- `admin.html` / `ogretmen.html` / `veli.html` — Role özel paneller
- `css/style.css` — Tek dosya tema
- `js/` — ES6 modülleri (`firebase-config.js`, `auth.js`, `admin.js`,
  `ogretmen.js`, `veli.js`, `utils.js`, `drive-upload.js`, `kurulum.js`)
- `google-apps-script/Kod.gs` — Drive'a yükleme yapan web servisi
- `firestore.rules` — Firestore güvenlik kuralları
- `kurulum.html` — **Kurulum sihirbazı** (ilk kurulumda kullanılır, sonra silinir)
- `.firebaserc` — Firebase proje takma adı (`default` → `kres`)

---

## 0. Kısa Yol (Kurulum Sihirbazı)

1. Firebase Console → `kres` projesi → **Authentication** → E-posta/Şifre'yi aç.
2. **Firestore Database → Create database** → başlangıçta **“Test modu”** seç.
3. `js/firebase-config.js` içindeki `BURAYA_*` Firebase alanlarını doldur (Adım 2).
4. Projeyi statik sunucuyla çalıştır (`npx serve .`) ve **`http://localhost:5173/kurulum.html`** aç.
5. Sihirbazdaki adımları uygula: bağlantı testi → ilk yönetici → Drive servisi → (örnek veri).
6. Bitince `firebase deploy --only firestore:rules` ile kuralları yayınla.
7. `kurulum.html` ve `js/kurulum.js` dosyalarını sil.

Aşağıdaki bölümler her adımı ayrıntılı anlatır.

---

## 1. Firebase Projesi (Auth + Firestore)

Projeniz zaten hazır: **`kres`** (Google hesabı: `erhankenar4@gmail.com`).
Aşağıdakilerin etkin olduğundan emin olun:

### a) Authentication
- **Build → Authentication → Get started**
- **Sign-in method** → **Email/Password** → **Etkinleştir** → Kaydet.

### b) Cloud Firestore
- **Build → Firestore Database → Create database**
- Konum seçin (örn. `eur3`).
- Başlangıçta **“Test modu”** (test mode) seçin — böylece kurulum sihirbazı ilk
  yöneticiyi ve örnek veriyi yazabilir. Gerçek kuralları Adım 5'te yayınlayacağız
  ve erişim kilitlenecek.

### c) Storage — **GEREKMİYOR**
Bu uygulama Firebase Storage kullanmaz; fotoğraflar Google Drive'a gider.

### d) Web uygulaması kaydı
- **Proje Ayarları (⚙️) → Genel → "Uygulamalarınız" → Web (`</>`)**
- Takma ad verin (örn. `web`), kaydedin.
- Ekranda çıkan `firebaseConfig` değerlerini kopyalayın.

---

## 2. `js/firebase-config.js` Dosyasını Doldurma

`js/firebase-config.js` içindeki yer tutucuları gerçek değerlerle değiştirin:

```js
export const firebaseConfig = {
  apiKey:            "AIza.......",                 // BURAYA_API_KEY
  authDomain:        "kres-xxxx.firebaseapp.com",   // BURAYA_PROJE_ID.firebaseapp.com
  projectId:         "kres-xxxx",                   // BURAYA_PROJE_ID
  messagingSenderId: "1234567890",                  // BURAYA_MESSAGING_SENDER_ID
  appId:             "1:1234567890:web:abcdef"      // BURAYA_APP_ID
};

// Google Drive yükleme adresi (Adım 4'te alınır)
export const DRIVE_UPLOAD_URL = "https://script.google.com/macros/s/AKfycb.../exec";
export const DRIVE_UPLOAD_SIR = ""; // Apps Script'te YUKLEME_SIRRI ayarladıysanız aynısı
```

> Not: `firebaseConfig` değerleri gizli değildir; asıl güvenlik `firestore.rules`
> ile sağlanır. `storageBucket` alanına gerek yoktur (Storage kullanılmıyor).

---

## 3. İlk Yönetici (admin) Hesabı

### Yöntem A — Kurulum sihirbazı (önerilen)
Firestore **test modundayken**, statik sunucuyla `kurulum.html` sayfasını açın ve
**Adım 2**'deki formu doldurun. Sihirbaz hem Authentication kullanıcısını hem de
`users/{uid}` profilini (`rol: admin`) sizin için oluşturur.

### Yöntem B — Elle (sihirbaz çalışmazsa)
1. **Authentication → Users → Add user** → e-posta + şifre. Oluşan **UID**'yi kopyalayın.
2. **Firestore Database → Data → Start collection** → Koleksiyon: `users`,
   Doküman kimliği: **kopyaladığınız UID** (otomatik kimlik değil). Alanlar:

| Alan             | Tür       | Değer                      |
|------------------|-----------|----------------------------|
| `uid`            | string    | (aynı UID)                 |
| `ad`             | string    | Sistem                     |
| `soyad`          | string    | Yöneticisi                 |
| `email`          | string    | admin@...                  |
| `rol`            | string    | `admin`                    |
| `telefon`        | string    | (isteğe bağlı)             |
| `olusturmaTarihi`| timestamp | (şimdiki zaman)            |

Bundan sonra tüm öğretmen/veli hesapları **Yönetici Paneli → Kullanıcılar →
+ Yeni Kullanıcı** ile oluşturulur.

> **Kullanıcı silme:** Panelden silme yalnızca Firestore `users` kaydını siler.
> Auth hesabını tamamen kaldırmak için **Authentication → Users** ekranından da
> silin.

---

## 4. Google Drive Fotoğraf Servisi (Apps Script)

Fotoğraflar, kreşin Google hesabına ait Drive'a **`google-apps-script/Kod.gs`**
içindeki küçük web servisi üzerinden yüklenir. Kurulum:

1. `erhankenar4@gmail.com` ile giriş yapın → <https://script.google.com> → **Yeni proje**.
2. `Kod.gs` dosyasının **tüm içeriğini** editöre yapıştırın, kaydedin. Projeye bir
   ad verin (örn. "Kreş Foto Servisi").
3. **(Önerilir)** Sol menü → **Proje Ayarları** → **Betik özellikleri** →
   **Betik özelliği ekle**: ad `YUKLEME_SIRRI`, değer rastgele uzun bir metin.
   Aynı değeri `js/firebase-config.js` → `DRIVE_UPLOAD_SIR` alanına yazın.
4. Sağ üst → **Dağıt → Yeni dağıtım** → ⚙️ → **Web uygulaması**:
   - **Açıklama:** kres-foto
   - **Yürüten:** *Ben (erhankenar4@gmail.com)*
   - **Erişimi olan:** *Herkes*
   - **Dağıt** → Google izin ekranını onaylayın (Drive erişimi ister).
5. Çıkan **Web uygulaması URL'sini** (`.../exec` ile biter) kopyalayıp
   `js/firebase-config.js` → `DRIVE_UPLOAD_URL` alanına yazın.
6. Test: URL'yi tarayıcıda açın → `{"ok":true,"mesaj":"...çalışıyor."}` görmelisiniz.

> Kodu ileride değiştirirseniz: **Dağıt → Dağıtımları yönet → (kalem) Düzenle →
> Sürüm: Yeni sürüm → Dağıt**. URL sabit kalır.
>
> Yüklenen fotoğraflar Drive'da **"Küçük Adımlar Kreş Fotoğrafları"** klasörü
> altında, hedefe göre alt klasörlerde (`okul`, sınıf adı, `ogrenci-fotograflari`)
> saklanır ve "bağlantıya sahip herkes görüntüleyebilir" olarak paylaşılır.
> Uygulama görüntü adresi olarak `https://drive.google.com/thumbnail?id=...` kullanır.
>
> **Silme:** Panelden bir fotoğrafı kaldırmak yalnızca Firestore kaydını siler;
> Drive'daki dosya kalır. İstenirse Drive klasöründen elle silinebilir.

### Kim ne yükleyebilir?
- **Öğretmen:** yalnızca **kendi sınıfına** fotoğraf ekler.
- **Yönetici:** **Tüm Okul**'a veya **seçtiği herhangi bir sınıfa** ekler; ayrıca
  öğrenci profil fotoğraflarını yükler.
- **Veli:** yükleyemez; kendi çocuğunun sınıfına ait + "Tüm Okul" fotoğraflarını görür.

---

## 5. Firestore Kurallarını Yayınlama

### Yöntem A — Firebase CLI (önerilen)
```bash
npm install -g firebase-tools
firebase login                 # erhankenar4@gmail.com
firebase deploy --only firestore:rules
```
`.firebaserc` dosyası `default → kres-245e9` (gerçek proje kimliği) olarak ayarlıdır.
Gerekirse `firebase use --add` ile de seçebilirsiniz.

### Yöntem B — Konsoldan
**Firestore Database → Rules** sekmesine `firestore.rules` içeriğini yapıştırın → **Publish**.

---

## 6. Uygulamayı Çalıştırma

### Lokal
ES6 modülleri `file://` ile çalışmaz; statik sunucu gerekir:
```bash
npx serve .
# veya
python -m http.server 5173
# veya VS Code "Live Server"
```
`http://localhost:5173` adresini açın. (`localhost` Firebase Auth'ta varsayılan
olarak izinlidir.)

### Firebase Hosting'e yayınlama
```bash
firebase deploy --only hosting
# veya kurallarla birlikte:
firebase deploy
```
`https://PROJE_ID.web.app` adresinden erişilir.

> **Önemli:** Uygulamayı `localhost` dışında bir alan adında yayınlarsanız, o
> alan adını **Authentication → Settings → Authorized domains** listesine ekleyin.
> Apps Script web uygulaması "Herkes" erişimli olduğu için ayrı bir ayar gerekmez.

---

## 7. Firestore Veri Modeli

| Koleksiyon        | Alanlar |
|-------------------|---------|
| `users`           | uid, ad, soyad, email, rol (`admin`/`ogretmen`/`veli`), telefon, olusturmaTarihi |
| `siniflar`        | ad, yasGrubu, ogretmenId, kapasite |
| `ogrenciler`      | ad, soyad, dogumTarihi, sinifId, veliIds[], fotoUrl, fotoDriveId, alerjiler, notlar |
| `yoklamalar`      | ogrenciId, sinifId, tarih (`YYYY-MM-DD`), durum (`geldi`/`gec`/`gelmedi`), ogretmenId · *dok. kimliği:* `<ogrenciId>_<tarih>` |
| `gunlukRaporlar`  | ogrenciId, sinifId, tarih, yemek, uyku, tuvalet, ruhHali, etkinlik, not, ogretmenId · *dok. kimliği:* `<ogrenciId>_<tarih>` |
| `duyurular`       | baslik, icerik, hedef (`okul` veya `sinifId`), yayinlayanId, tarih |
| `duyuruOkundu`    | okunanlar[] · *dok. kimliği:* `<veliUid>` |
| `mesajlar`        | gonderenId, aliciId, katilimcilar[2], icerik, okundu, tarih |
| `odemeler`        | veliId, ogrenciId, ay (`YYYY-MM`), tutar, durum (`odendi`/`bekliyor`), tarih |
| `fotograflar`     | **hedef** (`okul` veya `sinifId`), driveId, url (Drive görüntü adresi), webViewLink, aciklama, yukleyenId, yukleyenRol, tarih |

---

## 8. Rol Bazlı Yetkiler (özet)

| İşlem | admin | ogretmen | veli |
|---|---|---|---|
| Kullanıcı/sınıf/öğrenci CRUD | ✔ | – | – |
| Dashboard & ödeme kaydı | ✔ | – | – |
| Kendi sınıfının öğrencileri | ✔ | ✔ | – |
| Yoklama / günlük rapor | ✔ | ✔ (kendi sınıfı) | – |
| Fotoğraf yükleme | ✔ (okul + her sınıf) | ✔ (kendi sınıfı) | – |
| Duyuru yayınlama | ✔ (okul/sınıf) | ✔ (kendi sınıfı) | – |
| Kendi çocuğunun raporu/yoklaması/galerisi | ✔ | – | ✔ |
| Duyuru okuma + okundu işareti | ✔ | ✔ | ✔ |
| Öğretmen ↔ Veli mesajlaşma | – | ✔ | ✔ |
| Ödeme durumu görüntüleme | ✔ | – | ✔ (kendi) |

---

## 9. Sık Karşılaşılan Sorunlar

- **"Missing or insufficient permissions"** → `firestore.rules` yayınlanmamış
  veya kullanıcının `users/{uid}` profili yok (Adım 3, 5).
- **Giriş sonrası ana sayfaya atıyor** → `users` dokümanındaki `rol` alanı yanlış
  (`admin` / `ogretmen` / `veli`, küçük harf, Türkçe karaktersiz).
- **Fotoğraf yüklenmiyor / "Drive servisine ulaşılamadı"** →
  - `DRIVE_UPLOAD_URL` `/exec` ile bitiyor ve tarayıcıda açınca `ok:true` dönüyor mu?
  - Dağıtım **"Erişimi olan: Herkes"** mi?
  - `YUKLEME_SIRRI` ayarladıysanız `DRIVE_UPLOAD_SIR` ile birebir aynı mı?
  - Kodu değiştirdiyseniz **yeni sürüm** yayınladınız mı?
- **Fotoğraf yükleniyor ama görünmüyor** → Drive dosya paylaşımı "bağlantıya sahip
  herkes" olmalı (betik bunu otomatik yapar). Kurumsal Google Workspace hesabında
  harici paylaşım kapalıysa kişisel Gmail hesabı kullanın.
- **Öğretmen panelinde "sınıfa atanmadınız"** → Yönetici panelinden sınıfa
  öğretmen ataması yapın.
- **Modül yükleme hatası** → Dosyayı `file://` ile değil statik sunucudan açın.
