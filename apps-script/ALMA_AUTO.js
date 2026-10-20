/* ALMA · relevo de mensajes de Hospitable → n8n
   ------------------------------------------------------------
   ⚠️ Este archivo NO declara doPost ni doGet: Apps Script solo permite uno por proyecto
   y el de Código.gs es el que atiende la app. Código.gs detecta los webhooks de Hospitable
   (action "message.created" / data.sender_type) y llama a almaRelay_(e). */

const N8N_URL    = 'https://spacioam.app.n8n.cloud/webhook/alma-hospitable-v3';
const SOLO_NOCHE = false; // false = reenvía 24 h (útil en SOMBRA). true = solo 19:00–04:00 Guatemala.
const HORA_INICIO = 19;
const HORA_FIN    = 4;

function almaRelay_(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const data = body.data || body;

    if (body.action && body.action !== 'message.created') return almaOk_('ignorado: evento');

    const sender = String(data.sender_type || '').toLowerCase();
    if (sender !== 'guest' || !data.body) return almaOk_('ignorado: no es huésped');

    if (SOLO_NOCHE) {
      const h = Number(Utilities.formatDate(new Date(), 'America/Guatemala', 'H'));
      const enVentana = h >= HORA_INICIO || h < HORA_FIN;
      if (!enVentana) return almaOk_('ignorado: fuera de horario');
    }

    const id = String(data.id || body.id || '');
    if (id) {
      const cache = CacheService.getScriptCache();
      if (cache.get('alma_' + id)) return almaOk_('ignorado: duplicado');
      cache.put('alma_' + id, '1', 21600);
    }

    UrlFetchApp.fetch(N8N_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
    return almaOk_('reenviado');
  } catch (err) {
    return almaOk_('error: ' + err);
  }
}

function almaOk_(msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, msg: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
