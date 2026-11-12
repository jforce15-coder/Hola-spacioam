/* Prueba de los números de WhatsApp de recepción (apps-script/Código.js) con dobles: sin internet ni Google.
   12-nov-2026: en el panel los números se escriben de muchas formas («+502 5555 0101», «5555-0101», sin 502, o como
   número que Sheets guarda con decimales). Revisa que:
   1. normTel_ deja siempre el formato internacional de Guatemala (8 dígitos → 502 delante; sin espacios, guiones,
      +, paréntesis ni 00);
   2. contactsFor_ junta tabla del código + Estaciones + administrador sin repetir el mismo número escrito distinto;
   3. lo que Hola le da a ALMA (listContacts → adminContactsInfo_) ya va normalizado;
   4. el WhatsApp viejo (WA_VIA_ALMA = 0) manda a Meta el número normalizado.
   node .github/recepcion-numeros.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const props = {}, enviados = [];
const ctx = {
  console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, isFinite, encodeURIComponent, decodeURIComponent,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, getProperties: () => props }) },
  Utilities: { formatDate: () => '', base64Encode: () => '', computeDigest: () => [] },
  // las llamadas a internet pasan por uf_ (cupo.js): aquí es un doble que anota lo que saldría a Meta
  uf_: (url, o) => { const b = o && o.payload; if (typeof b === 'string') enviados.push(JSON.parse(b)); return { getResponseCode: () => 200, getContentText: () => '{"id":"m1","messages":[{"id":"w1"}]}' }; }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), ctx);

// 1. normTel_
const casos = [
  ['+502 5555 0101', '50255550101'], ['(502) 5555-0101', '50255550101'], ['5555 0101', '50255550101'], ['55550101', '50255550101'],
  [55550101, '50255550101'], [50255550101, '50255550101'], ['5.0255550101E+10', '50255550101'], ['00502 5555 0101', '50255550101'],
  ['+1 (305) 555-0100', '13055550100'], ['', ''], ['555', ''], [null, '']
];
casos.forEach(([x, esp]) => ok(ctx.normTel_(x) === esp, 'normTel_(' + JSON.stringify(x) + ') = ' + JSON.stringify(esp) + ' (dio ' + JSON.stringify(ctx.normTel_(x)) + ')'));
ok(igual(ctx.telsWa_(['5555 0101 / 5555 0202', '50255550101']), ['50255550101', '50255550202']), 'una celda con dos números da los dos, sin repetir');
ok(igual(ctx.telsWa_(['50255550101 50255550202']), ['50255550101', '50255550202']), 'dos números separados por un espacio (WHATSAPP_TO) se leen los dos');

// 2. contactsFor_: tabla + Estaciones + administrador, sin repetir
const ADMIN = ctx.ADMIN_WHATSAPP_;
const admin8 = ADMIN.slice(-8);
vm.runInContext("PROPERTY_CONTACTS_ = [{ match: 'prueba', emails: ['recepcion@prueba'], whatsapps: ['50255550101'] }];", ctx);
let estacion = { email1: '', email2: '', phone1: '+502 5555 0101', phone2: '5555-0202' };
ctx.stationFor_ = () => estacion;
let c = ctx.contactsFor_('Z10 - Prueba - 905');
ok(igual(c.whatsapps, ['50255550101', '50255550202', ADMIN]), 'contactsFor_: tabla + Estaciones (con +, espacios y sin 502) + administrador, una vez cada uno');
estacion = { phone1: admin8, phone2: '' };   // el administrador escrito sin 502 (pasaba en Monaco y EdificioA4)
c = ctx.contactsFor_('Z7 - Otra - D1');
ok(igual(c.whatsapps, [ADMIN]), 'el administrador escrito sin 502 ya no recibe dos veces (antes salía también a un número de 8 dígitos)');
estacion = { phone1: 50255550303, phone2: '' };   // número guardado por Sheets como número
c = ctx.contactsFor_('Z1 - Otra - 1');
ok(c.whatsapps[0] === '50255550303', 'un número que Sheets guardó como número se lee bien');

// 3. adminContactsInfo_ (lo que ALMA lee con listContacts)
ctx.listStations_ = () => [{ propertyName: 'Z10 - Prueba - 905', phone1: '5555 0101', phone2: '' }, { propertyName: 'Z7 - Otra - D1', phone1: admin8, phone2: '' }];
const info = ctx.adminContactsInfo_();
ok(igual(info.properties[0].whatsapps, ['50255550101']), 'listContacts: el número de recepción va con 502');
ok(info.numbers.indexOf(ADMIN) === -1 && info.numbers.indexOf(admin8) === -1, 'listContacts: el administrador no aparece como recepción, escrito como sea');

// 4. envío viejo (WA_VIA_ALMA = 0): a Meta va el número normalizado
props.WA_VIA_ALMA = '0'; props.WHATSAPP_TOKEN = 't'; props.WHATSAPP_PHONE_ID = 'p';
ctx.logSend_ = () => {};
const pdf = { getAs: () => ({ setName() {} }), getName: () => 'Registro.pdf' };
ctx.notifyWhatsApp_({ code: 'HMPRUEBA', propertyName: 'Z10 - Prueba - 905', checkin: '2026-11-12', checkout: '2026-11-13' }, [{}], pdf, ['5555 0101', '+502 5555-0101']);
const tos = enviados.filter(b => b.to).map(b => b.to);
ok(igual(tos, ['50255550101']), 'WhatsApp viejo: una sola vez y con 502 (dio ' + JSON.stringify(tos) + ')');

process.exit(fallo);
