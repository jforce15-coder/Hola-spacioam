/*  ============================================================
    SPACIO AM — GUEST APP · BACKEND (Google Apps Script)
    ------------------------------------------------------------
    Un solo Web App que hace de backend seguro para la guest app:

      • Lee reservas desde la API de Hospitable (token guardado
        del lado servidor, NUNCA en el navegador).
      • Guarda formularios de registro en Google Sheets, con la
        base de datos ordenada en pestañas (Reservas, Formularios,
        Huespedes, Usuarios, Documentos).
      • Sube los documentos de identidad a una carpeta de Drive,
        nombrados con fecha de check-in + apartamento + huésped.
      • Borra automáticamente los documentos 3 meses después del
        check-out (trigger diario).

    CÓMO SE CONECTA CON LA WEB APP:
    El navegador hace fetch POST con Content-Type "text/plain"
    (evita el preflight CORS que Apps Script no soporta) enviando
    { action, ...payload }. Este script responde JSON.

    → Configuración paso a paso en backend/INSTRUCCIONES.md
    ============================================================ */

/* ---------- CONFIG (se leen de Script Properties; con defaults) ---------- */
function CFG_() {
  var p = PropertiesService.getScriptProperties();
  return {
    SHEET_ID:     p.getProperty('SHEET_ID')     || '12TF-FO6vld2VkzDr9YlUnHlNjh4d1u9Ss6qWz3F3KeQ',
    DRIVE_FOLDER: p.getProperty('DRIVE_FOLDER')  || '133Ijv9_bPfSXXwlV3zHK5LDB6KQ6d0GS',
    HOSPITABLE_TOKEN: p.getProperty('HOSPITABLE_TOKEN') || '',
    RETENTION_MONTHS: parseInt(p.getProperty('RETENTION_MONTHS') || '3', 10),
    FROM_EMAIL: p.getProperty('FROM_EMAIL') || '',
    FROM_NAME: p.getProperty('FROM_NAME') || 'Spacio AM',
    APP_URL: p.getProperty('APP_URL') || '',
    WEB_APP_URL: p.getProperty('WEB_APP_URL') || '',
    ADMIN_NOTIFY_EMAIL: p.getProperty('ADMIN_NOTIFY_EMAIL') || '',
    ANTHROPIC_API_KEY: p.getProperty('ANTHROPIC_API_KEY') || '',
    // Lector de documentos: primero el modelo barato (Haiku); si no logra una
    // lectura limpia, escala al modelo preciso (Sonnet). Cambiables sin tocar
    // codigo desde Propiedades del script.
    AI_MODEL_PRIMARY:  p.getProperty('AI_MODEL_PRIMARY')  || 'claude-3-5-haiku-latest',
    AI_MODEL_FALLBACK: p.getProperty('AI_MODEL_FALLBACK') || 'claude-sonnet-4-5',
    // WhatsApp Cloud API — envío del formulario (PDF) a números individuales.
    // Se configuran desde Propiedades del script (no en código).
    WHATSAPP_TOKEN:    p.getProperty('WHATSAPP_TOKEN')    || '',
    WHATSAPP_PHONE_ID: p.getProperty('WHATSAPP_PHONE_ID') || '',
    WHATSAPP_TO:       p.getProperty('WHATSAPP_TO')       || '', // 2+ números, separados por coma. Formato internacional sin +, ej: 50255555555
    WHATSAPP_TEMPLATE: p.getProperty('WHATSAPP_TEMPLATE') || 'registro_ingreso',
    WHATSAPP_LANG:     p.getProperty('WHATSAPP_LANG')     || 'es',
    WHATSAPP_API_VER:  p.getProperty('WHATSAPP_API_VER')  || 'v20.0'
  };
}

/* ============================================================
   1 · SETUP — corre esto UNA VEZ desde el editor de Apps Script.
   Crea/verifica las pestañas de la base de datos con encabezados
   y activa el trigger de borrado automático.

   ⚠️ NO se pega ningún dato sensible en el código. Antes de correr
   setup(), agrega tus valores en:
     Configuración del proyecto (⚙️) → Propiedades de la secuencia
     de comandos → Agregar propiedad:
       HOSPITABLE_TOKEN  = tu token de Hospitable   (obligatorio)
       SHEET_ID          = id de tu Google Sheet     (opcional*)
       DRIVE_FOLDER      = id de tu carpeta de Drive  (opcional*)
       RETENTION_MONTHS  = 3                          (opcional)
   * SHEET_ID y DRIVE_FOLDER ya tienen default con los que diste;
     solo agrégalos si cambian.
   ============================================================ */
function setup() {
  var p = PropertiesService.getScriptProperties();
  // asegura defaults sin sobreescribir lo que ya pusiste en Propiedades
  if (!p.getProperty('SHEET_ID'))     p.setProperty('SHEET_ID', '12TF-FO6vld2VkzDr9YlUnHlNjh4d1u9Ss6qWz3F3KeQ');
  if (!p.getProperty('DRIVE_FOLDER')) p.setProperty('DRIVE_FOLDER', '133Ijv9_bPfSXXwlV3zHK5LDB6KQ6d0GS');
  if (!p.getProperty('RETENTION_MONTHS')) p.setProperty('RETENTION_MONTHS', '3');

  ensureSheets_();
  ensurePurgeTrigger_();
  ensureSyncTriggers_();
  ensureEarlyTrigger_();
  ensureCheckoutTrigger_();

  var hasToken = !!p.getProperty('HOSPITABLE_TOKEN');
  var hasAI = !!p.getProperty('ANTHROPIC_API_KEY');
  return 'Setup completo. Pestañas creadas, sincronización 5am/3pm y borrado automático activados.'
    + (hasToken ? '' : '  ⚠️ Falta agregar HOSPITABLE_TOKEN en Propiedades de la secuencia de comandos.')
    + (hasAI ? '' : '  ⚠️ Falta ANTHROPIC_API_KEY en Propiedades para el lector de documentos.');
}

/* pestañas + encabezados de la base de datos */
var SCHEMA_ = {
  'Reservas': [
    'code','property_name','apartment','checkin_date','checkout_date',
    'guest_first_name','guest_last_name','guest_count','max_capacity',
    'assigned_email','status_form','synced_at','photo_url','amount','currency','reservation_status'
  ],
  'Formularios': [
    'submitted_at','code','property_name','apartment','checkin_date','checkout_date',
    'booker_type','booker_name','booker_id','booker_phone','booker_emergency','booker_email',
    'contact_email','contact_phone','contact_emergency',
    'guest_count','accepted_rules_at','docs_folder_url','status'
  ],
  'Huespedes': [
    'submitted_at','code','apartment','checkin_date','guest_index','is_main',
    'full_name','id_number','doc_file_name','doc_file_url'
  ],
  'Usuarios': [
    'created_at','email','reservation_codes','password_hash','role','shared_by'
  ],
  'Estaciones': [
    'property_id','property_name','email1','email2','phone1','phone2','updated_at'
  ],
  'Documentos': [
    'uploaded_at','code','apartment','checkin_date','guest_name',
    'file_name','drive_url','file_id','delete_at','deleted'
  ],
  'Sugerencias': ['at','code','apartment','property_name','text','status'],
  'Solicitudes': ['at','code','apartment','type','status','notified','admin_approved','token'],
  'Facturas': ['at','code','apartment','checkin_date','nit','razon_social','comentario','deadline','status','factura_url'],
  'Invitados': ['at','code','apartment','guest_name','doc','id_number','entry_date','entry_time','needs_approval','status'],
  'PropiedadesInfo': ['updated_at','property_name','info_json'],
  /* Formularios reiniciados por el administrador: todo lo enviado ANTES de
     esta marca se ignora al leer el registro (queda solo como traza). */
  'Reinicios': ['at','code','by'],
  /* Snapshot del registro por reserva: el resumen del panel se lee de aquí en
     una sola fila (instantáneo) en vez de recorrer 3 pestañas completas. */
  'Registros': ['at','code','json'],
  /* Fotos de QR de streaming enviadas por el huésped desde la app */
  'Streaming': ['at','code','apartment','file_url','file_id','note','status'],
  /* Correo de despedida enviado la mañana del checkout (evita duplicados) */
  'Salidas': ['at','code','checkout_date','email','status'],
  'Fotos': ['property_name','photo_url','listing_url','resolved_at'],
  /* Incidencias = "problemas notificados por el huésped".
     status: pendiente | auto (la reserva apareció sola) | vinculado (el admin
     la ató a una reserva real → pasa a errores frecuentes) | descartado */
  'Incidencias': ['at','code','stage','device','status','resolved_at','linked_code','error_type','note'],
  'Admins': ['created_at','email','password_hash','created_by']
};

function ensureSheets_() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  Object.keys(SCHEMA_).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = SCHEMA_[name];
    var first = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    var empty = first.every(function (c) { return c === '' || c == null; });
    if (empty) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#3E3F3F').setFontColor('#FAFAFA');
      sh.setFrozenRows(1);
    } else {
      // la hoja ya existe pero el esquema creció: rellena solo los encabezados
      // nuevos (columnas que quedaron en blanco) sin tocar los datos
      for (var ci = 0; ci < headers.length; ci++) {
        if (first[ci] === '' || first[ci] == null) {
          sh.getRange(1, ci + 1).setValue(headers[ci])
            .setFontWeight('bold').setBackground('#3E3F3F').setFontColor('#FAFAFA');
        }
      }
    }
  });
  // elimina la pestaña por defecto "Hoja 1"/"Sheet1" si quedó vacía
  ['Hoja 1','Sheet1','Hoja1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1 && s.getLastRow() === 0) ss.deleteSheet(s);
  });
}

/* ============================================================
   2 · ROUTER — recibe las peticiones de la web app
   ============================================================ */
/* ⚠️ Un proyecto de Apps Script solo puede tener UN doGet y UN doPost. ALMA_AUTO.gs (relevo de
   mensajes de Hospitable → n8n) y WHATSAPP.gs NO deben declararlos: el último en cargarse gana y la app
   deja de recibir datos (respondía {"msg":"ignorado: evento"}). Sus manejadores se llaman
   almaRelay_(e) / whatsappWebhook_(e) / whatsappVerify_(e) y desde aquí se les delega lo suyo. */
function parseBody_(e) { try { return JSON.parse((e && e.postData && e.postData.contents) || '{}') || {}; } catch (x) { return {}; } }
/* webhook de Hospitable (mensajes): trae action 'message.created' u objeto data con sender_type */
function isHospitableWebhook_(b) { return !!(b && (/^[a-z_]+\.[a-z_]+$/.test(String(b.action || '')) || (b.data && b.data.sender_type !== undefined))); }
function isWhatsAppPost_(b) { return !!(b && (b.object === 'whatsapp_business_account' || (b.entry && !b.action))); }
function doGet(e)  {
  // verificación del webhook de WhatsApp (hub.mode / hub.challenge) → la atiende WHATSAPP.gs
  if (e && e.parameter && e.parameter['hub.mode'] && typeof whatsappVerify_ === 'function') return whatsappVerify_(e);
  // one-click admin approval link (from the 4-5pm email) → returns a small HTML page
  if (e && e.parameter && e.parameter.action === 'approveEarly') {
    var msg = approveEarlyByToken_(e.parameter.token || '');
    return HtmlService.createHtmlOutput(
      '<div style="font-family:system-ui,Arial;max-width:460px;margin:60px auto;text-align:center;color:#3E3F3F">' +
      '<div style="font-size:26px;margin-bottom:10px">Spacio AM</div>' +
      '<p style="font-size:15px;line-height:1.6;color:#938B8A">' + msg + '</p></div>'
    );
  }
  return route_(e, 'GET');
}
function doPost(e) {
  var b = parseBody_(e);
  if (isHospitableWebhook_(b) && typeof almaRelay_ === 'function') return almaRelay_(e);
  if (isWhatsAppPost_(b) && typeof whatsappWebhook_ === 'function') return whatsappWebhook_(e);
  return route_(e, 'POST');
}
/* Ejecútalo desde el editor: avisa si algún otro archivo sigue declarando doGet/doPost */
function checkRouter() {
  var r = { doPostEsDeCodigo: String(doPost).indexOf('almaRelay_') >= 0, doGetEsDeCodigo: String(doGet).indexOf('whatsappVerify_') >= 0,
            almaRelay_: typeof almaRelay_ === 'function', whatsappWebhook_: typeof whatsappWebhook_ === 'function' };
  r.ok = r.doPostEsDeCodigo && r.doGetEsDeCodigo;
  Logger.log(JSON.stringify(r, null, 2)); return r;
}

function route_(e, method) {
  var out;
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else if (e && e.parameter && e.parameter.payload) {
      body = JSON.parse(e.parameter.payload);
    }
    var action = body.action || (e && e.parameter && e.parameter.action) || 'ping';
    var __diag = accesosDiag_(body); if (__diag) return __diag;   // fase 1b: resumen de accesos (robot)
    var __ses = sesionDe_(body); registrarAcceso_(action, __ses ? true : esRobot_(body) ? 'r' : false);
    var __bloq = exigirSesion_(action, !!__ses, body, ['ping', 'listPropertyInfo', 'getDocImage', 'findReservation', 'submitForm', 'createAccount', 'login', 'suggestion', 'hostRequest', 'flexAvailability', 'listingAmenities', 'invoiceRequest', 'guestAccess', 'streamingRequest', 'formStarted', 'formCompleted', 'saveDraft', 'getDraft', 'readDocument', 'adminLogin', 'reportProblem', 'openLink', 'regPdfRobot', 'ltGuest', 'ltUpload', 'ltReadReceipt', 'ltGuestNotice', 'ltGuestMsg', 'ltGuestFile']); if (__bloq) return __bloq;   // fase 1c: solo bloquea con SESION_EXIGIR = 1

    switch (action) {
      case 'ping':             out = { ok: true, service: 'spacio-am-backend', time: new Date().toISOString() }; break;
      case 'listReservations': var lr = listReservations_({ days: body.days, fast: body.fast }); out = { ok: true, reservations: lr.reservations, meta: lr.meta }; if (body.withCached) { try { out.cached = listCached_(); out.meta.sheetRows = out.cached.length; } catch (ce) { out.meta.sheetError = String(ce && ce.message || ce); } } break;
      case 'listCached':       out = { ok: true, reservations: listCached_(), meta: { cached: true } }; break;
      case 'findReservation':  out = findReservation_(body); break;
      case 'getRegistration':  out = getRegistration_(body); break;
      case 'getDocImage':      out = (__ses || esRobot_(body) || fotoDeSuBorrador_(body))   // sin sesión: solo fotos del borrador de ESA reserva
                                 ? { ok: true, image: driveFileDataUrl_(body.fileId || '') } : { ok: false, error: 'forbidden' }; break;
      case 'listStations':     out = { ok: true, stations: listStations_() }; break;
      case 'saveStation':      out = saveStation_(body); break;
      case 'submitForm':       out = submitForm_(body); break;
      case 'createAccount':    out = createAccount_(body); break;
      case 'login':            out = login_(body); break;
      case 'suggestion':       out = appendSimple_('Sugerencias', [nowISO_(), body.code||'', body.apartment||'', body.propertyName||'', body.text||'', 'nuevo']); break;
      case 'hostRequest':      out = hostRequest_(body); break;
      case 'storageStats':     out = storageStats_(); break;
      case 'flexAvailability': out = flexAvailability_(body); break;
      case 'listingAmenities': out = listingAmenities_(body); break;
      case 'listingPhoto':     out = listingPhoto_(body); break;
      case 'invoiceRequest':   out = appendInvoice_(body); break;
      case 'guestAccess':      out = appendGuestAccess_(body); break;
      case 'savePropertyInfo': out = savePropertyInfo_(body); break;
      case 'standardizeInstructions': out = standardizeInstructions_(body); break;
      case 'listPropertyInfo': out = listPropertyInfo_(); break;
      case 'notifyInvoiceReady': out = notifyInvoiceReady_(body); break;
      case 'resendRegistration': out = resendRegistration_(body); break;
      case 'sendStatus':       out = sendStatus_(body); break;
      case 'regPdfRobot':      out = regPdfRobot_(body); break;
      case 'hostRequestApprove': out = hostRequestResolve_({ code: body.code, kind: body.kind, apartment: body.apartment, decision: body.approved ? 'approved' : 'pending' }); break;
      case 'hostRequestResolve': out = hostRequestResolve_(body); break;
      case 'listRequests':     out = { ok: true, requests: listRequests_() }; break;
      case 'approveGuestAccess': out = approveGuestAccess_(body); break;
      case 'listGuestAccess':  out = { ok: true, groups: listGuestAccess_() }; break;
      case 'resolveGuestAccess': out = resolveGuestAccess_(body); break;
      case 'streamingRequest': out = streamingRequest_(body); break;
      case 'listStreaming':    out = { ok: true, items: listStreaming_() }; break;
      case 'resolveStreaming': out = resolveStreaming_(body); break;
      case 'resetForm':        out = resetForm_(body); break;
      case 'formStarted':      out = formStarted_(body); break;
      case 'formCompleted':    out = formCompleted_(body); break;
      case 'saveDraft':        out = saveDraft_(body); break;
      case 'getDraft':         out = getDraft_(body); break;
      case 'listDrafts':       out = { ok: true, drafts: listDrafts_() }; break;
      case 'checkoutFarewellNow': out = { ok: true, sent: checkoutMorningEmails() }; break;
      case 'listAdmins':       out = { ok: true, admins: listAdmins_() }; break;
      case 'saveAdmin':        out = saveAdmin_(body); break;
      case 'removeAdmin':      out = removeAdmin_(body); break;
      case 'adminLogin':       out = adminLogin_(body); break;
      case 'readDocument':     out = readDocument_(body); break;
      case 'testEmail':        out = sendTestEmail_(body); break;
      case 'testWhatsApp':     out = sendTestWhatsApp_(body); break;
      case 'listSendLog':      out = listSendLog_(body); break;
      case 'contactsAvailability': out = contactsAvailability_(body); break;
      case 'listContacts':     out = adminContactsInfo_(); break;
      case 'reportProblem':    out = reportProblem_(body); break;
      case 'listIncidents':    out = listIncidents_(); break;
      case 'resolveIncident':  out = resolveIncident_(body); break;
      case 'adminAlerts':      out = adminAlerts_(); break;
      case 'guestLink':        out = guestLink_(body); break;
      case 'openLink':         out = openLink_(body); break;
      case 'listInvoices':     out = { ok: true, invoices: listInvoices_(), fx: fxRate_() }; break;
      case 'seguimientoAll':   out = seguimientoAll_(); break;
      case 'fxRate':           out = { ok: true, fx: fxRate_() }; break;
      case 'purgeAlerts':      out = purgeAlerts_(body); break;
      case 'resolveInvoice':   out = resolveInvoice_(body); break;
      default:                 out = (/^lt[A-Z]/.test(action) && ltRoute_(action, body)) || { ok: false, error: 'unknown action: ' + action };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   3 · HOSPITABLE — traer reservas y normalizarlas a la forma
   que espera la web app. También refresca la pestaña "Reservas".

   El endpoint /v2/reservations EXIGE properties[] + rango de
   fechas, así que primero traemos las propiedades y luego las
   reservas de cada una dentro de una ventana de fechas.
   Devuelve { reservations, meta } — meta ayuda a diagnosticar.
   ============================================================ */
function listReservations_(opts) {
  opts = opts || {};
  var t0 = new Date().getTime();
  // MODO RÁPIDO: solo los próximos N días (por defecto 5 contando hoy) y sin
  // scrapear fotos nuevas — es el que usa el botón "Actualizar" del panel y la
  // búsqueda de un código que aún no está en caché. Tarda segundos, no minutos.
  var days = Number(opts.days || 0);
  var fast = !!opts.fast || days > 0;
  var cfg = CFG_();
  var out = { reservations: [], meta: {} };
  if (!cfg.HOSPITABLE_TOKEN) { out.meta.note = 'no-token'; return out; }

  // 1 · Propiedades (necesarias para consultar reservas) — PAGINADO ROBUSTO.
  //     Hospitable devuelve máx. 100 por página. NO confiamos en meta.last_page
  //     (no siempre viene): seguimos pidiendo páginas mientras una página
  //     devuelva 100 (=llena). Así ninguna propiedad queda fuera y sus reservas
  //     siempre se sincronizan (las renombradas suelen reordenarse a otra página).
  var propMap = {}, propIds = [];
  var page = 1;
  while (page <= 50) { // tope de seguridad: 5000 propiedades
    var pRes = hosFetch_('https://public.api.hospitable.com/v2/properties?per_page=100&page=' + page, cfg);
    if (page === 1) out.meta.propertiesStatus = pRes.code;
    if (pRes.code !== 200) {
      if (page === 1) { out.meta.error = 'properties HTTP ' + pRes.code + ': ' + shortMsg_(pRes.json); return out; }
      break;
    }
    var batch = pRes.json.data || pRes.json.properties || [];
    batch.forEach(function (p) { if (p && p.id) { propIds.push(p.id); propMap[p.id] = p; } });
    if (batch.length < 100) break; // última página
    page++;
  }
  out.meta.propertiesPages = page;
  out.meta.propertiesCount = propIds.length;
  if (!propIds.length) { out.meta.note = 'no-properties'; return out; }

  // 2 · Reservas. Hospitable EXIGE properties[] (sin eso la consulta falla y antes caíamos a un respaldo
  //     de una sola ventana de 85 días, sin paginar y una propiedad a la vez: lento y con huecos).
  //     Ahora: lotes de 25 propiedades × ventanas de check-in de 85 días, en paralelo (fetchAll), paginado,
  //     MÁS una pasada por fecha de reserva (booked_at) que trae toda reserva nueva sin importar su check-in.
  var now = new Date();
  var all = [], errs = [], seenR = {};
  function pushUnique_(r) {
    var key = r.id || r.uuid || r.code || '';
    if (key && seenR[key]) return; if (key) seenR[key] = 1;
    all.push(r);
  }
  var windows = days > 0 ? ltWindows_(-35, days) : ltWindows_(-120, 365);
  var findCode = opts.findCode ? normCode_(opts.findCode) : '';
  var chunks = []; for (var ci = 0; ci < propIds.length; ci += 25) chunks.push(propIds.slice(ci, ci + 25));
  var propQs = chunks.map(function (ids) { return ids.map(function (id) { return 'properties[]=' + encodeURIComponent(id); }).join('&'); });
  var base = 'https://public.api.hospitable.com/v2/reservations?include=guest,properties,listings&per_page=100&';
  // la ventana que contiene HOY va primero (las reservas que urgen); luego las demás por cercanía.
  // (se quitó el filtro booked_at: Hospitable no lo soporta y lo ignoraba → traía TODO el histórico, minutos de espera)
  windows.sort(function (a, b) { var da = a[0] <= 0 && a[1] >= 0 ? 0 : Math.min(Math.abs(a[0]), Math.abs(a[1])); var db = b[0] <= 0 && b[1] >= 0 ? 0 : Math.min(Math.abs(b[0]), Math.abs(b[1])); return da - db; });
  var queries = [];
  windows.forEach(function (w) { propQs.forEach(function (pq) {
    queries.push(pq + '&start_date=' + isoDate_(new Date(now.getTime() + w[0] * 86400000)) + '&end_date=' + isoDate_(new Date(now.getTime() + w[1] * 86400000)));
  }); });
  var found = function () { return findCode && all.some(function (x) { return normCode_(x.code || x.reservation_code || x.confirmation_code || '') === findCode; }); };
  var pending = queries.map(function (q) { return { q: q, pg: 1 }; }), calls = 0;
  var fetchDeadline = t0 + (fast ? 120000 : 240000);
  while (pending.length && calls < 200) {
    if (new Date().getTime() > fetchDeadline) { out.meta.truncated = pending.length; break; }
    var batch = pending.splice(0, 20); calls += batch.length;
    var resps = hosFetchAll_(batch.map(function (x) { return base + x.q + '&page=' + x.pg; }), cfg);
    resps.forEach(function (res, k) {
      if (res.code === 429) { pending.push(batch[k]); Utilities.sleep(1500); return; }
      if (res.code !== 200) { errs.push('HTTP ' + res.code + ': ' + shortMsg_(res.json)); return; }
      var items = res.json.data || res.json.reservations || [];
      items.forEach(pushUnique_);
      if (items.length >= 100 && batch[k].pg < 15) pending.push({ q: batch[k].q, pg: batch[k].pg + 1 });
    });
    if (found()) { out.meta.foundAfterCalls = calls; break; }
  }
  out.meta.calls = calls;
  var globalOk = true;
  out.meta.reservationsMode = 'properties-batch';
  out.meta.reservationsStatus = errs.length ? ('errores: ' + errs.length) : 200;
  out.meta.reservationsRaw = all.length;
  if (errs.length && !all.length) { out.meta.error = 'reservations ' + errs[0]; }
  out.reservations = all.map(function (r) { return normalizeHospitable_(r, propMap); }).filter(Boolean);

  // Opción A — foto en alta resolución automática: para las propiedades de estas
  // reservas, resuelve el og:image del anuncio (una vez por propiedad; se guarda
  // en la pestaña "Fotos" y se reutiliza en syncs siguientes → barato).
  // En modo rápido SOLO se usan las fotos ya guardadas (lectura única de la
  // pestaña "Fotos"): nada de scraping, que es lo que hacía lento el sync.
  var cachedPhotos0 = {};
  try { cachedPhotos0 = allStoredPhotos_(); } catch (e) {}
  out.reservations.forEach(function (rv) { var c0 = rv.propertyName && cachedPhotos0[rv.propertyName.toLowerCase()]; if (c0) rv.photo = c0; });
  if (out.reservations.length) {
    try { var st = syncReservasSheet_(out.reservations); out.meta.added = st.added; out.meta.updated = st.updated; if (st.busy) out.meta.sheetBusy = true; }
    catch (we) { out.meta.sheetWriteError = String(we && we.message || we); }
  }
  out.meta.errorsSample = errs.slice(0, 2);
  var photoDeadline = t0 + 240000, newPhotos = false;
  try {
    var cachedPhotos = cachedPhotos0;
    var photoByName = {};
    out.reservations.forEach(function (rv) {
      var nm = rv.propertyName; if (!nm || photoByName[nm] !== undefined) return;
      var c = cachedPhotos[nm.toLowerCase()];
      if (c !== undefined) { photoByName[nm] = c; return; }
      photoByName[nm] = fast || new Date().getTime() > photoDeadline ? '' : resolvePropertyPhoto_(nm, rv, propMap);
      if (photoByName[nm]) newPhotos = true;
    });
    out.reservations.forEach(function (rv) {
      var p = photoByName[rv.propertyName];
      if (p) rv.photo = p;   // URL remota en alta resolución (og:image)
    });
  } catch (e) {}

  if (newPhotos) syncReservasSheet_(out.reservations);
  out.meta.mode = days > 0 ? ('rápido · ' + days + ' días') : 'completo';
  out.meta.syncedAt = new Date().toISOString();
  out.meta.seconds = Math.round((new Date().getTime() - t0) / 100) / 10;
  return out;
}

/* tramos de <= 85 días (Hospitable acepta hasta 90 por consulta) */
function ltWindows_(from, to) { var w = [], a = from; while (a < to) { var b = Math.min(a + 85, to); w.push([a, b]); a = b; } return w; }

/* Diagnóstico: ejecútalo desde el editor de Apps Script → debugFindCode('HMWRS3AXRB').
   Busca el código en Hospitable (−35 a +365 días) y en la hoja, y dice dónde está. */
function debugFindCode(code) {
  code = code || 'HMWRS3AXRB';
  var r = listReservations_({ days: 365, fast: true, findCode: code });
  var hit = (r.reservations || []).filter(function (x) { return normCode_(x.code) === normCode_(code); })[0];
  var res = { code: code, enHoja: !!findInReservasSheet_(code), enHospitable: !!hit, filasEnHoja: listCached_().length, meta: r.meta, reserva: hit || null };
  Logger.log(JSON.stringify(res, null, 2)); return res;
}

/* Estado de la hoja "Reservas": a qué archivo apunta SHEET_ID y cuántas filas tiene. */
function sheetInfo_() {
  var id = CFG_().SHEET_ID, ss = SpreadsheetApp.openById(id), sh = ss.getSheetByName('Reservas');
  return { id: id.slice(-6), name: ss.getName(), tab: !!sh, rows: sh ? Math.max(0, sh.getLastRow() - 1) : 0, tabs: ss.getSheets().map(function (s) { return s.getName(); }).slice(0, 12) };
}
/* Diagnóstico completo: ejecútalo en el editor → debugSync(). Hace lo mismo que el botón Actualizar
   y dice cuántas reservas trajo Hospitable, cuántas hay en la hoja y a qué archivo apunta. */
function debugSync() {
  var t = new Date().getTime(), tiempos = {};
  var r = listReservations_({ days: 90, fast: true }); tiempos.hospitableSeg = Math.round((new Date().getTime() - t) / 100) / 10; t = new Date().getTime();
  var info = sheetInfo_(); tiempos.infoHojaSeg = Math.round((new Date().getTime() - t) / 100) / 10; t = new Date().getTime();
  var filas = listCached_().length; tiempos.instantaneaSeg = Math.round((new Date().getTime() - t) / 100) / 10; t = new Date().getTime();
  var filasHoja = listFromSheet_().length; tiempos.leerHojaSeg = Math.round((new Date().getTime() - t) / 100) / 10; tiempos.filasHoja = filasHoja;
  var res = { tiempos: tiempos, hoja: info, filasLeidas: filas, hospitable: r.reservations.length, meta: r.meta, ejemplo: r.reservations[0] || null };
  Logger.log(JSON.stringify(res, null, 2)); return res;
}

/* Lee la pestaña "Fotos" completa una sola vez → { nombreMinúsculas: url } */
function allStoredPhotos_() {
  var map = {};
  try {
    var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Fotos');
    if (!sh || sh.getLastRow() < 2) return map;
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      if (r[0]) map[String(r[0]).toLowerCase()] = r[1] || '';
    });
  } catch (e) {}
  return map;
}

function hosFetch_(url, cfg) {
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + cfg.HOSPITABLE_TOKEN, 'Accept': 'application/json' },
    muteHttpExceptions: true
  });
  var json = {};
  try { json = JSON.parse(res.getContentText()); } catch (e) {}
  return { code: res.getResponseCode(), json: json };
}
function isoDate_(d) { return d.toISOString().slice(0, 10); }
function hosFetchAll_(urls, cfg) {
  var reqs = urls.map(function (u) { return { url: u, method: 'get', muteHttpExceptions: true,
    headers: { 'Authorization': 'Bearer ' + cfg.HOSPITABLE_TOKEN, 'Accept': 'application/json' } }; });
  var out = [];
  try { out = UrlFetchApp.fetchAll(reqs); } catch (e) { return urls.map(function () { return { code: 0, json: { message: String(e && e.message || e) } }; }); }
  return out.map(function (res) { var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {} return { code: res.getResponseCode(), json: j }; });
}

/* ============================================================
   Lector de documentos (Anthropic Claude, visión) — proxy server.
   El navegador manda la imagen en base64 + el prompt; la llave
   ANTHROPIC_API_KEY vive SOLO aquí (Propiedades del script).
   body: { media_type, data(base64), prompt }

   ESTRATEGIA DE COSTO: intenta primero con Haiku (barato). Si la
   respuesta no es una lectura limpia (no es documento legible o no
   trajo nombre), reintenta automáticamente con Sonnet (preciso).
   Así la mayoría de documentos nítidos se leen barato y solo los
   difíciles pagan el modelo caro.
   Devuelve { ok:true, text, model, escalated }.
   ============================================================ */
function readDocument_(body) {
  var cfg = CFG_();
  var key = cfg.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'no-anthropic-key' };
  var mediaType = String(body.media_type || '');
  var data = String(body.data || '');
  var prompt = String(body.prompt || '');
  var supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (supported.indexOf(mediaType) < 0 || !data) return { ok: false, error: 'invalid-image' };

  var models = [cfg.AI_MODEL_PRIMARY];
  if (cfg.AI_MODEL_FALLBACK && cfg.AI_MODEL_FALLBACK !== cfg.AI_MODEL_PRIMARY) models.push(cfg.AI_MODEL_FALLBACK);

  var lastText = '', lastModel = '', lastErr = '';
  for (var i = 0; i < models.length; i++) {
    var r = anthropicVision_(key, models[i], prompt, mediaType, data);
    if (!r.ok) { lastErr = r.error; continue; }        // error HTTP → prueba el siguiente modelo
    lastText = r.text; lastModel = models[i];
    if (goodRead_(r.text)) return { ok: true, text: r.text, model: models[i], escalated: i > 0 };
    // respuesta válida pero sin lectura limpia → escala al siguiente modelo
  }
  if (lastText) return { ok: true, text: lastText, model: lastModel, escalated: models.length > 1 };
  return { ok: false, error: lastErr || 'anthropic-failed' };
}

// Una llamada de visión a un modelo. Devuelve { ok, text } o { ok:false, error }.
function anthropicVision_(key, model, prompt, mediaType, data) {
  var payload = {
    model: model,
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: data } }
      ]
    }]
  };
  try {
    var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var json = {};
    try { json = JSON.parse(res.getContentText()); } catch (e) {}
    registrarUsoIA_('Lectura de documento (check-in)', model, json.usage, code === 200 ? '' : 'HTTP ' + code);
    if (code !== 200) return { ok: false, error: 'anthropic HTTP ' + code + ': ' + shortMsg_(json) };
    var text = '';
    if (json.content && json.content.length) {
      for (var i = 0; i < json.content.length; i++) {
        if (json.content[i] && json.content[i].type === 'text') text += json.content[i].text;
      }
    }
    return { ok: true, text: text };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

/* ============================================================
   ESTÁNDAR DE INSTRUCCIONES (copywriting con IA)
   ------------------------------------------------------------
   Reescribe las instrucciones crudas de una propiedad (check-in,
   parqueo, wifi) a la estructura estándar y la voz de marca de
   Spacio AM. NO inventa datos: solo reordena y pule lo existente.
   Devuelve { es:{...}, en:{...} } con la misma estructura.
   ============================================================ */
function anthropicText_(key, model, system, userText) {
  var payload = { model: model, max_tokens: 1600, system: system, messages: [{ role: 'user', content: userText }] };
  try {
    var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var json = {}; try { json = JSON.parse(res.getContentText()); } catch (e) {}
    registrarUsoIA_('Estándar de instrucciones', model, json.usage, code === 200 ? '' : 'HTTP ' + code);
    if (code !== 200) return { ok: false, error: 'anthropic HTTP ' + code + ': ' + shortMsg_(json) };
    var text = '';
    if (json.content && json.content.length) {
      for (var i = 0; i < json.content.length; i++) {
        if (json.content[i] && json.content[i].type === 'text') text += json.content[i].text;
      }
    }
    return { ok: true, text: text };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

function stdNormBlock_(o) {
  o = o || {};
  return {
    arrivalIntro: String(o.arrivalIntro || '').trim(),
    arrivalSteps: (o.arrivalSteps || []).map(function (s) { return String(s || '').trim(); }).filter(Boolean),
    parking: String(o.parking || '').trim(),
    wifiNote: String(o.wifiNote || '').trim(),
    tip: String(o.tip || '').trim()
  };
}
function parseStdJson_(text) {
  try {
    var m = /\{[\s\S]*\}/.exec(text || ''); if (!m) return null;
    var j = JSON.parse(m[0]);
    if (!j.es && !j.en) return null;
    return { es: stdNormBlock_(j.es || j.en), en: stdNormBlock_(j.en || j.es) };
  } catch (e) { return null; }
}
function standardizeInstructions_(body) {
  var cfg = CFG_();
  var key = cfg.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'no-anthropic-key' };
  var raw = body.raw || {};
  var system = [
    'Eres copywriter senior de Spacio AM, hospitalidad boutique en Guatemala.',
    'Reescribes las instrucciones crudas de una propiedad (llegada/check-in, parqueo, wifi) para el huésped.',
    '',
    'VOZ DE MARCA — como un concierge de hotel boutique: cálida, serena, cercana, nunca corporativa ni vendedora.',
    '· Trata de "tú" (nunca "usted"). Español natural de Guatemala.',
    '· Presente. Frases cortas y editoriales. Sin signos de exclamación. Sin MAYÚSCULAS de grito. Sin emoji.',
    '· Claridad ante todo: cada paso es una sola acción, empieza con un verbo, fácil de seguir al llegar cansado con maletas.',
    '',
    'REGLAS DE CONTENIDO (críticas):',
    '· Usa SOLO la información provista. NO inventes datos (direcciones, códigos, números, horarios, precios, nombres, enlaces).',
    '· Conserva EXACTOS los datos concretos: direcciones, números de parqueo, redes/contraseñas, nombres, teléfonos, enlaces.',
    '· NUNCA escribas el código de ingreso/cerradura aunque aparezca: en su lugar indica que el código se enviará por la plataforma el día de la llegada.',
    '· Si un campo no tiene información, devuelve cadena vacía "" (o lista vacía). No rellenes con texto genérico inventado.',
    '· arrivalSteps: 3 a 6 pasos. NO los numeres (el sistema los numera). No repitas la dirección completa en cada paso.',
    '· parking: 1–3 frases claras. Si no hay parqueo propio, explícalo con calidez y menciona la opción externa si se dio.',
    '· wifiNote: máximo 1 frase amable (la red y contraseña se muestran aparte). "" si no aplica.',
    '· tip: un solo consejo de cierre, o "".',
    '',
    'Devuelve ESTRICTAMENTE un objeto JSON (sin texto extra, sin markdown) con esta forma:',
    '{"es":{"arrivalIntro":"","arrivalSteps":["",""],"parking":"","wifiNote":"","tip":""},"en":{"arrivalIntro":"","arrivalSteps":["",""],"parking":"","wifiNote":"","tip":""}}',
    'La versión "en" es una traducción natural (no literal) de "es", con el mismo tono.'
  ].join('\n');
  var userText = 'Datos crudos de la propiedad (JSON). Reescribe SOLO con esta información:\n\n' + JSON.stringify(raw, null, 2);
  var order = [cfg.AI_MODEL_PRIMARY, cfg.AI_MODEL_FALLBACK].filter(Boolean);
  if (!order.length) order = ['claude-sonnet-4-5'];
  var lastErr = '';
  for (var i = 0; i < order.length; i++) {
    var r = anthropicText_(key, order[i], system, userText);
    if (!r.ok) { lastErr = r.error; continue; }
    var std = parseStdJson_(r.text);
    if (std) return { ok: true, std: std, model: order[i] };
    lastErr = 'respuesta-no-json';
  }
  return { ok: false, error: lastErr || 'standardize-failed' };
}

// ¿La respuesta del modelo es una lectura limpia? (documento legible + nombre)
function goodRead_(text) {
  try {
    var jm = /\{[\s\S]*\}/.exec(text || '');
    if (!jm) return false;
    var j = JSON.parse(jm[0]);
    return !!(j.is_document !== false && String(j.full_name || '').trim());
  } catch (e) { return false; }
}
function shortMsg_(j) {
  if (!j) return '';
  return String(j.message || j.error || (j.errors && JSON.stringify(j.errors)) || '').slice(0, 160);
}

/* Mapea una reserva de Hospitable → forma de la web app.
   Usa el mapa de propiedades para nombre/capacidad/apartamento.
   Rutas de campos defensivas: ajusta si tu cuenta difiere. */
function estadoReserva_(r) {
  var rs = r && r.reservation_status;
  var cat = rs && (rs.current && (rs.current.category || rs.current.status) || rs.category || (typeof rs === 'string' ? rs : ''));
  return String(cat || (r && (r.status || r.state)) || '').toLowerCase();
}
function normalizeHospitable_(r, propMap) {
  if (!r) return null;
  propMap = propMap || {};
  var pid = r.property_id
    || (r.properties && r.properties[0] && (r.properties[0].id || r.properties[0].property_id))
    || (r.listings && r.listings[0] && (r.listings[0].id || r.listings[0].property_id))
    || (r.property && r.property.id) || (r.listing && r.listing.id);
  var prop = r._prop || propMap[pid]
    || (r.properties && r.properties[0]) || r.property || r.listing || {};

  var guest = r.guest || (r.guests && r.guests[0]) || {};
  var name = (guest.first_name || guest.last_name)
    ? { first: guest.first_name || '', last: guest.last_name || '' }
    : splitName_(guest.name || r.guest_name || '');

  var checkin  = (r.check_in || r.checkin || r.arrival_date || '').toString().slice(0, 10);
  var checkout = (r.check_out || r.checkout || r.departure_date || '').toString().slice(0, 10);

  var g = r.guests || {};
  var count = (g && typeof g === 'object')
    ? (g.total || ((g.adults || 0) + (g.children || 0)) || 1)
    : (g || r.number_of_guests || 1);

  var propName = prop.name || prop.public_name || prop.private_name || prop.nickname || prop.internal_name
    || (r.listing && r.listing.name) || (r.listings && r.listings[0] && r.listings[0].name)
    || r.property_name || '';
  var cap = (prop.capacity && (prop.capacity.max || prop.capacity.persons || prop.capacity)) || prop.accommodates || count;
  var apt = prop.internal_name || prop.nickname
    || (prop.address && (prop.address.apartment || prop.address.flat)) || '';
  // El nombre suele traer "Zona - Edificio - Apto" (ej. "Z13 - Inara - 412").
  // Si no hay apartamento explícito, tomamos el último segmento.
  if (!apt) {
    var parts = String(propName).split(/\s*[-–—·]\s*/);
    if (parts.length >= 2) apt = parts[parts.length - 1].trim();
  }
  // never leave the property name blank — fall back to apartment, then a generic
  if (!propName) propName = apt || 'Spacio AM';

  // NO guardamos el thumbnail de Hospitable (llega borroso). res.photo queda
  // vacío aquí; la Opción A (resolvePropertyPhoto_) lo llena SOLO con el
  // og:image en alta resolución del anuncio cuando se puede resolver.
  var photo = '';

  return {
    id: r.id || r.uuid || r.code || (propName + checkin),
    code: r.code || r.confirmation_code || r.platform_id || '',
    propertyName: propName,
    propertyShort: prop.private_name || prop.name || prop.public_name || propName,
    apartment: apt,
    maxCapacity: cap,
    reservedGuests: count,
    checkin: checkin,
    checkout: checkout,
    guestFirstName: name.first,
    guestLastName: name.last,
    guestName: (name.first + ' ' + name.last).trim(),
    photo: photo,
    assignedEmail: '',
    platform: r.platform || r.channel || '',
    // lo que pagó el huésped (para la factura): monto + moneda
    amount: guestPaid_(r).amount,
    currency: guestPaid_(r).currency,
    // estado de la reserva en Hospitable (accepted, cancelled, …): las canceladas no se muestran en Registros
    status: estadoReserva_(r)
  };
}

/* Monto que pagó el huésped. Los objetos de dinero de Hospitable v2 vienen
   como { amount: <minor units>, currency, formatted }. Preferimos `formatted`
   (siempre trae los decimales correctos) y solo si no está usamos `amount`. */
function money_(o) {
  if (o == null) return null;
  if (typeof o === 'number') return { amount: o, currency: '' };
  if (typeof o === 'string') {
    var ns = parseFloat(o.replace(/[^0-9.\-]/g, ''));
    return isNaN(ns) ? null : { amount: ns, currency: '' };
  }
  if (typeof o !== 'object') return null;
  var cur = String(o.currency || o.currency_code || o.iso_currency || '').toUpperCase();
  if (typeof o.formatted === 'string' && o.formatted) {
    var cl = o.formatted.replace(/[^0-9.,\-]/g, '');
    // "1,234.56" → 1234.56 · "1.234,56" → 1234.56
    if (/,\d{1,2}$/.test(cl)) cl = cl.replace(/\./g, '').replace(',', '.');
    else cl = cl.replace(/,/g, '');
    var nf = parseFloat(cl);
    if (!isNaN(nf)) return { amount: nf, currency: cur };
  }
  if (o.amount != null) {
    var na = Number(o.amount);
    if (!isNaN(na)) return { amount: (na % 1 === 0 && Math.abs(na) >= 100) ? na / 100 : na, currency: cur };
  }
  return null;
}

function guestPaid_(r) {
  var fin = r.financials || r.financial || {};
  var gst = fin.guest || {};
  var cands = [
    gst.total_price, gst.total, gst.price, gst.grand_total, gst.paid,
    fin.guest_total_price, fin.total_price,
    r.money && (r.money.guest_total_price || r.money.total_price || r.money.total_paid),
    r.total_price, r.total, r.price
  ];
  for (var i = 0; i < cands.length; i++) {
    var m = money_(cands[i]);
    if (m && m.amount > 0) return { amount: m.amount, currency: m.currency || 'USD' };
  }
  return { amount: null, currency: '' };
}

/* ---- TIPO DE CAMBIO DEL DÍA ----
   Fuente por defecto: tipo de cambio de referencia del Banguat (web service
   oficial), cacheado 6 h. Si se define la propiedad de script FX_RATE_MANUAL
   (por ejemplo la tasa del Banco Industrial del día), esa manda. */
function fxRate_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('FX_GTQ_USD');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  var manual = PropertiesService.getScriptProperties().getProperty('FX_RATE_MANUAL');
  var out = null;
  if (manual && !isNaN(parseFloat(manual))) {
    out = { rate: parseFloat(manual), source: 'Banco Industrial (manual)', date: isoDate_(new Date()) };
  } else {
    try {
      var env = '<?xml version="1.0" encoding="utf-8"?>'
        + '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
        + '<soap:Body><TipoCambioDia xmlns="http://www.banguat.gob.gt/variables/ws/" /></soap:Body></soap:Envelope>';
      var res = UrlFetchApp.fetch('https://www.banguat.gob.gt/variables/ws/TipoCambio.asmx', {
        method: 'post', contentType: 'text/xml; charset=utf-8',
        headers: { SOAPAction: 'http://www.banguat.gob.gt/variables/ws/TipoCambioDia' },
        payload: env, muteHttpExceptions: true
      });
      var xml = res.getContentText();
      var mr = /<referencia>([\d.]+)<\/referencia>/i.exec(xml);
      var md = /<fecha>([^<]+)<\/fecha>/i.exec(xml);
      if (mr) out = { rate: parseFloat(mr[1]), source: 'Banguat (referencia)', date: md ? md[1] : isoDate_(new Date()) };
    } catch (e) {}
  }
  if (!out) out = { rate: null, source: '', date: '' };
  try { cache.put('FX_GTQ_USD', JSON.stringify(out), out.rate ? 21600 : 900); } catch (e) {}
  return out;
}

function splitName_(full) {
  full = (full || '').trim();
  if (!full) return { first: '', last: '' };
  var parts = full.split(/\s+/);
  return { first: parts.shift(), last: parts.join(' ') };
}

/* Extrae la URL de la foto de MAYOR resolución de una propiedad/listing.
   Prioriza el arreglo de fotos (tamaño completo) y las variantes grandes,
   dejando la miniatura solo como último recurso (evita fotos borrosas). */
function firstPhotoUrl_(o) {
  if (!o || typeof o !== 'object') return '';
  function big_(p) {
    if (typeof p === 'string' && /^https?:\/\//.test(p)) return p;
    if (p && typeof p === 'object') {
      var v = p.original || p.full || p.xl || p.xlarge || p.large || p.url || p.medium || p.src || p.thumbnail;
      if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
    }
    return '';
  }
  // 1 · arreglo de fotos (normalmente tamaño completo)
  var arr = o.photos || o.pictures || o.images;
  if (Array.isArray(arr) && arr.length) {
    var u = big_(arr[0]);
    if (u) return u;
  }
  // 2 · campos de imagen única — grandes primero, miniatura al final
  var order = [o.picture_large, o.image_large, o.large,
    o.picture, o.picture_url, o.image, o.image_url, o.cover, o.cover_url, o.main_photo, o.photo,
    o.thumbnail, o.thumbnail_url];
  for (var i = 0; i < order.length; i++) {
    var s = order[i];
    if (typeof s === 'string' && /^https?:\/\//.test(s)) return s;
    if (s && typeof s === 'object') { var b = big_(s); if (b) return b; }
  }
  return '';
}

/* Escritura POR LOTES: antes hacía una llamada al sheet por reserva
   (getValue + setValues + appendRow), lo que tardaba minutos con cientos de
   reservas. Ahora: 1 lectura + máximo 2 escrituras. */
function syncReservasSheet_(list) {
  var lock = LockService.getScriptLock(); try { lock.waitLock(30000); } catch (e) { return { added: 0, updated: 0, busy: true }; }
  try {
    var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
    var sh = ss.getSheetByName('Reservas');
    var headers = SCHEMA_['Reservas'];
    try { if (!sh.getRange(1, headers.length).getValue()) sh.getRange(1, headers.length).setValue(headers[headers.length - 1]).setFontWeight('bold').setBackground('#3E3F3F').setFontColor('#FAFAFA'); } catch (e) {}
    var existing = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues() : [];
    var byCode = {};
    existing.forEach(function (row, i) { if (row[0]) byCode[normCode_(row[0])] = i; });
    var now = new Date().toISOString(), adds = [], changed = {}, seen = {};
    var same = function (x, y) { return String(x instanceof Date ? toDateStr_(x) : x) === String(y instanceof Date ? toDateStr_(y) : y); };
    list.forEach(function (r) {
      var key = normCode_(r.code); if (!key || seen[key]) return; seen[key] = 1;
      var row = [
        r.code, r.propertyName, r.apartment, r.checkin, r.checkout,
        r.guestFirstName, r.guestLastName, r.reservedGuests, r.maxCapacity,
        r.assignedEmail, '', now, r.photo || '',
        (r.amount || r.amount === 0) ? r.amount : '', r.currency || '', r.status || ''
      ];
      if (byCode[key] !== undefined) {
        var i = byCode[key], prev = existing[i];
        row[10] = prev[10];
        if (!row[12] && prev[12]) row[12] = prev[12];
        if (row[13] === '' && prev[13] !== '' && prev[13] != null) row[13] = prev[13];
        if (!row[14] && prev[14]) row[14] = prev[14];
        if (!row[15] && prev[15]) row[15] = prev[15];
        var diff = false; for (var k = 1; k < row.length; k++) { if (k === 10 || k === 11) continue; if (!same(row[k], prev[k])) { diff = true; break; } }
        if (diff) { existing[i] = row; changed[i] = 1; }
      } else { byCode[key] = existing.length + adds.length; adds.push(row); }
    });
    // solo las filas que cambiaron, y NUNCA la columna K (status_form): así un sync no revierte un formulario recién completado
    Object.keys(changed).forEach(function (i) {
      var r = existing[i], n = +i + 2;
      sh.getRange(n, 1, 1, 10).setValues([r.slice(0, 10)]);
      sh.getRange(n, 12, 1, headers.length - 11).setValues([r.slice(11)]);
    });
    if (adds.length) sh.getRange(existing.length + 2, 1, adds.length, headers.length).setValues(adds);
    SpreadsheetApp.flush();
    try { snapshotWriteRows_(existing.concat(adds)); } catch (se) {}
    return { added: adds.length, updated: Object.keys(changed).length };
  } finally { lock.releaseLock(); }
}

/* ============================================================
   3b · FIND RESERVATION — búsqueda rápida desde el sheet (cache).
   Si no se encuentra, dispara una sincronización en vivo y vuelve
   a verificar ANTES de responder "no existe" (reservas de última
   hora). Devuelve la reserva en la forma que espera la web app.
   ============================================================ */
function normCode_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function rowToReservation_(r) {
  return {
    id: r[0], code: r[0], propertyName: r[1], propertyShort: r[1], apartment: r[2],
    checkin: toDateStr_(r[3]), checkout: toDateStr_(r[4]),
    guestFirstName: r[5], guestLastName: r[6],
    guestName: ((r[5] || '') + ' ' + (r[6] || '')).trim(),
    reservedGuests: Number(r[7]) || 1, maxCapacity: Number(r[8]) || Number(r[7]) || 1,
    assignedEmail: r[9] || '', statusForm: r[10] || '', photo: r[12] || '',
    amount: (r[13] === '' || r[13] == null) ? null : Number(r[13]),
    currency: r[14] || '', status: r[15] || ''
  };
}
// puntaje para elegir la MEJOR fila de un código con duplicados
function rowScore_(r) {
  var pn = String(r[1] || '').trim();
  return (String(r[10] || '') === 'completo' ? 2 : 0) + (pn && pn !== 'Spacio AM' ? 1 : 0);
}

function findInReservasSheet_(code) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Reservas');
  if (!sh || sh.getLastRow() < 2) return null;
  var headers = SCHEMA_['Reservas'];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  var n = normCode_(code);
  var best = null, bestScore = -1;
  for (var i = 0; i < rows.length; i++) {
    if (normCode_(rows[i][0]) !== n) continue;
    var s = rowScore_(rows[i]);
    if (s > bestScore) { bestScore = s; best = rows[i]; }
  }
  return best ? rowToReservation_(best) : null;
}
function toDateStr_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

/* Lee TODAS las reservas de la caché (pestaña Reservas) sin llamar a
   Hospitable — respuesta instantánea para el panel de admin. */
function listCached_() {
  // 1 · instantánea en Drive (≈1 s, no espera a que la hoja recalcule sus fórmulas)
  var snap = snapshotRead_();
  if (snap && snap.list && snap.list.length && (new Date().getTime() - new Date(snap.at).getTime()) < 6 * 3600000) return snap.list;
  // 2 · sin instantánea o muy vieja → se lee la hoja y se regenera
  var list = listFromSheet_();
  try { snapshotWriteList_(list); } catch (e) {}
  return list;
}
function listFromSheet_() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Reservas');
  if (!sh || sh.getLastRow() < 2) return [];
  var headers = SCHEMA_['Reservas'];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  return rowsToList_(rows);
}
// dedupe por código, conservando la MEJOR fila (nombre real + estado completo)
function rowsToList_(rows) {
  var byCode = {};
  rows.forEach(function (r) {
    if (!r[0]) return;
    var k = normCode_(r[0]);
    var s = rowScore_(r);
    if (!byCode[k] || s > byCode[k].score) byCode[k] = { row: r, score: s };
  });
  return Object.keys(byCode).map(function (k) { return rowToReservation_(byCode[k].row); });
}

/* ---- Instantánea de Reservas en Drive ----
   La hoja "Guest app DB" tiene pestañas con fórmulas pesadas (ALMA_*): después de cada escritura
   Google recalcula todo y la SIGUIENTE lectura de la hoja se queda esperando (medimos 5 min).
   Por eso el panel lee este JSON, que se regenera en cada sync y en cada cambio de estado. */
var SNAPSHOT_NAME_ = 'reservas-cache.json';
function snapshotFile_() {
  var root = DriveApp.getFolderById(CFG_().DRIVE_FOLDER), it = root.getFilesByName(SNAPSHOT_NAME_);
  return it.hasNext() ? it.next() : null;
}
function snapshotRead_() {
  try { var f = snapshotFile_(); if (!f) return null; var o = JSON.parse(f.getBlob().getDataAsString()); return o && Array.isArray(o.list) ? o : null; }
  catch (e) { return null; }
}
function snapshotWriteList_(list) {
  var json = JSON.stringify({ at: new Date().toISOString(), list: list || [] });
  var f = snapshotFile_();
  if (f) f.setContent(json); else DriveApp.getFolderById(CFG_().DRIVE_FOLDER).createFile(SNAPSHOT_NAME_, json, MimeType.PLAIN_TEXT);
  try { CacheService.getScriptCache().remove('snap-at'); } catch (e) {}
}
function snapshotWriteRows_(rows) { snapshotWriteList_(rowsToList_(rows)); }
/* cambia el estado de formulario de un código en la instantánea sin releer la hoja */
function snapshotPatchStatus_(code, status) {
  try {
    var snap = snapshotRead_(); if (!snap) return;
    var n = normCode_(code), hit = false;
    snap.list.forEach(function (r) { if (normCode_(r.code) === n) { r.statusForm = status; hit = true; } });
    if (hit) snapshotWriteList_(snap.list);
  } catch (e) {}
}
/* Regenera la instantánea desde la hoja. Ejecútalo una vez tras publicar, o cuando edites la hoja a mano. */
function rebuildSnapshot() { var l = listFromSheet_(); snapshotWriteList_(l); Logger.log('instantánea: ' + l.length + ' reservas'); return l.length; }

function findReservation_(body) {
  var code = body.code || '';
  if (normCode_(code).length < 3) return { ok: false, error: 'code-too-short' };

  // 1 · cache del sheet (rápido)
  var hit = findInReservasSheet_(code);
  if (hit) {
    // evidencia positiva de reinicio: la app del huésped solo descarta su
    // registro local si el backend confirma que se reinició después.
    try {
      var ra = lastResetAt_(SpreadsheetApp.openById(CFG_().SHEET_ID), normCode_(code));
      if (ra) hit.resetAt = ra;
    } catch (e) {}
    return { ok: true, reservation: hit };
  }

  // 2 · body.sync controla cuánto trabajo se hace, para que el huésped nunca
  //     espere sin saber por qué:
  //       (vacío) → solo caché (ya respondió arriba). Front muestra el pop-up.
  //       'quick' → hoy + 5 días (≈15-30 s). Lo dispara el huésped.
  //       'deep'  → 60 días (≈1-2 min). Segundo intento del huésped.
  var sync = body.sync || '';
  if (!sync) return { ok: false, error: 'not-found', canSync: 'quick' };

  if (sync === 'quick') {
    try { listReservations_({ days: 90, fast: true, findCode: code }); } catch (e) {}
    hit = findInReservasSheet_(code);
    if (hit) return { ok: true, reservation: hit };
    return { ok: false, error: 'not-found', canSync: 'deep' };
  }

  try { listReservations_({ days: 365, fast: true, findCode: code }); } catch (e) {}
  hit = findInReservasSheet_(code);
  if (hit) return { ok: true, reservation: hit };

  return { ok: false, error: 'not-found', canSync: '' };
}

/* Sincronización programada (cron) — escribe/actualiza la pestaña Reservas. */
function scheduledSync() { try { listReservations_(); } catch (e) {} }

/* Cron corto recomendado: cada 5-10 min, solo los próximos 5 días.
   Así una reserva de última hora ya está en caché antes de que el huésped
   escriba su código. Configúralo como disparador de tiempo en Apps Script. */
function quickSync() { try { listReservations_({ days: 90, fast: true }); } catch (e) {} }
/* Ejecútalo UNA vez desde el editor: deja el sync rápido cada 10 min y el completo a las 5 a.m. y 3 p.m. */
function installSyncTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { var h = t.getHandlerFunction(); if (h === 'quickSync' || h === 'scheduledSync') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('quickSync').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('scheduledSync').timeBased().atHour(5).everyDays(1).create();
  ScriptApp.newTrigger('scheduledSync').timeBased().atHour(15).everyDays(1).create();
  return 'ok';
}

/* Lee un archivo de Drive y lo devuelve como data URL (para mostrar el
   documento con sello de agua en el reporte del admin). */
function driveFileDataUrl_(fileId) {
  if (!fileId) return '';
  // 1) miniatura de Drive a 1600px: pesa ~150 KB en vez de los 3-6 MB del
  //    original de cámara. Es lo que hace que el resumen abra en segundos.
  try {
    var token = ScriptApp.getOAuthToken();
    var meta = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=thumbnailLink,mimeType,size',
      { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (meta.getResponseCode() === 200) {
      var j = JSON.parse(meta.getContentText());
      var link = j.thumbnailLink || '';
      if (link) {
        link = link.replace(/=s\d+(-c)?$/, '=s1600');
        var img = UrlFetchApp.fetch(link, { muteHttpExceptions: true });
        if (img.getResponseCode() === 200) {
          var b = img.getBlob();
          return 'data:' + (b.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(b.getBytes());
        }
      }
      // sin miniatura y archivo enorme: mejor no intentarlo (la llamada expira)
      if (Number(j.size || 0) > 6000000) return '';
    }
  } catch (e) {}
  // 2) respaldo: el archivo original
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var mime = blob.getContentType() || 'image/jpeg';
    if (mime.indexOf('image/') !== 0) return '';
    return 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) { return ''; }
}

/* Momento del último reinicio de formulario para un código (0 si nunca). */
function lastResetAt_(ss, code) {
  try {
    var sh = ss.getSheetByName('Reinicios');
    if (!sh || sh.getLastRow() < 2) return 0;
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    var best = 0;
    rows.forEach(function (r) {
      if (normCode_(String(r[1] || '')) !== code) return;
      var d = r[0] ? new Date(r[0]).getTime() : 0;
      if (d > best) best = d;
    });
    return best;
  } catch (e) { return 0; }
}

/* Devuelve el registro completo (Formularios + Huespedes + documentos) de una
   reserva ya completada, para que el panel de admin lo muestre aunque el
   formulario se haya llenado desde otro dispositivo. */
function getRegistration_(body) {
  var r = getRegistrationBase_(body);
  // hora de inicio / envío y quién lo finalizó (pestaña Borradores)
  try {
    if (r && r.record) {
      var d = draftInfo_(normCode_(body.code || ''));
      if (d) { r.record.startedAt = d.started_at || ''; r.record.submittedAt = d.submitted_at || r.record.completedAt || ''; r.record.completedBy = d.completed_by || ''; }
    }
  } catch (e) {}
  return r;
}
function getRegistrationBase_(body) {
  var code = normCode_(body.code || '');
  if (!code) return { ok: false, error: 'code-required' };
  // 1) snapshot de una sola fila — respuesta instantánea (lo normal)
  if (!body.rescan) {
    try {
      var snap = readRegistrationSnapshot_(code);
      if (snap) return { ok: true, record: snap, cached: true };
    } catch (e) {}
  }
  // 2) sin snapshot (registros viejos): recorre las pestañas y lo guarda
  var res = getRegistrationScan_(code);
  try { if (res && res.record) writeRegistrationSnapshot_(code, res.record); } catch (e) {}
  return res;
}

/* Lee el snapshot del registro (pestaña Registros) si no fue invalidado por
   un reinicio posterior del formulario. */
function readRegistrationSnapshot_(code) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Registros');
  if (!sh || sh.getLastRow() < 2) return null;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  var best = null, bestAt = 0;
  for (var i = 0; i < rows.length; i++) {
    if (normCode_(String(rows[i][1] || '')) !== code) continue;
    var at = rows[i][0] ? new Date(rows[i][0]).getTime() : 0;
    if (at >= bestAt) { bestAt = at; best = rows[i][2]; }
  }
  if (!best) return null;
  var resetAt = lastResetAt_(ss, code);
  if (resetAt && bestAt < resetAt) return null;   // reiniciado después: no vale
  try { return JSON.parse(best); } catch (e) { return null; }
}

function writeRegistrationSnapshot_(code, record) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Registros') || ss.insertSheet('Registros');
  if (sh.getLastRow() === 0) sh.appendRow(SCHEMA_['Registros']);
  var json = JSON.stringify(record);
  if (json.length > 45000) return;       // no cabe en una celda: se deja el escaneo
  sh.appendRow([nowISO_(), code, json]);
}

function getRegistrationScan_(code) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  // ¿el administrador reinició el formulario? Todo lo enviado antes de esa
  // marca se ignora, para que el resumen muestre SOLO el registro nuevo.
  var resetAt = lastResetAt_(ss, code);
  var after = function (v) { if (!resetAt) return true; var d = v ? new Date(v).getTime() : 0; return d >= resetAt; };

  // Formularios (fila más reciente que coincide)
  var shF = ss.getSheetByName('Formularios');
  var form = null;
  if (shF && shF.getLastRow() > 1) {
    var fr = shF.getRange(2, 1, shF.getLastRow() - 1, SCHEMA_['Formularios'].length).getValues();
    for (var i = fr.length - 1; i >= 0; i--) {
      if (normCode_(fr[i][1]) === code && String(fr[i][SCHEMA_['Formularios'].length - 1] || '') !== 'reiniciado' && after(fr[i][0])) { form = fr[i]; break; }
    }
  }

  // Huespedes
  var shH = ss.getSheetByName('Huespedes');
  var guests = [];
  if (shH && shH.getLastRow() > 1) {
    shH.getRange(2, 1, shH.getLastRow() - 1, SCHEMA_['Huespedes'].length).getValues().forEach(function (r) {
      if (normCode_(r[1]) === code && after(r[0])) {
        guests.push({ name: r[6] || '', id: r[7] || '', main: !!r[5], docFileName: r[8] || '', docUrl: r[9] || '', manual: false });
      }
    });
  }
  guests.sort(function (a, b) { return (b.main ? 1 : 0) - (a.main ? 1 : 0); });

  // mapa file_name → file_id (pestaña Documentos) para recuperar las imágenes
  var docByName = {};
  var shD = ss.getSheetByName('Documentos');
  if (shD && shD.getLastRow() > 1) {
    shD.getRange(2, 1, shD.getLastRow() - 1, SCHEMA_['Documentos'].length).getValues().forEach(function (r) {
      if (normCode_(r[1]) === code && r[5] && after(r[0])) docByName[String(r[5])] = r[7]; // file_name → file_id
    });
  }
  // adjunta el id del archivo: la imagen se pide aparte (una por llamada) para
  // que esta respuesta sea pequeña y rápida. Antes iban todas las imágenes en
  // base64 dentro de este JSON y la llamada expiraba → el panel mostraba
  // "se completó desde otro dispositivo" aunque los documentos sí existían.
  guests.forEach(function (g) {
    var fid = g.docFileName && docByName[g.docFileName];
    if (fid) g.docFileId = fid;
    if (!g.docUrl && fid) g.docUrl = 'https://drive.google.com/file/d/' + fid + '/view';
  });

  if (!form && !guests.length) return { ok: false, error: 'not-found' };

  var f = form || [];
  // limpia valores: quita apóstrofe inicial y neutraliza celdas con error de fórmula
  function cell_(v) {
    var s = (v == null) ? '' : String(v);
    if (s.charAt(0) === "'") s = s.slice(1);
    return /^#(ERROR|REF|NAME|VALUE|DIV|NUM|NULL|N\/A)/i.test(s) ? '' : s;
  }
  // índices de Formularios: 0 submitted_at,1 code,2 property,3 apt,4 checkin,5 checkout,
  // 6 booker_type,7 booker_name,8 booker_id,9 booker_phone,10 booker_emergency,11 booker_email,
  // 12 contact_email,13 contact_phone,14 contact_emergency,15 count,16 accepted,17 folder,18 status
  var rec = {
    completedAt: cell_(f[0]), count: Number(f[15]) || guests.length,
    acceptedRulesAt: cell_(f[16]), docsFolderUrl: cell_(f[17]),
    booker: {
      type: f[6] || 'self', email: cell_(f[11]), phone: cell_(f[9]), emergency: cell_(f[10]),
      doc: (f[6] === 'third') ? { name: cell_(f[7]), id: cell_(f[8]) } : null
    },
    contact: { email: cell_(f[12]), phone: cell_(f[13]), emergency: cell_(f[14]) },
    guests: guests
  };
  return { ok: true, record: rec };
}

function ensureSyncTriggers_() {
  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'scheduledSync';
  });
  var hours = existing.map(function (t) { return t; });
  // limpia y recrea a 5 a.m. y 3 p.m.
  hours.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('scheduledSync').timeBased().atHour(5).everyDays(1).create();
  ScriptApp.newTrigger('scheduledSync').timeBased().atHour(15).everyDays(1).create();
}

/* ============================================================
   4 · SUBMIT FORM — guarda el registro completo
   (Formularios + Huespedes) y sube documentos a Drive.
   ============================================================ */
function submitForm_(body) {
  var f = body.form || {};
  var meta = body.reservation || {};
  var guests = f.guests || [];
  var booker = f.booker || {};
  var code = meta.code || '';
  var saveError = '';
  var subFolder = null;
  // 1) Guardado en Sheets/Drive — si algo falla, lo registramos pero NO impedimos
  //    el envío de correos/WhatsApp (que es lo crítico para el encargado).
  try {
    subFolder = submitFormSave_(body, f, meta, guests, booker, code);
  } catch (e) {
    saveError = String(e && e.message || e);
    logSend_('guardado', meta, '', false, 'Error al guardar en Sheets/Drive: ' + saveError);
  }

  // 1b) hora de inicio / envío y quién lo finalizó
  try {
    var nowIso = new Date().toISOString();
    draftUpsert_(normCode_(code), { started_at: f.startedAt ? new Date(f.startedAt).toISOString() : nowIso, submitted_at: nowIso,
      status: 'enviado', step: 'enviado', property_name: meta.propertyName || '', completed_by: f.completedBy || 'huésped' });
  } catch (e) {}

  // 2) Envíos (siempre se intentan)
  var regPdf = null;
  try { regPdf = buildRegistrationPdf_(meta, f, guests); } catch (e) { logSend_('pdf', meta, '', false, 'Excepción al generar PDF: ' + String(e)); }
  if (!regPdf) logSend_('pdf', meta, '', false, 'No se pudo generar el PDF del formulario');
  var contacts = contactsFor_(meta.propertyName || '');
  var emailRes, waRes;
  try { emailRes = notifyStation_(meta, guests, regPdf, contacts.emails); } catch (e) { emailRes = { ok: false, error: String(e) }; logSend_('email', meta, '', false, String(e)); }
  try { waRes = notifyWhatsApp_(meta, guests, regPdf, contacts.whatsapps); } catch (e) { waRes = { ok: false, error: String(e) }; logSend_('whatsapp', meta, '', false, String(e)); }

  // 3) Correo de bienvenida al huésped (branded)
  var guestEmail = (f.contact && f.contact.email) || booker.email || '';
  if (guestEmail) {
    var gok = false, gd = '';
    try { var wc = guestWelcomeContent_(meta); gok = sendMail_(guestEmail, wc.subject, wc.text, wc.html); }
    catch (e) { gd = String(e); }
    logSend_('email-huesped', meta, guestEmail, gok, gok ? 'Bienvenida enviada' : (gd || 'falló'));
  }

  return { ok: true, docsFolder: subFolder ? subFolder.getUrl() : '', saveError: saveError, sendReport: { email: emailRes, whatsapp: waRes } };
}

/* Guardado en Sheets + Drive. Devuelve la carpeta de la reserva.

   ORDEN IMPORTANTE (no reordenar): primero se escriben las filas de TEXTO
   (Huespedes + Formularios) y se marca 'completo'; después se suben las fotos
   a Drive y se rellenan sus columnas.
   Antes iba al revés: si Drive tardaba o fallaba, la reserva quedaba marcada
   'completo' pero sin ninguna fila en Formularios/Huespedes — el resumen del
   panel salía vacío ("La reserva aún no tiene filas…"). Así 'completo' siempre
   implica que los datos del huésped ya están guardados. */
function submitFormSave_(body, f, meta, guests, booker, code) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var now = new Date().toISOString();

  // IDEMPOTENCIA · la app reintenta el envío hasta 3 veces cuando la conexión
  // se corta; cada reintento volvía a escribir las filas y el resumen mostraba
  // los huéspedes duplicados (2 → 6). El lock serializa los reintentos y el
  // purgado borra lo que este mismo envío ya había escrito (últimas 6 h).
  var lock = LockService.getScriptLock();
  try { lock.waitLock(45000); } catch (e) {}
  try { purgeRecentFormRows_(ss, code, 6); } catch (e) {}

  var apartment = meta.apartment || '';
  var checkin = meta.checkin || '';

  var shHu = ss.getSheetByName('Huespedes');
  var shDoc = ss.getSheetByName('Documentos');
  var shF = ss.getSheetByName('Formularios');
  var deleteAt = checkoutPlusMonths_(meta.checkout, CFG_().RETENTION_MONTHS);

  // ---- FASE 1 · datos de texto (rápido, nunca se pierde) ----
  var huRowStart = shHu.getLastRow() + 1;
  guests.forEach(function (g, i) {
    shHu.appendRow([ now, code, apartment, checkin, i + 1, !!g.main,
      g.name || '', g.id || '', '', '' ]);   // file_name / file_url se rellenan en la fase 2
  });

  var fRow = shF.getLastRow() + 1;
  shF.appendRow([
    now, code, meta.propertyName || '', apartment, checkin, meta.checkout || '',
    booker.type || 'self',
    booker.doc ? (booker.doc.name || '') : '',
    booker.doc ? (booker.doc.id || '') : '',
    phone_(booker.phone), phone_(booker.emergency), booker.email || '',
    (f.contact && f.contact.email) || '',
    phone_(f.contact && f.contact.phone), phone_(f.contact && f.contact.emergency),
    f.count || guests.length,
    f.acceptedRulesAt ? new Date(f.acceptedRulesAt).toISOString() : now,
    '', 'completo'
  ]);

  // marca status_form = completo en Reservas (ya con los datos guardados)
  markReservaStatus_(ss, code, 'completo');

  // ---- FASE 2 · documentos en Drive (lento) ----
  var parent = DriveApp.getFolderById(CFG_().DRIVE_FOLDER);
  var folderName = [checkin, apartment, code].filter(String).join('_') || ('reserva_' + now);
  var subFolder = getOrCreateFolder_(parent, folderName);
  try { shF.getRange(fRow, 18).setValue(subFolder.getUrl()); } catch (e) {}

  guests.forEach(function (g, i) {
    if (!g.docImage) return;
    try {
      var saved = saveDocImage_(subFolder, g.docImage, checkin, apartment, g.name, i);
      shDoc.appendRow([ now, code, apartment, checkin, g.name || ('Huésped ' + (i + 1)),
        saved.name, saved.url, saved.id, deleteAt, false ]);
      shHu.getRange(huRowStart + i, 9, 1, 2).setValues([[saved.name, saved.url]]);
    } catch (e) {
      // una foto que falla no invalida el registro: queda la traza y se sigue
      logSend_('documento', meta, '', false, 'No se pudo subir el documento de ' + (g.name || ('huésped ' + (i + 1))) + ': ' + String(e && e.message || e));
    }
  });

  // documento del encargado (si reservó un tercero)
  if (booker.type === 'third' && booker.doc && booker.doc.docImage) {
    try {
      var savedB = saveDocImage_(subFolder, booker.doc.docImage, checkin, apartment, (booker.doc.name || 'encargado') + '-ENCARGADO', 'E');
      shDoc.appendRow([ now, code, apartment, checkin, (booker.doc.name || 'Encargado') + ' (encargado)',
        savedB.name, savedB.url, savedB.id, deleteAt, false ]);
    } catch (e) {
      logSend_('documento', meta, '', false, 'No se pudo subir el documento del encargado: ' + String(e && e.message || e));
    }
  }

  // snapshot para que el resumen del panel se lea al instante (y con los
  // documentos ya listados) en vez de recorrer 3 pestañas completas
  try {
    var snap = getRegistrationScan_(normCode_(code));
    if (snap && snap.record) writeRegistrationSnapshot_(normCode_(code), snap.record);
  } catch (e) {}
  return subFolder;
}

function saveDocImage_(folder, dataUrl, checkin, apartment, guestName, idx) {
  var m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  var mime = m ? m[1] : 'image/jpeg';
  var b64 = m ? m[2] : dataUrl;
  var ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  var safeGuest = slug_(guestName || ('huesped-' + idx));
  var name = [checkin || 'sinfecha', apartment || 'sinapto', safeGuest].join('_') + '.' + ext;
  // un reintento no debe dejar dos copias del mismo documento en la carpeta
  try {
    var dup = folder.getFilesByName(name);
    while (dup.hasNext()) dup.next().setTrashed(true);
  } catch (e) {}
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, name);
  var file = folder.createFile(blob);
  return { url: file.getUrl(), name: name, id: file.getId() };
}

/* Borra las filas de este código escritas en las últimas `hours` horas
   (Huespedes / Formularios / Documentos). Solo toca lo reciente: el
   histórico de envíos anteriores se conserva intacto. */
function purgeRecentFormRows_(ss, code, hours) {
  var n = normCode_(code);
  if (!n) return;
  var cut = new Date().getTime() - (hours || 6) * 3600000;
  ['Huespedes', 'Formularios', 'Documentos'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();  // at · code
    for (var i = rows.length - 1; i >= 0; i--) {
      if (normCode_(rows[i][1]) !== n) continue;
      var at = rows[i][0] ? new Date(rows[i][0]).getTime() : 0;
      if (!at || at < cut) continue;
      sh.deleteRow(i + 2);
    }
  });
}

/* REPARACIÓN MANUAL (ejecutar desde el editor de Apps Script).
   Quita huéspedes/documentos duplicados por reintentos y deja una sola fila de
   formulario por reserva. Sin argumento limpia todas las reservas.
   Ej.: limpiarDuplicados('HMZ5BMZNNH')  ·  limpiarDuplicados() */
function limpiarDuplicados(code) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var only = code ? normCode_(code) : '';
  var removed = 0, codes = {};

  // Huespedes · clave: código + nombre + identificación
  var shHu = ss.getSheetByName('Huespedes');
  if (shHu && shHu.getLastRow() > 1) {
    var hu = shHu.getRange(2, 1, shHu.getLastRow() - 1, SCHEMA_['Huespedes'].length).getValues();
    var seen = {};
    for (var i = 0; i < hu.length; i++) {
      var c = normCode_(hu[i][1]);
      if (!c || (only && c !== only)) continue;
      var k = c + '|' + String(hu[i][6] || '').trim().toUpperCase() + '|' + String(hu[i][7] || '').trim();
      if (seen[k]) { hu[i]._dup = true; } else { seen[k] = true; }
      codes[c] = true;
    }
    for (var j = hu.length - 1; j >= 0; j--) if (hu[j]._dup) { shHu.deleteRow(j + 2); removed++; }
  }

  // Documentos · clave: código + nombre de archivo
  var shDoc = ss.getSheetByName('Documentos');
  if (shDoc && shDoc.getLastRow() > 1) {
    var dc = shDoc.getRange(2, 1, shDoc.getLastRow() - 1, SCHEMA_['Documentos'].length).getValues();
    var seenD = {};
    for (var d = 0; d < dc.length; d++) {
      var cd = normCode_(dc[d][1]);
      if (!cd || (only && cd !== only)) continue;
      var kd = cd + '|' + String(dc[d][5] || '');
      if (seenD[kd]) dc[d]._dup = true; else seenD[kd] = true;
    }
    for (var d2 = dc.length - 1; d2 >= 0; d2--) if (dc[d2]._dup) { shDoc.deleteRow(d2 + 2); removed++; }
  }

  // Formularios · una sola fila por reserva (la más reciente)
  var shF = ss.getSheetByName('Formularios');
  if (shF && shF.getLastRow() > 1) {
    var fr = shF.getRange(2, 1, shF.getLastRow() - 1, SCHEMA_['Formularios'].length).getValues();
    var last = {};
    for (var x = 0; x < fr.length; x++) {
      var cf = normCode_(fr[x][1]);
      if (!cf || (only && cf !== only)) continue;
      last[cf] = x;                      // la última gana
      codes[cf] = true;
    }
    for (var y = fr.length - 1; y >= 0; y--) {
      var cy = normCode_(fr[y][1]);
      if (!cy || (only && cy !== only)) continue;
      if (last[cy] !== y) { shF.deleteRow(y + 2); removed++; }
    }
  }

  // rehace los snapshots de los códigos tocados
  Object.keys(codes).forEach(function (c) {
    try {
      var snap = getRegistrationScan_(c);
      if (snap && snap.record) writeRegistrationSnapshot_(c, snap.record);
    } catch (e) {}
  });
  var msg = 'Filas duplicadas eliminadas: ' + removed + ' · reservas revisadas: ' + Object.keys(codes).length;
  Logger.log(msg);
  return msg;
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function markReservaStatus_(ss, code, status) {
  var sh = ss.getSheetByName('Reservas');
  if (sh.getLastRow() < 2) return;
  var codes = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var n = normCode_(code);
  for (var i = 0; i < codes.length; i++) {
    if (normCode_(codes[i][0]) === n) { sh.getRange(i + 2, 11).setValue(status); } // marca TODAS las filas del código
  }
  snapshotPatchStatus_(code, status);
}

/* El huésped terminó el formulario: marca 'proceso' de inmediato para que el
   panel lo detecte al instante. NO marca 'completo': eso lo hace submitForm_
   cuando los datos ya están guardados en la hoja, de modo que 'completo'
   siempre signifique que el registro se puede leer. */
function formCompleted_(b) {
  var code = normCode_(b.code || '');
  if (!code) return { ok: false, error: 'code-required' };
  try { return formStarted_(b); } catch (e) { return { ok: false, error: String(e) }; }
}

/* El huésped validó su código y presionó "validar reserva": marca la reserva
   como 'proceso' para que el panel la muestre "en proceso". Nunca pisa 'completo'. */
function formStarted_(b) {
  var code = normCode_(b.code || '');
  if (!code) return { ok: false, error: 'code-required' };
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Reservas');
  if (!sh || sh.getLastRow() < 2) return { ok: true };
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
  var n = 0;
  for (var i = 0; i < rows.length; i++) {
    if (normCode_(rows[i][0]) !== code) continue;
    var cur = String(rows[i][10] || '').toLowerCase();
    if (cur === 'completo') continue;           // ya completado: no tocar
    if (cur === 'proceso') { n++; continue; }
    sh.getRange(i + 2, 11).setValue('proceso'); n++;
  }
  if (n) snapshotPatchStatus_(code, 'proceso');
  // el huésped presionó "Comenzar": queda la hora de inicio (solo la primera vez)
  if (b.start) { try { draftUpsert_(code, { started_at: new Date().toISOString(), status: 'en curso', step: 'inicio' }); } catch (e) {} }
  return { ok: true, rows: n };
}

/* ============================================================
   4a · BORRADORES — el formulario en curso se guarda paso a paso.
   Da la hora de inicio y la de envío de cada formulario, y permite al
   administrador abrir un formulario iniciado y finalizarlo con lo que el
   huésped ya llenó (las fotos se guardan en Drive → _borradores/<código>).
   ============================================================ */
var DRAFT_CAB_ = ['code','started_at','updated_at','step','property_name','form_json','status','submitted_at','completed_by'];
var DRAFT_FIRST_ = { started_at: 1, submitted_at: 1 };   // solo se escriben la primera vez
function draftSheet_() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Borradores');
  if (!sh) { sh = ss.insertSheet('Borradores'); sh.getRange(1, 1, 1, DRAFT_CAB_.length).setValues([DRAFT_CAB_]); sh.setFrozenRows(1); sh.getRange('A:I').setNumberFormat('@'); }
  return sh;
}
function draftRead_(sh, code) {
  var n = sh.getLastRow(), row = 0;
  if (n >= 2) { var f = sh.getRange(2, 1, n - 1, 1).createTextFinder(code).matchEntireCell(true).findNext(); if (f) row = f.getRow(); }
  var v = row ? sh.getRange(row, 1, 1, DRAFT_CAB_.length).getValues()[0] : [];
  var o = {}; DRAFT_CAB_.forEach(function (k, i) { var x = v[i]; o[k] = x instanceof Date ? x.toISOString() : String(x == null ? '' : x); });
  return { row: row, o: o };
}
function draftUpsert_(code, patch) {
  var lock = LockService.getScriptLock(); try { lock.waitLock(20000); } catch (e) {}
  try {
    var sh = draftSheet_(), x = draftRead_(sh, code), o = x.o;
    Object.keys(patch).forEach(function (k) {
      if (patch[k] == null || patch[k] === '') return;
      if (DRAFT_FIRST_[k] && o[k]) return;
      o[k] = patch[k];
    });
    o.code = code; o.updated_at = new Date().toISOString();
    var vals = DRAFT_CAB_.map(function (k) { return o[k] == null ? '' : String(o[k]); });
    if (x.row) sh.getRange(x.row, 1, 1, vals.length).setValues([vals]);
    else { sh.appendRow(vals); sh.getRange(sh.getLastRow(), 1, 1, vals.length).setNumberFormat('@'); }
    return o;
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function draftInfo_(code) { if (!code) return null; var x = draftRead_(draftSheet_(), code); return x.row ? x.o : null; }
function draftClear_(code) {
  var sh = draftSheet_(), x = draftRead_(sh, code);
  if (x.row) sh.deleteRow(x.row);
}
/* La app manda el formulario al pasar cada paso. Las fotos solo viajan la
   primera vez (con _sig); después llegan como fileId. Devuelve sig → fileId. */
function saveDraft_(b) {
  var code = normCode_(b.code || '');
  if (!code) return { ok: false, error: 'code-required' };
  var meta = b.reservation || {}, f = b.form || {}, ids = {}, folder = null;
  var prev = draftInfo_(code) || {};
  function fld() { if (!folder) folder = getOrCreateFolder_(getOrCreateFolder_(DriveApp.getFolderById(CFG_().DRIVE_FOLDER), '_borradores'), code); return folder; }
  function img(d, name) {
    if (!d || !d.dataUrl) { if (d) delete d._sig; return; }
    try { var s = saveDocImage_(fld(), d.dataUrl, 'borrador', code, name, ''); d.fileId = s.id; if (d._sig) ids[d._sig] = s.id; }
    catch (e) { logSend_('borrador', meta, '', false, 'No se pudo guardar la foto del borrador (' + name + '): ' + String(e && e.message || e)); }
    delete d.dataUrl; delete d._sig;
  }
  (f.docs || []).forEach(function (d, i) { img(d, 'huesped-' + (i + 1)); });
  if (f.booker && f.booker.doc) img(f.booker.doc, 'encargado');
  var json = JSON.stringify(f);
  if (json.length > 45000) { logSend_('borrador', meta, '', false, 'Borrador demasiado grande para la hoja (' + json.length + ' caracteres)'); json = ''; }
  draftUpsert_(code, {
    started_at: new Date().toISOString(), step: prev.status === 'enviado' ? '' : String(b.step || ''),
    property_name: meta.propertyName || '', form_json: json, status: prev.status === 'enviado' ? '' : 'en curso'
  });
  return { ok: true, ids: ids };
}
function getDraft_(b) {
  var code = normCode_(b.code || '');
  if (!code) return { ok: false, error: 'code-required' };
  var d = draftInfo_(code);
  if (!d) return { ok: true, draft: null };
  var form = null; try { form = d.form_json ? JSON.parse(d.form_json) : null; } catch (e) {}
  return { ok: true, draft: { code: code, startedAt: d.started_at, updatedAt: d.updated_at, step: d.step, status: d.status,
    submittedAt: d.submitted_at, completedBy: d.completed_by, form: form } };
}
/* Fase 1c: sin sesión, el huésped solo puede pedir las fotos que guardó saveDraft_ en el borrador de SU
   código de reserva (al retomar el registro). Antes getDocImage devolvía cualquier archivo de Drive por su ID. */
function fotoDeSuBorrador_(b) {
  var code = normCode_(b.code || ''), id = String(b.fileId || '');
  if (!code || !id) return false;
  var d = draftInfo_(code), f = null;
  try { f = d && d.form_json ? JSON.parse(d.form_json) : null; } catch (e) {}
  if (!f) return false;
  var ids = (f.docs || []).map(function (x) { return x && x.fileId; });
  if (f.booker && f.booker.doc) ids.push(f.booker.doc.fileId);
  return ids.indexOf(id) >= 0;
}
/* Resumen ligero para el panel (sin el formulario): últimos 120 días. */
function listDrafts_() {
  var sh = draftSheet_(), n = sh.getLastRow(), out = {};
  if (n < 2) return out;
  var lim = Date.now() - 120 * 86400000;
  sh.getRange(2, 1, n - 1, DRAFT_CAB_.length).getValues().forEach(function (v) {
    var o = {}; DRAFT_CAB_.forEach(function (k, i) { o[k] = v[i] instanceof Date ? v[i].toISOString() : String(v[i] == null ? '' : v[i]); });
    if (!o.code || (o.updated_at && new Date(o.updated_at).getTime() < lim)) return;
    out[o.code] = { startedAt: o.started_at, updatedAt: o.updated_at, step: o.step, status: o.status, submittedAt: o.submitted_at, completedBy: o.completed_by, hasForm: !!o.form_json };
  });
  return out;
}

/* ============================================================
   4b · ESTACIONES — propiedades + correos/teléfonos asignados.
   El administrador asigna 2 correos y 2 teléfonos por propiedad;
   a esos correos se envía el formulario completado.
   ============================================================ */
function listStations_() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Estaciones');
  var headers = SCHEMA_['Estaciones'];

  // filas guardadas (por property_name)
  var saved = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues().forEach(function (row) {
      saved[String(row[1])] = {
        propertyId: row[0], propertyName: row[1],
        email1: row[2], email2: row[3], phone1: row[4], phone2: row[5]
      };
    });
  }

  // propiedades desde Hospitable (para listar todas, aunque no tengan asignación)
  var cfg = CFG_();
  var fromApi = [];
  if (cfg.HOSPITABLE_TOKEN) {
    var pRes = hosFetch_('https://public.api.hospitable.com/v2/properties?per_page=100', cfg);
    if (pRes.code === 200) {
      (pRes.json.data || pRes.json.properties || []).forEach(function (p) {
        var nm = p.name || p.public_name || p.private_name || String(p.id);
        fromApi.push({ propertyId: p.id, propertyName: nm });
      });
    }
  }

  // fusiona: toda propiedad de la API + toda propiedad guardada
  var byName = {};
  fromApi.forEach(function (p) { byName[p.propertyName] = Object.assign({ email1: '', email2: '', phone1: '', phone2: '' }, p); });
  Object.keys(saved).forEach(function (nm) { byName[nm] = Object.assign(byName[nm] || { propertyName: nm }, saved[nm]); });

  // rellena con los contactos base de la tabla del código (solo en campos vacíos),
  // para que el panel muestre la info ya cargada aunque no se haya guardado aún.
  Object.keys(byName).forEach(function (nm) {
    var e = byName[nm];
    var cc = codeContactsFor_(nm);
    if (!String(e.email1 || '').trim() && cc.emails[0]) e.email1 = cc.emails[0];
    if (!String(e.email2 || '').trim() && cc.emails[1]) e.email2 = cc.emails[1];
    if (!String(e.phone1 || '').trim() && cc.whatsapps[0]) e.phone1 = cc.whatsapps[0];
    if (!String(e.phone2 || '').trim() && cc.whatsapps[1]) e.phone2 = cc.whatsapps[1];
  });

  return Object.keys(byName).map(function (nm) { return byName[nm]; });
}

function saveStation_(body) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Estaciones');
  var headers = SCHEMA_['Estaciones'];
  var name = body.propertyName || '';
  if (!name) return { ok: false, error: 'propertyName requerido' };
  var row = [ body.propertyId || '', name, body.email1 || '', body.email2 || '', body.phone1 || '', body.phone2 || '', new Date().toISOString() ];

  // upsert por property_name
  var found = 0;
  if (sh.getLastRow() > 1) {
    var names = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) { if (String(names[i][0]) === name) { found = i + 2; break; } }
  }
  if (found) sh.getRange(found, 1, 1, headers.length).setValues([row]);
  else sh.appendRow(row);
  return { ok: true };
}

function stationFor_(propertyName) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Estaciones');
  if (!sh || sh.getLastRow() < 2) return null;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Estaciones'].length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1]) === String(propertyName)) {
      return { email1: rows[i][2], email2: rows[i][3], phone1: rows[i][4], phone2: rows[i][5] };
    }
  }
  return null;
}

/* Título + texto del correo que reciben los encargados al completarse un
   registro. Se comparte entre el envío real y el correo de prueba.
   Título: "Registro de ingreso - [propiedad]". Cuerpo con branding Spacio AM
   e info básica de la reserva. El formulario completo va como PDF adjunto. */
function stationMailContent_(meta, guests) {
  // (guestWelcomeContent_ definido abajo)
  var propId = meta.propertyName || meta.apartment || meta.code || '';
  var subject = 'Registro de ingreso - ' + propId;
  var ci = meta.checkin || '', co = meta.checkout || '';
  var cap = meta.maxCapacity || meta.capacity || meta.reservedGuests || (guests && guests.length) || '';
  var n = nights_(ci, co);
  var text = [
    'Registro de ingreso completado.',
    '',
    'Propiedad: ' + propId,
    'Reserva: ' + (meta.code || ''),
    'Check-in: ' + (ci ? ci + ' · 3:00 PM' : ''),
    'Check-out: ' + (co ? co + ' · 11:00 AM' : ''),
    'Noches: ' + (n || ''),
    'Capacidad: hasta ' + cap,
    'Huéspedes registrados: ' + ((guests && guests.length) || 0),
    '',
    'El formulario completo va adjunto en PDF.',
    '',
    'Spacio AM'
  ].join('\n');
  function mrow(l, v) {
    return '<tr><td style="padding:11px 0;border-bottom:1px solid #EFEDEA;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:1.5px;color:#938B8A;text-transform:uppercase;">' + esc_(l) + '</td>'
      + '<td align="right" style="padding:11px 0;border-bottom:1px solid #EFEDEA;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#3E3F3F;">' + esc_(v) + '</td></tr>';
  }
  var rows = mrow('Reserva', meta.code || '')
    + mrow('Check-in', ci ? ci + ' · 3:00 PM' : '')
    + mrow('Check-out', co ? co + ' · 11:00 AM' : '')
    + mrow('Noches', String(n || ''))
    + mrow('Capacidad', 'hasta ' + cap)
    + mrow('Huéspedes registrados', String((guests && guests.length) || 0));
  var html = '<div style="background:#FAFAFA;margin:0;padding:0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;"><tr><td align="center" style="padding:30px 16px;">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #ECEAE6;border-radius:20px;">'
    + '<tr><td style="padding:34px 40px 0;"><div style="font-family:Georgia,&#39;Times New Roman&#39;,serif;font-size:22px;letter-spacing:5px;color:#3E3F3F;">SPACIO&nbsp;AM</div>'
    + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;letter-spacing:3px;color:#938B8A;margin-top:6px;">HAY ESPACIOS DONDE DESPERTAR SE SIENTE COMO UN SUEÑO</div></td></tr>'
    + '<tr><td style="padding:22px 0 0;"><img src="' + EMAIL_IMG_.manager + '" width="600" alt="" style="display:block;width:100%;height:auto;" /></td></tr>'
    + '<tr><td style="padding:26px 40px 0;"><div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#938B8A;text-transform:uppercase;">Registro de ingreso</div>'
    + '<div style="font-family:Georgia,serif;font-size:27px;line-height:1.15;color:#3E3F3F;margin-top:8px;">' + esc_(propId) + '</div></td></tr>'
    + '<tr><td style="padding:20px 40px 0;"><p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:#3E3F3F;margin:0;">Se completó el registro de huéspedes para esta reserva. El formulario completo va adjunto en PDF.</p></td></tr>'
    + '<tr><td style="padding:20px 40px 6px;"><table width="100%" cellpadding="0" cellspacing="0">' + rows + '</table></td></tr>'
    + '<tr><td style="padding:6px 40px 34px;"><div style="border-top:1px solid #D8D4CE;margin-top:14px;padding-top:16px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1px;color:#938B8A;">hola@spacioam.com&nbsp;&nbsp;·&nbsp;&nbsp;spacioam.com</div></td></tr>'
    + '</table></td></tr></table></div>';
  return { subject: subject, text: text, html: html };
}

/* Imágenes editoriales Spacio AM para correos, alojadas en el repo de GitHub
   (permanencia — no dependen de CDN externos). Colócalas en assets/email/ del
   repo Hola-spacioam. Reutilizables en cualquier correo. */
var EMAIL_IMG_BASE_ = 'https://raw.githubusercontent.com/jforce15-coder/Hola-spacioam/main/assets/email/';
var EMAIL_IMG_ = {
  hero: EMAIL_IMG_BASE_ + 'spacioam-hero.jpg',
  living: EMAIL_IMG_BASE_ + 'spacioam-living.jpg',
  footer: EMAIL_IMG_BASE_ + 'spacioam-footer.jpg',
  goodnews: EMAIL_IMG_BASE_ + 'email-goodnews.jpg',
  luggage: EMAIL_IMG_BASE_ + 'email-luggage.jpg',
  alt: EMAIL_IMG_BASE_ + 'email-alt.jpg',
  invoice: EMAIL_IMG_BASE_ + 'email-invoice.jpg',
  adminAlert: EMAIL_IMG_BASE_ + 'email-admin-alert.jpg',
  manager: EMAIL_IMG_BASE_ + 'email-manager.jpg'
};

/* Plantilla branded reutilizable para cualquier correo Spacio AM.
   o = { eyebrow, heading, image, paras:[], rows:[[label,value]], cta:{label,url},
         footerNote, signoff }  → devuelve { html, text }. */
function emailShell_(o) {
  o = o || {};
  var C1 = '#3E3F3F', C2 = '#938B8A', PEACH = '#E9826A';
  var img = o.image ? ('<tr><td style="padding:0;"><img src="' + o.image + '" width="600" alt="" style="display:block;width:100%;height:auto;" /></td></tr>') : '';
  var eyebrow = o.eyebrow ? ('<div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:' + C2 + ';margin-bottom:10px;">' + esc_(o.eyebrow) + '</div>') : '';
  var heading = o.heading ? ('<div style="font-family:Georgia,serif;font-size:29px;line-height:1.15;color:' + C1 + ';">' + esc_(o.heading) + '</div>') : '';
  var paras = (o.paras || []).map(function (p) {
    return '<p style="font-family:Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.78;color:' + C1 + ';margin:16px 0 0;">' + p + '</p>';
  }).join('');
  var rows = '';
  if (o.rows && o.rows.length) {
    var trs = o.rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<tr><td style="padding:9px 0;border-top:1px solid #E7E3DD;font-family:Helvetica,Arial,sans-serif;font-size:9.5px;letter-spacing:1.5px;color:' + C2 + ';text-transform:uppercase;">' + esc_(r[0]) + '</td>'
        + '<td align="right" style="padding:9px 0;border-top:1px solid #E7E3DD;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;color:' + C1 + ';">' + esc_(r[1]) + '</td></tr>';
    }).join('');
    rows = '<tr><td style="padding:22px 44px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3F0;border-radius:16px;"><tr><td style="padding:16px 24px;"><table width="100%" cellpadding="0" cellspacing="0">' + trs + '</table></td></tr></table></td></tr>';
  }
  var cta = o.cta ? ('<tr><td align="center" style="padding:28px 44px 4px;"><a href="' + o.cta.url + '" style="display:inline-block;background:' + C1 + ';color:#FFFFFF;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;letter-spacing:2px;text-transform:uppercase;padding:16px 40px;border-radius:12px;">' + esc_(o.cta.label) + '</a></td></tr>') : '';
  var note = o.footerNote ? ('<tr><td style="padding:22px 44px 0;"><p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:' + C2 + ';margin:0;text-align:center;">' + esc_(o.footerNote) + '</p></td></tr>') : '';
  var html = '<div style="background:#FAFAFA;margin:0;padding:0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;"><tr><td align="center" style="padding:28px 16px;">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #ECEAE6;border-radius:22px;overflow:hidden;">'
    + '<tr><td align="center" style="padding:32px 40px 20px;"><div style="font-family:Georgia,serif;font-size:22px;letter-spacing:6px;color:' + C1 + ';">SPACIO&nbsp;AM</div>'
    + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:8.5px;letter-spacing:3px;color:' + C2 + ';margin-top:7px;">HAY ESPACIOS DONDE DESPERTAR SE SIENTE COMO UN SUEÑO</div></td></tr>'
    + img
    + '<tr><td style="padding:32px 44px 0;">' + eyebrow + heading + paras + '</td></tr>'
    + rows + cta + note
    + '<tr><td align="center" style="padding:30px 44px 34px;margin-top:24px;"><div style="border-top:1px solid #ECEAE6;padding-top:24px;"><a href="https://spacioam.com" style="text-decoration:none;font-family:Georgia,serif;font-size:14px;letter-spacing:4px;color:' + C1 + ';">SPACIO&nbsp;AM</a>'
    + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1px;color:' + C2 + ';margin-top:10px;line-height:1.7;">' + esc_(o.signoff || 'Con cariño, tu equipo de Spacio AM') + '</div></div></td></tr>'
    + '</table></td></tr></table></div>';
  var textParts = [];
  if (o.heading) textParts.push(o.heading);
  (o.paras || []).forEach(function (p) { textParts.push(String(p).replace(/<[^>]+>/g, '')); });
  (o.rows || []).forEach(function (r) { if (r[1]) textParts.push(r[0] + ': ' + r[1]); });
  if (o.footerNote) textParts.push(o.footerNote);
  textParts.push('', o.signoff || 'Con cariño,\nSpacio AM');
  return { html: html, text: textParts.join('\n\n') };
}

/* Devuelve la info configurada de una propiedad (parqueo, WiFi, instrucciones)
   buscando por nombre exacto y luego sin distinguir mayúsculas/espacios. */
function propInfoFor_(name) {
  try {
    var all = (listPropertyInfo_() || {}).info || {};
    if (all[name]) return all[name];
    var norm = String(name || '').trim().toLowerCase();
    var keys = Object.keys(all);
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i]).trim().toLowerCase() === norm) return all[keys[i]];
    }
  } catch (e) {}
  return {};
}

/* Correo de BIENVENIDA al huésped tras completar el registro. Branding Spacio AM,
   mensaje inspirador, su número de reserva e instrucciones de check-in, parqueo
   y WiFi presentadas de forma ordenada. */
function guestWelcomeContent_(meta) {
  var code = meta.code || '';
  var prop = meta.propertyName || meta.apartment || '';
  var pi = propInfoFor_(prop);
  var std = (pi.std && pi.std.es) || null;
  var arrivalTxt = (std && std.arrivalIntro) ? std.arrivalIntro : String(pi.arrival || '').trim();
  var arrivalSteps = (std && std.arrivalSteps) ? std.arrivalSteps : [];
  var wifiNet = String(pi.wifiNet || '').trim();
  var wifiPass = String(pi.wifiPass || '').trim();
  var wifiNote = (std && std.wifiNote) ? std.wifiNote : '';
  var parkTxt = (std && std.parking) ? std.parking
    : (pi.parkNote ? String(pi.parkNote).trim()
      : (pi.hasParking === 'yes'
          ? ('Cuentas con parqueo asignado' + (pi.parkNumber ? ' · No. ' + pi.parkNumber : '') + '.')
          : (pi.hasParking === 'no'
              ? (String(pi.parkExtInfo || '').trim() || 'Este alojamiento no cuenta con parqueo propio; dentro de «Ver mi espacio» te compartimos las opciones cercanas.')
              : 'Encontrarás la información de parqueo de tu alojamiento dentro de «Ver mi espacio».')));
  var subject = '¡Bienvenido a Spacio AM! ✦ Tu registro está listo';
  var HERO = EMAIL_IMG_.hero, FOOTER = EMAIL_IMG_.footer;
  var text = [
    '¡Gracias por completar tu registro de ingreso! Estamos muy emocionados de recibirte.',
    '',
    'INSTRUCCIONES DE CHECK-IN',
    'Nuestro check-in es a partir de las 3:00 PM.' + (arrivalTxt ? ' ' + arrivalTxt : ''),
    (arrivalSteps.length ? arrivalSteps.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') : ''),
    'El código de ingreso se te enviará por la plataforma, en «Ver mi espacio», el día de tu llegada.',
    '',
    'PARQUEO',
    parkTxt,
    '',
    'WIFI',
    (wifiNet && wifiPass) ? ('Red: ' + wifiNet + '  ·  Contraseña: ' + wifiPass) : 'Encontrarás la red y la contraseña del WiFi dentro de «Ver mi espacio».',
    '',
    'Para ver toda la información de tu estancia o enviar una solicitud especial, ingresa a «Ver mi espacio» con tu número de reserva: ' + code + '. Una vez dentro puedes crear tu propio usuario e invitar a tus acompañantes a ver la misma información.',
    '',
    'Con cariño,',
    'Spacio AM'
  ].join('\n');
  var C1 = '#3E3F3F', C2 = '#938B8A', PEACH = '#E9826A';
  // desglosa "Z1 - Centro Vivo - 1106" en zona / edificio / apartamento
  var parts = String(prop).split(/\s*-\s*/).filter(function (s) { return s !== ''; });
  var zona = parts.length >= 3 ? parts[0] : '';
  var edificio = parts.length >= 3 ? parts[1] : (parts[0] || '');
  var unidad = parts.length >= 3 ? parts.slice(2).join(' - ') : (parts[1] || meta.apartment || '');
  var ci = meta.checkin || '', co = meta.checkout || '';
  function srow(l, v) {
    return v ? ('<tr><td style="padding:9px 0;border-top:1px solid #E7E3DD;font-family:Helvetica,Arial,sans-serif;font-size:9.5px;letter-spacing:1.5px;color:' + C2 + ';text-transform:uppercase;">' + esc_(l) + '</td>'
      + '<td align="right" style="padding:9px 0;border-top:1px solid #E7E3DD;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;color:' + C1 + ';">' + esc_(v) + '</td></tr>') : '';
  }
  // tarjeta de instrucción: eyebrow peach + título serif + cuerpo (html crudo)
  function wcard(eyebrowTxt, titleTxt, bodyHtml) {
    return '<tr><td style="padding:16px 44px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3F0;border-radius:16px;"><tr><td style="padding:20px 24px;">'
      + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:9.5px;letter-spacing:2.5px;text-transform:uppercase;color:' + PEACH + ';">' + esc_(eyebrowTxt) + '</div>'
      + '<div style="font-family:Georgia,serif;font-size:18px;line-height:1.2;color:' + C1 + ';margin-top:6px;">' + esc_(titleTxt) + '</div>'
      + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.72;color:' + C1 + ';margin-top:9px;">' + bodyHtml + '</div>'
      + '</td></tr></table></td></tr>';
  }
  // lista de pasos numerados (badge peach) para el check-in
  function numlist(steps) {
    if (!steps || !steps.length) return '';
    var rows = steps.map(function (s, i) {
      return '<tr><td valign="top" style="padding:5px 11px 0 0;width:24px;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background:' + PEACH + ';color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:11px;">' + (i + 1) + '</span></td>'
        + '<td valign="top" style="padding:6px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:' + C1 + ';">' + esc_(s) + '</td></tr>';
    }).join('');
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 2px;">' + rows + '</table>';
  }
  var html = '<div style="background:#FAFAFA;margin:0;padding:0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;"><tr><td align="center" style="padding:28px 16px;">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #ECEAE6;border-radius:22px;overflow:hidden;">'
    // marca
    + '<tr><td align="center" style="padding:34px 40px 22px;"><div style="font-family:Georgia,serif;font-size:22px;letter-spacing:6px;color:' + C1 + ';">SPACIO&nbsp;AM</div>'
    + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:8.5px;letter-spacing:3px;color:' + C2 + ';margin-top:7px;">HAY ESPACIOS DONDE DESPERTAR SE SIENTE COMO UN SUEÑO</div></td></tr>'
    // hero
    + '<tr><td style="padding:0;"><img src="' + HERO + '" width="600" alt="Spacio AM" style="display:block;width:100%;height:auto;" /></td></tr>'
    // titular
    + '<tr><td style="padding:34px 44px 0;"><div style="font-family:Georgia,serif;font-size:31px;line-height:1.14;color:' + C1 + ';">Te estamos esperando</div>'
    + '<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.78;color:' + C1 + ';margin:18px 0 0;">¡Gracias por completar tu registro de ingreso! Nos emociona recibirte y que vivas un espacio pensado para que te sientas en casa desde el primer momento.</p></td></tr>'
    // resumen de la reserva
    + '<tr><td style="padding:24px 44px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3F0;border-radius:16px;"><tr><td style="padding:22px 24px;">'
    + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:' + C2 + ';">Código de reserva</div>'
    + '<div style="font-family:Georgia,serif;font-size:27px;letter-spacing:3px;color:' + PEACH + ';margin-top:5px;">' + esc_(code) + '</div>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">'
    + srow('Zona / región', zona)
    + srow('Edificio / condominio', edificio)
    + srow('Apartamento', unidad)
    + srow('Check-in', ci ? ci + ' · 3:00 PM' : '')
    + srow('Check-out', co ? co + ' · 11:00 AM' : '')
    + '</table></td></tr></table></td></tr>'
    // instrucciones ordenadas: check-in / parqueo / wifi
    + '<tr><td style="padding:30px 44px 0;"><div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:' + C2 + ';">Antes de tu llegada</div>'
    + '<div style="font-family:Georgia,serif;font-size:23px;line-height:1.18;color:' + C1 + ';margin-top:8px;">Todo listo para recibirte</div></td></tr>'
    + wcard('Check-in', 'Instrucciones de llegada',
        'Nuestro check-in es a partir de las <b>3:00 PM</b>.' + (arrivalTxt ? ' ' + esc_(arrivalTxt) : '')
        + numlist(arrivalSteps)
        + '<div style="margin-top:' + (arrivalSteps.length ? '10px' : '0') + ';">El <b>código de ingreso</b> se te enviará por la plataforma, en «Ver mi espacio», el día de tu llegada.</div>')
    + wcard('Parqueo', 'Dónde estacionar', esc_(parkTxt))
    + wcard('WiFi', 'Conéctate al llegar',
        (wifiNote ? '<div style="margin-bottom:4px;">' + esc_(wifiNote) + '</div>' : '')
        + ((wifiNet && wifiPass)
          ? ('<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">'
              + '<tr><td style="padding:7px 0;border-top:1px solid #E1DCD5;font-size:9.5px;letter-spacing:1.5px;color:' + C2 + ';text-transform:uppercase;">Red</td><td align="right" style="padding:7px 0;border-top:1px solid #E1DCD5;font-size:13.5px;color:' + C1 + ';">' + esc_(wifiNet) + '</td></tr>'
              + '<tr><td style="padding:7px 0;border-top:1px solid #E1DCD5;font-size:9.5px;letter-spacing:1.5px;color:' + C2 + ';text-transform:uppercase;">Contraseña</td><td align="right" style="padding:7px 0;border-top:1px solid #E1DCD5;font-size:13.5px;color:' + C1 + ';">' + esc_(wifiPass) + '</td></tr></table>')
          : 'Encontrarás la red y la contraseña del WiFi dentro de tu espacio, en «Ver mi espacio».'))
    // cuerpo
    + '<tr><td style="padding:26px 44px 0;"><p style="font-family:Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.78;color:' + C1 + ';margin:0;">'
    + 'Para ver <b>toda la información de tu estancia</b> o enviar una <b>solicitud especial</b>, ingresa a <b>«Ver mi espacio»</b> con tu número de reserva. '
    + 'Dentro puedes crear tu propio usuario para ingresar más fácil e invitar a tus acompañantes a ver la misma información.</p></td></tr>'
    // CTA
    + '<tr><td align="center" style="padding:28px 44px 4px;"><a href="https://hola.spacioam.com" style="display:inline-block;background:' + C1 + ';color:#FFFFFF;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;letter-spacing:2px;text-transform:uppercase;padding:16px 40px;border-radius:12px;">Ver mi espacio</a></td></tr>'
    + '<tr><td style="padding:22px 44px 0;"><p style="font-family:Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.7;color:' + C2 + ';margin:0;text-align:center;">¿Alguna duda? Escríbenos por la plataforma o desde la pantalla de instrucciones. Con gusto te apoyamos.</p></td></tr>'
    // franja footer con imagen
    + '<tr><td style="padding:30px 0 0;"><img src="' + FOOTER + '" width="600" alt="" style="display:block;width:100%;height:auto;" /></td></tr>'
    + '<tr><td align="center" style="padding:26px 44px 34px;background:#F5F3F0;"><a href="https://spacioam.com" style="text-decoration:none;font-family:Georgia,serif;font-size:14px;letter-spacing:4px;color:' + C1 + ';">SPACIO&nbsp;AM</a>'
    + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1px;color:' + C2 + ';margin-top:10px;line-height:1.7;">Con cariño, tu equipo de Spacio&nbsp;AM</div></td></tr>'
    + '</table></td></tr></table></div>';
  return { subject: subject, text: text, html: html };
}

/* Capa de sello de agua sobre el documento de identidad en el PDF: la frase
   "Documentación de registro · Spacio AM" repetida en filas diagonales, a baja
   opacidad, para que el dato siga legible pero el documento quede protegido. */
function wmOverlay_() {
  var label = 'DOCUMENTACIÓN DE REGISTRO · SPACIO AM';
  var line = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:2px;color:#3E3F3F;white-space:nowrap;line-height:52px;">'
    + (label + '&nbsp;&nbsp;&nbsp;').repeat(6) + '</div>';
  var rows = '';
  for (var i = 0; i < 16; i++) rows += line;
  return '<div style="position:absolute;top:-30%;left:-30%;width:160%;height:160%;transform:rotate(-30deg);opacity:0.16;overflow:hidden;">' + rows + '</div>';
}

/* PDF del formulario completo — equivale al que genera el botón “descargar”
   del panel: resumen de registro con branding, cada huésped en su propia
   página, documentos embebidos y aceptación de normas. */
function buildRegistrationPdf_(meta, f, guests) {
  try {
    f = f || {}; guests = guests || [];
    var booker = f.booker || {}, contact = f.contact || {};
    var ci = meta.checkin || '', co = meta.checkout || '';
    var cap = meta.maxCapacity || meta.capacity || meta.reservedGuests || guests.length;
    function row(l, v) {
      return '<tr><td style="padding:9px 0;border-bottom:1px solid #EFEDEA;font-size:9px;letter-spacing:1.5px;color:#938B8A;text-transform:uppercase;">' + esc_(l) + '</td>'
        + '<td align="right" style="padding:9px 0;border-bottom:1px solid #EFEDEA;font-size:12.5px;color:#3E3F3F;">' + esc_(v) + '</td></tr>';
    }
    function eyebrow(x) { return '<div style="font-size:10px;letter-spacing:3px;color:#938B8A;text-transform:uppercase;margin:24px 0 10px;">' + esc_(x) + '</div>'; }
    var head = '<div style="font-family:Georgia,serif;font-size:22px;letter-spacing:5px;color:#3E3F3F;">SPACIO&nbsp;AM</div>'
      + '<div style="font-size:9px;letter-spacing:3px;color:#938B8A;margin-top:6px;">RESUMEN DE REGISTRO</div>'
      + '<div style="font-family:Georgia,serif;font-size:26px;line-height:1.15;color:#3E3F3F;margin-top:16px;">' + esc_(meta.propertyName || meta.apartment || '') + '</div>';
    var booking = eyebrow('Reserva') + '<table width="100%" cellpadding="0" cellspacing="0">'
      + row('Código', meta.code || '') + row('Check-in', ci ? ci + ' · 3:00 PM' : '')
      + row('Check-out', co ? co + ' · 11:00 AM' : '') + row('Noches', String(nights_(ci, co) || ''))
      + row('Capacidad', 'hasta ' + cap) + row('Huéspedes registrados', String(guests.length)) + '</table>';
    var who = eyebrow('Reservó') + '<div style="font-size:12.5px;color:#3E3F3F;">'
      + (booker.type === 'third' ? 'Reservado por un tercero / encargado' : 'Reservado por el propio huésped') + '</div>';
    if (booker.type === 'third' && booker.doc) {
      who += '<div style="border:1px solid #D8D4CE;border-radius:12px;padding:14px 16px;margin-top:12px;"><table width="100%" cellpadding="0" cellspacing="0">'
        + row('Nombre', booker.doc.name || '') + row('Identificación', booker.doc.id || '')
        + row('Teléfono', booker.phone || '') + row('Correo', booker.email || '') + '</table>';
      if (booker.doc.docImage) who += '<img src="' + booker.doc.docImage + '" style="max-width:100%;margin-top:12px;border-radius:8px;" />';
      who += '</div>';
    }
    var cont = eyebrow('Contacto') + '<table width="100%" cellpadding="0" cellspacing="0">'
      + row('Correo', contact.email || booker.email || '') + row('Teléfono', contact.phone || booker.phone || '')
      + row('Emergencia', contact.emergency || '') + '</table>';
    var guestPages = guests.map(function (g, i) {
      var docHtml = g.docImage
        ? '<div style="position:relative;display:inline-block;max-width:78%;margin-top:8px;">'
          + '<img src="' + g.docImage + '" style="display:block;width:100%;max-height:560px;height:auto;border-radius:10px;border:1px solid #ECEAE6;" />'
          + wmOverlay_()
          + '</div>'
        : '<div style="border:1px dashed #D8D4CE;border-radius:10px;padding:22px;text-align:center;font-size:11px;color:#938B8A;margin-top:8px;">Sin documento adjunto</div>';
      return '<div style="page-break-before:always;page-break-inside:avoid;padding-top:8px;">'
        + eyebrow('Huésped ' + (i + 1) + (g.main ? ' · principal' : ''))
        + '<table width="100%" cellpadding="0" cellspacing="0">'
        + row('Nombre completo', g.name || '') + row('Número de identificación', g.id || '') + '</table>'
        + '<div style="font-size:9px;letter-spacing:1.5px;color:#938B8A;text-transform:uppercase;margin:16px 0 4px;">Documentos de identidad</div>'
        + '<div style="text-align:center;">' + docHtml + '</div></div>';
    }).join('');
    var rulesAt = f.acceptedRulesAt ? new Date(f.acceptedRulesAt) : null;
    var rules = eyebrow('Normas de convivencia')
      + '<div style="background:#F5F3F0;border-radius:12px;padding:14px 16px;font-size:12px;color:#3E3F3F;line-height:1.6;">Aceptadas al finalizar el registro'
      + (rulesAt ? '<div style="color:#938B8A;margin-top:4px;font-size:11px;">' + Utilities.formatDate(rulesAt, Session.getScriptTimeZone() || 'America/Guatemala', "d/MM/yyyy HH:mm") + '</div>' : '') + '</div>';
    var footer = '<div style="border-top:1px solid #D8D4CE;margin-top:24px;padding-top:14px;font-size:10px;letter-spacing:1px;color:#938B8A;text-align:center;">hola@spacioam.com · spacioam.com</div>';
    var html = '<div style="font-family:Helvetica,Arial,sans-serif;color:#3E3F3F;padding:34px 40px;">'
      + head + booking + who + cont + guestPages + rules + footer + '</div>';
    var blob = Utilities.newBlob(html, 'text/html', 'Registro.html');
    var name = 'Registro-de-ingreso' + (meta.propertyName ? '-' + slug_(meta.propertyName) : '') + '.pdf';
    return blob.getAs('application/pdf').setName(name);
  } catch (e) { return null; }
}

/* ============================================================
   4b-bis · CONTACTOS POR PROPIEDAD (edificio / condominio)
   El match es por SUBcadena contra el nombre de la propiedad de
   Hospitable (que suele venir como "Z1 - Centro vivo - 1106"),
   sin distinguir mayúsculas. Cada propiedad puede tener correo,
   WhatsApp, o ambos. El ADMINISTRADOR SIEMPRE recibe por WhatsApp.
   Si una propiedad no está en la tabla → solo se avisa al admin.
   Los números van en formato internacional sin '+'.
   ============================================================ */
var ADMIN_WHATSAPP_ = '50256909499';
var PROPERTY_CONTACTS_ = [
  { match: 'centro vivo', emails: ['vestibulo.sexta.a@gmail.com'], whatsapps: [] },
  { match: 'narama',      emails: ['naramaaproco12345@gmail.com'], whatsapps: [] },
  { match: 'modra',       emails: ['recepcionmodra@gmail.com'],    whatsapps: [] },
  { match: 'inara',       emails: [],                              whatsapps: ['50230093340'] },
  { match: 'brunelo',     emails: ['admon.brunelo@gmail.com'],     whatsapps: ['50238630735'] },
  { match: 'baldone',     emails: ['recepcionbaldone@gmail.com'],  whatsapps: ['50231289117'] },
  { match: 'fiamene',     emails: ['fiamenerecepcion@gmail.com'],  whatsapps: ['50255114843'] },
  { match: 'casco',       emails: [],                              whatsapps: ['50255334643'] },
  { match: 'coloniales',  emails: [],                              whatsapps: ['50242179852'] },
  { match: 'airali',      emails: ['recepcionairali@gmail.com'],   whatsapps: ['50223111818'] },
  { match: 'ignacio',     emails: [],                              whatsapps: ['50256293988'] },
  { match: 'monterrico',  emails: [],                              whatsapps: ['50258561222'] },
  { match: 'eon',         emails: ['recepcion@eon.com.gt'],        whatsapps: ['50255362790'] }
];

/* Contactos SOLO de la tabla del código (sin hoja, sin admin), usados para
   pre-rellenar el panel y como base del ruteo. */
function codeContactsFor_(name) {
  var n = String(name || '').toLowerCase();
  var emails = [], was = [];
  PROPERTY_CONTACTS_.forEach(function (p) {
    if (p.match && n.indexOf(p.match) !== -1) {
      emails = emails.concat(p.emails || []);
      was = was.concat(p.whatsapps || []);
    }
  });
  return { emails: uniq_(emails), whatsapps: uniq_(was.map(function (s) { return String(s).replace(/[^\d]/g, ''); }).filter(function (s) { return s.length >= 8; })) };
}

/* Devuelve { emails:[], whatsapps:[] } para una propiedad. Combina la tabla
   anterior con lo que haya en la pestaña Estaciones (por si se edita desde el
   panel) y agrega SIEMPRE el WhatsApp del administrador. */
function contactsFor_(name) {
  var n = String(name || '').toLowerCase();
  var emails = [], was = [];
  PROPERTY_CONTACTS_.forEach(function (p) {
    if (p.match && n.indexOf(p.match) !== -1) {
      emails = emails.concat(p.emails || []);
      was = was.concat(p.whatsapps || []);
    }
  });
  try {
    var st = stationFor_(name);
    if (st) {
      [st.email1, st.email2].forEach(function (e) { if (e && String(e).trim()) emails.push(String(e).trim()); });
      [st.phone1, st.phone2].forEach(function (ph) { var d = String(ph || '').replace(/[^\d]/g, ''); if (d.length >= 8) was.push(d); });
    }
  } catch (e) {}
  was.push(ADMIN_WHATSAPP_); // el administrador siempre recibe por WhatsApp
  return { emails: uniq_(emails), whatsapps: uniq_(was.map(function (s) { return String(s).replace(/[^\d]/g, ''); }).filter(function (s) { return s.length >= 8; })) };
}

/* Resumen para el panel: la lista completa de WhatsApp internos (tabla del
   código + teléfonos editados en el panel/Estaciones, sin el administrador)
   para copiar al agente de ElevenLabs, más los contactos editados por
   propiedad. */
function adminContactsInfo_() {
  var set = {};
  PROPERTY_CONTACTS_.forEach(function (p) { (p.whatsapps || []).forEach(function (w) { set[w] = 1; }); });
  var props = [];
  try {
    var st = listStations_() || [];
    st.forEach(function (s) {
      var was = [];
      [s.phone1, s.phone2].forEach(function (ph) { var d = String(ph || '').replace(/[^\d]/g, ''); if (d.length >= 8) { was.push(d); set[d] = 1; } });
      var ems = [s.email1, s.email2].filter(function (e) { return e && String(e).trim(); });
      if (was.length || ems.length) props.push({ name: s.propertyName || '', emails: ems, whatsapps: was });
    });
  } catch (e) {}
  delete set[ADMIN_WHATSAPP_];
  return { ok: true, numbers: Object.keys(set), admin: ADMIN_WHATSAPP_, properties: props };
}

/* Envía el formulario completado (PDF) a los correos de la propiedad. */
function notifyStation_(meta, guests, pdf, emails) {
  var to = uniq_(emails || []).join(',');
  if (!to) { logSend_('email', meta, '', false, 'La propiedad no tiene correo configurado'); return { ok: false, error: 'sin-correo' }; }
  var c = stationMailContent_(meta, guests);
  var ok = false, detail = '';
  try { ok = sendMail_(to, c.subject, c.text, c.html, pdf ? [pdf] : null); }
  catch (e) { detail = String(e); }
  if (!ok && !detail) detail = 'GmailApp/MailApp devolvió false (revisa cuota o alias remitente)';
  logSend_('email', meta, to, ok, ok ? (pdf ? 'Enviado con PDF' : 'Enviado (sin PDF adjunto)') : detail);
  return { ok: ok, to: to, error: ok ? '' : detail };
}

/* ============================================================
   4c · WHATSAPP CLOUD API — envía el formulario (PDF) a números
   individuales. Meta NO permite enviar a grupos vía API, así que
   se envía a cada número de WHATSAPP_TO (2 o más).
   Requiere: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TO y una
   plantilla aprobada con encabezado de tipo DOCUMENTO.
   ============================================================ */

/* Sube el PDF al endpoint de media y devuelve el media id (reutilizable
   para todos los destinatarios en la misma llamada). */
function waUploadMedia_(pdf) {
  var cfg = CFG_();
  if (!cfg.WHATSAPP_TOKEN || !cfg.WHATSAPP_PHONE_ID || !pdf) return { id: '', error: 'sin token/phone_id/pdf' };
  var url = 'https://graph.facebook.com/' + cfg.WHATSAPP_API_VER + '/' + cfg.WHATSAPP_PHONE_ID + '/media';
  var blob = pdf.getAs ? pdf.getAs('application/pdf') : pdf;
  blob.setName(pdf.getName ? (pdf.getName() || 'Registro.pdf') : 'Registro.pdf');
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    headers: { 'Authorization': 'Bearer ' + cfg.WHATSAPP_TOKEN },
    payload: {
      messaging_product: 'whatsapp',
      type: 'application/pdf',
      file: blob
    }
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code < 200 || code >= 300) return { id: '', error: 'HTTP ' + code + ' · ' + String(body).slice(0, 400) };
  try { var j = JSON.parse(body); return j.id ? { id: j.id } : { id: '', error: 'sin media id · ' + String(body).slice(0, 300) }; }
  catch (e) { return { id: '', error: 'respuesta no-JSON · ' + String(body).slice(0, 300) }; }
}

/* Envía la plantilla con el PDF como encabezado a un número. */
function waSendDocTemplate_(to, mediaId, filename, bodyParams) {
  var cfg = CFG_();
  var url = 'https://graph.facebook.com/' + cfg.WHATSAPP_API_VER + '/' + cfg.WHATSAPP_PHONE_ID + '/messages';
  var components = [{
    type: 'header',
    parameters: [{ type: 'document', document: { id: mediaId, filename: filename || 'Registro.pdf' } }]
  }];
  if (bodyParams && bodyParams.length) {
    components.push({ type: 'body', parameters: bodyParams.map(function (v) { return { type: 'text', text: String(v == null ? '' : v) }; }) });
  }
  var payload = {
    messaging_product: 'whatsapp',
    to: String(to).replace(/[^\d]/g, ''),
    type: 'template',
    template: { name: cfg.WHATSAPP_TEMPLATE, language: { code: cfg.WHATSAPP_LANG }, components: components }
  };
  var res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'Authorization': 'Bearer ' + cfg.WHATSAPP_TOKEN },
    payload: JSON.stringify(payload)
  });
  var code = res.getResponseCode();
  var txt = res.getContentText();
  return { ok: code >= 200 && code < 300, code: code, body: txt };
}

/* Lista de números destino (WHATSAPP_TO), limpios y en formato internacional. */
function waRecipients_() {
  return String(CFG_().WHATSAPP_TO || '').split(/[,\s;]+/)
    .map(function (s) { return s.replace(/[^\d]/g, ''); })
    .filter(function (s) { return s.length >= 8; });
}

/* Desde oct 2026 el WhatsApp a recepción lo manda ALMA (Hub), con su número y su token: aquí solo se le avisa el
   código. ALMA pide el PDF con la llave del robot (regPdfRobot) y lo envía a los números de esta propiedad.
   Para volver al envío anterior desde este script: propiedad WA_VIA_ALMA = 0. */
var HUB_ALMA_URL_ = 'https://script.google.com/macros/s/AKfycbzTdkEpRPgnwaUIHWbQmrysPEqGYqTqDKYwMaQlnun-OT7B2hIa6KdSNS-aedWN-I0cZQ/exec';
function avisarAlmaRecepcion_(meta, force) {
  var code = (meta && meta.code) || '';
  try {
    var r = UrlFetchApp.fetch(PropertiesService.getScriptProperties().getProperty('HUB_ALMA_URL') || HUB_ALMA_URL_, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ recepcion: 1, code: code, force: !!force }) });
    var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
    var ok = !!j.ok;
    logSend_('whatsapp', meta, 'ALMA', ok, ok ? (j.ya ? 'ALMA ya lo había enviado' : 'En cola de ALMA para enviar por WhatsApp a recepción') : ('ALMA no lo recibió · ' + (j.error || ('HTTP ' + r.getResponseCode()))));
    return { ok: ok, viaAlma: true, error: ok ? '' : (j.error || 'alma') };
  } catch (e) { logSend_('whatsapp', meta, 'ALMA', false, 'ALMA no respondió · ' + e); return { ok: false, viaAlma: true, error: String(e) }; }
}
/* ALMA pide el PDF del registro (solo con la llave del robot) y los números de recepción de la propiedad. */
function regPdfRobot_(body) {
  var t = String(body.robot || ''), h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  if (!t || h !== SES_ROBOT_HASH_) return { ok: false, error: 'token' };
  var code = body.code || '';
  var reg = getRegistration_({ code: code });
  if (!reg || !reg.ok) return { ok: false, error: 'registro-no-encontrado' };
  var rec = reg.record, meta = metaForCode_(code), guests = conImagenesDoc_(rec.guests || []);
  /* La hoja guarda las fechas como fecha (no texto): se pasan a AAAA-MM-DD para el resumen y las noches. */
  var ymd = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'America/Guatemala', 'yyyy-MM-dd') : String(v || '').slice(0, 10); };
  meta = Object.assign({}, meta, { checkin: ymd(meta.checkin), checkout: ymd(meta.checkout) });
  var pdf = buildRegistrationPdf_(meta, { booker: rec.booker, contact: rec.contact, guests: guests, acceptedRulesAt: rec.acceptedRulesAt }, guests);
  if (!pdf) return { ok: false, error: 'sin-pdf' };
  var blob = pdf.getAs ? pdf.getAs('application/pdf') : pdf;
  var main = guests.filter(function (g) { return g && g.main; })[0] || guests[0] || {};
  var principal = main.name || (rec.booker && rec.booker.doc && rec.booker.doc.name) || '';
  var noches = '';
  try { var a = String(meta.checkin || '').slice(0, 10), b = String(meta.checkout || '').slice(0, 10); if (a && b) noches = Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); } catch (e) {}
  var nums = contactsFor_(meta.propertyName || '').whatsapps;
  return { ok: true, pdfB64: Utilities.base64Encode(blob.getBytes()), filename: (pdf.getName && pdf.getName()) || ('Registro-' + code + '.pdf'), whatsapps: nums,
    meta: { propiedad: meta.propertyName || meta.apartment || code, principal: principal, ingreso: fechaCortaEs_(meta.checkin) + ' · 3:00 PM', salida: fechaCortaEs_(meta.checkout) + ' · 11:00 AM',
      noches: noches, huespedes: guests.length } };
}

/* Envía el PDF del formulario por WhatsApp a los números dados. */
function notifyWhatsApp_(meta, guests, pdf, numbers, force) {
  if (PropertiesService.getScriptProperties().getProperty('WA_VIA_ALMA') !== '0') return avisarAlmaRecepcion_(meta, force);
  var cfg = CFG_();
  if (!cfg.WHATSAPP_TOKEN || !cfg.WHATSAPP_PHONE_ID) { logSend_('whatsapp', meta, '', false, 'WhatsApp no configurado (falta WHATSAPP_TOKEN / WHATSAPP_PHONE_ID)'); return { ok: false, error: 'wa-no-configurado' }; }
  var nums = uniq_((numbers || []).map(function (s) { return String(s).replace(/[^\d]/g, ''); }).filter(function (s) { return s.length >= 8; }));
  if (!nums.length) { logSend_('whatsapp', meta, '', false, 'Sin números destino'); return { ok: false, error: 'sin-numeros' }; }
  if (!pdf) { logSend_('whatsapp', meta, nums.join(','), false, 'No se pudo generar el PDF del formulario'); return { ok: false, error: 'sin-pdf' }; }
  var up = waUploadMedia_(pdf);
  var mediaId = up.id;
  if (!mediaId) { logSend_('whatsapp', meta, nums.join(','), false, 'Subida del PDF a WhatsApp falló · ' + (up.error || 'sin detalle')); return { ok: false, error: 'media-fallo', detail: up.error }; }
  var params = [
    meta.propertyName || meta.apartment || meta.code || '',
    meta.code || '',
    fechaCortaEs_(meta.checkin) + ' · 3:00 PM',
    fechaCortaEs_(meta.checkout) + ' · 11:00 AM',
    String((guests && guests.length) || 0)
  ];
  var results = nums.map(function (n) {
    var r = waSendDocTemplate_(n, mediaId, pdf.getName(), params);
    logSend_('whatsapp', meta, n, r.ok, r.ok ? 'Enviado' : ('HTTP ' + r.code + ' · ' + waHint_(r.body) + String(r.body || '').slice(0, 300)));
    return { to: n, ok: r.ok, code: r.code };
  });
  return { ok: results.every(function (r) { return r.ok; }), results: results };
}

function fechaCortaEs_(ymd) {
  var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(ymd || '');
  return Number(m[3]) + ' ' + ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][Number(m[2]) - 1] + ' ' + m[1];
}
/* Traduce los errores de Meta más comunes a la acción que hay que tomar. */
function waHint_(body) {
  var s = String(body || '');
  if (/132001|template name does not exist|132000/.test(s)) return 'La plantilla "' + CFG_().WHATSAPP_TEMPLATE + '" no existe o no está aprobada en este idioma: ejecuta crearPlantillaRegistro() y espera la aprobación · ';
  if (/132012|parameter format|132000/.test(s)) return 'La plantilla no coincide (debe tener encabezado DOCUMENTO y 5 variables) · ';
  if (/131030|not in allowed list/.test(s)) return 'El número de WhatsApp aún es de prueba: agrega el destinatario en Meta o usa el número de producción · ';
  if (/190|access token|OAuth/i.test(s)) return 'Token de WhatsApp vencido o inválido: usa el token permanente (el mismo de ALMA) · ';
  if (/131026|undeliverable/.test(s)) return 'El número destino no tiene WhatsApp · ';
  return '';
}

/* ============================================================
   4d · CONFIGURAR EL ENVÍO POR WHATSAPP (ejecutar desde el editor)
   Usa la MISMA cuenta de WhatsApp Business que ALMA. En Propiedades del
   script de ESTE proyecto agrega:
     WHATSAPP_TOKEN    = el valor de WA_TOKEN de ALMA (token permanente)
     WHATSAPP_PHONE_ID = el valor de WA_PHONE_ID de ALMA
     WHATSAPP_WABA_ID  = el valor de WA_WABA_ID de ALMA
     WHATSAPP_APP_ID   = (opcional) ID de la app de Meta, si crearPlantillaRegistro() no lo encuentra solo
   Luego:
     1) crearPlantillaRegistro()  → envía la plantilla "registro_ingreso" a aprobación de Meta.
     2) probarWhatsAppRegistro()  → muestra el estado de la plantilla y, si está aprobada,
                                    manda un registro de prueba al WhatsApp del administrador.
   Desde ese momento cada formulario enviado llega solo, por WhatsApp, a la
   administración del edificio (números de la tabla de contactos o de Estaciones).
   ============================================================ */
function waGraph_() { return 'https://graph.facebook.com/' + CFG_().WHATSAPP_API_VER; }
function waTemplateStatus_() {
  var cfg = CFG_(), waba = PropertiesService.getScriptProperties().getProperty('WHATSAPP_WABA_ID');
  if (!cfg.WHATSAPP_TOKEN || !waba) return { error: 'Faltan WHATSAPP_TOKEN o WHATSAPP_WABA_ID' };
  var r = UrlFetchApp.fetch(waGraph_() + '/' + waba + '/message_templates?name=' + encodeURIComponent(cfg.WHATSAPP_TEMPLATE) + '&fields=name,status,language,rejected_reason',
    { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + cfg.WHATSAPP_TOKEN } });
  var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (r.getResponseCode() >= 300) return { error: 'HTTP ' + r.getResponseCode() + ' · ' + r.getContentText().slice(0, 300) };
  var t = (j.data || []).filter(function (x) { return x.name === cfg.WHATSAPP_TEMPLATE && String(x.language || '').indexOf(cfg.WHATSAPP_LANG) === 0; })[0];
  return t ? { status: t.status, language: t.language, rejected: t.rejected_reason || '' } : { status: '' };
}
function samplePdf_() {
  var html = '<html><body style="font-family:Arial;padding:40px"><h2>Spacio AM · Registro de ingreso</h2><p>Propiedad: Zona 10 · Ejemplo</p><p>Reserva: HMEJEMPLO</p><p>Huéspedes: 2</p></body></html>';
  var b = Utilities.newBlob(html, 'text/html', 'registro-ejemplo.html').getAs('application/pdf');
  b.setName('Registro-ejemplo.pdf');
  return b;
}
function crearPlantillaRegistro() {
  var cfg = CFG_(), p = PropertiesService.getScriptProperties(), tok = cfg.WHATSAPP_TOKEN, waba = p.getProperty('WHATSAPP_WABA_ID');
  if (!tok || !waba) throw new Error('Agrega WHATSAPP_TOKEN y WHATSAPP_WABA_ID en Propiedades del script (los mismos valores de ALMA: WA_TOKEN y WA_WABA_ID).');
  var ex = waTemplateStatus_();
  if (ex.status) { Logger.log('La plantilla "' + cfg.WHATSAPP_TEMPLATE + '" ya existe · estado: ' + ex.status + (ex.rejected ? ' · motivo: ' + ex.rejected : '')); return ex; }
  // PDF de ejemplo → handle (Meta lo exige para plantillas con encabezado de documento)
  var appId = p.getProperty('WHATSAPP_APP_ID') || '';
  if (!appId) { try { appId = JSON.parse(UrlFetchApp.fetch(waGraph_() + '/app', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok } }).getContentText()).id || ''; } catch (e) {} }
  if (!appId) throw new Error('No encontré el ID de la app de Meta. Agrégalo como WHATSAPP_APP_ID (developers.facebook.com → tu app → Configuración básica).');
  var bytes = samplePdf_().getBytes();
  var ses = JSON.parse(UrlFetchApp.fetch(waGraph_() + '/' + appId + '/uploads?file_name=registro-ejemplo.pdf&file_length=' + bytes.length + '&file_type=application/pdf',
    { method: 'post', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok } }).getContentText() || '{}');
  if (!ses.id) throw new Error('Meta no abrió la subida del ejemplo: ' + JSON.stringify(ses));
  var up = JSON.parse(UrlFetchApp.fetch(waGraph_() + '/' + ses.id, { method: 'post', muteHttpExceptions: true, contentType: 'application/pdf',
    headers: { Authorization: 'OAuth ' + tok, file_offset: '0' }, payload: bytes }).getContentText() || '{}');
  if (!up.h) throw new Error('Meta no aceptó el PDF de ejemplo: ' + JSON.stringify(up));
  var body = {
    name: cfg.WHATSAPP_TEMPLATE, language: cfg.WHATSAPP_LANG, category: 'UTILITY',
    components: [
      { type: 'HEADER', format: 'DOCUMENT', example: { header_handle: [up.h] } },
      { type: 'BODY', text: 'Nuevo registro de ingreso de Spacio AM.\n\nPropiedad: {{1}}\nReserva: {{2}}\nIngreso: {{3}}\nSalida: {{4}}\nHuéspedes: {{5}}\n\nAdjuntamos el formulario con los datos y documentos de identificación. Gracias por su apoyo.',
        example: { body_text: [['Zona 10 · Airali 1508', 'HMEJEMPLO', '14 ago 2026 · 3:00 PM', '16 ago 2026 · 11:00 AM', '2']] } },
      { type: 'FOOTER', text: 'Spacio AM · hola.spacioam.com' }
    ]
  };
  var r = UrlFetchApp.fetch(waGraph_() + '/' + waba + '/message_templates', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + tok }, payload: JSON.stringify(body) });
  Logger.log('Plantilla enviada a revisión · HTTP ' + r.getResponseCode() + ' · ' + r.getContentText());
  return { http: r.getResponseCode(), body: r.getContentText() };
}
function probarWhatsAppRegistro(numero) {
  var cfg = CFG_();
  if (!cfg.WHATSAPP_TOKEN || !cfg.WHATSAPP_PHONE_ID) { Logger.log('Faltan WHATSAPP_TOKEN / WHATSAPP_PHONE_ID en Propiedades del script.'); return; }
  var st = waTemplateStatus_();
  Logger.log('Plantilla "' + cfg.WHATSAPP_TEMPLATE + '": ' + (st.error || st.status || 'NO EXISTE · ejecuta crearPlantillaRegistro()') + (st.rejected ? ' · motivo: ' + st.rejected : ''));
  if (st.status && st.status !== 'APPROVED') { Logger.log('Aún no está aprobada: espera la aprobación de Meta y vuelve a probar.'); return; }
  var r = notifyWhatsApp_({ code: 'PRUEBA', propertyName: 'Prueba · Spacio AM', checkin: Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd'), checkout: Utilities.formatDate(new Date(Date.now() + 2 * 86400000), 'America/Guatemala', 'yyyy-MM-dd') },
    [{ name: 'Huésped de prueba' }, { name: 'Acompañante' }], samplePdf_(), [numero || ADMIN_WHATSAPP_]);
  Logger.log('Resultado: ' + JSON.stringify(r) + ' · el detalle queda en la pestaña de envíos.');
  return r;
}

/* ============================================================
   5 · USUARIOS — crear cuenta / login (contraseña hasheada)
   ============================================================ */
function createAccount_(body) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Usuarios');
  var email = (body.email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'email requerido' };
  var codes = (body.reservationCodes || []).join(', ');
  var hash = body.password ? sha256_(body.password) : '';
  sh.appendRow([ new Date().toISOString(), email, codes, hash, body.role || 'guest', body.sharedBy || '' ]);
  // invitados compartidos (sin contraseña aún) → correo de invitación
  var appUrl = CFG_().APP_URL || '';
  var firstCode = ((body.reservationCodes || [])[0] || '').toString();
  (body.sharedEmails || []).forEach(function (se) {
    if (se && se.trim()) {
      var addr = se.trim().toLowerCase();
      sh.appendRow([ new Date().toISOString(), addr, codes, '', 'shared', email ]);
      // el link lleva el CÓDIGO de la reserva + el correo → la app abre la
      // creación de contraseña ya sincronizada con esa reserva.
      var link = appUrl ? (appUrl + '#invite=' + encodeURIComponent(firstCode) + '&email=' + encodeURIComponent(addr)) : '(enlace de la app)';
      sendMail_(addr, 'Te compartieron acceso a un espacio · Spacio AM',
        'Hola,\n\n' + (email || 'Un huésped') + ' te compartió acceso a la información de su estancia en Spacio AM.\n\n'
        + 'Para entrar, crea tu contraseña aquí:\n' + link + '\n'
        + 'Tu usuario será este correo (' + addr + ').\n\n'
        + 'Reserva: ' + firstCode + '\n\nSpacio AM');
    }
  });
  return { ok: true };
}

function login_(body) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Usuarios');
  var email = (body.email || '').trim().toLowerCase();
  var hash = body.password ? sha256_(body.password) : '';
  if (sh.getLastRow() < 2) return { ok: false, error: 'sin usuarios' };
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Usuarios'].length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][1] === email && rows[i][3] === hash && hash) {
      return { ok: true, email: email, reservationCodes: String(rows[i][2]).split(/,\s*/).filter(String), role: rows[i][4] };
    }
  }
  return { ok: false, error: 'credenciales inválidas' };
}

/* ============================================================
   6 · BORRADO AUTOMÁTICO — 3 meses después del check-out
   Trigger diario. Recorre "Documentos", envía a papelera los
   archivos vencidos y los marca como deleted.
   ============================================================ */
function ensurePurgeTrigger_() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'purgeExpiredDocuments';
  });
  if (!exists) {
    ScriptApp.newTrigger('purgeExpiredDocuments').timeBased().everyDays(1).atHour(3).create();
  }
}

function purgeExpiredDocuments() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Documentos');
  if (!sh || sh.getLastRow() < 2) return;
  var headers = SCHEMA_['Documentos'];
  var rng = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length);
  var rows = rng.getValues();
  var now = new Date();
  var minAgeMs = (CFG_().RETENTION_MONTHS || 3) * 30 * 86400000;
  var changed = false;
  for (var i = 0; i < rows.length; i++) {
    var deleteAt = rows[i][8], deleted = rows[i][9], fileId = rows[i][7];
    var up = rows[i][0] ? new Date(rows[i][0]) : null;
    // solo se borra si el documento tiene MÁS de 3 meses de antigüedad
    var oldEnough = up && !isNaN(up) && (now - up) >= minAgeMs;
    if (!deleted && oldEnough && deleteAt && new Date(deleteAt) <= now) {
      try { if (fileId) DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
      rows[i][9] = true; changed = true;
    }
  }
  if (changed) rng.setValues(rows);
}

/* ---------- helpers ---------- */
function nowISO_() { return new Date().toISOString(); }
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function nights_(ci, co) {
  try { var a = new Date(ci), b = new Date(co); var n = Math.round((b - a) / 86400000); return (n > 0 && isFinite(n)) ? n : ''; }
  catch (e) { return ''; }
}
function uniq_(arr) {
  var seen = {}, out = [];
  (arr || []).forEach(function (x) { var k = String(x || '').trim(); if (k && !seen[k]) { seen[k] = 1; out.push(k); } });
  return out;
}

/* ---------- OPCIÓN A: foto automática por propiedad (og:image) ---------- */
/* Resuelve y CACHEA la foto de una propiedad. Orden:
   1) foto ya guardada en la pestaña "Fotos" (persistente) → se reutiliza.
   2) URL pública del anuncio (Airbnb/Booking) desde los datos de Hospitable →
      se scrapea el og:image y se guarda.
   3) "" si no hay forma (el cliente cae a la foto genérica).  */
function resolvePropertyPhoto_(name, rv, propMap) {
  if (!name) return '';
  var stored = storedPhoto_(name);
  if (stored && stored.photo) return stored.photo;

  var prop = (rv && rv._prop) || null;
  // busca la propiedad en el mapa por nombre si no viene en rv
  if (!prop && propMap) {
    for (var k in propMap) { var p = propMap[k];
      var nm = (p.name || p.public_name || p.private_name || '').toString().trim().toLowerCase();
      if (nm && nm === name.toLowerCase()) { prop = p; break; }
    }
  }
  var listingUrl = listingPublicUrl_(prop, rv);
  var photo = '';
  if (listingUrl) {
    var r = listingPhoto_({ url: listingUrl });
    if (r && r.ok && r.image) photo = r.image;
  }
  // guarda SIEMPRE una fila (aunque sea vacía) para no reintentar en cada sync
  savePhotoRow_(name, photo, listingUrl);
  return photo;
}

function storedPhoto_(name) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Fotos');
  if (!sh || sh.getLastRow() < 2) return null;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  var n = name.toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === n) return { photo: rows[i][1] || '', listing: rows[i][2] || '' };
  }
  return null;
}
function savePhotoRow_(name, photo, listing) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Fotos') || ss.insertSheet('Fotos');
  if (sh.getLastRow() === 0) sh.appendRow(SCHEMA_['Fotos']);
  var found = 0;
  if (sh.getLastRow() > 1) {
    var names = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) { if (String(names[i][0]).toLowerCase() === name.toLowerCase()) { found = i + 2; break; } }
  }
  var row = [name, photo || '', listing || '', nowISO_()];
  if (found) sh.getRange(found, 1, 1, 4).setValues([row]);
  else sh.appendRow(row);
}

/* Extrae la URL pública del anuncio (Airbnb/Booking/etc.) de los datos de
   Hospitable. Rutas defensivas — distintas cuentas la exponen distinto. */
function listingPublicUrl_(prop, rv) {
  function scan(o) {
    if (!o || typeof o !== 'object') return '';
    var direct = o.public_url || o.listing_url || o.url || o.airbnb_url || o.booking_url || o.channel_url;
    if (typeof direct === 'string' && /^https?:\/\//.test(direct) && /airbnb|booking|vrbo|expedia|\/rooms\//i.test(direct)) return direct;
    var arrs = [o.listings, o.channels, o.channel_listings, o.integrations];
    for (var a = 0; a < arrs.length; a++) {
      var arr = arrs[a];
      if (Array.isArray(arr)) {
        for (var i = 0; i < arr.length; i++) {
          var u = (arr[i] && (arr[i].url || arr[i].public_url || arr[i].listing_url || arr[i].link)) || '';
          if (typeof u === 'string' && /^https?:\/\//.test(u) && /airbnb|booking|vrbo|expedia|\/rooms\//i.test(u)) return u;
        }
      }
    }
    return '';
  }
  var fromProp = scan(prop);
  if (fromProp) return fromProp;
  // fetch property detail with includes, por si la URL viene ahí
  try {
    var id = prop && prop.id;
    if (id) {
      var res = hosFetch_('https://public.api.hospitable.com/v2/properties/' + encodeURIComponent(id) + '?include=listings,channels', CFG_());
      if (res.code === 200) {
        var d = (res.json && (res.json.data || res.json.property || res.json)) || {};
        return scan(d);
      }
    }
  } catch (e) {}
  return '';
}

/* Foto del alojamiento — baja el HTML del anuncio (Airbnb/Booking) con un
   User-Agent de navegador y toma el og:image (alta resolución, ~1200px).
   Devuelve la URL REMOTA tal cual (sin base64), para carga a resolución completa. */
function listingPhoto_(body) {
  var url = String(body.url || '').trim();
  if (!/^https?:\/\//.test(url)) return { ok: false, error: 'url-invalida' };
  try {
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true, followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' }
    });
    if (res.getResponseCode() !== 200) return { ok: false, error: 'http-' + res.getResponseCode() };
    var html = res.getContentText();
    var img = metaContent_(html, 'og:image') || metaContent_(html, 'twitter:image') || firstImgSrc_(html);
    if (!img) return { ok: false, error: 'sin-imagen' };
    if (img.indexOf('//') === 0) img = 'https:' + img;
    img = img.replace(/im_w=\d+/i, 'im_w=1200').replace(/_(small|medium|thumb)\b/i, '_large');
    return { ok: true, image: img };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
function metaContent_(html, prop) {
  var re = new RegExp('<meta[^>]+(?:property|name)=["\\\']' + prop.replace(':', '\\:') + '["\\\'][^>]*>', 'i');
  var tag = (html.match(re) || [])[0];
  if (!tag) return '';
  var m = tag.match(/content=["\']([^"\']+)["\']/i);
  return m ? m[1] : '';
}
function firstImgSrc_(html) {
  var m = html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
  return m ? m[1] : '';
}

/* Amenidades del anuncio de Hospitable (por nombre de propiedad).
   Devuelve una lista de strings; vacío si no se puede obtener. */
function listingAmenities_(body) {
  var cfg = CFG_();
  if (!cfg.HOSPITABLE_TOKEN) return { ok: true, amenities: [] };
  var name = String(body.propertyName || '').trim();
  var id = propertyIdByName_(name);
  if (!id) return { ok: true, amenities: [] };
  // intenta el detalle de la propiedad (incluye amenities en varias cuentas)
  var res = hosFetch_('https://public.api.hospitable.com/v2/properties/' + encodeURIComponent(id) + '?include=amenities', cfg);
  if (res.code !== 200) res = hosFetch_('https://public.api.hospitable.com/v2/properties/' + encodeURIComponent(id), cfg);
  if (res.code !== 200) return { ok: true, amenities: [] };
  var p = (res.json && (res.json.data || res.json.property || res.json)) || {};
  var raw = p.amenities || p.amenity_list || (p.attributes && p.attributes.amenities) || [];
  var out = [];
  (raw || []).forEach(function (a) {
    var label = (typeof a === 'string') ? a : (a && (a.name || a.label || a.title || a.type));
    if (label) out.push(prettyAmenity_(String(label)));
  });
  // dedupe + limita a las más relevantes
  var seen = {}, list = [];
  out.forEach(function (x) { var k = x.toLowerCase(); if (!seen[k]) { seen[k] = 1; list.push(x); } });
  return { ok: true, amenities: list.slice(0, 24) };
}
function prettyAmenity_(s) {
  s = s.replace(/[_\-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ============================================================
   FLEX: disponibilidad de noche adicional + early check-in auto
   ------------------------------------------------------------
   Regla noche adicional:
   · CHECK-IN  → NO disponible si hay un checkout el mismo día del check-in
   · CHECKOUT  → NO disponible si hay un check-in el mismo día del checkout
   Se evalúa contra la caché de la pestaña Reservas (misma propiedad).
   ============================================================ */
function flexAvailability_(body) {
  var code = normCode_(body.code || '');
  var propName = String(body.propertyName || '').trim();
  var checkin = String(body.checkin || '').slice(0, 10);
  var checkout = String(body.checkout || '').slice(0, 10);
  var rows = listCached_();
  var pn = propName.toLowerCase();
  var sameProp = rows.filter(function (r) {
    return String(r.propertyName || '').trim().toLowerCase() === pn && normCode_(r.code) !== code;
  });
  var checkoutOnCheckin = sameProp.some(function (r) { return String(r.checkout || '').slice(0, 10) === checkin; });
  var checkinOnCheckout = sameProp.some(function (r) { return String(r.checkin || '').slice(0, 10) === checkout; });
  return {
    ok: true,
    extraNightCheckin: !checkoutOnCheckin,   // noche antes del check-in
    extraNightCheckout: !checkinOnCheckout,  // noche después del checkout
    turnoverBeforeCheckin: checkoutOnCheckin
  };
}

/* Correo automático de early check-in — corre a las 20:50 del día ANTES del
   check-in. Flujo de 3 capas:
     · 16:30 → email al admin (verificación preliminar) con enlace de aprobación 1-clic
     · 19:00 → recordatorio al admin si aún no aprueba
     · 20:45 → sync EN VIVO + chequeo de calendario real; solo si el admin aprobó
       Y sigue disponible (sin turnover ni bloqueo) → email "disponible" al huésped;
       de lo contrario → email de almacenamiento de maletas.
   ============================================================ */

/* fila de Solicitudes early cuyo check-in es "mañana" (GMT-6) */
function earlyRowsForTomorrow_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
  var tISO = Utilities.formatDate(new Date(Date.now() + 24 * 3600 * 1000), 'GMT-6', 'yyyy-MM-dd');
  var cached = listCached_();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][3] || '') !== 'early') continue;
    if (String(rows[i][5] || '') === 'notificado') continue;
    var code = normCode_(rows[i][1]);
    var resv = cached.filter(function (r) { return normCode_(r.code) === code; })[0];
    if (!resv || String(resv.checkin || '').slice(0, 10) !== tISO) continue;
    out.push({ rowIndex: i + 2, row: rows[i], resv: resv, code: code });
  }
  return out;
}

/* ¿La propiedad está libre la noche anterior al check-in?
   Combina: (A) sin checkout el mismo día del check-in, (B) sin reserva que cubra
   esa noche en la caché, y (C) chequeo del calendario real de Hospitable. */
function earlyIsAvailable_(resv) {
  var pn = String(resv.propertyName || '').trim().toLowerCase();
  var checkin = String(resv.checkin || '').slice(0, 10);
  var cached = listCached_();
  var sameProp = cached.filter(function (r) { return String(r.propertyName || '').trim().toLowerCase() === pn && normCode_(r.code) !== normCode_(resv.code); });
  var turnover = sameProp.some(function (r) { return String(r.checkout || '').slice(0, 10) === checkin; });
  var occupied = sameProp.some(function (r) {
    var ci = String(r.checkin || '').slice(0, 10), co = String(r.checkout || '').slice(0, 10);
    return ci && co && ci < checkin && co >= checkin;
  });
  if (turnover || occupied) return false;
  // (C) calendario real: la noche anterior debe estar disponible/no bloqueada
  var nightBefore = Utilities.formatDate(new Date(new Date(checkin + 'T12:00:00Z').getTime() - 24 * 3600 * 1000), 'GMT', 'yyyy-MM-dd');
  var cal = calendarAvailable_(resv.propertyName, nightBefore);
  if (cal === false) return false; // bloqueado explícitamente; null = no se pudo verificar → no bloquea
  return true;
}

/* Consulta el calendario real de Hospitable para una fecha. Devuelve
   true=disponible, false=bloqueado/ocupado, null=no verificable. */
function calendarAvailable_(propertyName, dateISO) {
  var cfg = CFG_();
  if (!cfg.HOSPITABLE_TOKEN) return null;
  var id = propertyIdByName_(propertyName);
  if (!id) return null;
  var url = 'https://public.api.hospitable.com/v2/properties/' + encodeURIComponent(id) +
            '/calendar?start_date=' + dateISO + '&end_date=' + dateISO;
  var res = hosFetch_(url, cfg);
  if (res.code !== 200) return null;
  var days = (res.json && (res.json.data || res.json.days || res.json.calendar)) || [];
  if (!days.length) return null;
  var d = days[0] || {};
  var st = String(d.status || (d.availability && d.availability.status) || '').toLowerCase();
  if (d.available === false || st === 'unavailable' || st === 'booked' || st === 'blocked') return false;
  if (d.available === true || st === 'available') return true;
  return null;
}

/* nombre de propiedad → id de Hospitable (cacheado 6h en Script Cache) */
function propertyIdByName_(name) {
  if (!name) return '';
  var key = 'propid_' + name.toLowerCase();
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return hit;
  var cfg = CFG_();
  if (!cfg.HOSPITABLE_TOKEN) return '';
  var res = hosFetch_('https://public.api.hospitable.com/v2/properties?per_page=100', cfg);
  if (res.code !== 200) return '';
  var list = res.json.data || res.json.properties || [];
  var target = String(name).trim().toLowerCase();
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    var nm = String(p.name || p.public_name || p.private_name || '').trim().toLowerCase();
    if (nm && nm === target && p.id) { cache.put(key, String(p.id), 21600); return String(p.id); }
  }
  return '';
}

/* email del/los administradores para notificaciones internas */
function adminEmails_() {
  var cfg = CFG_();
  var list = [];
  if (cfg.ADMIN_NOTIFY_EMAIL) list.push(cfg.ADMIN_NOTIFY_EMAIL);
  try {
    var admins = listAdmins_() || [];
    admins.forEach(function (a) { if (a && a.email) list.push(a.email); });
  } catch (e) {}
  if (!list.length) list.push('jovalle@spacioam.com');
  return list.join(',');
}

/* 16:30 — verificación preliminar + email al admin con enlace de aprobación */
function earlyAdminPrompt() {
  syncNow_(); // datos frescos
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Solicitudes');
  var items = earlyRowsForTomorrow_(sh);
  if (!items.length) return;
  var base = webAppUrl_();
  items.forEach(function (it) {
    if (String(it.row[6] || '') === 'aprobado') return; // ya aprobado
    var token = String(it.row[7] || '');
    if (!token) { token = Utilities.getUuid().slice(0, 8); sh.getRange(it.rowIndex, 8).setValue(token); }
    var prelim = earlyIsAvailable_(it.resv) ? 'parece DISPONIBLE' : 'parece NO disponible (hay ocupación la noche previa)';
    var link = base ? (base + '?action=approveEarly&token=' + token) : '(configura el Web App URL para el botón)';
    sendMail_(adminEmails_(),
      'Early check-in mañana · ' + (it.resv.propertyName || '') + ' · ' + it.resv.code,
      'Solicitud de early check-in para mañana.\n\n' +
      'Propiedad: ' + (it.resv.propertyName || '') + '\nReserva: ' + it.resv.code + '\nCheck-in: ' + (it.resv.checkin || '') + '\n\n' +
      'Verificación preliminar: ' + prelim + '.\n\n' +
      'Aprueba aquí (el sistema re-verifica a las 8:45 p.m. antes de avisar al huésped):\n' + link + '\n\nSpacio AM');
  });
}

/* 19:00 — recordatorio al admin si aún no ha aprobado */
function earlyAdminReminder() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Solicitudes');
  var items = earlyRowsForTomorrow_(sh);
  var base = webAppUrl_();
  items.forEach(function (it) {
    if (String(it.row[6] || '') === 'aprobado') return;
    var token = String(it.row[7] || '');
    if (!token) { token = Utilities.getUuid().slice(0, 8); sh.getRange(it.rowIndex, 8).setValue(token); }
    var link = base ? (base + '?action=approveEarly&token=' + token) : '';
    sendMail_(adminEmails_(),
      'Recordatorio · Early check-in mañana · ' + it.resv.code,
      'Aún no has aprobado la solicitud de early check-in para mañana (' + (it.resv.propertyName || '') + ', ' + it.resv.code + ').\n\n' +
      'Apruébala aquí:\n' + link + '\n\nSpacio AM');
  });
}

/* aprobación 1-clic desde el email (doGet ?action=approveEarly&token=) */
function approveEarlyByToken_(token) {
  token = String(token || '').trim();
  if (!token) return 'Enlace inválido.';
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Solicitudes');
  if (!sh || sh.getLastRow() < 2) return 'No se encontró la solicitud.';
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][7] || '') === token) {
      sh.getRange(i + 2, 7).setValue('aprobado');
      return 'Aprobado. Confirmaremos automáticamente al huésped a las 8:45 p.m. solo si la propiedad sigue libre esa noche.';
    }
  }
  return 'Esta solicitud ya no está disponible.';
}

/* 20:45 — verificación FINAL en vivo + aviso al huésped */
function earlyFinalNotify() {
  syncNow_(); // sync en vivo: captura reservas de última hora
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Solicitudes');
  if (!sh || sh.getLastRow() < 2) return;
  var rng = sh.getRange(2, 1, sh.getLastRow() - 1, 8);
  var rows = rng.getValues();
  var tISO = Utilities.formatDate(new Date(Date.now() + 24 * 3600 * 1000), 'GMT-6', 'yyyy-MM-dd');
  var cached = listCached_();
  var changed = false;

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][3] || '') !== 'early') continue;
    if (String(rows[i][5] || '') === 'notificado') continue;
    var code = normCode_(rows[i][1]);
    var resv = cached.filter(function (r) { return normCode_(r.code) === code; })[0];
    if (!resv || String(resv.checkin || '').slice(0, 10) !== tISO) continue;

    var approved = String(rows[i][6] || '') === 'aprobado';
    var available = earlyIsAvailable_(resv);   // re-chequeo en vivo (incluye turnover de última hora)
    var email = guestEmailForCode_(code);
    if (!email) continue;

    if (approved && available) {
      var mYes = resolutionMessage_('early', true);
      sendMail_(email, mYes.subject, mYes.text, mYes.html);
      rows[i][4] = 'confirmado';
    } else {
      var mNo = resolutionMessage_('early', false);
      sendMail_(email, mNo.subject, mNo.text, mNo.html);
      rows[i][4] = 'no-disponible';
    }
    rows[i][5] = 'notificado';
    changed = true;
  }
  if (changed) rng.setValues(rows);
}

/* sync en vivo reutilizable */
function syncNow_() { try { listReservations_(); } catch (e) {} }

/* DIAGNÓSTICO — corre esta desde el menú "Ejecutar" y abre "Registro de
   ejecución" para ver el meta y si la reserva llegó. */
function diagSync() {
  var out = listReservations_();
  Logger.log('meta: ' + JSON.stringify(out.meta));
  Logger.log('total reservas: ' + out.reservations.length);
  var target = 'HMTY4B5ED8';
  var hit = out.reservations.filter(function (r) { return normCode_(r.code) === normCode_(target); });
  Logger.log('reserva ' + target + ': ' + (hit.length ? JSON.stringify(hit[0]) : 'NO ENCONTRADA'));
  var names = {};
  out.reservations.forEach(function (r) { names[r.propertyName] = (names[r.propertyName] || 0) + 1; });
  Logger.log('propiedades con reservas: ' + JSON.stringify(names));
  return out.meta;
}

/* URL del Web App publicado (para armar el enlace de aprobación) */
function webAppUrl_() {
  var cfg = CFG_();
  if (cfg.WEB_APP_URL) return cfg.WEB_APP_URL;
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function ensureEarlyTrigger_() {
  ['earlyCheckinAutoNotify', 'earlyAdminPrompt', 'earlyAdminReminder', 'earlyFinalNotify'].forEach(function (fn) {
    ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === fn; })
      .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  });
  ScriptApp.newTrigger('earlyAdminPrompt').timeBased().atHour(16).nearMinute(30).everyDays(1).create();
  ScriptApp.newTrigger('earlyAdminReminder').timeBased().atHour(19).nearMinute(0).everyDays(1).create();
  ScriptApp.newTrigger('earlyFinalNotify').timeBased().atHour(20).nearMinute(45).everyDays(1).create();
}


/* ============================================================
   7 · ACCIONES DE HUÉSPED / ADMIN (bento + panel)
   ============================================================ */
function appendSimple_(sheetName, row) {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName(sheetName);
  if (!sh) return { ok: false, error: 'no-sheet:' + sheetName };
  sh.appendRow(row);
  return { ok: true };
}

/* ============================================================
   7b · INCIDENCIAS — "Notificar problema al host"
   El huésped no encuentra su reserva y, en vez de escribirnos por WhatsApp,
   pulsa un botón. Eso: (1) avisa por correo a todos los admins, (2) crea una
   fila en Incidencias que aparece en el panel.
   Ciclo de vida:
     pendiente  → aún sin resolver
     auto       → al recargar, la reserva YA existe con ese código: se cierra sola
     vinculado  → el código estaba mal escrito; el admin lo ata a una reserva
                  real y la incidencia pasa a "errores frecuentes de huéspedes"
     descartado → el admin la archiva sin vincular
   ============================================================ */
function incidenciasSheet_() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Incidencias');
  if (!sh) {
    sh = ss.insertSheet('Incidencias');
    sh.appendRow(SCHEMA_['Incidencias']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function reportProblem_(body) {
  var code = String(body.code || '').trim();
  if (!code) return { ok: false, error: 'no-code' };
  var sh = incidenciasSheet_();
  var headers = SCHEMA_['Incidencias'];
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues() : [];
  // no dupliques: si ya hay una pendiente con el mismo código, solo confirma
  for (var i = 0; i < rows.length; i++) {
    if (normCode_(rows[i][1]) === normCode_(code) && String(rows[i][4] || '') === 'pendiente') {
      return { ok: true, duplicate: true };
    }
  }
  sh.appendRow([nowISO_(), code, String(body.stage || ''), String(body.device || ''), 'pendiente', '', '', '', String(body.note || '')]);

  try {
    var shell = emailShell_({
      eyebrow: 'Incidencia de huésped',
      heading: 'Un huésped no encuentra su reserva',
      paras: ['El huésped intentó validar su código y, tras buscar en vivo, la reserva no apareció. Ya está registrada en Seguimiento → Problemas por resolver.'],
      rows: [
        ['Código ingresado', code],
        ['Búsqueda realizada', body.stage === 'deep' ? 'Ampliada (60 días)' : 'Rápida (5 días)'],
        ['Hora', Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Guatemala', "d/MM/yyyy HH:mm")]
      ],
      footerNote: 'Si al actualizar el panel la reserva aparece con ese mismo código, la alerta se cierra sola. Si el código está mal escrito, vincúlala a la reserva correcta desde el panel.'
    });
    sendMail_(adminEmails_(), 'Incidencia · reserva no encontrada · ' + code, shell.text, shell.html);
  } catch (e) {}
  return { ok: true };
}

/* Devuelve { pending, frequent } y cierra sola cualquier pendiente cuyo código
   ya exista en Reservas (caso "el admin actualizó y la reserva apareció"). */
function listIncidents_() {
  var sh = incidenciasSheet_();
  var headers = SCHEMA_['Incidencias'];
  if (sh.getLastRow() < 2) return { ok: true, pending: [], frequent: [] };
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  var pending = [], frequent = [], writes = [];

  rows.forEach(function (r, i) {
    var status = String(r[4] || 'pendiente');
    var code = String(r[1] || '');
    var item = {
      id: (r[0] ? new Date(r[0]).toISOString() : '') + '|' + code,
      at: r[0] ? new Date(r[0]).getTime() : 0,
      code: code, stage: String(r[2] || ''), status: status,
      resolvedAt: r[5] ? new Date(r[5]).getTime() : 0,
      linkedCode: String(r[6] || ''), errorType: String(r[7] || ''), note: String(r[8] || '')
    };
    if (status === 'pendiente') {
      var hit = findInReservasSheet_(code);
      if (hit) {
        item.status = 'auto'; item.resolvedAt = new Date().getTime();
        item.reservation = { propertyName: hit.propertyName, apartment: hit.apartment, checkin: hit.checkin };
        writes.push({ row: i + 2, status: 'auto' });
        return; // resuelta sola: no molesta al admin ni cuenta como error de huésped
      }
      pending.push(item);
    } else if (status === 'vinculado') {
      frequent.push(item);
    }
  });
  writes.forEach(function (w) {
    sh.getRange(w.row, 5).setValue(w.status);
    sh.getRange(w.row, 6).setValue(nowISO_());
  });
  return { ok: true, pending: pending, frequent: frequent };
}

/* action: 'link' (con linkedCode + errorType) | 'dismiss' | 'reopen' */
function resolveIncident_(body) {
  var sh = incidenciasSheet_();
  var headers = SCHEMA_['Incidencias'];
  if (sh.getLastRow() < 2) return { ok: false, error: 'not-found' };
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  var want = String(body.id || '');
  for (var i = 0; i < rows.length; i++) {
    var id = (rows[i][0] ? new Date(rows[i][0]).toISOString() : '') + '|' + String(rows[i][1] || '');
    if (id !== want) continue;
    var row = i + 2;
    if (body.action === 'link') {
      var linked = String(body.linkedCode || '').trim();
      if (!linked) return { ok: false, error: 'no-linked-code' };
      sh.getRange(row, 5).setValue('vinculado');
      sh.getRange(row, 6).setValue(nowISO_());
      sh.getRange(row, 7).setValue(linked);
      sh.getRange(row, 8).setValue(String(body.errorType || classifyCodeError_(String(rows[i][1] || ''), linked)));
    } else if (body.action === 'reopen') {
      sh.getRange(row, 5).setValue('pendiente');
      sh.getRange(row, 6).setValue('');
    } else {
      sh.getRange(row, 5).setValue('descartado');
      sh.getRange(row, 6).setValue(nowISO_());
    }
    return { ok: true };
  }
  return { ok: false, error: 'not-found' };
}

/* Clasifica automáticamente por qué falló el código — alimenta el análisis
   de "errores frecuentes de huéspedes". */
function classifyCodeError_(typed, real) {
  var a = normCode_(typed), b = normCode_(real);
  if (!a || !b) return 'otro';
  if (a === b) return 'reserva-no-sincronizada';
  if (b.indexOf(a) === 0 || a.indexOf(b) === 0) return 'codigo-incompleto';
  if (a.length === b.length) {
    var diff = 0;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    if (diff <= 2) return 'caracter-confundido';
  }
  if (a.split('').sort().join('') === b.split('').sort().join('')) return 'orden-invertido';
  return 'codigo-distinto';
}

/* Facturas pendientes desde la hoja (antes el panel las leía de localStorage,
   por eso el contador de alertas y la lista no coincidían). */
function listInvoices_() {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Facturas');
  if (!sh || sh.getLastRow() < 2) return [];
  var headers = SCHEMA_['Facturas'];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  // monto pagado por reserva (desde la caché de Reservas) + tipo de cambio del día
  var paid = {};
  try {
    listCached_().forEach(function (r) {
      if (r.amount) paid[normCode_(r.code)] = { amount: r.amount, currency: r.currency || 'USD' };
    });
  } catch (e) {}
  var fx = fxRate_();
  var out = [];
  rows.forEach(function (r, i) {
    var status = String(r[8] || '');
    if (status === 'lista' || status === 'enviada' || status === 'done') return;
    var p = paid[normCode_(r[1])] || null;
    var usd = null, gtq = null;
    if (p) {
      if (String(p.currency).toUpperCase() === 'GTQ') {
        gtq = p.amount;
        usd = fx.rate ? p.amount / fx.rate : null;
      } else {
        usd = p.amount;
        gtq = fx.rate ? p.amount * fx.rate : null;
      }
    }
    out.push({
      id: (r[0] ? new Date(r[0]).toISOString() : '') + '|' + String(r[1] || ''),
      at: r[0] ? new Date(r[0]).getTime() : 0,
      code: String(r[1] || ''), apartment: String(r[2] || ''),
      checkin: r[3] ? isoDate_(new Date(r[3])) : '',
      nit: String(r[4] || ''), name: String(r[5] || ''), comment: String(r[6] || ''),
      deadline: r[7] ? isoDate_(new Date(r[7])) : '', status: status || 'pendiente',
      amount: p ? p.amount : null, currency: p ? p.currency : '',
      amountUsd: usd != null ? Math.round(usd * 100) / 100 : null,
      amountGtq: gtq != null ? Math.round(gtq * 100) / 100 : null,
      fxRate: fx.rate || null, fxSource: fx.source || '', fxDate: fx.date || ''
    });
  });
  return out;
}

/* action: 'done' (resuelta / archivada) | 'reopen' */
function resolveInvoice_(body) {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Facturas');
  if (!sh || sh.getLastRow() < 2) return { ok: false, error: 'not-found' };
  var headers = SCHEMA_['Facturas'];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var id = (rows[i][0] ? new Date(rows[i][0]).toISOString() : '') + '|' + String(rows[i][1] || '');
    if (id !== String(body.id || '')) continue;
    sh.getRange(i + 2, 9).setValue(body.action === 'reopen' ? 'pendiente' : 'done');
    return { ok: true };
  }
  return { ok: false, error: 'not-found' };
}

/* ============================================================
   7c · ENLACES FIRMADOS POR RESERVA
   hola.spacioam.com/#r=CODIGO&s=FIRMA&t=amenities
   El huésped entra directo a su estancia (y opcionalmente a una sección) sin
   escribir el código. La firma es un HMAC-SHA256 truncado sobre el código
   normalizado + un secreto del script, así que el enlace no se puede fabricar
   adivinando códigos. Caduca solo: deja de servir pasado el check-out.
   ============================================================ */
function linkSecret_() {
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty('LINK_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    p.setProperty('LINK_SECRET', s);
  }
  return s;
}

function linkSig_(code) {
  var raw = Utilities.computeHmacSha256Signature(normCode_(code), linkSecret_());
  var hex = raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  return hex.substring(0, 16);
}

/* Genera el enlace para una reserva. Lo usa el panel. */
function guestLink_(b) {
  var code = String(b.code || '').trim();
  if (!code) return { ok: false, error: 'no-code' };
  var base = String(b.base || CFG_().APP_URL || '').replace(/\/+$/, '');
  var sig = linkSig_(code);
  var hash = '#r=' + encodeURIComponent(code) + '&s=' + sig + (b.tile ? '&t=' + encodeURIComponent(b.tile) : '');
  return { ok: true, sig: sig, hash: hash, url: base ? (base + '/' + hash) : hash };
}

/* Abre el enlace: valida la firma y devuelve la reserva. */
function openLink_(b) {
  var code = String(b.code || '').trim();
  var sig = String(b.sig || '').trim().toLowerCase();
  if (!code || !sig) return { ok: false, error: 'bad-link' };
  if (sig !== linkSig_(code)) return { ok: false, error: 'bad-signature' };

  var hit = findInReservasSheet_(code);
  if (!hit) {
    try { listReservations_({ days: 5, fast: true }); } catch (e) {}
    hit = findInReservasSheet_(code);
  }
  if (!hit) return { ok: false, error: 'not-found' };

  // el enlace caduca solo: deja de abrir un día después del check-out
  if (hit.checkout) {
    var end = new Date(hit.checkout + 'T23:59:59');
    if (!isNaN(end) && new Date().getTime() > end.getTime() + 86400000) {
      return { ok: false, error: 'expired' };
    }
  }
  return { ok: true, reservation: hit };
}

/* El administrador elimina una notificación de forma PERMANENTE: se archivan
   en la hoja las filas que la alimentan, así el contador no puede resucitar.
   kind: 'invoices' | 'requests' | 'incidents'
   Además limpia filas fantasma (sin código) que inflaban el contador sin
   aparecer en la lista de seguimiento. */
function purgeAlerts_(body) {
  var kind = String(body.kind || '');
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var n = 0;
  try {
    if (kind === 'invoices') {
      var f = ss.getSheetByName('Facturas');
      if (f && f.getLastRow() > 1) {
        var rF = f.getRange(2, 1, f.getLastRow() - 1, 9), vF = rF.getValues();
        for (var i = 0; i < vF.length; i++) {
          var st = String(vF[i][8] || '');
          if (st === 'lista' || st === 'enviada' || st === 'done') continue;
          vF[i][8] = 'done'; n++;
        }
        rF.setValues(vF);
      }
    } else if (kind === 'requests') {
      var s = ss.getSheetByName('Solicitudes');
      if (s && s.getLastRow() > 1) {
        var rS = s.getRange(2, 1, s.getLastRow() - 1, 8), vS = rS.getValues();
        for (var j = 0; j < vS.length; j++) {
          if (String(vS[j][6] || '')) continue;      // ya tiene decisión
          vS[j][6] = 'descartada'; vS[j][4] = 'descartada'; n++;
        }
        rS.setValues(vS);
      }
    } else if (kind === 'incidents') {
      var c = incidenciasSheet_();
      if (c && c.getLastRow() > 1) {
        var w = SCHEMA_['Incidencias'].length;
        var rC = c.getRange(2, 1, c.getLastRow() - 1, w), vC = rC.getValues();
        for (var k = 0; k < vC.length; k++) {
          if (String(vC[k][4] || '') !== 'pendiente') continue;
          vC[k][4] = 'descartado'; vC[k][5] = nowISO_(); n++;
        }
        rC.setValues(vC);
      }
    } else return { ok: false, error: 'unknown kind' };
  } catch (e) { return { ok: false, error: String(e) }; }
  return { ok: true, purged: n };
}

/* Contadores para la barra de alertas del panel. */function adminAlerts_() {
  var out = { ok: true, invoices: 0, incidents: 0, staleSync: false, lastSync: '', requests: 0 };
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  try {
    var f = ss.getSheetByName('Facturas');
    if (f && f.getLastRow() > 1) {
      f.getRange(2, 9, f.getLastRow() - 1, 1).getValues().forEach(function (r) {
        var s = String(r[0] || '');
        if (s !== 'lista' && s !== 'enviada' && s !== 'done') out.invoices++;
      });
    }
  } catch (e) {}
  try { out.incidents = (listIncidents_().pending || []).length; } catch (e) {}
  try { out.requests = (listRequests_() || []).filter(function (r) { return r.requested && !r.decision; }).length; } catch (e) {}
  try {
    // "reserva con errores de actualización" = la caché llevar rato sin refrescar
    var rv = ss.getSheetByName('Reservas');
    if (rv && rv.getLastRow() > 1) {
      var stamps = rv.getRange(2, 12, rv.getLastRow() - 1, 1).getValues();
      var newest = 0;
      stamps.forEach(function (r) { var v = r[0] ? new Date(r[0]).getTime() : 0; if (v > newest) newest = v; });
      if (newest) {
        out.lastSync = new Date(newest).toISOString();
        out.staleSync = (new Date().getTime() - newest) > 45 * 60000; // >45 min
      } else out.staleSync = true;
    } else out.staleSync = true;
  } catch (e) {}
  return out;
}

/* etiquetas legibles por tipo de solicitud */
var REQ_LABELS_ = {
  early:   'Early check-in',
  late:    'Late check-out',
  day:     'Noche / día adicional',
  luggage: 'Permiso para dejar maletas'
};

/* Huésped envía una solicitud (día adicional / early / maletas) → se guarda
   en la pestaña Solicitudes Y se avisa por correo al administrador. */
function hostRequest_(body) {
  appendSimple_('Solicitudes', [nowISO_(), body.code || '', body.apartment || '', body.kind || '', 'pendiente']);
  try {
    var label = REQ_LABELS_[body.kind] || body.kind || 'Solicitud';
    var ci = body.checkin ? String(body.checkin).slice(0, 10) : '';
    var shell = emailShell_({
      eyebrow: 'Nueva solicitud',
      heading: label,
      image: EMAIL_IMG_.adminAlert,
      paras: ['Un huésped acaba de enviar una solicitud desde la app. Ábrela en el panel <b>(Seguimiento)</b> para aprobarla o rechazarla — el huésped recibirá tu resolución por correo.'],
      rows: [['Tipo', label], ['Reserva', body.code || ''], ['Propiedad', body.apartment || ''], ['Check-in', ci]],
      cta: { label: 'Abrir panel', url: 'https://hola.spacioam.com' },
      signoff: 'Spacio AM'
    });
    sendMail_(adminEmails_(), 'Nueva solicitud · ' + label + ' · ' + (body.apartment || body.code || ''), shell.text, shell.html);
  } catch (e) {}
  return { ok: true };
}

/* Admin aprueba o rechaza una solicitud → se registra en Solicitudes y se
   avisa al huésped por correo con la resolución. */
function hostRequestResolve_(body) {
  var kind = body.kind || '';
  var approved = body.decision === 'approved' || body.approved === true;
  var rejected = body.decision === 'rejected';
  var deleted = body.decision === 'deleted';
  var estado = approved ? 'aprobado' : (rejected ? 'rechazado' : (deleted ? 'eliminado' : 'pendiente'));
  appendSimple_('Solicitudes', [nowISO_(), body.code || '', body.apartment || '', kind + '-' + estado, 'admin']);
  var notified = false, to = '', skipped = '';
  if (approved || rejected) {
    // si se gestiona DESPUÉS del checkout, no tiene sentido avisar al huésped
    if (isPastCheckout_(body.code)) {
      skipped = 'past-checkout';
    } else {
      try {
        to = guestEmailForCode_(normCode_(body.code || '')) || '';
        if (to) {
          var m = resolutionMessage_(kind, approved);
          sendMail_(to, m.subject, m.text, m.html);
          notified = true;
        }
      } catch (e) {}
    }
  }
  return { ok: true, notified: notified, to: to, estado: estado, skipped: skipped };
}

/* Reconstruye el estado ACTUAL de cada solicitud leyendo la hoja Solicitudes,
   para que el panel muestre lo mismo en cualquier dispositivo.
   Filas de huésped: type sin sufijo, status 'pendiente'.
   Filas de admin:   type 'early-aprobado' | '...-rechazado' | '...-eliminado'. */
function listRequests_() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Solicitudes');
  if (!sh || sh.getLastRow() < 2) return [];
  var headers = SCHEMA_['Solicitudes'];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  var BASE = { early: 1, late: 1, day: 1, luggage: 1 };
  var map = {};
  rows.forEach(function (r) {
    var at = r[0] ? new Date(r[0]).getTime() : 0;
    var code = String(r[1] || '');
    var apartment = String(r[2] || '');
    var rawType = String(r[3] || '');
    var dash = rawType.indexOf('-');
    var base = dash >= 0 ? rawType.slice(0, dash) : rawType;
    var suffix = dash >= 0 ? rawType.slice(dash + 1) : '';
    if (!BASE[base]) return;
    var k = normCode_(code) + '|' + base;
    if (!map[k]) map[k] = { type: base, code: code, apartment: apartment, at: at, requested: false, decision: null, decAt: 0 };
    var e = map[k];
    if (!suffix) { // fila de solicitud del huésped
      e.requested = true;
      if (!e.at || at < e.at) e.at = at;
      if (apartment) e.apartment = apartment;
    } else if (at >= e.decAt) { // resolución más reciente del admin
      e.decAt = at;
      e.decision = suffix === 'aprobado' ? 'approved' : (suffix === 'rechazado' ? 'rejected' : (suffix === 'eliminado' ? 'deleted' : e.decision));
    }
  });
  var out = [];
  Object.keys(map).forEach(function (k) {
    var e = map[k];
    if (!e.requested) return;          // sin solicitud real del huésped
    if (e.decision === 'deleted') return; // borrada por el admin
    out.push({ type: e.type, code: e.code, apartment: e.apartment, at: e.at, decision: e.decision });
  });
  out.sort(function (a, b) { return b.at - a.at; });
  return out;
}

/* true si HOY (GMT-6) es posterior al día de checkout de la reserva. */
function isPastCheckout_(code) {
  try {
    var resv = findInReservasSheet_(code);
    var co = resv && resv.checkout ? String(resv.checkout).slice(0, 10) : '';
    if (!co) return false;
    var today = Utilities.formatDate(new Date(), 'GMT-6', 'yyyy-MM-dd');
    return today > co;
  } catch (e) { return false; }
}

/* Correo cálido (tono de marca, HTML branded) de resolución al huésped. */
function resolutionMessage_(kind, approved) {
  var CTA = { label: 'Ver mi espacio', url: 'https://hola.spacioam.com' };
  var SIGN = 'Con cariño,\nSpacio AM';
  var M = {
    early: {
      yes: { subject: 'Tu early check-in está confirmado ✦ Spacio AM', image: EMAIL_IMG_.goodnews, heading: 'Tu early check-in está confirmado',
             paras: ['Buenas noticias: confirmamos tu ingreso anticipado. Cuéntanos a qué hora piensas llegar y dejamos todo listo para recibirte.'] },
      no:  { subject: 'Sobre tu early check-in ✦ Spacio AM', image: EMAIL_IMG_.alt, heading: 'Sobre tu early check-in',
             paras: ['Gracias por tu paciencia. Por esta vez no podremos ofrecer el ingreso anticipado. Si lo necesitas, con gusto guardamos tus maletas de forma segura para que empieces a disfrutar la ciudad.'] }
    },
    late: {
      yes: { subject: 'Tu late check-out está confirmado ✦ Spacio AM', image: EMAIL_IMG_.goodnews, heading: 'Tu late check-out está confirmado',
             paras: ['Confirmado: puedes quedarte un poco más. Aprobamos tu salida tardía. Disfruta esas horas extra sin prisa.'] },
      no:  { subject: 'Sobre tu late check-out ✦ Spacio AM', image: EMAIL_IMG_.alt, heading: 'Sobre tu late check-out',
             paras: ['Gracias por avisarnos. Por esta vez no podremos extender la hora de salida, ya que el espacio se prepara para el siguiente huésped. Con gusto guardamos tus maletas si lo necesitas.'] }
    },
    day: {
      yes: { subject: 'Tu noche adicional está confirmada ✦ Spacio AM', image: EMAIL_IMG_.goodnews, heading: 'Tu noche adicional está confirmada',
             paras: ['¡Qué gusto que te quedes más tiempo! Confirmamos tu noche adicional. Te compartiremos los detalles del cobro y seguimos coordinando por aquí.'] },
      no:  { subject: 'Sobre tu noche adicional ✦ Spacio AM', image: EMAIL_IMG_.alt, heading: 'Sobre tu noche adicional',
             paras: ['Gracias por tu solicitud. Por esta vez el espacio no está disponible para una noche adicional. Escríbenos y con gusto buscamos alternativas para ti.'] }
    },
    luggage: {
      yes: { subject: 'Guardamos tus maletas ✦ Spacio AM', image: EMAIL_IMG_.luggage, heading: 'Guardamos tus maletas',
             paras: ['Listo: puedes dejar tus maletas con nosotros de forma segura. Coordinamos por aquí la hora y el punto de entrega.'] },
      no:  { subject: 'Sobre el resguardo de tus maletas ✦ Spacio AM', image: EMAIL_IMG_.alt, heading: 'Sobre el resguardo de tus maletas',
             paras: ['Gracias por escribirnos. Por esta vez no podremos resguardar tus maletas. Con gusto te sugerimos opciones cercanas si lo necesitas.'] }
    }
  };
  var g = M[kind] || {
    yes: { subject: 'Tu solicitud fue aprobada ✦ Spacio AM', image: EMAIL_IMG_.goodnews, heading: 'Tu solicitud fue aprobada', paras: ['Tu solicitud fue aprobada. Seguimos coordinando por aquí.'] },
    no:  { subject: 'Sobre tu solicitud ✦ Spacio AM', image: EMAIL_IMG_.alt, heading: 'Sobre tu solicitud', paras: ['Gracias por tu paciencia. Por esta vez no podremos atender tu solicitud. Escríbenos y con gusto buscamos alternativas.'] }
  };
  var pick = approved ? g.yes : g.no;
  var shell = emailShell_({ eyebrow: 'Spacio AM', heading: pick.heading, image: pick.image, paras: pick.paras, cta: CTA, signoff: SIGN });
  return { subject: pick.subject, text: shell.text, html: shell.html };
}

/* Control de almacenamiento: documento más viejo guardado, conteo y próxima
   purga, para que el admin vea qué hay retenido en Drive.
   El tamaño real exige una llamada a Drive por archivo, así que se mide una
   muestra acotada, se extrapola el resto y el resultado se cachea 12 h — antes
   este bloque tardaba tanto que Seguimiento se quedaba cargando. */
function storageStats_(opts) {
  opts = opts || {};
  var cache = CacheService.getScriptCache();
  if (!opts.fresh) {
    var hit = cache.get('STOR_STATS');
    if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  }
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Documentos');
  var months = CFG_().RETENTION_MONTHS;
  if (!sh || sh.getLastRow() < 2) return { ok: true, stored: 0, retentionMonths: months };
  var headers = SCHEMA_['Documentos'];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  var SAMPLE = 120;
  var stored = 0, oldest = null, nextPurge = null, bytes = 0, measured = 0;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][9] === true || String(rows[i][9]).toLowerCase() === 'true') continue; // ya borrado
    stored++;
    if (measured < SAMPLE && rows[i][7]) {
      try { bytes += DriveApp.getFileById(rows[i][7]).getSize(); measured++; } catch (e) {}
    }
    var up = rows[i][0] ? new Date(rows[i][0]) : null;
    if (up && !isNaN(up) && (!oldest || up < oldest)) oldest = up;
    var del = rows[i][8] ? new Date(rows[i][8]) : null;
    if (del && !isNaN(del) && (!nextPurge || del < nextPurge)) nextPurge = del;
  }
  var partial = measured > 0 && stored > measured;
  var total = measured > 0 ? Math.round(bytes / measured * stored) : 0;
  var ageDays = oldest ? Math.floor((Date.now() - oldest.getTime()) / 86400000) : null;
  var out = {
    ok: true,
    stored: stored,
    bytes: total,
    bytesPartial: partial,
    retentionMonths: months,
    oldest: oldest ? oldest.toISOString() : '',
    oldestAgeDays: ageDays,
    nextPurge: nextPurge ? nextPurge.toISOString() : '',
    at: new Date().toISOString()
  };
  try { cache.put('STOR_STATS', JSON.stringify(out), 43200); } catch (e) {}
  return out;
}

/* TODO Seguimiento en UNA sola llamada. Antes el panel hacía 5 peticiones
   encadenadas (solicitudes, invitados, streaming, facturas, almacenamiento) y
   cada una es un viaje completo a Apps Script. */
function seguimientoAll_() {
  var out = { ok: true };
  try { out.requests = listRequests_(); } catch (e) { out.requests = []; }
  try { out.gacc = listGuestAccess_(); } catch (e) { out.gacc = []; }
  try { out.streaming = listStreaming_(); } catch (e) { out.streaming = []; }
  try { out.invoices = listInvoices_(); } catch (e) { out.invoices = []; }
  try { out.fx = fxRate_(); } catch (e) { out.fx = null; }
  try { out.storage = storageStats_(); } catch (e) { out.storage = null; }
  return out;
}

function appendInvoice_(b) {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Facturas');
  if (!sh) return { ok: false, error: 'no-sheet:Facturas' };
  // deadline = 5 días hábiles después del check-in
  var base = b.checkin ? new Date(b.checkin + 'T12:00:00') : new Date();
  var d = new Date(base.getTime()), added = 0;
  while (added < 5) { d.setDate(d.getDate() + 1); var day = d.getDay(); if (day !== 0 && day !== 6) added++; }
  sh.appendRow([ nowISO_(), b.code || '', b.apartment || '', b.checkin || '',
    "'" + (b.nit || ''), b.razon || '', b.comment || '', isoDate_(d), 'pendiente' ]);
  return { ok: true, deadline: isoDate_(d) };
}

function appendGuestAccess_(b) {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Invitados');
  if (!sh) return { ok: false, error: 'no-sheet:Invitados' };
  var guests = b.guests || [];
  var needs = !!b.needsApproval;
  guests.forEach(function (g) {
    sh.appendRow([ nowISO_(), b.code || '', b.apartment || '', g.name || '', g.doc || '',
      "'" + (g.id || ''), g.date || '', "'" + (g.time || ''), needs ? 'sí' : 'no',
      needs ? 'requiere-aprobación' : 'auto-autorizado' ]);
  });
  // ≤2 invitados → correo automático a los contactos de la propiedad
  if (!needs) {
    try {
      var res = findInReservasSheet_(b.code);
      var propName = res ? res.propertyName : (b.apartment || '');
      var st = stationFor_(propName);
      if (st) {
        var to = [st.email1, st.email2].filter(function (e) { return e && e.trim(); }).join(',');
        if (to) {
          var lines = ['Solicitud de ingreso de invitados (autorización automática).', '',
            'Reserva: ' + (b.code || ''), 'Alojamiento: ' + (b.apartment || ''), '',
            'Invitados:'].concat(guests.map(function (g) {
              return '• ' + (g.name || '') + ' — ' + (g.id || '') + ' — ' + (g.date || '') + ' ' + (g.time || '');
            })).concat(['', 'Spacio AM']);
          sendMail_(to, 'Ingreso de invitados · ' + (b.apartment || b.code || ''), lines.join('\n'));
        }
      }
    } catch (e) {}
  }
  return { ok: true, needsApproval: needs };
}

/* Guarda la info de una propiedad.
   FUSIÓN POR DEFECTO: el payload se mezcla sobre lo que ya hay, campo por
   campo. Un cliente que solo conoce `std` NO puede borrar wifi, parqueo o
   cerradura — que es exactamente lo que pasó el 28/07. Para reemplazar de
   verdad (o borrar campos) hay que mandar replace:true. */
function savePropertyInfo_(b) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('PropiedadesInfo');
  if (!sh) return { ok: false, error: 'no-sheet:PropiedadesInfo' };
  var name = b.property || '';
  if (!name) return { ok: false, error: 'property requerido' };

  var incoming = b.info || {};
  var found = 0, prevObj = null;
  if (sh.getLastRow() > 1) {
    var rows = sh.getRange(2, 2, sh.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === name) {
        found = i + 2;
        try { prevObj = JSON.parse(String(rows[i][1] || '{}')); } catch (e) { prevObj = null; }
        break;
      }
    }
  }

  var merged = incoming;
  if (found && prevObj && !b.replace) {
    var nKeys = Object.keys(incoming);
    // payload vacío sobre un registro con datos: se ignora (red de seguridad)
    if (!nKeys.length && Object.keys(prevObj).length) return { ok: true, skipped: 'empty-overwrite' };
    merged = {};
    Object.keys(prevObj).forEach(function (k) { merged[k] = prevObj[k]; });
    // Las claves AUSENTES del payload se conservan (eso arregla el borrado del
    // 28/07, donde solo llegó {std, stdMeta}). Las claves PRESENTES sí se
    // aplican tal cual, incluso vacías: el admin debe poder borrar un wifi o
    // un número de parqueo equivocado.
    nKeys.forEach(function (k) { merged[k] = incoming[k]; });
  }

  var row = [ nowISO_(), name, JSON.stringify(merged) ];
  if (found) sh.getRange(found, 1, 1, 3).setValues([row]);
  else sh.appendRow(row);
  return { ok: true };
}

/* ---------- RECUPERACIÓN ----------
   1. Crea una pestaña llamada "Restaurar".
   2. Pega ahí el respaldo (3 columnas: fecha, nombre, info_json), sin encabezado.
   3. Corre esta función desde el editor de Apps Script.
   Fusiona el respaldo con lo actual: los campos que hoy faltan se recuperan y
   nada de lo que ya está se pierde. Escribe la hoja de una sola vez. */
function restorePropertyInfoFromBackup() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var src = ss.getSheetByName('Restaurar');
  if (!src || src.getLastRow() < 1) {
    var msg0 = 'FALTA LA PESTAÑA. Crea una pestaña llamada "Restaurar" y pega ahí el respaldo (3 columnas: fecha, nombre, info_json), sin encabezado.';
    Logger.log(msg0);
    return msg0;
  }
  Logger.log('Copia de seguridad: ' + backupPropertyInfo());

  var rows = src.getRange(1, 1, src.getLastRow(), 3).getValues();
  Logger.log('Filas leídas de "Restaurar": ' + rows.length);

  var current = listPropertyInfo_().info || {};   // una sola lectura
  var out = {}, restored = 0, added = 0, skipped = 0, recovered = 0;

  Object.keys(current).forEach(function (k) { out[k] = current[k]; });

  rows.forEach(function (r, idx) {
    var name = String(r[1] || '').trim();
    var json = String(r[2] || '').trim();
    if (!name || !json) { skipped++; return; }
    var obj; try { obj = JSON.parse(json); } catch (e) {
      skipped++; Logger.log('  ⚠️ fila ' + (idx + 1) + ' (' + name + '): JSON inválido, omitida'); return;
    }
    var cur = current[name] || null;
    var merged = {};
    Object.keys(obj).forEach(function (k) { merged[k] = obj[k]; });
    if (cur) {
      var got = [];
      Object.keys(obj).forEach(function (k) { if (!(k in cur)) got.push(k); });
      Object.keys(cur).forEach(function (k) {
        var v = cur[k];
        var empty = v == null || (typeof v === 'string' && v === '') || (Array.isArray(v) && !v.length);
        if (!empty) merged[k] = v;     // lo actual manda si tiene contenido
      });
      restored++;
      if (got.length) { recovered += got.length; Logger.log('  ✓ ' + name + ' → recuperados: ' + got.join(', ')); }
    } else {
      added++;
      Logger.log('  + ' + name + ' (no existía)');
    }
    out[name] = merged;
  });

  // ESCRITURA ÚNICA: reconstruye toda la pestaña de golpe
  var sh = ss.getSheetByName('PropiedadesInfo');
  if (!sh) { sh = ss.insertSheet('PropiedadesInfo'); sh.appendRow(SCHEMA_['PropiedadesInfo']); }
  var names = Object.keys(out);
  var stamp = nowISO_();
  var body = names.map(function (n) { return [stamp, n, JSON.stringify(out[n])]; });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
  if (body.length) sh.getRange(2, 1, body.length, 3).setValues(body);

  var msg = 'LISTO · fusionadas: ' + restored + ' · nuevas: ' + added
          + ' · omitidas: ' + skipped + ' · campos recuperados: ' + recovered
          + ' · total en la hoja: ' + names.length
          + '. Se creó una copia de seguridad antes de escribir.';
  Logger.log(msg);
  return msg;
}

/* Copia de seguridad manual de PropiedadesInfo: duplica la pestaña con la
   fecha en el nombre. Córrela desde el editor de Apps Script antes de
   cualquier cambio grande. */
function backupPropertyInfo() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('PropiedadesInfo');
  if (!sh) return 'No existe la pestaña PropiedadesInfo.';
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Guatemala', 'yyyy-MM-dd_HHmm');
  sh.copyTo(ss).setName('PropiedadesInfo_backup_' + stamp);
  var msg = 'Copia creada: PropiedadesInfo_backup_' + stamp;
  Logger.log(msg);
  return msg;
}

/* Diagnóstico: cuántas propiedades hay y a cuáles les faltan campos.
   Córrela antes y después de restaurar para comparar. */
function auditPropertyInfo() {
  var info = listPropertyInfo_().info || {};
  var names = Object.keys(info).filter(function (n) { return n.indexOf('__') !== 0; });
  var want = ['hasParking', 'wifiNet', 'wifiPass', 'lock', 'propType'];
  var full = 0, partial = [];
  names.forEach(function (n) {
    var o = info[n] || {};
    var miss = want.filter(function (k) {
      var v = o[k]; return v == null || String(v).trim() === '';
    });
    if (!miss.length) full++;
    else partial.push(n + '  →  falta: ' + miss.join(', '));
  });
  Logger.log('Propiedades en la hoja: ' + names.length);
  Logger.log('Completas: ' + full + ' · incompletas: ' + partial.length);
  partial.forEach(function (l) { Logger.log('  ' + l); });
  return 'Total ' + names.length + ' · completas ' + full + ' · incompletas ' + partial.length;
}

/* Devuelve toda la info de propiedades (incluye la clave especial __manual__
   con el manual de la casa) para que el panel y la app del huésped la lean
   compartida entre dispositivos. */
function listPropertyInfo_() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('PropiedadesInfo');
  var info = {};
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) {
      var nm = String(r[1] || ''); if (!nm) return;
      try { info[nm] = JSON.parse(r[2] || '{}'); } catch (e) { info[nm] = {}; }
    });
  }
  return { ok: true, info: info };
}

/* ============================================================
   7b · REGISTRO DE ENVÍOS (log) + reenvío manual por canal
   ============================================================ */
function ensureLogSheet_() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('EnviosLog');
  if (!sh) { sh = ss.insertSheet('EnviosLog'); sh.appendRow(['fecha', 'canal', 'code', 'propiedad', 'destino', 'estado', 'detalle']); }
  return sh;
}
/* Registra cada intento de envío (automático o manual) para diagnóstico. */
function logSend_(channel, meta, to, ok, detail) {
  try {
    var sh = ensureLogSheet_();
    var code = (meta && meta.code) || '';
    var prop = (meta && (meta.propertyName || meta.apartment)) || '';
    sh.appendRow([nowISO_(), channel, code, prop, to || '', ok ? 'OK' : 'ERROR', String(detail == null ? '' : detail).slice(0, 500)]);
  } catch (e) {}
}
/* Devuelve los últimos envíos (más recientes primero) para el panel.
   Si body.code viene, filtra solo esa reserva (para el resumen del formulario). */
function listSendLog_(b) {
  var sh; try { sh = ensureLogSheet_(); } catch (e) { return { ok: true, log: [] }; }
  if (sh.getLastRow() < 2) return { ok: true, log: [] };
  var wantCode = b && b.code ? normCode_(b.code) : '';
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  var log = rows.map(function (r) {
    return { at: r[0], channel: r[1], code: r[2], property: r[3], to: r[4], status: r[5], detail: r[6] };
  });
  if (wantCode) log = log.filter(function (r) { return normCode_(r.code) === wantCode; });
  var n = (b && b.limit) || 80;
  return { ok: true, log: log.reverse().slice(0, n) };
}
/* Estado del último envío a la propiedad por código y canal, para pintar los botones de reenvío del panel:
   correo según el registro de envíos de aquí; WhatsApp según ALMA (entrega real que confirma Meta) y, si ALMA no
   sabe, según lo que se anotó aquí. e: ok | entregado | leido | cola | error | no_entregado. */
function sendStatus_(b) {
  var codes = ((b && b.codes) || []).map(function (c) { return normCode_(c); }).filter(Boolean).slice(0, 200), want = {};
  codes.forEach(function (c) { want[c] = 1; });
  var out = {};
  codes.forEach(function (c) { out[c] = { email: null, whatsapp: null }; });
  try {
    var sh = ensureLogSheet_();
    if (sh.getLastRow() > 1) {
      var n = Math.min(4000, sh.getLastRow() - 1), rows = sh.getRange(sh.getLastRow() - n + 1, 1, n, 7).getValues();
      rows.forEach(function (r) {
        var c = normCode_(r[2]); if (!want[c]) return;
        var ch = String(r[1]) === 'whatsapp' ? 'whatsapp' : String(r[1]) === 'email' ? 'email' : ''; if (!ch) return;
        var ok = String(r[5]) === 'OK', det = String(r[6] || '');
        out[c][ch] = { e: ok ? (ch === 'whatsapp' && String(r[4]) === 'ALMA' ? 'cola' : 'ok') : 'error', at: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), det: ok ? '' : det.slice(0, 160) };
      });
    }
  } catch (e) {}
  try {
    var hr = UrlFetchApp.fetch(PropertiesService.getScriptProperties().getProperty('HUB_ALMA_URL') || HUB_ALMA_URL_, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ recepcionEstado: 1, codes: codes }) });
    var j = JSON.parse(hr.getContentText() || '{}');
    Object.keys((j && j.estados) || {}).forEach(function (k) {
      var c = normCode_(k), x = j.estados[k]; if (!out[c] || !x) return;
      out[c].whatsapp = { e: x.e, at: new Date(x.ts).toISOString(), det: x.det || '' };
    });
  } catch (e) {}
  return { ok: true, status: out };
}
/* meta (propiedad/fechas) de la fila más reciente de Formularios por código. */
function metaForCode_(code) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Formularios');
  var meta = { code: code };
  var n = normCode_(code);
  if (sh && sh.getLastRow() > 1) {
    var fr = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Formularios'].length).getValues();
    for (var i = fr.length - 1; i >= 0; i--) {
      if (normCode_(fr[i][1]) === n) { meta = { code: fr[i][1], propertyName: fr[i][2], apartment: fr[i][3], checkin: fr[i][4], checkout: fr[i][5] }; break; }
    }
  }
  return meta;
}
/* Reenvía el formulario (PDF) de una reserva por el canal indicado
   (email | whatsapp). El WhatsApp incluye SIEMPRE al administrador. */
/* Al rearmar el PDF desde lo guardado, los huéspedes solo traen el id del documento en Drive (la imagen se pide aparte):
   aquí se trae cada imagen para que el PDF vuelva a llevar los documentos de identificación. */
function conImagenesDoc_(guests) {
  return (guests || []).map(function (g) {
    if (!g || g.docImage || !g.docFileId) return g;
    var img = ''; try { img = driveFileDataUrl_(g.docFileId); } catch (e) {}
    return img ? Object.assign({}, g, { docImage: img }) : g;
  });
}
function resendRegistration_(body) {
  var code = body.code || '';
  var channel = String(body.channel || 'email').toLowerCase();
  var reg = getRegistration_({ code: code });
  if (!reg || !reg.ok) return { ok: false, error: 'registro-no-encontrado' };
  var rec = reg.record;
  var meta = metaForCode_(code);
  rec.guests = conImagenesDoc_(rec.guests);
  var f = { booker: rec.booker, contact: rec.contact, guests: rec.guests, acceptedRulesAt: rec.acceptedRulesAt };
  var pdf = buildRegistrationPdf_(meta, f, rec.guests);
  var contacts = contactsFor_(meta.propertyName || '');
  if (channel === 'whatsapp') {
    var r = notifyWhatsApp_(meta, rec.guests, pdf, contacts.whatsapps, true);
    return { ok: !!(r && r.ok), to: r && r.viaAlma ? 'recepción (ALMA)' : contacts.whatsapps.join(', '), channel: 'whatsapp', error: (r && r.error) || '' };
  }
  var er = notifyStation_(meta, rec.guests, pdf, contacts.emails);
  return { ok: !!(er && er.ok), to: (er && er.to) || contacts.emails.join(', '), channel: 'email', error: (er && er.error) || (contacts.emails.length ? '' : 'sin-correo') };
}
/* Por propiedad: si tiene correo y/o WhatsApp propio (el admin no cuenta),
   para activar/desactivar los íconos de reenvío en el panel. Recibe la lista
   real de nombres del roster (body.names) y usa la MISMA lógica que los envíos
   (contactsFor_: tabla del código por coincidencia + Estaciones). */
function contactsAvailability_(body) {
  var out = {};
  var names = (body && body.names) || [];
  try {
    // agrega también las propiedades conocidas en Estaciones
    (listStations_() || []).forEach(function (s) { if (s.propertyName) names.push(s.propertyName); });
  } catch (e) {}
  uniq_(names).forEach(function (nm) {
    if (!nm) return;
    var c = contactsFor_(nm);
    var ownWa = c.whatsapps.filter(function (w) { return w !== ADMIN_WHATSAPP_; });
    out[nm] = { email: c.emails.length > 0, whatsapp: ownWa.length > 0 };
  });
  return { ok: true, availability: out, admin: ADMIN_WHATSAPP_ };
}

/* ============================================================
   8 · CORREO — remitente con alias (hola@spacioam.com) + nombre
   ============================================================ */
function sendMail_(to, subject, body, htmlBody, attachments) {
  if (!to) return false;
  var cfg = CFG_();
  try {
    var opts = { name: cfg.FROM_NAME || 'Spacio AM' };
    if (cfg.FROM_EMAIL) opts.from = cfg.FROM_EMAIL;
    if (htmlBody) opts.htmlBody = htmlBody;
    if (attachments && attachments.length) opts.attachments = attachments;
    GmailApp.sendEmail(to, subject, body, opts);
    return true;
  } catch (e) {
    try {
      MailApp.sendEmail({ to: to, subject: subject, body: body, name: cfg.FROM_NAME || 'Spacio AM', attachments: attachments || [] });
      return true;
    }
    catch (e2) { return false; }
  }
}

/* Envío de prueba — replica EXACTAMENTE el correo que reciben los encargados
   cuando se completa un formulario (mismo título, texto y branding), con datos
   de ejemplo y el PDF del formulario adjunto (4 huéspedes). */
function sendTestEmail_(b) {
  var to = ((b && b.to) || '').toString().trim();
  if (!to) { var a = adminEmails_(); to = (a && a[0]) ? a[0] : ''; }
  if (!to) return { ok: false, error: 'sin-destinatario' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: 'correo-invalido' };
  var meta = {
    code: 'HMABCD', propertyName: 'Z1 - Centro vivo - 1106', apartment: '1106',
    checkin: '2026-07-17', checkout: '2026-07-19', maxCapacity: 2
  };
  var f = {
    acceptedRulesAt: new Date().toISOString(),
    booker: { type: 'self', phone: '+502 5555 5555', email: 'huesped@ejemplo.com' },
    contact: { email: 'huesped@ejemplo.com', phone: '+502 5555 5555', emergency: '+502 4444 4444' },
    guests: [
      { name: 'María José García Ruiz',    id: '2954 00935 0917', main: true },
      { name: 'Carlos Andrés López Pérez', id: '1888 55421 0101' },
      { name: 'Teresa Yaneth Villatoro',   id: '2011 44872 0305' },
      { name: 'Juan Pablo Méndez Solís',   id: '3021 77812 0410' }
    ]
  };
  var guests = f.guests;
  var c = stationMailContent_(meta, guests);
  var pdf = buildRegistrationPdf_(meta, f, guests);
  var sent = sendMail_(to, c.subject, c.text, c.html, pdf ? [pdf] : null);
  logSend_('prueba-email', meta, to, sent, sent ? 'Correo de prueba enviado' : 'Falló el envío de prueba');
  if (!sent) return { ok: false, error: 'no-enviado', to: to };
  return { ok: true, to: to, sentAt: new Date().toISOString() };
}

/* Prueba de WhatsApp — envía el PDF de ejemplo a los números configurados
   (o al número indicado en body.to). Devuelve el detalle por destinatario
   para diagnosticar. */
function sendTestWhatsApp_(b) {
  var cfg = CFG_();
  if (!cfg.WHATSAPP_TOKEN || !cfg.WHATSAPP_PHONE_ID) return { ok: false, error: 'Falta configurar WHATSAPP_TOKEN / WHATSAPP_PHONE_ID en Propiedades del script.' };
  var override = (b && b.to) ? String(b.to).split(/[,\s;]+/).map(function (s) { return s.replace(/[^\d]/g, ''); }).filter(function (s) { return s.length >= 8; }) : null;
  var nums = override && override.length ? override : (waRecipients_().length ? waRecipients_() : [ADMIN_WHATSAPP_]);
  if (!nums.length) return { ok: false, error: 'No hay números destino. Configura WHATSAPP_TO o escribe uno en el campo.' };
  var meta = {
    code: 'HMABCD', propertyName: 'Z1 - Centro vivo - 1106', apartment: '1106',
    checkin: '2026-07-17', checkout: '2026-07-19', maxCapacity: 2
  };
  var f = {
    acceptedRulesAt: new Date().toISOString(),
    booker: { type: 'self', phone: '+502 5555 5555', email: 'huesped@ejemplo.com' },
    contact: { email: 'huesped@ejemplo.com', phone: '+502 5555 5555', emergency: '+502 4444 4444' },
    guests: [
      { name: 'María José García Ruiz',    id: '2954 00935 0917', main: true },
      { name: 'Carlos Andrés López Pérez', id: '1888 55421 0101' },
      { name: 'Teresa Yaneth Villatoro',   id: '2011 44872 0305' },
      { name: 'Juan Pablo Méndez Solís',   id: '3021 77812 0410' }
    ]
  };
  var pdf = buildRegistrationPdf_(meta, f, f.guests);
  if (!pdf) return { ok: false, error: 'No se pudo generar el PDF de ejemplo.' };
  var up = waUploadMedia_(pdf);
  var mediaId = up.id;
  if (!mediaId) return { ok: false, error: 'Subida del PDF a WhatsApp falló · ' + (up.error || 'sin detalle') };
  var params = [meta.propertyName, meta.code, meta.checkin + ' · 3:00 PM', meta.checkout + ' · 11:00 AM', String(f.guests.length)];
  var results = nums.map(function (n) {
    var r = waSendDocTemplate_(n, mediaId, pdf.getName(), params);
    logSend_('prueba-whatsapp', meta, n, r.ok, r.ok ? 'WhatsApp de prueba enviado' : ('HTTP ' + r.code + ' · ' + String(r.body || '').slice(0, 300)));
    return { to: n, ok: r.ok, code: r.code, detail: r.ok ? '' : r.body };
  });
  var allOk = results.every(function (r) { return r.ok; });
  return { ok: allOk, to: nums.join(', '), results: results,
    error: allOk ? '' : ('Falló al menos un envío: ' + JSON.stringify(results)) };
}

function guestEmailForCode_(code) {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Formularios');
  if (!sh || sh.getLastRow() < 2) return '';
  var n = normCode_(code);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Formularios'].length).getValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (normCode_(rows[i][1]) === n) {
      return (rows[i][12] || rows[i][11] || '').toString().trim(); // contact_email || booker_email
    }
  }
  return '';
}

/* ADMIN → avisa al huésped que su factura está lista.
   Si el administrador adjuntó el archivo de la factura (b.file), se guarda en
   Drive y viaja adjunto en el correo. */
function notifyInvoiceReady_(b) {
  var code = b.code || '';
  var to = b.email || guestEmailForCode_(code);
  if (!to) return { ok: false, error: 'sin-correo-huesped' };

  // archivo adjunto (opcional)
  var att = [], fileUrl = '';
  if (b.file && b.file.data) {
    try {
      var m = /^data:([^;]+);base64,(.*)$/.exec(b.file.data);
      var mime = b.file.mime || (m ? m[1] : 'application/pdf');
      var b64 = m ? m[2] : b.file.data;
      var ext = (String(mime).split('/')[1] || 'pdf').replace('jpeg', 'jpg');
      var fname = b.file.name || ('factura_' + normCode_(code) + '.' + ext);
      var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, fname);
      att.push(blob);
      var root = DriveApp.getFolderById(CFG_().DRIVE_FOLDER);
      var fol = getOrCreateFolder_(root, 'Facturas');
      var dup = fol.getFilesByName(fname);
      while (dup.hasNext()) dup.next().setTrashed(true);
      fileUrl = fol.createFile(blob).getUrl();
    } catch (e) {
      return { ok: false, error: 'no-se-pudo-adjuntar: ' + String(e && e.message || e) };
    }
  }

  var subject = 'Tu factura está lista · Spacio AM';
  var shell = emailShell_({
    eyebrow: 'Factura',
    heading: 'Tu factura está lista',
    image: EMAIL_IMG_.invoice,
    paras: ['Tu factura de la reserva <b>' + esc_(code) + '</b>' + (b.apartment ? ' (' + esc_(b.apartment) + ')' : '') + ' ya está lista.',
            att.length ? 'La encontrarás adjunta a este correo. Gracias por elegir Spacio AM.'
                       : 'La encontrarás en tu plataforma de reserva o te la hará llegar nuestro equipo. Gracias por elegir Spacio AM.'],
    signoff: 'Con cariño,\nSpacio AM'
  });
  var sent = sendMail_(to, subject, shell.text, shell.html, att.length ? att : null);
  try {
    var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Facturas');
    if (sh && sh.getLastRow() > 1) {
      var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Facturas'].length).getValues();
      for (var i = 0; i < rows.length; i++) {
        if (normCode_(rows[i][1]) === normCode_(code)) {
          sh.getRange(i + 2, 9).setValue('lista');
          if (fileUrl) sh.getRange(i + 2, 10).setValue(fileUrl);
        }
      }
    }
  } catch (e) {}
  return { ok: sent, to: to, fileUrl: fileUrl };
}

/* ADMIN → aprueba una visita y avisa al huésped */
function approveGuestAccess_(b) {
  var code = b.code || '';
  var to = b.email || guestEmailForCode_(code);
  var subject = 'Tu solicitud de ingreso fue aprobada · Spacio AM';
  var shell = emailShell_({
    eyebrow: 'Ingreso de invitados',
    heading: 'Tu solicitud fue aprobada',
    image: EMAIL_IMG_.goodnews,
    paras: ['Tu solicitud de ingreso de invitados para la reserva <b>' + esc_(code) + '</b>' + (b.apartment ? ' (' + esc_(b.apartment) + ')' : '') + ' fue aprobada.',
            'Recuerda que el ingreso de invitados es de 6:00 a.m. a 6:00 p.m. Gracias por elegir Spacio AM.'],
    signoff: 'Con cariño,\nSpacio AM'
  });
  var sent = to ? sendMail_(to, subject, shell.text, shell.html) : false;
  try {
    var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Invitados');
    if (sh && sh.getLastRow() > 1) {
      var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Invitados'].length).getValues();
      for (var i = 0; i < rows.length; i++) {
        if (normCode_(rows[i][1]) === normCode_(code) && rows[i][9] === 'requiere-aprobación') {
          sh.getRange(i + 2, 10).setValue('aprobado');
        }
      }
    }
  } catch (e) {}
  return { ok: sent, to: to };
}

/* ============================================================
   9 · ADMINS ADICIONALES (multi-dispositivo)
   El admin principal se define en la app (jovalle@spacioam.com);
   aquí se guardan los accesos que él crea. Contraseñas hasheadas.
   ============================================================ */
function listAdmins_() {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Admins');
  if (!sh || sh.getLastRow() < 2) return [];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Admins'].length).getValues();
  return rows.filter(function (r) { return r[1]; }).map(function (r) { return { email: String(r[1]).toLowerCase() }; });
}

function saveAdmin_(b) {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Admins');
  if (!sh) return { ok: false, error: 'no-sheet:Admins' };
  var email = (b.email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'email requerido' };
  if (!b.password) return { ok: false, error: 'password requerido' };
  var hash = sha256_(b.password);
  var found = 0;
  if (sh.getLastRow() > 1) {
    var emails = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) { if (String(emails[i][0]).toLowerCase() === email) { found = i + 2; break; } }
  }
  var row = [ nowISO_(), email, hash, b.createdBy || '' ];
  if (found) sh.getRange(found, 1, 1, SCHEMA_['Admins'].length).setValues([row]);
  else sh.appendRow(row);
  return { ok: true };
}

function removeAdmin_(b) {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Admins');
  if (!sh || sh.getLastRow() < 2) return { ok: true };
  var email = (b.email || '').trim().toLowerCase();
  var emails = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
  for (var i = emails.length - 1; i >= 0; i--) {
    if (String(emails[i][0]).toLowerCase() === email) sh.deleteRow(i + 2);
  }
  return { ok: true };
}

/* valida credenciales de un admin adicional (el principal se valida en la app) */
function adminLogin_(b) {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Admins');
  if (!sh || sh.getLastRow() < 2) return { ok: false };
  var email = (b.email || '').trim().toLowerCase();
  var hash = b.password ? sha256_(b.password) : '';
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Admins'].length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase() === email && rows[i][2] === hash && hash) return { ok: true, email: email };
  }
  return { ok: false };
}

function phone_(p) {
  if (!(p && p.number)) return '';
  // Prefijo apóstrofe: fuerza a Sheets a guardar el teléfono como TEXTO. Sin
  // esto, un valor que empieza con "+" (ej. +502 5690 9499) se interpreta como
  // fórmula y produce #ERROR!. El apóstrofe no se muestra ni se lee de vuelta.
  return "'" + ((p.code || '+502') + ' ' + p.number);
}
function slug_(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
}
function checkoutPlusMonths_(checkout, months) {
  var d = checkout ? new Date(checkout + 'T12:00:00') : new Date();
  d.setMonth(d.getMonth() + (months || 3));
  return d.toISOString();
}
function sha256_(str) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/* ============================================================
   12 · INVITADOS · STREAMING · REINICIO DE FORMULARIO · DESPEDIDA
   Añadido 03/08/2026.
   ============================================================ */

/* --- Solicitudes de nuevos invitados (pestaña Invitados) ---
   Devuelve grupos: una solicitud = un envío del huésped (mismo code + minuto). */
function listGuestAccess_() {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Invitados');
  if (!sh || sh.getLastRow() < 2) return [];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Invitados'].length).getValues();
  // DEPURACIÓN AUTOMÁTICA: al terminar la reserva la solicitud de invitados ya
  // no sirve — se archiva en la hoja y desaparece del panel.
  var today = isoDate_(new Date());
  var checkoutOf = {};
  try {
    listCached_().forEach(function (r) { checkoutOf[normCode_(r.code)] = r.checkout || ''; });
  } catch (e) {}
  var archived = [];
  var map = {};
  rows.forEach(function (r, idx) {
    var status = String(r[9] || '');
    if (status === 'eliminado' || status === 'archivado') return;
    var code = String(r[1] || '');
    var co = checkoutOf[normCode_(code)] || '';
    if (co && today > co) { archived.push(idx + 2); return; }
    var at = r[0] ? new Date(r[0]).getTime() : 0;
    var key = normCode_(code) + '|' + Math.floor(at / 60000);
    if (!map[key]) map[key] = { id: key, at: at, code: code, apartment: String(r[2] || ''), needsApproval: String(r[8] || '') === 'sí', status: status, guests: [] };
    map[key].guests.push({ name: String(r[3] || ''), doc: String(r[4] || ''), id: String(r[5] || ''), date: String(r[6] || '').slice(0, 10), time: String(r[7] || '') });
    // el estado más "resuelto" gana
    if (status === 'aprobado' || status === 'rechazado') map[key].status = status;
  });
  var out = Object.keys(map).map(function (k) { return map[k]; });
  out.sort(function (a, b) { return b.at - a.at; });
  if (archived.length) {
    try { archived.forEach(function (row) { sh.getRange(row, 10).setValue('archivado'); }); } catch (e) {}
  }
  return out.slice(0, 120);
}

/* ADMIN → aprueba / rechaza / elimina una solicitud de invitados y avisa al huésped */
function resolveGuestAccess_(b) {
  var decision = b.decision || '';
  var status = decision === 'approved' ? 'aprobado' : (decision === 'rejected' ? 'rechazado' : 'eliminado');
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Invitados');
  var touched = 0;
  if (sh && sh.getLastRow() > 1) {
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Invitados'].length).getValues();
    for (var i = 0; i < rows.length; i++) {
      var at = rows[i][0] ? new Date(rows[i][0]).getTime() : 0;
      var key = normCode_(String(rows[i][1] || '')) + '|' + Math.floor(at / 60000);
      if (key === b.id) { sh.getRange(i + 2, 10).setValue(status); touched++; }
    }
  }
  if (decision === 'approved') { try { approveGuestAccess_({ code: b.code, apartment: b.apartment }); } catch (e) {} }
  if (decision === 'rejected') {
    try {
      var to = guestEmailForCode_(b.code || '');
      if (to) {
        var shell = emailShell_({
          eyebrow: 'Ingreso de invitados', heading: 'Sobre tu solicitud de invitados', image: EMAIL_IMG_.alt,
          paras: ['Gracias por avisarnos con tiempo. Por esta vez no podremos autorizar el ingreso solicitado.',
                  'Escríbenos y buscamos juntos la mejor manera de acompañarte.'],
          signoff: 'Con cariño,\nSpacio AM'
        });
        sendMail_(to, 'Sobre tu solicitud de invitados · Spacio AM', shell.text, shell.html);
      }
    } catch (e) {}
  }
  return { ok: true, rows: touched };
}

/* --- Foto del QR de streaming enviada por el huésped --- */
function streamingRequest_(b) {
  var code = b.code || '';
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Streaming') || ss.insertSheet('Streaming');
  var url = '', id = '';
  try {
    var data = String(b.image || '');
    var m = data.match(/^data:([^;]+);base64,(.*)$/);
    if (m) {
      var parent = DriveApp.getFolderById(CFG_().DRIVE_FOLDER);
      var folder = getOrCreateFolder_(parent, 'Streaming');
      var ext = m[1].indexOf('png') >= 0 ? 'png' : 'jpg';
      var name = [Utilities.formatDate(new Date(), 'GMT-6', 'yyyy-MM-dd_HHmm'), slug_(b.apartment || code), 'qr'].join('_') + '.' + ext;
      var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name));
      url = file.getUrl(); id = file.getId();
    }
  } catch (e) {}
  sh.appendRow([nowISO_(), code, b.apartment || '', url, id, b.note || '', 'pendiente']);
  try {
    var admins = adminNotifyEmails_();
    try {
      var resv = findInReservasSheet_(code);
      var st = stationFor_(resv ? resv.propertyName : (b.apartment || ''));
      if (st) {
        [st.email1, st.email2].forEach(function (e2) { if (e2 && String(e2).trim()) admins += ',' + String(e2).trim(); });
      }
    } catch (e) {}
    if (admins) {
      var shell = emailShell_({
        eyebrow: 'Streaming', heading: 'Un huésped envió el QR de su TV', image: EMAIL_IMG_.adminAlert,
        paras: ['Reserva <b>' + esc_(code) + '</b>' + (b.apartment ? ' · ' + esc_(b.apartment) : '') + '.',
                url ? ('Foto del código: <a href="' + url + '">abrir en Drive</a>') : 'La foto no pudo guardarse; revisa el panel.'],
        cta: { label: 'Abrir el panel', url: 'https://hola.spacioam.com' }, signoff: 'Spacio AM'
      });
      sendMail_(admins, 'QR de streaming · ' + (b.apartment || code), shell.text, shell.html);
    }
  } catch (e) {}
  return { ok: true, url: url };
}

/* correos de aviso al equipo: admins registrados (o el correo de marca) */
function adminNotifyEmails_() {
  try {
    var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Admins');
    if (sh && sh.getLastRow() > 1) {
      var rows = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
      var em = rows.map(function (r) { return String(r[0] || '').trim(); }).filter(String);
      if (em.length) return em.join(',');
    }
  } catch (e) {}
  return 'hola@spacioam.com';
}

function listStreaming_() {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Streaming');
  if (!sh || sh.getLastRow() < 2) return [];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Streaming'].length).getValues();
  var out = [];
  rows.forEach(function (r, i) {
    var status = String(r[6] || 'pendiente');
    if (status === 'eliminado') return;
    var at = r[0] ? new Date(r[0]).getTime() : 0;
    out.push({ id: normCode_(String(r[1] || '')) + '|' + at, at: at, code: String(r[1] || ''), apartment: String(r[2] || ''), url: String(r[3] || ''), note: String(r[5] || ''), status: status });
  });
  out.sort(function (a, b) { return b.at - a.at; });
  return out.slice(0, 80);
}

function resolveStreaming_(b) {
  var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName('Streaming');
  if (!sh || sh.getLastRow() < 2) return { ok: true };
  var status = b.action === 'delete' ? 'eliminado' : (b.action === 'reopen' ? 'pendiente' : 'resuelto');
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Streaming'].length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var at = rows[i][0] ? new Date(rows[i][0]).getTime() : 0;
    if (normCode_(String(rows[i][1] || '')) + '|' + at === b.id) sh.getRange(i + 2, 7).setValue(status);
  }
  return { ok: true };
}

/* --- REINICIAR FORMULARIO ---
   El admin libera una reserva para que el huésped vuelva a llenar su registro:
   Reservas.status_form vuelve a vacío y las filas anteriores del formulario
   quedan marcadas como 'reiniciado' (no se borra nada: queda la traza). */
function resetForm_(b) {
  var code = normCode_(b.code || '');
  if (!code) return { ok: false, error: 'code-required' };
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  try { markReservaStatus_(ss, b.code, ''); } catch (e) {}
  // marca de corte: lo enviado antes de este momento ya no se lee
  try {
    var shR = ss.getSheetByName('Reinicios') || ss.insertSheet('Reinicios');
    if (shR.getLastRow() === 0) shR.appendRow(SCHEMA_['Reinicios']);
    shR.appendRow([nowISO_(), b.code || '', b.by || '']);
  } catch (e) {}
  var n = 0;
  try {
    var sh = ss.getSheetByName('Formularios');
    if (sh && sh.getLastRow() > 1) {
      var last = SCHEMA_['Formularios'].length;
      var rows = sh.getRange(2, 1, sh.getLastRow() - 1, last).getValues();
      for (var i = 0; i < rows.length; i++) {
        if (normCode_(rows[i][1]) === code) { sh.getRange(i + 2, last).setValue('reiniciado'); n++; }
      }
    }
  } catch (e) {}
  try { draftClear_(code); } catch (e) {}
  try { logSend_('reinicio-formulario', { code: b.code }, b.by || '', true, 'Formulario reiniciado por el administrador'); } catch (e) {}
  return { ok: true, rows: n };
}

/* ============================================================
   DESPEDIDA — correo la mañana del checkout (7:30 a.m. GMT-6)
   ============================================================ */
function ensureCheckoutTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkoutMorningEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkoutMorningEmails').timeBased().atHour(7).nearMinute(30).everyDays(1).create();
}

function checkoutMorningEmails() {
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID);
  var sh = ss.getSheetByName('Reservas');
  if (!sh || sh.getLastRow() < 2) return 0;
  var today = Utilities.formatDate(new Date(), 'GMT-6', 'yyyy-MM-dd');
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA_['Reservas'].length).getValues();
  var log = ss.getSheetByName('Salidas') || ss.insertSheet('Salidas');
  var already = {};
  if (log.getLastRow() > 1) {
    log.getRange(2, 1, log.getLastRow() - 1, SCHEMA_['Salidas'].length).getValues().forEach(function (r) {
      already[normCode_(String(r[1] || '')) + '|' + String(r[2] || '').slice(0, 10)] = true;
    });
  }
  var sent = 0, seen = {};
  rows.forEach(function (r) {
    var code = String(r[0] || '');
    var co = String(r[4] || '').slice(0, 10);
    if (!code || co !== today) return;
    var key = normCode_(code) + '|' + today;
    if (already[key] || seen[key]) return;
    seen[key] = true;
    var to = '';
    try { to = guestEmailForCode_(code); } catch (e) {}
    if (!to) { log.appendRow([nowISO_(), code, today, '', 'sin-correo']); return; }
    var c = checkoutFarewellContent_({ code: code, propertyName: String(r[1] || ''), firstName: String(r[5] || '') });
    var ok = false;
    try { ok = sendMail_(to, c.subject, c.text, c.html); } catch (e) {}
    log.appendRow([nowISO_(), code, today, to, ok ? 'enviado' : 'error']);
    try { logSend_('despedida-checkout', { code: code, propertyName: String(r[1] || '') }, to, ok, ok ? 'Correo de despedida enviado' : 'No se pudo enviar'); } catch (e) {}
    if (ok) sent++;
  });
  return sent;
}

/* Contenido del correo de despedida — instrucciones de salida + mensaje cálido. */
function checkoutFarewellContent_(meta) {
  var name = String(meta.firstName || '').trim();
  var hi = name ? (name + ', hoy es día de despedida.') : 'Hoy es día de despedida.';
  var steps = [
    'La salida es a las 11:00 a.m. Nuestro equipo de limpieza llega a esa hora para preparar el espacio.',
    'Avísanos por la app o por WhatsApp en el momento en que salgas.',
    'Deja la tarjeta o la llave en el mismo lugar donde las encontraste al llegar.',
    'Revisa que no quede nada tuyo: cargadores, documentos, el abrigo detrás de la puerta.'
  ];
  var listHtml = '<ol style="margin:14px 0 0;padding-left:20px;font-family:Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.78;color:#3E3F3F;">'
    + steps.map(function (s) { return '<li style="margin:6px 0;">' + esc_(s) + '</li>'; }).join('') + '</ol>';
  var shell = emailShell_({
    eyebrow: 'Tu check-out',
    heading: hi,
    image: EMAIL_IMG_.living,
    paras: [
      'Gracias por dejarnos ser tu casa estos días. El café de la mañana, la luz entrando por la ventana, el silencio de la noche — nos gusta pensar que algo de todo eso te acompaña de regreso.',
      '<b>Antes de irte</b>' + listHtml,
      'Una tarjeta o llave no devuelta tiene un costo de reposición de $50.',
      'Si algo se queda olvidado, escríbenos: lo guardamos y lo coordinamos contigo.'
    ],
    rows: [['Reserva', meta.code || ''], ['Alojamiento', meta.propertyName || ''], ['Salida', '11:00 a.m.']],
    footerNote: 'Hay espacios donde despertar se siente como un sueño. Este ya es uno de los tuyos.',
    signoff: 'Con cariño,\nSpacio AM'
  });
  return { subject: 'Hasta pronto ✦ Spacio AM', html: shell.html, text: shell.text };
}

/* ============================================================
   LT · LONG TERM — reservas de estancia larga con cobro periódico
   Hojas: LT_Reservas · LT_Huespedes · LT_Pagos · LT_Comprobantes ·
          LT_Mensajes · LT_Envios  (se crean/actualizan con ltSetup()).
   Periodos: mensual (se cobra el MES, p. ej. "mayo 2026") · quincenal ·
             semanal · personalizado (cada N días). El admin puede ajustar
             monto y vencimiento de cada periodo.
   Luz: si la reserva cobra luz, cada periodo tiene un segundo cobro
        (concepto "luz") con su propio comprobante. El monto lo pone el admin.
   Propiedades del script:
     LT_DIAS  días de recordatorio respecto al vencimiento (def. -3,0,3)
     LT_KEY   clave de cifrado del token (se genera sola; no la borres)
   Trigger: ltSetup() instala ltDailyReminders a las 8 am (hora GT).
   ============================================================ */
var LT_SCHEMA_ = {
  LT_Reservas: ['codigo_lt','propiedad_code','propiedad_nombre','entrada','tipo_fin','salida','monto','moneda','dia_cobro','notas','token_hash','token_activo','estado','creado','actualizado','token_enc','frecuencia','cada_dias','cobra_luz','aviso_salida','aviso_creado','aviso_motivo'],
  LT_Huespedes: ['codigo_lt','nombre','telefono','email','doc_tipo','doc_numero','doc_file_id','actualizado'],
  LT_Pagos: ['periodo_id','codigo_lt','periodo','vence','monto','moneda','estado','motivo_rechazo','comprobante_id','verificado_at','concepto','inicio','fin','ajustado'],
  LT_Comprobantes: ['comp_id','codigo_lt','periodo_ids','file_ids','referencia','fecha_pago','monto_pagado','comentario','creado','concepto','hash','banco','asignacion','alertas','lectura'],
  LT_Mensajes: ['msg_id','codigo_lt','autor','texto','creado','leido'],
  LT_Envios: ['envio_id','codigo_lt','periodo_id','tipo','canal','destino','estado','creado']
};
var LT_TZ_ = 'America/Guatemala';
var LT_FREQ_DAYS_ = { quincenal: 15, semanal: 7 };
var LT_MESES_ = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var LT_MES3_ = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function ltSetup() {
  // Resumible: si Sheets da timeout, vuelve a correrlo; salta lo que ya existe.
  var ss = ltRetry_(function () { return SpreadsheetApp.openById(CFG_().SHEET_ID); }), hechas = [];
  Object.keys(LT_SCHEMA_).forEach(function (n) {
    ltRetry_(function () {
      var sh = ss.getSheetByName(n), h = LT_SCHEMA_[n];
      if (!sh) { sh = ss.insertSheet(n); SpreadsheetApp.flush(); }
      var cur = sh.getLastColumn() ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), h.length)).getValues()[0].slice(0, h.length).join('|') : '';
      if (cur !== h.join('|')) {
        sh.getRange(1, 1, 1, h.length).setValues([h]);
        try { sh.getRange(1, 1, 1, h.length).setFontWeight('bold').setBackground('#3E3F3F').setFontColor('#FAFAFA'); sh.setFrozenRows(1); } catch (e) {}
        SpreadsheetApp.flush();
      }
    });
    hechas.push(n);
  });
  ltRetry_(function () {
    var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'ltDailyReminders'; });
    if (!has) ScriptApp.newTrigger('ltDailyReminders').timeBased().atHour(8).everyDays(1).inTimezone(LT_TZ_).create();
  });
  ltKey_();
  Logger.log('LT listo: ' + hechas.join(', '));
  return 'LT listo';
}
function ltRetry_(fn) {
  for (var i = 0; i < 4; i++) {
    try { return fn(); } catch (e) {
      if (i === 3 || !/timed out|tiempo|Service|Servicio|temporar/i.test(String(e))) throw e;
      Utilities.sleep(2000 * (i + 1));
    }
  }
}

/* ---------- utilidades ---------- */
var LT_SH_CACHE_ = {}, LT_ROWS_CACHE_ = {}, LT_SS_ = null, LT_BUSTED_ = false;
function ltDirty_(n) { delete LT_ROWS_CACHE_[n]; ltBust_(); }
/* caché del listado (CacheService, en trozos): cualquier escritura cambia la versión y lo invalida */
function ltBust_() { if (LT_BUSTED_) return; LT_BUSTED_ = true; try { CacheService.getScriptCache().put('lt_ver', Utilities.getUuid().slice(0, 8), 21600); } catch (e) {} }
function ltVer_() { var c = CacheService.getScriptCache(), v = c.get('lt_ver'); if (!v) { v = Utilities.getUuid().slice(0, 8); c.put('lt_ver', v, 21600); } return v; }
function ltCacheGet_(k, ver) {
  try {
    var c = CacheService.getScriptCache(), head = c.get(k + '_h'); if (!head) return null;
    var h = head.split('|'); if (h[0] !== ver) return null;
    var n = +h[1], keys = []; for (var i = 0; i < n; i++) keys.push(k + '_' + i);
    var m = c.getAll(keys), s = ''; for (var j = 0; j < n; j++) { if (m[keys[j]] == null) return null; s += m[keys[j]]; }
    return JSON.parse(s);
  } catch (e) { return null; }
}
function ltCachePut_(k, ver, o) {
  try {
    var s = JSON.stringify(o), size = 40000, n = Math.ceil(s.length / size), parts = {}; if (n > 40) return;
    for (var i = 0; i < n; i++) parts[k + '_' + i] = s.substr(i * size, size);
    parts[k + '_h'] = ver + '|' + n; CacheService.getScriptCache().putAll(parts, 300);
  } catch (e) {}
}
function ltSh_(n) {
  if (LT_SH_CACHE_[n]) return LT_SH_CACHE_[n];
  var ss = LT_SS_ || (LT_SS_ = SpreadsheetApp.openById(CFG_().SHEET_ID)), sh = ss.getSheetByName(n), h = LT_SCHEMA_[n];
  if (!sh) { sh = ss.insertSheet(n); sh.getRange(1, 1, 1, h.length).setValues([h]); sh.setFrozenRows(1); }
  else if (sh.getLastColumn() < h.length) sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#3E3F3F').setFontColor('#FAFAFA');
  LT_SH_CACHE_[n] = sh; return sh;
}
/* lecturas en caché por ejecución: cada escritura invalida su hoja */
function ltRows_(n) {
  if (LT_ROWS_CACHE_[n]) return LT_ROWS_CACHE_[n];
  var sh = ltSh_(n), h = LT_SCHEMA_[n], last = sh.getLastRow();
  if (last < 2) return (LT_ROWS_CACHE_[n] = []);
  return (LT_ROWS_CACHE_[n] = sh.getRange(2, 1, last - 1, h.length).getValues().map(function (r, i) {
    var o = { _row: i + 2 }; h.forEach(function (k, j) { var v = r[j];
      // Sheets convierte "2026-06" en fecha: se devuelve a texto para que el periodo no se lea distinto y se duplique
      if (k === 'periodo' && v instanceof Date) { var dd = Utilities.formatDate(v, LT_TZ_, 'yyyy-MM-dd'); o[k] = dd.slice(8) === '01' ? dd.slice(0, 7) : dd; return; }
      o[k] = v instanceof Date ? Utilities.formatDate(v, LT_TZ_, "yyyy-MM-dd'T'HH:mm:ss") : v; }); return o;
  }));
}
function ltAppend_(n, o) { ltAppendMany_(n, [o]); }
function ltAppendMany_(n, list) {
  if (!list.length) return;
  var sh = ltSh_(n), h = LT_SCHEMA_[n];
  sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, list.length, h.length).setValues(list.map(function (o) { return h.map(function (k) { var v = o[k] == null ? '' : o[k]; return k === 'periodo' && v !== '' ? "'" + v : v; }); }));
  ltDirty_(n);
}
function ltUpdate_(n, row, o) {
  var sh = ltSh_(n), h = LT_SCHEMA_[n], keys = Object.keys(o).filter(function (k) { return h.indexOf(k) >= 0; });
  if (!keys.length) return;
  if (keys.length === 1) sh.getRange(row, h.indexOf(keys[0]) + 1).setValue(o[keys[0]]);
  else {   // una lectura + una escritura por fila, en vez de una llamada por celda
    var rg = sh.getRange(row, 1, 1, h.length), v = rg.getValues()[0];
    keys.forEach(function (k) { v[h.indexOf(k)] = o[k]; }); rg.setValues([v]);
  }
  ltDirty_(n);
}
/* borra todas las filas de un código reescribiendo el bloque (3 llamadas por hoja) */
function ltPurge_(n, code) {
  var sh = ltSh_(n), h = LT_SCHEMA_[n], last = sh.getLastRow(), ci = h.indexOf('codigo_lt');
  if (last < 2 || ci < 0) return 0;
  var rg = sh.getRange(2, 1, last - 1, h.length), vals = rg.getValues();
  var keep = vals.filter(function (v) { return normCode_(v[ci]) !== code; });
  if (keep.length === vals.length) return 0;
  rg.clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, h.length).setValues(keep);
  ltDirty_(n);
  return vals.length - keep.length;
}
function ltTrue_(v) { return v === true || String(v).toLowerCase() === 'true'; }
function ltNow_() { return Utilities.formatDate(new Date(), LT_TZ_, "yyyy-MM-dd'T'HH:mm:ss"); }
function ltToday_() { return Utilities.formatDate(new Date(), LT_TZ_, 'yyyy-MM-dd'); }
function ltId_(p) { return p + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase(); }
function ltIso_(v) { return String(v || '').slice(0, 10); }
function ltD_(iso) { var p = ltIso_(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
function ltFmt_(d) { return Utilities.formatDate(d, LT_TZ_, 'yyyy-MM-dd'); }
function ltAdd_(iso, n) { var d = ltD_(iso); d.setDate(d.getDate() + n); return ltFmt_(d); }
function ltHash_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))); }
function ltKey_() {
  var p = PropertiesService.getScriptProperties(), k = p.getProperty('LT_KEY');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('LT_KEY', k); }
  return k;
}
/* cifrado simétrico: XOR con flujo HMAC-SHA256(clave, nonce|bloque) */
function ltStream_(nonce, len) {
  var out = [], key = ltKey_(), i = 0;
  while (out.length < len) { out = out.concat(Utilities.computeHmacSha256Signature(nonce + '|' + i, key)); i++; }
  return out.slice(0, len);
}
function ltEnc_(txt) {
  var nonce = Utilities.getUuid().slice(0, 8), b = Utilities.newBlob(txt).getBytes(), s = ltStream_(nonce, b.length);
  return nonce + '.' + Utilities.base64EncodeWebSafe(b.map(function (x, i) { return x ^ s[i]; }));
}
function ltDec_(enc) {
  try {
    var p = String(enc || '').split('.'); if (p.length !== 2) return '';
    var b = Utilities.base64DecodeWebSafe(p[1]), s = ltStream_(p[0], b.length);
    return Utilities.newBlob(b.map(function (x, i) { return x ^ s[i]; })).getDataAsString();
  } catch (e) { return ''; }
}
function ltNewToken_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8); }
function ltUrl_(token) { return String(CFG_().APP_URL || 'https://hola.spacioam.com').replace(/[?#].*$/, '').replace(/\/+$/, '') + '/?lt=' + token; }
function ltLinkOf_(r) { var t = ltDec_(r.token_enc); return (t && ltHash_(t) === r.token_hash && ltTrue_(r.token_activo)) ? ltUrl_(t) : ''; }
function ltRes_(code) { var c = normCode_(code); return ltRows_('LT_Reservas').filter(function (r) { return normCode_(r.codigo_lt) === c; })[0] || null; }
function ltByToken_(token) {
  if (!token) return null; var h = ltHash_(token);
  return ltRows_('LT_Reservas').filter(function (r) { return r.token_hash === h && ltTrue_(r.token_activo); })[0] || null;
}
function ltGuestOf_(code) { var c = normCode_(code); return ltRows_('LT_Huespedes').filter(function (r) { return normCode_(r.codigo_lt) === c; })[0] || null; }
function ltOf_(n, code) { var c = normCode_(code); return ltRows_(n).filter(function (r) { return normCode_(r.codigo_lt) === c; }); }
function ltFolder_(code) {
  var root = DriveApp.getFolderById(CFG_().DRIVE_FOLDER), f = root.getFoldersByName('LongTerm');
  var lt = f.hasNext() ? f.next() : root.createFolder('LongTerm'), g = lt.getFoldersByName(code);
  return g.hasNext() ? g.next() : lt.createFolder(code);
}
function ltSaveFile_(code, dataUrl, name) {
  var m = /^data:([^;]+);base64,(.*)$/.exec(String(dataUrl || '')); if (!m) return '';
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name);
  return ltFolder_(code).createFile(blob).getId();   // privado: sin compartir
}
function ltConcepto_(p) { return p.concepto === 'luz' ? 'luz' : 'renta'; }
function ltMoney_(v, cur) { return (cur === 'USD' ? 'US$ ' : 'Q ') + Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function ltFirst_(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
/* "mayo 2026" para mensual · "1 – 14 may 2026" para otros */
function ltPerLabel_(p) {
  var per = String(p.periodo || '');
  if (/^\d{4}-\d{2}$/.test(per)) { var x = per.split('-'); return LT_MESES_[+x[1] - 1] + ' ' + x[0]; }
  var a = ltD_(p.inicio || per), b = ltD_(p.fin || p.inicio || per);
  var sameM = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return a.getDate() + (sameM ? '' : ' ' + LT_MES3_[a.getMonth()]) + ' – ' + b.getDate() + ' ' + LT_MES3_[b.getMonth()] + ' ' + b.getFullYear();
}
function ltDateLabel_(iso) { if (!iso) return ''; var d = ltD_(iso); return d.getDate() + ' ' + LT_MES3_[d.getMonth()] + ' ' + d.getFullYear(); }

/* ---------- periodos ---------- */
function ltFreqDays_(r) { var f = r.frecuencia || 'mensual'; return f === 'mensual' ? 0 : (f === 'personalizado' ? Math.max(1, +r.cada_dias || 30) : LT_FREQ_DAYS_[f] || 30); }
function ltEnsurePeriods_(r) {
  if (!r || r.estado === 'terminada') return;
  // bloqueo: varias peticiones a la vez (listado, detalle, huésped) ya no generan periodos repetidos
  var lock = LockService.getScriptLock(), mine = false; try { mine = lock.tryLock(15000); } catch (e) {}
  try { ltDirty_('LT_Pagos'); ltEnsureLocked_(r); } finally { if (mine) try { lock.releaseLock(); } catch (e) {} }
}
/* un periodo = concepto + fecha de inicio (no depende de cómo Sheets guardó la columna "periodo") */
function ltPk_(p) { return ltConcepto_(p) + '|' + ltIso_(p.inicio); }
function ltRank_(p) { return p.estado === 'verificado' ? 5 : p.estado === 'revision' ? 4 : p.comprobante_id ? 3 : ltTrue_(p.ajustado) ? 2 : p.estado === 'rechazado' ? 1 : 0; }
/* limpia duplicados: por cada periodo conserva el más avanzado (verificado > revisión > con comprobante > ajustado) */
function ltDedupe_(code) {
  var best = {}, drop = {};
  ltOf_('LT_Pagos', code).forEach(function (p) {
    var k = ltPk_(p), b = best[k];
    if (!b) { best[k] = p; return; }
    if (ltRank_(p) > ltRank_(b)) { drop[b._row] = 1; best[k] = p; } else drop[p._row] = 1;
  });
  var rows = Object.keys(drop).map(Number); if (!rows.length) return 0;
  var sh = ltSh_('LT_Pagos'), h = LT_SCHEMA_.LT_Pagos, last = sh.getLastRow(), rg = sh.getRange(2, 1, last - 1, h.length), vals = rg.getValues();
  var keep = vals.filter(function (v, i) { return !drop[i + 2]; });
  rg.clearContent(); if (keep.length) sh.getRange(2, 1, keep.length, h.length).setValues(keep);
  ltDirty_('LT_Pagos'); return rows.length;
}
function ltEnsureLocked_(r) {
  ltDedupe_(r.codigo_lt);
  var pagos = ltOf_('LT_Pagos', r.codigo_lt), have = {};
  pagos.forEach(function (p) { have[ltPk_(p)] = p; });
  var entrada = ltIso_(r.entrada), salida = r.tipo_fin === 'fecha' ? ltIso_(r.salida) : '';
  var horizon = salida || ltAdd_(ltToday_(), 62);   // indefinido: ~2 meses adelante
  var list = [], step = ltFreqDays_(r);
  if (!step) {
    var e = entrada.split('-'), y = +e[0], m = +e[1] - 1, day = +r.dia_cobro || +e[2];
    for (var g = 0; g < 240; g++) {
      var first = ltFmt_(new Date(y, m, 1, 12)); if (first > horizon) break;
      var last = new Date(y, m + 1, 0).getDate(), lastIso = ltFmt_(new Date(y, m, last, 12));
      if (salida && first >= salida) break;
      // día de cobro fijo; si el mes no lo tiene (p. ej. 30 en febrero) → último día del mes; nunca antes de la entrada
      var ven = ltFmt_(new Date(y, m, Math.min(day, last), 12)); if (ven < entrada) ven = entrada;
      list.push({ periodo: y + '-' + ('0' + (m + 1)).slice(-2), inicio: first < entrada ? entrada : first, fin: salida && salida <= lastIso ? ltAdd_(salida, -1) : lastIso, vence: ven });
      m++; if (m > 11) { m = 0; y++; }
    }
  } else {
    for (var ini = entrada, k = 0; ini <= horizon && k < 400; k++) {
      if (salida && ini >= salida) break;
      var fin = ltAdd_(ini, step - 1); if (salida && fin >= salida) fin = ltAdd_(salida, -1);
      list.push({ periodo: ini, inicio: ini, fin: fin, vence: ini });
      ini = ltAdd_(ini, step);
    }
  }
  var luz = ltTrue_(r.cobra_luz), add = [], today = ltToday_(), st = function (v) { return v < today ? 'vencido' : 'pendiente'; };
  list.forEach(function (x) {
    if (!have['renta|' + x.inicio]) add.push({ periodo_id: ltId_('P'), codigo_lt: r.codigo_lt, periodo: x.periodo, vence: x.vence, monto: r.monto, moneda: r.moneda,
      estado: st(x.vence), concepto: 'renta', inicio: x.inicio, fin: x.fin, ajustado: false });
    var lv = ltAdd_(x.fin, 10);   // luz: control aparte, sin monto fijo, nunca "vencida" ni recordada
    if (luz && !have['luz|' + x.inicio]) add.push({ periodo_id: ltId_('P'), codigo_lt: r.codigo_lt, periodo: x.periodo, vence: lv, monto: 0, moneda: r.moneda,
      estado: 'pendiente', concepto: 'luz', inicio: x.inicio, fin: x.fin, ajustado: false });
  });
  ltAppendMany_('LT_Pagos', add);   // una sola escritura para todos los periodos nuevos
}
/* al cambiar frecuencia / fechas: borra periodos intactos (sin comprobante) y los rehace */
function ltResetPeriods_(code) {
  var sh = ltSh_('LT_Pagos');
  ltOf_('LT_Pagos', code).filter(function (p) { return (p.estado === 'pendiente' || p.estado === 'vencido') && !p.comprobante_id && !ltTrue_(p.ajustado); })
    .map(function (p) { return p._row; }).sort(function (a, b) { return b - a; }).forEach(function (row) { sh.deleteRow(row); });
  ltDirty_('LT_Pagos');
}
function ltMarkOverdue_() {
  var today = ltToday_();
  ltRows_('LT_Pagos').forEach(function (p) {
    var luz = ltConcepto_(p) === 'luz';
    if (luz && p.estado === 'vencido') ltUpdate_('LT_Pagos', p._row, { estado: 'pendiente' });   // la luz no vence
    else if (!luz && p.estado === 'pendiente' && ltIso_(p.vence) < today) ltUpdate_('LT_Pagos', p._row, { estado: 'vencido' });
  });
}

/* ---------- vistas ---------- */
function ltPagoOut_(p) {
  return { id: p.periodo_id, periodo: p.periodo, concepto: ltConcepto_(p), label: ltPerLabel_(p), inicio: ltIso_(p.inicio), fin: ltIso_(p.fin), vence: ltIso_(p.vence),
    monto: +p.monto || 0, moneda: p.moneda, estado: p.estado, motivo: p.motivo_rechazo, compId: p.comprobante_id, verificadoAt: p.verificado_at, ajustado: ltTrue_(p.ajustado) };
}
function ltMissing_(g) {
  var out = []; g = g || {};
  if (!String(g.nombre || '').trim()) out.push('nombre');
  if (!String(g.email || '').trim()) out.push('email');
  if (!String(g.telefono || '').trim()) out.push('telefono');
  if (!String(g.doc_numero || '').trim()) out.push('doc');
  return out;
}
function ltSummary_(r) {
  var pagos = ltOf_('LT_Pagos', r.codigo_lt);
  var g = ltGuestOf_(r.codigo_lt) || {}, msgs = ltOf_('LT_Mensajes', r.codigo_lt);
  // vencidos/pendientes = solo renta; la luz se lleva aparte (luzPend)
  var cnt = function (st) { return pagos.filter(function (p) { return p.estado === st && (st === 'revision' || st === 'verificado' || ltConcepto_(p) === 'renta'); }).length; };
  var luzPend = pagos.filter(function (p) { return ltConcepto_(p) === 'luz' && (p.estado === 'pendiente' || p.estado === 'vencido' || p.estado === 'rechazado') && ltIso_(p.inicio) <= ltToday_(); }).length;
  var open = function (p) { return p.estado === 'pendiente' || p.estado === 'vencido' || p.estado === 'rechazado'; };
  var next = pagos.filter(function (p) { return open(p) && ltConcepto_(p) === 'renta'; }).sort(function (a, b) { return ltIso_(a.vence) < ltIso_(b.vence) ? -1 : 1; })[0] || null;
  var luzSinMonto = 0;
  return { code: r.codigo_lt, propertyCode: r.propiedad_code, propertyName: r.propiedad_nombre, entrada: ltIso_(r.entrada), tipoFin: r.tipo_fin,
    salida: ltIso_(r.salida), monto: +r.monto || 0, moneda: r.moneda || 'GTQ', diaCobro: +r.dia_cobro || 1, notas: r.notas, estado: r.estado,
    frecuencia: r.frecuencia || 'mensual', cadaDias: +r.cada_dias || 30, cobraLuz: ltTrue_(r.cobra_luz),
    tokenActivo: ltTrue_(r.token_activo) && !!r.token_hash,
    guest: { nombre: g.nombre || '', telefono: g.telefono || '', email: g.email || '', docTipo: g.doc_tipo || '', docNumero: g.doc_numero || '', docFileId: g.doc_file_id || '' },
    faltan: ltMissing_(g),
    counts: { pendiente: cnt('pendiente'), revision: cnt('revision'), verificado: cnt('verificado'), rechazado: cnt('rechazado'), vencido: cnt('vencido'), luzSinMonto: luzSinMonto, luzPend: luzPend },
    next: next ? { id: next.periodo_id, periodo: next.periodo, label: ltPerLabel_(next), vence: ltIso_(next.vence), estado: next.estado, monto: +next.monto || 0 } : null,
    unread: msgs.filter(function (m) { return m.autor === 'huesped' && !ltTrue_(m.leido); }).length,
    avisoSalida: ltIso_(r.aviso_salida), avisoCreado: ltStamp_(r.aviso_creado), avisoMotivo: r.aviso_motivo || '', avisoDias: ltAvisoDias_(),
    actualizado: r.actualizado };
}
function ltDetail_(r, forGuest) {
  var o = ltSummary_(r);
  o.pagos = ltOf_('LT_Pagos', r.codigo_lt).map(ltPagoOut_).sort(function (a, b) { return a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : (a.concepto === 'renta' ? -1 : 1); });
  o.comprobantes = ltOf_('LT_Comprobantes', r.codigo_lt).map(function (c) { return { id: c.comp_id, concepto: c.concepto || 'renta', periodos: String(c.periodo_ids || '').split(',').filter(String),
    files: String(c.file_ids || '').split(',').filter(String), referencia: c.referencia, fecha: ltIso_(c.fecha_pago), monto: +c.monto_pagado || 0, comentario: c.comentario, creado: c.creado,
    hash: c.hash || '', banco: c.banco || '', asignacion: ltAsig_(c), alertas: forGuest ? [] : String(c.alertas || '').split(',').filter(String),
    lectura: forGuest ? null : ltJson_(c.lectura) }; });
  o.mensajes = ltOf_('LT_Mensajes', r.codigo_lt).map(function (m) { return { id: m.msg_id, autor: m.autor, texto: m.texto, creado: m.creado }; });
  if (!forGuest) o.envios = ltOf_('LT_Envios', r.codigo_lt).map(function (e) { return { id: e.envio_id, periodo: e.periodo_id, tipo: e.tipo, canal: e.canal, destino: e.destino, estado: e.estado, creado: e.creado }; }).reverse();
  if (forGuest) { delete o.notas; delete o.guest.docFileId; } else o.url = ltLinkOf_(r);
  return o;
}

/* ---------- plantillas de correo (mismo estilo que el resto: emailShell_) ---------- */
function ltTpl_(kind, r, g, x) {
  x = x || {};
  var name = ltFirst_(g && g.nombre), hola = name ? 'Hola, ' + esc_(name) + '.' : 'Hola.';
  var link = ltLinkOf_(r), prop = r.propiedad_nombre || 'tu espacio';
  var cta = link ? { label: 'Abrir mi perfil', url: link } : null;
  var p = x.pago, per = p ? ltPerLabel_(p) : '', isLuz = p && ltConcepto_(p) === 'luz';
  var concepto = isLuz ? 'luz' : 'renta', monto = p ? ltMoney_(p.monto, p.moneda) : '';
  var rowsPago = p ? [['Concepto', isLuz ? 'Luz' : 'Renta'], ['Periodo', per], ['Monto', isLuz && !(+p.monto > 0) ? 'Según tu recibo' : monto], ['Vence', ltDateLabel_(p.vence)]] : [];
  var IMG = { monthly: EMAIL_IMG_BASE_ + 'email-lt-monthly.jpg', received: EMAIL_IMG_BASE_ + 'email-lt-received.jpg', luz: EMAIL_IMG_BASE_ + 'email-lt-luz.jpg' };
  var t;
  switch (kind) {
    case 'enlace':
      t = { subject: 'Tu perfil de estancia en ' + prop, o: { eyebrow: 'Tu estancia', heading: 'Todo tu mes, en un solo lugar', image: IMG.monthly,
        paras: [hola, x.texto ? esc_(x.texto).replace(/\n/g, '<br>') : 'Desde tu perfil ves tus periodos pendientes, subes tus comprobantes y nos escribes cuando lo necesites.'],
        rows: [['Propiedad', prop], ['Desde', ltDateLabel_(r.entrada)], ['Hasta', r.tipo_fin === 'fecha' ? ltDateLabel_(r.salida) : 'Sin fecha de salida']],
        cta: cta, footerNote: 'Guarda este correo: el botón te lleva siempre a tu perfil.' } };
      break;
    case 'antes':
      t = { subject: 'Se acerca tu pago de ' + concepto + ' · ' + per, o: { eyebrow: 'Recordatorio', heading: 'Tu pago de ' + per + ' vence pronto', image: isLuz ? IMG.luz : IMG.monthly,
        paras: [hola, 'Tu pago de ' + concepto + ' de <b>' + esc_(per) + '</b> vence en ' + x.dias + ' ' + (x.dias === 1 ? 'día' : 'días') + '. Cuando lo hagas, sube tu comprobante desde tu perfil y listo.'],
        rows: rowsPago, cta: cta } };
      break;
    case 'dia':
      t = { subject: 'Hoy vence tu pago de ' + concepto + ' · ' + per, o: { eyebrow: 'Recordatorio', heading: 'Hoy vence tu pago de ' + per, image: isLuz ? IMG.luz : IMG.monthly,
        paras: [hola, 'Hoy es el día de tu pago de ' + concepto + ' de <b>' + esc_(per) + '</b>. Si ya lo hiciste, solo falta subir el comprobante.'], rows: rowsPago, cta: cta } };
      break;
    case 'vencido':
      t = { subject: 'Tu pago de ' + concepto + ' de ' + per + ' está pendiente', o: { eyebrow: 'Pago pendiente', heading: 'Seguimos esperando tu comprobante', image: isLuz ? IMG.luz : IMG.monthly,
        paras: [hola, 'Tu pago de ' + concepto + ' de <b>' + esc_(per) + '</b> venció hace ' + x.dias + ' ' + (x.dias === 1 ? 'día' : 'días') + '. Si ya pagaste, sube el comprobante y lo verificamos. Si necesitas algo, escríbenos desde tu perfil.'],
        rows: rowsPago, cta: cta } };
      break;
    case 'recibido':
      t = { subject: 'Recibimos tu comprobante', o: { eyebrow: 'Comprobante recibido', heading: 'Gracias, ya lo tenemos', image: IMG.received,
        paras: [hola, 'Recibimos tu comprobante de ' + (x.concepto === 'luz' ? 'luz' : 'renta') + ' para <b>' + esc_(x.periodos || '') + '</b>. Lo revisamos y te avisamos por aquí en cuanto quede verificado.'],
        rows: [['Referencia', x.referencia || ''], ['Monto pagado', x.monto ? ltMoney_(x.monto, r.moneda) : ''], ['Fecha de pago', ltDateLabel_(x.fecha)]], cta: cta } };
      break;
    case 'verificado':
      t = { subject: 'Pago verificado · ' + per, o: { eyebrow: 'Pago verificado', heading: 'Tu pago de ' + per + ' está listo', image: IMG.received,
        paras: [hola, 'Verificamos tu pago de ' + concepto + ' de <b>' + esc_(per) + '</b>. Gracias por estar al día.'], rows: [['Concepto', isLuz ? 'Luz' : 'Renta'], ['Periodo', per], ['Monto', monto]], cta: cta } };
      break;
    case 'rechazado':
      t = { subject: 'Revisa tu comprobante de ' + per, o: { eyebrow: 'Comprobante por revisar', heading: 'No pudimos verificar tu comprobante', image: isLuz ? IMG.luz : IMG.monthly,
        paras: [hola, 'Revisamos tu comprobante de ' + concepto + ' de <b>' + esc_(per) + '</b> y no pudimos verificarlo.', '<b>Motivo:</b> ' + esc_(x.motivo || '—'), 'Sube uno nuevo desde tu perfil y lo revisamos de nuevo.'],
        cta: cta } };
      break;
    case 'luz':
      t = { subject: 'Tu cobro de luz de ' + per + ' está listo', o: { eyebrow: 'Luz', heading: 'Ya tenemos tu recibo de luz', image: IMG.luz,
        paras: [hola, 'El consumo de luz de <b>' + esc_(per) + '</b> ya está en tu perfil. Este pago lleva su propio comprobante, aparte de la renta.'], rows: rowsPago, cta: cta } };
      break;
    case 'mensaje':
      t = { subject: 'Tienes un mensaje de Spacio AM', o: { eyebrow: 'Mensaje nuevo', heading: 'Te escribimos', image: '',
        paras: [hola, '<span style="display:block;background:#F5F3F0;border-radius:14px;padding:16px 20px;">' + esc_(x.texto || '').replace(/\n/g, '<br>') + '</span>', 'Puedes responder desde tu perfil.'], cta: cta } };
      break;
    case 'admin':
      t = { subject: 'Long Term · comprobante de ' + (x.concepto === 'luz' ? 'luz' : 'renta') + ' · ' + prop, o: { eyebrow: 'Nuevo comprobante', heading: prop, image: EMAIL_IMG_.adminAlert,
        paras: [esc_((g && g.nombre) || r.codigo_lt) + ' subió un comprobante. Ábrelo en el panel, pestaña <b>Long Term</b>, para verificarlo o rechazarlo.'],
        rows: [['Código', r.codigo_lt], ['Concepto', x.concepto === 'luz' ? 'Luz' : 'Renta'], ['Periodos', x.periodos || ''], ['Referencia', x.referencia || ''], ['Monto pagado', x.monto ? ltMoney_(x.monto, r.moneda) : '']],
        cta: CFG_().APP_URL ? { label: 'Abrir panel', url: CFG_().APP_URL } : null, signoff: 'Spacio AM' } };
      break;
  }
  var sh = emailShell_(t.o);
  return { subject: t.subject, html: sh.html, text: sh.text + (link ? '\n\nTu perfil: ' + link : '') };
}
function ltMail_(r, g, kind, x, periodoId) {
  if (!g || !g.email) return false;
  var m = ltTpl_(kind, r, g, x), ok = false;
  try { ok = sendMail_(g.email, m.subject, m.text, m.html) !== false; } catch (e) { ok = false; }
  ltAppend_('LT_Envios', { envio_id: ltId_('E'), codigo_lt: r.codigo_lt, periodo_id: periodoId || '', tipo: kind, canal: 'email', destino: g.email, estado: ok ? 'enviado' : 'fallido', creado: ltNow_() });
  return ok;
}

/* ---------- admin ---------- */
/* el listado trae el detalle completo de cada reserva: abrir una es instantáneo (sin otra petición) */
function ltList_(b) {
  var ver = ltVer_(), hit = !(b && b.fresh) && ltCacheGet_('lt_list', ver);
  if (hit) return { ok: true, list: hit, cached: true };
  ltMarkOverdue_();
  var v1 = ltVer_(), list = ltRows_('LT_Reservas').map(function (r) { return ltDetail_(r, false); });
  ltCachePut_('lt_list', v1, list);   // si otra ejecución escribe mientras tanto, la versión cambia y esto no se usa
  return { ok: true, list: list };
}
function ltGet_(b) { var r = ltRes_(b.code); if (!r) return { ok: false, error: 'not-found' }; return { ok: true, lt: ltDetail_(r, false) }; }
function ltSave_(b) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var d = b.lt || {}, code = normCode_(d.code), now = ltNow_(), token = '';
    // idempotencia: el mismo reqId (reintento o doble clic) nunca crea una segunda reserva
    var cache = CacheService.getScriptCache(), reqKey = d.reqId ? 'ltreq_' + String(d.reqId).replace(/[^\w-]/g, '').slice(0, 60) : '';
    if (!code && reqKey) code = normCode_(cache.get(reqKey) || '');
    var r = code ? ltRes_(code) : null;
    var base = { propiedad_code: d.propertyCode || '', propiedad_nombre: d.propertyName || '', entrada: d.entrada || '', tipo_fin: d.tipoFin || 'fecha',
      salida: d.tipoFin === 'indefinido' ? '' : (d.salida || ''), monto: +d.monto || 0, moneda: d.moneda || 'GTQ', dia_cobro: +d.diaCobro || 1, notas: d.notas || '',
      frecuencia: d.frecuencia || 'mensual', cada_dias: +d.cadaDias || 30, cobra_luz: !!d.cobraLuz, actualizado: now };
    if (r) {
      var shape = function (o) { return [ltIso_(o.entrada), o.tipo_fin, ltIso_(o.salida), +o.dia_cobro, o.frecuencia || 'mensual', +o.cada_dias || 30].join('|'); };
      var reshaped = shape(r) !== shape(base);
      ltUpdate_('LT_Reservas', r._row, base);
      if (reshaped) ltResetPeriods_(code);
      if (ltTrue_(r.cobra_luz) && !base.cobra_luz) {   // se deshabilitó la luz: borra cobros de luz sin comprobante
        var sh = ltSh_('LT_Pagos');
        ltOf_('LT_Pagos', code).filter(function (p) { return ltConcepto_(p) === 'luz' && !p.comprobante_id; }).map(function (p) { return p._row; })
          .sort(function (a, c) { return c - a; }).forEach(function (row) { sh.deleteRow(row); });
        ltDirty_('LT_Pagos');
      }
    } else {
      code = code || ('LT' + Utilities.formatDate(new Date(), LT_TZ_, 'yyMM') + Utilities.getUuid().slice(0, 4).toUpperCase());
      token = ltNewToken_();
      base.codigo_lt = code; base.token_hash = ltHash_(token); base.token_enc = ltEnc_(token); base.token_activo = true; base.estado = 'activa'; base.creado = now;
      ltAppend_('LT_Reservas', base);
      if (reqKey) cache.put(reqKey, code, 21600);
    }
    var g = d.guest || {}, gr = ltGuestOf_(code);
    var gv = { codigo_lt: code, nombre: g.nombre || '', telefono: g.telefono || '', email: g.email || '', doc_tipo: g.docTipo || '', doc_numero: g.docNumero || '', actualizado: now };
    if (g.docImage) gv.doc_file_id = ltSaveFile_(code, g.docImage, 'documento-' + code);
    if (gr) ltUpdate_('LT_Huespedes', gr._row, gv); else ltAppend_('LT_Huespedes', gv);
    // monto nuevo → se aplica a los periodos de renta sin comprobante ni ajuste manual
    ltOf_('LT_Pagos', code).forEach(function (p) { if (ltConcepto_(p) === 'renta' && (p.estado === 'pendiente' || p.estado === 'vencido') && !ltTrue_(p.ajustado)) ltUpdate_('LT_Pagos', p._row, { monto: base.monto, moneda: base.moneda }); });
    ltEnsurePeriods_(ltRes_(code));
    var out = { ok: true, lt: ltDetail_(ltRes_(code), false) };
    if (token) out.url = ltUrl_(token);
    return out;
  } finally { lock.releaseLock(); }
}
/* ajuste de un periodo: monto y/o vencimiento. Luz con monto nuevo → avisa al huésped */
function ltSetPeriod_(b) {
  var p = ltRows_('LT_Pagos').filter(function (x) { return x.periodo_id === b.periodoId; })[0]; if (!p) return { ok: false, error: 'not-found' };
  var upd = { ajustado: true }, wasZero = !(+p.monto > 0);
  if (b.monto != null && b.monto !== '') upd.monto = +b.monto || 0;
  if (b.vence) upd.vence = ltIso_(b.vence);
  if (p.estado === 'vencido' && upd.vence && upd.vence >= ltToday_()) upd.estado = 'pendiente';
  ltUpdate_('LT_Pagos', p._row, upd);
  if (ltConcepto_(p) === 'luz' && wasZero && upd.monto > 0 && b.notify !== false) {
    var r = ltRes_(p.codigo_lt), np = ltRows_('LT_Pagos').filter(function (x) { return x.periodo_id === b.periodoId; })[0];
    ltMail_(r, ltGuestOf_(p.codigo_lt), 'luz', { pago: np }, p.periodo_id);
  }
  return ltGet_({ code: p.codigo_lt });
}
function ltToken_(b) {
  var r = ltRes_(b.code); if (!r) return { ok: false, error: 'not-found' };
  var token = ltNewToken_();
  ltUpdate_('LT_Reservas', r._row, { token_hash: ltHash_(token), token_enc: ltEnc_(token), token_activo: true, actualizado: ltNow_() });
  return { ok: true, url: ltUrl_(token) };
}
function ltLink_(b) {
  var r = ltRes_(b.code); if (!r) return { ok: false, error: 'not-found' };
  var u = ltLinkOf_(r); return u ? { ok: true, url: u } : { ok: false, error: 'no-token' };
}
function ltVerify_(b) {
  var p = ltRows_('LT_Pagos').filter(function (x) { return x.periodo_id === b.periodoId; })[0]; if (!p) return { ok: false, error: 'not-found' };
  var ok = b.estado === 'verificado';
  ltUpdate_('LT_Pagos', p._row, { estado: ok ? 'verificado' : 'rechazado', motivo_rechazo: ok ? '' : (b.motivo || ''), verificado_at: ok ? ltNow_() : '' });
  // un solo correo por comprobante: si cubría varios periodos, no se repite al verificar cada uno
  var key = p.comprobante_id ? 'C:' + p.comprobante_id : p.periodo_id, tipo = ok ? 'verificado' : 'rechazado';
  var dup = ltOf_('LT_Envios', p.codigo_lt).some(function (e) { return e.periodo_id === key && e.tipo === tipo; });
  if (!dup && b.notify !== false) ltMail_(ltRes_(p.codigo_lt), ltGuestOf_(p.codigo_lt), tipo, { pago: p, motivo: b.motivo }, key);
  return ltGet_({ code: p.codigo_lt });
}
/* ---------- comprobantes: reasignar / eliminar (panel) ---------- */
function ltCompCtx_(b) {
  var r = ltRes_(b.code); if (!r) return { error: 'not-found' };
  var comps = ltOf_('LT_Comprobantes', r.codigo_lt), c = comps.filter(function (x) { return x.comp_id === b.compId; })[0]; if (!c) return { error: 'not-found' };
  var own = {}; ltOf_('LT_Pagos', r.codigo_lt).forEach(function (p) { own[p.periodo_id] = p; });
  var ids = String(c.periodo_ids || '').split(',').filter(String);
  if (ids.some(function (id) { return own[id] && own[id].estado === 'verificado' && own[id].comprobante_id === c.comp_id; })) return { error: 'verificado' };
  return { r: r, comps: comps, c: c, own: own, ids: ids };
}
/* un periodo deja de apuntar a este comprobante: pasa a otro comprobante que también lo cubra, o vuelve a pendiente */
function ltRelease_(p, compId, comps) {
  if (!p || p.estado === 'verificado') return;
  if (p.comprobante_id && p.comprobante_id !== compId) return;
  var other = comps.filter(function (x) { return x.comp_id !== compId && String(x.periodo_ids || '').split(',').indexOf(p.periodo_id) >= 0; })[0];
  if (other && p.estado === 'revision') ltUpdate_('LT_Pagos', p._row, { comprobante_id: other.comp_id });
  else ltUpdate_('LT_Pagos', p._row, { estado: 'pendiente', comprobante_id: '', motivo_rechazo: '' });
}
function ltCompReassign_(b) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var x = ltCompCtx_(b); if (x.error) return { ok: false, error: x.error };
    var t = x.own[b.periodoId]; if (!t) return { ok: false, error: 'not-found' }; if (t.estado === 'verificado') return { ok: false, error: 'destino-verificado' };
    x.ids.forEach(function (id) { if (id !== t.periodo_id) ltRelease_(x.own[id], x.c.comp_id, x.comps); });
    var asig = {}; asig[t.periodo_id] = +x.c.monto_pagado || 0;
    var al = String(x.c.alertas || '').split(',').filter(function (k) { return k && k !== 'parcial' && k !== 'excedente' && k !== 'periodo-lejano'; });
    var need = +t.monto || 0; if (ltConcepto_(t) === 'renta' && need > 0) { var m = +x.c.monto_pagado || 0, tol = ltTol_(); if (m < need - tol) al.push('parcial'); else if (m > need + tol) al.push('excedente'); }
    al.push('reasignado');
    ltUpdate_('LT_Comprobantes', x.c._row, { periodo_ids: t.periodo_id, asignacion: JSON.stringify(asig), concepto: ltConcepto_(t), alertas: al.filter(function (k, i) { return al.indexOf(k) === i; }).join(',') });
    ltUpdate_('LT_Pagos', t._row, { estado: 'revision', comprobante_id: x.c.comp_id, motivo_rechazo: '' });
    ltMarkOverdue_();
    return ltGet_({ code: x.r.codigo_lt });
  } finally { lock.releaseLock(); }
}
function ltCompDelete_(b) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var x = ltCompCtx_(b); if (x.error) return { ok: false, error: x.error };
    x.ids.forEach(function (id) { ltRelease_(x.own[id], x.c.comp_id, x.comps); });
    String(x.c.file_ids || '').split(',').filter(String).forEach(function (fid) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) {} });
    ltSh_('LT_Comprobantes').deleteRow(x.c._row); ltDirty_('LT_Comprobantes');
    ltMarkOverdue_();
    return ltGet_({ code: x.r.codigo_lt });
  } finally { lock.releaseLock(); }
}
function ltAdminMsg_(b) {
  var r = ltRes_(b.code); if (!r || !String(b.texto || '').trim()) return { ok: false, error: 'invalid' };
  ltAppend_('LT_Mensajes', { msg_id: ltId_('M'), codigo_lt: r.codigo_lt, autor: 'admin', texto: String(b.texto).slice(0, 2000), creado: ltNow_(), leido: false });
  ltRead_(b);
  if (b.notify !== false) ltMail_(r, ltGuestOf_(r.codigo_lt), 'mensaje', { texto: String(b.texto) }, '');
  return ltGet_({ code: r.codigo_lt });
}
function ltRead_(b) { ltOf_('LT_Mensajes', b.code).forEach(function (m) { if (m.autor === 'huesped' && !ltTrue_(m.leido)) ltUpdate_('LT_Mensajes', m._row, { leido: true }); }); return { ok: true }; }
/* envío del enlace. canal: email (plantilla) | whatsapp (se registra; el panel abre wa.me) */
function ltSend_(b) {
  var r = ltRes_(b.code); if (!r) return { ok: false, error: 'not-found' };
  var g = ltGuestOf_(r.codigo_lt) || {}, canal = b.canal || 'email';
  if (canal === 'email') {
    if (!g.email) return { ok: false, error: 'sin-email' };
    return ltMail_(r, g, 'enlace', { texto: b.texto || '' }, '') ? { ok: true, to: g.email } : { ok: false, error: 'mail-failed' };
  }
  ltAppend_('LT_Envios', { envio_id: ltId_('E'), codigo_lt: r.codigo_lt, periodo_id: '', tipo: 'enlace', canal: 'whatsapp', destino: g.telefono || '', estado: 'abierto', creado: ltNow_() });
  return { ok: true, to: g.telefono || '' };
}
function ltEnd_(b) {
  var r = ltRes_(b.code); if (!r) return { ok: false, error: 'not-found' };
  var fin = b.reopen ? { estado: 'activa', token_activo: true } : { estado: 'terminada', token_activo: false };
  fin.actualizado = ltNow_(); ltUpdate_('LT_Reservas', r._row, fin);
  if (b.reopen) ltEnsurePeriods_(ltRes_(r.codigo_lt));
  return ltGet_({ code: r.codigo_lt });
}
function ltAdminFile_(b) { return { ok: true, image: driveFileDataUrl_(b.fileId || '') }; }
/* elimina la reserva y todo lo asociado (periodos, comprobantes, mensajes, envíos, huésped). Archivos de Drive → papelera */
function ltDelete_(b) {
  var code = normCode_(b.code); if (!code || !ltRes_(code)) return { ok: false, error: 'not-found' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    ['LT_Pagos', 'LT_Comprobantes', 'LT_Mensajes', 'LT_Envios', 'LT_Huespedes', 'LT_Reservas'].forEach(function (n) { ltPurge_(n, code); });
  } finally { lock.releaseLock(); }
  try {
    var f = DriveApp.getFolderById(CFG_().DRIVE_FOLDER).getFoldersByName('LongTerm');
    if (f.hasNext()) { var g = f.next().getFoldersByName(code); while (g.hasNext()) g.next().setTrashed(true); }
  } catch (e) {}
  return { ok: true, deleted: code };
}

/* ---------- huésped (todo pasa por el token) ---------- */
function ltGuest_(b) {
  var r = ltByToken_(b.token); if (!r) return { ok: false, error: 'invalid' };
  ltEnsurePeriods_(r); ltMarkOverdue_(); return { ok: true, lt: ltDetail_(r, true) };
}
/* completa SOLO los datos que faltan del huésped (nunca sobrescribe) */
function ltFillProfile_(r, perfil) {
  if (!perfil) return;
  var g = ltGuestOf_(r.codigo_lt), upd = {}, blank = function (k) { return !g || !String(g[k] || '').trim(); };
  if (perfil.nombre && blank('nombre')) upd.nombre = String(perfil.nombre).trim().slice(0, 120);
  if (perfil.email && blank('email') && /.+@.+\..+/.test(perfil.email)) upd.email = String(perfil.email).trim().toLowerCase();
  if (perfil.telefono && blank('telefono')) upd.telefono = String(perfil.telefono).replace(/[^\d+]/g, '');
  if (perfil.docNumero && blank('doc_numero')) { upd.doc_numero = String(perfil.docNumero).trim(); upd.doc_tipo = perfil.docTipo || (g && g.doc_tipo) || ''; }
  if (perfil.docImage && blank('doc_file_id')) upd.doc_file_id = ltSaveFile_(r.codigo_lt, perfil.docImage, 'documento-' + r.codigo_lt);
  if (!Object.keys(upd).length) return;
  upd.actualizado = ltNow_();
  if (g) ltUpdate_('LT_Huespedes', g._row, upd); else { upd.codigo_lt = r.codigo_lt; ltAppend_('LT_Huespedes', upd); }
}
/* ============================================================
   LT · COMPROBANTES — lectura con IA + controles de riesgo
   ------------------------------------------------------------
   El huésped sube uno o varios comprobantes. Cada uno se lee con IA
   (ltReadReceipt_) y la lectura queda en caché del servidor (6 h) con una
   llave; al enviarlo (ltUpload_) el servidor compara contra ESA lectura,
   no contra lo que diga el navegador. Nada se verifica solo: todo queda
   "en revisión" con sus alertas para que el equipo decida.
   Propiedades opcionales:
     LT_CUENTAS   = últimos 4 dígitos de las cuentas receptoras, separados por coma (ej. 1234,5678)
     LT_TOL       = tolerancia en moneda para cuadrar montos (default 1)
     LT_IA_LIMITE = lecturas IA por reserva cada 6 h (default 60)
   ============================================================ */
var LT_RECEIPT_PROMPT_ = function (hoy) { return 'Eres un lector de comprobantes de pago de Guatemala: transferencias, depósitos, pagos en banca en línea, boletas de depósito, capturas de apps bancarias y recibos de energía eléctrica (EEGSA, Energuate). Hoy es ' + hoy + '.\n' +
  'Observa ESTRICTAMENTE el archivo. Extrae SOLO lo que realmente aparece; NUNCA inventes ni completes datos.\n' +
  'Responde únicamente con un objeto JSON válido, sin texto adicional:\n' +
  '{"es_comprobante": true|false, "legible": true|false, "tipo": "transferencia|deposito|recibo_luz|otro", "estado": "completada|pendiente|rechazada|desconocido", "banco": "", "fecha": "YYYY-MM-DD", "monto": 0, "moneda": "GTQ|USD|", "referencia": "", "cuenta_destino": "", "beneficiario": "", "ordenante": "", "periodo_desde": "", "periodo_hasta": "", "senales_edicion": false}\n' +
  'Reglas:\n- es_comprobante=false si no es un comprobante de pago ni un recibo de luz (foto cualquiera, chat, factura sin pago, etc.).\n' +
  '- fecha = fecha de la operación (no la de impresión). En Guatemala las fechas van en día/mes/año: "25/08/26" es 2026-08-25. Si el año no aparece, usa el más reciente que no sea posterior a hoy.\n' +
  '- periodo_desde / periodo_hasta = solo si el comprobante (comentario, concepto o descripción) menciona qué periodo de renta paga, p. ej. "Renta 25 agosto a 25 septiembre" → 2026-08-25 / 2026-09-25. Si no, vacíos.\n' +
  '- monto = total transferido o depositado, como número sin símbolo ni comas. En recibo de luz, el total pagado.\n' +
  '- moneda: Q, GTQ o quetzales = GTQ; $, US$ o USD = USD. Vacío si no aparece.\n' +
  '- referencia = número de autorización, referencia, boleta o transacción, tal como aparece.\n' +
  '- cuenta_destino = cuenta acreditada tal como aparece (puede venir enmascarada).\n' +
  '- estado = "pendiente" si dice programada, en proceso o pendiente; "rechazada" si dice fallida o rechazada; "completada" si fue exitosa.\n' +
  '- senales_edicion = true SOLO si ves claramente texto sobrepuesto, tipografías mezcladas o cifras desalineadas.\n' +
  '- Si algo no se lee con claridad, deja el campo vacío.'; };
function ltJson_(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function ltAsig_(c) { var o = ltJson_(c && c.asignacion); return o && typeof o === 'object' ? o : {}; }
function ltNormRef_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function ltStamp_(v) { return v instanceof Date ? Utilities.formatDate(v, LT_TZ_, "yyyy-MM-dd'T'HH:mm:ss") : String(v || ''); }
/* Diferencia con lo pactado (tipo de cambio, comisión): manda el monto del comprobante. 0.40 = 40 %. */
function ltMargen_() { var m = parseFloat(PropertiesService.getScriptProperties().getProperty('LT_MARGEN') || '0.40'); return isNaN(m) || m < 0 ? 0.40 : m; }
function ltTol_() { var t = parseFloat(PropertiesService.getScriptProperties().getProperty('LT_TOL') || '1'); return isNaN(t) ? 1 : t; }
function ltVision_(key, model, prompt, mediaType, data) {
  var block = mediaType === 'application/pdf' ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: data } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: data } };
  try {
    var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, muteHttpExceptions: true,
      payload: JSON.stringify({ model: model, max_tokens: 600, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, block] }] }) });
    var json = {}; try { json = JSON.parse(res.getContentText()); } catch (e) {}
    registrarUsoIA_('Comprobante de pago (largo plazo)', model, json.usage, res.getResponseCode() === 200 ? '' : 'HTTP ' + res.getResponseCode());
    if (res.getResponseCode() !== 200) return { ok: false, error: 'anthropic HTTP ' + res.getResponseCode() + ': ' + shortMsg_(json) };
    var text = ''; (json.content || []).forEach(function (c) { if (c && c.type === 'text') text += c.text; });
    return { ok: true, text: text };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
/* lectura IA de un comprobante. Solo con token válido y con límite por reserva (evita abuso y costo). */
function ltReadReceipt_(b) {
  var r = ltByToken_(b.token); if (!r) return { ok: false, error: 'invalid' };
  var cfg = CFG_(); if (!cfg.ANTHROPIC_API_KEY) return { ok: false, error: 'no-anthropic-key' };
  var mt = String(b.media_type || ''), data = String(b.data || '');
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mt) && mt !== 'application/pdf') return { ok: false, error: 'formato' };
  if (!data || data.length > 11000000) return { ok: false, error: 'tamano' };
  var cache = CacheService.getScriptCache(), nk = 'rrn_' + normCode_(r.codigo_lt), n = +(cache.get(nk) || 0);
  var lim = parseInt(PropertiesService.getScriptProperties().getProperty('LT_IA_LIMITE') || '60', 10);
  if (n >= lim) return { ok: false, error: 'limite' };
  cache.put(nk, String(n + 1), 21600);
  var key = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data).map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('').slice(0, 40);
  var hit = cache.get('rr_' + key); if (hit) return { ok: true, text: hit, key: key };
  /* Leer un comprobante bien vale más que ahorrar: primero un modelo con buena visión (LT_AI_MODEL), luego los de siempre. */
  var prompt = LT_RECEIPT_PROMPT_(ltToday_()), models = [];
  [PropertiesService.getScriptProperties().getProperty('LT_AI_MODEL') || 'claude-sonnet-5-5', cfg.AI_MODEL_FALLBACK, cfg.AI_MODEL_PRIMARY]
    .forEach(function (m) { if (m && models.indexOf(m) < 0) models.push(m); });
  var last = '', err = '';
  for (var i = 0; i < models.length; i++) {
    var x = ltVision_(cfg.ANTHROPIC_API_KEY, models[i], prompt, mt, data); if (!x.ok) { err = x.error; continue; }
    var jm = /\{[\s\S]*\}/.exec(x.text || ''), j = jm && ltJson_(jm[0]); if (!j) { last = x.text; continue; }
    last = JSON.stringify(j);
    if (j.es_comprobante !== false && j.legible && +j.monto > 0 && j.fecha) break;   // lectura limpia: no escala (si dice «no es comprobante», lo intenta el siguiente)
  }
  if (!last) return { ok: false, error: err || 'lectura' };
  try { cache.put('rr_' + key, last.slice(0, 90000), 21600); } catch (e) {}
  return { ok: true, text: last, key: key };
}
/* ¿el periodo en revisión aún tiene saldo? (abono parcial previo) */
/* otras lecturas posibles de una fecha mal interpretada (año↔día, un año de desfase) */
function ltAltDates_(iso) {
  var p = String(iso || '').split('-').map(Number), out = []; if (p.length !== 3) return out;
  [[2000 + p[2], p[1], p[0] % 100], [p[0] + 1, p[1], p[2]], [p[0], p[2], p[1]]].forEach(function (c) {
    if (c[1] < 1 || c[1] > 12 || c[2] < 1 || c[2] > 31) return; out.push(c[0] + '-' + ('0' + c[1]).slice(-2) + '-' + ('0' + c[2]).slice(-2)); });
  return out;
}
function ltPaidOn_(pid, comps) { return comps.reduce(function (n, c) { return n + (+ltAsig_(c)[pid] || 0); }, 0); }
/* Envío de un comprobante: si falla, queda anotado en LT_Errores (qué reserva, qué error) para poder corregirlo. */
function ltUpload_(b) {
  var res;
  try { res = ltUploadUno_(b); } catch (e) { res = { ok: false, error: String(e && e.message || e) }; }
  if (!res || !res.ok) {
    try {
      var r = ltByToken_(b.token), ss = SpreadsheetApp.openById(CFG_().SHEET_ID), sh = ss.getSheetByName('LT_Errores') || ss.insertSheet('LT_Errores');
      if (sh.getLastRow() < 1) sh.appendRow(['fecha', 'accion', 'codigo_lt', 'error', 'monto', 'fecha_pago', 'periodos']);
      sh.appendRow([ltNow_(), 'ltUpload', r ? r.codigo_lt : '(token)', String(res && res.error || 'sin respuesta').slice(0, 500), +b.monto || 0, String(b.fecha || ''), (b.periodoIds || []).join(',')]);
    } catch (e2) { console.error('LT_Errores: ' + e2); }
    if (res && res.error && !/^(invalid|duplicado|ya-enviado|fecha-futura|sin-monto|faltan-datos)$/.test(res.error))
      res = { ok: false, error: 'No se pudo guardar (' + String(res.error).slice(0, 120) + '). Intenta de nuevo en un momento.' };
  }
  return res;
}
function ltUploadUno_(b) {
  var r = ltByToken_(b.token); if (!r) return { ok: false, error: 'invalid' };
  var ids = (b.periodoIds || []).map(String), files = (b.files || []).slice(0, 5), concepto = b.concepto === 'luz' ? 'luz' : 'renta';
  if (!ids.length || !files.length) return { ok: false, error: 'faltan-datos' };
  var today = ltToday_(), fecha = ltIso_(b.fecha), monto = Math.round((+b.monto || 0) * 100) / 100, tol = ltTol_();
  if (fecha && fecha > today) return { ok: false, error: 'fecha-futura' };
  if (!(monto > 0)) return { ok: false, error: 'sin-monto' };
  var lock = LockService.getScriptLock(), labels = [], alertas = [], out = null; lock.waitLock(20000);
  try {
    var all = ltRows_('LT_Comprobantes'), mine = all.filter(function (c) { return normCode_(c.codigo_lt) === normCode_(r.codigo_lt); });
    var pagoById = {}; ltRows_('LT_Pagos').forEach(function (p) { pagoById[p.periodo_id] = p; });
    var own = {}; ltOf_('LT_Pagos', r.codigo_lt).forEach(function (p) { own[p.periodo_id] = p; });
    var hash = String(b.hash || '').slice(0, 64), ref = ltNormRef_(b.referencia), cutoff = Utilities.formatDate(new Date(Date.now() - 15 * 60000), LT_TZ_, "yyyy-MM-dd'T'HH:mm:ss");
    var allRejected = function (c) { var ps = String(c.periodo_ids || '').split(',').filter(String); return ps.length && ps.every(function (id) { return pagoById[id] && pagoById[id].estado === 'rechazado'; }); };
    // 1 · duplicados: mismo archivo, o misma referencia + mismo monto, en CUALQUIER reserva
    for (var i = 0; i < all.length; i++) {
      var c = all[i], sameHash = hash && c.hash === hash, sameRef = ref.length >= 4 && ltNormRef_(c.referencia) === ref;
      if (!sameHash && !sameRef) continue;
      var sameAmt = Math.abs((+c.monto_pagado || 0) - monto) < 0.01;
      if (sameHash && normCode_(c.codigo_lt) === normCode_(r.codigo_lt) && ltStamp_(c.creado) >= cutoff) { out = b.lite ? { ok: true, repeat: true } : ltGuest_(b); break; }   // reintento de red: no duplica
      if (allRejected(c)) { if (alertas.indexOf('reenvio') < 0) alertas.push('reenvio'); continue; }
      if (sameHash || (sameRef && sameAmt)) { out = { ok: false, error: 'duplicado' }; break; }
      if (alertas.indexOf('ref-repetida') < 0) alertas.push('ref-repetida');
    }
    if (out) return out;
    // 2 · periodos válidos: sin verificar; en revisión solo si quedó un saldo por abono parcial
    ids = ids.filter(function (id) { var p = own[id]; if (!p || ltConcepto_(p) !== concepto || p.estado === 'verificado') return false;
      return p.estado !== 'revision' || (concepto === 'renta' && ltPaidOn_(id, mine) > 0 && ltPaidOn_(id, mine) < (+p.monto || 0) - tol); });
    if (!ids.length) return { ok: false, error: 'ya-enviado' };
    ids.sort(function (a, b2) { return ltIso_(own[a].inicio) < ltIso_(own[b2].inicio) ? -1 : 1; });
    labels = ids.map(function (id) { return ltPerLabel_(own[id]); });
    // 3 · asignación del dinero (el servidor la recalcula; no confía en el navegador)
    var asig = {}, rest = monto, margen = ltMargen_(), ajuste = {};
    ids.forEach(function (id, k) { var p = own[id];
      if (concepto === 'luz') { asig[id] = monto; rest = 0; return; }
      var antes = p.estado === 'revision' ? ltPaidOn_(id, mine) : 0, need = (+p.monto || 0) - antes, dif = rest - need;
      /* Falta poco, o sobra poco en el último periodo: el comprobante manda y el periodo queda pagado con ese monto. */
      var cerca = Math.abs(dif) > tol && Math.abs(dif) <= (+p.monto || 0) * margen && (dif < 0 || k === ids.length - 1);
      var a = cerca ? rest : Math.max(0, Math.min(rest, need));
      asig[id] = Math.round(a * 100) / 100; rest -= a;
      if (cerca) { ajuste[id] = Math.round((antes + a) * 100) / 100; if (alertas.indexOf('monto-ajustado') < 0) alertas.push('monto-ajustado'); }
      else if (a < need - tol) alertas.push('parcial'); });
    if (concepto === 'renta' && rest > tol) alertas.push('excedente');
    // 4 · contra la lectura IA del servidor
    var lec = b.aiKey ? ltJson_(CacheService.getScriptCache().get('rr_' + String(b.aiKey).replace(/[^a-f0-9]/g, ''))) : null;
    if (lec) {
      var fechaAlt = ltAltDates_(lec.fecha);
      if (lec.fecha && lec.fecha !== fecha && fechaAlt.indexOf(fecha) >= 0) alertas.push('fecha-interpretada');
      if ((lec.fecha && lec.fecha !== fecha && fechaAlt.indexOf(fecha) < 0) || (+lec.monto > 0 && Math.abs(+lec.monto - monto) > 0.01) || (lec.referencia && ref && ltNormRef_(lec.referencia) !== ref)) alertas.push('editado');
      if (lec.estado === 'pendiente' || lec.estado === 'rechazada') alertas.push('no-acreditado');
      if (lec.senales_edicion === true) alertas.push('manipulacion');
      if (lec.moneda && lec.moneda !== r.moneda) alertas.push('moneda');
      if (lec.es_comprobante === false) alertas.push('no-comprobante');
      var cuentas = String(PropertiesService.getScriptProperties().getProperty('LT_CUENTAS') || '').split(',').map(function (x) { return x.replace(/\D/g, '').slice(-4); }).filter(function (x) { return x.length === 4; });
      var dest = String(lec.cuenta_destino || '').replace(/\D/g, '');
      if (cuentas.length && dest.length >= 4 && cuentas.indexOf(dest.slice(-4)) < 0) alertas.push('cuenta');
    } else alertas.push(b.manual ? 'manual' : 'sin-lectura');
    if (fecha && fecha < ltAdd_(ltIso_(r.entrada), -31)) alertas.push('fecha-antigua');
    if (concepto === 'renta' && fecha && ltIso_(own[ids[0]].inicio) > ltAdd_(fecha, 20)) alertas.push('periodo-lejano');
    alertas = alertas.filter(function (x, k) { return alertas.indexOf(x) === k; });
    var compId = ltId_('C'), fids = files.map(function (f, k) { return ltSaveFile_(r.codigo_lt, f.dataUrl, concepto + '-' + compId + '-' + (k + 1) + (f.name ? '-' + f.name : '')); }).filter(String);
    ltAppend_('LT_Comprobantes', { comp_id: compId, codigo_lt: r.codigo_lt, periodo_ids: ids.join(','), file_ids: fids.join(','), referencia: String(b.referencia || '').slice(0, 80),
      fecha_pago: fecha, monto_pagado: monto, comentario: String(b.comentario || '').slice(0, 1000), creado: ltNow_(), concepto: concepto,
      hash: hash, banco: String(b.banco || (lec && lec.banco) || '').slice(0, 60), asignacion: JSON.stringify(asig), alertas: alertas.join(','), lectura: lec ? JSON.stringify(lec).slice(0, 2000) : '' });
    ids.forEach(function (id) { var p = own[id], upd = { estado: 'revision', motivo_rechazo: '' };
      if (ajuste[id] != null) { upd.monto = ajuste[id]; upd.ajustado = true; }   // el monto del periodo pasa a ser el del comprobante
      if (p.estado !== 'revision' || !p.comprobante_id) upd.comprobante_id = compId;   // un abono que completa un periodo conserva el primer comprobante
      ltUpdate_('LT_Pagos', p._row, upd); });
    ltFillProfile_(r, b.perfil);
  } finally { lock.releaseLock(); }
  var g = ltGuestOf_(r.codigo_lt) || {}, info = { concepto: concepto, periodos: labels.join(', '), referencia: b.referencia, monto: monto, fecha: fecha, alertas: alertas };
  // carga en lote: solo el último envío notifica, con el resumen de todos (un correo, no uno por comprobante)
  if (b.notify !== false) {
    if (b.resumen) { info.periodos = String(b.resumen).slice(0, 600); info.monto = +b.resumenMonto || info.monto; }
    ltMail_(r, g, 'recibido', info, '');
    [].concat(adminNotifyEmails_() || []).forEach(function (to) {
      try { var m = ltTpl_('admin', r, g, info); sendMail_(to, m.subject, m.text, m.html); } catch (e) {}
    });
  }
  if (b.lite) return { ok: true, alertas: alertas };
  var res = ltGuest_(b); res.alertas = alertas; return res;
}
/* aviso de salida del huésped: mínimo LT_AVISO_DIAS (default 15) de anticipación. No cambia la reserva:
   el equipo lo confirma y aplica la fecha desde el panel. */
function ltAvisoDias_() { var n = parseInt(PropertiesService.getScriptProperties().getProperty('LT_AVISO_DIAS') || '15', 10); return isNaN(n) ? 15 : n; }
function ltGuestNotice_(b) {
  var r = ltByToken_(b.token); if (!r) return { ok: false, error: 'invalid' };
  var min = ltAdd_(ltToday_(), ltAvisoDias_()), f = ltIso_(b.fecha), motivo = String(b.motivo || '').slice(0, 500), upd, texto;
  if (b.cancel) { upd = { aviso_salida: '', aviso_creado: '', aviso_motivo: '' }; texto = 'Cancelé mi aviso de salida.'; }
  else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || f < min) return { ok: false, error: 'aviso-corto', min: min };
    if (r.tipo_fin === 'fecha' && ltIso_(r.salida) && f > ltIso_(r.salida)) return { ok: false, error: 'despues-salida' };
    upd = { aviso_salida: f, aviso_creado: ltNow_(), aviso_motivo: motivo };
    texto = 'Aviso de salida: ' + f + (motivo ? '\n' + motivo : '');
  }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    ltUpdate_('LT_Reservas', r._row, upd);
    ltAppend_('LT_Mensajes', { msg_id: ltId_('M'), codigo_lt: r.codigo_lt, autor: 'huesped', texto: texto, creado: ltNow_(), leido: false });
  } finally { lock.releaseLock(); }
  var g = ltGuestOf_(r.codigo_lt) || {}, subj = (b.cancel ? 'Aviso de salida cancelado · ' : 'Aviso de salida · ') + (g.nombre || r.codigo_lt) + ' · ' + r.propiedad_nombre;
  [].concat(adminNotifyEmails_() || []).forEach(function (to) { try { sendMail_(to, subj, texto, '<p style="font-family:Arial,sans-serif;font-size:14px;color:#3E3F3F;white-space:pre-wrap">' + texto.replace(/</g, '&lt;') + '</p>'); } catch (e) {} });
  return ltGuest_(b);
}
function ltGuestMsg_(b) {
  var r = ltByToken_(b.token); if (!r || !String(b.texto || '').trim()) return { ok: false, error: 'invalid' };
  ltAppend_('LT_Mensajes', { msg_id: ltId_('M'), codigo_lt: r.codigo_lt, autor: 'huesped', texto: String(b.texto).slice(0, 2000), creado: ltNow_(), leido: false });
  return ltGuest_(b);
}
function ltGuestFile_(b) {
  var r = ltByToken_(b.token); if (!r) return { ok: false, error: 'invalid' };
  var mine = {}; ltOf_('LT_Comprobantes', r.codigo_lt).forEach(function (c) { String(c.file_ids || '').split(',').forEach(function (f) { mine[f] = 1; }); });
  if (!mine[b.fileId]) return { ok: false, error: 'forbidden' };
  return { ok: true, image: driveFileDataUrl_(b.fileId) };
}

/* ---------- recordatorios (trigger diario) ---------- */
function ltDailyReminders() {
  var dias = String(PropertiesService.getScriptProperties().getProperty('LT_DIAS') || '-3,0,3').split(',').map(function (x) { return parseInt(x, 10); }).filter(function (x) { return !isNaN(x); });
  ltRows_('LT_Reservas').forEach(function (r) { try { ltEnsurePeriods_(r); } catch (e) {} });
  ltMarkOverdue_();
  var today = ltToday_(), t0 = ltD_(today).getTime(), sent = {}, hoy = {};
  ltRows_('LT_Envios').forEach(function (e) { sent[e.periodo_id + '|' + e.tipo] = 1; if (String(e.creado).slice(0, 10) === today) hoy[e.codigo_lt] = 1; });
  var res = {}; ltRows_('LT_Reservas').forEach(function (r) { res[r.codigo_lt] = r; });
  // como máximo UN recordatorio por reserva al día (el más urgente); cada aviso de un periodo sale una sola vez; la luz no se recuerda
  var best = {};
  ltRows_('LT_Pagos').forEach(function (p) {
    if (p.estado !== 'pendiente' && p.estado !== 'vencido' && p.estado !== 'rechazado') return;
    if (ltConcepto_(p) !== 'renta' || !(+p.monto > 0)) return;
    var r = res[p.codigo_lt]; if (!r || r.estado === 'terminada' || hoy[p.codigo_lt]) return;
    var diff = Math.round((t0 - ltD_(p.vence).getTime()) / 86400000);
    if (dias.indexOf(diff) < 0) return;
    var tipo = diff < 0 ? 'antes' : diff === 0 ? 'dia' : 'vencido';
    if (sent[p.periodo_id + '|' + tipo]) return;
    var b = best[p.codigo_lt]; if (!b || diff > b.diff) best[p.codigo_lt] = { p: p, diff: diff, tipo: tipo, r: r };
  });
  Object.keys(best).forEach(function (c) { var x = best[c]; ltMail_(x.r, ltGuestOf_(c), x.tipo, { pago: x.p, dias: Math.abs(x.diff) }, x.p.periodo_id); });
}
function ltRoute_(action, b) {
  switch (action) {
    case 'ltList': return ltList_(b);
    case 'ltGet': return ltGet_(b);
    case 'ltSave': return ltSave_(b);
    case 'ltSetPeriod': return ltSetPeriod_(b);
    case 'ltToken': return ltToken_(b);
    case 'ltLink': return ltLink_(b);
    case 'ltVerify': return ltVerify_(b);
    case 'ltCompReassign': return ltCompReassign_(b);
    case 'ltCompDelete': return ltCompDelete_(b);
    case 'ltAdminMsg': return ltAdminMsg_(b);
    case 'ltRead': return ltRead_(b);
    case 'ltSend': return ltSend_(b);
    case 'ltEnd': return ltEnd_(b);
    case 'ltDelete': return ltDelete_(b);
    case 'ltAdminFile': return ltAdminFile_(b);
    case 'ltGuest': return ltGuest_(b);
    case 'ltUpload': return ltUpload_(b);
    case 'ltReadReceipt': return ltReadReceipt_(b);
    case 'ltGuestNotice': return ltGuestNotice_(b);
    case 'ltGuestMsg': return ltGuestMsg_(b);
    case 'ltGuestFile': return ltGuestFile_(b);
  }
  return null;
}
/* ══════════════════════════════════════════════════════════════════════
   REGISTRO DE CONSUMO DE IA → hub (Consumo de IA, en Mi cuenta del admin principal)
   Para: EPI (Apps Script) y el backend de Hola (Apps Script).

   1. En el Apps Script de ALMA ejecuta UNA vez claveUsoIA(). El registro muestra USO_KEY y ALMA_URL.
   2. En el Apps Script de esta app: ⚙️ Configuración del proyecto → Propiedades del script → agrega
        ALMA_URL = (la URL /exec de ALMA)
        USO_KEY  = (la clave del paso 1)
        USO_APP  = EPI   (o Hola)
   3. Pega la función registrarUsoIA_ al final del archivo.
   4. Justo después de cada llamada a https://api.anthropic.com/v1/messages, agrega UNA línea:
        registrarUsoIA_('Resumen IA', 'claude-sonnet-4-5', j.usage, 'detalle opcional');
      (j = la respuesta ya parseada con JSON.parse)
   ══════════════════════════════════════════════════════════════════════ */

function registrarUsoIA_(funcion, modelo, usage, detalle, ref) {
  try {
    var p = PropertiesService.getScriptProperties(), url = p.getProperty('ALMA_URL') || 'https://script.google.com/macros/s/AKfycbzTdkEpRPgnwaUIHWbQmrysPEqGYqTqDKYwMaQlnun-OT7B2hIa6KdSNS-aedWN-I0cZQ/exec', k = p.getProperty('USO_KEY');
    if (!url || !k) return;
    UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ usoIA: 1, k: k, app: p.getProperty('USO_APP') || 'Hola', funcion: funcion || 'IA', modelo: modelo || '',
        usage: usage || {}, detalle: detalle || '', ref: ref || '' })
    });
  } catch (e) { console.warn('registrarUsoIA_: ' + e); }
}

