// =============================================================
//  Veli Paneli (veli.js)
//  Çocuğun raporları, yoklaması, galeri, duyurular, mesaj, ödeme.
// =============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { sayfaKorumasi, cikisYap } from "./auth.js";
import { db } from "./firebase-config.js";
import { kol, bel, aktifKresId, aktifKres, kilitEkraniGoster } from "./kres.js";
import {
  $, $$, el, escapeHtml, toast, setLoading, emptyState, tabloBos,
  formatDate, formatDateTime, isoDate, yasHesapla, basHarfler, paraFormat,
  firebaseHata, kurPanelGezinme, kurCikis, kullaniciRozeti, openModal, closeModal,
  raporKart, formData
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
let baglam = null;
let profil = null;
let yazma = true;
let cocuklar = [];
let seciliCocuk = null;
let siniflar = new Map();       // sinifId -> sinif
let ogretmenler = new Map();    // ogretmenId -> user
let okunanDuyurular = new Set();
let seciliMesajKisi = null;
let mesajAboneligi = null;
let galeriTarih = isoDate();

// ---------- Başlangıç ----------
baglam = await sayfaKorumasi("veli");
profil = baglam.profil || { uid: baglam.uid, ad: "Veli", soyad: "", email: "" };
yazma = baglam.aktif;
kullaniciRozeti(profil);
kurCikis(() => cikisYap());
if (!baglam.aktif) kilitEkraniGoster(aktifKres());

kurPanelGezinme({
  ozet: "Özet", raporlar: "Günlük Raporlar", yoklama: "Yoklama",
  galeri: "Galeri", duyurular: "Duyurular", mesajlar: "Mesajlar",
  odemeler: "Ödemeler", izinler: "İzin / Belgeler"
}, gorunumDegisti);

$("#galeriTarih").addEventListener("change", (e) => { galeriTarih = e.target.value || isoDate(); galeriYukle(); });
$("#galeriBugun").addEventListener("click", () => { galeriTarih = isoDate(); $("#galeriTarih").value = galeriTarih; galeriYukle(); });

// KVKK açık rıza kapısı — veli ilk girişte onaylamalı
if (baglam.aktif) await rizaKapisi();

await baslat();

async function rizaKapisi() {
  const p = baglam.profil;
  if (p && p.riza && p.riza.onay === true) return;
  await new Promise((resolve) => {
    const govde = el("div", {},
      el("p", { class: "soluk mb-1" },
        "Çocuğunuza ait fotoğraf, sağlık/alerji notu ve günlük gelişim verilerinin bu uygulama üzerinden işlenmesine ve kreş ile paylaşılmasına açık rıza veriyor musunuz? Detaylar için "),
      el("a", { href: "aydinlatma-metni.html", target: "_blank" }, "Aydınlatma Metni"),
      el("label", { class: "satir-arasi mt-2", style: "align-items:flex-start;gap:8px" },
        el("input", { type: "checkbox", id: "rizaOnay" }),
        el("span", {}, "Okudum, anladım ve açık rıza veriyorum.")),
      el("button", { class: "btn btn--primary btn--block mt-2", id: "rizaDevam" }, "Devam Et")
    );
    openModal("Açık Rıza (KVKK)", govde);
    govde.querySelector("#rizaDevam").addEventListener("click", async () => {
      if (!govde.querySelector("#rizaOnay").checked) { toast("Devam etmek için onay kutusunu işaretleyin.", "warning"); return; }
      try {
        await setDoc(bel("users", profil.uid), {
          riza: { onay: true, surum: "1.0", tarih: serverTimestamp() }
        }, { merge: true });
      } catch { /* yoksay */ }
      closeModal();
      resolve();
    });
  });
}

async function baslat() {
  const oSnap = await getDocs(query(kol("ogrenciler"), where("veliIds", "array-contains", profil.uid)));
  cocuklar = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (!cocuklar.length) {
    $("#cocukSeciciSar").remove();
    emptyState($("#cocukKart"), "Hesabınıza bağlı bir öğrenci bulunamadı. Lütfen yönetici ile görüşün.", "🧒");
    return;
  }

  // Sınıf + öğretmen bilgilerini getir
  const sinifIds = [...new Set(cocuklar.map((c) => c.sinifId).filter(Boolean))];
  await Promise.all(sinifIds.map(async (id) => {
    const s = await getDoc(bel("siniflar", id));
    if (s.exists()) {
      const sinif = { id, ...s.data() };
      siniflar.set(id, sinif);
      if (sinif.ogretmenId) {
        const o = await getDoc(bel("users", sinif.ogretmenId));
        if (o.exists()) ogretmenler.set(sinif.ogretmenId, { id: sinif.ogretmenId, ...o.data() });
      }
    }
  }));

  // Okunan duyurular
  const okSnap = await getDoc(bel("duyuruOkundu", profil.uid));
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
  if (ad === "izinler") izinleriYukle();
}

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
  const rSnap = await belgeGetir(bel("gunlukRaporlar", `${c.id}_${bugun}`));
  raporGoster($("#bugun-rapor"), rSnap.exists() ? rSnap.data() : null, "Bugün için henüz rapor girilmedi.");
}

function raporGoster(kap, v, bosMesaj) {
  kap.innerHTML = "";
  if (!v) { emptyState(kap, bosMesaj, "📝"); return; }
  kap.appendChild(raporKart(v));
}

// =============================================================
//  GÜNLÜK RAPORLAR
// =============================================================
$("#raporTarih").addEventListener("change", raporYukle);

async function raporYukle() {
  const tarih = $("#raporTarih").value || isoDate();
  const kap = $("#rapor-liste");
  setLoading(kap);
  const snap = await belgeGetir(bel("gunlukRaporlar", `${seciliCocuk.id}_${tarih}`));
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
  const snap = await getDocs(query(kol("yoklamalar"), where("ogrenciId", "==", seciliCocuk.id)));
  const liste = snap.docs.map((d) => d.data()).sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""));
  if (!liste.length) { tabloBos(tablo, "Yoklama kaydı yok"); return; }
  const rozet = { geldi: "basari", gec: "uyari", gelmedi: "hata" };
  const metin = { geldi: "Geldi", gec: "Geç geldi", gelmedi: "Gelmedi" };
  tablo.innerHTML = `
    <thead><tr><th>Tarih</th><th>Durum</th></tr></thead>
    <tbody>${liste.map((y) => `
      <tr><td data-label="Tarih">${formatDate(y.tarih)}</td>
      <td data-label="Durum"><span class="rozet rozet--${rozet[y.durum] || "bilgi"}">${metin[y.durum] || y.durum}</span></td></tr>`).join("")}</tbody>`;
}

// =============================================================
//  GALERİ
// =============================================================
function fotoGunu(f) {
  const d = f.tarih?.toDate ? f.tarih.toDate() : (f.tarih ? new Date(f.tarih) : null);
  return d ? isoDate(d) : "";
}

async function galeriYukle() {
  const c = $("#foto-izgara");
  const tarihInput = $("#galeriTarih");
  if (tarihInput && !tarihInput.value) tarihInput.value = galeriTarih;
  setLoading(c);
  const sinifIds = new Set(cocuklar.map((x) => x.sinifId).filter(Boolean));
  // Tüm koleksiyonu çekip istemcide süz: çocuğun sınıfı + okul geneli.
  const snap = await getDocs(kol("fotograflar"));
  const hepsi = snap.docs.map((d) => d.data())
    .filter((f) => f.hedef === "okul" || sinifIds.has(f.hedef));
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
  const snap = await getDocs(kol("duyurular"));
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
    await setDoc(bel("duyuruOkundu", profil.uid), { okunanlar: [...okunanDuyurular] }, { merge: true });
    oge.classList.remove("liste-oge--okunmadi");
    duyurulariYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  ÖDEMELER (aidat + "ödedim" bildirimi)
// =============================================================
const ODEME_ROZET = { odendi: "basari", bildirildi: "bilgi", bekliyor: "uyari" };
const ODEME_METIN = { odendi: "Ödendi", bildirildi: "Bildirildi — onay bekleniyor", bekliyor: "Bekliyor" };

async function odemelerYukle() {
  const tablo = $("#odeme-tablo");
  tabloBos(tablo, "Yükleniyor...");
  const snap = await getDocs(query(kol("odemeler"), where("veliId", "==", profil.uid)));
  const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.ay || "").localeCompare(a.ay || ""));
  if (!liste.length) { tabloBos(tablo, "Ödeme kaydı yok"); return; }
  const cocukAdi = (id) => {
    const c = cocuklar.find((x) => x.id === id);
    return c ? `${c.ad} ${c.soyad}` : "—";
  };
  tablo.innerHTML = `
    <thead><tr><th>Çocuk</th><th>Ay</th><th>Tutar</th><th>Durum</th><th></th></tr></thead>
    <tbody>${liste.map((o) => {
      const d = o.durum || "bekliyor";
      return `<tr>
        <td data-label="Çocuk">${escapeHtml(cocukAdi(o.ogrenciId))}</td>
        <td data-label="Ay">${ayGoster(o.ay)}${o.aciklama ? `<br><span class="soluk">${escapeHtml(o.aciklama)}</span>` : ""}</td>
        <td data-label="Tutar">${paraFormat(o.tutar)}</td>
        <td data-label="Durum"><span class="rozet rozet--${ODEME_ROZET[d] || "uyari"}">${ODEME_METIN[d] || d}</span></td>
        <td class="tablo-islem">${d === "bekliyor" ? `<button class="btn btn--primary btn--sm" data-bildir="${o.id}">Ödedim, bildir</button>` : ""}</td>
      </tr>`;
    }).join("")}</tbody>`;
  tablo.querySelectorAll("[data-bildir]").forEach((b) =>
    b.addEventListener("click", () => odemeBildir(liste.find((x) => x.id === b.dataset.bildir))));
}

function odemeBildir(o) {
  if (!yazma) { toast("Kreş aboneliği pasif.", "warning"); return; }
  const form = el("form", {},
    el("p", { class: "soluk mb-1" }, `${ayGoster(o.ay)} · ${paraFormat(o.tutar)} ödemesini yaptığınızı bildiriyorsunuz. Yönetici kontrol edip onaylayacak.`),
    el("div", { class: "form-grup" }, el("label", {}, "Ödeme yöntemi"),
      el("select", { name: "yontem" },
        ...["Havale / EFT", "Kredi Kartı", "Nakit (elden)", "Diğer"].map((y) => el("option", { value: y }, y)))),
    el("div", { class: "form-grup" }, el("label", {}, "Not (isteğe bağlı)"),
      el("input", { name: "not", placeholder: "Örn: 12.04 tarihli havale" })),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Bildir")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = formData(form);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await updateDoc(bel("odemeler", o.id), {
        durum: "bildirildi",
        bildirim: { tarih: serverTimestamp(), yontem: v.yontem || "Diğer", not: v.not || "" }
      });
      closeModal();
      toast("Ödeme bildiriminiz iletildi.", "success");
      odemelerYukle();
    } catch (err) { toast(firebaseHata(err), "error"); btn.disabled = false; }
  });
  openModal("Ödeme Bildir", form);
}

function ayGoster(ay) {
  if (!ay || !ay.includes("-")) return ay || "—";
  const aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const [y, m] = ay.split("-");
  return `${aylar[Number(m) - 1]} ${y}`;
}

// =============================================================
//  İZİN / BELGELER (veli onayı)
// =============================================================
function izinYanitKol(belgeId) {
  return collection(db, "kresler", aktifKresId(), "izinBelgeleri", belgeId, "yanitlar");
}
function turEtiket(t) {
  return t === "gezi" ? "🚌 Gezi" : t === "izin" ? "✋ İzin" : "📄 Belge";
}

async function izinleriYukle() {
  const c = $("#izin-liste");
  setLoading(c);
  const sinifIds = new Set(cocuklar.map((x) => x.sinifId).filter(Boolean));
  const snap = await getDocs(kol("izinBelgeleri"));
  const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => (b.hedefSiniflar || []).some((s) => sinifIds.has(s)))
    .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
  if (!liste.length) { emptyState(c, "Bekleyen belge yok", "📝"); return; }

  // Bu velinin bu çocuk(lar) için verdiği yanıtları getir
  c.innerHTML = "";
  for (const b of liste) {
    // ilgili çocuk (bu belgenin sınıfındaki)
    const cocuk = cocuklar.find((x) => (b.hedefSiniflar || []).includes(x.sinifId));
    let yanit = null;
    try {
      const ys = await getDoc(doc(izinYanitKol(b.id), profil.uid));
      if (ys.exists()) yanit = ys.data();
    } catch { /* yoksay */ }

    const kutu = el("div", { class: `liste-oge ${yanit ? "" : "liste-oge--okunmadi"}` },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, `${turEtiket(b.tur)} · ${b.baslik}`),
        el("span", { class: "liste-oge__tarih" }, formatDateTime(b.tarih))
      ),
      el("p", {}, b.metin),
      b.etkinlikTarihi ? el("div", { class: "satir-arasi mt-1" },
        el("span", { class: "rozet rozet--bilgi" }, "Tarih: " + formatDate(b.etkinlikTarihi))) : null,
      yanit
        ? el("div", { class: "satir-arasi mt-1" },
            el("span", { class: `rozet rozet--${yanit.karar === "onay" ? "basari" : "hata"}` },
              yanit.karar === "onay" ? "Onayladınız" : "Reddettiniz"),
            yanit.not ? el("span", { class: "soluk" }, yanit.not) : null,
            el("button", { class: "btn btn--ghost btn--sm", onClick: () => izinYanitla(b, cocuk) }, "Değiştir"))
        : el("div", { class: "satir-arasi mt-1" },
            el("button", { class: "btn btn--primary btn--sm", onClick: () => izinYanitla(b, cocuk, "onay") }, "Onayla"),
            el("button", { class: "btn btn--danger btn--sm", onClick: () => izinYanitla(b, cocuk, "ret") }, "Reddet"))
    );
    c.appendChild(kutu);
  }
}

function izinYanitla(belge, cocuk, onSecim = null) {
  if (!yazma) { toast("Kreş aboneliği pasif.", "warning"); return; }
  const form = el("form", {},
    el("p", { class: "soluk mb-1" }, `"${belge.baslik}" belgesine yanıtınız${cocuk ? " (" + cocuk.ad + " " + cocuk.soyad + ")" : ""}.`),
    el("div", { class: "form-grup" }, el("label", {}, "Karar"),
      el("select", { name: "karar" },
        el("option", { value: "onay", ...(onSecim === "onay" ? { selected: "" } : {}) }, "Onaylıyorum"),
        el("option", { value: "ret", ...(onSecim === "ret" ? { selected: "" } : {}) }, "Reddediyorum"))),
    el("div", { class: "form-grup" }, el("label", {}, "Not (isteğe bağlı)"),
      el("input", { name: "not" })),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Gönder")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = formData(form);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await setDoc(doc(izinYanitKol(belge.id), profil.uid), {
        ogrenciId: cocuk?.id || null,
        karar: v.karar,
        not: v.not || "",
        tarih: serverTimestamp()
      });
      closeModal();
      toast("Yanıtınız kaydedildi.", "success");
      izinleriYukle();
    } catch (err) { toast(firebaseHata(err), "error"); btn.disabled = false; }
  });
  openModal("İzin / Belge Yanıtı", form);
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
  const q = query(kol("mesajlar"), where("katilimcilar", "array-contains", profil.uid));
  mesajAboneligi = onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.katilimcilar.includes(o.id))
      .sort((a, b) => (a.tarih?.seconds || 0) - (b.tarih?.seconds || 0));
    renderMesajlar(msgs);
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
