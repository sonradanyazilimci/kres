# Küçük Adımlar — Çok-Kiracılı Kreş Yönetim SaaS'ı

Firebase (Auth + Firestore) altyapılı, framework kullanmayan (saf HTML + CSS +
Vanilla JS / ES6 modülleri) **çok-kiracılı** kreş yönetim uygulaması.
Her kreş kendi verisinde yalıtılmıştır; kreşler kendi kaydını açar, 14 gün
ücretsiz dener. Fotoğraflar her kreşin **kendi Google Drive** hesabına yüklenir.

Roller: **superadmin** (sağlayıcı = siz) · **admin** (kreş yöneticisi) ·
**ogretmen** · **veli**.

---

## Dosya haritası

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Tanıtım sitesi + giriş modalı + "Kreşinizi Kaydedin"; metinler `/site/anasayfa`'dan panelle güncellenebilir |
| `kayit.html` / `js/kayit.js` | Kreş self-servis kaydı → sağlayıcı onay kuyruğu |
| `admin.html` / `js/admin.js` | Kreş yönetici paneli — kullanıcı/sınıf/öğrenci, duyuru, tarih bazlı galeri, **aidat toplu tahakkuku + ödeme onayı**, **öğretmen talepleri**, **izin/belge gönderimi + veli onay takibi**, Ayarlar |
| `ogretmen.html` / `js/ogretmen.js` | Öğretmen paneli — Sınıfım mini panosu, emoji'li günlük rapor çipleri + canlı önizleme, yoklamada "Tümü geldi", tarih bazlı galeri, **yönetime istek formu** |
| `veli.html` / `js/veli.js` | Veli paneli (KVKK açık rıza kapısı); günlük rapor emoji kartı, tarih bazlı galeri, **"Ödedim" bildirimi**, **izin/belge onay-ret** |
| `yonetim.html` / `js/yonetim.js` | **Sağlayıcı (süper-admin) paneli** — sistem özeti + toplam tahsilat, kreş onayı, istediğin gün abonelik, abonelik tahsilat defteri, anasayfa içerik editörü, kreş+yönetici oluşturma, personel ekleme, şifre sıfırlama, kullanıcı/kreş silme |
| `js/kres.js` | Kiracı bağlamı: kresId, abonelik durumu, yol yardımcıları, denetim günlüğü |
| `js/auth.js` | Giriş, dizin okuma (`/kullaniciDizini`), role göre yönlendirme |
| `js/site-icerik.js` | `/site/anasayfa` içeriğini okur/yazar + index.html'e uygular |
| `js/drive-upload.js` | Fotoğrafı kreşin kendi Apps Script /exec adresine yükler |
| `js/utils.js` · `js/pwa.js` | Yardımcılar (ortak `raporKart` dahil) · PWA kaydı |
| `aydinlatma-metni.html` · `kvkk-politikasi.html` · `veri-sozlesmesi.html` | **KVKK metin şablonları** (hukukçuya inceletin) |
| `firestore.rules` | Çok-kiracılı güvenlik kuralları |
| `scripts/goc.mjs` | Eski düz koleksiyonları çok-kiracılı yapıya taşıyan tek seferlik göç |
| `scripts/yedekle.mjs` · `.github/workflows/yedek.yml` | Yedekleme (Spark planda çalışır) |
| `google-apps-script/Kod.gs` | Her kreşin dağıttığı Drive yükleme servisi |
| `manifest.webmanifest` · `sw.js` · `icons/` | PWA (telefona kurulabilir uygulama) |

---

## Veri Modeli (çok-kiracılı)

```
/superAdmins/{uid}                         → { not }                (sağlayıcı; ilk kayıt Console'dan)
/kullaniciDizini/{uid}                     → { kresId, rol }        (giriş sonrası yönlendirme + kurallar)
/kresler/{kresId}                          → { ad, sahibiUid, plan("deneme"|"abonelik"),
                                              durum("aktif"|"pasif"), denemeBitis(ts),
                                              marka:{renk}, kvkkOnay:{surum,tarih}, driveUrl, driveSir }
/kresler/{kresId}/users/{uid}              → { uid, ad, soyad, email, rol, telefon, riza:{onay,surum,tarih} }
/kresler/{kresId}/siniflar/{id}            → { ad, yasGrubu, ogretmenId, kapasite }
/kresler/{kresId}/ogrenciler/{id}          → { ad, soyad, dogumTarihi, sinifId, veliIds[], fotoUrl, fotoDriveId, alerjiler, notlar }
/kresler/{kresId}/yoklamalar/{ogr_tarih}   → { ogrenciId, sinifId, tarih, durum, ogretmenId }
/kresler/{kresId}/gunlukRaporlar/{ogr_tarih}
/kresler/{kresId}/duyurular/{id}           → { baslik, icerik, hedef("okul"|sinifId), yayinlayanId, tarih }
/kresler/{kresId}/duyuruOkundu/{veliUid}   → { okunanlar[] }
/kresler/{kresId}/mesajlar/{id}            → { gonderenId, aliciId, katilimcilar[2], icerik, okundu, tarih }
/kresler/{kresId}/odemeler/{id}            → { veliId, ogrenciId, ay, tutar, aciklama,
                                              durum("bekliyor"|"bildirildi"|"odendi"), tarih,
                                              bildirim?:{tarih,yontem,not}, onay?:{tarih,onaylayanId} }   (aidat; toplu tahakkuk + veli "ödedim" bildirimi + yönetici onayı)
/kresler/{kresId}/fotograflar/{id}         → { hedef, driveId, url, webViewLink, aciklama, yukleyenId, yukleyenRol, tarih }   (galeri gün bazlı süzülür)
/kresler/{kresId}/talepler/{id}            → { ogretmenId, sinifId|null, baslik, icerik, oncelik,
                                              durum("yeni"|"inceleniyor"|"tamamlandi"|"reddedildi"), yanit, tarih }   (öğretmen → yönetim isteği)
/kresler/{kresId}/izinBelgeleri/{id}       → { tur("gezi"|"izin"|"belge"), baslik, metin, hedefSiniflar[], etkinlikTarihi, olusturanId, tarih }
/kresler/{kresId}/izinBelgeleri/{id}/yanitlar/{veliUid} → { ogrenciId, karar("onay"|"ret"), not, tarih }   (veli onayı; her veli kendi dokümanını yazar)
/kresler/{kresId}/aboneOdemeleri/{id}      → { tarih, tutar, yontem, not, uzatmaGun, kaydeden }   (sağlayıcı tahsilat defteri; sadece süper-admin yazar, kreş yöneticisi okur)
/kresler/{kresId}/islemKayitlari/{id}      → { kim, islem, detay, tarih }   (KVKK denetim günlüğü — append-only)
/site/anasayfa                             → { heroBaslik, heroLead, ozellik1Baslik, ... }   (index.html metinleri; herkese açık okuma, süper-admin yazar)
```

**Abonelik mantığı:** `plan == "deneme"` ise `denemeBitis` geçince kreş "pasif"
sayılır (istemci + kurallar birlikte). Pasif kreşte **okuma serbest, yazma yok**.
Sağlayıcı `yonetim.html`'den "Abonelik başlat" / "+30 gün" / "Pasif yap" yapar.
*(Gerçek ödeme entegrasyonu Faz 2.)*

---

## Kurulum

### 1. Firebase
Proje: **`kres-245e9`** (`erhankenar4@gmail.com`). Etkin olması gerekenler:
- **Authentication → Email/Password**
- **Firestore Database** (bölge: `eur3`)

`js/firebase-config.js` gerçek değerlerle doludur.

### 2. Güvenlik kurallarını yayınla
```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```
veya Firebase Console → Firestore → **Rules** → `firestore.rules` içeriğini yapıştır → **Publish**.

### 3. İlk süper-admin (sağlayıcı)
Firebase Console → Firestore → Data → **`superAdmins`** koleksiyonu →
doküman kimliği = **sizin Auth UID'niz** (Authentication → Users), tek alan `not: "vendor"`.
Artık o hesap `yonetim.html`'e girer.

**Süper-admin yetkileri** (`yonetim.html`):
- Sistem özeti (kreş / aktif / onay bekleyen / pasif / öğretmen / veli sayıları + **toplam tahsilat**)
- **+ Yeni Kreş** → kreş + yönetici hesabı oluşturur, şifreyi ekranda gösterir + şifre belirleme e-postası atar
- Kreş **Detay** → o kreşin tüm kullanıcıları; her biri için **Şifre sıfırla** (e-posta) / **Sil**; **+ Kullanıcı Ekle** (her rol); **Abonelik Ödemeleri** listesi + **+ Ödeme**
- **Onayla** (onay bekleyen kreş) / **Abonelik/Süre** (istediğin gün) / **+30 gün** / **Pasif↔Aktif**
- **＋ Ödeme** → abonelik tahsilatı kaydı (tarih / tutar / yöntem / not); isteğe bağlı "aboneliği X gün uzat" ile bitiş tarihini otomatik ilerletir
- **💰 Abonelik Ödemeleri** → tüm kreşlerin tahsilat dökümü + toplam gelir
- **🖥️ Anasayfa İçeriği** → `index.html` metinleri (hero, 6 özellik kartı, fiyat notu, iletişim bilgileri, footer) `/site/anasayfa` dokümanına yazılır; ziyaretçi sayfayı açınca uygulanır
- **Kreş Sil** → tüm alt-koleksiyonlar + dizin kayıtları cascade silinir (kreş adı yazılarak onaylanır)
- **🛡️ Süper-admin Ekle** → başka bir UID'yi süper-admin yapar
- Güvenlik kuralları: süper-admin **tüm sistemi okuyabilir** ve her koleksiyona yazabilir.

> Auth hesabı **silme** hâlâ istemciden yapılamaz (Blaze/Admin SDK gerektirir).
> Kullanıcı/kreş silindiğinde ilgili Firebase Authentication hesaplarını
> **Authentication → Users** ekranından ayrıca kaldırın.

### 4. (İlk kez) Demo kreş / göç
- **Yeni sistemde:** demo verisi tarayıcıdan süper-admin oturumuyla oluşturulur ya da
  `scripts/goc.mjs` ile eski düz koleksiyonlar taşınır:
  ```bash
  npm i firebase-admin
  # serviceAccountKey.json: Console → Proje Ayarları → Hizmet hesapları → Yeni özel anahtar
  node scripts/goc.mjs ./serviceAccountKey.json <SUPERADMIN_UID>
  ```
- **Eski düz koleksiyonlar** (`/users`, `/siniflar`, ...) yeni kurallarda erişilemez;
  göçten sonra Firestore Console'dan **"Delete collection"** ile silin.

### 5. Yeni kreş nasıl katılır (müşteri akışı)
1. `index.html` → **Kreşinizi Kaydedin** → `kayit.html` formu (kreş adı + yönetici + KVKK onayı).
2. 14 gün tam erişim başlar. Yönetici panelinde üstte deneme bandı görünür.
3. **Ayarlar → Fotoğraf Servisi:** kreş, `google-apps-script/Kod.gs`'i kendi Google
   hesabında dağıtıp `/exec` adresini (ve varsa `YUKLEME_SIRRI`) buraya girer.
4. **Ayarlar:** kreş adı, tema rengi, KVKK metin bağlantıları, "Tüm veriyi dışa aktar".

---

## Çalıştırma

```bash
npx serve .        # veya  python -m http.server 5173
```
`http://localhost:5173`. PWA kurulumu ve gerçek telefon testi için **HTTPS** gerekir:
```bash
firebase deploy --only hosting     # https://kres-245e9.web.app
```

---

## Yedekleme (Spark planda)

Cloud Functions/Scheduler yok. Seçenekler:
- **Elle / cron:** `node scripts/yedekle.mjs ./serviceAccountKey.json ./yedekler`
  → tüm koleksiyonları (alt-koleksiyonlar dahil) tarihli JSON olarak yazar.
- **GitHub Actions:** `.github/workflows/yedek.yml` her gün çalışır. Repo →
  Settings → Secrets → Actions → `FIREBASE_SA_KEY` (servis hesabı JSON'unun tamamı).
- Kreş bazında dışa aktarma: yönetici panelinde **Ayarlar → Tüm veriyi dışa aktar**.

---

## KVKK Notları

- `aydinlatma-metni.html`, `kvkk-politikasi.html`, `veri-sozlesmesi.html` **örnek
  şablondur** — yürürlüğe koymadan bir hukukçuya inceletin, kurum bilgilerinizle doldurun.
- Veli ilk girişte **açık rıza** verir (fotoğraf + sağlık verisi); `users/{uid}.riza`'da saklanır.
- Kayıtta kreş sahibi sözleşmeleri onaylar; `kresler/{id}.kvkkOnay`'da saklanır.
- Hassas işlemler (kullanıcı oluştur/sil, veri dışa aktar, ayar değişikliği)
  `islemKayitlari` denetim günlüğüne yazılır (yalnızca-ekleme).

---

## Demo Giriş Bilgileri

| Rol | E-posta | Şifre |
|---|---|---|
| Sağlayıcı (süper-admin) | `erhankenar35@gmail.com` | `1122334455` → `yonetim.html` |
| Demo kreş yöneticisi | `demo@kucukadimlarkres.com` | `Demo123456` |
| Demo öğretmen | `ogretmen1.*@ornek.com` | `ornek123` |
| Demo veli | `veli1.*@ornek.com` | `ornek123` |

*(Öğretmen/veli e-postalarındaki `*` kısmı göç sırasında üretilen 5 haneli damgadır;
kesin adresler için `yonetim.html` veya Firestore'a bakın.)*

---

## Sık Sorunlar

- **`permission-denied`** → kurallar yayınlanmamış, kullanıcının `/kullaniciDizini/{uid}`
  kaydı yok, ya da kreş "pasif" (deneme bitmiş) durumda yazmaya çalışılıyor.
- **Giriş sonrası ana sayfaya atıyor** → hesabın `/kullaniciDizini` kaydı yok
  (kreşe bağlı değil) veya `rol` alanı hatalı.
- **Süper-admin panele giremiyor** → `/superAdmins/{uid}` dokümanı yok (Adım 3).
- **Fotoğraf yüklenmiyor** → Ayarlar'da kreşin Drive `/exec` adresi girilmemiş /
  dağıtım "Herkes" erişimli değil / `YUKLEME_SIRRI` eşleşmiyor.
- **Kod değişikliği görünmüyor** → `sw.js` içindeki `SURUM`'u artırın veya hard refresh (Ctrl+Shift+R).
