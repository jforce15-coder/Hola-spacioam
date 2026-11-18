/* ═══ TRASLADO · quién atiende lo de fondo (Hub-Spacioam docs/specs/traslado-workspace.md) ═══
   Mientras dura el traslado a alma@ hay dos proyectos de Hola (el viejo en la cuenta Gmail y el nuevo en alma@) que leen
   la misma hoja. Si los dos corrieran sus activadores, un huésped recibiría dos veces el mismo correo o WhatsApp.
   · La pestaña TRASLADO de la hoja de Hola dice qué proyecto es el dueño (B1 = su id). Los activadores de cualquier otro
     proyecto salen sin hacer nada (holaSoyRespaldo_). Sin la pestaña, todos corren como siempre.
   · holaTomarActivadores() (lo corre el nuevo al traer las Propiedades, «al_traer»): instala los activadores de Hola y
     se anota como dueño. Desde ahí lo de fondo lo hace alma@ (con su cupo); el viejo queda de respaldo.
   · Volver atrás: en la hoja, pestaña TRASLADO, poner en B1 el id del proyecto viejo (o borrar la pestaña). */
var HOLA_TRASLADO_HOJA_ = 'TRASLADO';

function holaDuenoActivo_() {
  var c = CacheService.getScriptCache(), v = c.get('traslado_dueno');
  if (v !== null) return v;
  v = '';
  try {
    var sh = SpreadsheetApp.openById(CFG_().SHEET_ID).getSheetByName(HOLA_TRASLADO_HOJA_);
    if (sh) v = String(sh.getRange('B1').getValue() || '').trim();
  } catch (e) { console.warn('holaDuenoActivo_: ' + e); }
  c.put('traslado_dueno', v, 300);
  return v;
}

function holaSoyRespaldo_() {
  var d = holaDuenoActivo_();
  return !!d && d !== ScriptApp.getScriptId();
}

function holaTomarActivadores() {
  [['setup', setup],                       // pestañas, borrado (3:00), sync 5:00 y 15:00, avisos de early check-in, despedida 7:30
   ['installSyncTriggers', installSyncTriggers],   // sync rápido cada 10 min (y vuelve a dejar los de 5:00 y 15:00)
   ['ltSetup', ltSetup]                     // recordatorios de estadías largas (8:00)
  ].forEach(function (x) { try { x[1](); } catch (e) { console.log('Falló ' + x[0] + ': ' + e.message); } });
  var hay = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'quickSync'; });
  if (!hay) throw new Error('No quedó el activador quickSync: el viejo sigue atendiendo lo de fondo. Vuelve a correr holaTomarActivadores.');
  var ss = SpreadsheetApp.openById(CFG_().SHEET_ID), sh = ss.getSheetByName(HOLA_TRASLADO_HOJA_) || ss.insertSheet(HOLA_TRASLADO_HOJA_);
  sh.getRange('A1:C1').setValues([['dueño', ScriptApp.getScriptId(), new Date().toISOString()]]);
  sh.getRange('A2').setValue('El proyecto con este id atiende lo de fondo de Hola. Para volver al viejo, pon su id en B1.');
  CacheService.getScriptCache().remove('traslado_dueno');
  var n = {}; ScriptApp.getProjectTriggers().forEach(function (t) { var f = t.getHandlerFunction(); n[f] = (n[f] || 0) + 1; });
  console.log('Hola: activadores ' + JSON.stringify(n) + '. Dueño de lo de fondo: este proyecto.');
  return n;
}
