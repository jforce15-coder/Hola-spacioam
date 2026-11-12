/* Prueba del registro a recepción el día de llegada y de la corrección de Baldone (apps-script/Código.js), con dobles:
   sin Google, sin correo y sin ALMA de verdad.
   Juan, 12-nov-2026: «Los formularios deben enviarse el día del check-in por la mañana (o inmediatamente después, si a
   la hora estipulada el huésped no lo ha llenado y decide llenarlo después).» Revisa que:
   1. llenado días antes: no sale a recepción (ni correo ni WhatsApp de ALMA); sale el día de llegada a las 8:00 (hora de
      Guatemala), una vez, nunca antes;
   2. corregido antes de las 8:00: sale una sola vez, con lo último guardado;
   3. llenado el mismo día después de las 8:00: sale de inmediato; si lo corrige ese día, sale otra vez actualizado (force);
   4. llenado el día de llegada antes de las 8:00: sale a las 8:00 de ese día;
   5. Baldone: la corrección cambia solo las filas de Baldone con el número viejo, solo ese campo, y una segunda vez no
      hace nada.
   node .github/registro-recepcion.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

let AHORA = 0;
const gt = (ymdHm) => Date.parse(ymdHm.replace(' ', 'T') + ':00-06:00');   // hora de Guatemala → ms
const fmt = (d, tz, f) => { const g = new Date(new Date(d).getTime() - 6 * 3600e3), p = (n) => String(n).padStart(2, '0');
  if (f === 'yyyy-MM-dd') return g.getUTCFullYear() + '-' + p(g.getUTCMonth() + 1) + '-' + p(g.getUTCDate());
  if (f === 'HH:mm') return p(g.getUTCHours()) + ':' + p(g.getUTCMinutes()); return g.toISOString(); };
function hoja(filas) {
  return {
    filas,
    appendRow: (r) => filas.push(r.slice()), getLastRow: () => filas.length,
    getRange: (f, c, nf, nc) => ({
      getValues: () => filas.slice(f - 1, f - 1 + (nf || 1)).map((r) => { const x = r.slice(c - 1, c - 1 + (nc || 1)); while (x.length < (nc || 1)) x.push(''); return x; }),
      getValue: () => filas[f - 1][c - 1],
      setValue: (v) => { filas[f - 1][c - 1] = v; },
      setValues: (vals) => vals.forEach((v, i) => v.forEach((x, j) => { filas[f - 1 + i][c - 1 + j] = x; }))
    })
  };
}
let hojas = {}, props = {}, correos = [], avisosAlma = [], logs = [], version = '';
const ctx = {
  console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isFinite, isNaN, encodeURIComponent, decodeURIComponent,
  Date: class extends Date { constructor(...a) { if (!a.length) super(AHORA); else super(...a); } static now() { return AHORA; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, getProperties: () => props }) },
  Utilities: { formatDate: fmt, sleep() {}, base64Encode: () => '', computeDigest: () => [] },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => hojas[n] || null, insertSheet: (n) => (hojas[n] = hoja([])) }) },
  uf_: () => ({ getResponseCode: () => 200, getContentText: () => '{"ok":true}' })
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), ctx);
/* Lo que el formulario toca además de recepción: aquí no escribe hojas, Drive ni correo del huésped. */
const META = { code: 'HMPRUEBA01', propertyName: 'Z7 - Monaco - C2', apartment: 'C2', checkin: '2026-11-15', checkout: '2026-11-17' };
Object.assign(ctx, {
  CFG_: () => ({ SHEET_ID: 'x' }), submitFormSave_: () => null, draftUpsert_() {}, guestWelcomeContent_: () => ({ subject: '', text: '', html: '' }), sendMail_: () => true,
  buildRegistrationPdf_: (meta, f) => ({ version: f && f.version !== undefined ? f.version : version }),
  contactsFor_: () => ({ emails: ['recepcion@ejemplo.com'], whatsapps: ['50255550101', ctx.ADMIN_WHATSAPP_] }),
  notifyStation_: (meta, guests, pdf) => { correos.push({ code: meta.code, version: pdf && pdf.version }); return { ok: true }; },
  notifyWhatsApp_: (meta, guests, pdf, nums, force) => { avisosAlma.push({ code: meta.code, version: pdf && pdf.version, force: !!force, admin: nums.indexOf(ctx.ADMIN_WHATSAPP_) >= 0 }); return { ok: true, viaAlma: true }; },
  getRegistration_: () => ({ ok: true, record: { guests: [{ name: 'Ana', main: true }], version } }), metaForCode_: () => Object.assign({}, META),
  conImagenesDoc_: (g) => g, logSend_: (canal, meta, to, okk, det) => logs.push({ canal, ok: okk, det })
});
/* El PDF de un envío programado se arma con lo guardado (getRegistration_): la «versión» viaja en el registro. */
ctx.buildRegistrationPdf_ = (meta, f) => ({ version: (f && f.version) || version });
const llenar = (v, meta) => { version = v; return ctx.submitForm_({ reservation: Object.assign({}, META, meta || {}), form: { guests: [{ name: 'Ana', main: true }], version: v } }); };
const reset = () => { hojas = {}; correos = []; avisosAlma = []; logs = []; version = ''; };
const salidas = () => correos.length + avisosAlma.length;
const pasada = (cuando) => { AHORA = gt(cuando); ctx.quickSync(); };
ctx.listReservations_ = () => ({});   // quickSync sin Hospitable

/* 1 · llenado días antes */
reset(); AHORA = gt('2026-11-12 14:00');
let r = llenar('v1');
ok(r.ok && salidas() === 0, '1 · llenado el 12-nov para llegar el 15-nov: no sale a recepción (ni correo ni WhatsApp)');
ok(r.sendReport && r.sendReport.whatsapp.programado === '2026-11-15 08:00', '1 · queda programado para el 15-nov a las 08:00: ' + JSON.stringify(r.sendReport));
pasada('2026-11-14 20:00'); pasada('2026-11-15 07:50');
ok(salidas() === 0, '1 · el día anterior y a las 7:50 del día de llegada no sale nada');
pasada('2026-11-15 08:05');
ok(correos.length === 1 && avisosAlma.length === 1 && avisosAlma[0].admin, '1 · a las 8:05 sale una vez (correo y WhatsApp de ALMA, con el administrador en el mismo envío)');
pasada('2026-11-15 08:15'); pasada('2026-11-15 12:00');
ok(correos.length === 1 && avisosAlma.length === 1, '1 · y no se repite en las pasadas siguientes');

/* 2 · corrección antes de la hora */
reset(); AHORA = gt('2026-11-12 14:00'); llenar('v1');
AHORA = gt('2026-11-14 22:00'); llenar('v2-corregido');
ok(salidas() === 0 && hojas.RecepcionProgramada.filas.length === 2, '2 · la corrección del 14-nov no sale y no crea otra fila');
pasada('2026-11-15 08:02');
ok(avisosAlma.length === 1 && correos.length === 1 && avisosAlma[0].version === 'v2-corregido' && correos[0].version === 'v2-corregido', '2 · a las 8:00 sale una sola vez, con lo último: ' + JSON.stringify(avisosAlma));

/* 3 · el mismo día después de las 8:00 */
reset(); AHORA = gt('2026-11-15 10:30');
llenar('v1');
ok(correos.length === 1 && avisosAlma.length === 1 && !avisosAlma[0].force, '3 · llenado el día de llegada a las 10:30: sale de inmediato');
AHORA = gt('2026-11-15 11:00'); llenar('v2');
ok(avisosAlma.length === 2 && avisosAlma[1].force && avisosAlma[1].version === 'v2' && correos.length === 2, '3 · corregido ese mismo día: sale otra vez actualizado (force, como «Reenviar a recepción»)');
pasada('2026-11-15 11:10');
ok(avisosAlma.length === 2, '3 · y la pasada de las 8:00 no lo vuelve a mandar');
reset(); AHORA = gt('2026-11-16 09:00'); llenar('v1', { checkin: '2026-11-15' });
ok(salidas() === 2, '3 · llenado después del check-in (tarde): sale de inmediato');

/* 4 · el día de llegada antes de las 8:00 */
reset(); AHORA = gt('2026-11-15 06:40'); llenar('v1');
ok(salidas() === 0, '4 · llenado a las 6:40 del día de llegada: espera a las 8:00');
pasada('2026-11-15 08:00');
ok(salidas() === 2, '4 · sale a las 8:00');
/* Lo llenó otra vez a las 8:03, antes de que corriera la pasada: sale al momento con lo último y la pasada ya no lo manda. */
reset(); AHORA = gt('2026-11-14 09:00'); llenar('v1');
AHORA = gt('2026-11-15 08:03'); llenar('v2');
pasada('2026-11-15 08:10');
ok(avisosAlma.length === 1 && avisosAlma[0].version === 'v2', '4 · si lo vuelve a llenar a la hora, sale una sola vez con lo último');

/* 5 · Baldone en Estaciones */
{ const viejo = ctx.BALDONE_TEL_VIEJO_, nuevo = ctx.BALDONE_TEL_NUEVO_;
  ok(viejo.slice(-4) === '9117' && nuevo.slice(-4) === '6455', '5 · el número viejo termina en 9117 y el nuevo en 6455');
  const cab = ['property_id', 'property_name', 'email1', 'email2', 'phone1', 'phone2', 'updated_at'];
  hojas = { Estaciones: hoja([cab,
    ['p1', 'Z2 - Baldone - 1010', 'recepcionbaldone@gmail.com', '', Number(viejo), '', 'u1'],
    ['p2', 'Z2 - Baldone - 1103', 'recepcionbaldone@gmail.com', '', '50255550202', '+502 3128 9117', 'u2'],
    ['p3', 'Z10 - Brunelo - 905', '', '', Number(viejo), '', 'u3']]) };
  props = {}; logs = [];
  const n = ctx.baldoneRecepcionCorregir_(), F = hojas.Estaciones.filas;
  ok(n === 2 && String(F[1][4]) === nuevo && String(F[2][5]) === nuevo, '5 · cambia el teléfono viejo en las dos filas de Baldone (escrito como número y con espacios)');
  ok(F[2][4] === '50255550202' && F[1][6] === 'u1' && F[2][2] === 'recepcionbaldone@gmail.com', '5 · no toca el otro teléfono, el correo ni la fecha');
  ok(Number(F[3][4]) === Number(viejo), '5 · no toca otra propiedad aunque tenga el mismo número');
  ok(logs.filter((l) => l.canal === 'correccion').length === 2 && logs.every((l) => (l.det || '').indexOf(nuevo) < 0), '5 · lo anota en el registro (sin el número completo)');
  F[1][4] = Number(viejo);   // si alguien lo vuelve a escribir a mano, la corrección no se repite
  ok(ctx.baldoneRecepcionCorregir_() === 0 && Number(F[1][4]) === Number(viejo) && /2 cambio/.test(props.BALDONE_RECEPCION_V1), '5 · una segunda vez no hace nada (BALDONE_RECEPCION_V1)');
  const pc = ctx.codeContactsFor_('Z2 - Baldone - 1010');
  ok(pc.whatsapps.length === 1 && pc.whatsapps[0] === nuevo, '5 · la tabla del código (PROPERTY_CONTACTS_) ya tiene el número nuevo de Baldone');
}
process.exit(fallo);
