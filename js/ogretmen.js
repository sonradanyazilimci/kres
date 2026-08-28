// =============================================================
//  Öğretmen Paneli (ogretmen.js)
//  Sınıf öğrencileri, yoklama, günlük rapor, galeri, duyuru, mesaj.
// =============================================================

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, ROLES } from "./firebase-config.js";
import { driveYukle } from "./drive-upload.js";
import { sayfaKorumasi, cikisYap } from "./auth.js";
import {
  $, el, escapeHtml, toast, setLoading, emptyState, openModal, confirmDialog,
  formatDate, formatDateTime, isoDate, yasHesapla, basHarfler, firebaseHata,
  kurPanelGezinme, kurCikis, kullaniciRozeti, formData
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
let profil = null;
let sinif = null;
let ogrenciler = [];
let veliHaritasi = new Map();   // veliId -> {ad, soyad, ...}
let seciliMesajKisi = null;
let mesajAboneligi = null;

// ---------- Başlangıç ----------
profil = await sayfaKorumasi(ROLES.OGRETMEN);
kullaniciRozeti(profil);
kurCikis(() => cikisYap());

const nav = kurPanelGezinme({
  sinifim: "Sınıfım", yoklama: "Yoklama", rapor: "Günlük Rapor",
  galeri: "Galeri", duyurular: "Duyurular", mesajlar: "Mesajlar"
}, gorunumDegisti);

await sinifiYukle();

// =============================================================
//  SINIF & ÖĞRENCİLER
// =============================================================
async function sinifiYukle() {
  const sSnap = await getDocs(query(collection(db, "siniflar"), where("ogretmenId", "==", profil.uid)));
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

  const oSnap = await getDocs(query(collection(db, "ogrenciler"), where("sinifId", "==", sinif.id)));
  ogrenciler = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ad || "").localeCompare(b.ad || "", "tr"));
  $("#sinifMevcut").textContent = `${ogrenciler.length} öğrenci`;

  // Velileri getir
  const veliIds = [...new Set(ogrenciler.flatMap((o) => o.veliIds || []))];
  await Promise.all(veliIds.map(async (id) => {
    const vs = await getDoc(doc(db, "users", id));
    if (vs.exists()) veliHaritasi.set(id, { id, ...vs.data() });
  }));

  renderOgrenciKartlari();
  doldurOgrenciSecici();
  $("#yoklamaTarih").value = isoDate();
  $("#raporTarih").value = isoDate();
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
        el("button", { class: "btn btn--ghost btn--sm", onClick: () => ogrenciDetay(o) }, "Detay")
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
let yoklamaSecim = {}; // ogrenciId -> durum

async function yoklamaYukle() {
  if (!sinif) return;
  const tarih = $("#yoklamaTarih").value || isoDate();
  const c = $("#yoklama-liste");
  setLoading(c);
  yoklamaSecim = {};
  // Deterministik doküman kimlikleriyle çek (bileşik indeks gerektirmez).
  const snaplar = await Promise.all(
    ogrenciler.map((o) => belgeGetir(doc(db, "yoklamalar", `${o.id}_${tarih}`)))
  );
  snaplar.forEach((s) => { if (s.exists()) yoklamaSecim[s.data().ogrenciId] = s.data().durum; });

  if (!ogrenciler.length) { emptyState(c, "Öğrenci yok"); return; }
  c.innerHTML = "";
  ogrenciler.forEach((o) => {
    const sar = el("div", { class: "yoklama-satir" },
      avatar(o),
      el("span", { class: "isim" }, `${o.ad} ${o.soyad}`),
      el("div", { class: "yoklama-secim" },
        yoklamaBtn(o.id, "geldi", "Geldi", "sec-geldi"),
        yoklamaBtn(o.id, "gec", "Geç geldi", "sec-gec"),
        yoklamaBtn(o.id, "gelmedi", "Gelmedi", "sec-gelmedi")
      )
    );
    c.appendChild(sar);
  });
}

function yoklamaBtn(ogrenciId, durum, metin, sinifAdi) {
  const b = el("button", { class: sinifAdi, type: "button" }, metin);
  if (yoklamaSecim[ogrenciId] === durum) b.classList.add("aktif");
  b.addEventListener("click", () => {
    yoklamaSecim[ogrenciId] = durum;
    b.parentElement.querySelectorAll("button").forEach((x) => x.classList.remove("aktif"));
    b.classList.add("aktif");
  });
  return b;
}

async function yoklamaKaydet() {
  const tarih = $("#yoklamaTarih").value || isoDate();
  const secilenler = Object.entries(yoklamaSecim);
  if (!secilenler.length) { toast("En az bir öğrenci işaretleyin.", "warning"); return; }
  const btn = $("#yoklamaKaydet");
  btn.disabled = true; btn.textContent = "Kaydediliyor...";
  try {
    await Promise.all(secilenler.map(([ogrenciId, durum]) =>
      setDoc(doc(db, "yoklamalar", `${ogrenciId}_${tarih}`), {
        ogrenciId, sinifId: sinif.id, tarih, durum,
        ogretmenId: profil.uid, guncelleme: serverTimestamp()
      })
    ));
    toast("Yoklama kaydedildi.", "success");
  } catch (err) { toast(firebaseHata(err), "error"); }
  btn.disabled = false; btn.textContent = "Yoklamayı Kaydet";
}

// =============================================================
//  GÜNLÜK RAPOR
// =============================================================
$("#raporTarih").addEventListener("change", raporYukle);
$("#raporOgrenci").addEventListener("change", raporYukle);
$("#raporForm").addEventListener("submit", raporKaydet);

function doldurOgrenciSecici() {
  $("#raporOgrenci").innerHTML = ogrenciler
    .map((o) => `<option value="${o.id}">${escapeHtml(o.ad)} ${escapeHtml(o.soyad)}</option>`).join("");
}

async function raporYukle() {
  if (!sinif) return;
  const ogrenciId = $("#raporOgrenci").value;
  const tarih = $("#raporTarih").value || isoDate();
  if (!ogrenciId) return;
  const snap = await belgeGetir(doc(db, "gunlukRaporlar", `${ogrenciId}_${tarih}`));
  const f = $("#raporForm");
  const v = snap.exists() ? snap.data() : {};
  f.yemek.value = v.yemek || "Hepsini yedi";
  f.uyku.value = v.uyku || "Rahat uyudu";
  f.tuvalet.value = v.tuvalet || "Sorunsuz";
  f.ruhHali.value = v.ruhHali || "Neşeli";
  f.etkinlik.value = v.etkinlik || "";
  f.not.value = v.not || "";
}

async function raporKaydet(e) {
  e.preventDefault();
  const ogrenciId = $("#raporOgrenci").value;
  const tarih = $("#raporTarih").value || isoDate();
  if (!ogrenciId) { toast("Öğrenci seçin.", "warning"); return; }
  const veri = formData(e.target);
  try {
    await setDoc(doc(db, "gunlukRaporlar", `${ogrenciId}_${tarih}`), {
      ogrenciId, sinifId: sinif.id, tarih,
      yemek: veri.yemek, uyku: veri.uyku, tuvalet: veri.tuvalet,
      ruhHali: veri.ruhHali, etkinlik: veri.etkinlik || "", not: veri.not || "",
      ogretmenId: profil.uid, guncelleme: serverTimestamp()
    });
    toast("Rapor kaydedildi.", "success");
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  GALERİ
// =============================================================
$("#fotoForm").addEventListener("submit", fotoYukle);

async function fotoYukle(e) {
  e.preventDefault();
  if (!sinif) { toast("Bir sınıfa atanmadığınız için fotoğraf yükleyemezsiniz.", "warning"); return; }
  const dosya = $("#fotoDosya").files[0];
  if (!dosya) return;
  const btn = $("#fotoYukleBtn");
  btn.disabled = true; btn.textContent = "Yükleniyor...";
  try {
    const yuklenen = await driveYukle(dosya, { klasor: sinif.ad || sinif.id });
    await addDoc(collection(db, "fotograflar"), {
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

async function galeriYukle() {
  if (!sinif) return;
  const c = $("#foto-izgara");
  setLoading(c);
  // Tüm koleksiyonu çekip istemcide süz: kendi sınıfı + okul geneli.
  const snap = await getDocs(collection(db, "fotograflar"));
  const foto = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((f) => f.hedef === sinif.id || f.hedef === "okul")
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  if (!foto.length) { emptyState(c, "Henüz fotoğraf yok", "📷"); return; }
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
    await deleteDoc(doc(db, "fotograflar", id));
    toast("Fotoğraf kaldırıldı.", "success");
    galeriYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  DUYURULAR
// =============================================================
$("#duyuruForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sinif) { toast("Bir sınıfa atanmadığınız için duyuru yayınlayamazsınız.", "warning"); return; }
  const veri = formData(e.target);
  try {
    await addDoc(collection(db, "duyurular"), {
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
  const snap = await getDocs(collection(db, "duyurular"));
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
  const q = query(collection(db, "mesajlar"), where("katilimcilar", "array-contains", profil.uid));
  mesajAboneligi = onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.katilimcilar.includes(v.id))
      .sort((a, b) => (a.tarih?.seconds || 0) - (b.tarih?.seconds || 0));
    renderMesajlar(msgs);
    // Karşı taraftan gelen okunmamışları okundu yap
    msgs.filter((m) => m.aliciId === profil.uid && !m.okundu)
      .forEach((m) => updateDoc(doc(db, "mesajlar", m.id), { okundu: true }).catch(() => {}));
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
  const inp = $("#mesaj-input");
  const metin = inp.value.trim();
  if (!metin || !seciliMesajKisi) return;
  inp.value = "";
  try {
    await addDoc(collection(db, "mesajlar"), {
      gonderenId: profil.uid,
      aliciId: seciliMesajKisi.id,
      katilimcilar: [profil.uid, seciliMesajKisi.id],
      icerik: metin,
      okundu: false,
      tarih: serverTimestamp()
    });
  } catch (err) { toast(firebaseHata(err), "error"); inp.value = metin; }
});

// $$ kısayolu (utils'te var ama burada da lazım)
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
