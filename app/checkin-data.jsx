/* ============================================================
   SPACIO AM — CHECK-IN DATA (por edificio / condominio)
   ------------------------------------------------------------
   Fuente: "Instrucciones de check in de todos los espacios".
   NUNCA se publican códigos de acceso aquí. La dirección aplica a
   todo el edificio; el # de apartamento y el piso se derivan del
   nombre de la reserva (ver floorFromUnit / matchBuilding).
   ============================================================ */

/* Reglas de piso:
   · 3 dígitos → primer dígito = nivel (412 → nivel 4)
   · 4 dígitos → primeros 2 dígitos = nivel (1105 → nivel 11)
   · Mónaco → por letras A=1, B=2, C=3, D=4 (8F, etc. no aplica)  */
function floorFromUnit(unit, buildingKey) {
  const u = String(unit || "").trim();
  if (buildingKey === "monaco") {
    const m = u.match(/[A-Za-z]/);
    if (m) return "ABCDEFGH".indexOf(m[0].toUpperCase()) + 1 || null;
  }
  const digits = u.replace(/[^0-9]/g, "");
  if (digits.length === 3) return parseInt(digits[0], 10);
  if (digits.length === 4) return parseInt(digits.slice(0, 2), 10);
  // Mónaco letras dentro de unidades tipo "8F" → primer dígito
  if (digits.length >= 1) return parseInt(digits[0], 10);
  return null;
}

const WIFI_DEFAULT = { network: "Spacio AM", pass: "selfloveclub" };

/* parking: kind = "own" | "pay-us" | "pay-building" | "external" | "street"
   payUrl solo para pay-us; note para instrucciones */
const CHECKIN_BUILDINGS = {
  airali: {
    label: "Airali", zone: "Zona 10", type: "apartment",
    address: "11 Calle 6-44, Edificio Airali, Zona 10, Ciudad de Guatemala",
    maps: "https://maps.app.goo.gl/qBXoZ5eWTFDLPRNWA", waze: "https://waze.com/ul/h9fxeh6h7w",
    lock: "reception-card",
    arrival: "Al llegar estaciónate y pasa a recepción para que te entreguen una tarjeta de acceso.",
    parking: { kind: "own", note: "1 espacio disponible (#199, nivel S5). Recoge la tarjeta en el lobby y colócala a la altura del pecho del lado del conductor para abrir la talanquera.",
      extra: { kind: "pay-us", note: "Hay opción de un espacio adicional de pago con nosotros. Te compartiremos el enlace de reserva." } },
    tip: "No uses el elevador frente a tu parqueo (es de oficinas). El de apartamentos está detrás de ese.",
  },
  brunelo: {
    label: "Brunelo", zone: "Zona 10", type: "apartment",
    address: "2A Avenida 07-11, Edificio Brunelo, Zona 10, Ciudad de Guatemala",
    maps: "https://maps.app.goo.gl/S6XC59Eq4jzp2SC1A", waze: "https://waze.com/ul/h9fxeh74dy",
    lock: "smart-code",
    arrival: "Estaciónate frente al edificio y dirígete a recepción con la identificación de todos los huéspedes. Recoge las tarjetas de acceso en el buzón.",
    parking: { kind: "own", note: "1 espacio disponible en el 2º sótano, donde veas un espacio con luz verde.",
      extra: { kind: "pay-us", payUrl: "https://portfolio.spacioam.com/en/property/estacionamiento-edificio-brunelo-zona-10",
        note: "Puedes revisar disponibilidad y pagar un espacio adicional en línea." } },
    water: "El agua del ecofiltro está filtrada y es segura para beber.",
  },
  baldone: {
    label: "Baldone", zone: "Zona 2", type: "apartment",
    address: "7 Calle 10-47, Edificio Baldone, Zona 2, Ciudad de Guatemala",
    maps: "https://maps.app.goo.gl/LFv8ijGKJCRMZhoV8",
    lock: "locker-code",
    arrival: "Estaciónate frente al edificio, ubica el lobby y tu buzón. Ábrelo con el código; dentro está la tarjeta de estacionamiento y elevadores.",
    parking: { kind: "own", note: "1 espacio disponible en el nivel S2, parqueo #222." },
    tip: "No olvides dejar las llaves y la tarjeta en el buzón al hacer check-out (cargo de $120 por reemplazo).",
  },
  "centro-vivo": {
    label: "Centro Vivo", zone: "Zona 1", type: "apartment",
    address: "6ta Calle \"A\" 10-13, Edificio Centro Vivo, Zona 1, Ciudad de Guatemala",
    maps: "https://maps.app.goo.gl/7oZWGshsgzkz1jxx8", waze: "https://waze.com/ul/h9fxek2fmr",
    lock: "smart-code",
    arrival: "Ubica la recepción del edificio e identifícate con el equipo de seguridad. Para abrir el apartamento ingresa el código que te enviamos.",
    parking: { kind: "pay-building", note: "El apartamento no cuenta con parqueo propio, pero el edificio ofrece parqueo de pago por hora, noche o mes. Se paga directamente en el edificio; las tarifas rondan Q.100 a Q.150 por noche." },
    wifiBackup: [{ network: "HITRON-A9A0", pass: "QBN3NM8LB27M" }, { network: "HITRON-6020", pass: "MFHEGGERFJHK" }],
    induction: true,
  },
  eon: {
    label: "EON", zone: "Zona 10", type: "apartment",
    address: "4a Avenida 14-10, Edificio EON, Zona 10, Ciudad de Guatemala",
    maps: "https://maps.app.goo.gl/NPTs5TDsZqfdzKW99",
    lock: "smart-code",
    arrival: "Ubica la recepción del edificio e identifícate con seguridad. Abre el apartamento con el código que te enviamos.",
    parking: { kind: "own", note: "Sótano 5, parqueo #20." },
    induction: true,
  },
  fiamene: {
    label: "Fiamene", zone: "Zona 10", type: "apartment",
    address: "9A Calle 1-50, Edificio Fiamene, Zona 10, Ciudad de Guatemala",
    maps: "https://maps.app.goo.gl/zQzDVYeoCLusZyKTA", waze: "https://waze.com/ul/h9fxeh69mx",
    lock: "smart-code",
    arrival: "Estaciónate frente al edificio y dirígete a recepción con la identificación de todos los huéspedes.",
    parking: { kind: "own", note: "Sótano 4, parqueo #61.",
      extra: { kind: "pay-us", note: "Espacio adicional de pago con nosotros (Q.100 por noche). Te enviaremos el enlace de pago." } },
    water: "El agua del ecofiltro está filtrada y es segura para beber.",
    induction: true,
  },
  inara: {
    label: "Inara", zone: "Zona 13", type: "apartment",
    address: "14 Calle 15-26, Edificio Inara, Zona 13, Ciudad de Guatemala",
    maps: "https://maps.app.goo.gl/Cj47ytFLUCJji1t5A", waze: "https://waze.com/ul/h9fxdup58q",
    lock: "smart-code",
    arrival: "Estaciónate dentro del edificio y ve a recepción con la identificación de todos los huéspedes.",
    parking: { kind: "own", note: "1 espacio disponible en el sótano 5 (S5), parqueo #13." },
    water: "El agua del ecofiltro está filtrada y es segura para beber.",
    induction: true,
  },
  modra: {
    label: "Modra", zone: "Zona 4", type: "apartment",
    address: "Ruta 6 7-05, Zona 4, Ciudad de Guatemala",
    maps: "https://maps.app.goo.gl/WkNVg4KdysQvcQms9", waze: "https://waze.com/ul/h9fxehm08g",
    lock: "reception-card",
    arrival: "Preséntate en el lobby o el portón si tienes vehículo. Identifícate con los guardias (nombre, # de apartamento e identificación). En recepción te entregan tarjetas de acceso y las llaves.",
    parking: { kind: "own", note: "1 espacio dentro del edificio (#PT-272 y 273)." },
    tip: "Deja la tarjeta en recepción al hacer check-out (cargo de $50 por tarjeta no devuelta).",
    cable: true,
    induction: true,
  },
  monaco: {
    label: "Mónaco", zone: "Zona 7", type: "apartment",
    address: "4-37 6A Calle A, Colonia Landívar, Edificio Mónaco, Zona 7, Ciudad de Guatemala",
    maps: "https://maps.app.goo.gl/Zm7HUgG8QSX61a5w6", waze: "https://waze.com/ul/h9fxe5v0mc",
    lock: "keybox",
    arrival: "Al llegar, dirígete al teléfono de acceso del edificio y sigue las instrucciones que te enviamos para el ingreso.",
    parking: { kind: "external", note: "El apartamento no cuenta con parqueo propio. Hay parqueos públicos cercanos donde puedes dejar tu vehículo de forma segura." },
    // wifi por nivel: niveles 1-2 vs 3-4
    wifiByLevel: [
      { levels: [1, 2], network: "MERCURYS", pass: "69164354", alt: { network: "Tigo", pass: "2NB112105945" } },
      { levels: [3, 4], network: "STEREN", pass: "C4s4M0n4c0Nvl3" },
    ],
    letterLevels: true,
  },
  namericas: {
    label: "N Américas", zone: "Zona 1", type: "apartment",
    address: "15 Avenida A 19-16, Edificio N Américas, Zona 1, Ciudad de Guatemala",
    maps: "https://maps.app.goo.gl/bqTdfN9G9Umt2e7b8",
    lock: "smart-code",
    arrival: "Ubica la recepción e identifícate con seguridad. Abre el apartamento con el código que te enviamos.",
    parking: { kind: "own", note: "Parqueo #14." },
  },
  narama: {
    label: "Narama", zone: "Zona 13", type: "apartment",
    address: "15 Avenida 16-14, Edificio Narama, Zona 13, Ciudad de Guatemala",
    maps: "https://goo.gl/maps/mwcoNi1PdDBAjKgZ6", waze: "https://waze.com/ul/h9fxdun6m2",
    lock: "locker-code",
    arrival: "Estaciónate frente al edificio, ubica el lobby y tu buzón. Ábrelo con el código; dentro está la tarjeta de estacionamiento y elevadores.",
    parking: { kind: "own", note: "Sótano 2, parqueo #71. Si está ocupado, usa cualquiera con luz verde." },
    parkingPayNote: "El edificio también ofrece parqueo de pago (Q.100 a Q.150 por noche) en las máquinas de pago del edificio.",
    tip: "Deja las llaves y la tarjeta en el buzón al hacer check-out (cargo de $120 por reemplazo).",
    cable: true,
    induction: true,
  },
  casco: {
    label: "Casco del Cerro", zone: "Antigua Guatemala", type: "condo-house",
    address: "Santa Inés, Condominio Casco del Cerro, Casa #64, Antigua Guatemala",
    maps: "https://maps.app.goo.gl/cLi2s8a3AWsLfPbJ6", waze: "https://waze.com/ul/h9fx6z9uvg",
    lock: "smart-code",
    arrival: "Al llegar a la iglesia, sube hasta la ruina y pásala para llegar a la entrada. La puerta principal está sin llave: empújala. Al final del pasillo, tu puerta es la negra (se abre con el código que te enviamos).",
    parking: { kind: "own", note: "Puedes guardar 2 vehículos frente a la casa." },
    tip: "El pasillo de entrada es compartido con otra propiedad; por favor no cierres con llave la puerta principal.",
    smartHouse: true,
  },
  coloniales: {
    label: "Barrios Coloniales", zone: "Ciudad Vieja, Sacatepéquez", type: "condo-house",
    address: "6ta Calle, Ciudad Vieja, Condominio Barrios Coloniales, Sacatepéquez — Casa I09",
    maps: "https://maps.app.goo.gl/dtUgiDNmTUkKKc2D8", waze: "https://waze.com/ul/h9fx6xh6f3",
    lock: "smart-code",
    arrival: "Sistema de auto check-in: te damos un código para la puerta de entrada. Puedes ingresar en cualquier momento después de las 3:00 p.m.",
    parking: { kind: "own", note: "1 vehículo frente a la casa y otro en el área de visitas." },
  },
  a4: {
    label: "Edificio A4", zone: "Zona 4", type: "apartment",
    address: "Vía 7 5-01, Edificio A4, Zona 4, Ciudad de Guatemala",
    lock: "locker-smart",
    arrival: "Frente a la puerta principal verás buzones de colores a la izquierda. Ubica el etiquetado con tu unidad, ábrelo con el código y toma la tarjeta del edificio y la de parqueo (letras azules). El apartamento tiene chapa inteligente; ingresa el código (se bloquea sola tras 1 minuto).",
    parking: { kind: "own", note: "1 espacio en el edificio ATOM (justo al lado), Sótano 4, parqueo #8. Recoge la tarjeta en el locker antes de entrar." },
    tip: "Deja las tarjetas al hacer check-out (cargo de $120 por reposición).",
  },
  likin: {
    label: "Likin", zone: "Puerto Quetzal", type: "condo-house",
    address: "Transversal 3 (última casa a la derecha), Condominio Likin, Puerto Quetzal",
    maps: "https://maps.google.com?q=13.9275979,-90.7659004",
    lock: "gatehouse",
    arrival: "En garita solo indica que vas a la casa \"verde-azul\". Necesitamos los nombres de quienes conducen para autorizar el acceso con anticipación.",
    parking: { kind: "own", note: "Parqueo disponible en la casa." },
    wifi: { network: "Casa Likin", pass: "V3RD3A2UL" },
    contactName: "Marcela", contactPhone: "+502 4477 1074",
  },
  monterrico: {
    label: "Monterrico", zone: "Santa Rosa", type: "off-condo-house",
    address: "Aldea La Curbina, km 153, Monterrico, Santa Rosa",
    maps: "https://maps.google.com/maps?q=13.880739212036133%2C-90.45443725585938",
    lock: "onsite-host",
    arrival: "La casa está a 2 casas (lado derecho) del Hotel Isla Parlama y tiene un letrero afuera que dice \"El Sueño\". Lázaro, el guardián, te recibirá y apoyará durante tu estadía.",
    parking: { kind: "own", note: "Parqueo disponible en la casa." },
    contactName: "Lázaro", contactPhone: "+502 5856 1222",
  },
};

/* Extras de manual de la casa que aplican a varias propiedades */
const HOUSE_MANUAL_EXTRAS = {
  induction: {
    title: "Estufa de inducción",
    icon: "flame",
    intro: "Es una estufa de inducción: la superficie nunca se calienta, solo el sartén. Tu comida calienta con total normalidad.",
    steps: [
      "Coloca el sartén (son especiales para inducción) sobre la zona de cocción.",
      "Enciende seleccionando la temperatura con los números del panel.",
      "Si ves una letra en lugar de números, la estufa está bloqueada: mantén presionado 4 segundos el botón con ícono de candado para desbloquearla.",
    ],
  },
  cable: {
    title: "Cable en la TV (KODI)",
    icon: "tv",
    intro: "Los canales locales se ven a través de la app KODI.",
    steps: [
      "Pon la TV en la entrada HDMI.",
      "Con el control de la TV, enciéndela y espera a que aparezca el menú.",
      "Con el segundo control (el del decodificador), navega hasta \"KODI\" y ábrelo para ver los canales locales.",
    ],
  },
  smartHouse: {
    title: "Casa inteligente",
    icon: "manual",
    intro: "Esta casa tiene domótica: luces, sonido y TV inteligentes.",
    steps: [
      "Iluminación: contrólala desde la tablet de la sala.",
      "Sonido: vía Spotify elige el dispositivo \"house sound system 3x\", o di \"Hey Google, reproduce música jazz\".",
      "TV: abre la app \"Smarters Pro\" para ver cable y transmisiones en vivo.",
    ],
  },
};

/* Empareja una reserva con su edificio.
   Usa el nombre de propiedad (formato tipo "Z13 - Inara - 412") o el apartamento. */
function matchBuilding(res) {
  const hay = `${res.propertyName || ""} ${res.propertyShort || ""} ${res.apartment || ""}`.toLowerCase();
  const norm = hay.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const keys = Object.keys(CHECKIN_BUILDINGS);
  for (const k of keys) {
    const b = CHECKIN_BUILDINGS[k];
    const label = b.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const kk = k.replace(/-/g, " ");
    if (norm.includes(label) || norm.includes(kk)) return { key: k, ...b };
  }
  return null;
}

/* Deriva el # de unidad del nombre de la reserva: último segmento numérico/alfanum. */
function unitFromRes(res) {
  const src = res.apartment || res.propertyName || "";
  const parts = String(src).split(/\s*[-–—·]\s*/).map((s) => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const m = last.match(/[0-9]{2,4}[A-Za-z]?|[A-Za-z]?[0-9]{1,4}/);
  return m ? m[0] : last;
}

/* WiFi efectivo para una reserva: prioriza lo que el admin configuró en
   "Propiedades"; si no, usa la data del edificio (Mónaco por nivel, etc.). */
function wifiForRes(res) {
  // 1 · admin-entered property info (source of truth the admin controls)
  try {
    const pi = (window.loadPropInfo ? window.loadPropInfo() : {})[res.propertyName];
    if (pi && (pi.wifiNet || pi.wifiPass)) {
      return { network: pi.wifiNet || "Spacio AM", pass: pi.wifiPass || "", backup: (pi.wifiNetBk || pi.wifiPassBk) ? { network: pi.wifiNetBk, pass: pi.wifiPassBk } : null };
    }
  } catch (e) {}
  const b = matchBuilding(res);
  if (!b) return res.wifi || WIFI_DEFAULT;
  if (b.wifi) return b.wifi;
  if (b.wifiByLevel) {
    const unit = unitFromRes(res);
    const lvl = floorFromUnit(unit, b.key);
    const match = b.wifiByLevel.find((w) => w.levels.includes(lvl));
    if (match) return { network: match.network, pass: match.pass, alt: match.alt, byLevel: lvl };
    return { network: b.wifiByLevel[0].network, pass: b.wifiByLevel[0].pass };
  }
  return WIFI_DEFAULT;
}

Object.assign(window, {
  CHECKIN_BUILDINGS, HOUSE_MANUAL_EXTRAS, WIFI_DEFAULT,
  floorFromUnit, matchBuilding, unitFromRes, wifiForRes,
});
