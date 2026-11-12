/* Prueba con dobles de los enlaces cortos de Hola (Hub #488 · T3): apps-script/enlaces.js, pasando por route_ de Código.js
   y la sesión de sesion.js, sin Sheets, Gmail ni red.
   1. «acortar» dos veces el mismo enlace da el mismo código (también sin la caché); 5 caracteres del alfabeto sin 0/o ni
      1/l/i, la celda va como texto y la hoja «Enlaces» se crea sola. Si el código sorteado ya existe, se sortea otro.
   2. «enlace» (pública) con un código válido devuelve solo el enlace y suma un clic; uno raro o que no existe da error y
      nada más, y nunca crea la hoja.
   3. «acortar» sin sesión se rechaza (con SESION_EXIGIR apagado y encendido); con sesión o con la llave del robot (el Hub)
      pasa. Un enlace de otro dominio (también de otra app de Spacio AM) no se acorta.
   4. Lo que Hola manda sale corto con hola.spacioam.com: los correos (texto y botones; las imágenes no), el perfil de
      Long Term (panel, «Copiar» y WhatsApp), el enlace directo a la estancia (con sesión) y la invitación de quien
      comparte su reserva. Si la hoja falla, sale el largo.
   5. 404.html pregunta al Apps Script de Hola y solo abre hola.spacioam.com o Google Drive / Docs; ningún archivo del sitio
      tiene forma de código sin estar reservado.
   node .github/enlaces.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const ABC = '23456789abcdefghjkmnpqrstuvwxyz', CODIGO = /^[23456789abcdefghjkmnpqrstuvwxyz]{5}$/;
const CORTO = /^https:\/\/hola\.spacioam\.com\/([23456789abcdefghjkmnpqrstuvwxyz]{5})$/;
const CAB = ['codigo', 'url', 'app', 'creado', 'por', 'clics', 'ultimo'];
const LT = 'https://hola.spacioam.com/?lt=0123456789abcdef0123456789abcdef01234567';
const DIRECTO = 'https://hola.spacioam.com/#r=HMWM942RSN&s=0123456789abcdef&t=wifi';
const LLAVE = 'llave-del-robot-de-prueba';

/* Una hoja de cálculo de mentira: filas en memoria, con lo que usa enlaces.js. */
function hojaFalsa(filas) {
  const sh = { filas, formatos: [],
    getDataRange: () => ({ getValues: () => sh.filas.map(f => f.slice()) }),
    getLastRow: () => sh.filas.length,
    setFrozenRows() {},
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      const rango = {
        setValues(vals) { vals.forEach((fila, i) => { while (sh.filas.length < r + i) sh.filas.push([]); fila.forEach((v, j) => { sh.filas[r + i - 1][c + j - 1] = v; }); }); return rango; },
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((sh.filas[r + i - 1] || [])[c + j - 1]) ?? '')),
        setNumberFormat(f) { sh.formatos.push([r, c, f]); return rango; }, setFontWeight() { return rango; }
      };
      return rango;
    } };
  return sh;
}

function caja(o) {
  o = o || {};
  const hojas = {}, cache = {}, props = { SESION_EXIGIR: o.exigir ? '1' : null }, correos = [];
  if (o.filas) hojas.Enlaces = hojaFalsa(o.filas);
  const azar = (o.azar || []).slice();
  const M = Object.create(Math); M.random = () => (azar.length ? azar.shift() : Math.random());
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math: M, String, Number, Object, Array, RegExp, Error, Buffer, isNaN, isFinite, parseInt,
    encodeURIComponent, decodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    LockService: { getUserLock: () => ({ hasLock: () => false, tryLock: () => !o.sinCandado, waitLock() {}, releaseLock() {} }),
                   getScriptLock: () => ({ hasLock: () => false, tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    ContentService: { createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Utilities: { DigestAlgorithm: { MD5: 'md5', SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, sleep() {},
      computeDigest: (alg, t) => Array.from(crypto.createHash(alg).update(String(t)).digest()).map(b => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: b => Buffer.from(b.map(x => x & 255)).toString('base64url'),
      computeHmacSha256Signature: (t, k) => Array.from(crypto.createHmac('sha256', String(k)).update(String(t)).digest()).map(b => (b > 127 ? b - 256 : b)),
      formatDate: d => new Date(d).toISOString(), getUuid: () => crypto.randomUUID() },
    SpreadsheetApp: { openById: () => { if (o.hojaRota) throw new Error('Sheets no responde');
      return { getSheetByName: n => hojas[n] || null, insertSheet: n => (hojas[n] = hojaFalsa([])) }; } },
    GmailApp: { sendEmail: (para, asunto, texto, op) => correos.push({ para, asunto, texto, html: (op || {}).htmlBody || '' }) },
    MailApp: { sendEmail() { throw new Error('no debe usarse'); } },
    UrlFetchApp: { fetch() { throw new Error('la prueba no sale a internet'); } }
  };
  vm.createContext(ctx);
  ['Código.js', 'sesion.js', 'cupo.js', 'enlaces.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
  // La llave del robot de esta prueba (la de verdad solo vive en las Propiedades del Hub) y una sesión de mentira.
  vm.runInContext("SES_ROBOT_HASH_ = '" + crypto.createHash('sha256').update(LLAVE).digest('hex') + "';", ctx);
  ctx.sesionDe_ = b => (b && b.session === 'firmada' ? { email: 'equipo@ejemplo.com', nombre: 'Equipo' } : null);
  const api = body => JSON.parse(ctx.route_({ postData: { contents: JSON.stringify(body) } }, 'POST').getContent());
  return { ctx, hojas, cache, correos, props, api, filas: () => (hojas.Enlaces ? hojas.Enlaces.filas : null) };
}
const SES = 'firmada';

/* ── 1 ── mismo código, formato, hoja que se crea sola, choque */
{ const c = caja();
  const r1 = c.api({ action: 'acortar', url: LT, session: SES }), r2 = c.api({ action: 'acortar', url: LT, session: SES });
  ok(r1.ok && r2.ok && r1.codigo === r2.codigo && CODIGO.test(r1.codigo), '«acortar» dos veces el mismo enlace da el mismo código (' + r1.codigo + ')');
  ok(r1.corto === 'https://hola.spacioam.com/' + r1.codigo, 'el corto lleva la dirección de Hola: ' + r1.corto);
  Object.keys(c.cache).forEach(k => delete c.cache[k]);
  ok(c.api({ action: 'acortar', url: LT, session: SES }).codigo === r1.codigo, '…también sin la caché: lo busca en la hoja');
  ok(c.filas() && c.filas().length === 2 && JSON.stringify(c.filas()[0]) === JSON.stringify(CAB), 'la hoja «Enlaces» se crea sola: encabezado (codigo · url · app · creado · por · clics · ultimo) y una sola fila');
  const f = c.filas()[1];
  ok(f[0] === r1.codigo && f[1] === LT && f[2] === 'hola' && f[4] === 'equipo@ejemplo.com' && f[5] === 0, 'la fila guarda el código, el enlace, la app, quién y 0 clics');
  ok(c.hojas.Enlaces.formatos.some(x => x[0] === 2 && x[1] === 1 && x[2] === '@'), 'la celda del código va como texto (no se vuelve número)');
  const vistos = new Set([r1.codigo]); let bien = true;
  for (let i = 0; i < 200; i++) { const r = c.api({ action: 'acortar', url: LT + i, session: SES }); if (!r.ok || !CODIGO.test(r.codigo) || vistos.has(r.codigo)) bien = false; vistos.add(r.codigo); }
  ok(bien, '200 enlaces más: todos con el formato y sin repetir código'); }

{ // El azar da primero «22222» (ya existe) y después «33333».
  const i2 = ABC.indexOf('2') / 31 + 0.001, i3 = ABC.indexOf('3') / 31 + 0.001;
  const c = caja({ filas: [CAB, ['22222', 'https://hola.spacioam.com/?lt=otro-token-de-otra-estancia', 'hola', '', '', 0, '']], azar: [i2, i2, i2, i2, i2, i3, i3, i3, i3, i3] });
  const r = c.api({ action: 'acortar', url: LT, session: SES });
  ok(r.ok && r.codigo === '33333' && c.filas().length === 3, 'si el código choca con uno que ya existe, se sortea otro'); }

/* ── 2 ── «enlace» pública */
{ const c = caja({ filas: [CAB, ['k7q2m', LT, 'hola', '2026-11-12', 'equipo', 3, ''], ['zzzzz', 'https://evil.example.com/robo', 'hola', '', '', 0, ''], [22222, DIRECTO, 'hola', '', '', 0, '']] });
  const r = c.api({ action: 'enlace', codigo: 'k7q2m' });
  ok(r.ok && r.data.url === LT && Object.keys(r.data).join() === 'url' && Object.keys(r).sort().join() === 'data,ok', '«enlace» sin sesión devuelve solo el enlace');
  ok(c.filas()[1][5] === 4 && c.filas()[1][6], 'y suma un clic y apunta la hora (ultimo)');
  ok(c.api({ action: 'enlace', codigo: 'K7Q2M' }).data.url === LT && c.filas()[1][5] === 5, 'el código sirve en mayúsculas también');
  ok(c.api({ action: 'enlace', codigo: '22222' }).data.url === DIRECTO, 'un código que la hoja guardó como número igual se abre');
  const malos = ['k7q2', 'k7q2m1', 'k7q0m', 'k7qlm', 'k7q m', "' or 1", '', null, 'k7q2m/../x'].map(x => c.api({ action: 'enlace', codigo: x }));
  ok(malos.every(x => x.ok === false && !x.data), 'un código con forma rara da error y ningún dato');
  const no = c.api({ action: 'enlace', codigo: 'abcde' });
  ok(no.ok === false && !no.data && /no existe/.test(no.error), 'un código que no existe da «Este enlace no existe.» y ningún dato');
  const fuera = c.api({ action: 'enlace', codigo: 'zzzzz' });
  ok(fuera.ok === false && !fuera.data && c.filas()[2][5] === 0, 'si alguien escribe a mano otro dominio en la hoja, no se redirige allá ni cuenta clic');
  const sin = caja();
  ok(sin.api({ action: 'enlace', codigo: 'k7q2m' }).ok === false && !sin.hojas.Enlaces, 'sin la hoja: «enlace» da error y no crea la hoja'); }

/* ── 3 ── quién puede acortar y qué */
[false, true].forEach(exigir => {
  const c = caja({ exigir, filas: [CAB, ['k7q2m', LT, 'hola', '', '', 0, '']] }), tag = exigir ? ' (SESION_EXIGIR = 1)' : ' (SESION_EXIGIR apagado)';
  const sin = c.api({ action: 'acortar', url: LT + 'nuevo' });
  ok(sin.ok === false && c.filas().length === 2, '«acortar» sin sesión se rechaza y no escribe nada' + tag);
  const llaveMala = c.api({ action: 'acortar', url: LT + 'nuevo', robot: 'otra' });
  ok(llaveMala.ok === false && c.filas().length === 2, '«acortar» con otra llave se rechaza' + tag);
  ok(c.api({ action: 'enlace', codigo: 'k7q2m' }).data.url === LT, '«enlace» sin sesión pasa' + tag);
  const con = c.api({ action: 'acortar', url: LT + 'nuevo', session: SES });
  ok(con.ok && CORTO.test(con.corto), '«acortar» con sesión pasa' + tag);
  const robot = c.api({ action: 'acortar', url: LT + 'robot', robot: LLAVE, por: 'Juan' });
  ok(robot.ok && CORTO.test(robot.corto) && c.filas()[c.filas().length - 1][4] === 'Alma · Juan', '«acortar» con la llave del robot (el Hub) pasa y la fila dice que lo pidió Alma' + tag);
});

{ const c = caja();
  const malos = ['https://evil.example.com/?lt=' + 'x'.repeat(40), 'http://hola.spacioam.com/?lt=' + 'x'.repeat(40), 'https://hola.spacioam.com.evil.com/' + 'x'.repeat(40),
    'https://evil.com@hola.spacioam.com/' + 'x'.repeat(40), 'https://hola.spacioam.com:8443/' + 'x'.repeat(40), 'javascript:alert(1)', 'https://hola.spacioam.com/ x', '',
    'https://hub.spacioam.com/?conv=' + 'x'.repeat(40), 'https://grow.spacioam.com/?datos=' + 'x'.repeat(40), 'https://docs.spacioam.com/index.html?firmar=d' + 'x'.repeat(30),
    'https://hola.spacioam.com/' + 'a'.repeat(2100)];
  const rs = malos.map(u => c.api({ action: 'acortar', url: u, session: SES }));
  ok(rs.every(r => r.ok === false) && !c.hojas.Enlaces, 'un enlace de otro dominio (también de otra app: Hub, Grow, Docs), sin https, con @ o puerto no se acorta');
  ok(malos.every(u => c.ctx.acortar_(u, 'x') === u), 'acortar_ los devuelve tal cual');
  const drive = c.api({ action: 'acortar', url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view', session: SES });
  ok(drive.ok && CORTO.test(drive.corto), 'los de Google Drive sí se acortan (con la dirección de Hola)');
  ok(c.ctx.acortar_('https://hola.spacioam.com', 'x') === 'https://hola.spacioam.com' && c.ctx.acortar_('https://hola.spacioam.com/', 'x') === 'https://hola.spacioam.com/', 'la dirección sola (se escribe a mano) no se acorta');
  const rota = caja({ hojaRota: true }), sc = caja({ sinCandado: true });
  ok(rota.ctx.acortar_(LT, 'x') === LT && sc.ctx.acortar_(LT, 'x') === LT && !sc.hojas.Enlaces, 'si la hoja o el candado fallan, sale el enlace largo (nunca frena un envío)'); }

/* ── 4 ── lo que Hola manda sale corto */
{ const c = caja();
  // Correos: sendMail_ es el punto final de todo correo de Hola.
  const html = '<img src="https://hola.spacioam.com/imagenes-correo/hero-largo-de-la-estancia.jpg"><a href="' + LT + '">Abrir mi perfil</a>' +
    '<a href="https://hola.spacioam.com/#r=HMWM942RSN&amp;s=0123456789abcdef">Directo</a><a href="https://hola.spacioam.com">Ver mi espacio</a>';
  c.ctx.sendMail_('huesped@ejemplo.com', 'Tu perfil', 'Tu perfil: ' + LT + '. Gracias.', html);
  const m = c.correos[0] || {};
  ok(/^Tu perfil: https:\/\/hola\.spacioam\.com\/\w{5}\. Gracias\.$/.test(m.texto), 'el texto del correo sale con el corto (el punto queda fuera): ' + m.texto);
  const hrefs = (m.html.match(/href="[^"]+"/g) || []);
  ok(hrefs.length === 3 && CORTO.test(hrefs[0].slice(6, -1)) && CORTO.test(hrefs[1].slice(6, -1)) && hrefs[2] === 'href="https://hola.spacioam.com"', 'los botones del correo salen cortos (también con &amp;) y la dirección sola se deja: ' + hrefs.join(' '));
  ok(m.html.indexOf('src="https://hola.spacioam.com/imagenes-correo/hero-largo-de-la-estancia.jpg"') >= 0, 'las imágenes del correo no se tocan');
  ok(hrefs[0].slice(6, -1) === (/https:\/\/hola\.spacioam\.com\/\w{5}/.exec(m.texto) || [])[0], 'el botón y el texto llevan el mismo corto');
  ok(c.ctx.abrirEnlace_(hrefs[1].slice(-6, -1)).data.url === 'https://hola.spacioam.com/#r=HMWM942RSN&s=0123456789abcdef', 'el corto del botón abre el enlace de verdad (sin &amp;)');

  // Long Term: el panel recibe el corto para copiar y mandar por WhatsApp; el correo del enlace también.
  c.ctx.ltRes_ = () => ({ codigo_lt: 'LT2611ABCD', propiedad_nombre: 'Z10 - Prueba - 905', _row: 2 });
  c.ctx.ltLinkOf_ = () => LT;
  const l1 = c.ctx.ltLink_({ code: 'LT2611ABCD' });
  ok(l1.ok && CORTO.test(l1.url), 'Long Term «Copiar enlace» y «Enviar por WhatsApp» (ltLink) dan el corto: ' + l1.url);
  c.ctx.ltUpdate_ = () => {}; c.ctx.ltEnc_ = t => 'cifrado'; c.ctx.ltHash_ = t => 'huella'; c.ctx.ltNewToken_ = () => 'tokennuevo0123456789abcdef0123456789abcd';
  const l2 = c.ctx.ltToken_({ code: 'LT2611ABCD' });
  ok(l2.ok && CORTO.test(l2.url) && l2.url !== l1.url, 'un enlace nuevo (ltToken) da otro corto: ' + l2.url);
  c.ctx.ltAppend_ = () => {};
  c.ctx.ltMail_({ codigo_lt: 'LT2611ABCD', propiedad_nombre: 'Z10 - Prueba - 905', entrada: '2026-11-01', tipo_fin: 'indefinido' }, { nombre: 'Ana Prueba', email: 'huesped@ejemplo.com' }, 'enlace', {}, '');
  const lm = c.correos[1] || {};
  ok(lm.texto && lm.texto.indexOf(l1.url) >= 0 && lm.texto.indexOf('?lt=') < 0 && lm.html.indexOf('href="' + l1.url + '"') >= 0 && lm.html.indexOf('?lt=') < 0, 'el correo del perfil de Long Term (botón y texto) lleva el corto, nunca el token largo');

  // Enlace directo a la estancia (panel): con sesión, corto; sin sesión, como antes.
  const d1 = c.api({ action: 'guestLink', code: 'HMWM942RSN', tile: 'wifi', base: 'https://hola.spacioam.com', session: SES });
  ok(d1.ok && CORTO.test(d1.url) && /#r=HMWM942RSN&s=[0-9a-f]{16}&t=wifi$/.test(d1.largo), '«Enlace directo» del panel (con sesión) da el corto: ' + d1.url);
  ok(c.ctx.abrirEnlace_(CORTO.exec(d1.url)[1]).data.url === d1.largo, '…y el corto abre el enlace firmado de siempre');
  const d0 = c.api({ action: 'guestLink', code: 'HMWM942RSN', tile: 'wifi', base: 'https://hola.spacioam.com' });
  ok(d0.ok && d0.url === d0.largo, 'sin sesión «guestLink» no escribe en la hoja (sale largo, como antes)');

  // Invitación a quien comparte la reserva (correo).
  c.props.APP_URL = 'https://hola.spacioam.com';
  c.hojas.Usuarios = { appendRow() {} };
  c.api({ action: 'createAccount', email: 'titular@ejemplo.com', reservationCodes: ['HMWM942RSN'], sharedEmails: ['amiga@ejemplo.com'] });
  const inv = c.correos[2] || {};
  ok(inv.para === 'amiga@ejemplo.com' && /crea tu contraseña aquí:\nhttps:\/\/hola\.spacioam\.com\/\w{5}\n/.test(inv.texto) && inv.texto.indexOf('#invite=') < 0, 'la invitación de quien comparte su reserva sale con el corto (sin el correo en el enlace)'); }

{ // El código decide lo que se manda: sendMail_ acorta antes de enviar, y las acciones del panel de Long Term también.
  const src = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8');
  const cuerpo = n => (new RegExp('\\nfunction ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src) || [''])[0];
  ok(/acortarEnTexto_\(body/.test(cuerpo('sendMail_')) && /acortarEnHtml_\(htmlBody/.test(cuerpo('sendMail_')) && cuerpo('sendMail_').indexOf('acortar') < cuerpo('sendMail_').indexOf('GmailApp.sendEmail'), 'sendMail_ acorta el texto y los botones antes de enviar');
  const otros = src.split(/\n(?=function )/).filter(f => /GmailApp\.sendEmail\(|MailApp\.sendEmail\(/.test(f)).map(f => /^function ([\w$]+)/.exec(f)).filter(Boolean).map(m => m[1]);
  ok(otros.length && otros.every(n => n === 'sendMail_'), 'todo correo de Hola sale por sendMail_ (' + otros.join(', ') + ')');
  ok(/acortar_\(ltLinkOf_\(r\)/.test(cuerpo('ltDetail_')) && /acortar_\(ltUrl_\(token\)/.test(cuerpo('ltSave_')), 'el detalle y el alta de Long Term dan el corto al panel'); }

/* ── 5 ── 404.html y rutas del sitio */
{ const h = fs.readFileSync(path.join(RAIZ, '404.html'), 'utf8'), cfg = fs.readFileSync(path.join(RAIZ, 'config.js'), 'utf8');
  const api = (/var API_URL = "([^"]+)"/.exec(h) || [])[1], back = (/backendUrl:\s*"([^"]+)"/.exec(cfg) || [])[1];
  ok(api && api === back, '404.html pregunta al mismo Apps Script que la app (backendUrl de config.js)');
  ok(/action: "enlace", codigo: codigo/.test(h) && /\[23456789abcdefghjkmnpqrstuvwxyz\]\{5\}/.test(h), '404.html pide la acción pública «enlace» con el código de 5 de la dirección');
  const seguro = (/var seguro = (\/.*\/i);/.exec(h) || [])[1];
  const rx = seguro && vm.runInNewContext(seguro);
  ok(rx && rx.test(LT) && rx.test('https://drive.google.com/file/d/x/view') && !rx.test('https://evil.example.com/') && !rx.test('https://hub.spacioam.com/x') && !rx.test('https://hola.spacioam.com.evil.com/'), '404.html solo abre hola.spacioam.com o Google Drive / Docs');
  ok(h.indexOf('Abriendo tu enlace…') >= 0 && h.indexOf('Este enlace ya no está disponible. Escríbenos a <a href="mailto:hola@spacioam.com">hola@spacioam.com</a>.') >= 0, '404.html: «Abriendo tu enlace…» y «Este enlace ya no está disponible…»');
  const c = caja(), rsv = c.ctx.ENLACES_RESERVADOS_;
  const conForma = fs.readdirSync(RAIZ).map(n => n.toLowerCase()).filter(n => CODIGO.test(n));
  ok(conForma.every(n => rsv.indexOf(n) >= 0), 'los archivos del sitio con forma de código están reservados (' + (conForma.join(', ') || 'ninguno') + ')'); }

process.exit(fallo);
