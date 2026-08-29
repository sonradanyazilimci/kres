// =============================================================
//  Öğretmen Paneli (ogretmen.js)
//  Sınıf öğrencileri, yoklama, günlük rapor, galeri, duyuru, mesaj.
// =============================================================

import {
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { sayfaKorumasi, cikisYap } from "./auth.js";
import { kol, bel, aktifKres, aktifKresId, kilitEkraniGoster, bildirimGonder } from "./kres.js";
import { kurBildirimZili } from "./bildirim.js";
import { sistemDuyurulariniGoster } from "./sistem-duyuru.js";
import { temaBaslat } from "./tema.js";
import { driveYukle } from "./drive-upload.js";
import {
  $, $$, el, escapeHtml, toast, setLoading, emptyState, openModal, closeModal, confirmDialog,
  formatDate, formatDateTime, isoDate, yasHesapla, basHarfler, firebaseHata,
  kurPanelGezinme, kurCikis, kullaniciRozeti, formData, raporKart, RAPOR_HARIKA,
  haftaBaslangici, haftaGunleri, haftaEtiket, haftaKaydir
} from "./utils.js";
import {
  RANDEVU_DURUM, randevulariGetir, randevuGuncelle,
  kapiSinifGunluk,
  ilacKaydet, ilacSil, ilaclariGetir, ilacUygula, ilacUygulamalariGetir, ilacBugunAktif,
  olcumEkle, olcumSil, olcumleriGetir, bmiHesapla, miniCizgiGrafik,
  ANKET_TUR, anketleriGetir, anketleriRoleGore, anketYanitla, benimAnketYanitim,
  ajandaGetir, ajandaOtomatik, ajandaSirala, AJANDA_TUR,
  belgePaylas, belgeleriGetir, belgeSil
} from "./moduller.js";

temaBaslat();

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
let ogrProgramHafta = haftaBaslangici();

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
kurBildirimZili({ profil, kresId: aktifKresId() });
sistemDuyurulariniGoster();

const nav = kurPanelGezinme({
  sinifim: "Sınıfım", yoklama: "Yoklama", rapor: "Günlük Rapor", toplurapor: "Toplu Rapor",
  galeri: "Galeri", duyurular: "Duyurular", program: "Yemek & Program",
  mesajlar: "Mesajlar", istek: "Yönetime İstek"
}, gorunumDegisti);
$("#ogrProgramKaydet").addEventListener("click", ogrProgramKaydet);
$("#ogrProgramOnceki").addEventListener("click", () => { ogrProgramHafta = haftaKaydir(ogrProgramHafta, -1); programGorunumuYukle(); });
$("#ogrProgramSonraki").addEventListener("click", () => { ogrProgramHafta = haftaKaydir(ogrProgramHafta, 1); programGorunumuYukle(); });

$("#istekForm").addEventListener("submit", istekGonder);
$("#galeriTarih").addEventListener("change", (e) => { galeriTarih = e.target.value || isoDate(); galeriYukle(); });
$("#galeriBugun").addEventListener("click", () => { galeriTarih = isoDate(); $("#galeriTarih").value = galeriTarih; galeriYukle(); });
$("#raporSakin").addEventListener("click", () => raporPresetUygula(RAPOR_PRESET.sakin));
$("#raporZor").addEventListener("click", () => raporPresetUygula(RAPOR_PRESET.zor));
$("#raporKopyala").addEventListener("click", sonRaporuKopyala);
$("#topluTarih").addEventListener("change", topluRaporYukle);
$("#topluKaydet").addEventListener("click", topluRaporKaydet);

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
  const gozlemKap = el("div", { id: "gozlem-kap" });
  openModal(`${o.ad} ${o.soyad}`, el("div", {},
    satir("Yaş", o.dogumTarihi ? `${yasHesapla(o.dogumTarihi)} (${formatDate(o.dogumTarihi)})` : "—"),
    satir("Sınıf", sinif?.ad || "—"),
    satir("Veli(ler)", veliAdlari.join(", ") || "—"),
    satir("Alerji / Sağlık", o.alerjiler || "Yok"),
    satir("Notlar", o.notlar || "—"),
    el("div", { class: "kutu__ust mt-2", style: "margin-bottom:6px" },
      el("h3", {}, "Gözlem Günlüğü"),
      el("span", { class: "soluk" }, "yalnızca öğretmen ve yönetici görür")),
    el("form", { id: "gozlemForm" },
      el("div", { class: "form-grup" },
        el("textarea", { name: "metin", required: "", rows: "2", placeholder: "Gözlem / not (veliye kapalı)..." })),
      el("button", { class: "btn btn--primary btn--sm", type: "submit" }, "Gözlem Ekle")),
    gozlemKap
  ), { genis: true });

  $("#gozlemForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!yazmaKontrol()) return;
    const metin = formData(e.target).metin;
    if (!metin) return;
    try {
      await addDoc(kol("gozlemler"), {
        ogrenciId: o.id, sinifId: sinif.id, ogretmenId: profil.uid,
        metin, tarih: serverTimestamp()
      });
      e.target.reset();
      gozlemleriYukle(o.id);
    } catch (err) { toast(firebaseHata(err), "error"); }
  });
  gozlemleriYukle(o.id);
}
const satir = (b, d) => el("div", { class: "rapor-satir" }, el("strong", {}, b), el("span", {}, d));

async function gozlemleriYukle(ogrenciId) {
  const kap = $("#gozlem-kap");
  if (!kap) return;
  setLoading(kap);
  // Sınıf bazlı sorgula (kurallar ogrenciId filtresine izin vermiyor), istemcide süz
  const snap = await getDocs(query(kol("gozlemler"), where("sinifId", "==", sinif.id)));
  const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((g) => g.ogrenciId === ogrenciId)
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  if (!liste.length) { emptyState(kap, "Henüz gözlem yok", "📓"); return; }
  kap.innerHTML = "";
  liste.forEach((g) => {
    const benim = g.ogretmenId === profil.uid;
    kap.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("span", { class: "soluk" }, formatDateTime(g.tarih)),
        benim ? el("button", { class: "btn btn--danger btn--sm", onClick: () => gozlemSil(g.id, ogrenciId) }, "Sil") : null),
      el("p", {}, g.metin)
    ));
  });
}

async function gozlemSil(id, ogrenciId) {
  if (!await confirmDialog("Bu gözlem silinsin mi?")) return;
  try {
    await deleteDoc(bel("gozlemler", id));
    gozlemleriYukle(ogrenciId);
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  GÖRÜNÜM DEĞİŞİMİ (tembel yükleme)
// =============================================================
function gorunumDegisti(ad) {
  if (ad === "istek") { isteklerimYukle(); return; }   // sınıf gerekmez
  if (ad === "randevular") { randevulariYukleOgr(); return; }
  if (ad === "anketler") { anketleriYukleOgr(); return; }
  if (ad === "ajanda") { ajandayiYukleOgr(); return; }
  if (!sinif) return;
  if (ad === "yoklama") yoklamaYukle();
  if (ad === "rapor") raporYukle();
  if (ad === "toplurapor") topluRaporYukle();
  if (ad === "galeri") galeriYukle();
  if (ad === "duyurular") duyurulariYukle();
  if (ad === "program") programGorunumuYukle();
  if (ad === "mesajlar") mesajlasmaKur();
  if (ad === "kurumzili") kurumziliYukleOgr();
  if (ad === "saglik") saglikYukleOgr();
  if (ad === "belgeler") belgeleriYukleOgr();
}

// =============================================================
//  ORTAK YARDIMCI
// =============================================================
const ogrById = (id) => ogrenciler.find((o) => o.id === id) || null;
function saglikOgrenciSecici(sel) {
  if (!sel) return;
  const eski = sel.value;
  sel.innerHTML = ogrenciler.map((o) => `<option value="${o.id}">${escapeHtml(o.ad)} ${escapeHtml(o.soyad)}</option>`).join("");
  if (eski && ogrById(eski)) sel.value = eski;
}

// =============================================================
//  RANDEVULARIM
// =============================================================
async function randevulariYukleOgr() {
  const c = $("#randevu-liste");
  setLoading(c);
  let liste;
  try { liste = await randevulariGetir({ personelUid: profil.uid }); }
  catch (err) { emptyState(c, firebaseHata(err), "⚠️"); return; }
  if (!liste.length) { emptyState(c, "Size gelen randevu yok.", "📅"); return; }
  c.innerHTML = "";
  liste.forEach((r) => {
    const d = RANDEVU_DURUM[r.durum] || { e: r.durum, r: "bilgi" };
    const o = ogrById(r.ogrenciId);
    c.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, `${escapeHtml(r.konu || "Randevu")} — ${formatDate(r.tarih)}${r.saat ? " " + escapeHtml(r.saat) : ""}`),
        el("span", { class: `rozet rozet--${d.r}` }, d.e)),
      el("p", { class: "soluk" }, o ? `${o.ad} ${o.soyad}` : ""),
      r.veliNot ? el("div", { class: "rapor-kart__metin mt-1" }, el("strong", {}, "Veli notu: "), document.createTextNode(r.veliNot)) : null,
      r.personelNot ? el("div", { class: "rapor-kart__metin mt-1" }, el("strong", {}, "Notunuz: "), document.createTextNode(r.personelNot)) : null,
      el("div", { class: "satir-arasi mt-1" },
        el("button", { class: "btn btn--primary btn--sm", onClick: () => randevuYanitla(r) }, "Yanıtla / Durum"))
    ));
  });
}

function randevuYanitla(r) {
  const form = el("form", {},
    el("div", { class: "form-grup" }, el("label", {}, "Durum"),
      el("select", { name: "durum" },
        ...["bekliyor", "onaylandi", "reddedildi", "tamamlandi"].map((k) =>
          el("option", { value: k, ...(r.durum === k ? { selected: "" } : {}) }, RANDEVU_DURUM[k].e)))),
    el("div", { class: "form-grup" }, el("label", {}, "Not (veliye görünür)"),
      el("textarea", { name: "personelNot" }, r.personelNot || "")),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Kaydet")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!yazmaKontrol()) return;
    const v = formData(form);
    try {
      await randevuGuncelle(r.id, { durum: v.durum, personelNot: v.personelNot || "", guncelleme: serverTimestamp() });
      bildirimGonder(r.veliUid, "randevu", "Randevu güncellendi",
        `${r.konu || "Randevu"} — ${RANDEVU_DURUM[v.durum].e}`, "randevular");
      closeModal();
      toast("Güncellendi.", "success");
      randevulariYukleOgr();
    } catch (err) { toast(firebaseHata(err), "error"); }
  });
  openModal("Randevu — " + escapeHtml(r.konu || ""), form);
}

// =============================================================
//  KURUM ZİLİ (bugünkü panosu)
// =============================================================
async function kurumziliYukleOgr() {
  const c = $("#kurumzili-liste");
  if (!sinif) { emptyState(c, "Sınıf atanmadı.", "🔔"); return; }
  setLoading(c);
  let kayitlar;
  try { kayitlar = await kapiSinifGunluk(sinif.id); }
  catch (err) { emptyState(c, firebaseHata(err), "⚠️"); return; }
  const aktif = kayitlar.filter((k) => k.geliyorumAt || k.geldimAt);
  if (!aktif.length) { emptyState(c, "Bugün henüz “Geliyorum / Geldim” bildirimi yok.", "🔕"); return; }
  const sirali = aktif.sort((a, b) => (b.geldimAt?.seconds || b.geliyorumAt?.seconds || 0) - (a.geldimAt?.seconds || a.geliyorumAt?.seconds || 0));
  c.innerHTML = "";
  sirali.forEach((k) => {
    const o = ogrById(k.ogrenciId);
    const kapida = !!k.geldimAt;
    c.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, o ? `${o.ad} ${o.soyad}` : k.ogrenciId),
        el("span", { class: `rozet rozet--${kapida ? "basari" : "uyari"}` }, kapida ? "🚪 Kapıda" : "🚗 Yolda")),
      el("p", { class: "soluk" },
        (k.geliyorumAt ? "Geliyorum: " + formatDateTime(k.geliyorumAt) : "") +
        (k.geldimAt ? "  ·  Geldim: " + formatDateTime(k.geldimAt) : ""))
    ));
  });
}

// =============================================================
//  SAĞLIK & GELİŞİM
// =============================================================
async function saglikYukleOgr() {
  if (!sinif) { emptyState($("#ilac-liste"), "Sınıf atanmadı.", "🩺"); return; }
  const sel = $("#saglikOgrenci");
  if (!sel.dataset.kuruldu) {
    saglikOgrenciSecici(sel);
    sel.dataset.kuruldu = "1";
    sel.addEventListener("change", saglikDetayYukle);
  }
  await saglikDetayYukle();
}

async function saglikDetayYukle() {
  const o = ogrById($("#saglikOgrenci").value);
  if (!o) return;
  const ic = $("#ilac-liste"), bc = $("#bugun-ilac"), oc = $("#olcum-icerik");
  setLoading(ic); oc.innerHTML = ""; bc.innerHTML = "";

  let ilaclar = [], uyg = [];
  try { ilaclar = await ilaclariGetir({ sinifId: sinif.id }); } catch { /* yoksay */ }
  try { uyg = await ilacUygulamalariGetir({ sinifId: sinif.id }); } catch { /* yoksay */ }
  const oIlac = ilaclar.filter((x) => x.ogrenciId === o.id);
  const bugun = isoDate();
  const bugunUyg = uyg.filter((u) => u.tarih === bugun);

  // Bugün uygulanacaklar (tüm sınıf)
  const bekleyen = ilaclar.filter((x) => ilacBugunAktif(x)).map((x) => ({
    ilac: x, uygulandi: bugunUyg.some((u) => u.ilacId === x.id)
  }));
  if (bekleyen.length) {
    bc.appendChild(el("p", { class: "soluk" }, "Bugün sınıfta uygulanacak ilaçlar:"));
    bekleyen.forEach(({ ilac, uygulandi }) => {
      const og = ogrById(ilac.ogrenciId);
      bc.appendChild(el("div", { class: "satir-arasi", style: "margin:4px 0" },
        el("span", {}, `${uygulandi ? "✅" : "⏳"} ${og ? og.ad + " " + og.soyad : ""} — ${escapeHtml(ilac.ad)}`),
        uygulandi ? null : el("button", { class: "btn btn--primary btn--sm", onClick: () => ilacUygulaTiki(ilac) }, "Uygulandı")
      ));
    });
  }

  ic.innerHTML = "";
  if (!oIlac.length) emptyState(ic, "Bu öğrenci için kayıtlı ilaç yok.", "💊");
  else oIlac.forEach((il) => {
    const gecmis = uyg.filter((u) => u.ilacId === il.id).slice(0, 5);
    ic.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, escapeHtml(il.ad)),
        el("span", { class: `rozet rozet--${ilacBugunAktif(il) ? "basari" : "bilgi"}` }, ilacBugunAktif(il) ? "Aktif" : "Pasif")),
      el("p", { class: "soluk" }, `${escapeHtml(il.doz || "")}${il.talimat ? " · " + escapeHtml(il.talimat) : ""}${il.saatler ? " · " + escapeHtml(il.saatler) : ""}${il.baslangic ? " · " + il.baslangic + (il.bitis ? " → " + il.bitis : "") : ""}`),
      gecmis.length ? el("div", { class: "rapor-kart__metin mt-1" }, el("strong", {}, "Son uygulamalar: "),
        document.createTextNode(gecmis.map((g) => `${formatDate(g.tarih)} ${g.saat || ""}`).join(", "))) : null,
      el("div", { class: "satir-arasi mt-1" },
        el("button", { class: "btn btn--secondary btn--sm", onClick: () => ilacUygulaTiki(il) }, "💊 Uygulandı"),
        el("button", { class: "btn btn--ghost btn--sm", onClick: () => ilacFormu(il) }, "Düzenle"),
        el("button", { class: "btn btn--danger btn--sm", onClick: () => ilacSilTiki(il) }, "Sil"))
    ));
  });

  // Ölçümler
  let olcumler = [];
  try { olcumler = await olcumleriGetir({ sinifId: sinif.id }); } catch { /* yoksay */ }
  const oOlcum = olcumler.filter((x) => x.ogrenciId === o.id);
  oc.innerHTML = "";
  if (!oOlcum.length) { emptyState(oc, "Ölçüm yok. “+ Ölçüm Ekle” ile başlayın.", "📏"); return; }
  const son = oOlcum[oOlcum.length - 1];
  const b = bmiHesapla(son.boy, son.kilo);
  oc.appendChild(el("div", { class: "satir-arasi mb-1" },
    el("span", { class: "rozet rozet--bilgi" }, `Boy: ${son.boy} cm`),
    el("span", { class: "rozet rozet--bilgi" }, `Kilo: ${son.kilo} kg`),
    b ? el("span", { class: "rozet" }, `VKİ: ${b.toFixed(1)}`) : null));
  oc.appendChild(el("h3", { style: "font-size:1rem;margin:12px 0 4px" }, "Boy (cm)"));
  oc.appendChild(miniCizgiGrafik(oOlcum.map((x) => ({ x: x.tarih, y: Number(x.boy) })), { birim: " cm", renk: "#4bb3a7" }));
  oc.appendChild(el("h3", { style: "font-size:1rem;margin:12px 0 4px" }, "Kilo (kg)"));
  oc.appendChild(miniCizgiGrafik(oOlcum.map((x) => ({ x: x.tarih, y: Number(x.kilo) })), { birim: " kg" }));
  oc.appendChild(el("div", { class: "mt-1" },
    ...oOlcum.slice().reverse().map((x) => el("div", { class: "satir-arasi", style: "margin:3px 0" },
      el("span", { class: "soluk" }, `${formatDate(x.tarih)} — ${x.boy} cm / ${x.kilo} kg`),
      el("button", { class: "btn btn--ghost btn--sm", onClick: () => olcumSilTiki(x) }, "Sil")))));
}

function ilacFormu(mevcut = null) {
  const o = ogrById($("#saglikOgrenci").value);
  if (!o) { toast("Önce öğrenci seçin.", "warning"); return; }
  const f = el("form", {},
    el("div", { class: "form-grup" }, el("label", {}, "İlaç adı"), el("input", { name: "ad", required: "", value: mevcut?.ad || "" })),
    el("div", { class: "form-satir" },
      el("div", { class: "form-grup" }, el("label", {}, "Doz"), el("input", { name: "doz", value: mevcut?.doz || "", placeholder: "Örn: 5 ml" })),
      el("div", { class: "form-grup" }, el("label", {}, "Saat(ler)"), el("input", { name: "saatler", value: mevcut?.saatler || "", placeholder: "Örn: 12:00" }))),
    el("div", { class: "form-grup" }, el("label", {}, "Talimat / not"), el("textarea", { name: "talimat" }, mevcut?.talimat || "")),
    el("div", { class: "form-satir" },
      el("div", { class: "form-grup" }, el("label", {}, "Başlangıç"), el("input", { type: "date", name: "baslangic", value: mevcut?.baslangic || isoDate() })),
      el("div", { class: "form-grup" }, el("label", {}, "Bitiş (isteğe bağlı)"), el("input", { type: "date", name: "bitis", value: mevcut?.bitis || "" }))),
    el("label", { class: "satir-arasi", style: "gap:8px;font-weight:700" },
      el("input", { type: "checkbox", name: "aktif", style: "width:auto", ...(mevcut?.aktif === false ? {} : { checked: "" }) }), "Aktif"),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, mevcut ? "Kaydet" : "Ekle")
  );
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!yazmaKontrol()) return;
    const v = formData(f);
    try {
      await ilacKaydet(mevcut?.id, {
        ogrenciId: o.id, sinifId: sinif.id, ad: v.ad, doz: v.doz || "", saatler: v.saatler || "",
        talimat: v.talimat || "", baslangic: v.baslangic || "", bitis: v.bitis || "",
        aktif: v.aktif === "on" || v.aktif === true
      });
      closeModal();
      toast("Kaydedildi.", "success");
      saglikDetayYukle();
    } catch (err) { toast(firebaseHata(err), "error"); }
  });
  openModal(mevcut ? "İlaç Düzenle" : "İlaç Ekle — " + escapeHtml(`${o.ad} ${o.soyad}`), f);
}

async function ilacUygulaTiki(il) {
  if (!yazmaKontrol()) return;
  try {
    await ilacUygula({ ilacId: il.id, ogrenciId: il.ogrenciId, sinifId: sinif.id, uygulayanUid: profil.uid });
    const o = ogrById(il.ogrenciId);
    bildirimGonder(o?.veliIds, "medikal", "İlaç uygulandı",
      `${il.ad} — ${new Date().toTimeString().slice(0, 5)}`, "saglik");
    toast("İlaç uygulandı olarak işaretlendi, veli bilgilendirildi.", "success");
    saglikDetayYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

async function ilacSilTiki(il) {
  if (!await confirmDialog(`"${il.ad}" ilaç kaydı silinsin mi?`)) return;
  try { await ilacSil(il.id); toast("Silindi.", "success"); saglikDetayYukle(); }
  catch (err) { toast(firebaseHata(err), "error"); }
}

function olcumFormu() {
  const o = ogrById($("#saglikOgrenci").value);
  if (!o) { toast("Önce öğrenci seçin.", "warning"); return; }
  const f = el("form", {},
    el("div", { class: "form-grup" }, el("label", {}, "Tarih"), el("input", { type: "date", name: "tarih", required: "", value: isoDate() })),
    el("div", { class: "form-satir" },
      el("div", { class: "form-grup" }, el("label", {}, "Boy (cm)"), el("input", { type: "number", name: "boy", step: "0.1", min: "0", required: "" })),
      el("div", { class: "form-grup" }, el("label", {}, "Kilo (kg)"), el("input", { type: "number", name: "kilo", step: "0.1", min: "0", required: "" }))),
    el("div", { class: "form-grup" }, el("label", {}, "Not"), el("input", { name: "not" })),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Ekle")
  );
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!yazmaKontrol()) return;
    const v = formData(f);
    try {
      await olcumEkle({ ogrenciId: o.id, sinifId: sinif.id, tarih: v.tarih, boy: Number(v.boy), kilo: Number(v.kilo), not: v.not || "" });
      closeModal();
      toast("Ölçüm eklendi.", "success");
      saglikDetayYukle();
    } catch (err) { toast(firebaseHata(err), "error"); }
  });
  openModal("Ölçüm Ekle — " + escapeHtml(`${o.ad} ${o.soyad}`), f);
}

async function olcumSilTiki(x) {
  if (!await confirmDialog("Bu ölçüm silinsin mi?")) return;
  try { await olcumSil(x.id); toast("Silindi.", "success"); saglikDetayYukle(); }
  catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  GERİ BİLDİRİM (personel anketleri)
// =============================================================
async function anketleriYukleOgr() {
  const c = $("#anket-liste");
  setLoading(c);
  let anketler;
  try { anketler = anketleriRoleGore(await anketleriGetir(), "ogretmen"); }
  catch (err) { emptyState(c, firebaseHata(err), "⚠️"); return; }
  if (!anketler.length) { emptyState(c, "Yanıtlanacak anket yok.", "🗳️"); return; }
  c.innerHTML = "";
  for (const a of anketler) {
    const mevcut = await benimAnketYanitim(a.id, profil.uid);
    c.appendChild(anketKartiOgr(a, mevcut));
  }
}

function anketKartiOgr(a, mevcut) {
  const kart = el("div", { class: "liste-oge" });
  kart.appendChild(el("div", { class: "liste-oge__ust" },
    el("strong", {}, escapeHtml(a.baslik)),
    el("span", { class: "rozet rozet--bilgi" }, ANKET_TUR[a.tur] || a.tur)));
  if (a.aciklama) kart.appendChild(el("p", {}, escapeHtml(a.aciklama)));
  if (mevcut) {
    const t = a.tur === "onay" ? (mevcut.cevap ? "Evet" : "Hayır") : String(mevcut.cevap);
    kart.appendChild(el("p", { class: "rapor-kart__metin mt-1" }, el("strong", {}, "Yanıtınız: "), document.createTextNode(t)));
    if (a.tur === "onay") { kart.appendChild(el("p", { class: "soluk" }, "Onay yanıtı değiştirilemez.")); return kart; }
  }
  const gonder = async (cevap) => {
    if (!yazmaKontrol()) return;
    try {
      await anketYanitla({ anketId: a.id, tur: a.tur, yanitlayanUid: profil.uid, yanitlayanRol: "ogretmen", cevap });
      toast("Yanıtınız kaydedildi.", "success");
      anketleriYukleOgr();
    } catch (err) { toast(firebaseHata(err), "error"); }
  };
  if (a.tur === "onay") {
    kart.appendChild(el("div", { class: "satir-arasi mt-1" },
      el("button", { class: "btn btn--primary btn--sm", onClick: () => gonder(true) }, "Evet"),
      el("button", { class: "btn btn--ghost btn--sm", onClick: () => gonder(false) }, "Hayır")));
  } else if (a.tur === "secim") {
    const f = el("form", { class: "mt-1" },
      el("div", { class: "form-grup" }, el("select", { name: "cevap" }, ...(a.secenekler || []).map((s) => el("option", { value: s }, s)))),
      el("button", { class: "btn btn--primary btn--sm", type: "submit" }, mevcut ? "Güncelle" : "Gönder"));
    f.addEventListener("submit", (e) => { e.preventDefault(); gonder(formData(f).cevap); });
    kart.appendChild(f);
  } else {
    const f = el("form", { class: "mt-1" },
      el("div", { class: "form-grup" }, el("textarea", { name: "cevap", required: "" }, mevcut?.cevap || "")),
      el("button", { class: "btn btn--primary btn--sm", type: "submit" }, mevcut ? "Güncelle" : "Gönder"));
    f.addEventListener("submit", (e) => { e.preventDefault(); gonder(formData(f).cevap); });
    kart.appendChild(f);
  }
  return kart;
}

// =============================================================
//  AJANDA (görüntüle)
// =============================================================
async function ajandayiYukleOgr() {
  const c = $("#ajanda-liste");
  setLoading(c);
  let kayitli = [];
  try { kayitli = await ajandaGetir(); } catch { /* yoksay */ }
  const kisiler = ogrenciler.map((o) => ({ ad: o.ad, soyad: o.soyad, dogumTarihi: o.dogumTarihi, _tip: "ogrenci" }));
  const hepsi = ajandaSirala([...kayitli, ...ajandaOtomatik(kisiler)]);
  if (!hepsi.length) { emptyState(c, "Ajanda boş.", "📆"); return; }
  c.innerHTML = "";
  hepsi.slice(0, 60).forEach((o) => {
    const t = AJANDA_TUR[o.tur] || AJANDA_TUR.etkinlik;
    c.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, `${t.i} ${escapeHtml(o.baslik)}`),
        el("span", { class: "liste-oge__tarih" }, formatDate(o.tarih))),
      o.aciklama ? el("p", {}, escapeHtml(o.aciklama)) : null));
  });
}

// =============================================================
//  BELGE PAYLAŞIMI
// =============================================================
async function belgeleriYukleOgr() {
  if (!sinif) { emptyState($("#belge-liste"), "Sınıf atanmadı.", "📎"); return; }
  const sel = $("#belgeOgrenci");
  if (!sel.dataset.kuruldu) { saglikOgrenciSecici(sel); sel.dataset.kuruldu = "1"; }
  const c = $("#belge-liste");
  setLoading(c);
  let liste;
  try { liste = await belgeleriGetir({ sinifId: sinif.id }); }
  catch (err) { emptyState(c, firebaseHata(err), "⚠️"); return; }
  if (!liste.length) { emptyState(c, "Henüz belge paylaşmadınız.", "📎"); return; }
  c.innerHTML = "";
  liste.forEach((b) => {
    const o = ogrById(b.ogrenciId);
    c.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, escapeHtml(b.baslik)),
        el("span", { class: "liste-oge__tarih" }, formatDateTime(b.olusturma))),
      el("p", { class: "soluk" }, o ? `${o.ad} ${o.soyad}` : ""),
      b.aciklama ? el("p", {}, escapeHtml(b.aciklama)) : null,
      el("div", { class: "satir-arasi mt-1" },
        el("a", { class: "btn btn--ghost btn--sm", href: b.webViewLink, target: "_blank", rel: "noopener" }, "Aç"),
        el("button", { class: "btn btn--danger btn--sm", onClick: () => belgeSilTiki(b) }, "Sil"))));
  });
}

async function belgeGonderOgr(e) {
  e.preventDefault();
  if (!yazmaKontrol()) return;
  if (!sinif) { toast("Sınıf atanmadı.", "warning"); return; }
  const o = ogrById($("#belgeOgrenci").value);
  if (!o) { toast("Öğrenci seçin.", "warning"); return; }
  const dosya = $("#belgeDosya").files[0];
  if (!dosya) return;
  const v = formData(e.target);
  const btn = $("#belgeBtn");
  btn.disabled = true; btn.textContent = "Yükleniyor...";
  try {
    await belgePaylas(dosya, {
      ogrenciId: o.id, sinifId: sinif.id, baslik: v.baslik, aciklama: v.aciklama,
      yukleyenUid: profil.uid, driveUrl: aktifKres()?.driveUrl, driveSir: aktifKres()?.driveSir
    });
    bildirimGonder(o.veliIds, "belge", "Yeni belge paylaşıldı", v.baslik, "belgeler");
    e.target.reset();
    toast("Belge paylaşıldı.", "success");
    belgeleriYukleOgr();
  } catch (err) { toast(err.message || firebaseHata(err), "error", 6000); }
  finally { btn.disabled = false; btn.textContent = "Yükle & Paylaş"; }
}

async function belgeSilTiki(b) {
  if (!await confirmDialog("Bu belge kaydı silinsin mi? (Drive'daki dosya kalır)")) return;
  try { await belgeSil(b.id); toast("Silindi.", "success"); belgeleriYukleOgr(); }
  catch (err) { toast(firebaseHata(err), "error"); }
}

$("#ilacEkleBtn")?.addEventListener("click", () => ilacFormu());
$("#olcumEkleBtn")?.addEventListener("click", () => olcumFormu());
$("#belgeForm")?.addEventListener("submit", belgeGonderOgr);
$("#kurumziliYenile")?.addEventListener("click", kurumziliYukleOgr);

// ---------- Yemek listesi + haftalık program ----------
async function programGorunumuYukle() {
  if (!sinif) return;
  // Program (düzenlenebilir)
  $("#ogrProgramHafta").textContent = haftaEtiket(ogrProgramHafta);
  let pv = {};
  try { const s = await belgeGetir(bel("programlar", `${sinif.id}_${ogrProgramHafta}`)); if (s.exists()) pv = s.data(); } catch { /* yoksay */ }
  const pk = $("#ogr-program-tablo");
  pk.innerHTML = "";
  haftaGunleri(ogrProgramHafta).forEach((g, i) => {
    pk.appendChild(el("div", { class: "hafta-gun" },
      el("div", { class: "hafta-gun__baslik" }, `${g.isim} · ${formatDate(g.tarih)}`),
      el("label", { class: "hafta-alan" }, el("span", {}, "🎨 Etkinlikler"),
        el("input", { type: "text", value: (pv.gunler && pv.gunler[i]) || "", dataset: { gun: String(i) },
          placeholder: "Örn: Sabah sporu, boyama" }))));
  });
  // Yemek listesi (salt okunur, bu hafta)
  const mk = $("#ogr-menu-goster");
  const menuHafta = haftaBaslangici();
  let mv = {};
  try { const s = await belgeGetir(bel("menuler", menuHafta)); if (s.exists()) mv = s.data(); } catch { /* yoksay */ }
  mk.innerHTML = menuGosterHTML(menuHafta, mv);
}

async function ogrProgramKaydet() {
  if (!yazmaKontrol() || !sinif) return;
  const gunler = Array.from($("#ogr-program-tablo").querySelectorAll("input[data-gun]"))
    .sort((a, b) => Number(a.dataset.gun) - Number(b.dataset.gun))
    .map((inp) => inp.value.trim());
  try {
    await setDoc(bel("programlar", `${sinif.id}_${ogrProgramHafta}`), {
      sinifId: sinif.id, hafta: ogrProgramHafta, gunler, guncelleme: serverTimestamp()
    });
    toast("Program kaydedildi.", "success");
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// Yemek listesini salt-okunur HTML olarak (öğretmen + veli ortak)
function menuGosterHTML(menuHafta, mv) {
  if (!mv.gunler || !mv.gunler.some((g) => g && (g.kahvalti || g.ogle || g.ikindi))) {
    return `<p class="soluk">Bu hafta için yemek listesi girilmemiş.</p>`;
  }
  return `<p class="soluk mb-1">${escapeHtml(haftaEtiket(menuHafta))}</p>` +
    haftaGunleri(menuHafta).map((g, i) => {
      const m = mv.gunler[i] || {};
      return `<div class="hafta-gun">
        <div class="hafta-gun__baslik">${escapeHtml(g.isim)}</div>
        ${m.kahvalti ? `<div class="hafta-satir">🥪 ${escapeHtml(m.kahvalti)}</div>` : ""}
        ${m.ogle ? `<div class="hafta-satir">🍲 ${escapeHtml(m.ogle)}</div>` : ""}
        ${m.ikindi ? `<div class="hafta-satir">🍎 ${escapeHtml(m.ikindi)}</div>` : ""}
      </div>`;
    }).join("");
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

  // Veli ön bildirimleri (o gün için)
  const onBildirim = {};
  try {
    const obSnap = await getDocs(query(kol("devamsizlikBildirimleri"), where("sinifId", "==", sinif.id)));
    obSnap.docs.map((d) => d.data()).filter((x) => x.tarih === tarih)
      .forEach((x) => { onBildirim[x.ogrenciId] = x; });
  } catch { /* yoksay */ }

  if (!ogrenciler.length) { emptyState(c, "Öğrenci yok"); return; }
  c.innerHTML = "";
  ogrenciler.forEach((o) => {
    const ob = onBildirim[o.id];
    const sar = el("div", { class: "yoklama-satir" },
      avatar(o),
      el("span", { class: "isim" },
        `${o.ad} ${o.soyad}`,
        ob ? el("span", { class: `rozet ${ob.tur === "gec" ? "rozet--uyari" : "rozet--hata"} mt-1`, style: "display:block;width:fit-content" },
          `📌 Veli: ${ob.tur === "gec" ? "geç gelecek" : "gelmeyecek"}${ob.aciklama ? " — " + ob.aciklama : ""}`) : null),
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

// Hazır rapor kalıpları
const RAPOR_PRESET = {
  sakin: { yemek: "Yarısını yedi", uyku: "Rahat uyudu", tuvalet: "Sorunsuz", ruhHali: "Sakin" },
  zor:   { yemek: "Az yedi", uyku: "Kısa uyudu", tuvalet: "Yardım gerekti", ruhHali: "Huzursuz" }
};

function raporPresetUygula(preset) {
  const f = $("#raporForm");
  Object.entries(preset).forEach(([k, val]) => { f[k].value = val; });
  tumCipleriSenkronla();
  raporOnizlemeTazele();
  raporDurumAyarla("degisti");
}
function raporHarikaDoldur() { raporPresetUygula(RAPOR_HARIKA); }

// Bu öğrencinin en son raporunu (bugün hariç, son 21 gün) forma kopyala.
// Deterministik doküman kimlikleriyle geriye tarayarak sorgu/rule sorununu önler.
async function sonRaporuKopyala() {
  const ogrenciId = $("#raporOgrenci").value;
  const secili = $("#raporTarih").value || isoDate();
  if (!ogrenciId) { toast("Önce öğrenci seçin.", "warning"); return; }
  let r = null;
  const baz = new Date(secili + "T12:00:00");
  for (let g = 1; g <= 21 && !r; g++) {
    const t = isoDate(new Date(baz.getTime() - g * 86400000));
    const s = await belgeGetir(bel("gunlukRaporlar", `${ogrenciId}_${t}`));
    if (s.exists()) r = s.data();
  }
  if (!r) { toast("Son 3 haftada kopyalanacak rapor yok.", "warning"); return; }
  const f = $("#raporForm");
  f.yemek.value = r.yemek || "Hepsini yedi";
  f.uyku.value = r.uyku || "Rahat uyudu";
  f.tuvalet.value = r.tuvalet || "Sorunsuz";
  f.ruhHali.value = r.ruhHali || "Neşeli";
  f.etkinlik.value = r.etkinlik || "";
  f.not.value = r.not || "";
  tumCipleriSenkronla();
  raporOnizlemeTazele();
  raporDurumAyarla("degisti");
  toast(`${formatDate(r.tarih)} raporu kopyalandı. Gözden geçirip kaydedin.`, "success", 4000);
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
    if (tarih === isoDate()) {
      const o = ogrenciler.find((x) => x.id === ogrenciId);
      bildirimGonder(o?.veliIds, "rapor", "Yeni günlük rapor",
        `${o?.ad || "Çocuğunuz"} için bugünün raporu hazır`, "raporlar");
    }
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  TOPLU RAPOR (tüm sınıf tek ekranda)
// =============================================================
const TOPLU_ALANLAR = [
  { k: "yemek", e: "🍽️", opts: ["Hepsini yedi", "Yarısını yedi", "Az yedi", "Yemedi"] },
  { k: "uyku", e: "😴", opts: ["Rahat uyudu", "Kısa uyudu", "Uyumadı"] },
  { k: "tuvalet", e: "🚽", opts: ["Sorunsuz", "Yardım gerekti", "Kaza oldu"] },
  { k: "ruhHali", e: "💛", opts: ["Neşeli", "Sakin", "Huzursuz", "Ağladı"] }
];
let topluDurumHaritasi = {};   // ogrenciId -> { yemek, uyku, tuvalet, ruhHali, not, etkinlik }

async function topluRaporYukle() {
  if (!sinif) return;
  const kap = $("#toplu-liste");
  if (!kap) return;
  if (!$("#topluTarih").value) $("#topluTarih").value = isoDate();
  if (!ogrenciler.length) { emptyState(kap, "Sınıfınızda öğrenci yok"); return; }
  const tarih = $("#topluTarih").value;
  setLoading(kap);
  const snaplar = await Promise.all(
    ogrenciler.map((o) => belgeGetir(bel("gunlukRaporlar", `${o.id}_${tarih}`)))
  );
  topluDurumHaritasi = {};
  kap.innerHTML = "";
  ogrenciler.forEach((o, i) => {
    const m = snaplar[i].exists() ? snaplar[i].data() : null;
    const d = {
      yemek: m?.yemek || "Hepsini yedi",
      uyku: m?.uyku || "Rahat uyudu",
      tuvalet: m?.tuvalet || "Sorunsuz",
      ruhHali: m?.ruhHali || "Neşeli",
      not: m?.not || "",
      etkinlik: m?.etkinlik || "",
      kayitli: !!m
    };
    topluDurumHaritasi[o.id] = d;
    kap.appendChild(topluOgrenciKarti(o, d));
  });
  durumRozet("topluDurum", "");
}

function topluOgrenciKarti(o, d) {
  const kart = el("div", { class: "toplu-kart" },
    el("div", { class: "toplu-kart__ust" },
      avatar(o),
      el("strong", {}, `${o.ad} ${o.soyad}`),
      d.kayitli ? el("span", { class: "rozet rozet--basari" }, "Kayıtlı") : null)
  );
  TOPLU_ALANLAR.forEach(({ k, e, opts }) => {
    const grup = el("div", { class: "toplu-cipler" });
    opts.forEach((opt) => {
      const b = el("button", { type: "button", class: "rapor-cip", title: opt, dataset: { deger: opt } },
        el("span", { class: "e" }, RAPOR_EMOJI[opt] || e));
      if (d[k] === opt) b.classList.add("aktif");
      b.addEventListener("click", () => {
        d[k] = opt;
        grup.querySelectorAll(".rapor-cip").forEach((x) => x.classList.toggle("aktif", x.dataset.deger === opt));
        durumRozet("topluDurum", "degisti");
      });
      grup.appendChild(b);
    });
    kart.appendChild(el("div", { class: "toplu-alan" }, el("span", { class: "toplu-alan__e" }, e), grup));
  });
  const notInp = el("input", { type: "text", placeholder: "Bu çocuğa özel not (isteğe bağlı)", value: d.not });
  notInp.addEventListener("input", () => { d.not = notInp.value; durumRozet("topluDurum", "degisti"); });
  kart.appendChild(el("div", { class: "form-grup mt-1" }, notInp));
  return kart;
}

async function topluRaporKaydet() {
  if (!yazmaKontrol()) return;
  if (!sinif || !ogrenciler.length) return;
  const tarih = $("#topluTarih").value || isoDate();
  const ortakEtkinlik = $("#topluEtkinlik").value.trim();
  const btn = $("#topluKaydet");
  btn.disabled = true; btn.textContent = "Kaydediliyor...";
  try {
    await Promise.all(ogrenciler.map((o) => {
      const d = topluDurumHaritasi[o.id];
      return setDoc(bel("gunlukRaporlar", `${o.id}_${tarih}`), {
        ogrenciId: o.id, sinifId: sinif.id, tarih,
        yemek: d.yemek, uyku: d.uyku, tuvalet: d.tuvalet, ruhHali: d.ruhHali,
        etkinlik: ortakEtkinlik || d.etkinlik || "",
        not: d.not || "",
        ogretmenId: profil.uid, guncelleme: serverTimestamp()
      });
    }));
    toast(`${ogrenciler.length} öğrenci için rapor kaydedildi.`, "success");
    durumRozet("topluDurum", "kaydedildi");
    sinifPanoYukle();
    if (tarih === isoDate()) {
      const veliUidler = [...new Set(ogrenciler.flatMap((o) => o.veliIds || []))];
      bildirimGonder(veliUidler, "rapor", "Yeni günlük rapor",
        "Bugünün gelişim raporu hazır", "raporlar");
    }
    topluRaporYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
  btn.disabled = false; btn.textContent = "Tümünü Kaydet";
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
    const veliUidler = [...veliHaritasi.keys()];
    bildirimGonder(veliUidler, "duyuru", "Yeni sınıf duyurusu", veri.baslik, "duyurular");
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
