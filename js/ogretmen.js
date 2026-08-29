// =============================================================
//  Öğretmen Paneli (ogretmen.js)
//  Sınıf öğrencileri, yoklama, günlük rapor, galeri, duyuru, mesaj.
// =============================================================

import {
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { sayfaKorumasi, cikisYap } from "./auth.js";
import { kol, bel, aktifKres, kilitEkraniGoster } from "./kres.js";
import { driveYukle } from "./drive-upload.js";
import {
  $, $$, el, escapeHtml, toast, setLoading, emptyState, openModal, confirmDialog,
  formatDate, formatDateTime, isoDate, yasHesapla, basHarfler, firebaseHata,
  kurPanelGezinme, kurCikis, kullaniciRozeti, formData, raporKart, RAPOR_HARIKA
} from "./utils.js";

// Var olmayan bir doküman okunduğunda, güvenlik kuralları `resource.data`
// alanına eriştiği için `permission-denied` fırlatabilir. Bu sarmalayıcı
// böyle bir durumu "kayıt yok" olarak ele alır.
async function belgeGetir(ref) {
  try {
    return await getDoc(ref);
  } catch (e) {
    if (e?.code === "permission-denied") return { exists: () => false, data: () => ({}) };
    throw e;
  }
}

// ---------- Durum ----------
let baglam = null;
let profil = null;
let yazma = true;
let sinif = null;
let ogrenciler = [];
let veliHaritasi = new Map();   // veliId -> {ad, soyad, ...}
let seciliMesajKisi = null;
let mesajAboneligi = null;
let raporChipKuruldu = false;   // rapor çipleri bir kez kurulur
let galeriTarih = isoDate();    // galeride seçili gün

const RAPOR_EMOJI = {
  "Hepsini yedi": "😋", "Yarısını yedi": "🙂", "Az yedi": "😕", "Yemedi": "🙁",
  "Rahat uyudu": "😴", "Kısa uyudu": "😪", "Uyumadı": "🙅",
  "Sorunsuz": "👍", "Yardım gerekti": "🤝", "Kaza oldu": "💧",
  "Neşeli": "😄", "Sakin": "😌", "Huzursuz": "😣", "Ağladı": "😢"
};

function yazmaKontrol() {
  if (!yazma) { toast("Kreş aboneliği pasif — kayıt yapılamıyor.", "warning"); return false; }
  return true;
}

// ---------- Başlangıç ----------
baglam = await sayfaKorumasi("ogretmen");
profil = baglam.profil || { uid: baglam.uid, ad: "Öğretmen", soyad: "", email: "" };
yazma = baglam.aktif;
kullaniciRozeti(profil);
kurCikis(() => cikisYap());
if (!baglam.aktif) kilitEkraniGoster(aktifKres());

const nav = kurPanelGezinme({
  sinifim: "Sınıfım", yoklama: "Yoklama", rapor: "Günlük Rapor",
  galeri: "Galeri", duyurular: "Duyurular", mesajlar: "Mesajlar", istek: "Yönetime İstek"
}, gorunumDegisti);

$("#istekForm").addEventListener("submit", istekGonder);
$("#galeriTarih").addEventListener("change", (e) => { galeriTarih = e.target.value || isoDate(); galeriYukle(); });
$("#galeriBugun").addEventListener("click", () => { galeriTarih = isoDate(); $("#galeriTarih").value = galeriTarih; galeriYukle(); });

await sinifiYukle();

// =============================================================
//  SINIF & ÖĞRENCİLER
// =============================================================
async function sinifiYukle() {
  const sSnap = await getDocs(query(kol("siniflar"), where("ogretmenId", "==", profil.uid)));
  if (sSnap.empty) {
    $("#sinifAdi").textContent = "Henüz bir sınıfa atanmadınız.";
    $("#sinifYas").remove();
    ogrenciler = [];
    emptyState($("#ogrenci-izgara"), "Yönetici sizi bir sınıfa atadığında öğrencileriniz burada görünecek.", "🏫");
    return;
  }
  sinif = { id: sSnap.docs[0].id, ...sSnap.docs[0].data() };
  $("#sinifAdi").textContent = sinif.ad;
  $("#sinifYas").textContent = sinif.yasGrubu || "";

  const oSnap = await getDocs(query(kol("ogrenciler"), where("sinifId", "==", sinif.id)));
  ogrenciler = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ad || "").localeCompare(b.ad || "", "tr"));
  $("#sinifMevcut").textContent = `${ogrenciler.length} öğrenci`;

  // Velileri getir
  const veliIds = [...new Set(ogrenciler.flatMap((o) => o.veliIds || []))];
  await Promise.all(veliIds.map(async (id) => {
    const vs = await getDoc(bel("users", id));
    if (vs.exists()) veliHaritasi.set(id, { id, ...vs.data() });
  }));

  renderOgrenciKartlari();
  doldurOgrenciSecici();
  $("#yoklamaTarih").value = isoDate();
  $("#raporTarih").value = isoDate();
  sinifPanoYukle();
}

// ---------- Sınıfım: bugünün mini panosu ----------
async function sinifPanoYukle() {
  const kap = $("#sinif-pano");
  if (!kap) return;
  if (!sinif || !ogrenciler.length) { kap.innerHTML = ""; return; }
  const bugun = isoDate();
  const [ySnaplar, rSnaplar] = await Promise.all([
    Promise.all(ogrenciler.map((o) => belgeGetir(bel("yoklamalar", `${o.id}_${bugun}`)))),
    Promise.all(ogrenciler.map((o) => belgeGetir(bel("gunlukRaporlar", `${o.id}_${bugun}`))))
  ]);
  let geldi = 0, gec = 0, gelmedi = 0, isaretli = 0;
  ySnaplar.forEach((s) => {
    if (!s.exists()) return;
    isaretli++;
    const d = s.data().durum;
    if (d === "geldi") geldi++; else if (d === "gec") gec++; else if (d === "gelmedi") gelmedi++;
  });
  const raporlu = rSnaplar.filter((s) => s.exists()).length;
  const oge = (deger, etiket, tur) =>
    `<div class="pano-oge pano-oge--${tur}"><div class="pano-oge__sayi">${deger}</div><div class="pano-oge__etiket">${etiket}</div></div>`;
  kap.innerHTML =
    oge(geldi, "Geldi", "basari") +
    oge(gec, "Geç", "uyari") +
    oge(gelmedi, "Gelmedi", "hata") +
    oge(ogrenciler.length - isaretli, "İşaretsiz", "notr") +
    oge(`${raporlu}/${ogrenciler.length}`, "Rapor girildi", "bilgi");
}

function renderOgrenciKartlari() {
  const c = $("#ogrenci-izgara");
  if (!ogrenciler.length) { emptyState(c, "Sınıfınızda kayıtlı öğrenci yok"); return; }
  c.innerHTML = "";
  ogrenciler.forEach((o) => {
    c.appendChild(el("div", { class: "ogrenci-kart" },
      avatar(o),
      el("h4", {}, `${o.ad} ${o.soyad}`),
      el("div", { class: "alt" }, o.dogumTarihi ? `${yasHesapla(o.dogumTarihi)} yaş` : "—"),
      o.alerjiler ? el("div", { class: "rozet rozet--uyari mt-1" }, o.alerjiler) : null,
      el("div", { class: "kart-aksiyon" },
        el("button", { class: "btn btn--ghost btn--sm", onClick: () => ogrenciDetay(o) }, "Detay"),
        el("button", { class: "btn btn--secondary btn--sm", onClick: () => raporlaOgrenci(o) }, "📝 Rapor")
      )
    ));
  });
}

function avatar(o, sinif2 = "") {
  const a = el("span", { class: `avatar ${sinif2}` });
  if (o.fotoUrl) a.appendChild(el("img", { src: o.fotoUrl, alt: o.ad }));
  else a.textContent = basHarfler(o.ad, o.soyad);
  return a;
}

function ogrenciDetay(o) {
  const veliAdlari = (o.veliIds || []).map((id) => {
    const v = veliHaritasi.get(id);
    return v ? `${v.ad} ${v.soyad} (${v.telefon || v.email})` : id;
  });
  openModal(`${o.ad} ${o.soyad}`, el("div", {},
    satir("Yaş", o.dogumTarihi ? `${yasHesapla(o.dogumTarihi)} (${formatDate(o.dogumTarihi)})` : "—"),
    satir("Sınıf", sinif?.ad || "—"),
    satir("Veli(ler)", veliAdlari.join(", ") || "—"),
    satir("Alerji / Sağlık", o.alerjiler || "Yok"),
    satir("Notlar", o.notlar || "—")
  ));
}
const satir = (b, d) => el("div", { class: "rapor-satir" }, el("strong", {}, b), el("span", {}, d));

// =============================================================
//  GÖRÜNÜM DEĞİŞİMİ (tembel yükleme)
// =============================================================
function gorunumDegisti(ad) {
  if (ad === "istek") { isteklerimYukle(); return; }   // sınıf gerekmez
  if (!sinif) return;
  if (ad === "yoklama") yoklamaYukle();
  if (ad === "rapor") raporYukle();
  if (ad === "galeri") galeriYukle();
  if (ad === "duyurular") duyurulariYukle();
  if (ad === "mesajlar") mesajlasmaKur();
}

// =============================================================
//  YOKLAMA
// =============================================================
$("#yoklamaTarih").addEventListener("change", yoklamaYukle);
$("#yoklamaKaydet").addEventListener("click", yoklamaKaydet);
$("#yoklamaTumuGeldi").addEventListener("click", yoklamaTumuGeldi);
let yoklamaSecim = {}; // ogrenciId -> durum

function durumRozet(id, durum) {
  const d = $("#" + id);
  if (!d) return;
  const harita = {
    kayitli: ["Kaydedildi", "rozet--basari"],
    yeni: ["Henüz kaydedilmedi", "rozet--uyari"],
    degisti: ["Kaydedilmemiş değişiklik", "rozet--uyari"],
    kaydedildi: ["Kaydedildi ✓", "rozet--basari"]
  };
  const [metin, sinifAdi] = harita[durum] || ["", ""];
  d.textContent = metin;
  d.className = "rapor-durum rozet " + sinifAdi;
}

async function yoklamaYukle() {
  if (!sinif) return;
  const tarih = $("#yoklamaTarih").value || isoDate();
  const c = $("#yoklama-liste");
  setLoading(c);
  yoklamaSecim = {};
  // Deterministik doküman kimlikleriyle çek (bileşik indeks gerektirmez).
  const snaplar = await Promise.all(
    ogrenciler.map((o) => belgeGetir(bel("yoklamalar", `${o.id}_${tarih}`)))
  );
  snaplar.forEach((s) => { if (s.exists()) yoklamaSecim[s.data().ogrenciId] = s.data().durum; });

  if (!ogrenciler.length) { emptyState(c, "Öğrenci yok"); return; }
  c.innerHTML = "";
  ogrenciler.forEach((o) => {
    const sar = el("div", { class: "yoklama-satir" },
      avatar(o),
      el("span", { class: "isim" }, `${o.ad} ${o.soyad}`),
      el("div", { class: "yoklama-secim", dataset: { ogrenci: o.id } },
        yoklamaBtn(o.id, "geldi", "Geldi", "sec-geldi"),
        yoklamaBtn(o.id, "gec", "Geç geldi", "sec-gec"),
        yoklamaBtn(o.id, "gelmedi", "Gelmedi", "sec-gelmedi")
      )
    );
    c.appendChild(sar);
  });
  durumRozet("yoklamaDurum", Object.keys(yoklamaSecim).length ? "kayitli" : "yeni");
}

function yoklamaBtn(ogrenciId, durum, metin, sinifAdi) {
  const b = el("button", { class: sinifAdi, type: "button" }, metin);
  if (yoklamaSecim[ogrenciId] === durum) b.classList.add("aktif");
  b.addEventListener("click", () => {
    yoklamaSecim[ogrenciId] = durum;
    b.parentElement.querySelectorAll("button").forEach((x) => x.classList.remove("aktif"));
    b.classList.add("aktif");
    durumRozet("yoklamaDurum", "degisti");
  });
  return b;
}

// Tüm öğrencileri "geldi" işaretle
function yoklamaTumuGeldi() {
  if (!ogrenciler.length) return;
  ogrenciler.forEach((o) => { yoklamaSecim[o.id] = "geldi"; });
  $$("#yoklama-liste .yoklama-secim").forEach((grup) => {
    grup.querySelectorAll("button").forEach((x) =>
      x.classList.toggle("aktif", x.classList.contains("sec-geldi")));
  });
  durumRozet("yoklamaDurum", "degisti");
}

async function yoklamaKaydet() {
  if (!yazmaKontrol()) return;
  const tarih = $("#yoklamaTarih").value || isoDate();
  const secilenler = Object.entries(yoklamaSecim);
  if (!secilenler.length) { toast("En az bir öğrenci işaretleyin.", "warning"); return; }
  const btn = $("#yoklamaKaydet");
  btn.disabled = true; btn.textContent = "Kaydediliyor...";
  try {
    await Promise.all(secilenler.map(([ogrenciId, durum]) =>
      setDoc(bel("yoklamalar", `${ogrenciId}_${tarih}`), {
        ogrenciId, sinifId: sinif.id, tarih, durum,
        ogretmenId: profil.uid, guncelleme: serverTimestamp()
      })
    ));
    toast("Yoklama kaydedildi.", "success");
    durumRozet("yoklamaDurum", "kaydedildi");
    sinifPanoYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
  btn.disabled = false; btn.textContent = "Yoklamayı Kaydet";
}

// =============================================================
//  GÜNLÜK RAPOR
// =============================================================
$("#raporTarih").addEventListener("change", raporYukle);
$("#raporOgrenci").addEventListener("change", raporYukle);
$("#raporForm").addEventListener("submit", raporKaydet);
$("#raporForm").addEventListener("input", () => { raporDurumAyarla("degisti"); raporOnizlemeTazele(); });
$("#raporHarika").addEventListener("click", raporHarikaDoldur);
$("#raporOncekiOgr").addEventListener("click", () => raporOgrenciGez(-1));
$("#raporSonrakiOgr").addEventListener("click", () => raporOgrenciGez(1));

function doldurOgrenciSecici() {
  $("#raporOgrenci").innerHTML = ogrenciler
    .map((o) => `<option value="${o.id}">${escapeHtml(o.ad)} ${escapeHtml(o.soyad)}</option>`).join("");
  kurRaporChipleri();
}

// Her .rapor-select için emoji'li dokunmatik çip satırı oluştur (bir kez)
function kurRaporChipleri() {
  if (raporChipKuruldu) return;
  raporChipKuruldu = true;
  $$(".rapor-select").forEach((sel) => {
    const grup = el("div", { class: "rapor-cipler" });
    [...sel.options].forEach((opt) => {
      const b = el("button", { type: "button", class: "rapor-cip", dataset: { deger: opt.value } },
        el("span", { class: "e" }, RAPOR_EMOJI[opt.value] || "•"),
        el("span", {}, opt.textContent));
      b.addEventListener("click", () => {
        sel.value = opt.value;
        cipleriSenkronla(sel, grup);
        raporDurumAyarla("degisti");
      });
      grup.appendChild(b);
    });
    sel.insertAdjacentElement("afterend", grup);
    cipleriSenkronla(sel, grup);
  });
}
function cipleriSenkronla(sel, grup) {
  grup.querySelectorAll(".rapor-cip").forEach((b) =>
    b.classList.toggle("aktif", b.dataset.deger === sel.value));
  raporOnizlemeTazele();
}
function tumCipleriSenkronla() {
  $$(".rapor-select").forEach((sel) => {
    const grup = sel.nextElementSibling;
    if (grup && grup.classList.contains("rapor-cipler")) cipleriSenkronla(sel, grup);
  });
}

function raporOnizlemeTazele() {
  const f = $("#raporForm");
  const kap = $("#rapor-onizleme");
  if (!f || !kap) return;
  const v = {
    yemek: f.yemek.value, uyku: f.uyku.value, tuvalet: f.tuvalet.value,
    ruhHali: f.ruhHali.value, etkinlik: f.etkinlik.value, not: f.not.value
  };
  const secili = ogrenciler.find((o) => o.id === $("#raporOgrenci").value);
  kap.innerHTML = "";
  kap.appendChild(raporKart(v, { baslik: secili ? `${secili.ad} ${secili.soyad}` : "" }));
}

function raporDurumAyarla(durum) {
  const d = $("#raporDurum");
  if (!d) return;
  const harita = {
    kayitli: ["Kaydedildi", "rozet--basari"],
    yeni: ["Henüz kaydedilmedi", "rozet--uyari"],
    degisti: ["Kaydedilmemiş değişiklik", "rozet--uyari"],
    kaydedildi: ["Kaydedildi ✓", "rozet--basari"]
  };
  const [metin, sinifAdi] = harita[durum] || ["", ""];
  d.textContent = metin;
  d.className = "rapor-durum rozet " + sinifAdi;
}

async function raporYukle() {
  if (!sinif) return;
  const ogrenciId = $("#raporOgrenci").value;
  const tarih = $("#raporTarih").value || isoDate();
  if (!ogrenciId) return;
  const snap = await belgeGetir(bel("gunlukRaporlar", `${ogrenciId}_${tarih}`));
  const f = $("#raporForm");
  const v = snap.exists() ? snap.data() : {};
  f.yemek.value = v.yemek || "Hepsini yedi";
  f.uyku.value = v.uyku || "Rahat uyudu";
  f.tuvalet.value = v.tuvalet || "Sorunsuz";
  f.ruhHali.value = v.ruhHali || "Neşeli";
  f.etkinlik.value = v.etkinlik || "";
  f.not.value = v.not || "";
  tumCipleriSenkronla();
  raporOnizlemeTazele();
  raporDurumAyarla(snap.exists() ? "kayitli" : "yeni");
}

function raporHarikaDoldur() {
  const f = $("#raporForm");
  Object.entries(RAPOR_HARIKA).forEach(([k, val]) => { f[k].value = val; });
  tumCipleriSenkronla();
  raporOnizlemeTazele();
  raporDurumAyarla("degisti");
}

function raporOgrenciGez(yon) {
  const sec = $("#raporOgrenci");
  const yeni = sec.selectedIndex + yon;
  if (yeni < 0 || yeni >= sec.options.length) return;
  sec.selectedIndex = yeni;
  raporYukle();
}

// Sınıfım görünümünden bir öğrenci için hızlı rapor
function raporlaOgrenci(o) {
  nav.goster("rapor");
  const sec = $("#raporOgrenci");
  sec.value = o.id;
  raporYukle();
}

async function raporKaydet(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  const ogrenciId = $("#raporOgrenci").value;
  const tarih = $("#raporTarih").value || isoDate();
  if (!ogrenciId) { toast("Öğrenci seçin.", "warning"); return; }
  const veri = formData(e.target);
  try {
    await setDoc(bel("gunlukRaporlar", `${ogrenciId}_${tarih}`), {
      ogrenciId, sinifId: sinif.id, tarih,
      yemek: veri.yemek, uyku: veri.uyku, tuvalet: veri.tuvalet,
      ruhHali: veri.ruhHali, etkinlik: veri.etkinlik || "", not: veri.not || "",
      ogretmenId: profil.uid, guncelleme: serverTimestamp()
    });
    toast("Rapor kaydedildi.", "success");
    raporDurumAyarla("kaydedildi");
    sinifPanoYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  GALERİ
// =============================================================
$("#fotoForm").addEventListener("submit", fotoYukle);

async function fotoYukle(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  if (!sinif) { toast("Bir sınıfa atanmadığınız için fotoğraf yükleyemezsiniz.", "warning"); return; }
  const dosya = $("#fotoDosya").files[0];
  if (!dosya) return;
  const btn = $("#fotoYukleBtn");
  btn.disabled = true; btn.textContent = "Yükleniyor...";
  try {
    const yuklenen = await driveYukle(dosya, {
      url: aktifKres()?.driveUrl, sir: aktifKres()?.driveSir, klasor: sinif.ad || sinif.id
    });
    await addDoc(kol("fotograflar"), {
      hedef: sinif.id,
      driveId: yuklenen.id,
      url: yuklenen.goruntuUrl,
      webViewLink: yuklenen.webViewLink,
      aciklama: $("#fotoAciklama").value.trim(),
      yukleyenId: profil.uid,
      yukleyenRol: "ogretmen",
      tarih: serverTimestamp()
    });
    e.target.reset();
    toast("Fotoğraf yüklendi.", "success");
    galeriYukle();
  } catch (err) { toast(err.message || firebaseHata(err), "error", 6000); }
  btn.disabled = false; btn.textContent = "Yükle";
}

// Firestore Timestamp -> "YYYY-MM-DD"
function fotoGunu(f) {
  const d = f.tarih?.toDate ? f.tarih.toDate() : (f.tarih ? new Date(f.tarih) : null);
  return d ? isoDate(d) : "";
}

async function galeriYukle() {
  if (!sinif) return;
  const c = $("#foto-izgara");
  const tarihInput = $("#galeriTarih");
  if (tarihInput && !tarihInput.value) tarihInput.value = galeriTarih;
  setLoading(c);
  // Tüm koleksiyonu çekip istemcide süz: kendi sınıfı + okul geneli.
  const snap = await getDocs(kol("fotograflar"));
  const hepsi = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((f) => f.hedef === sinif.id || f.hedef === "okul");
  const bugun = isoDate();
  const foto = hepsi.filter((f) => fotoGunu(f) === galeriTarih)
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));

  const bilgi = $("#galeri-bilgi");
  if (bilgi) {
    bilgi.textContent = galeriTarih === bugun
      ? `Bugünün fotoğrafları (${foto.length}). Başka bir günü görmek için tarih seçin.`
      : `${formatDate(galeriTarih)} — ${foto.length} fotoğraf.`;
  }

  if (!foto.length) {
    emptyState(c, galeriTarih === bugun ? "Bugün için fotoğraf yok" : `${formatDate(galeriTarih)} için fotoğraf yok`, "📷");
    return;
  }
  c.innerHTML = "";
  foto.forEach((f) => {
    const benim = f.yukleyenId === profil.uid;
    c.appendChild(el("figure", { class: "foto-oge" },
      el("img", { src: f.url, alt: f.aciklama || "Fotoğraf", loading: "lazy" }),
      el("figcaption", {},
        el("div", {}, `${f.aciklama || ""}${f.aciklama ? " · " : ""}${formatDate(f.tarih)}`),
        el("div", { class: "satir-arasi mt-1" },
          el("span", { class: `rozet ${f.hedef === "okul" ? "rozet--mor" : "rozet--bilgi"}` },
            f.hedef === "okul" ? "Tüm Okul" : "Sınıfım"),
          benim ? el("button", { class: "btn btn--danger btn--sm", onClick: () => fotoSil(f.id) }, "Sil") : null
        )
      )
    ));
  });
}

async function fotoSil(id) {
  const ok = await confirmDialog("Bu fotoğraf galeriden kaldırılsın mı? (Google Drive'daki dosya silinmez.)");
  if (!ok) return;
  try {
    await deleteDoc(bel("fotograflar", id));
    toast("Fotoğraf kaldırıldı.", "success");
    galeriYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  DUYURULAR
// =============================================================
$("#duyuruForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  if (!sinif) { toast("Bir sınıfa atanmadığınız için duyuru yayınlayamazsınız.", "warning"); return; }
  const veri = formData(e.target);
  try {
    await addDoc(kol("duyurular"), {
      baslik: veri.baslik, icerik: veri.icerik,
      hedef: sinif.id, yayinlayanId: profil.uid, tarih: serverTimestamp()
    });
    e.target.reset();
    toast("Duyuru yayınlandı.", "success");
    duyurulariYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
});

async function duyurulariYukle() {
  const c = $("#duyuru-liste");
  setLoading(c);
  const snap = await getDocs(kol("duyurular"));
  const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.hedef === "okul" || d.hedef === sinif.id)
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  if (!liste.length) { emptyState(c, "Duyuru yok", "📢"); return; }
  c.innerHTML = "";
  liste.forEach((d) => {
    c.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, d.baslik),
        el("span", { class: "liste-oge__tarih" }, formatDateTime(d.tarih))
      ),
      el("p", {}, d.icerik),
      el("span", { class: "rozet rozet--bilgi mt-1" }, d.hedef === "okul" ? "Tüm Okul" : "Sınıfım")
    ));
  });
}

// =============================================================
//  YÖNETİME İSTEK
// =============================================================
const ISTEK_ROZET = { yeni: "uyari", inceleniyor: "bilgi", tamamlandi: "basari", reddedildi: "hata" };
const ISTEK_METIN = { yeni: "Bekliyor", inceleniyor: "İnceleniyor", tamamlandi: "Tamamlandı", reddedildi: "Reddedildi" };

async function istekGonder(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  const v = formData(e.target);
  const btn = $("#istekBtn");
  btn.disabled = true; btn.textContent = "Gönderiliyor...";
  try {
    await addDoc(kol("talepler"), {
      ogretmenId: profil.uid,
      sinifId: e.target.querySelector("#istekSinif").checked ? (sinif?.id || null) : null,
      baslik: v.baslik,
      icerik: v.icerik,
      oncelik: v.oncelik || "orta",
      durum: "yeni",
      yanit: "",
      tarih: serverTimestamp()
    });
    e.target.reset();
    toast("İsteğiniz yönetime iletildi.", "success");
    isteklerimYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
  btn.disabled = false; btn.textContent = "Gönder";
}

async function isteklerimYukle() {
  const c = $("#istek-liste");
  setLoading(c);
  const snap = await getDocs(query(kol("talepler"), where("ogretmenId", "==", profil.uid)));
  const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  if (!liste.length) { emptyState(c, "Henüz istek göndermediniz", "📨"); return; }
  c.innerHTML = "";
  liste.forEach((t) => {
    const silinebilir = t.durum === "yeni";
    c.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, t.baslik),
        el("span", { class: "liste-oge__tarih" }, formatDateTime(t.tarih))
      ),
      el("p", {}, t.icerik),
      el("div", { class: "satir-arasi mt-1" },
        el("span", { class: `rozet rozet--${ISTEK_ROZET[t.durum] || "uyari"}` }, ISTEK_METIN[t.durum] || t.durum),
        t.oncelik ? el("span", { class: "rozet" }, "Öncelik: " + t.oncelik) : null,
        t.sinifId ? el("span", { class: "rozet rozet--bilgi" }, "Sınıfımla ilgili") : null
      ),
      t.yanit ? el("div", { class: "rapor-kart__metin mt-1" }, el("strong", {}, "Yönetim yanıtı: "), document.createTextNode(t.yanit)) : null,
      silinebilir ? el("div", { class: "satir-arasi mt-1" },
        el("button", { class: "btn btn--danger btn--sm", onClick: () => istekSil(t.id) }, "Geri çek")) : null
    ));
  });
}

async function istekSil(id) {
  if (!await confirmDialog("Bu istek geri çekilsin mi?")) return;
  try {
    await deleteDoc(bel("talepler", id));
    toast("Geri çekildi.", "success");
    isteklerimYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  MESAJLAŞMA
// =============================================================
function mesajlasmaKur() {
  const kisiler = [...veliHaritasi.values()];
  const c = $("#mesaj-kisiler");
  if (!kisiler.length) { emptyState(c, "Görüşülecek veli yok"); return; }
  c.innerHTML = "";
  kisiler.forEach((v) => {
    const b = el("button", { class: "mesaj-kisi", dataset: { id: v.id } },
      el("span", { class: "avatar" }, basHarfler(v.ad, v.soyad)),
      el("span", {}, el("span", { class: "isim" }, `${v.ad} ${v.soyad}`), el("br"), el("span", { class: "rol" }, "Veli"))
    );
    b.addEventListener("click", () => mesajKisiSec(v));
    c.appendChild(b);
  });
}

function mesajKisiSec(v) {
  seciliMesajKisi = v;
  $$(".mesaj-kisi").forEach((x) => x.classList.toggle("aktif", x.dataset.id === v.id));
  $("#mesaj-baslik").textContent = `${v.ad} ${v.soyad}`;
  $("#mesaj-input").disabled = false;
  $("#mesaj-yaz").querySelector("button").disabled = false;

  if (mesajAboneligi) mesajAboneligi();
  const q = query(kol("mesajlar"), where("katilimcilar", "array-contains", profil.uid));
  mesajAboneligi = onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.katilimcilar.includes(v.id))
      .sort((a, b) => (a.tarih?.seconds || 0) - (b.tarih?.seconds || 0));
    renderMesajlar(msgs);
    // Karşı taraftan gelen okunmamışları okundu yap
    msgs.filter((m) => m.aliciId === profil.uid && !m.okundu)
      .forEach((m) => updateDoc(bel("mesajlar", m.id), { okundu: true }).catch(() => {}));
  });
}

function renderMesajlar(msgs) {
  const c = $("#mesaj-akis");
  if (!msgs.length) { c.innerHTML = '<p class="soluk metin-merkez">Henüz mesaj yok. İlk mesajı siz gönderin.</p>'; return; }
  c.innerHTML = "";
  msgs.forEach((m) => {
    const benim = m.gonderenId === profil.uid;
    c.appendChild(el("div", { class: `balon ${benim ? "balon--ben" : "balon--karsi"}` },
      document.createTextNode(m.icerik),
      el("span", { class: "zaman" }, formatDateTime(m.tarih))
    ));
  });
  c.scrollTop = c.scrollHeight;
}

$("#mesaj-yaz").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!yazma) { toast("Kreş aboneliği pasif — mesaj gönderilemiyor.", "warning"); return; }
  const inp = $("#mesaj-input");
  const metin = inp.value.trim();
  if (!metin || !seciliMesajKisi) return;
  inp.value = "";
  try {
    await addDoc(kol("mesajlar"), {
      gonderenId: profil.uid,
      aliciId: seciliMesajKisi.id,
      katilimcilar: [profil.uid, seciliMesajKisi.id],
      icerik: metin,
      okundu: false,
      tarih: serverTimestamp()
    });
  } catch (err) { toast(firebaseHata(err), "error"); inp.value = metin; }
});
