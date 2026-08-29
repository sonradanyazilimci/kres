// =============================================================
//  Veli Paneli (veli.js)
//  Çocuğun raporları, yoklaması, galeri, duyurular, mesaj, ödeme.
// =============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { sayfaKorumasi, cikisYap } from "./auth.js";
import { db } from "./firebase-config.js";
import { kol, bel, aktifKresId, aktifKres, kilitEkraniGoster, bildirimGonder } from "./kres.js";
import { kurBildirimZili } from "./bildirim.js";
import { sistemDuyurulariniGoster } from "./sistem-duyuru.js";
import { temaBaslat } from "./tema.js";
import {
  $, $$, el, escapeHtml, toast, setLoading, emptyState, tabloBos,
  formatDate, formatDateTime, isoDate, yasHesapla, basHarfler, paraFormat,
  firebaseHata, kurPanelGezinme, kurCikis, kullaniciRozeti, openModal, closeModal,
  raporKart, formData, haftaBaslangici, haftaGunleri, haftaEtiket
} from "./utils.js";
import {
  RANDEVU_DURUM, randevuOlustur, randevulariGetir, randevuSil,
  kapiGetir, kapiIsaretle,
  ilaclariGetir, ilacUygulamalariGetir, ilacBugunAktif,
  olcumleriGetir, bmiHesapla, miniCizgiGrafik,
  ANKET_TUR, anketleriGetir, anketleriRoleGore, anketYanitla, benimAnketYanitim,
  belgeleriGetir
} from "./moduller.js";

temaBaslat();

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
let adminUidler = [];
let adminlar = [];

// ---------- Başlangıç ----------
baglam = await sayfaKorumasi("veli");
profil = baglam.profil || { uid: baglam.uid, ad: "Veli", soyad: "", email: "" };
yazma = baglam.aktif;
kullaniciRozeti(profil);
kurCikis(() => cikisYap());
if (!baglam.aktif) kilitEkraniGoster(aktifKres());
kurBildirimZili({ profil, kresId: aktifKresId() });
sistemDuyurulariniGoster();

kurPanelGezinme({
  ozet: "Özet", raporlar: "Günlük Raporlar", gelisim: "Aylık Özet", yoklama: "Yoklama",
  galeri: "Galeri", duyurular: "Duyurular", mesajlar: "Mesajlar",
  odemeler: "Ödemeler", program: "Yemek & Program", izinler: "İzin / Belgeler"
}, gorunumDegisti);

$("#gelisimAy").addEventListener("change", gelisimYukle);

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

  // Yönetici uid'leri (ödeme bildirimi vb. için)
  try {
    const aSnap = await getDocs(query(kol("users"), where("rol", "==", "admin")));
    adminlar = aSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    adminUidler = adminlar.map((a) => a.id);
  } catch { /* yoksay */ }

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
  if (ad === "gelisim") gelisimYukle();
  if (ad === "yoklama") yoklamaYukle();
  if (ad === "galeri") galeriYukle();
  if (ad === "duyurular") duyurulariYukle();
  if (ad === "mesajlar") mesajlasmaKur();
  if (ad === "odemeler") odemelerYukle();
  if (ad === "program") programYukle();
  if (ad === "izinler") izinleriYukle();
  if (ad === "randevular") randevulariYukleVeli();
  if (ad === "kurumzili") kurumziliYukleVeli();
  if (ad === "saglik") saglikYukleVeli();
  if (ad === "anketler") anketleriYukleVeli();
  if (ad === "belgeler") belgelerimYukle();
}

// =============================================================
//  RANDEVU
// =============================================================
function randevuKisiSecenekleri() {
  const sec = $("#randevuKisi");
  if (!sec) return;
  const secenekler = [];
  const sinif = siniflar.get(seciliCocuk?.sinifId);
  const ogr = sinif?.ogretmenId ? ogretmenler.get(sinif.ogretmenId) : null;
  if (ogr) secenekler.push({ id: ogr.id, ad: `${ogr.ad} ${ogr.soyad} (öğretmen)` });
  adminlar.forEach((a) => secenekler.push({ id: a.id, ad: `${a.ad} ${a.soyad} (yönetici)` }));
  sec.innerHTML = secenekler.length
    ? secenekler.map((s) => `<option value="${s.id}">${escapeHtml(s.ad)}</option>`).join("")
    : `<option value="">Uygun kişi yok</option>`;
}

async function randevuGonder(e) {
  e.preventDefault();
  if (!yazma) { toast("Kreş aboneliği pasif.", "warning"); return; }
  if (!seciliCocuk) return;
  const v = formData(e.target);
  if (!v.personelUid) { toast("Randevu için bir kişi seçin.", "warning"); return; }
  const sec = $("#randevuKisi");
  const btn = $("#randevuBtn");
  btn.disabled = true; btn.textContent = "Gönderiliyor...";
  try {
    await randevuOlustur({
      veliUid: profil.uid, ogrenciId: seciliCocuk.id,
      personelUid: v.personelUid,
      personelAd: sec.options[sec.selectedIndex]?.text || "",
      tarih: v.tarih, saat: v.saat, konu: v.konu, veliNot: v.veliNot
    });
    bildirimGonder(v.personelUid, "randevu", "Yeni randevu isteği",
      `${seciliCocuk.ad} — ${v.konu} · ${formatDate(v.tarih)}${v.saat ? " " + v.saat : ""}`, "randevular");
    e.target.reset();
    toast("Randevu isteği gönderildi.", "success");
    randevulariYukleVeli();
  } catch (err) { toast(firebaseHata(err), "error"); }
  finally { btn.disabled = false; btn.textContent = "Randevu İste"; }
}

async function randevulariYukleVeli() {
  const c = $("#randevu-liste");
  setLoading(c);
  randevuKisiSecenekleri();
  let liste;
  try { liste = await randevulariGetir({ veliUid: profil.uid }); }
  catch (err) { emptyState(c, firebaseHata(err), "⚠️"); return; }
  liste = liste.filter((r) => !seciliCocuk || r.ogrenciId === seciliCocuk.id);
  if (!liste.length) { emptyState(c, "Henüz randevunuz yok.", "📅"); return; }
  c.innerHTML = "";
  liste.forEach((r) => {
    const d = RANDEVU_DURUM[r.durum] || { e: r.durum, r: "bilgi" };
    const oge = el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, `${escapeHtml(r.konu || "Randevu")} — ${formatDate(r.tarih)}${r.saat ? " " + escapeHtml(r.saat) : ""}`),
        el("span", { class: `rozet rozet--${d.r}` }, d.e)),
      el("p", { class: "soluk" }, r.personelAd || ""),
      r.personelNot ? el("div", { class: "rapor-kart__metin mt-1" }, el("strong", {}, "Yanıt: "), document.createTextNode(r.personelNot)) : null,
      (r.durum === "bekliyor" || r.durum === "onaylandi")
        ? el("div", { class: "satir-arasi mt-1" },
            el("button", { class: "btn btn--danger btn--sm", onClick: () => randevuIptalEt(r) }, "İptal et"))
        : null
    );
    c.appendChild(oge);
  });
}

async function randevuIptalEt(r) {
  try {
    await randevuSil(r.id);
    toast("Randevu iptal edildi.", "success");
    randevulariYukleVeli();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  KURUM ZİLİ
// =============================================================
async function kurumziliYukleVeli() {
  const c = $("#kurumzili-icerik");
  if (!seciliCocuk) { emptyState(c, "Çocuk seçilmedi.", "🔔"); return; }
  setLoading(c);
  let kayit;
  try { kayit = await kapiGetir(seciliCocuk.id); }
  catch { kayit = null; }
  const sinif = siniflar.get(seciliCocuk.sinifId);
  const durumMetin = kayit?.geldimAt
    ? "✅ Bugün “Geldim” bildirildi."
    : kayit?.geliyorumAt
      ? "🚗 Bugün “Geliyorum” bildirildi."
      : "Bugün henüz bildirim yapmadınız.";
  c.innerHTML = "";
  c.appendChild(el("p", { class: "soluk mb-1" }, `${escapeHtml(seciliCocuk.ad)} ${escapeHtml(seciliCocuk.soyad)} — ${escapeHtml(durumMetin)}`));
  c.appendChild(el("div", { class: "satir-arasi" },
    el("button", { class: "btn btn--secondary", id: "kzGeliyorum" }, "🚗 Geliyorum"),
    el("button", { class: "btn btn--primary", id: "kzGeldim" }, "🚪 Geldim")
  ));
  const isaretle = async (alan, mesaj, bildirimMetin) => {
    if (!yazma) { toast("Kreş aboneliği pasif.", "warning"); return; }
    try {
      await kapiIsaretle({ ogrenciId: seciliCocuk.id, sinifId: seciliCocuk.sinifId, veliUid: profil.uid, alan });
      bildirimGonder(sinif?.ogretmenId, "kurumzili", bildirimMetin,
        `${seciliCocuk.ad} ${seciliCocuk.soyad}`, "kurumzili");
      toast(mesaj, "success");
      kurumziliYukleVeli();
    } catch (err) { toast(firebaseHata(err), "error"); }
  };
  $("#kzGeliyorum").addEventListener("click", () => isaretle("geliyorum", "Öğretmene “Geliyorum” bildirildi.", "🚗 Veli yola çıktı"));
  $("#kzGeldim").addEventListener("click", () => isaretle("geldim", "Öğretmene “Geldim” bildirildi.", "🚪 Veli kapıda"));
}

// =============================================================
//  SAĞLIK & GELİŞİM (salt okunur)
// =============================================================
async function saglikYukleVeli() {
  const ic = $("#ilac-liste");
  const oc = $("#olcum-icerik");
  setLoading(ic); setLoading(oc);
  // İlaçlar + uygulama geçmişi
  let ilaclar = [], uyg = [];
  try { ilaclar = await ilaclariGetir({ ogrenciId: seciliCocuk.id }); } catch { /* yoksay */ }
  try { uyg = await ilacUygulamalariGetir({ ogrenciId: seciliCocuk.id }); } catch { /* yoksay */ }
  ic.innerHTML = "";
  if (!ilaclar.length) emptyState(ic, "Kayıtlı ilaç yok.", "💊");
  else ilaclar.forEach((il) => {
    const gecmis = uyg.filter((u) => u.ilacId === il.id).slice(0, 5);
    ic.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, escapeHtml(il.ad)),
        el("span", { class: `rozet rozet--${ilacBugunAktif(il) ? "basari" : "bilgi"}` }, ilacBugunAktif(il) ? "Aktif" : "Pasif")),
      el("p", { class: "soluk" }, `${escapeHtml(il.doz || "")}${il.talimat ? " · " + escapeHtml(il.talimat) : ""}${il.saatler ? " · " + escapeHtml(il.saatler) : ""}`),
      gecmis.length
        ? el("div", { class: "rapor-kart__metin mt-1" }, el("strong", {}, "Son uygulamalar: "),
            document.createTextNode(gecmis.map((g) => `${formatDate(g.tarih)} ${g.saat || ""}`).join(", ")))
        : null
    ));
  });
  // Ölçümler
  let olcumler = [];
  try { olcumler = await olcumleriGetir({ ogrenciId: seciliCocuk.id }); } catch { /* yoksay */ }
  oc.innerHTML = "";
  if (!olcumler.length) { emptyState(oc, "Henüz boy/kilo ölçümü girilmedi.", "📏"); return; }
  const son = olcumler[olcumler.length - 1];
  const b = bmiHesapla(son.boy, son.kilo);
  oc.appendChild(el("div", { class: "satir-arasi mb-1" },
    el("span", { class: "rozet rozet--bilgi" }, `Boy: ${son.boy} cm`),
    el("span", { class: "rozet rozet--bilgi" }, `Kilo: ${son.kilo} kg`),
    b ? el("span", { class: "rozet" }, `VKİ: ${b.toFixed(1)}`) : null,
    el("span", { class: "soluk" }, formatDate(son.tarih))
  ));
  oc.appendChild(el("h3", { style: "font-size:1rem;margin:12px 0 4px" }, "Boy (cm)"));
  oc.appendChild(miniCizgiGrafik(olcumler.map((o) => ({ x: o.tarih, y: Number(o.boy) })), { birim: " cm", renk: "var(--renk-ikincil, #4bb3a7)" }));
  oc.appendChild(el("h3", { style: "font-size:1rem;margin:12px 0 4px" }, "Kilo (kg)"));
  oc.appendChild(miniCizgiGrafik(olcumler.map((o) => ({ x: o.tarih, y: Number(o.kilo) })), { birim: " kg" }));
}

// =============================================================
//  GERİ BİLDİRİM (anket yanıtla)
// =============================================================
async function anketleriYukleVeli() {
  const c = $("#anket-liste");
  setLoading(c);
  let anketler;
  try { anketler = anketleriRoleGore(await anketleriGetir(), "veli"); }
  catch (err) { emptyState(c, firebaseHata(err), "⚠️"); return; }
  if (!anketler.length) { emptyState(c, "Şu an yanıtlanacak anket yok.", "🗳️"); return; }
  c.innerHTML = "";
  for (const a of anketler) {
    const mevcut = await benimAnketYanitim(a.id, profil.uid);
    c.appendChild(anketKartiYap(a, mevcut, "veli"));
  }
}

// admin ve öğretmen panelinde de kullanılabilecek ortak kart
function anketKartiYap(a, mevcut, rol) {
  const kart = el("div", { class: "liste-oge" });
  kart.appendChild(el("div", { class: "liste-oge__ust" },
    el("strong", {}, escapeHtml(a.baslik)),
    el("span", { class: "rozet rozet--bilgi" }, ANKET_TUR[a.tur] || a.tur)));
  if (a.aciklama) kart.appendChild(el("p", {}, escapeHtml(a.aciklama)));

  if (mevcut) {
    const cevapMetin = a.tur === "onay" ? (mevcut.cevap ? "Evet" : "Hayır") : String(mevcut.cevap);
    kart.appendChild(el("p", { class: "rapor-kart__metin mt-1" },
      el("strong", {}, "Yanıtınız: "), document.createTextNode(cevapMetin)));
    if (a.tur === "onay") { kart.appendChild(el("p", { class: "soluk" }, "Onay yanıtı değiştirilemez.")); return kart; }
  }

  const form = el("form", { class: "mt-1" });
  if (a.tur === "onay") {
    form.appendChild(el("div", { class: "satir-arasi" },
      el("button", { type: "button", class: "btn btn--primary btn--sm", onClick: () => anketYanitiGonder(a, true, rol) }, "Evet"),
      el("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => anketYanitiGonder(a, false, rol) }, "Hayır")));
  } else if (a.tur === "secim") {
    const secenekler = (a.secenekler || []);
    form.appendChild(el("div", { class: "form-grup" },
      el("select", { name: "cevap" }, ...secenekler.map((s) => el("option", { value: s }, s)))));
    form.appendChild(el("button", { type: "submit", class: "btn btn--primary btn--sm" }, mevcut ? "Güncelle" : "Gönder"));
    form.addEventListener("submit", (e) => { e.preventDefault(); anketYanitiGonder(a, formData(form).cevap, rol); });
  } else {
    form.appendChild(el("div", { class: "form-grup" }, el("textarea", { name: "cevap", required: "" }, mevcut?.cevap || "")));
    form.appendChild(el("button", { type: "submit", class: "btn btn--primary btn--sm" }, mevcut ? "Güncelle" : "Gönder"));
    form.addEventListener("submit", (e) => { e.preventDefault(); anketYanitiGonder(a, formData(form).cevap, rol); });
  }
  kart.appendChild(form);
  return kart;
}

async function anketYanitiGonder(a, cevap, rol) {
  if (!yazma) { toast("Kreş aboneliği pasif.", "warning"); return; }
  try {
    await anketYanitla({ anketId: a.id, tur: a.tur, yanitlayanUid: profil.uid, yanitlayanRol: rol, cevap });
    toast("Yanıtınız kaydedildi.", "success");
    anketleriYukleVeli();
  } catch (err) { toast(firebaseHata(err), "error"); }
}

// =============================================================
//  BELGELERİM (öğrenciye özel doküman — indir)
// =============================================================
async function belgelerimYukle() {
  const c = $("#belge-liste");
  setLoading(c);
  let liste;
  try { liste = await belgeleriGetir({ ogrenciId: seciliCocuk.id }); }
  catch (err) { emptyState(c, firebaseHata(err), "⚠️"); return; }
  if (!liste.length) { emptyState(c, "Sizinle paylaşılan belge yok.", "📎"); return; }
  c.innerHTML = "";
  liste.forEach((b) => {
    c.appendChild(el("div", { class: "liste-oge" },
      el("div", { class: "liste-oge__ust" },
        el("strong", {}, escapeHtml(b.baslik)),
        el("span", { class: "liste-oge__tarih" }, formatDateTime(b.olusturma))),
      b.aciklama ? el("p", {}, escapeHtml(b.aciklama)) : null,
      el("div", { class: "satir-arasi mt-1" },
        el("a", { class: "btn btn--ghost btn--sm", href: b.webViewLink, target: "_blank", rel: "noopener" }, "Görüntüle"),
        el("a", { class: "btn btn--primary btn--sm", href: b.indirLink || b.webViewLink, target: "_blank", rel: "noopener" }, "İndir"))
    ));
  });
}

$("#randevuForm")?.addEventListener("submit", randevuGonder);

// ---------- Yemek listesi + haftalık program (salt okunur) ----------
async function programYukle() {
  const hafta = haftaBaslangici();
  const gunler = haftaGunleri(hafta);

  // Program — çocuğun sınıfı
  const pk = $("#veli-program-goster");
  const sid = seciliCocuk?.sinifId;
  let pv = {};
  if (sid) { try { const s = await getDoc(bel("programlar", `${sid}_${hafta}`)); if (s.exists()) pv = s.data(); } catch { /* yoksay */ } }
  if (pv.gunler && pv.gunler.some((x) => x)) {
    pk.innerHTML = `<p class="soluk mb-1">${escapeHtml(haftaEtiket(hafta))}${sid ? " · " + escapeHtml(siniflar.get(sid)?.ad || "") : ""}</p>` +
      gunler.map((g, i) => `<div class="hafta-gun">
        <div class="hafta-gun__baslik">${escapeHtml(g.isim)}</div>
        <div class="hafta-satir">${pv.gunler[i] ? escapeHtml(pv.gunler[i]) : "<span class='soluk'>—</span>"}</div>
      </div>`).join("");
  } else {
    pk.innerHTML = `<p class="soluk">Bu hafta için program paylaşılmamış.</p>`;
  }

  // Yemek listesi
  const mk = $("#veli-menu-goster");
  let mv = {};
  try { const s = await getDoc(bel("menuler", hafta)); if (s.exists()) mv = s.data(); } catch { /* yoksay */ }
  if (mv.gunler && mv.gunler.some((x) => x && (x.kahvalti || x.ogle || x.ikindi))) {
    mk.innerHTML = `<p class="soluk mb-1">${escapeHtml(haftaEtiket(hafta))}</p>` +
      gunler.map((g, i) => {
        const m = mv.gunler[i] || {};
        return `<div class="hafta-gun">
          <div class="hafta-gun__baslik">${escapeHtml(g.isim)}</div>
          ${m.kahvalti ? `<div class="hafta-satir">🥪 ${escapeHtml(m.kahvalti)}</div>` : ""}
          ${m.ogle ? `<div class="hafta-satir">🍲 ${escapeHtml(m.ogle)}</div>` : ""}
          ${m.ikindi ? `<div class="hafta-satir">🍎 ${escapeHtml(m.ikindi)}</div>` : ""}
        </div>`;
      }).join("");
  } else {
    mk.innerHTML = `<p class="soluk">Bu hafta için yemek listesi girilmemiş.</p>`;
  }
}

// =============================================================
//  AYLIK GELİŞİM ÖZETİ
// =============================================================
async function gelisimYukle() {
  if (!seciliCocuk) return;
  const kap = $("#gelisim-icerik");
  if (!$("#gelisimAy").value) $("#gelisimAy").value = isoDate().slice(0, 7);
  const ay = $("#gelisimAy").value;               // "2026-08"
  setLoading(kap);

  // Yoklama (sorgu velide çalışıyor)
  const ySnap = await getDocs(query(kol("yoklamalar"), where("ogrenciId", "==", seciliCocuk.id)));
  const yList = ySnap.docs.map((d) => d.data()).filter((y) => (y.tarih || "").startsWith(ay));
  const ySay = { geldi: 0, gec: 0, gelmedi: 0 };
  yList.forEach((y) => { if (ySay[y.durum] != null) ySay[y.durum]++; });
  const toplamGun = yList.length;
  const devamOran = toplamGun ? Math.round(((ySay.geldi + ySay.gec) / toplamGun) * 100) : 0;

  // Günlük raporlar — ayın günlerini deterministik oku
  const [yil, aySay] = ay.split("-").map(Number);
  const gunSayisi = new Date(yil, aySay, 0).getDate();
  const gunler = [];
  for (let g = 1; g <= gunSayisi; g++) gunler.push(`${ay}-${String(g).padStart(2, "0")}`);
  const rSnaplar = await Promise.all(gunler.map((t) => belgeGetir(bel("gunlukRaporlar", `${seciliCocuk.id}_${t}`))));
  const rList = rSnaplar.filter((s) => s.exists()).map((s) => s.data());
  const dagilim = (alan) => {
    const m = {};
    rList.forEach((r) => { const v = r[alan]; if (v) m[v] = (m[v] || 0) + 1; });
    return m;
  };

  const bar = (etiket, deger, toplam, renk) => {
    const yuzde = toplam ? Math.round((deger / toplam) * 100) : 0;
    return `<div class="gelisim-bar">
      <span class="gelisim-bar__et">${escapeHtml(etiket)}</span>
      <span class="gelisim-bar__cizgi"><span style="width:${yuzde}%;background:${renk}"></span></span>
      <span class="gelisim-bar__sayi">${deger}</span></div>`;
  };
  const dagilimBloku = (baslik, m) => {
    const anahtarlar = Object.keys(m);
    if (!anahtarlar.length) return `<p class="soluk">${baslik}: kayıt yok</p>`;
    const top = rList.length;
    return `<h3 style="font-size:1rem;margin:14px 0 6px">${baslik}</h3>` +
      anahtarlar.sort((a, b) => m[b] - m[a]).map((k) => bar(k, m[k], top, "var(--renk-ikincil)")).join("");
  };

  kap.innerHTML = `
    <div class="stat-izgara" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-bottom:14px">
      ${gStat("✅", ySay.geldi, "Geldi")}
      ${gStat("⏰", ySay.gec, "Geç")}
      ${gStat("❌", ySay.gelmedi, "Gelmedi")}
      ${gStat("📊", "%" + devamOran, "Devam oranı")}
      ${gStat("📝", `${rList.length}/${gunSayisi}`, "Rapor girildi")}
    </div>
    ${toplamGun ? `<h3 style="font-size:1rem;margin:6px 0">Yoklama</h3>
      ${bar("Geldi", ySay.geldi, toplamGun, "var(--basari)")}
      ${bar("Geç", ySay.gec, toplamGun, "var(--uyari)")}
      ${bar("Gelmedi", ySay.gelmedi, toplamGun, "var(--hata)")}` : `<p class="soluk">Bu ay yoklama kaydı yok.</p>`}
    ${dagilimBloku("Ruh Hali", dagilim("ruhHali"))}
    ${dagilimBloku("Yemek", dagilim("yemek"))}
    ${dagilimBloku("Uyku", dagilim("uyku"))}
  `;
}
const gStat = (i, d, e) => `<div class="stat-kart">
  <div class="stat-kart__ikon">${i}</div>
  <div><div class="stat-kart__sayi">${d}</div><div class="stat-kart__etiket">${e}</div></div></div>`;

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
$("#devamsizlikForm").addEventListener("submit", devamsizlikBildir);

async function yoklamaYukle() {
  const tablo = $("#yoklama-tablo");
  tabloBos(tablo, "Yükleniyor...");
  if ($("#devamTarih") && !$("#devamTarih").value) $("#devamTarih").value = isoDate();
  devamsizliklariYukle();
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

async function devamsizlikBildir(e) {
  e.preventDefault();
  if (!yazma) { toast("Kreş aboneliği pasif.", "warning"); return; }
  if (!seciliCocuk) return;
  const v = formData(e.target);
  const btn = $("#devamBtn");
  btn.disabled = true; btn.textContent = "Gönderiliyor...";
  try {
    await addDoc(kol("devamsizlikBildirimleri"), {
      ogrenciId: seciliCocuk.id, sinifId: seciliCocuk.sinifId,
      veliUid: profil.uid, tarih: v.tarih || isoDate(),
      tur: v.tur || "gelmeyecek", aciklama: v.aciklama || "",
      olusturma: serverTimestamp()
    });
    e.target.reset();
    $("#devamTarih").value = isoDate();
    toast("Öğretmene bildirildi.", "success");
    const sinif = siniflar.get(seciliCocuk.sinifId);
    bildirimGonder(sinif?.ogretmenId, "devamsizlik", "Devamsızlık bildirimi",
      `${seciliCocuk.ad} ${seciliCocuk.soyad} — ${v.tur === "gec" ? "geç gelecek" : "gelmeyecek"} (${formatDate(v.tarih)})`, "yoklama");
    devamsizliklariYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
  btn.disabled = false; btn.textContent = "Öğretmene Bildir";
}

async function devamsizliklariYukle() {
  const kap = $("#devamsizlik-liste");
  if (!kap || !seciliCocuk) return;
  const snap = await getDocs(query(kol("devamsizlikBildirimleri"), where("veliUid", "==", profil.uid)));
  const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => x.ogrenciId === seciliCocuk.id)
    .sort((a, b) => (b.tarih || "").localeCompare(a.tarih || "")).slice(0, 8);
  if (!liste.length) { kap.innerHTML = ""; return; }
  kap.innerHTML = "";
  liste.forEach((x) => {
    kap.appendChild(el("div", { class: "satir-arasi", style: "padding:8px 0;border-top:1px dashed var(--kenar)" },
      el("span", { class: `rozet ${x.tur === "gec" ? "rozet--uyari" : "rozet--hata"}` },
        x.tur === "gec" ? "Geç" : "Gelmeyecek"),
      el("span", {}, formatDate(x.tarih)),
      x.aciklama ? el("span", { class: "soluk" }, x.aciklama) : null,
      el("button", { class: "btn btn--ghost btn--sm", onClick: () => devamsizlikSil(x.id) }, "Sil")
    ));
  });
}

async function devamsizlikSil(id) {
  try {
    await deleteDoc(bel("devamsizlikBildirimleri", id));
    devamsizliklariYukle();
  } catch (err) { toast(firebaseHata(err), "error"); }
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
      bildirimGonder(adminUidler, "odeme", "Ödeme bildirimi",
        `${profil.ad} ${profil.soyad} — ${ayGoster(o.ay)} · ${paraFormat(o.tutar)}`, "odemeler");
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
            yanit.tarih ? el("span", { class: "soluk" }, formatDateTime(yanit.tarih)) : null,
            yanit.not ? el("span", { class: "soluk" }, "· " + yanit.not) : null)
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
    el("p", { class: "form-yardim" }, "⚠️ Yanıtınız kesindir; gönderdikten sonra değiştirilemez."),
    el("button", { class: "btn btn--primary btn--block mt-1", type: "submit" }, "Gönder")
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = formData(form);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      // create-only: doküman zaten varsa kurallar reddeder (yanıt değiştirilemez)
      const ref = doc(izinYanitKol(belge.id), profil.uid);
      const mevcut = await getDoc(ref).catch(() => ({ exists: () => false }));
      if (mevcut.exists()) { toast("Bu belgeye zaten yanıt verdiniz; değiştirilemez.", "warning"); closeModal(); izinleriYukle(); return; }
      await setDoc(ref, {
        ogrenciId: cocuk?.id || null,
        karar: v.karar,
        not: v.not || "",
        tarih: serverTimestamp()
      });
      closeModal();
      toast("Yanıtınız kaydedildi.", "success");
      bildirimGonder(adminUidler, "izin", "İzin belgesi yanıtlandı",
        `${profil.ad} ${profil.soyad} — ${belge.baslik}: ${v.karar === "onay" ? "Onay" : "Ret"}`, "izinler");
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
