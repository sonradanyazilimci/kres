// =============================================================
//  Veli Paneli (veli.js)
//  Çocuğun raporları, yoklaması, galeri, duyurular, mesaj, ödeme.
// =============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db, ROLES } from "./firebase-config.js";
import { sayfaKorumasi, cikisYap } from "./auth.js";
import {
  $, $$, el, escapeHtml, toast, setLoading, emptyState, tabloBos,
  formatDate, formatDateTime, isoDate, yasHesapla, basHarfler, paraFormat,
  firebaseHata, kurPanelGezinme, kurCikis, kullaniciRozeti
} from "./utils.js";

// Var olmayan doküman okunurken güvenlik kuralları `permission-denied`
// fırlatabilir; bunu "kayıt yok" olarak ele al.
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
let cocuklar = [];
let seciliCocuk = null;
let siniflar = new Map();       // sinifId -> sinif
let ogretmenler = new Map();    // ogretmenId -> user
let okunanDuyurular = new Set();
let seciliMesajKisi = null;
let mesajAboneligi = null;

// ---------- Başlangıç ----------
profil = await sayfaKorumasi(ROLES.VELI);
kullaniciRozeti(profil);
kurCikis(() => cikisYap());

kurPanelGezinme({
  ozet: "Özet", raporlar: "Günlük Raporlar", yoklama: "Yoklama",
  galeri: "Galeri", duyurular: "Duyurular", mesajlar: "Mesajlar", odemeler: "Ödemeler"
}, gorunumDegisti);

await baslat();

async function baslat() {
  const oSnap = await getDocs(query(collection(db, "ogrenciler"), where("veliIds", "array-contains", profil.uid)));
  cocuklar = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (!cocuklar.length) {
    $("#cocukSeciciSar").remove();
    emptyState($("#cocukKart"), "Hesabınıza bağlı bir öğrenci bulunamadı. Lütfen yönetici ile görüşün.", "🧒");
    return;
  }

  // Sınıf + öğretmen bilgilerini getir
  const sinifIds = [...new Set(cocuklar.map((c) => c.sinifId).filter(Boolean))];
  await Promise.all(sinifIds.map(async (id) => {
    const s = await getDoc(doc(db, "siniflar", id));
    if (s.exists()) {
      const sinif = { id, ...s.data() };
      siniflar.set(id, sinif);
      if (sinif.ogretmenId) {
        const o = await getDoc(doc(db, "users", sinif.ogretmenId));
        if (o.exists()) ogretmenler.set(sinif.ogretmenId, { id: sinif.ogretmenId, ...o.data() });
      }
    }
  }));

  // Okunan duyurular
  const okSnap = await getDoc(doc(db, "duyuruOkundu", profil.uid));
  if (okSnap.exists()) okunanDuyurular = new Set(okSnap.data().okunanlar || []);

  // Çocuk seçici
  const sec = $("#cocukSecici");
  sec.innerHTML = cocuklar.map((c) => `<option value="${c.id}">${escapeHtml(c.ad)} ${escapeHtml(c.soyad)}</option>`).join("");
  if (cocuklar.length === 1) $("#cocukSeciciSar").style.display = "none";
  sec.addEventListener("change", () => { seciliCocukAyarla(sec.value); });

  seciliCocukAyarla(cocuklar[0].id);
}

function seciliCocukAyarla(id) {
  seciliCocuk = cocuklar.find((c) => c.id === id);
  $("#raporTarih").value = isoDate();
  ozetYukle();
  // Aktif görünüm neyse onu tazele
  const aktif = document.querySelector(".gorunum.aktif")?.id.replace("gorunum-", "");
  if (aktif && aktif !== "ozet") gorunumDegisti(aktif);
}

function gorunumDegisti(ad) {
  if (!seciliCocuk) return;
  if (ad === "ozet") ozetYukle();
  if (ad === "raporlar") raporYukle();
  if (ad === "yoklama") yoklamaYukle();
  if (ad === "galeri") galeriYukle();
  if (ad === "duyurular") duyurulariYukle();
  if (ad === "mesajlar") mesajlasmaKur();
  if (ad === "odemeler") odemelerYukle();
}

const satir = (b, d) => el("div", { class: "rapor-satir" }, el("strong", {}, b), el("span", {}, d));

// =============================================================
//  ÖZET
// =============================================================
async function ozetYukle() {
  const c = seciliCocuk;
  const sinif = siniflar.get(c.sinifId);
  const kart = $("#cocukKart");
  kart.innerHTML = "";
  const av = el("span", { class: "avatar avatar--lg" });
  if (c.fotoUrl) av.appendChild(el("img", { src: c.fotoUrl, alt: c.ad }));
  else av.textContent = basHarfler(c.ad, c.soyad);
  kart.appendChild(el("div", { class: "satir-arasi" },
    av,
    el("div", {},
      el("h2", {}, `${c.ad} ${c.soyad}`),
      el("div", { class: "soluk" },
        `${sinif ? sinif.ad + " sınıfı" : "Sınıf atanmadı"} · ${c.dogumTarihi ? yasHesapla(c.dogumTarihi) + " yaş" : "—"}`),
      c.alerjiler ? el("span", { class: "rozet rozet--uyari mt-1" }, "Alerji: " + c.alerjiler) : null
    )
  ));

  // Bugünün raporu
  const bugun = isoDate();
  const rSnap = await belgeGetir(doc(db, "gunlukRaporlar", `${c.id}_${bugun}`));
  raporGoster($("#bugun-rapor"), rSnap.exists() ? rSnap.data() : null, "Bugün için henüz rapor girilmedi.");
}

function raporGoster(kap, v, bosMesaj) {
  kap.innerHTML = "";
  if (!v) { emptyState(kap, bosMesaj, "📝"); return; }
  kap.append(
    satir("Yemek", v.yemek || "—"),
    satir("Uyku", v.uyku || "—"),
    satir("Tuvalet", v.tuvalet || "—"),
    satir("Ruh Hali", v.ruhHali || "—"),
    satir("Etkinlik", v.etkinlik || "—"),
    satir("Not", v.not || "—")
  );
}

// =============================================================
//  GÜNLÜK RAPORLAR
// =============================================================
$("#raporTarih").addEventListener("change", raporYukle);

async function raporYukle() {
  const tarih = $("#raporTarih").value || isoDate();
  const kap = $("#rapor-liste");
  setLoading(kap);
  const snap = await belgeGetir(doc(db, "gunlukRaporlar", `${seciliCocuk.id}_${tarih}`));
  const kutu = el("div", {});
  raporGoster(kutu, snap.exists() ? snap.data() : null, `${formatDate(tarih)} için rapor bulunamadı.`);
  kap.innerHTML = "";
  kap.appendChild(kutu);
}

// =============================================================
//  YOKLAMA GEÇMİŞİ
// =============================================================
async function yoklamaYukle() {
  const tablo = $("#yoklama-tablo");
  tabloBos(tablo, "Yükleniyor...");
  const snap = await getDocs(query(collection(db, "yoklamalar"), where("ogrenciId", "==", seciliCocuk.id)));
  const liste = snap.docs.map((d) => d.data()).sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""));
  if (!liste.length) { tabloBos(tablo, "Yoklama kaydı yok"); return; }
  const rozet = { geldi: "basari", gec: "uyari", gelmedi: "hata" };
  const metin = { geldi: "Geldi", gec: "Geç geldi", gelmedi: "Gelmedi" };
  tablo.innerHTML = `
    <thead><tr><th>Tarih</th><th>Durum</th></tr></thead>
    <tbody>${liste.map((y) => `
      <tr><td>${formatDate(y.tarih)}</td>
      <td><span class="rozet rozet--${rozet[y.durum] || "bilgi"}">${metin[y.durum] || y.durum}</span></td></tr>`).join("")}</tbody>`;
}

// =============================================================
//  GALERİ
// =============================================================
async function galeriYukle() {
  const c = $("#foto-izgara");
  setLoading(c);
  const sinifIds = new Set(cocuklar.map((x) => x.sinifId).filter(Boolean));
  // Tüm koleksiyonu çekip istemcide süz: çocuğun sınıfı + okul geneli.
  const snap = await getDocs(collection(db, "fotograflar"));
  const foto = snap.docs.map((d) => d.data())
    .filter((f) => f.hedef === "okul" || sinifIds.has(f.hedef))
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  if (!foto.length) { emptyState(c, "Henüz fotoğraf yok", "📷"); return; }
  c.innerHTML = "";
  foto.forEach((f) => {
    c.appendChild(el("figure", { class: "foto-oge" },
      el("img", { src: f.url, alt: f.aciklama || "Fotoğraf", loading: "lazy" }),
      el("figcaption", {},
        el("div", {}, `${f.aciklama || ""}${f.aciklama ? " · " : ""}${formatDate(f.tarih)}`),
        el("span", { class: `rozet ${f.hedef === "okul" ? "rozet--mor" : "rozet--bilgi"} mt-1` },
          f.hedef === "okul" ? "Tüm Okul" : (siniflar.get(f.hedef)?.ad || "Sınıf") + " sınıfı")
      )
    ));
  });
}

// =============================================================
//  DUYURULAR
// =============================================================
async function duyurulariYukle() {
  const c = $("#duyuru-liste");
  setLoading(c);
  const sinifIds = new Set(cocuklar.map((x) => x.sinifId));
  const snap = await getDocs(collection(db, "duyurular"));
  const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.hedef === "okul" || sinifIds.has(d.hedef))
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  if (!liste.length) { emptyState(c, "Duyuru yok", "📢"); return; }
  c.innerHTML = "";
  liste.forEach((d) => {
    const okundu = okunanDuyurular.has(d.id);
    const oge = el("div", { class: `liste-oge ${okundu ? "" : "liste-oge--okunmadi"}` },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, d.baslik),
        el("span", { class: "liste-oge__tarih" }, formatDateTime(d.tarih))
      ),
      el("p", {}, d.icerik),
      el("div", { class: "satir-arasi mt-1" },
        el("span", { class: "rozet rozet--bilgi" }, d.hedef === "okul" ? "Tüm Okul" : (siniflar.get(d.hedef)?.ad || "Sınıf") + " sınıfı"),
        okundu ? el("span", { class: "rozet rozet--basari" }, "Okundu")
               : el("button", { class: "btn btn--ghost btn--sm", onClick: () => duyuruOkundu(d.id, oge) }, "Okundu işaretle")
      )
    );
    c.appendChild(oge);
  });
}

async function duyuruOkundu(id, oge) {
  okunanDuyurular.add(id);
  try {
    await setDoc(doc(db, "duyuruOkundu", profil.uid), { okunanlar: [...okunanDuyurular] }, { merge: true });
    oge.classList.remove("liste-oge--okunmadi");
    duyurulariYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  ÖDEMELER
// =============================================================
async function odemelerYukle() {
  const tablo = $("#odeme-tablo");
  tabloBos(tablo, "Yükleniyor...");
  const snap = await getDocs(query(collection(db, "odemeler"), where("veliId", "==", profil.uid)));
  const liste = snap.docs.map((d) => d.data())
    .sort((a, b) => (b.ay || "").localeCompare(a.ay || ""));
  if (!liste.length) { tabloBos(tablo, "Ödeme kaydı yok"); return; }
  const cocukAdi = (id) => {
    const c = cocuklar.find((x) => x.id === id);
    return c ? `${c.ad} ${c.soyad}` : "—";
  };
  tablo.innerHTML = `
    <thead><tr><th>Çocuk</th><th>Ay</th><th>Tutar</th><th>Durum</th></tr></thead>
    <tbody>${liste.map((o) => `
      <tr>
        <td>${escapeHtml(cocukAdi(o.ogrenciId))}</td>
        <td>${ayGoster(o.ay)}</td>
        <td>${paraFormat(o.tutar)}</td>
        <td><span class="rozet rozet--${o.durum === "odendi" ? "basari" : "uyari"}">${o.durum === "odendi" ? "Ödendi" : "Bekliyor"}</span></td>
      </tr>`).join("")}</tbody>`;
}
function ayGoster(ay) {
  if (!ay || !ay.includes("-")) return ay || "—";
  const aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const [y, m] = ay.split("-");
  return `${aylar[Number(m) - 1]} ${y}`;
}

// =============================================================
//  MESAJLAŞMA
// =============================================================
function mesajlasmaKur() {
  const kisiler = [...ogretmenler.values()];
  const c = $("#mesaj-kisiler");
  if (!kisiler.length) { emptyState(c, "Görüşülecek öğretmen bulunamadı"); return; }
  c.innerHTML = "";
  kisiler.forEach((o) => {
    const b = el("button", { class: "mesaj-kisi", dataset: { id: o.id } },
      el("span", { class: "avatar" }, basHarfler(o.ad, o.soyad)),
      el("span", {}, el("span", { class: "isim" }, `${o.ad} ${o.soyad}`), el("br"), el("span", { class: "rol" }, "Öğretmen"))
    );
    b.addEventListener("click", () => mesajKisiSec(o));
    c.appendChild(b);
  });
}

function mesajKisiSec(o) {
  seciliMesajKisi = o;
  $$(".mesaj-kisi").forEach((x) => x.classList.toggle("aktif", x.dataset.id === o.id));
  $("#mesaj-baslik").textContent = `${o.ad} ${o.soyad}`;
  $("#mesaj-input").disabled = false;
  $("#mesaj-yaz").querySelector("button").disabled = false;

  if (mesajAboneligi) mesajAboneligi();
  const q = query(collection(db, "mesajlar"), where("katilimcilar", "array-contains", profil.uid));
  mesajAboneligi = onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.katilimcilar.includes(o.id))
      .sort((a, b) => (a.tarih?.seconds || 0) - (b.tarih?.seconds || 0));
    renderMesajlar(msgs);
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
