/* ═══ SESIÓN FIRMADA · fase 1b (oct 2026) ═══════════════════════════════════════════
   Archivo común a los backends de Spacio AM (Mi, Epi, Grow, Docs, Hola). Lo mantiene GitHub.

   · sesionDe_(body) → perfil del usuario si la app envió una sesión firmada válida (body.session), o null.
     La comprueba el Apps Script del login (acción verify) y se guarda 1 hora en caché.
   · registrarAcceso_(accion, conSesion) → apunta, por acción, la última vez que llegó con sesión y sin
     ella (una sola propiedad: ACCESOS). Sirve para saber qué acciones usan huéspedes o enlaces públicos
     (sin sesión) antes de exigir sesión en las demás (fase 1c).
   · accesosDiag_(body) → si body.action === '__accesos' y trae la llave del robot, devuelve ese resumen.
   Nada de esto bloquea todavía: las apps siguen funcionando igual con o sin sesión.
   ═══════════════════════════════════════════════════════════════════════════════════ */
var SES_LOGIN_URL_ = 'https://script.google.com/macros/s/AKfycbxfdwLzsA8bwgOxUTOtf3Hw1ptIm8Cy34tspmFndu3WtRrkVSSnGyBP7obRrm73mcUd/exec';
var SES_ROBOT_HASH_ = 'b0d3ca9d3adb76025e4b4289181cb6300d7769a1d53a2a0c91636df9e0c65ed5';

/* SES_DUDA_: el login no pudo contestar (error, cupo o red). La sesión no se da por mala: exigirSesion_ deja pasar
   esa llamada en vez de mandar «session», que en el teléfono cierra la sesión. Antes un error pasajero del login
   (por ejemplo, al descargar un PDF que pide muchas fotos a la vez) quedaba guardado 10 min como «sesión inválida»
   y sacaba a Juan de Hola una y otra vez. Solo se guarda como inválida si el login lo dice claro. */
var SES_DUDA_ = false;
var SES_DEFINITIVOS_ = { session: 1, no_user: 1, suspended: 1 };
function sesionDe_(body) {
  SES_DUDA_ = false;
  var session = String((body && body.session) || '');
  if (session.indexOf('.') < 1 || session.length > 4000) return null;
  var cache = CacheService.getScriptCache();
  var k = 'ses_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, session)).slice(0, 40);
  var hit = cache.get(k);
  if (hit) { try { return hit === '-' ? null : JSON.parse(hit); } catch (e) {} }
  var lock = LockService.getUserLock(), conLock = !lock.hasLock() && lock.tryLock(15000);
  try {
    hit = cache.get(k);
    if (hit) { try { return hit === '-' ? null : JSON.parse(hit); } catch (e) {} }
    var j = null, porque = '';
    /* Si la propiedad LOGIN_TOKEN quedó vieja, el login contesta «token»: el segundo intento va con la llave de siempre. */
    var llaves = [PropertiesService.getScriptProperties().getProperty('LOGIN_TOKEN') || 'SpacioAM2026!', 'SpacioAM2026!'];
    for (var intento = 0; intento < 2 && !(j && (j.ok || SES_DEFINITIVOS_[j.error])); intento++) {
      if (intento) Utilities.sleep(700);
      try {
        var r = UrlFetchApp.fetch(SES_LOGIN_URL_, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
          payload: JSON.stringify({ action: 'verify', token: llaves[intento], session: session }) });
        var txt = r.getContentText() || '';
        try { j = JSON.parse(txt || '{}'); porque = j.ok ? '' : 'login dijo ' + String(j.error || '?'); }
        catch (e2) { j = null; porque = 'login no devolvió JSON (HTTP ' + r.getResponseCode() + '): ' + txt.slice(0, 80).replace(/\s+/g, ' '); }
      } catch (e) { console.warn('sesionDe_: ' + e); j = null; porque = 'no se pudo llamar al login: ' + String(e).slice(0, 120); }
    }
    if (j && j.ok && j.profile) { cache.put(k, JSON.stringify(j.profile), 3600); return j.profile; }
    if (j && SES_DEFINITIVOS_[j.error]) { cache.put(k, '-', 600); return null; }   // el login dice que no vale: inválida de verdad
    SES_DUDA_ = true;                                                              // el login falló: no se guarda nada
    try { var pc = CacheService.getScriptCache(); if (!pc.get('ses_falla_m')) { pc.put('ses_falla_m', '1', 300); PropertiesService.getScriptProperties().setProperty('SES_FALLA', new Date().toISOString() + ' · ' + porque); } } catch (e3) {}
    console.warn('sesionDe_: el login no confirmó (' + porque + '); se deja pasar');
    return null;
  } finally { if (conLock) lock.releaseLock(); }
}

function registrarAcceso_(accion, conSesion) {
  try {
    accion = String(accion || '(sin acción)').slice(0, 60);
    var tipo = conSesion === 'r' ? 'r' : conSesion ? 's' : 'n', cache = CacheService.getScriptCache(), ck = 'acc_' + tipo + '_' + accion;
    if (cache.get(ck)) return;                       // como mucho una escritura por acción y tipo cada hora
    cache.put(ck, '1', 3600);
    var lock = LockService.getUserLock(), conLock = !lock.hasLock() && lock.tryLock(5000);
    try {
      var p = PropertiesService.getScriptProperties(), m = {};
      try { m = JSON.parse(p.getProperty('ACCESOS') || '{}'); } catch (e) {}
      m[accion] = m[accion] || {};
      m[accion][tipo] = new Date().toISOString();
      p.setProperty('ACCESOS', JSON.stringify(m));
    } finally { if (conLock) lock.releaseLock(); }
  } catch (e) { console.warn('registrarAcceso_: ' + e); }
}

function accesosDiag_(body) {
  if (!body || body.action !== '__accesos') return null;
  var t = String(body.token || ''), h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  var out = h === SES_ROBOT_HASH_ ? { ok: true, accesos: JSON.parse(PropertiesService.getScriptProperties().getProperty('ACCESOS') || '{}'), sesFalla: PropertiesService.getScriptProperties().getProperty('SES_FALLA') || '' } : { ok: false, error: 'token' };
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ═══ FASE 1c · EXIGIR SESIÓN (apagado por defecto) ═══════════════════════════════════════
   · esRobot_(body) → true si la llamada trae la llave del robot (body.robot): el Hub y ALMA llaman así, de
     servidor a servidor, porque no tienen sesión de una persona.
   · exigirSesion_(accion, conSesion, body, publicas) → null si la llamada puede seguir; si no, la respuesta
     { ok:false, error:"session" } (sa-sesion.js la entiende: vuelve al login).
     Solo bloquea cuando la propiedad del script SESION_EXIGIR = 1. Siempre pasan: quien trae sesión, el robot
     y las acciones públicas de la app (huéspedes, firmas, webhooks). Lo bloqueado queda en ACCESOS como
     «⛔ acción», para ver al instante si algo legítimo se quedó afuera y apagarlo (SESION_EXIGIR = 0).
   ═════════════════════════════════════════════════════════════════════════════════════════ */
function esRobot_(body) {
  var t = String((body && body.robot) || ''); if (!t) return false;
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('') === SES_ROBOT_HASH_;
}
function exigirSesion_(accion, conSesion, body, publicas) {
  if (conSesion) return null;
  if (SES_DUDA_) { registrarAcceso_('⚠ ' + String(accion || ''), 'r'); return null; }   // el login no contestó: no se saca a nadie por eso
  accion = String(accion || '');
  if ((publicas || []).indexOf(accion) >= 0 || esRobot_(body)) return null;
  if (PropertiesService.getScriptProperties().getProperty('SESION_EXIGIR') !== '1') return null;
  registrarAcceso_('⛔ ' + accion, false);
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'session' })).setMimeType(ContentService.MimeType.JSON);
}


/* Diagnóstico público y sin datos: hace una comprobación con una sesión inventada y dice qué contestó el login.
   Lo correcto es «login dijo session». Cualquier otra cosa explica por qué Hola no reconocía las sesiones. */
function sesDiag_() {
  var cache = CacheService.getScriptCache();
  var falsa = 'diag' + Date.now().toString(36) + '.x';
  var p = sesionDe_({ session: falsa });
  return { ok: true, reconocida: !!p, duda: SES_DUDA_, falla: PropertiesService.getScriptProperties().getProperty('SES_FALLA') || '', tokenPropio: !!PropertiesService.getScriptProperties().getProperty('LOGIN_TOKEN') };
}
