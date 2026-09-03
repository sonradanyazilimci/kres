// =============================================================
//  Çoklu Dil Katmanı (i18n.js) — EKLENTİ, MEVCUT KOD DEĞİŞMEZ
//  -----------------------------------------------------------
//  Türkçe (varsayılan) + İngilizce / Almanca / İspanyolca.
//  Çalışma biçimi: sayfa render edildikçe DOM'daki Türkçe metinler
//  (metin düğümleri + placeholder/title/aria-label + <title>) sözlükle
//  değiştirilir. Dinamik içerik için MutationObserver kullanılır.
//  Dil seçimi localStorage'da tutulur; değişince sayfa yeniden yüklenir.
// =============================================================

const KEY = "anaokul360_dil";
const DILLER = { tr: "🇹🇷 Türkçe", en: "🇬🇧 English", de: "🇩🇪 Deutsch", es: "🇪🇸 Español" };

function seciliDil() {
  try {
    const d = localStorage.getItem(KEY);
    return DILLER[d] ? d : "tr";
  } catch { return "tr"; }
}
let LANG = seciliDil();

// ---------- Ay / gün adları (tarih biçimleri için) ----------
const AY_TR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const AY = {
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  de: ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"],
  es: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
};
// uzun -> kısa sırayla (alt-dize çakışmasını önlemek için)
const GUN_TR = ["Cumartesi","Pazartesi","Perşembe","Çarşamba","Pazar","Salı","Cuma"];
const GUN = {
  en: { "Cumartesi":"Saturday","Pazartesi":"Monday","Perşembe":"Thursday","Çarşamba":"Wednesday","Pazar":"Sunday","Salı":"Tuesday","Cuma":"Friday" },
  de: { "Cumartesi":"Samstag","Pazartesi":"Montag","Perşembe":"Donnerstag","Çarşamba":"Mittwoch","Pazar":"Sonntag","Salı":"Dienstag","Cuma":"Freitag" },
  es: { "Cumartesi":"sábado","Pazartesi":"lunes","Perşembe":"jueves","Çarşamba":"miércoles","Pazar":"domingo","Salı":"martes","Cuma":"viernes" }
};

function ceviriTarih(t, lang) {
  if (lang === "tr") return null;
  if (!/\d/.test(t)) return null;
  let hit = false, s = t;
  AY_TR.forEach((m, i) => {
    if (s.includes(m)) { hit = true; s = s.split(m).join(AY[lang][i]); }
  });
  if (!hit) return null;
  GUN_TR.forEach((g) => { if (s.includes(g)) s = s.split(g).join(GUN[lang][g]); });
  return s;
}

// =============================================================
//  SÖZLÜK  { "Türkçe": { en, de, es } }
// =============================================================
const D = {
  // ---------- Marka / sayfa başlıkları ----------
  "Anaokul 360 — Kreş & Anaokulu Yönetim Sistemi": { en: "Anaokul 360 — Nursery & Preschool Management System", de: "Anaokul 360 — Verwaltungssystem für Kita & Vorschule", es: "Anaokul 360 — Sistema de gestión de guardería y preescolar" },
  "Veli Paneli — Anaokul 360": { en: "Parent Panel — Anaokul 360", de: "Elternbereich — Anaokul 360", es: "Panel de familias — Anaokul 360" },
  "Yönetici Paneli — Anaokul 360": { en: "Administrator Panel — Anaokul 360", de: "Verwaltungsbereich — Anaokul 360", es: "Panel de administración — Anaokul 360" },
  "Öğretmen Paneli — Anaokul 360": { en: "Teacher Panel — Anaokul 360", de: "Lehrkraft-Bereich — Anaokul 360", es: "Panel del docente — Anaokul 360" },
  "Sağlayıcı Paneli — Anaokul 360": { en: "Provider Panel — Anaokul 360", de: "Anbieterbereich — Anaokul 360", es: "Panel del proveedor — Anaokul 360" },
  "Kreşinizi Kaydedin — Anaokul 360": { en: "Register Your Nursery — Anaokul 360", de: "Registrieren Sie Ihre Kita — Anaokul 360", es: "Registre su guardería — Anaokul 360" },
  "Kreşiniz için 14 gün ücretsiz deneme. Kart gerekmez.": { en: "A 14-day free trial for your nursery. No card required.", de: "14 Tage kostenlos testen für Ihre Kita. Keine Karte nötig.", es: "Prueba gratuita de 14 días para su guardería. Sin tarjeta." },
  "Kreşiniz için hepsi bir arada bulut yazılım: yoklama & devamsızlık bildirimi, günlük ve aylık gelişim raporu, randevu, kurum zili, medikal ve fiziksel gelişim takibi, geri bildirim anketleri, ajanda, aidat & tahsilat + PDF makbuz, yemek listesi ve haftalık program. Rol bazlı paneller, koyu tema, %100 mobil, KVKK uyumlu. 14 gün ücretsiz.": { en: "All-in-one cloud software for your nursery: attendance & absence notice, daily and monthly development reports, appointments, pickup bell, medication and physical growth tracking, feedback surveys, calendar, fees & collection + PDF receipts, meal list and weekly schedule. Role-based panels, dark theme, 100% mobile, GDPR-compliant. 14 days free.", de: "All-in-one-Cloud-Software für Ihre Kita: Anwesenheit & Abwesenheitsmeldung, tägliche und monatliche Entwicklungsberichte, Termine, Abholklingel, Medikamenten- und Wachstumsverfolgung, Feedback-Umfragen, Kalender, Beiträge & Einnahmen + PDF-Belege, Speiseplan und Wochenplan. Rollenbasierte Bereiche, dunkles Design, 100% mobil, DSGVO-konform. 14 Tage kostenlos.", es: "Software en la nube todo en uno para su guardería: asistencia y aviso de ausencia, informes de desarrollo diarios y mensuales, citas, timbre de recogida, seguimiento de medicación y crecimiento físico, encuestas, agenda, cuotas y cobros + recibos PDF, menú y horario semanal. Paneles por rol, tema oscuro, 100% móvil, conforme al RGPD. 14 días gratis." },

  // ---------- index: navbar ----------
  "Özellikler": { en: "Features", de: "Funktionen", es: "Funciones" },
  "Paneller": { en: "Panels", de: "Bereiche", es: "Paneles" },
  "Nasıl Çalışır": { en: "How It Works", de: "So funktioniert es", es: "Cómo funciona" },
  "Fiyat": { en: "Pricing", de: "Preise", es: "Precios" },
  "İletişim": { en: "Contact", de: "Kontakt", es: "Contacto" },
  "Ücretsiz Dene": { en: "Try Free", de: "Kostenlos testen", es: "Prueba gratis" },
  "Giriş Yap": { en: "Log In", de: "Anmelden", es: "Iniciar sesión" },
  "Panele Git": { en: "Go to Panel", de: "Zum Bereich", es: "Ir al panel" },
  "Ana Sayfa": { en: "Home", de: "Startseite", es: "Inicio" },
  "Ana Sayfaya Dön": { en: "Back to Home", de: "Zurück zur Startseite", es: "Volver al inicio" },

  // ---------- index: hero + bölümler ----------
  "☁️ Bulut tabanlı kreş yazılımı": { en: "☁️ Cloud-based nursery software", de: "☁️ Cloudbasierte Kita-Software", es: "☁️ Software de guardería en la nube" },
  "Kreşinizi tek panelden yönetin": { en: "Manage your nursery from a single panel", de: "Verwalten Sie Ihre Kita über ein einziges Panel", es: "Gestione su guardería desde un solo panel" },
  "Yoklama, günlük ve aylık gelişim raporu, veli iletişimi, fotoğraf galerisi, aidat & tahsilat takibi — hepsi bir arada. Yönetici, öğretmen ve veliler için ayrı paneller. Panel içi bildirimler, koyu tema, %100 mobil; kurulum yok, çevrimdışı açılır, KVKK uyumlu.": { en: "Attendance, daily and monthly development reports, parent communication, photo gallery, fees & collection tracking — all in one. Separate panels for administrators, teachers and parents. In-app notifications, dark theme, 100% mobile; no installation, works offline, GDPR-compliant.", de: "Anwesenheit, tägliche und monatliche Entwicklungsberichte, Elternkommunikation, Fotogalerie, Beitrags- & Einnahmenverfolgung — alles an einem Ort. Separate Bereiche für Verwaltung, Lehrkräfte und Eltern. In-App-Benachrichtigungen, dunkles Design, 100% mobil; keine Installation, offline nutzbar, DSGVO-konform.", es: "Asistencia, informes de desarrollo diarios y mensuales, comunicación con las familias, galería de fotos, seguimiento de cuotas y cobros — todo en uno. Paneles separados para administración, docentes y familias. Notificaciones en la app, tema oscuro, 100% móvil; sin instalación, funciona sin conexión, conforme al RGPD." },
  "14 Gün Ücretsiz Dene": { en: "Try Free for 14 Days", de: "14 Tage kostenlos testen", es: "Prueba gratis 14 días" },
  "Nasıl çalışır?": { en: "How does it work?", de: "Wie funktioniert es?", es: "¿Cómo funciona?" },
  "Kredi kartı gerekmez · Dakikalar içinde kurulum": { en: "No credit card required · Set up in minutes", de: "Keine Kreditkarte nötig · Einrichtung in Minuten", es: "Sin tarjeta de crédito · Configuración en minutos" },
  "Bir kreşin ihtiyacı olan her şey": { en: "Everything a nursery needs", de: "Alles, was eine Kita braucht", es: "Todo lo que una guardería necesita" },
  "Dağınık defterler, WhatsApp grupları ve Excel dosyaları yerine tek sistem.": { en: "One system instead of scattered notebooks, WhatsApp groups and Excel files.", de: "Ein System statt verstreuter Hefte, WhatsApp-Gruppen und Excel-Dateien.", es: "Un solo sistema en lugar de cuadernos dispersos, grupos de WhatsApp y archivos de Excel." },
  "Yoklama & Devamsızlık Bildirimi": { en: "Attendance & Absence Notice", de: "Anwesenheit & Abwesenheitsmeldung", es: "Asistencia y aviso de ausencia" },
  "Öğretmen yoklamayı tek dokunuşla alır (geldi / geç / gelmedi), \"tümü geldi\" kısayoluyla saniyeler sürer. Veli, çocuğunu getiremeyeceği günü önceden bildirir; öğretmene anında düşer.": { en: "The teacher takes attendance with one tap (present / late / absent); the \"all present\" shortcut takes seconds. A parent reports a day their child cannot attend in advance; the teacher is notified instantly.", de: "Die Lehrkraft erfasst die Anwesenheit mit einem Tippen (anwesend / verspätet / abwesend); die Verknüpfung \"alle anwesend\" dauert Sekunden. Eltern melden im Voraus einen Tag, an dem ihr Kind fehlt; die Lehrkraft wird sofort benachrichtigt.", es: "El docente pasa lista con un toque (presente / tarde / ausente); el atajo \"todos presentes\" tarda segundos. La familia avisa con antelación un día que su hijo no asistirá; el docente lo recibe al instante." },
  "Günlük & Aylık Gelişim Raporu": { en: "Daily & Monthly Development Report", de: "Täglicher & monatlicher Entwicklungsbericht", es: "Informe de desarrollo diario y mensual" },
  "Yemek, uyku, tuvalet, ruh hali, etkinlik ve not; hazır kalıplar ve \"dünkü raporu kopyala\" ile hızlı. Tüm sınıfa toplu rapor girin. Veli, ay sonunda grafikli gelişim özetini görür.": { en: "Meal, sleep, toilet, mood, activity and notes; fast with ready templates and \"copy yesterday's report\". Enter a bulk report for the whole class. At month's end the parent sees a charted development summary.", de: "Essen, Schlaf, Toilette, Stimmung, Aktivität und Notizen; schnell mit Vorlagen und \"gestrigen Bericht kopieren\". Sammelbericht für die ganze Gruppe. Am Monatsende sehen Eltern eine grafische Entwicklungsübersicht.", es: "Comida, sueño, baño, estado de ánimo, actividad y notas; rápido con plantillas y \"copiar el informe de ayer\". Introduzca un informe masivo para toda la clase. A fin de mes la familia ve un resumen de desarrollo con gráficos." },
  "Bildirim & İletişim Merkezi": { en: "Notification & Communication Center", de: "Benachrichtigungs- & Kommunikationszentrum", es: "Centro de notificaciones y comunicación" },
  "Okul geneli veya sınıfa özel duyurular, okundu takibi ve birebir mesajlaşma; panel içi bildirim zili her rolde. Önemli hatırlatmaları WhatsApp'tan tek tıkla gönderin.": { en: "School-wide or class-specific announcements, read tracking and one-to-one messaging; an in-app notification bell for every role. Send important reminders via WhatsApp with one click.", de: "Schulweite oder gruppenspezifische Ankündigungen, Lesebestätigung und Einzelnachrichten; eine In-App-Benachrichtigungsglocke für jede Rolle. Wichtige Erinnerungen mit einem Klick per WhatsApp senden.", es: "Anuncios para todo el centro o por clase, seguimiento de lectura y mensajería individual; campana de notificaciones en la app para cada rol. Envíe recordatorios importantes por WhatsApp con un clic." },
  "Fotoğraf Galerisi": { en: "Photo Gallery", de: "Fotogalerie", es: "Galería de fotos" },
  "Sınıf fotoğrafları kendi Google Drive'ınıza yüklenir; depolama maliyeti ve kota derdi yok. Veli galeriyi günlere göre gezer.": { en: "Class photos are uploaded to your own Google Drive; no storage cost or quota worries. Parents browse the gallery by day.", de: "Gruppenfotos werden in Ihr eigenes Google Drive hochgeladen; keine Speicherkosten oder Kontingentsorgen. Eltern durchsuchen die Galerie nach Tagen.", es: "Las fotos de clase se suben a su propio Google Drive; sin coste de almacenamiento ni preocupaciones de cuota. Las familias exploran la galería por días." },
  "Aidat, Tahsilat & Makbuz": { en: "Fees, Collection & Receipts", de: "Beiträge, Einnahmen & Belege", es: "Cuotas, cobros y recibos" },
  "Öğrenci bazında aylık aidat, toplu tahakkuk, tahsilat özeti ve borçlu listesi. Yazdırılabilir / PDF makbuz. Veli \"ödedim\" bildirir, yönetici onaylar.": { en: "Monthly fees per student, bulk assessment, collection summary and debtor list. Printable / PDF receipt. The parent reports \"paid\", the administrator confirms.", de: "Monatsbeiträge pro Kind, Sammelveranlagung, Einnahmenübersicht und Schuldnerliste. Druckbarer / PDF-Beleg. Eltern melden \"bezahlt\", die Verwaltung bestätigt.", es: "Cuota mensual por alumno, generación masiva, resumen de cobros y lista de morosos. Recibo imprimible / PDF. La familia informa \"pagado\" y la administración lo confirma." },
  "İzin Onayı & KVKK": { en: "Permission Approval & GDPR", de: "Einwilligung & DSGVO", es: "Aprobación de permisos y RGPD" },
  "İzin ve izin belgesi onayları veliye ulaşır; veli onayladıktan sonra değiştirilemez. Açık rıza akışı, denetim günlüğü, tek tıkla dışa aktarma; her kreşin verisi yalıtık.": { en: "Permission and consent-form approvals reach the parent; once approved they cannot be changed. Explicit-consent flow, audit log, one-click export; each nursery's data is isolated.", de: "Genehmigungen und Einwilligungsformulare erreichen die Eltern; nach der Zustimmung nicht mehr änderbar. Ablauf für ausdrückliche Einwilligung, Prüfprotokoll, Export mit einem Klick; die Daten jeder Kita sind isoliert.", es: "Las aprobaciones de permisos y formularios de consentimiento llegan a la familia; una vez aprobadas no se pueden cambiar. Flujo de consentimiento explícito, registro de auditoría, exportación con un clic; los datos de cada guardería están aislados." },
  "Günlük işi kolaylaştıran ayrıntılar": { en: "Details that make daily work easier", de: "Details, die die tägliche Arbeit erleichtern", es: "Detalles que facilitan el trabajo diario" },
  "Küçük dokunuşlar zamanınızı geri kazandırır.": { en: "Small touches give your time back.", de: "Kleine Details geben Ihnen Zeit zurück.", es: "Los pequeños detalles le devuelven tiempo." },
  "Haftalık Yemek Listesi": { en: "Weekly Meal List", de: "Wöchentlicher Speiseplan", es: "Menú semanal" },
  "Kahvaltı, öğle ve ikindi menüsünü haftalık girin; veli ve öğretmen kendi panelinden görür.": { en: "Enter the breakfast, lunch and afternoon menu weekly; parents and teachers see it from their own panel.", de: "Geben Sie das Frühstücks-, Mittags- und Nachmittagsmenü wöchentlich ein; Eltern und Lehrkräfte sehen es in ihrem Bereich.", es: "Introduzca el menú de desayuno, comida y merienda cada semana; las familias y los docentes lo ven desde su panel." },
  "Haftalık Sınıf Programı": { en: "Weekly Class Schedule", de: "Wöchentlicher Gruppenplan", es: "Horario semanal de clase" },
  "Ders ve etkinlik çizelgesini sınıf bazında hazırlayın. Öğretmen düzenler, veli takip eder.": { en: "Prepare the lesson and activity schedule per class. The teacher edits, the parent follows.", de: "Erstellen Sie den Stunden- und Aktivitätsplan pro Gruppe. Die Lehrkraft bearbeitet, die Eltern verfolgen.", es: "Prepare el horario de clases y actividades por aula. El docente lo edita, la familia lo sigue." },
  "Gözlem Günlüğü": { en: "Observation Journal", de: "Beobachtungstagebuch", es: "Diario de observación" },
  "Öğretmene özel notlar — çocuğun gelişimini kayıt altına alın. Veliye kapalıdır.": { en: "Teacher-only notes — record the child's development. Hidden from parents.", de: "Nur für Lehrkräfte — halten Sie die Entwicklung des Kindes fest. Für Eltern nicht sichtbar.", es: "Notas solo para el docente — registre el desarrollo del niño. Oculto para las familias." },
  "Yıl Sonu Araçları": { en: "Year-End Tools", de: "Werkzeuge zum Jahresende", es: "Herramientas de fin de curso" },
  "Sınıfları tek adımda bir üst gruba terfi ettirin, tüm velilere toplu kapanış mesajı gönderin.": { en: "Promote classes to the next group in one step, send a bulk closing message to all parents.", de: "Befördern Sie Gruppen in einem Schritt in die nächste Stufe und senden Sie allen Eltern eine Sammel-Abschlussnachricht.", es: "Promocione las clases al siguiente grupo en un paso y envíe un mensaje de cierre masivo a todas las familias." },
  "Öğretmen → Yönetim İstek Formu": { en: "Teacher → Administration Request Form", de: "Formular Lehrkraft → Verwaltung", es: "Formulario docente → administración" },
  "Malzeme, izin ve talepler panelden iletilir; yönetici durumu tek yerden yönetir.": { en: "Supplies, leave and requests are submitted from the panel; the administrator manages the status from one place.", de: "Material, Urlaub und Anfragen werden über den Bereich übermittelt; die Verwaltung steuert den Status zentral.", es: "El material, los permisos y las solicitudes se envían desde el panel; la administración gestiona el estado desde un solo lugar." },
  "Hızlı Arama": { en: "Quick Search", de: "Schnellsuche", es: "Búsqueda rápida" },
  "Yönetici öğrenci veya kullanıcıyı adıyla anında bulur, tek tıkla kaydına gider.": { en: "The administrator finds a student or user by name instantly and jumps to their record with one click.", de: "Die Verwaltung findet ein Kind oder einen Nutzer sofort per Name und springt mit einem Klick zum Datensatz.", es: "La administración encuentra a un alumno o usuario por su nombre al instante y accede a su ficha con un clic." },
  "Koyu Tema": { en: "Dark Theme", de: "Dunkles Design", es: "Tema oscuro" },
  "Her panelde açık/koyu tema; tercih cihazda hatırlanır.": { en: "Light/dark theme in every panel; the preference is remembered on the device.", de: "Helles/dunkles Design in jedem Bereich; die Einstellung wird auf dem Gerät gespeichert.", es: "Tema claro/oscuro en cada panel; la preferencia se recuerda en el dispositivo." },
  "%100 Mobil & PWA": { en: "100% Mobile & PWA", de: "100% Mobil & PWA", es: "100% móvil y PWA" },
  "Telefon, tablet ve masaüstünde birebir çalışır. Uygulama gibi ana ekrana eklenir, çevrimdışı açılır.": { en: "Works identically on phone, tablet and desktop. Adds to the home screen like an app, opens offline.", de: "Funktioniert identisch auf Handy, Tablet und Desktop. Wird wie eine App zum Startbildschirm hinzugefügt, offline nutzbar.", es: "Funciona igual en teléfono, tableta y ordenador. Se añade a la pantalla de inicio como una app y abre sin conexión." },
  "Sistem Duyuruları": { en: "System Announcements", de: "Systemankündigungen", es: "Anuncios del sistema" },
  "Bakım, yeni özellik ve önemli bilgilendirmeler tüm panellerin üstünde görünür.": { en: "Maintenance, new features and important notices appear at the top of every panel.", de: "Wartung, neue Funktionen und wichtige Hinweise erscheinen oben in jedem Bereich.", es: "El mantenimiento, las nuevas funciones y los avisos importantes aparecen en la parte superior de cada panel." },
  "Kreşinize özel modüller": { en: "Modules tailored to your nursery", de: "Auf Ihre Kita zugeschnittene Module", es: "Módulos a medida para su guardería" },
  "İhtiyaç duydukça açılan, günlük akışa oturan ek yetenekler.": { en: "Extra capabilities enabled as needed, fitting into the daily flow.", de: "Zusätzliche Funktionen, die bei Bedarf aktiviert werden und sich in den Alltag einfügen.", es: "Funciones adicionales que se activan cuando se necesitan y encajan en el día a día." },
  "Randevu Modülü": { en: "Appointment Module", de: "Terminmodul", es: "Módulo de citas" },
  "Veliler, çocuklarının öğretmeni veya yönetici ile kolayca randevu oluşturur. Personel bu randevulara not ekleyerek süreci daha verimli yönetir.": { en: "Parents easily create appointments with their child's teacher or an administrator. Staff manage the process more efficiently by adding notes to these appointments.", de: "Eltern erstellen einfach Termine mit der Lehrkraft ihres Kindes oder der Verwaltung. Das Personal steuert den Ablauf effizienter durch Notizen zu diesen Terminen.", es: "Las familias crean fácilmente citas con el docente de su hijo o con la administración. El personal gestiona el proceso de forma más eficiente añadiendo notas a estas citas." },
  "Kurum Zili": { en: "Pickup Bell", de: "Abholklingel", es: "Timbre de recogida" },
  "Veli, çocuğunu almak için yola çıktığında \"Geliyorum\" butonuyla öğretmeni bilgilendirir; kapıya geldiğinde \"Geldim\" ile hızlı ve güvenli teslim sağlanır.": { en: "When a parent sets off to collect their child, the \"On my way\" button notifies the teacher; \"I'm here\" on arrival at the door ensures a fast, safe handover.", de: "Wenn Eltern zur Abholung losfahren, informiert die Schaltfläche \"Ich komme\" die Lehrkraft; \"Ich bin da\" an der Tür sorgt für eine schnelle, sichere Übergabe.", es: "Cuando la familia sale a recoger a su hijo, el botón \"Voy en camino\" avisa al docente; \"He llegado\" en la puerta garantiza una entrega rápida y segura." },
  "Medikal Takip": { en: "Medication Tracking", de: "Medikamentenverfolgung", es: "Seguimiento de medicación" },
  "Öğrencilerin ilaç bilgilerini sisteme kaydedin, günlük hatırlatma alın; doz uygulandığında veli anlık olarak bilgilendirilir.": { en: "Record students' medication details in the system, get daily reminders; when a dose is given the parent is notified instantly.", de: "Erfassen Sie die Medikamentendaten der Kinder im System und erhalten Sie tägliche Erinnerungen; wird eine Dosis verabreicht, werden die Eltern sofort informiert.", es: "Registre los datos de medicación de los alumnos en el sistema y reciba recordatorios diarios; cuando se administra una dosis, la familia recibe un aviso al instante." },
  "Fiziksel Gelişim Takibi": { en: "Physical Growth Tracking", de: "Verfolgung der körperlichen Entwicklung", es: "Seguimiento del crecimiento físico" },
  "Boy ve kilo ölçümlerini kaydedin, grafikle gelişimi izleyin; veliler kendi çocuklarının verilerini görüntüler.": { en: "Record height and weight measurements, track growth with a chart; parents view their own child's data.", de: "Erfassen Sie Größe und Gewicht, verfolgen Sie die Entwicklung per Diagramm; Eltern sehen die Daten ihres eigenen Kindes.", es: "Registre las mediciones de estatura y peso, siga el crecimiento con un gráfico; las familias ven los datos de su propio hijo." },
  "Geri Bildirim Modülü": { en: "Feedback Module", de: "Feedback-Modul", es: "Módulo de opiniones" },
  "Personel ve velilere anket yapın, onay kaydı oluşturun ve metin tabanlı cevaplar toplayın; sonuçları tek ekranda görün.": { en: "Survey staff and parents, create approval records and collect text answers; see the results on one screen.", de: "Befragen Sie Personal und Eltern, erstellen Sie Zustimmungsnachweise und sammeln Sie Textantworten; sehen Sie die Ergebnisse auf einem Bildschirm.", es: "Encueste al personal y a las familias, cree registros de aprobación y recopile respuestas de texto; vea los resultados en una sola pantalla." },
  "Günün Özeti Modülü": { en: "Daily Summary Module", de: "Modul Tagesübersicht", es: "Módulo de resumen del día" },
  "Yalnızca yöneticilere açık. Yoklama ve günlük raporu yapan/yapmayan öğretmenleri görün, eksik işlemi olanlara tek tıkla hatırlatma gönderin.": { en: "Administrators only. See which teachers have or haven't done attendance and the daily report; send a one-click reminder to those with missing tasks.", de: "Nur für die Verwaltung. Sehen Sie, welche Lehrkräfte Anwesenheit und Tagesbericht erledigt haben oder nicht; senden Sie mit einem Klick eine Erinnerung an alle mit offenen Aufgaben.", es: "Solo para la administración. Vea qué docentes han hecho o no la asistencia y el informe diario; envíe un recordatorio con un clic a quienes tengan tareas pendientes." },
  "Ajanda Modülü": { en: "Calendar Module", de: "Kalendermodul", es: "Módulo de agenda" },
  "Önemli gün ve haftalar ile öğrenci ve personel doğum günleri otomatik listelenir; kendi hatırlatma ve etkinliklerinizi kolayca eklersiniz.": { en: "Important days and weeks plus student and staff birthdays are listed automatically; add your own reminders and events easily.", de: "Wichtige Tage und Wochen sowie Geburtstage von Kindern und Personal werden automatisch aufgelistet; fügen Sie eigene Erinnerungen und Ereignisse einfach hinzu.", es: "Los días y semanas importantes, además de los cumpleaños de alumnos y personal, se listan automáticamente; añada fácilmente sus propios recordatorios y eventos." },
  "Öğrenciye Özel Doküman Paylaşımı": { en: "Student-Specific Document Sharing", de: "Kindbezogene Dokumentenfreigabe", es: "Compartir documentos por alumno" },
  "Velilere özel dokümanları kolayca paylaşın. Dosyalar da kreşin kendi Google Drive hesabında saklanır.": { en: "Easily share private documents with parents. Files are also stored in the nursery's own Google Drive account.", de: "Teilen Sie private Dokumente einfach mit den Eltern. Dateien werden ebenfalls im eigenen Google-Drive-Konto der Kita gespeichert.", es: "Comparta fácilmente documentos privados con las familias. Los archivos también se guardan en la cuenta de Google Drive de la propia guardería." },
  "Üç panel, üç deneyim": { en: "Three panels, three experiences", de: "Drei Bereiche, drei Erlebnisse", es: "Tres paneles, tres experiencias" },
  "Herkes yalnızca kendi işini görür; karmaşa yok.": { en: "Everyone sees only their own work; no clutter.", de: "Jeder sieht nur seine eigenen Aufgaben; kein Durcheinander.", es: "Cada uno ve solo su propio trabajo; sin desorden." },
  "Tüm okulu yönetir": { en: "Manages the whole school", de: "Verwaltet die ganze Einrichtung", es: "Gestiona todo el centro" },
  "Öğretmen/veli hesapları, sınıflar, öğrenci kayıtları, duyurular, aidat & tahsilat ve PDF makbuz, yemek listesi ve haftalık program, yıl sonu terfi, hızlı arama, genel bakış panosu ve ayarlar.": { en: "Teacher/parent accounts, classes, student records, announcements, fees & collection and PDF receipts, meal list and weekly schedule, year-end promotion, quick search, overview dashboard and settings.", de: "Lehrkraft-/Elternkonten, Gruppen, Kinderdatensätze, Ankündigungen, Beiträge & Einnahmen und PDF-Belege, Speiseplan und Wochenplan, Beförderung zum Jahresende, Schnellsuche, Übersichts-Dashboard und Einstellungen.", es: "Cuentas de docentes/familias, clases, fichas de alumnos, anuncios, cuotas y cobros y recibos PDF, menú y horario semanal, promoción de fin de curso, búsqueda rápida, panel general y ajustes." },
  "Sadece kendi sınıfı": { en: "Only their own class", de: "Nur die eigene Gruppe", es: "Solo su propia clase" },
  "Yoklama, günlük ve toplu rapor, gözlem günlüğü, sınıf fotoğrafı, sınıfa duyuru, haftalık program ve velilerle mesajlaşma; yönetime istek iletir.": { en: "Attendance, daily and bulk reports, observation journal, class photos, class announcements, weekly schedule and messaging with parents; submits requests to administration.", de: "Anwesenheit, Tages- und Sammelberichte, Beobachtungstagebuch, Gruppenfotos, Gruppenankündigungen, Wochenplan und Nachrichten an Eltern; sendet Anfragen an die Verwaltung.", es: "Asistencia, informes diarios y masivos, diario de observación, fotos de clase, anuncios de clase, horario semanal y mensajería con las familias; envía solicitudes a la administración." },
  "Sadece kendi çocuğu": { en: "Only their own child", de: "Nur das eigene Kind", es: "Solo su propio hijo" },
  "Günlük raporlar ve aylık gelişim özeti, yoklama geçmişi, devamsızlık bildirimi, fotoğraf galerisi, duyurular, mesajlaşma, aidat durumu, yemek listesi ve izin onayları.": { en: "Daily reports and monthly development summary, attendance history, absence notice, photo gallery, announcements, messaging, fee status, meal list and permission approvals.", de: "Tagesberichte und monatliche Entwicklungsübersicht, Anwesenheitsverlauf, Abwesenheitsmeldung, Fotogalerie, Ankündigungen, Nachrichten, Beitragsstatus, Speiseplan und Einwilligungen.", es: "Informes diarios y resumen mensual de desarrollo, historial de asistencia, aviso de ausencia, galería de fotos, anuncios, mensajería, estado de cuotas, menú y aprobaciones de permisos." },
  "4 adımda başlayın": { en: "Get started in 4 steps", de: "In 4 Schritten starten", es: "Empiece en 4 pasos" },
  "Kurulum dosyası indirmeye, sunucuya gerek yok.": { en: "No setup file to download, no server needed.", de: "Keine Installationsdatei, kein Server nötig.", es: "Sin archivo de instalación que descargar, sin servidor." },
  "Ücretsiz kaydolun": { en: "Sign up for free", de: "Kostenlos registrieren", es: "Regístrese gratis" },
  "Kreş adı ve yönetici bilgilerinizle başvurun. Onaydan sonra 14 gün tam erişim başlar.": { en: "Apply with your nursery name and administrator details. After approval, 14 days of full access begin.", de: "Bewerben Sie sich mit Kita-Namen und Verwalterdaten. Nach der Freigabe beginnen 14 Tage voller Zugriff.", es: "Solicite con el nombre de la guardería y los datos del administrador. Tras la aprobación comienzan 14 días de acceso completo." },
  "Kreşinizi kurun": { en: "Set up your nursery", de: "Richten Sie Ihre Kita ein", es: "Configure su guardería" },
  "Sınıfları, öğretmenleri ve öğrencileri ekleyin. Fotoğraf servisi için Google Drive'ınızı bağlayın.": { en: "Add classes, teachers and students. Connect your Google Drive for the photo service.", de: "Fügen Sie Gruppen, Lehrkräfte und Kinder hinzu. Verbinden Sie Ihr Google Drive für den Fotodienst.", es: "Añada clases, docentes y alumnos. Conecte su Google Drive para el servicio de fotos." },
  "Velileri davet edin": { en: "Invite parents", de: "Laden Sie die Eltern ein", es: "Invite a las familias" },
  "Her veliye hesap oluşturun; şifre belirleme bağlantısı e-postayla gider.": { en: "Create an account for each parent; a password-setup link is sent by e-mail.", de: "Erstellen Sie für jeden Elternteil ein Konto; ein Link zum Festlegen des Passworts wird per E-Mail versendet.", es: "Cree una cuenta para cada familia; se envía por correo un enlace para establecer la contraseña." },
  "Kullanmaya başlayın": { en: "Start using it", de: "Loslegen", es: "Empiece a usarlo" },
  "Öğretmenler yoklama ve rapor girer, veliler telefonundan takip eder; bildirimler panel içinde düşer. Uygulama gibi kurulabilir (PWA), koyu tema destekler.": { en: "Teachers enter attendance and reports, parents follow from their phone; notifications arrive in the panel. Installable like an app (PWA), supports dark theme.", de: "Lehrkräfte erfassen Anwesenheit und Berichte, Eltern verfolgen alles per Handy; Benachrichtigungen erscheinen im Bereich. Wie eine App installierbar (PWA), unterstützt dunkles Design.", es: "Los docentes introducen la asistencia y los informes, las familias lo siguen desde el móvil; las notificaciones llegan al panel. Instalable como una app (PWA), admite tema oscuro." },
  "Basit fiyatlandırma": { en: "Simple pricing", de: "Einfache Preise", es: "Precios sencillos" },
  "Deneme süresi bittiğinde veriniz silinmez; abonelikle kaldığınız yerden devam edersiniz.": { en: "Your data is not deleted when the trial ends; with a subscription you continue where you left off.", de: "Ihre Daten werden nach Ablauf der Testphase nicht gelöscht; mit einem Abo machen Sie dort weiter, wo Sie aufgehört haben.", es: "Sus datos no se eliminan al terminar la prueba; con una suscripción continúa donde lo dejó." },
  "Deneme": { en: "Trial", de: "Testphase", es: "Prueba" },
  "14 gün ücretsiz": { en: "14 days free", de: "14 Tage kostenlos", es: "14 días gratis" },
  "Tüm özellikler açık. Kredi kartı istenmez. Kayıt sonrası sağlayıcı onayıyla başlar.": { en: "All features enabled. No credit card required. Starts after provider approval following registration.", de: "Alle Funktionen aktiv. Keine Kreditkarte nötig. Beginnt nach der Anbieterfreigabe im Anschluss an die Registrierung.", es: "Todas las funciones activas. Sin tarjeta de crédito. Comienza tras la aprobación del proveedor después del registro." },
  "Hemen dene": { en: "Try now", de: "Jetzt testen", es: "Probar ahora" },
  "Abonelik": { en: "Subscription", de: "Abonnement", es: "Suscripción" },
  "Kreşinize göre": { en: "Based on your nursery", de: "Je nach Kita", es: "Según su guardería" },
  "Öğrenci sayısına göre aylık abonelik. Kurumsal fatura ve kurulum desteği dahil. Fiyat için bize yazın.": { en: "Monthly subscription based on the number of students. Corporate invoice and setup support included. Contact us for pricing.", de: "Monatliches Abo nach Anzahl der Kinder. Geschäftsrechnung und Einrichtungshilfe inklusive. Für Preise kontaktieren Sie uns.", es: "Suscripción mensual según el número de alumnos. Incluye factura para empresas y ayuda de configuración. Escríbanos para conocer el precio." },
  "Teklif isteyin": { en: "Request a quote", de: "Angebot anfordern", es: "Solicitar presupuesto" },
  "Sorularınız mı var?": { en: "Have questions?", de: "Haben Sie Fragen?", es: "¿Tiene preguntas?" },
  "Demo talep edin, fiyat isteyin veya sisteme dair her şeyi sorun.": { en: "Request a demo, ask for pricing or ask anything about the system.", de: "Fordern Sie eine Demo an, fragen Sie nach Preisen oder stellen Sie jede Frage zum System.", es: "Solicite una demo, pida precios o pregunte cualquier cosa sobre el sistema." },
  "Verileriniz AB (eur3) bölgesinde, şifreli olarak saklanır": { en: "Your data is stored encrypted in the EU (eur3) region", de: "Ihre Daten werden verschlüsselt in der EU-Region (eur3) gespeichert", es: "Sus datos se almacenan cifrados en la región de la UE (eur3)" },
  "Ad Soyad / Kreş adı": { en: "Full name / Nursery name", de: "Vor- und Nachname / Kita-Name", es: "Nombre y apellidos / Nombre de la guardería" },
  "Telefon veya e-posta": { en: "Phone or e-mail", de: "Telefon oder E-Mail", es: "Teléfono o correo electrónico" },
  "Mesajınız": { en: "Your message", de: "Ihre Nachricht", es: "Su mensaje" },
  "Bu form yalnızca demo amaçlıdır.": { en: "This form is for demo purposes only.", de: "Dieses Formular dient nur zu Demozwecken.", es: "Este formulario es solo para demostración." },
  "Mesajınız alındı. En kısa sürede dönüş yapacağız.": { en: "Your message has been received. We will get back to you shortly.", de: "Ihre Nachricht ist eingegangen. Wir melden uns in Kürze.", es: "Hemos recibido su mensaje. Le responderemos lo antes posible." },
  "Aydınlatma Metni": { en: "Privacy Notice", de: "Datenschutzhinweis", es: "Aviso de privacidad" },
  "KVKK": { en: "GDPR", de: "DSGVO", es: "RGPD" },
  "Veri Sözleşmesi": { en: "Data Agreement", de: "Datenvereinbarung", es: "Acuerdo de datos" },
  "KVKK / Gizlilik Politikası": { en: "GDPR / Privacy Policy", de: "DSGVO / Datenschutzrichtlinie", es: "RGPD / Política de privacidad" },
  "KVKK / Veri": { en: "GDPR / Data", de: "DSGVO / Daten", es: "RGPD / Datos" },
  "Veri İşleme Sözleşmesi": { en: "Data Processing Agreement", de: "Auftragsverarbeitungsvertrag", es: "Acuerdo de tratamiento de datos" },
  "Anaokul 360 · Kreş & Anaokulu Yönetim Sistemi. Tüm hakları saklıdır.": { en: "Anaokul 360 · Nursery & Preschool Management System. All rights reserved.", de: "Anaokul 360 · Verwaltungssystem für Kita & Vorschule. Alle Rechte vorbehalten.", es: "Anaokul 360 · Sistema de gestión de guardería y preescolar. Todos los derechos reservados." },
  "Panele Giriş": { en: "Panel Login", de: "Anmeldung zum Bereich", es: "Acceso al panel" },
  "Yönetici, öğretmen ve veli girişi": { en: "Administrator, teacher and parent login", de: "Anmeldung für Verwaltung, Lehrkräfte und Eltern", es: "Acceso para administración, docentes y familias" },
  "Giriş yapılıyor...": { en: "Signing in...", de: "Anmeldung läuft...", es: "Iniciando sesión..." },

  // ---------- Ortak: paneller / menü ----------
  "Yönetici": { en: "Administrator", de: "Verwaltung", es: "Administración" },
  "Öğretmen": { en: "Teacher", de: "Lehrkraft", es: "Docente" },
  "Veli": { en: "Parent", de: "Eltern", es: "Familia" },
  "Çıkış": { en: "Log out", de: "Abmelden", es: "Salir" },
  "Çıkış Yap": { en: "Log Out", de: "Abmelden", es: "Cerrar sesión" },
  "Genel Bakış": { en: "Overview", de: "Übersicht", es: "Vista general" },
  "Kullanıcılar": { en: "Users", de: "Nutzer", es: "Usuarios" },
  "Sınıflar": { en: "Classes", de: "Gruppen", es: "Clases" },
  "Öğrenciler": { en: "Students", de: "Kinder", es: "Alumnos" },
  "Duyurular": { en: "Announcements", de: "Ankündigungen", es: "Anuncios" },
  "Galeri": { en: "Gallery", de: "Galerie", es: "Galería" },
  "Aidat / Ödeme": { en: "Fees / Payments", de: "Beiträge / Zahlungen", es: "Cuotas / Pagos" },
  "Talepler": { en: "Requests", de: "Anfragen", es: "Solicitudes" },
  "İzin / Belge": { en: "Permissions / Documents", de: "Einwilligungen / Dokumente", es: "Permisos / Documentos" },
  "İzin / Belgeler": { en: "Permissions / Documents", de: "Einwilligungen / Dokumente", es: "Permisos / Documentos" },
  "Randevular": { en: "Appointments", de: "Termine", es: "Citas" },
  "Sağlık & Gelişim": { en: "Health & Growth", de: "Gesundheit & Entwicklung", es: "Salud y desarrollo" },
  "Geri Bildirim": { en: "Feedback", de: "Feedback", es: "Opiniones" },
  "Ajanda": { en: "Calendar", de: "Kalender", es: "Agenda" },
  "Belge Paylaşımı": { en: "Document Sharing", de: "Dokumentenfreigabe", es: "Compartir documentos" },
  "Belgeler": { en: "Documents", de: "Dokumente", es: "Documentos" },
  "Belgelerim": { en: "My Documents", de: "Meine Dokumente", es: "Mis documentos" },
  "Günün Özeti": { en: "Daily Summary", de: "Tagesübersicht", es: "Resumen del día" },
  "Yemek & Program": { en: "Meals & Schedule", de: "Essen & Plan", es: "Comidas y horario" },
  "Yıl Sonu": { en: "Year End", de: "Jahresende", es: "Fin de curso" },
  "Ayarlar": { en: "Settings", de: "Einstellungen", es: "Ajustes" },
  "Sınıfım": { en: "My Class", de: "Meine Gruppe", es: "Mi clase" },
  "Yoklama": { en: "Attendance", de: "Anwesenheit", es: "Asistencia" },
  "Günlük Rapor": { en: "Daily Report", de: "Tagesbericht", es: "Informe diario" },
  "Toplu Rapor": { en: "Bulk Report", de: "Sammelbericht", es: "Informe masivo" },
  "Yönetime İstek": { en: "Request to Administration", de: "Anfrage an die Verwaltung", es: "Solicitud a administración" },
  "Özet": { en: "Summary", de: "Übersicht", es: "Resumen" },
  "Günlük Raporlar": { en: "Daily Reports", de: "Tagesberichte", es: "Informes diarios" },
  "Aylık Özet": { en: "Monthly Summary", de: "Monatsübersicht", es: "Resumen mensual" },
  "Mesajlar": { en: "Messages", de: "Nachrichten", es: "Mensajes" },
  "Ödemeler": { en: "Payments", de: "Zahlungen", es: "Pagos" },

  // ---------- Ortak: butonlar / eylemler ----------
  "Sil": { en: "Delete", de: "Löschen", es: "Eliminar" },
  "Silindi.": { en: "Deleted.", de: "Gelöscht.", es: "Eliminado." },
  "Düzenle": { en: "Edit", de: "Bearbeiten", es: "Editar" },
  "Kaydet": { en: "Save", de: "Speichern", es: "Guardar" },
  "Kaydedildi.": { en: "Saved.", de: "Gespeichert.", es: "Guardado." },
  "Kaydediliyor...": { en: "Saving...", de: "Wird gespeichert...", es: "Guardando..." },
  "Gönder": { en: "Send", de: "Senden", es: "Enviar" },
  "Gönderiliyor...": { en: "Sending...", de: "Wird gesendet...", es: "Enviando..." },
  "Yükle": { en: "Upload", de: "Hochladen", es: "Subir" },
  "Yükleniyor...": { en: "Loading...", de: "Wird geladen...", es: "Cargando..." },
  "Yükleniyor": { en: "Loading", de: "Wird geladen", es: "Cargando" },
  "yükleniyor...": { en: "loading...", de: "wird geladen...", es: "cargando..." },
  "Aç": { en: "Open", de: "Öffnen", es: "Abrir" },
  "Kapat": { en: "Close", de: "Schließen", es: "Cerrar" },
  "Güncelle": { en: "Update", de: "Aktualisieren", es: "Actualizar" },
  "Güncellendi.": { en: "Updated.", de: "Aktualisiert.", es: "Actualizado." },
  "Ekle": { en: "Add", de: "Hinzufügen", es: "Añadir" },
  "Eklendi.": { en: "Added.", de: "Hinzugefügt.", es: "Añadido." },
  "Vazgeç": { en: "Cancel", de: "Abbrechen", es: "Cancelar" },
  "İptal et": { en: "Cancel", de: "Stornieren", es: "Anular" },
  "İptal edildi": { en: "Cancelled", de: "Storniert", es: "Anulado" },
  "Yayınla": { en: "Publish", de: "Veröffentlichen", es: "Publicar" },
  "Görüntüle": { en: "View", de: "Ansehen", es: "Ver" },
  "İndir": { en: "Download", de: "Herunterladen", es: "Descargar" },
  "Uygula": { en: "Apply", de: "Anwenden", es: "Aplicar" },
  "Taşı": { en: "Move", de: "Verschieben", es: "Mover" },
  "Sıfırla": { en: "Reset", de: "Zurücksetzen", es: "Restablecer" },
  "Onayla": { en: "Approve", de: "Bestätigen", es: "Aprobar" },
  "Onaylandı": { en: "Approved", de: "Bestätigt", es: "Aprobado" },
  "Onaylıyorum": { en: "I approve", de: "Ich stimme zu", es: "Apruebo" },
  "Reddet": { en: "Reject", de: "Ablehnen", es: "Rechazar" },
  "Reddedildi": { en: "Rejected", de: "Abgelehnt", es: "Rechazado" },
  "Reddediyorum": { en: "I reject", de: "Ich lehne ab", es: "Rechazo" },
  "Devam Et": { en: "Continue", de: "Weiter", es: "Continuar" },
  "Geri al": { en: "Undo", de: "Rückgängig", es: "Deshacer" },
  "Geri alındı.": { en: "Undone.", de: "Rückgängig gemacht.", es: "Deshecho." },
  "Geri çek": { en: "Withdraw", de: "Zurückziehen", es: "Retirar" },
  "Geri çekildi.": { en: "Withdrawn.", de: "Zurückgezogen.", es: "Retirado." },
  "Görüntüle": { en: "View", de: "Ansehen", es: "Ver" },
  "Oluşturuluyor...": { en: "Creating...", de: "Wird erstellt...", es: "Creando..." },
  "Kontrol ediliyor...": { en: "Checking...", de: "Wird geprüft...", es: "Comprobando..." },
  "Kalıcı olarak sil": { en: "Delete permanently", de: "Endgültig löschen", es: "Eliminar permanentemente" },
  "Siliniyor...": { en: "Deleting...", de: "Wird gelöscht...", es: "Eliminando..." },
  "Taşınıyor...": { en: "Moving...", de: "Wird verschoben...", es: "Moviendo..." },
  "Evet": { en: "Yes", de: "Ja", es: "Sí" },
  "Hayır": { en: "No", de: "Nein", es: "No" },
  "Evet, sil": { en: "Yes, delete", de: "Ja, löschen", es: "Sí, eliminar" },
  "Onay": { en: "Confirm", de: "Bestätigung", es: "Confirmar" },
  "Aktifleştir": { en: "Activate", de: "Aktivieren", es: "Activar" },
  "Pasife al": { en: "Deactivate", de: "Deaktivieren", es: "Desactivar" },
  "Kapat": { en: "Close", de: "Schließen", es: "Cerrar" },
  "Diğer": { en: "Other", de: "Sonstige", es: "Otro" },
  "Kaydet": { en: "Save", de: "Speichern", es: "Guardar" },

  // ---------- utils: durumlar / boş durumlar / hatalar ----------
  "Kayıt bulunamadı": { en: "No records found", de: "Keine Einträge gefunden", es: "No se encontraron registros" },
  "Kayıt yok": { en: "No records", de: "Keine Einträge", es: "Sin registros" },
  "Kayıt silindi.": { en: "Record deleted.", de: "Eintrag gelöscht.", es: "Registro eliminado." },
  "Beklenmeyen bir hata oluştu.": { en: "An unexpected error occurred.", de: "Ein unerwarteter Fehler ist aufgetreten.", es: "Se ha producido un error inesperado." },
  "Geçersiz e-posta adresi.": { en: "Invalid e-mail address.", de: "Ungültige E-Mail-Adresse.", es: "Dirección de correo no válida." },
  "Bu hesap devre dışı bırakılmış.": { en: "This account has been disabled.", de: "Dieses Konto wurde deaktiviert.", es: "Esta cuenta ha sido deshabilitada." },
  "Kullanıcı bulunamadı.": { en: "User not found.", de: "Nutzer nicht gefunden.", es: "Usuario no encontrado." },
  "Kullanıcı bulunamadı": { en: "User not found", de: "Nutzer nicht gefunden", es: "Usuario no encontrado" },
  "Hatalı şifre.": { en: "Incorrect password.", de: "Falsches Passwort.", es: "Contraseña incorrecta." },
  "E-posta veya şifre hatalı.": { en: "E-mail or password is incorrect.", de: "E-Mail oder Passwort ist falsch.", es: "El correo o la contraseña son incorrectos." },
  "Bu e-posta adresi zaten kullanılıyor.": { en: "This e-mail address is already in use.", de: "Diese E-Mail-Adresse wird bereits verwendet.", es: "Esta dirección de correo ya está en uso." },
  "Şifre en az 6 karakter olmalı.": { en: "The password must be at least 6 characters.", de: "Das Passwort muss mindestens 6 Zeichen haben.", es: "La contraseña debe tener al menos 6 caracteres." },
  "Çok fazla deneme yapıldı. Lütfen sonra tekrar deneyin.": { en: "Too many attempts. Please try again later.", de: "Zu viele Versuche. Bitte später erneut versuchen.", es: "Demasiados intentos. Inténtelo de nuevo más tarde." },
  "Ağ hatası. İnternet bağlantınızı kontrol edin.": { en: "Network error. Check your internet connection.", de: "Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.", es: "Error de red. Compruebe su conexión a internet." },
  "Bu işlem için yetkiniz yok.": { en: "You are not authorized for this action.", de: "Sie sind für diese Aktion nicht berechtigt.", es: "No tiene permiso para esta acción." },
  "Sunucuya ulaşılamıyor. Lütfen tekrar deneyin.": { en: "The server cannot be reached. Please try again.", de: "Der Server ist nicht erreichbar. Bitte erneut versuchen.", es: "No se puede contactar con el servidor. Inténtelo de nuevo." },
  "Hesabınız bir kreşe bağlı değil. Yöneticinize ya da destek ekibine başvurun.": { en: "Your account is not linked to a nursery. Contact your administrator or the support team.", de: "Ihr Konto ist keiner Kita zugeordnet. Wenden Sie sich an Ihre Verwaltung oder das Support-Team.", es: "Su cuenta no está vinculada a ninguna guardería. Contacte con su administración o con el equipo de soporte." },

  // ---------- utils: tema / pwa / bildirim ----------
  "Açık tema": { en: "Light theme", de: "Helles Design", es: "Tema claro" },
  "Koyu tema": { en: "Dark theme", de: "Dunkles Design", es: "Tema oscuro" },
  "📲 Uygulamayı yükle": { en: "📲 Install the app", de: "📲 App installieren", es: "📲 Instalar la app" },
  "Bildirimler": { en: "Notifications", de: "Benachrichtigungen", es: "Notificaciones" },
  "Bildirim": { en: "Notification", de: "Benachrichtigung", es: "Notificación" },
  "Tümünü okundu yap": { en: "Mark all as read", de: "Alle als gelesen markieren", es: "Marcar todo como leído" },
  "Henüz bildirim yok": { en: "No notifications yet", de: "Noch keine Benachrichtigungen", es: "Aún no hay notificaciones" },
  "Okunmuş eski bildirimleri temizle": { en: "Clear old read notifications", de: "Alte gelesene Benachrichtigungen löschen", es: "Borrar notificaciones leídas antiguas" },
  "Bildirimler güncellenemedi.": { en: "Notifications could not be updated.", de: "Benachrichtigungen konnten nicht aktualisiert werden.", es: "No se pudieron actualizar las notificaciones." },
  "Eski bildirimler temizlendi.": { en: "Old notifications cleared.", de: "Alte Benachrichtigungen gelöscht.", es: "Notificaciones antiguas borradas." },
  "Okundu işaretle": { en: "Mark as read", de: "Als gelesen markieren", es: "Marcar como leído" },
  "Okundu": { en: "Read", de: "Gelesen", es: "Leído" },
  "Tümünü okundu yap": { en: "Mark all as read", de: "Alle als gelesen markieren", es: "Marcar todo como leído" },

  // ---------- kres.js: kilit ekranı / deneme bandı ----------
  "Başvurunuz inceleniyor": { en: "Your application is under review", de: "Ihr Antrag wird geprüft", es: "Su solicitud está en revisión" },
  "Aboneliğiniz pasif": { en: "Your subscription is inactive", de: "Ihr Abonnement ist inaktiv", es: "Su suscripción está inactiva" },
  "kreş kaydınız alındı. Sağlayıcı onayından sonra panelinize erişebileceksiniz. Onaylandığında bu sayfayı yenileyin.": { en: "your nursery registration has been received. You will be able to access your panel after provider approval. Refresh this page once approved.", de: "Ihre Kita-Registrierung ist eingegangen. Nach der Anbieterfreigabe können Sie auf Ihren Bereich zugreifen. Aktualisieren Sie diese Seite nach der Freigabe.", es: "se ha recibido el registro de su guardería. Podrá acceder a su panel tras la aprobación del proveedor. Actualice esta página una vez aprobada." },
  "kreşinin erişim süresi doldu ya da aboneliği pasif. Devam için sağlayıcı ile görüşün.": { en: "the nursery's access period has ended or its subscription is inactive. Contact the provider to continue.", de: "Der Zugriffszeitraum der Kita ist abgelaufen oder das Abo ist inaktiv. Wenden Sie sich zur Fortsetzung an den Anbieter.", es: "el período de acceso de la guardería ha finalizado o su suscripción está inactiva. Contacte con el proveedor para continuar." },
  "Deneme süreniz doldu. Panel salt-okunur; kayıt/düzenleme yapılamaz.": { en: "Your trial has ended. The panel is read-only; you cannot add or edit.", de: "Ihre Testphase ist abgelaufen. Der Bereich ist schreibgeschützt; kein Anlegen/Bearbeiten möglich.", es: "Su prueba ha finalizado. El panel es de solo lectura; no se puede añadir ni editar." },
  "Aboneliğiniz sona erdi. Panel salt-okunur; yenilemek için sağlayıcıyla görüşün.": { en: "Your subscription has ended. The panel is read-only; contact the provider to renew.", de: "Ihr Abonnement ist abgelaufen. Der Bereich ist schreibgeschützt; wenden Sie sich zur Verlängerung an den Anbieter.", es: "Su suscripción ha finalizado. El panel es de solo lectura; contacte con el proveedor para renovarla." },
  "Deneme süreniz doldu. Panel salt-okunur; kayıt/düzenleme yapılamaz.": { en: "Your trial has ended. The panel is read-only; you cannot add or edit.", de: "Ihre Testphase ist abgelaufen. Der Bereich ist schreibgeschützt; kein Anlegen/Bearbeiten möglich.", es: "Su prueba ha finalizado. El panel es de solo lectura; no se puede añadir ni editar." },
  "Erişim süreniz doldu ya da abonelik pasif. Yeni kayıt/düzenleme yapılamıyor.": { en: "Your access period has ended or the subscription is inactive. New records/edits cannot be made.", de: "Ihr Zugriffszeitraum ist abgelaufen oder das Abo ist inaktiv. Neue Einträge/Bearbeitungen sind nicht möglich.", es: "Su período de acceso ha finalizado o la suscripción está inactiva. No se pueden crear ni editar registros." },
  "Kreş aboneliği pasif — kayıt yapılamıyor.": { en: "Nursery subscription inactive — cannot save.", de: "Kita-Abo inaktiv — Speichern nicht möglich.", es: "Suscripción de la guardería inactiva — no se puede guardar." },
  "Kreş aboneliği pasif — mesaj gönderilemiyor.": { en: "Nursery subscription inactive — cannot send messages.", de: "Kita-Abo inaktiv — Nachrichten nicht möglich.", es: "Suscripción de la guardería inactiva — no se pueden enviar mensajes." },
  "Kreş aboneliği pasif.": { en: "Nursery subscription inactive.", de: "Kita-Abo inaktiv.", es: "Suscripción de la guardería inactiva." },

  // ---------- moduller.js ----------
  "Bekliyor": { en: "Pending", de: "Ausstehend", es: "Pendiente" },
  "Onaylandı": { en: "Approved", de: "Bestätigt", es: "Aprobado" },
  "Reddedildi": { en: "Rejected", de: "Abgelehnt", es: "Rechazado" },
  "İptal edildi": { en: "Cancelled", de: "Storniert", es: "Anulado" },
  "Tamamlandı": { en: "Completed", de: "Abgeschlossen", es: "Completado" },
  "Metin cevap": { en: "Text answer", de: "Textantwort", es: "Respuesta de texto" },
  "Onay (Evet / Hayır)": { en: "Approval (Yes / No)", de: "Zustimmung (Ja / Nein)", es: "Aprobación (Sí / No)" },
  "Çoktan seçmeli": { en: "Multiple choice", de: "Mehrfachauswahl", es: "Opción múltiple" },
  "Veliler": { en: "Parents", de: "Eltern", es: "Familias" },
  "Personel": { en: "Staff", de: "Personal", es: "Personal" },
  "Herkes": { en: "Everyone", de: "Alle", es: "Todos" },
  "Etkinlik": { en: "Event", de: "Ereignis", es: "Evento" },
  "Önemli gün": { en: "Important day", de: "Wichtiger Tag", es: "Día importante" },
  "Doğum günü": { en: "Birthday", de: "Geburtstag", es: "Cumpleaños" },
  "Hatırlatma": { en: "Reminder", de: "Erinnerung", es: "Recordatorio" },
  "Grafik için en az iki ölçüm gerekli.": { en: "At least two measurements are required for the chart.", de: "Für das Diagramm sind mindestens zwei Messungen erforderlich.", es: "Se necesitan al menos dos mediciones para el gráfico." },
  "Yılbaşı": { en: "New Year's Day", de: "Neujahr", es: "Año Nuevo" },
  "Şehitler Günü": { en: "Martyrs' Day", de: "Tag der Gefallenen", es: "Día de los Mártires" },
  "Ulusal Egemenlik ve Çocuk Bayramı": { en: "National Sovereignty and Children's Day", de: "Tag der nationalen Souveränität und des Kindes", es: "Día de la Soberanía Nacional y del Niño" },
  "Emek ve Dayanışma Günü": { en: "Labour and Solidarity Day", de: "Tag der Arbeit und Solidarität", es: "Día del Trabajo y la Solidaridad" },
  "Atatürk'ü Anma, Gençlik ve Spor Bayramı": { en: "Commemoration of Atatürk, Youth and Sports Day", de: "Gedenktag für Atatürk, Jugend und Sport", es: "Conmemoración de Atatürk, Día de la Juventud y el Deporte" },
  "Dünya Çevre Günü": { en: "World Environment Day", de: "Weltumwelttag", es: "Día Mundial del Medio Ambiente" },
  "Zafer Bayramı": { en: "Victory Day", de: "Tag des Sieges", es: "Día de la Victoria" },
  "Cumhuriyet Bayramı": { en: "Republic Day", de: "Tag der Republik", es: "Día de la República" },
  "Atatürk'ü Anma Günü": { en: "Atatürk Memorial Day", de: "Atatürk-Gedenktag", es: "Día en Memoria de Atatürk" },
  "Dünya Çocuk Hakları Günü": { en: "World Children's Rights Day", de: "Welttag der Kinderrechte", es: "Día Mundial de los Derechos del Niño" },
  "Öğretmenler Günü": { en: "Teachers' Day", de: "Tag der Lehrkräfte", es: "Día del Docente" }
};

// Diğer sözlük parçaları ayrı dosyalarda birleştirilir
if (window.__I18N_EXTRA__) Object.assign(D, window.__I18N_EXTRA__);

// =============================================================
//  KURALLAR (yer tutuculu / dinamik metinler)
//  [regex, { en, de, es }]  —  değer: dize ($1) veya fonksiyon
// =============================================================
const R = [
  [/^(.+) \(öğretmen\)$/, { en: "$1 (teacher)", de: "$1 (Lehrkraft)", es: "$1 (docente)" }],
  [/^(.+) \(yönetici\)$/, { en: "$1 (administrator)", de: "$1 (Verwaltung)", es: "$1 (administración)" }],
  [/^(\d+) öğrenci · (\d+) sınıf$/, { en: "$1 students · $2 classes", de: "$1 Kinder · $2 Gruppen", es: "$1 alumnos · $2 clases" }],
  [/^(\d+) öğrenci$/, { en: "$1 students", de: "$1 Kinder", es: "$1 alumnos" }],
  [/^(\d+) kişi$/, { en: "$1 people", de: "$1 Personen", es: "$1 personas" }],
  [/^(\d+) yanıt$/, { en: "$1 responses", de: "$1 Antworten", es: "$1 respuestas" }],
  [/^(\d+) fotoğraf\.$/, { en: "$1 photos.", de: "$1 Fotos.", es: "$1 fotos." }],
  [/^(\d+) gün$/, { en: "$1 days", de: "$1 Tage", es: "$1 días" }],
  [/^(\d+) öğrenci için rapor kaydedildi\.$/, { en: "Report saved for $1 students.", de: "Bericht für $1 Kinder gespeichert.", es: "Informe guardado para $1 alumnos." }],
  [/^(\d+) öğrenci taşındı\.$/, { en: "$1 students moved.", de: "$1 Kinder verschoben.", es: "$1 alumnos movidos." }],
  [/^Mesaj (\d+) veliye iletildi\.$/, { en: "Message sent to $1 parents.", de: "Nachricht an $1 Eltern gesendet.", es: "Mensaje enviado a $1 familias." }],
  [/^Erişim (\d+) gün uzatıldı\.$/, { en: "Access extended by $1 days.", de: "Zugriff um $1 Tage verlängert.", es: "Acceso ampliado $1 días." }],
  [/^(\d+) gün uzatıldı\.$/, { en: "Extended by $1 days.", de: "Um $1 Tage verlängert.", es: "Ampliado $1 días." }],
  [/^Ödeme kaydedildi, erişim (\d+) gün uzatıldı\.$/, { en: "Payment recorded, access extended by $1 days.", de: "Zahlung erfasst, Zugriff um $1 Tage verlängert.", es: "Pago registrado, acceso ampliado $1 días." }],
  [/^Deneme sürümü — (\d+) gün kaldı\. Kesintisiz devam için abonelik başlatın\.$/, { en: "Trial version — $1 days left. Start a subscription to continue uninterrupted.", de: "Testversion — noch $1 Tage. Starten Sie ein Abo, um ohne Unterbrechung fortzufahren.", es: "Versión de prueba — quedan $1 días. Inicie una suscripción para continuar sin interrupciones." }],
  [/^Aboneliğiniz (\d+) gün sonra bitiyor\. Yenilemek için sağlayıcıyla görüşün\.$/, { en: "Your subscription ends in $1 days. Contact the provider to renew.", de: "Ihr Abo endet in $1 Tagen. Wenden Sie sich zur Verlängerung an den Anbieter.", es: "Su suscripción termina en $1 días. Contacte con el proveedor para renovarla." }],
  [/^"(.+)" sınıfı silinsin mi\?$/, { en: 'Delete class "$1"?', de: 'Gruppe „$1" löschen?', es: '¿Eliminar la clase "$1"?' }],
  [/^"(.+)" ilaç kaydı silinsin mi\?$/, { en: 'Delete medication record "$1"?', de: 'Medikamenteneintrag „$1" löschen?', es: '¿Eliminar el registro de medicación "$1"?' }],
  [/^"(.+)" silinsin mi\?$/, { en: 'Delete "$1"?', de: '„$1" löschen?', es: '¿Eliminar "$1"?' }],
  [/^(\d+) öğrenci "(.+)" sınıfından "(.+)" konumuna taşınacak\. Onaylıyor musunuz\?$/, { en: '$1 students will be moved from "$2" to "$3". Do you confirm?', de: '$1 Kinder werden von „$2" nach „$3" verschoben. Bestätigen Sie?', es: '$1 alumnos se moverán de "$2" a "$3". ¿Confirma?' }],
  [/^(.+) öğrencisinin kaydı silinsin mi\?$/, { en: "Delete the record of student $1?", de: "Datensatz des Kindes $1 löschen?", es: "¿Eliminar la ficha del alumno $1?" }],
  [/^(.+) kullanıcısının kaydı silinsin mi\? \(Firebase Authentication hesabı konsoldan ayrıca silinmelidir\.\)$/, { en: "Delete the record of user $1? (The Firebase Authentication account must also be deleted from the console.)", de: "Datensatz des Nutzers $1 löschen? (Das Firebase-Authentication-Konto muss zusätzlich in der Konsole gelöscht werden.)", es: "¿Eliminar la ficha del usuario $1? (La cuenta de Firebase Authentication también debe eliminarse desde la consola.)" }],
  [/^Çocuğunuz için bugünün raporu hazır$/, { en: "Today's report for your child is ready", de: "Der heutige Bericht für Ihr Kind ist fertig", es: "El informe de hoy de su hijo está listo" }],
  [/^(.+) için bugünün raporu hazır$/, { en: "Today's report for $1 is ready", de: "Der heutige Bericht für $1 ist fertig", es: "El informe de hoy de $1 está listo" }],
  [/^(.+) için rapor bulunamadı\.$/, { en: "No report found for $1.", de: "Kein Bericht für $1 gefunden.", es: "No se encontró informe para $1." }],
  [/^Bugünün fotoğrafları \((\d+)\)\. Başka bir günü görmek için tarih seçin\.$/, { en: "Today's photos ($1). Pick a date to see another day.", de: "Heutige Fotos ($1). Wählen Sie ein Datum für einen anderen Tag.", es: "Fotos de hoy ($1). Elija una fecha para ver otro día." }],
  [/^(.+) — (\d+) fotoğraf\.$/, { en: "$1 — $2 photos.", de: "$1 — $2 Fotos.", es: "$1 — $2 fotos." }],
  [/^(.+) için fotoğraf yok$/, { en: "No photos for $1", de: "Keine Fotos für $1", es: "Sin fotos para $1" }],
  [/^Kreş oluşturuldu\. Giriş: (.+) · Şifre: (.+)$/, { en: "Nursery created. Login: $1 · Password: $2", de: "Kita erstellt. Login: $1 · Passwort: $2", es: "Guardería creada. Acceso: $1 · Contraseña: $2" }],
  [/^Kullanıcı oluşturuldu\. (.+) · Şifre: (.+)$/, { en: "User created. $1 · Password: $2", de: "Nutzer erstellt. $1 · Passwort: $2", es: "Usuario creado. $1 · Contraseña: $2" }],
  [/^(.+) adresine şifre belirleme e-postası gönderilsin mi\?$/, { en: "Send a password-setup e-mail to $1?", de: "Eine E-Mail zum Festlegen des Passworts an $1 senden?", es: "¿Enviar un correo para establecer la contraseña a $1?" }],
  [/^Kullanıcı oluşturuldu\. Şifre belirleme e-postası (.+) adresine gönderildi\. \(Geçici şifre: (.+)\)$/, { en: "User created. A password-setup e-mail was sent to $1. (Temporary password: $2)", de: "Nutzer erstellt. Eine E-Mail zum Festlegen des Passworts wurde an $1 gesendet. (Vorläufiges Passwort: $2)", es: "Usuario creado. Se envió un correo para establecer la contraseña a $1. (Contraseña temporal: $2)" }],
  [/^(\d+) aidat kaydı oluşturuldu\. (\d+) zaten vardı, (\d+) öğrencinin velisi yok\.$/, { en: "$1 fee records created. $2 already existed, $3 students have no parent.", de: "$1 Beitragseinträge erstellt. $2 waren bereits vorhanden, $3 Kinder haben keine Eltern.", es: "$1 registros de cuota creados. $2 ya existían, $3 alumnos no tienen familia." }],
  [/^(.+) raporu kopyalandı\. Gözden geçirip kaydedin\.$/, { en: "Report from $1 copied. Review and save.", de: "Bericht vom $1 kopiert. Prüfen und speichern.", es: "Informe del $1 copiado. Revise y guarde." }],
  [/^Boy: (.+) cm$/, { en: "Height: $1 cm", de: "Größe: $1 cm", es: "Estatura: $1 cm" }],
  [/^Kilo: (.+) kg$/, { en: "Weight: $1 kg", de: "Gewicht: $1 kg", es: "Peso: $1 kg" }],
  [/^VKİ: (.+)$/, { en: "BMI: $1", de: "BMI: $1", es: "IMC: $1" }],
  [/^Onay: (\d+)$/, { en: "Approved: $1", de: "Zustimmung: $1", es: "Aprobados: $1" }],
  [/^Ret: (\d+)$/, { en: "Rejected: $1", de: "Ablehnung: $1", es: "Rechazados: $1" }],
  [/^Bekleyen: (.+)$/, { en: "Pending: $1", de: "Ausstehend: $1", es: "Pendiente: $1" }],
  [/^Öğrenci: (.+)$/, { en: "Student: $1", de: "Kind: $1", es: "Alumno: $1" }],
  [/^Öğretmen: (.+)$/, { en: "Teacher: $1", de: "Lehrkraft: $1", es: "Docente: $1" }],
  [/^Personel: (.+)$/, { en: "Staff: $1", de: "Personal: $1", es: "Personal: $1" }],
  [/^Sınıf: (.+)$/, { en: "Class: $1", de: "Gruppe: $1", es: "Clase: $1" }],
  [/^Tarih: (.+)$/, { en: "Date: $1", de: "Datum: $1", es: "Fecha: $1" }],
  [/^Öncelik: (düşük|dusuk)$/, { en: "Priority: low", de: "Priorität: niedrig", es: "Prioridad: baja" }],
  [/^Öncelik: (orta)$/, { en: "Priority: medium", de: "Priorität: mittel", es: "Prioridad: media" }],
  [/^Öncelik: (yüksek|yuksek)$/, { en: "Priority: high", de: "Priorität: hoch", es: "Prioridad: alta" }],
  [/^Randevu — (.+)$/, { en: "Appointment — $1", de: "Termin — $1", es: "Cita — $1" }],
  [/^İlaç Ekle — (.+)$/, { en: "Add Medication — $1", de: "Medikament hinzufügen — $1", es: "Añadir medicación — $1" }],
  [/^İlaç Düzenle — (.+)$/, { en: "Edit Medication — $1", de: "Medikament bearbeiten — $1", es: "Editar medicación — $1" }],
  [/^Ölçüm Ekle — (.+)$/, { en: "Add Measurement — $1", de: "Messung hinzufügen — $1", es: "Añadir medición — $1" }],
  [/^Ödeme Ekle — (.+)$/, { en: "Add Payment — $1", de: "Zahlung hinzufügen — $1", es: "Añadir pago — $1" }],
  [/^Kreş Detayı — (.+)$/, { en: "Nursery Detail — $1", de: "Kita-Detail — $1", es: "Detalle de la guardería — $1" }],
  [/^Talep — (.+)$/, { en: "Request — $1", de: "Anfrage — $1", es: "Solicitud — $1" }],
  [/^Yanıtlar — (.+)$/, { en: "Responses — $1", de: "Antworten — $1", es: "Respuestas — $1" }],
  [/^"(.+)" başvurusunu onaylayıp erişim veriyorsunuz\.$/, { en: 'You are approving the application of "$1" and granting access.', de: 'Sie genehmigen den Antrag von „$1" und gewähren Zugriff.', es: 'Está aprobando la solicitud de "$1" y concediendo acceso.' }],
  [/^"(.+)" için plan ve süreyi belirleyin\.$/, { en: 'Set the plan and duration for "$1".', de: 'Legen Sie Tarif und Dauer für „$1" fest.', es: 'Defina el plan y la duración para "$1".' }],
  [/^"(.+)" için abonelik ödemesi kaydı\.$/, { en: 'Subscription payment record for "$1".', de: 'Abo-Zahlungseintrag für „$1".', es: 'Registro de pago de suscripción para "$1".' }],
  [/^"(.+)" (pasife alınsın|aktifleştirilsin) mi\?$/, { en: (m, a, b) => `${b === "pasife alınsın" ? `Deactivate "${a}"?` : `Activate "${a}"?`}`, de: (m, a, b) => `${b === "pasife alınsın" ? `„${a}" deaktivieren?` : `„${a}" aktivieren?`}`, es: (m, a, b) => `${b === "pasife alınsın" ? `¿Desactivar "${a}"?` : `¿Activar "${a}"?`}` }],
  [/^"(.+)" kreşi ve TÜM verisi kalıcı olarak silinecek\. Bu işlem geri alınamaz\.$/, { en: 'The nursery "$1" and ALL its data will be permanently deleted. This action cannot be undone.', de: 'Die Kita „$1" und ALLE ihre Daten werden endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.', es: 'La guardería "$1" y TODOS sus datos se eliminarán permanentemente. Esta acción no se puede deshacer.' }],
  [/^"(.+)" belgesine yanıtınız$/, { en: 'Your response to the document "$1"', de: 'Ihre Antwort auf das Dokument „$1"', es: 'Su respuesta al documento "$1"' }],
  [/^"(.+)" belgesine yanıtınız \((.+)\)\.$/, { en: 'Your response to the document "$1" ($2).', de: 'Ihre Antwort auf das Dokument „$1" ($2).', es: 'Su respuesta al documento "$1" ($2).' }],
  [/^(.+): (yoklama ve günlük rapor|yoklama|günlük rapor) bekliyor \((.+)\)\.$/, {
    en: (m, a, b, c) => `${a}: ${({ "yoklama": "attendance", "günlük rapor": "daily report", "yoklama ve günlük rapor": "attendance and daily report" })[b]} pending (${c}).`,
    de: (m, a, b, c) => `${a}: ${({ "yoklama": "Anwesenheit", "günlük rapor": "Tagesbericht", "yoklama ve günlük rapor": "Anwesenheit und Tagesbericht" })[b]} ausstehend (${c}).`,
    es: (m, a, b, c) => `${a}: ${({ "yoklama": "asistencia", "günlük rapor": "informe diario", "yoklama ve günlük rapor": "asistencia e informe diario" })[b]} pendiente (${c}).`
  }],
  [/^(.+) — (geç gelecek|gelmeyecek) \((.+)\)$/, {
    en: (m, a, b, c) => `${a} — ${b === "geç gelecek" ? "will be late" : "will be absent"} (${c})`,
    de: (m, a, b, c) => `${a} — ${b === "geç gelecek" ? "kommt später" : "fehlt"} (${c})`,
    es: (m, a, b, c) => `${a} — ${b === "geç gelecek" ? "llegará tarde" : "no asistirá"} (${c})`
  }],
  [/^📌 Veli: (geç gelecek|gelmeyecek)$/, {
    en: (m, b) => `📌 Parent: ${b === "geç gelecek" ? "will be late" : "will be absent"}`,
    de: (m, b) => `📌 Eltern: ${b === "geç gelecek" ? "kommt später" : "fehlt"}`,
    es: (m, b) => `📌 Familia: ${b === "geç gelecek" ? "llegará tarde" : "no asistirá"}`
  }],
  [/^📌 Veli: (geç gelecek|gelmeyecek) — (.+)$/, {
    en: (m, b, n) => `📌 Parent: ${b === "geç gelecek" ? "will be late" : "will be absent"} — ${n}`,
    de: (m, b, n) => `📌 Eltern: ${b === "geç gelecek" ? "kommt später" : "fehlt"} — ${n}`,
    es: (m, b, n) => `📌 Familia: ${b === "geç gelecek" ? "llegará tarde" : "no asistirá"} — ${n}`
  }],
  [/^Plan \/ Durum$/, { en: "Plan / Status", de: "Tarif / Status", es: "Plan / Estado" }],
  [/^(.+) sınıfı$/, { en: "$1 class", de: "Gruppe $1", es: "clase de $1" }],
  [/^(.+) velileri$/, { en: "parents of $1", de: "Eltern von $1", es: "familias de $1" }],
  [/^(\d+) yaş$/, { en: "$1 years old", de: "$1 Jahre", es: "$1 años" }],
  [/^Alerji: (.+)$/, { en: "Allergy: $1", de: "Allergie: $1", es: "Alergia: $1" }],
  [/^✓ Servis çalışıyor: (.+)$/, { en: "✓ Service is running: $1", de: "✓ Dienst läuft: $1", es: "✓ El servicio funciona: $1" }],
  [/^· Erişim bitişi: (.+)$/, { en: "· Access ends: $1", de: "· Zugriffsende: $1", es: "· Fin de acceso: $1" }]
];
if (window.__I18N_EXTRA_RULES__) for (const r of window.__I18N_EXTRA_RULES__) R.push(r);

// =============================================================
//  ÇEVİRİ
// =============================================================
function cevir(t) {
  if (LANG === "tr" || !t) return t;
  const d = D[t];
  if (d && d[LANG] != null) return d[LANG];
  for (const [re, val] of R) {
    if (re.test(t)) {
      const rep = val[LANG];
      if (rep == null) return t;
      let out = t.replace(re, rep);
      const dt = ceviriTarih(out, LANG);
      return dt == null ? out : dt;
    }
  }
  const dt = ceviriTarih(t, LANG);
  return dt == null ? t : dt;
}

// =============================================================
//  DOM UYGULAMA
// =============================================================
const ATTRS = ["placeholder", "title", "aria-label"];
let obs = null;

function metniCevir(node) {
  const raw = node.nodeValue;
  if (!raw) return;
  const bas = (raw.match(/^\s*/) || [""])[0];
  const son = (raw.match(/\s*$/) || [""])[0];
  const govde = raw.slice(bas.length, raw.length - son.length);
  if (!govde || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(govde)) return;
  const t = govde.replace(/\s+/g, " "); // iç boşlukları normalle (satır sonu / girinti)
  const yeni = cevir(t);
  if (yeni === t) return;               // çeviri yoksa düğüme hiç dokunma
  node.nodeValue = bas + yeni + son;
}

function ogeyiCevir(node) {
  if (node.nodeType === 3) { metniCevir(node); return; }
  if (node.nodeType !== 1) return;
  const tag = node.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return;
  for (const a of ATTRS) {
    if (node.hasAttribute(a)) {
      const v0 = node.getAttribute(a);
      const v = v0.trim();
      if (v && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(v)) {
        const nv = cevir(v);
        if (nv !== v) node.setAttribute(a, v0.replace(v, () => nv));
      }
    }
  }
  if (tag === "INPUT" && /^(submit|button|reset)$/i.test(node.type || "") && node.value) {
    const v = node.value.trim();
    const nv = cevir(v);
    if (nv !== v) node.value = nv;
  }
  for (let c = node.firstChild; c; c = c.nextSibling) ogeyiCevir(c);
}

function hepsiniCevir() {
  if (LANG === "tr") return;
  if (obs) obs.disconnect();
  try {
    if (document.title) document.title = cevir(document.title.trim());
    const md = document.querySelector('meta[name="description"]');
    if (md && md.content) { const c = cevir(md.content.trim()); if (c) md.content = c; }
    if (document.body) ogeyiCevir(document.body);
    const h = document.head;
    if (h) for (let c = h.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.tagName === "TITLE") ogeyiCevir(c);
  } finally {
    if (obs) obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  }
}

// =============================================================
//  DİL SEÇİCİ
// =============================================================
function seciciYap() {
  const sel = document.createElement("select");
  sel.className = "dil-secici";
  sel.setAttribute("aria-label", "Language / Sprache / Idioma");
  sel.style.cssText = "padding:6px 10px;border-radius:999px;border:1px solid var(--kenar,#d8d0c4);background:var(--yuzey,#fff);color:inherit;font:inherit;font-size:.85rem;cursor:pointer;margin:4px;max-width:150px";
  for (const [k, v] of Object.entries(DILLER)) {
    const o = document.createElement("option");
    o.value = k; o.textContent = v;
    if (k === LANG) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => {
    try { localStorage.setItem(KEY, sel.value); } catch { /* yoksay */ }
    location.reload();
  });
  return sel;
}

function seciciyiYerlestir() {
  if (document.querySelector(".dil-secici")) return;
  const ust = document.querySelector(".panel-ust");
  if (ust) {
    const rozet = ust.querySelector(".kullanici-rozet");
    const s = seciciYap();
    if (rozet) ust.insertBefore(s, rozet); else ust.appendChild(s);
  }
  const mobil = document.querySelector(".mobil-ust");
  if (mobil && !mobil.querySelector(".dil-secici")) {
    const cikis = mobil.querySelector("#cikisBtnMobil");
    const s = seciciYap();
    if (cikis) mobil.insertBefore(s, cikis); else mobil.appendChild(s);
  }
  const nav = document.querySelector(".site-nav__links");
  if (nav && !nav.querySelector(".dil-secici")) nav.appendChild(seciciYap());
}

// =============================================================
//  BAŞLAT
// =============================================================
document.documentElement.lang = LANG;

obs = new MutationObserver((muts) => {
  if (LANG === "tr") return;
  obs.disconnect();
  try {
    for (const m of muts) {
      if (m.type === "characterData") metniCevir(m.target);
      else for (const n of m.addedNodes) ogeyiCevir(n);
    }
  } finally {
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  }
});

function calistir() {
  seciciyiYerlestir();
  hepsiniCevir();
}

if (LANG !== "tr") {
  obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
}
calistir();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", calistir);
}
window.addEventListener("load", calistir);
// Geç render eden panel içerikleri için birkaç ek geçiş
setTimeout(calistir, 400);
setTimeout(calistir, 1200);
setTimeout(calistir, 3000);
