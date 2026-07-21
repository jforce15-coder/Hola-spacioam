/* ============================================================
   SPACIO AM — GUEST APP · data layer
   tokens · i18n · demo data · rules · image map
   ============================================================ */

/* ---------- DESIGN TOKENS ---------- */
const C = {
  alabaster: "#FAFAFA",
  beige:     "#F5F3F0",
  beigeDeep: "#ECD1BD",
  taupe:     "#B2A193",
  tierra:    "#938B8A",
  grisCalido:"#D8D4CE",
  negro:     "#3E3F3F",
  peach:     "#E9826A",
  white:     "#FFFFFF",
  serif: "'Valky','Cormorant Garamond',Georgia,serif",
  sans:  "'Montserrat','Helvetica Neue',Arial,sans-serif",
  ease:  "cubic-bezier(.22,.61,.36,1)",
};

/* ---------- EDITORIAL PHOTOGRAPHY ---------- */
const IMG = {
  living:   "assets/photos/living.jpeg",
  bedroom:  "assets/photos/bedroom.jpeg",
  nook:     "assets/photos/nook.jpeg",
  antigua:  "assets/photos/antigua.jpeg",
  rooftop:  "assets/photos/rooftop.jpeg",
  selfcare: "assets/photos/selfcare.jpeg",
  welcome:  "assets/photos/welcome-table.jpeg",
  weave:    "assets/photos/welcome-weave.jpeg",
  kitchen:  "assets/photos/kitchen.jpeg",
  morning:  "assets/photos/morning.jpeg",
};

/* Hero photo per stay. Priority:
   1) admin-set high-res photo URL for the property (Propiedades tab) — used
      directly as <img src>, no re-encode, so it stays full resolution.
   2) generic on-brand fallback. */
const HERO_GENERIC = IMG.morning;
function resPhoto(res) {
  // BENTO — foto genérica de marca (o la que el admin fije). Nunca el thumbnail.
  try {
    const pi = (window.loadPropInfo ? window.loadPropInfo() : {})[res && res.propertyName] || {};
    if (pi.photoUrl && /^https?:\/\//.test(pi.photoUrl)) return pi.photoUrl;
  } catch (e) {}
  return HERO_GENERIC;
}
/* OVERVIEW ("Encontramos tu estancia") — foto genérica de marca, distinta a la
   del bento y NO ligada a un espacio específico (detalle de bienvenida), para
   no dar a entender que se ofrece un alojamiento distinto al reservado. */
const HERO_OVERVIEW = IMG.welcome;
function resListingPhoto(res) {
  return HERO_OVERVIEW;
}
function resName(res) {
  return (res && (res.propertyShort || res.propertyName || res.apartment)) || "Spacio AM";
}
/* Title-case a person's name: first letter of each word up, rest down (MARTIN → Martin) */
function titleCaseName(s) {
  return String(s || "").toLowerCase().replace(/(^|[\s'’-])([a-záéíóúñü])/g, (m, p, c) => p + c.toUpperCase());
}

/* ---------- ADMIN-CONFIGURABLE SETTINGS ---------- */
const ADMIN_SETTINGS = {
  currency: "$",
  // documents are purged automatically this many months after checkout
  docRetentionMonths: 3,
};
const money = (v) => `${ADMIN_SETTINGS.currency}${Number(v).toLocaleString()}`;

/* ---------- COUNTRY DIAL CODES (default Guatemala +502) ---------- */
const DIAL_CODES = [
  { code: "+502", iso: "GT", name: "Guatemala" },
  { code: "+1",   iso: "US", name: "USA / Canadá" },
  { code: "+52",  iso: "MX", name: "México" },
  { code: "+503", iso: "SV", name: "El Salvador" },
  { code: "+504", iso: "HN", name: "Honduras" },
  { code: "+505", iso: "NI", name: "Nicaragua" },
  { code: "+506", iso: "CR", name: "Costa Rica" },
  { code: "+507", iso: "PA", name: "Panamá" },
  { code: "+57",  iso: "CO", name: "Colombia" },
  { code: "+58",  iso: "VE", name: "Venezuela" },
  { code: "+51",  iso: "PE", name: "Perú" },
  { code: "+56",  iso: "CL", name: "Chile" },
  { code: "+54",  iso: "AR", name: "Argentina" },
  { code: "+55",  iso: "BR", name: "Brasil" },
  { code: "+34",  iso: "ES", name: "España" },
  { code: "+44",  iso: "GB", name: "Reino Unido" },
  { code: "+33",  iso: "FR", name: "Francia" },
  { code: "+49",  iso: "DE", name: "Alemania" },
  { code: "+39",  iso: "IT", name: "Italia" },
];
// sorted longest-first so "+502" matches before "+50" / "+5"
const DIAL_CODES_SORTED = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length);

/* ---------- i18n ---------- */
const T = {
  es: {
    code: "es", label: "Español",
    chooseLang: "Elige tu idioma",
    slogan: "Hay espacios en donde sueñas con volver a despertar.",
    reservationTitle: "Tu código de reserva",
    reservationSub: "Lo encuentras en el mensaje que te enviamos a través de la plataforma. Con él preparamos todo para tu llegada.",
    reservationPh: "Ej. HM54HBZMKH",
    codeHelp: "Tu código de reserva lo recibes por correo o mensaje al confirmar tu reserva en la plataforma (Airbnb, Booking, etc.). Suele tener entre 8 y 10 letras y números. Si no lo encuentras o no funciona, escríbenos y con gusto te ayudamos.",
    validate: "Validar reserva", validating: "Validando…",
    notFound: "No encontramos esa reserva. Revisa el código o escríbenos.",
    expired: "Esta reserva ya ha vencido. El acceso a tu espacio está disponible hasta 10 días después del checkout. Si necesitas algo, escríbenos.",
    alreadyDone: "Bienvenido de vuelta — tu registro ya está completo.",
    pickResTitle: "Tus reservas", pickResSub: "Selecciona la estancia que quieres ver.",
    nights: "noches", guests: "huéspedes", people: "personas", upTo: "hasta",
    foundTitle: "Encontramos tu estancia",
    property: "Alojamiento", checkin: "Check-in", checkout: "Check-out", capacity: "Capacidad",
    startForm: "Comenzar registro",

    /* stepped flow labels */
    stepBooker: "Reserva", stepDocs: "Documentos", stepContact: "Contacto", stepRules: "Normas", stepDone: "Listo",

    /* booker (who is reserving) */
    bookerTitle: "¿Quién realiza esta reserva?",
    bookerSub: "Cuéntanos si tú te hospedas o si reservas a nombre de otra persona.",
    bookerSelf: "Yo me hospedaré",
    bookerSelfDesc: "Eres huésped de esta estancia.",
    bookerThird: "Reservo a nombre de alguien más",
    bookerThirdDesc: "No te hospedarás; gestionas la reserva para otra persona.",
    managerTitle: "Datos de la persona encargada",
    managerSub: "Como no te hospedarás, no cuentas dentro de la capacidad del alojamiento. Solo necesitamos tu documento y contacto.",
    managerNote: "Esta persona no ocupa un lugar dentro de la capacidad máxima del alojamiento.",

    /* guests + docs */
    guestsTitle: "Documentos de los huéspedes",
    guestsSub: "Primero validamos la identidad de cada huésped. Después pediremos los datos de contacto.",
    howMany: "¿Cuántas personas se hospedan en total?",
    capacityNote: "Este alojamiento admite hasta",
    capacityReached: "Has alcanzado la capacidad máxima del alojamiento.",
    mismatchTitle: "Antes de subir los documentos",
    regReminderBase: "Es indispensable registrar a todas las personas que ingresarán al alojamiento. El ingreso de personas no registradas puede tener consecuencias que afecten tu proceso de ingreso — administración puede restringir el acceso y aplicar multas.",
    regReminderMatch: "Registraste el mismo número de huéspedes que indica tu reserva, así que estás cubierto para el ingreso.",
    regReminderMismatch: "Tu reserva en la plataforma indica {res} huésped(es) y registraste {n}. Mientras se respete la capacidad no hay problema de nuestro lado, pero te recomendamos actualizar el número en tu reserva de la plataforma una vez que termines de llenar este formulario.",
    docsSub: "Sube el documento de cada huésped. Lo leeremos automáticamente y podrás confirmar o corregir los datos antes de continuar.",
    allDocsRequired: "Valida el documento de cada huésped para continuar.",
    guestN: "Huésped", main: "principal", manager: "encargado",
    driverN: "Conductor", passengerN: "Acompañante", driversHowMany: "¿Cuántas personas irán manejando?",
    driversNote: "Por la capacidad de este alojamiento, solo necesitamos el documento de quienes irán manejando. Del resto basta con el nombre completo.",
    passengerName: "Nombre completo del acompañante", allDriversRequired: "Valida el documento de cada conductor y completa los nombres para continuar.",
    fullName: "Nombre completo", idNumber: "Número de identificación",
    uploadDoc: "Subir documento", changeDoc: "Cambiar documento", reading: "Leyendo documento…",
    takePhoto: "Tomar foto", chooseFile: "Subir archivo",
    docsAllGuestsWarn: "Sube el documento de cada persona que se hospedará. Administración puede restringir el ingreso de personas no registradas y aplicar multas por su acceso.",
    autoFilled: "Datos leídos del documento", confirmData: "Confirma que coincidan con el documento.",
    docInvalid: "Aún no logramos leer el documento. Prueba con una foto más nítida — bien iluminada, sin reflejos y que se vea completo.",
    docInvalid2: "Seguimos sin poder leerlo con claridad. Acerca la cámara al documento, evita sombras y asegúrate de que se vean bien el nombre y el número.",
    docTips: "Buena luz · sin reflejos · documento completo dentro del recuadro",
    docManualLabel: "Escribe los datos del documento",
    docPhotoKept: "Conservamos esta foto y la enviamos con tu registro.",
    docNotId: "La imagen no parece un documento de identidad. Sube una foto de tu DPI, pasaporte o licencia.",
    docFallbackTitle: "Vamos a resolverlo juntos",
    docFallbackBody: "Intentamos leer tu documento varias veces y no lo logramos con claridad. No te preocupes — puedes tomar una última foto nítida, o usar la que ya subiste y escribir el nombre y número tú mismo. En ambos casos conservamos la foto.",
    docFallbackUpload: "Tomar una foto clara",
    docFallbackManual: "Usar esta foto y escribir los datos",
    docFallbackTip: "Consejo: buena luz, sin reflejos y el documento completo dentro del recuadro.",
    retry: "Intentar de nuevo",
    encryption: "Cifrado de extremo a extremo. Solo el equipo autorizado puede acceder a tus documentos, y se eliminan automáticamente un tiempo después de finalizada tu reserva.",

    /* contact */
    contactTitle: "Datos de contacto",
    contactSub: "Solo necesitamos un contacto del huésped principal. No pedimos el teléfono de cada huésped.",
    mainGuestContact: "Huésped principal",
    email: "Correo electrónico", phone: "Teléfono", emergency: "Teléfono de emergencia",
    emergencyHint: "Un número distinto al tuyo, por si necesitamos avisar a alguien.",
    phoneHint: "Selecciona el código de país. Por defecto +502.",

    /* rules */
    rulesTitle: "Normas de convivencia",
    rulesSub: "Nuestro deseo es que cada estadía se sienta como un descanso profundo. Léelas con calma.",
    finesTitle: "Cuadro de sanciones",
    finesSub: "Montos aplicables según el caso. Queremos que todos disfruten de la misma calma.",
    finesTopSub: "Estas son las más frecuentes. Puedes ver el cuadro completo si lo deseas.",
    finesExpand: "Ver todas las sanciones", finesCollapse: "Ver menos",
    downloadFull: "Descargar versión completa",
    downloadNote: "Opcional. No necesitas descargarla para aceptar.",
    acceptUnified: "Al continuar, confirmas que leíste y aceptas las normas de convivencia y el cuadro de sanciones de Spacio AM.",
    acceptAndFinish: "Aceptar y finalizar registro", sending: "Enviando…",
    reparacion: "+ reparación", upToWord: "hasta", perGuestNight: "por huésped / noche",
    lateCheckoutFine: "1 noche + reservas perdidas",

    /* done */
    doneTitle: "Todo listo",
    doneSub: "Tu registro fue enviado. El corazón ya empezó a sentir que este viaje está por empezar.",
    doneQuote: "Nos llena de emoción la posibilidad de compartir este espacio contigo.",
    enterSpace: "Entrar a tu espacio",

    /* account popup */
    acctTitle: "¿Quieres guardar tu acceso?",
    acctSub: "Crea un usuario para ingresar fácilmente en el futuro, sin necesidad de recordar tu número de reserva. Además, podrás invitar a tus acompañantes para que tengan su propia cuenta.",
    acctYes: "Sí, crear usuario", acctNo: "Ahora no",
    acctChooseEmail: "Elige tu usuario", acctChooseEmailSub: "Usaremos uno de los correos que nos diste.",
    acctPassword: "Crea una contraseña", acctPasswordPh: "Mínimo 6 caracteres",
    acctCreate: "Crear usuario", acctCreated: "Usuario creado",
    shareTitle: "¿Compartir el acceso?",
    shareSub: "Puedes invitar a otras personas para que también vean esta sección. Les enviaremos un correo para crear su contraseña.",
    shareYes: "Sí, compartir", shareNo: "No, gracias",
    shareEmailsTitle: "Correos de los invitados",
    shareEmailsSub: "Hasta {n} personas según la capacidad del alojamiento.",
    shareSend: "Enviar invitaciones", shareSent: "Invitaciones enviadas",
    shareSentDesc: "Les pedimos crear su contraseña para acceder a toda la información.",
    close: "Cerrar", finishAcct: "Listo",

    /* switcher / misc */
    switchStay: "Cambiar de estancia", yourStays: "Tus estancias",

    /* ADMIN panel */
    adminTitle: "Control de registros",
    adminSub: "Formularios de check-in de tus alojamientos, sincronizados con Hospitable.",
    adminToday: "Hoy", adminTomorrow: "Mañana", adminDayAfter: "Pasado mañana", adminUpcoming: "Próximos",
    adminYesterday: "Ayer", adminNext3: "Siguientes 3 días", adminLast3: "Últimos 3 días",
    adminAll: "Todos", adminRange: "Rango de fechas", adminFrom: "Desde", adminTo: "Hasta", adminApply: "Aplicar", adminClear: "Limpiar",
    adminQuick: "Vista rápida", adminStatusFilter: "Estado", adminPropertyFilter: "Propiedad", adminAllProps: "Todas las propiedades",
    adminOnlyPending: "Solo pendientes", adminOnlyDone: "Solo completados", adminBoth: "Todos los estados",
    /* admin login */
    adminLoginTitle: "Acceso de administración", adminLoginSub: "Ingresa con tu correo y contraseña.",
    adminLoginEmail: "Correo electrónico", adminLoginPass: "Contraseña", adminLoginBtn: "Ingresar",
    adminLoginErr: "Correo o contraseña incorrectos.", adminLoginHint: "Acceso restringido a Spacio AM.",
    /* backend / hospitable connection */
    hospTitle: "Conexión del backend", hospConnected: "Backend conectado · datos en vivo", hospDisconnected: "Sin backend · mostrando datos de demostración",
    hospConnect: "Conectar", hospDisconnect: "Desconectar", hospManage: "Gestionar conexión",
    hospEndpoint: "URL del Web App (Google Apps Script)", hospEndpointPh: "https://script.google.com/macros/s/…/exec",
    hospTest: "Probar conexión", hospTesting: "Probando…", hospOk: "Conexión exitosa", hospFail: "No se pudo conectar. Revisa la URL.",
    hospSave: "Guardar y conectar",
    hospNote: "Las reservas se obtienen de Hospitable a través del backend (API REST). El token vive en el servidor, nunca en el navegador.",
    hospSyncing: "Sincronizando reservas…",
    adminFilterNote: "Se filtra por fecha de check-in.",
    adminStatusDone: "Completo", adminStatusPending: "Pendiente",
    adminComplete: "completos", adminPending: "pendientes",
    adminGuest: "Huésped de la reserva", adminCheckinCol: "Check-in", adminStatusCol: "Estado",
    adminView: "Ver resumen", adminDownload: "Descargar", adminResend: "Reenviar correo",
    adminResent: "Enviado a", adminResending: "Enviando…", adminResendFail: "No se pudo enviar. Revisa el backend.", adminNoDocs: "Documentos aún no recopilados.", adminEmpty: "No hay reservas en este rango.",
    adminDoneElsewhere: "Este registro se completó desde otro dispositivo. Los datos y documentos están guardados en la base de datos (hoja ‘Formularios’/‘Huespedes’ y carpeta de Drive).",
    sumViewDoc: "Ver documento", sumOpenFolder: "Abrir carpeta de documentos",
    adminSyncNote: "Reservas obtenidas de Hospitable", adminSeeded: "Demo", adminRefreshNow: "Actualizar",
    adminAssignedTo: "Recepción asignada",
    /* stations / estaciones */
    tabRegistros: "Registros", tabEstaciones: "Contactos",
    tabPropiedades: "Propiedades", tabSeguimiento: "Seguimiento", tabAccesos: "Accesos",
    accSub: "Como administrador principal, puedes crear accesos para otros administradores.",
    accNew: "Nuevo acceso de administrador", accEmail: "Correo", accPass: "Contraseña (mín. 6)", accCreate: "Crear acceso",
    accCurrent: "Accesos actuales", accPrimary: "Administrador principal", accRemove: "Eliminar",
    accAdded: "Acceso creado", accRemoved: "Acceso eliminado", accDup: "Ese correo ya tiene acceso.",
    accEmailErr: "Ingresa un correo válido.", accPassErr: "La contraseña debe tener al menos 6 caracteres.",
    piTitle: "Información de propiedades", piSub: "Configura parqueo, WiFi, tipo de cerradura y tipo de propiedad de cada alojamiento.",
    piParking: "Parqueo", piHasParking: "¿Tiene parqueo?", piYes: "Sí", piNo: "No", piParkNumber: "Número de parqueo",
    piParkOption: "¿Hay opción de parqueo?", piParkOwn: "Propia", piParkThird: "De tercero", piParkLink: "Enlace de pago", piParkExtInfo: "Información del parqueo externo",
    piWifi: "WiFi", piWifiNet: "Red", piWifiPass: "Contraseña", piWifiBackup: "Red y contraseña de respaldo", piWifiBackupNote: "Solo se muestra si el huésped inicia el troubleshooting.",
    piLock: "Tipo de cerradura", piLockSmart: "Smart lock", piLockBox: "Caja de seguridad", piLockKey: "Llave", piLockOther: "Otro", piSmartBrand: "Marca",
    piType: "Tipo de propiedad", piTypeApt: "Apartamento en edificio", piTypeCondo: "Casa en condominio", piTypeOff: "Propiedad fuera de condominio",
    piContact: "Contacto (recepción)", piContactNote: "A estos correos se envía el formulario completado de esta propiedad.",
    piInstructions: "Instrucciones generales", piInstructionsNote: "Aplican a todo el edificio, condominio o región. Editar aquí actualiza lo que ve el huésped en su check-in.",
    piCheckinNote: "Nota adicional (ej. dejar llaves y tarjeta en el buzón)",
    piPhotoUrl: "Foto del alojamiento (URL)",
    piPhotoNote: "Pega el enlace del anuncio (Airbnb, Booking) o una URL de imagen directa. Usamos la imagen en alta resolución.",
    piSave: "Guardar", piSaved: "Guardado",
    segTitle: "Seguimiento", segPending: "Registros pendientes de hoy", segInvoices: "Facturas solicitadas", segDayReq: "Solicitudes de día adicional", segEarly: "Early check-in / permiso de maletas",
    segDeadline: "Vence", segNone: "Sin pendientes", segMarkDone: "Marcar hecho", segUpload: "Cargar factura", segEmpty: "Nada por aquí por ahora.",
    segReqEarly: "Early check-in", segReqLate: "Late check-out", segReqDay: "Noche adicional", segReqLuggage: "Permiso de maletas",
    segSuggestions: "Sugerencias de huéspedes",
    segApprove: "Aprobar", segReject: "Rechazar", segDelete: "Borrar", segApproved: "Aprobado", segRejected: "Rechazado",
    segResolveSent: "Huésped notificado por correo", segResolveNoEmail: "Sin correo del huésped", segDeleteConfirm: "¿Borrar esta solicitud? No se notifica al huésped.", segResolving: "Enviando…",
    storTitle: "Documentos almacenados", storStored: "Documentos guardados", storOldest: "Documento más antiguo",
    storAge: "Antigüedad", storDays: "días", storRetention: "Retención", storMonths: "meses", storNextPurge: "Próxima purga automática", storNone: "Sin documentos almacenados por ahora.",
    segInvoiceReady: "Marcar lista y avisar", segInvoiceSending: "Enviando…", segInvoiceSent: "Huésped avisado",
    stTitle: "Contactos", stSub: "Asigna a cada propiedad los correos y teléfonos que recibirán el formulario completado.",
    stEmail1: "Correo 1", stEmail2: "Correo 2", stPhone1: "Teléfono 1", stPhone2: "Teléfono 2",
    stSave: "Guardar", stSaved: "Guardado", stEmpty: "No hay propiedades para mostrar.", stLoading: "Cargando propiedades…",

    /* SUMMARY document */
    sumTitle: "Resumen de registro", sumBooking: "Reserva", sumProperty: "Alojamiento", sumBookedBy: "Quién reservó",
    sumBookerSelf: "El huésped principal realizó la reserva",
    sumBookerThird: "Reserva gestionada por un tercero (no se hospeda)",
    sumManager: "Persona encargada", sumGuests: "Huéspedes registrados", sumGuest: "Huésped",
    sumContact: "Contacto", sumEmergency: "Emergencia", sumRules: "Normas de convivencia",
    sumRulesAccepted: "Aceptadas al finalizar el registro", sumDocs: "Documentos de identidad",
    sumWatermark: "Documentación de registro", sumGenerated: "Generado",
    sumSendTo: "Enviar a", sumPrint: "Imprimir / PDF", sumClose: "Cerrar", sumNoImage: "Sin imagen (datos manuales)",

    requiredFields: "Completa los campos requeridos antes de continuar.",
    editManual: "Escribir datos manualmente",
    back: "Atrás", next: "Siguiente", continue: "Continuar", understand: "Entiendo, continuar",
    hello: "Hola", yourStay: "Tu estancia", logout: "Salir",
    bentoSub: "Todo lo que necesitas para sentirte en casa, en un solo lugar.",
    copy: "Copiar contraseña", copied: "Copiado",

    fineNames: {
      noise:      "Ruido excesivo, fiesta o after party",
      extraGuest: "Huésped adicional no declarado",
      lateCheckout:"Check-out tardío",
      alcohol:    "Consumo de alcohol en áreas comunes",
      smoking:    "Fumar en zona no autorizada / colilla desechada (cada una)",
      trash:      "Basura mal manejada (sin bolsa, sin clasificar o en pasillos)",
      doors:      "No cerrar puertas peatonales o portones",
      strangers:  "Permitir el ingreso de personas desconocidas",
      delivery:   "Ingreso de repartidores al edificio",
      damage:     "Daño o mal uso de instalaciones o mobiliario",
      amenityUse: "Uso no autorizado de amenidades o área social",
      toilet:     "Objetos arrojados al inodoro (daño a tuberías)",
      throwing:   "Arrojar objetos o basura por balcón o ventana",
      speeding:   "Exceso de velocidad en el parqueo",
      pets:       "Mascota no autorizada",
      lights:     "Dejar luces encendidas en áreas comunes",
      content:    "Producción o contenido comercial no autorizado (incl. adultos)",
      grave:      "Armas, sustancias ilícitas o reincidencia en faltas",
      other:      "Cualquier otra falta no corregida tras aviso",
    },
    fineGroupNames: {
      convivencia: "Convivencia, ruido y ocupación",
      humo:        "Humo y basura",
      seguridad:   "Seguridad y accesos",
      danos:       "Daños a la propiedad y áreas comunes",
      contenido:   "Producción de contenido",
      graves:      "Faltas graves",
      general:     "General",
    },

    ckInstructions: "Instrucciones de llegada", ckAddress: "Dirección", ckFloor: "Piso", ckUnit: "Unidad", ckHowToArrive: "Cómo llegar", ckMaps: "Google Maps", ckWaze: "Waze", ckArrival: "Al llegar", ckContactName: "Te recibe",
    ckEarlyLate: "¿Necesitas ajustar tus horarios?", ckEarly: "Solicitar early check-in", ckLate: "Solicitar late check-out", ckFlexNote: "Estas opciones no garantizan el ingreso o salida anticipada; las coordinamos según disponibilidad.",
    ckEarlyIntro: "Nuestro check-in estándar es a las 3:00 p.m. No podemos garantizar el ingreso anticipado, pero tenemos estas opciones para ti:",
    ckLateIntro: "Nuestra salida estándar es a las 11:00 a.m. No podemos garantizar la salida tardía, pero tenemos estas opciones:",
    ckSelectOpt: "Selecciona la opción que prefieras", ckBack: "Volver",
    ckEO1t: "Early check-in (sujeto a disponibilidad)", ckEO1d: "Si el apartamento no está ocupado la noche anterior, podríamos ofrecerlo sin costo. Lo confirmamos hasta las 10:00 p.m. del día previo y te avisamos por correo.",
    ckEO2t: "Almacenamiento de equipaje", ckEO2d: "A partir de las 12:00 p.m. guardamos tus pertenencias sin costo para que empieces a disfrutar. Avísanos al llegar al edificio.",
    ckEO3t: "Noche adicional", ckEO3d: "Reserva la noche anterior para ingresar a la hora que desees, sin restricciones.",
    ckLO1t: "Almacenamiento de equipaje", ckLO1d: "Guardamos tus pertenencias en el apartamento hasta las 2:00 p.m. sin costo. Todo debe estar empacado y fuera del camino para el equipo de limpieza.",
    ckLO2t: "Noche adicional", ckLO2d: "Reserva una noche extra para salir a tu conveniencia.",
    ckSentEarly: "Programamos la verificación de disponibilidad. Recibirás un correo la noche anterior (hacia las 10:00 p.m.) confirmando si es posible.",
    ckSentLuggage: "Perfecto. Avisamos a nuestro equipo. Recuerda escribirnos en cuanto estés en el edificio para apoyarte.",
    ckSentNight: "Enviamos tu solicitud de noche adicional a nuestro equipo para darte seguimiento.",
    ckSentTitle: "Solicitud recibida",
    parkOwn: "Parqueo incluido", parkPayUs: "Parqueo adicional (con nosotros)", parkPayBuilding: "Parqueo de pago en el edificio", parkExternal: "Parqueo cercano", parkPayLink: "Reservar y pagar", parkNoteTitle: "Instrucciones",
    wifiQuick: "Conexión rápida", wifiConnected: "Conectando…", wifiTrouble: "¿Tienes problemas con el internet?", wifiTroubleOpen: "Solucionar",
    wifiStep1: "Verifica que la red aparezca en las opciones de WiFi de tu dispositivo.",
    wifiStep2: "Si NO aparece, es posible que el router se haya reiniciado. Localiza el router: en la parte de atrás tiene un sticker con la red y la contraseña por defecto.",
    wifiBackupTitle: "Redes de respaldo", wifiByLevelNote: "Conéctate a la red que corresponde al nivel de tu apartamento.",
    facturaTitle: "Solicitar factura", facturaNit: "NIT", facturaName: "Razón social", facturaComment: "Comentario", facturaSend: "Enviar solicitud",
    facturaNote: "La facturación se genera en un plazo de 5 días hábiles posteriores a la fecha de check-in. Asegúrate de que tus datos sean correctos.",
    facturaSent: "Solicitud enviada", facturaSentDesc: "Recibimos tus datos. La factura se generará dentro de los próximos 5 días hábiles.",
    guestReqTitle: "Ingreso de invitados", guestReqSub: "Registra a quien venga a verte. Las visitas se permiten de 6:00 a.m. a 6:00 p.m.",
    guestName: "Nombre completo", guestDoc: "Documento", guestId: "Número de identificación", guestDate: "Fecha de ingreso", guestTime: "Hora aproximada",
    guestAdd: "Agregar otro invitado", guestReqSend: "Enviar solicitud", guestReqOne: "Invitado",
    guestReqAutoSent: "Solicitud enviada", guestReqAutoDesc: "Enviamos la autorización a la recepción del alojamiento. Te confirmaremos el ingreso.",
    guestReqManualTitle: "Requiere aprobación del anfitrión", guestReqManualDesc: "Por la cantidad de invitados, el anfitrión debe revisar y aprobar el ingreso manualmente. Enviar este formulario no es suficiente — te contactaremos para confirmar.",
    guestTimeWarn: "Recuerda: el ingreso de invitados es de 6:00 a.m. a 6:00 p.m.",
    tiles: {
      checkin:   { t: "Check-in & Check-out", d: "Horarios y detalles de llegada" },
      visits:    { t: "Ingreso de invitados", d: "Registra a quien venga a verte" },
      wifi:      { t: "WiFi", d: "Conéctate en segundos" },
      parqueo:   { t: "Parqueo", d: "Dónde y cómo estacionar" },
      factura:   { t: "Solicitar factura", d: "Datos fiscales de tu estancia" },
      manual:    { t: "Manual de la casa", d: "Cómo funciona todo" },
      chat:      { t: "Chatea con nosotros", d: "Estamos para ti 24/7" },
      review:    { t: "Sugerencias", d: "Cuéntanos cómo lo hacemos" },
      emergency: { t: "Emergencias", d: "Números importantes" },
      activities:{ t: "Actividades", d: "Qué hacer cerca" },
      amenities: { t: "Amenidades", d: "Lo que ofrece el edificio" },
      upsells:   { t: "Experiencias", d: "Mejora tu estancia" },
      selflove:  { t: "Self Love Club", d: "Un momento para ti" },
    },
  },

  en: {
    code: "en", label: "English",
    chooseLang: "Choose your language",
    slogan: "There are spaces you dream of waking up in again.",
    reservationTitle: "Your reservation code",
    reservationSub: "You'll find it in the message we sent through the platform. It lets us tailor everything for your arrival.",
    reservationPh: "e.g. HM54HBZMKH",
    codeHelp: "You receive your reservation code by email or message when you confirm your booking on the platform (Airbnb, Booking, etc.). It's usually 8–10 letters and numbers. If you can't find it or it doesn't work, message us and we'll gladly help.",
    validate: "Validate reservation", validating: "Validating…",
    notFound: "We couldn't find that reservation. Check the code or message us.",
    expired: "This reservation has expired. Access to your space is available up to 10 days after checkout. If you need anything, message us.",
    alreadyDone: "Welcome back — your check-in is already complete.",
    pickResTitle: "Your reservations", pickResSub: "Select the stay you'd like to view.",
    nights: "nights", guests: "guests", people: "people", upTo: "up to",
    foundTitle: "We found your stay",
    property: "Property", checkin: "Check-in", checkout: "Check-out", capacity: "Capacity",
    startForm: "Start check-in",

    stepBooker: "Booking", stepDocs: "Documents", stepContact: "Contact", stepRules: "Rules", stepDone: "Done",

    bookerTitle: "Who is making this booking?",
    bookerSub: "Tell us whether you're staying or booking on someone else's behalf.",
    bookerSelf: "I'll be staying",
    bookerSelfDesc: "You are a guest of this stay.",
    bookerThird: "I'm booking for someone else",
    bookerThirdDesc: "You won't stay; you manage the booking for another person.",
    managerTitle: "Person in charge",
    managerSub: "Since you won't stay, you don't count toward the property's capacity. We just need your ID and contact.",
    managerNote: "This person does not take a spot in the property's maximum capacity.",

    guestsTitle: "Guest documents",
    guestsSub: "First we verify each guest's identity. Contact details come afterwards.",
    howMany: "How many people are staying in total?",
    capacityNote: "This property hosts up to",
    capacityReached: "You've reached the property's maximum capacity.",
    mismatchTitle: "Before uploading documents",
    regReminderBase: "It is essential to register everyone who will enter the property. Allowing unregistered people in can have consequences that affect your entry — management may deny access and apply fines.",
    regReminderMatch: "You registered the same number of guests your reservation lists, so you're covered for entry.",
    regReminderMismatch: "Your reservation on the platform lists {res} guest(s) and you registered {n}. As long as capacity is respected there's no problem on our side, but we recommend updating the number on your platform reservation once you finish this form.",
    docsSub: "Upload each guest's ID. We'll read it automatically and you can confirm or correct the data before continuing.",
    allDocsRequired: "Validate each guest's document to continue.",
    guestN: "Guest", main: "primary", manager: "manager",
    driverN: "Driver", passengerN: "Passenger", driversHowMany: "How many people will be driving?",
    driversNote: "Given this property's capacity, we only need the ID of those who will be driving. For everyone else, the full name is enough.",
    passengerName: "Passenger's full name", allDriversRequired: "Validate each driver's document and complete the names to continue.",
    fullName: "Full name", idNumber: "ID number",
    uploadDoc: "Upload document", changeDoc: "Change document", reading: "Reading document…",
    takePhoto: "Take photo", chooseFile: "Upload file",
    docsAllGuestsWarn: "Upload the ID of every person who will stay. Management may deny entry to unregistered people and apply fines for their access.",
    autoFilled: "Read from document", confirmData: "Confirm they match the document.",
    docInvalid: "We couldn't read the document yet. Try a sharper photo — well lit, no glare, and fully in frame.",
    docInvalid2: "Still can't read it clearly. Move the camera closer, avoid shadows, and make sure the name and number are visible.",
    docTips: "Good light · no glare · whole document inside the frame",
    docManualLabel: "Type the document details",
    docPhotoKept: "We keep this photo and send it with your registration.",
    docNotId: "This image doesn't look like an ID. Upload a photo of your ID, passport or license.",
    docFallbackTitle: "Let's sort this out together",
    docFallbackBody: "We tried to read your document a few times and couldn't do it clearly. No worries — take one last sharp photo, or use the one you already uploaded and type the name and number yourself. Either way we keep the photo.",
    docFallbackUpload: "Take a clear photo",
    docFallbackManual: "Use this photo and type the details",
    docFallbackTip: "Tip: good light, no glare, and the whole document inside the frame.",
    retry: "Try again",
    encryption: "End-to-end encrypted. Only the authorized team can access your documents, and they're deleted automatically some time after your stay ends.",

    contactTitle: "Contact details",
    contactSub: "We only need one contact for the primary guest. We don't ask for each guest's phone.",
    mainGuestContact: "Primary guest",
    email: "Email", phone: "Phone", emergency: "Emergency phone",
    emergencyHint: "A number other than yours, in case we need to reach someone.",
    phoneHint: "Pick the country code. Defaults to +502.",

    rulesTitle: "House rules",
    rulesSub: "Our wish is for every stay to feel like deep rest. Take your time reading them.",
    finesTitle: "Penalty schedule",
    finesSub: "Amounts applicable per case. We want everyone to enjoy the same calm.",
    finesTopSub: "These are the most frequent ones. You can view the full schedule if you'd like.",
    finesExpand: "See all penalties", finesCollapse: "See less",
    downloadFull: "Download full version",
    downloadNote: "Optional. You don't need to download it to accept.",
    acceptUnified: "By continuing, you confirm you have read and accept Spacio AM's house rules and penalty schedule.",
    acceptAndFinish: "Accept & finish check-in", sending: "Sending…",
    reparacion: "+ repair", upToWord: "up to", perGuestNight: "per guest / night",
    lateCheckoutFine: "1 night + lost bookings",

    doneTitle: "All set",
    doneSub: "Your check-in has been sent. The heart already feels this journey is about to begin.",
    doneQuote: "We're filled with joy at the chance to share this space with you.",
    enterSpace: "Enter your space",

    acctTitle: "Want to save your access?",
    acctSub: "Create a login to get in easily in the future, without needing to remember your reservation number. You'll also be able to invite your companions to have their own account.",
    acctYes: "Yes, create login", acctNo: "Not now",
    acctChooseEmail: "Choose your username", acctChooseEmailSub: "We'll use one of the emails you gave us.",
    acctPassword: "Create a password", acctPasswordPh: "At least 6 characters",
    acctCreate: "Create login", acctCreated: "Login created",
    shareTitle: "Share access?",
    shareSub: "You can invite others to view this section too. We'll email them to set their password.",
    shareYes: "Yes, share", shareNo: "No, thanks",
    shareEmailsTitle: "Guests' emails",
    shareEmailsSub: "Up to {n} people based on the property's capacity.",
    shareSend: "Send invitations", shareSent: "Invitations sent",
    shareSentDesc: "We asked them to create a password to access all the information.",
    close: "Close", finishAcct: "Done",

    switchStay: "Switch stay", yourStays: "Your stays",

    /* ADMIN panel */
    adminTitle: "Registration control",
    adminSub: "Check-in forms for your properties, synced with Hospitable.",
    adminToday: "Today", adminTomorrow: "Tomorrow", adminDayAfter: "Day after", adminUpcoming: "Upcoming",
    adminYesterday: "Yesterday", adminNext3: "Next 3 days", adminLast3: "Last 3 days",
    adminAll: "All", adminRange: "Date range", adminFrom: "From", adminTo: "To", adminApply: "Apply", adminClear: "Clear",
    adminQuick: "Quick view", adminStatusFilter: "Status", adminPropertyFilter: "Property", adminAllProps: "All properties",
    adminOnlyPending: "Pending only", adminOnlyDone: "Complete only", adminBoth: "All statuses",
    /* admin login */
    adminLoginTitle: "Administration access", adminLoginSub: "Sign in with your email and password.",
    adminLoginEmail: "Email", adminLoginPass: "Password", adminLoginBtn: "Sign in",
    adminLoginErr: "Incorrect email or password.", adminLoginHint: "Restricted to Spacio AM staff.",
    /* backend / hospitable connection */
    hospTitle: "Backend connection", hospConnected: "Backend connected · live data", hospDisconnected: "No backend · showing demo data",
    hospConnect: "Connect", hospDisconnect: "Disconnect", hospManage: "Manage connection",
    hospEndpoint: "Web App URL (Google Apps Script)", hospEndpointPh: "https://script.google.com/macros/s/…/exec",
    hospTest: "Test connection", hospTesting: "Testing…", hospOk: "Connection successful", hospFail: "Could not connect. Check the URL.",
    hospSave: "Save & connect",
    hospNote: "Reservations come from Hospitable through the backend (REST API). The token lives on the server, never in the browser.",
    hospSyncing: "Syncing reservations…",
    adminFilterNote: "Filtered by check-in date.",
    adminStatusDone: "Complete", adminStatusPending: "Pending",
    adminComplete: "complete", adminPending: "pending",
    adminGuest: "Reservation guest", adminCheckinCol: "Check-in", adminStatusCol: "Status",
    adminView: "View summary", adminDownload: "Download", adminResend: "Resend email",
    adminResent: "Sent to", adminResending: "Sending…", adminResendFail: "Couldn't send. Check the backend.", adminNoDocs: "Documents not collected yet.", adminEmpty: "No reservations in this range.",
    adminDoneElsewhere: "This registration was completed from another device. The data and documents are saved in the database (‘Formularios’/‘Huespedes’ sheet and the Drive folder).",
    sumViewDoc: "View document", sumOpenFolder: "Open documents folder",
    adminSyncNote: "Reservations pulled from Hospitable", adminSeeded: "Demo", adminRefreshNow: "Refresh",
    adminAssignedTo: "Assigned reception",
    /* stations */
    tabRegistros: "Registrations", tabEstaciones: "Contacts",
    tabPropiedades: "Properties", tabSeguimiento: "Tracking", tabAccesos: "Access",
    accSub: "As the primary administrator, you can create access for other administrators.",
    accNew: "New administrator access", accEmail: "Email", accPass: "Password (min. 6)", accCreate: "Create access",
    accCurrent: "Current access", accPrimary: "Primary administrator", accRemove: "Remove",
    accAdded: "Access created", accRemoved: "Access removed", accDup: "That email already has access.",
    accEmailErr: "Enter a valid email.", accPassErr: "Password must be at least 6 characters.",
    piTitle: "Property information", piSub: "Set parking, WiFi, lock type and property type for each stay.",
    piParking: "Parking", piHasParking: "Has parking?", piYes: "Yes", piNo: "No", piParkNumber: "Parking number",
    piParkOption: "Is there a parking option?", piParkOwn: "Own", piParkThird: "Third-party", piParkLink: "Payment link", piParkExtInfo: "External parking info",
    piWifi: "WiFi", piWifiNet: "Network", piWifiPass: "Password", piWifiBackup: "Backup network & password", piWifiBackupNote: "Only shown if the guest starts troubleshooting.",
    piLock: "Lock type", piLockSmart: "Smart lock", piLockBox: "Lockbox", piLockKey: "Key", piLockOther: "Other", piSmartBrand: "Brand",
    piType: "Property type", piTypeApt: "Apartment in building", piTypeCondo: "House in condominium", piTypeOff: "Property outside condominium",
    piContact: "Contact (front desk)", piContactNote: "The completed form for this property is sent to these emails.",
    piInstructions: "General instructions", piInstructionsNote: "Apply to the whole building, condo or region. Editing here updates what the guest sees at check-in.",
    piCheckinNote: "Additional note (e.g. leave keys and card in the mailbox)",
    piPhotoUrl: "Property photo (URL)",
    piPhotoNote: "Paste the listing link (Airbnb, Booking) or a direct image URL. We use the full-resolution image.",
    piSave: "Save", piSaved: "Saved",
    segTitle: "Tracking", segPending: "Today's pending registrations", segInvoices: "Requested invoices", segDayReq: "Additional-day requests", segEarly: "Early check-in / luggage permits",
    segDeadline: "Due", segNone: "Nothing pending", segMarkDone: "Mark done", segUpload: "Upload invoice", segEmpty: "Nothing here for now.",
    segReqEarly: "Early check-in", segReqLate: "Late check-out", segReqDay: "Extra night", segReqLuggage: "Luggage permit",
    segSuggestions: "Guest suggestions",
    segApprove: "Approve", segReject: "Reject", segDelete: "Delete", segApproved: "Approved", segRejected: "Rejected",
    segResolveSent: "Guest notified by email", segResolveNoEmail: "No guest email", segDeleteConfirm: "Delete this request? The guest is not notified.", segResolving: "Sending…",
    storTitle: "Stored documents", storStored: "Documents stored", storOldest: "Oldest document",
    storAge: "Age", storDays: "days", storRetention: "Retention", storMonths: "months", storNextPurge: "Next automatic purge", storNone: "No documents stored yet.",
    segInvoiceReady: "Mark ready & notify", segInvoiceSending: "Sending…", segInvoiceSent: "Guest notified",
    stTitle: "Contacts", stSub: "Assign to each property the emails and phones that will receive the completed form.",
    stEmail1: "Email 1", stEmail2: "Email 2", stPhone1: "Phone 1", stPhone2: "Phone 2",
    stSave: "Save", stSaved: "Saved", stEmpty: "No properties to show.", stLoading: "Loading properties…",

    /* SUMMARY document */
    sumTitle: "Registration summary", sumBooking: "Reservation", sumProperty: "Property", sumBookedBy: "Who booked",
    sumBookerSelf: "The primary guest made the booking",
    sumBookerThird: "Booking managed by a third party (not staying)",
    sumManager: "Person in charge", sumGuests: "Registered guests", sumGuest: "Guest",
    sumContact: "Contact", sumEmergency: "Emergency", sumRules: "House rules",
    sumRulesAccepted: "Accepted upon completing check-in", sumDocs: "Identity documents",
    sumWatermark: "Registration documentation", sumGenerated: "Generated",
    sumSendTo: "Send to", sumPrint: "Print / PDF", sumClose: "Close", sumNoImage: "No image (manual entry)",

    requiredFields: "Please complete the required fields before continuing.",
    editManual: "Enter data manually",
    back: "Back", next: "Next", continue: "Continue", understand: "Got it, continue",
    hello: "Hi", yourStay: "Your stay", logout: "Log out",
    bentoSub: "Everything you need to feel at home, in one place.",
    copy: "Copy password", copied: "Copied",

    fineNames: {
      noise:      "Excessive noise, party or after-party",
      extraGuest: "Undeclared additional guest",
      lateCheckout:"Late check-out",
      alcohol:    "Drinking alcohol in common areas",
      smoking:    "Smoking in unauthorized area / discarded butt (each)",
      trash:      "Mishandled trash (no bag, unsorted or in hallways)",
      doors:      "Not closing pedestrian doors or gates",
      strangers:  "Letting unknown people in",
      delivery:   "Delivery people entering the building",
      damage:     "Damage or misuse of facilities or furniture",
      amenityUse: "Unauthorized use of amenities or social area",
      toilet:     "Objects thrown in the toilet (pipe damage)",
      throwing:   "Throwing objects or trash from balcony or window",
      speeding:   "Speeding in the parking area",
      pets:       "Unauthorized pet",
      lights:     "Leaving lights on in common areas",
      content:    "Unauthorized commercial content/production (incl. adult)",
      grave:      "Weapons, illegal substances or repeat offenses",
      other:      "Any other uncorrected offense after notice",
    },
    fineGroupNames: {
      convivencia: "Community, noise & occupancy",
      humo:        "Smoke & trash",
      seguridad:   "Security & access",
      danos:       "Damage to property & common areas",
      contenido:   "Content production",
      graves:      "Serious offenses",
      general:     "General",
    },

    ckInstructions: "Arrival instructions", ckAddress: "Address", ckFloor: "Floor", ckUnit: "Unit", ckHowToArrive: "How to get there", ckMaps: "Google Maps", ckWaze: "Waze", ckArrival: "On arrival", ckContactName: "Welcomed by",
    ckEarlyLate: "Need to adjust your times?", ckEarly: "Request early check-in", ckLate: "Request late check-out", ckFlexNote: "These options don't guarantee early entry or late departure; we coordinate them based on availability.",
    ckEarlyIntro: "Our standard check-in is 3:00 p.m. We can't guarantee early entry, but here are your options:",
    ckLateIntro: "Our standard checkout is 11:00 a.m. We can't guarantee a late departure, but here are your options:",
    ckSelectOpt: "Choose the option you prefer", ckBack: "Back",
    ckEO1t: "Early check-in (subject to availability)", ckEO1d: "If the apartment isn't occupied the night before, we may offer it at no cost. We confirm by 10:00 p.m. the previous day and email you.",
    ckEO2t: "Luggage storage", ckEO2d: "From 12:00 p.m. we store your belongings at no cost so you can start enjoying. Let us know when you reach the building.",
    ckEO3t: "Extra night", ckEO3d: "Book the night before to enter whenever you like, with no restrictions.",
    ckLO1t: "Luggage storage", ckLO1d: "We keep your belongings in the apartment until 2:00 p.m. at no cost. Everything must be packed and out of the way for our cleaning team.",
    ckLO2t: "Extra night", ckLO2d: "Book an extra night to leave at your convenience.",
    ckSentEarly: "We've scheduled the availability check. You'll get an email the night before (around 10:00 p.m.) confirming whether it's possible.",
    ckSentLuggage: "Great. We've notified our team. Remember to message us as soon as you reach the building.",
    ckSentNight: "We've sent your extra-night request to our team for follow-up.",
    ckSentTitle: "Request received",
    parkOwn: "Parking included", parkPayUs: "Additional parking (with us)", parkPayBuilding: "Paid parking in the building", parkExternal: "Nearby parking", parkPayLink: "Book & pay", parkNoteTitle: "Instructions",
    wifiQuick: "Quick connect", wifiConnected: "Connecting…", wifiTrouble: "Trouble with the internet?", wifiTroubleOpen: "Troubleshoot",
    wifiStep1: "Check that the network appears in your device's WiFi options.",
    wifiStep2: "If it does NOT appear, the router may have restarted. Find the router: on the back there's a sticker with the default network and password.",
    wifiBackupTitle: "Backup networks", wifiByLevelNote: "Connect to the network matching your apartment's level.",
    facturaTitle: "Request invoice", facturaNit: "Tax ID (NIT)", facturaName: "Business name", facturaComment: "Comment", facturaSend: "Send request",
    facturaNote: "Invoicing is generated within 5 business days after the check-in date. Please make sure your details are correct.",
    facturaSent: "Request sent", facturaSentDesc: "We received your details. The invoice will be generated within the next 5 business days.",
    guestReqTitle: "Guest access", guestReqSub: "Register anyone coming to see you. Visits are allowed 6:00 a.m. to 6:00 p.m.",
    guestName: "Full name", guestDoc: "Document", guestId: "ID number", guestDate: "Entry date", guestTime: "Approx. time",
    guestAdd: "Add another guest", guestReqSend: "Send request", guestReqOne: "Guest",
    guestReqAutoSent: "Request sent", guestReqAutoDesc: "We sent the authorization to the property's front desk. We'll confirm the entry.",
    guestReqManualTitle: "Requires host approval", guestReqManualDesc: "Because of the number of guests, the host must review and approve entry manually. Submitting this form is not enough — we'll contact you to confirm.",
    guestTimeWarn: "Reminder: guest entry is 6:00 a.m. to 6:00 p.m.",
    tiles: {
      checkin:   { t: "Check-in & Check-out", d: "Times and arrival details" },
      visits:    { t: "Guest access", d: "Register anyone coming to see you" },
      wifi:      { t: "WiFi", d: "Connect in seconds" },
      parqueo:   { t: "Parking", d: "Where and how to park" },
      factura:   { t: "Request invoice", d: "Tax details for your stay" },
      manual:    { t: "House manual", d: "How everything works" },
      chat:      { t: "Chat with us", d: "Here for you 24/7" },
      review:    { t: "Suggestions", d: "Tell us how we're doing" },
      emergency: { t: "Emergencies", d: "Important numbers" },
      activities:{ t: "Activities", d: "What to do nearby" },
      amenities: { t: "Amenities", d: "What the building offers" },
      upsells:   { t: "Experiences", d: "Elevate your stay" },
      selflove:  { t: "Self Love Club", d: "A moment for you" },
    },
  },
};

/* ---------- DEMO DATA — each reservation = ONE accommodation ---------- */
const RESERVATIONS = {
  "SPA-7K2D": {
    id: "r1", code: "SPA-7K2D",
    propertyName: "Spacio AM · Zona 10", propertyShort: "Loft Alabaster",
    apartment: "Z10-302", bedrooms: 1, maxCapacity: 2, reservedGuests: 1,
    checkin: "2026-06-20", checkout: "2026-06-24",
    wifi: { network: "SpacioAM_Z10_302", pass: "descansa2026" },
    photo: IMG.living,
  },
  "SPA-4M9X": {
    id: "r2", code: "SPA-4M9X",
    propertyName: "Spacio AM · Cayalá", propertyShort: "Suite Tierra",
    apartment: "CAY-1104", bedrooms: 2, maxCapacity: 4, reservedGuests: 4,
    checkin: "2026-06-28", checkout: "2026-07-02",
    wifi: { network: "SpacioAM_CAY_1104", pass: "calma1104" },
    photo: IMG.bedroom,
  },
  "SPA-2030": {
    id: "r3", code: "SPA-2030",
    propertyName: "Spacio AM · Zona 14", propertyShort: "Estudio Lino",
    apartment: "Z14-505", bedrooms: 1, maxCapacity: 2, reservedGuests: 2,
    checkin: "2026-07-10", checkout: "2026-07-13",
    wifi: { network: "SpacioAM_Z14_505", pass: "lino0701" },
    photo: IMG.nook,
  },

  /* ---- ADMIN TEST — pre-completed. Goes straight to "Mi espacio".
     Belongs to a demo account with THREE reservations to show the
     stay-switcher (one user managing several bookings). ---- */
  "SPA-DEMO": {
    id: "d1", code: "SPA-DEMO", group: "acct-demo", preCompleted: true,
    propertyName: "Spacio AM · Zona 10", propertyShort: "Loft Alabaster",
    apartment: "Z10-302", bedrooms: 1, maxCapacity: 2, reservedGuests: 2,
    checkin: "2026-08-04", checkout: "2026-08-08",
    wifi: { network: "SpacioAM_Z10_302", pass: "descansa2026" },
    photo: IMG.living,
  },
};

/* additional reservations of the same demo account (not directly enterable) */
const GROUP_RESERVATIONS = {
  "acct-demo": [
    RESERVATIONS["SPA-DEMO"],
    {
      id: "d2", code: "SPA-DEMO", group: "acct-demo", preCompleted: true,
      propertyName: "Spacio AM · Cayalá", propertyShort: "Suite Tierra",
      apartment: "CAY-1104", bedrooms: 2, maxCapacity: 4, reservedGuests: 3,
      checkin: "2026-09-12", checkout: "2026-09-16",
      wifi: { network: "SpacioAM_CAY_1104", pass: "calma1104" },
      photo: IMG.bedroom,
    },
    {
      id: "d3", code: "SPA-DEMO", group: "acct-demo", preCompleted: true,
      propertyName: "Spacio AM · Antigua", propertyShort: "Casa Ratán",
      apartment: "ANT-02", bedrooms: 3, maxCapacity: 6, reservedGuests: 5,
      checkin: "2026-10-02", checkout: "2026-10-06",
      wifi: { network: "SpacioAM_ANT_02", pass: "ratan1002" },
      photo: IMG.antigua,
    },
  ],
};
const groupReservations = (groupId) => GROUP_RESERVATIONS[groupId] || null;

const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/* ---------- DATE HELPERS (admin date math, TZ-safe on YYYY-MM-DD) ---------- */
const toDay = (d) => { const x = new Date(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
const todayDay = () => toDay(new Date());
const addDays = (d, n) => { const x = toDay(d); x.setDate(x.getDate() + n); return x; };
const isoDay = (d) => { const x = toDay(d); const m = String(x.getMonth() + 1).padStart(2, "0"); const day = String(x.getDate()).padStart(2, "0"); return `${x.getFullYear()}-${m}-${day}`; };
const fmtDay = (iso, lang) => new Date(iso + "T12:00:00").toLocaleDateString(lang === "en" ? "en-US" : "es-GT", { day: "2-digit", month: "short" });
/* checkin bucket relative to today: today / tomorrow / day-after / other */
function checkinBucket(iso) {
  const t = todayDay(), c = toDay(iso + "T12:00:00");
  const diff = Math.round((c - t) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === 2) return "dayAfter";
  if (diff === -1) return "yesterday";
  return diff < 0 ? "past" : "future";
}
/* signed day offset from today (TZ-safe) */
function checkinDiff(iso) {
  return Math.round((toDay(iso + "T12:00:00") - todayDay()) / 86400000);
}

/* ============================================================
   HOSPITABLE FEED (simulated) — the PMS roster of reservations.
   Admin combines this with locally-collected form records to show
   completed vs pending forms. Dates anchored around "today" so the
   default (check-in hoy/mañana/pasado) always has content.
   `assignedEmail` = building admin / reception that receives the summary.
   ============================================================ */
const _t = todayDay();
const HOSPITABLE = [
  { id: "h1", code: "SPA-7K2D", guestName: "Ana Lucía Morales", propertyName: "Spacio AM · Zona 10", propertyShort: "Loft Alabaster",
    apartment: "Z10-302", maxCapacity: 2, reservedGuests: 2, checkin: isoDay(_t), checkout: isoDay(addDays(_t, 4)),
    assignedEmail: "recepcion.zona10@spacioam.com", photo: IMG.living, wifi: { network: "SpacioAM_Z10_302", pass: "descansa2026" } },
  { id: "h2", code: "SPA-9F3P", guestName: "Diego Herrera", propertyName: "Spacio AM · Cayalá", propertyShort: "Suite Tierra",
    apartment: "CAY-1104", maxCapacity: 4, reservedGuests: 3, checkin: isoDay(_t), checkout: isoDay(addDays(_t, 3)),
    assignedEmail: "recepcion.cayala@spacioam.com", photo: IMG.bedroom, wifi: { network: "SpacioAM_CAY_1104", pass: "calma1104" } },
  { id: "h3", code: "SPA-2R8K", guestName: "Sofía Ramírez", propertyName: "Spacio AM · Zona 14", propertyShort: "Estudio Lino",
    apartment: "Z14-505", maxCapacity: 2, reservedGuests: 1, checkin: isoDay(addDays(_t, 1)), checkout: isoDay(addDays(_t, 5)),
    assignedEmail: "recepcion.zona14@spacioam.com", photo: IMG.nook, wifi: { network: "SpacioAM_Z14_505", pass: "lino0701" } },
  { id: "h4", code: "SPA-5T1M", guestName: "Carlos Búcaro", propertyName: "Spacio AM · Antigua", propertyShort: "Casa Ratán",
    apartment: "ANT-02", maxCapacity: 6, reservedGuests: 4, checkin: isoDay(addDays(_t, 1)), checkout: isoDay(addDays(_t, 4)),
    assignedEmail: "recepcion.antigua@spacioam.com", photo: IMG.antigua, wifi: { network: "SpacioAM_ANT_02", pass: "ratan1002" } },
  { id: "h5", code: "SPA-8W6Z", guestName: "Valentina Cruz", propertyName: "Spacio AM · Zona 10", propertyShort: "Loft Alabaster",
    apartment: "Z10-410", maxCapacity: 2, reservedGuests: 2, checkin: isoDay(addDays(_t, 2)), checkout: isoDay(addDays(_t, 6)),
    assignedEmail: "recepcion.zona10@spacioam.com", photo: IMG.living, wifi: { network: "SpacioAM_Z10_410", pass: "manana410" } },
  { id: "h6", code: "SPA-3Q7L", guestName: "Mateo Solís", propertyName: "Spacio AM · Cayalá", propertyShort: "Suite Tierra",
    apartment: "CAY-0902", maxCapacity: 4, reservedGuests: 2, checkin: isoDay(addDays(_t, 2)), checkout: isoDay(addDays(_t, 5)),
    assignedEmail: "recepcion.cayala@spacioam.com", photo: IMG.bedroom, wifi: { network: "SpacioAM_CAY_0902", pass: "suite0902" } },
  { id: "h7", code: "SPA-6Y2N", guestName: "Isabella Fuentes", propertyName: "Spacio AM · Zona 14", propertyShort: "Estudio Lino",
    apartment: "Z14-208", maxCapacity: 2, reservedGuests: 2, checkin: isoDay(addDays(_t, 5)), checkout: isoDay(addDays(_t, 8)),
    assignedEmail: "recepcion.zona14@spacioam.com", photo: IMG.nook, wifi: { network: "SpacioAM_Z14_208", pass: "estudio208" } },
  { id: "h8", code: "SPA-1X4V", guestName: "Andrés Del Cid", propertyName: "Spacio AM · Antigua", propertyShort: "Casa Ratán",
    apartment: "ANT-07", maxCapacity: 6, reservedGuests: 5, checkin: isoDay(addDays(_t, 9)), checkout: isoDay(addDays(_t, 13)),
    assignedEmail: "recepcion.antigua@spacioam.com", photo: IMG.antigua, wifi: { network: "SpacioAM_ANT_07", pass: "casa07ant" } },
];

/* seed one COMPLETED form so the admin summary + watermark are explorable.
   Merges into the store only if that record doesn't already exist. */
function adminSeedRecord() {
  return {
    resId: "h2",
    record: {
      completedAt: Date.now() - 3600000, count: 3, firstName: "Diego",
      booker: { type: "self" },
      guests: [
        { name: "Diego Herrera", id: "2451 88190 0301", docImage: "assets/docs/sample-id.png", main: true },
        { name: "Lucía Herrera", id: "1990 33421 0108", docImage: "assets/docs/sample-id.png" },
        { name: "Tomás Herrera", id: "3012 77650 0114", docImage: "assets/docs/sample-id.png" },
      ],
      contact: { email: "diego.herrera@correo.com", phone: { code: "+502", number: "5590 8842" }, emergency: { code: "+502", number: "4412 7788" } },
      emails: ["diego.herrera@correo.com"],
      acceptedRulesAt: Date.now() - 3600000,
      docsPurged: false, docs: true,
    },
  };
}
const isAdminCode = (code) => ["ADMIN", "SPAADMIN", "SPAADMINISTRACION"].includes(normCode(code));

/* ---------- ADMIN AUTH ---------- */
const ADMIN_CREDENTIALS = { email: "jovalle@spacioam.com", pass: "Valencia2026!" };
const ADMINS_KEY = "spacioam_admins";
function loadAdmins() { try { return JSON.parse(localStorage.getItem(ADMINS_KEY)) || []; } catch (e) { return []; } }
function saveAdmins(list) { try { localStorage.setItem(ADMINS_KEY, JSON.stringify(list)); } catch (e) {} }
const checkAdminLogin = (email, pass) => {
  const e = (email || "").trim().toLowerCase();
  if (e === ADMIN_CREDENTIALS.email && pass === ADMIN_CREDENTIALS.pass) return true;
  // admins adicionales creados desde el panel
  return loadAdmins().some((a) => a.email === e && a.pass === pass);
};
const isPrimaryAdmin = (email) => (email || "").trim().toLowerCase() === ADMIN_CREDENTIALS.email;

/* ============================================================
   HOSPITABLE INTEGRATION ADAPTER
   Front-end scaffold ready for a real connection. Two transports:
   · REST API  — https://public.api.hospitable.com/v2 (Bearer token)
   · MCP server — a Model-Context-Protocol endpoint URL
   Settings persist in localStorage. When no live credentials are
   present (prototype default) it resolves the simulated roster so the
   panel is fully explorable. Swap `_liveFetch` for the real call.
   ============================================================ */
/* ============================================================
   BACKEND ADAPTER — Google Apps Script Web App
   Single secure backend for Sheets + Drive + Hospitable.
   The browser only knows the endpoint URL (from config.js or,
   for admins, an override in localStorage). All secrets — the
   Hospitable token, Sheet/Drive permissions — live server-side.

   Recommendation delivered to the client: use Hospitable's REST
   API (not MCP) for this — we only need to LIST reservations, a
   simple query the API covers directly; MCP adds an LLM-oriented
   layer with no benefit here. The token is read server-side.

   Requests use POST with text/plain to avoid the CORS preflight
   that Apps Script Web Apps don't answer. Falls back to the demo
   roster / local persistence when no endpoint is configured.
   ============================================================ */
const BACKEND_CFG_KEY = "spacioam_backend_cfg";
const Backend = {
  loadConfig() { try { return JSON.parse(localStorage.getItem(BACKEND_CFG_KEY)) || {}; } catch (e) { return {}; } },
  saveConfig(cfg) { try { localStorage.setItem(BACKEND_CFG_KEY, JSON.stringify(cfg)); } catch (e) {} return cfg; },
  endpoint() {
    const override = (this.loadConfig().endpoint || "").trim();
    const fromConfig = (window.SPACIO_CONFIG && window.SPACIO_CONFIG.backendUrl || "").trim();
    return override || fromConfig;
  },
  isConnected() { return !!this.endpoint(); },
  disconnect() { return this.saveConfig({ endpoint: "" }); },
  async call(action, payload) {
    const url = this.endpoint();
    if (!url) throw new Error("no-endpoint");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight
      body: JSON.stringify({ action, ...(payload || {}) }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "backend-error");
    return json;
  },
  async ping() { return this.call("ping"); },
  _lastMeta: null,
  async listReservations() {
    if (this.isConnected()) {
      // connected → always show real backend data (even if empty); never demo
      try {
        const json = await this.call("listReservations");
        this._lastMeta = json.meta || null;
        return json.reservations || [];
      } catch (e) {
        this._lastMeta = { error: String(e && e.message || e) };
        return [];
      }
    }
    this._lastMeta = null;
    return new Promise((resolve) => setTimeout(() => resolve(HOSPITABLE), 260));
  },
  // instant cache read (Reservas sheet) — no Hospitable call
  async listCached() {
    if (this.isConnected()) {
      try { const json = await this.call("listCached"); this._lastMeta = json.meta || null; return json.reservations || []; }
      catch (e) { this._lastMeta = { error: String(e && e.message || e) }; return []; }
    }
    this._lastMeta = null;
    return new Promise((resolve) => setTimeout(() => resolve(HOSPITABLE), 120));
  },
  async findReservation(code) {
    // backend first: reads the cached Reservas sheet, and if the code isn't
    // there it triggers a live re-sync and re-checks before giving up.
    if (this.isConnected()) {
      try {
        const json = await this.call("findReservation", { code });
        return json.reservation || null;
      } catch (e) { /* fall through to demo lookup */ }
    }
    return findReservation(code);
  },
  async getRegistration(code) {
    // full registration data (Formularios + Huespedes) for a completed booking,
    // so the admin summary works even if it was filled on another device.
    if (!this.isConnected()) return null;
    try { const json = await this.call("getRegistration", { code }); return json.record || null; }
    catch (e) { return null; }
  },
  async sendTestEmail(to) {
    if (!this.isConnected()) return { ok: false, offline: true };
    return this.call("testEmail", { to });
  },
  async sendTestWhatsApp(to) {
    if (!this.isConnected()) return { ok: false, offline: true };
    return this.call("testWhatsApp", { to });
  },
  async listContacts() {
    if (!this.isConnected()) return null;
    try { return await this.call("listContacts"); } catch (e) { return null; }
  },
  async storageStats() {
    if (!this.isConnected()) return null;
    try { return await this.call("storageStats"); } catch (e) { return null; }
  },
  async hostRequestResolve(payload) {
    if (!this.isConnected()) return { ok: false, offline: true };
    return this.call("hostRequestResolve", payload);
  },
  async listRequests() {
    if (!this.isConnected()) return null;
    try { const j = await this.call("listRequests"); return j.requests || []; } catch (e) { return null; }
  },
  async listPropertyInfo() {
    if (!this.isConnected()) return null;
    try { const j = await this.call("listPropertyInfo"); return j.info || {}; } catch (e) { return null; }
  },
  async listSendLog(arg) {
    if (!this.isConnected()) return null;
    const body = typeof arg === "object" && arg !== null ? arg : { limit: arg || 80 };
    try { const j = await this.call("listSendLog", body); return j.log || []; } catch (e) { return null; }
  },
  async contactsAvailability(names) {
    if (!this.isConnected()) return null;
    try {
      const j = await this.call("contactsAvailability", { names: names || [] });
      const a = j.availability || {};
      try { localStorage.setItem("spacioam_avail", JSON.stringify(a)); } catch (e) {}
      return a;
    } catch (e) { return null; }
  },
  async listAdmins() {
    if (!this.isConnected()) return null;
    try { const json = await this.call("listAdmins"); return json.admins || []; } catch (e) { return null; }
  },
  async saveAdmin(email, password, createdBy) {
    if (!this.isConnected()) return { ok: false, offline: true };
    return this.call("saveAdmin", { email, password, createdBy });
  },
  async removeAdmin(email) {
    if (!this.isConnected()) return { ok: false, offline: true };
    return this.call("removeAdmin", { email });
  },
  async adminLogin(email, password) {
    if (!this.isConnected()) return { ok: false };
    try { return await this.call("adminLogin", { email, password }); } catch (e) { return { ok: false }; }
  },
  async submitForm(reservation, form) {
    if (!this.isConnected()) return { ok: false, offline: true };
    return this.call("submitForm", { reservation, form });
  },
  async createAccount(payload) {
    if (!this.isConnected()) return { ok: false, offline: true };
    return this.call("createAccount", payload);
  },
  async listStations() {
    if (this.isConnected()) {
      try { const json = await this.call("listStations"); return json.stations || []; } catch (e) { return null; }
    }
    // demo: derive from the sample roster so the screen is explorable
    return HOSPITABLE_PROPERTIES.map((nm) => ({ propertyName: nm, email1: "", email2: "", phone1: "", phone2: "" }));
  },
  async saveStation(station) {
    if (!this.isConnected()) return { ok: false, offline: true };
    return this.call("saveStation", station);
  },
  async login(email, password) {
    if (!this.isConnected()) return { ok: false, offline: true };
    return this.call("login", { email, password });
  },
};
/* backwards-compat alias for existing admin references */
const HospitableAPI = {
  loadConfig: () => Backend.loadConfig(),
  saveConfig: (c) => Backend.saveConfig(c),
  isConnected: () => Backend.isConnected(),
  disconnect: () => Backend.disconnect(),
  listReservations: () => Backend.listReservations(),
};
const HOSPITABLE_PROPERTIES = [...new Set(HOSPITABLE.map((h) => h.propertyName))];

/* ---------- RESERVATION LOOKUP (tolerant of hyphens / spaces / case) ---------- */
const normCode = (s) => String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "");
function findReservation(code) {
  const n = normCode(code);
  if (n.length < 3) return null;
  for (const k in RESERVATIONS) {
    if (normCode(k) === n) return RESERVATIONS[k];
  }
  return null;
}

/* ---------- PHONE PARSING (auto-detect country code from pasted number) ---------- */
function parsePhone(raw, currentCode) {
  const trimmed = (raw || "").trim();
  if (trimmed.startsWith("+")) {
    const digits = "+" + trimmed.slice(1).replace(/[^\d]/g, "");
    for (const c of DIAL_CODES_SORTED) {
      if (digits.startsWith(c.code)) {
        return { code: c.code, number: trimmed.slice(trimmed.indexOf(c.code.slice(1)) + c.code.length - 1).replace(/^[\s-]+/, "") };
      }
    }
  }
  return { code: currentCode || "+502", number: raw };
}

/* ============================================================
   HOUSE RULES — summarized on screen, full text downloadable.
   ============================================================ */
const RULES = {
  es: [
    { n: "01", title: "Ingreso, identificación y huéspedes", items: [
      "Respeta los horarios de check-in y check-out; cualquier cambio se autoriza antes por la plataforma.",
      "Quien hace check-in debe presentar un documento que coincida con la reserva.",
      "Todos los huéspedes deben estar registrados. Personas no declaradas tienen un costo adicional por huésped, por noche.",
      "Respeta la ocupación máxima del anuncio.",
      "Visitas solo de 6:00 a.m. a 6:00 p.m., autorizadas antes y sin exceder la capacidad.",
      "Cada huésped es responsable de sus acompañantes; nunca dejes entrar a desconocidos.",
    ]},
    { n: "02", title: "Seguridad y accesos", items: [
      "Cierra siempre la puerta peatonal y el portón vehicular; nunca los dejes abiertos ni forzados.",
      "Los portones son solo para vehículos, no para paso peatonal.",
      "Por seguridad, los repartidores no ingresan: recíbelos en el lobby o la puerta peatonal.",
      "Prohibido portar armas dentro del apartamento y áreas comunes.",
    ]},
    { n: "03", title: "Espacios comunes y convivencia", items: [
      "Edificio libre de humo: no fumar dentro ni en balcones; no dejes colillas en ningún lado.",
      "Horario de silencio de 10:00 p.m. a 8:00 a.m.; mantén volumen moderado.",
      "No se permiten fiestas, after parties ni reuniones que excedan la capacidad.",
      "No consumas alcohol en áreas comunes del edificio.",
      "Prohibidas las sustancias ilícitas y toda conducta contra el orden y la tranquilidad.",
      "Basura en bolsas selladas y clasificada (A.G. 164-21), solo en el área designada.",
    ]},
    { n: "04", title: "Cuidado del edificio y del apartamento", items: [
      "No lances objetos al exterior ni tiendas ropa visible desde afuera.",
      "No arrojes objetos al inodoro (wipes, algodón, etc.); protege las tuberías.",
      "Usa solo el parqueo asignado; en reversa en espacios estrechos. Eres responsable de daños a terceros.",
      "Por ahora no se permiten mascotas.",
      "Cualquier daño en el apartamento o áreas comunes es responsabilidad del huésped.",
    ]},
    { n: "05", title: "Producciones, fotografía y contenido", items: [
      "Toda sesión o producción con fines comerciales (incluidas marcas personales) debe autorizarse antes.",
      "Prohibido crear contenido para adultos (OnlyFans o similares) en el apartamento o áreas comunes.",
    ]},
    { n: "06", title: "Amenidades y áreas comunes", items: [
      "El uso de amenidades (piscina, gimnasio, salón, terraza) requiere autorización previa.",
      "No puedes reservarlas para uso exclusivo ni recibir visitas en ellas.",
      "No permanezcas en pasillos, ductos de gradas ni cerca de otras puertas.",
      "Eres responsable de los daños que ocasiones durante su uso.",
    ]},
    { n: "07", title: "Cambios, cancelaciones y objetos olvidados", items: [
      "Cambios pedidos con 15 días o menos antes del check-in se consideran cancelación (las extensiones no aplican).",
      "Los objetos olvidados son responsabilidad del huésped; ayudamos a gestionarlos sin asumir pérdidas.",
    ]},
    { n: "08", title: "Problemas o reparaciones inesperadas", items: [
      "Soporte 24/7: contáctanos de inmediato si surge un problema.",
      "Si no se resuelve en un máximo de 3 horas, evaluamos reembolso proporcional; resuelto antes, no aplica compensación.",
    ]},
    { n: "09", title: "Check-out y penalizaciones", items: [
      "El check-out tardío afecta a limpieza y a las reservas posteriores.",
      "La penalidad equivale a una noche más el monto de cualquier reserva perdida por el retraso.",
    ]},
    { n: "10", title: "Disposiciones legales", items: [
      "El incumplimiento puede derivar en desahucio (art. 538, Código Civil, Decreto Ley 106) y en responsabilidad por daños y perjuicios.",
    ]},
  ],
  en: [
    { n: "01", title: "Check-in, identification & guests", items: [
      "Respect check-in and check-out times; any change must be approved beforehand via the platform.",
      "The person checking in must present ID matching the reservation.",
      "All guests must be registered. Undeclared people carry an extra cost per guest, per night.",
      "Respect the listing's maximum occupancy.",
      "Visitors only 6:00 a.m.–6:00 p.m., approved in advance and within capacity.",
      "Each guest is responsible for their companions; never let strangers in.",
    ]},
    { n: "02", title: "Security & access", items: [
      "Always close the pedestrian door and vehicle gate; never leave them open or forced.",
      "Gates are for vehicles only, not pedestrian passage.",
      "For safety, delivery people don't enter: receive them at the lobby or pedestrian door.",
      "Weapons are prohibited inside the apartment and common areas.",
    ]},
    { n: "03", title: "Common areas & community living", items: [
      "Smoke-free building: no smoking inside or on balconies; never discard butts anywhere.",
      "Quiet hours 10:00 p.m.–8:00 a.m.; keep a moderate volume.",
      "No parties, after-parties or gatherings exceeding capacity.",
      "No alcohol in the building's common areas.",
      "Illegal substances and any conduct against order and calm are prohibited.",
      "Trash in sealed, sorted bags (Decree 164-21), only in the designated area.",
    ]},
    { n: "04", title: "Care of the building & apartment", items: [
      "Don't throw objects outside or hang laundry visible from outside.",
      "Don't throw objects in the toilet (wipes, cotton, etc.); protect the pipes.",
      "Use only assigned parking; reverse in tight spaces. You're liable for third-party damage.",
      "Pets are not allowed at this time.",
      "Any damage to the apartment or common areas is the guest's responsibility.",
    ]},
    { n: "05", title: "Productions, photography & content", items: [
      "Any commercial shoot or production (incl. personal brands) must be approved beforehand.",
      "Creating adult content (OnlyFans or similar) in the apartment or common areas is prohibited.",
    ]},
    { n: "06", title: "Amenities & common areas", items: [
      "Using amenities (pool, gym, lounge, terrace) requires prior authorization.",
      "You can't reserve them for exclusive use or receive visitors there.",
      "Don't linger in hallways, stairwells or near other doors.",
      "You're responsible for any damage caused during use.",
    ]},
    { n: "07", title: "Changes, cancellations & lost items", items: [
      "Changes requested 15 days or less before check-in count as a cancellation (extensions excluded).",
      "Forgotten items are the guest's responsibility; we help coordinate without assuming loss.",
    ]},
    { n: "08", title: "Unexpected problems or repairs", items: [
      "24/7 support: contact us immediately if a problem arises.",
      "If unresolved within 3 hours, we assess a proportional refund; resolved sooner, no compensation applies.",
    ]},
    { n: "09", title: "Check-out & penalties", items: [
      "Late check-out affects cleaning and later reservations.",
      "The penalty equals one night plus the value of any booking lost due to the delay.",
    ]},
    { n: "10", title: "Legal provisions", items: [
      "Non-compliance may lead to eviction (art. 538, Civil Code, Decree-Law 106) and liability for damages.",
    ]},
  ],
};

/* ---------- FINES — grouped penalty schedule (USD) ---------- */
const FINES = [
  { group: "convivencia", items: [
    { id: "noise", amount: 160 },
    { id: "extraGuest", amount: 50, note: "perGuestNight" },
    { id: "lateCheckout", amount: null, custom: "lateCheckoutFine" },
    { id: "alcohol", amount: 40 },
  ]},
  { group: "humo", items: [
    { id: "smoking", amount: 10 },
    { id: "trash", amount: 30 },
  ]},
  { group: "seguridad", items: [
    { id: "doors", amount: 40 },
    { id: "strangers", amount: 40 },
    { id: "delivery", amount: 40 },
  ]},
  { group: "danos", items: [
    { id: "damage", amount: 160, note: "reparacion" },
    { id: "amenityUse", amount: 160 },
    { id: "toilet", amount: 80, note: "reparacion" },
    { id: "throwing", amount: 80 },
    { id: "speeding", amount: 80 },
    { id: "pets", amount: 40 },
    { id: "lights", amount: 30 },
  ]},
  { group: "contenido", items: [
    { id: "content", amount: 1000, prefix: "upToWord" },
  ]},
  { group: "graves", items: [
    { id: "grave", amount: 200, note: "graveNote" },
  ]},
  { group: "general", items: [
    { id: "other", amount: 40 },
  ]},
];

/* ---------- FULL RULES TEXT (downloadable) ---------- */
const RULES_FULL_TEXT = `────────────────────────
NORMAS DE CONVIVENCIA · SPACIO AM
────────────────────────

Nuestro deseo es que cada estadía se sienta como un descanso profundo.
Para lograrlo, necesitamos que todas las personas que nos visitan
compartan el mismo compromiso de respeto, calma y armonía.

1. INGRESO, IDENTIFICACIÓN Y HUÉSPEDES
• Respeta los horarios de check-in y check-out; cualquier cambio se autoriza antes por la plataforma.
• La persona que realiza el check-in debe presentar un documento que coincida con la reserva.
• Todas las personas que se hospedarán deben estar registradas. Personas no declaradas tienen un costo adicional por huésped, por noche.
• La ocupación máxima del anuncio debe respetarse.
• Las visitas se permiten solo de 6:00 a.m. a 6:00 p.m., deben autorizarse antes y no exceder la capacidad.
• Cada huésped es responsable de sus acompañantes y visitas. Nunca permitas el ingreso de desconocidos.

2. SEGURIDAD Y ACCESOS
• Al entrar o salir, cierra siempre la puerta peatonal y el portón vehicular. Nunca los dejes abiertos ni forzados.
• Los portones son únicamente para vehículos, no para paso peatonal.
• Por seguridad, los repartidores no ingresan al edificio; recíbelos en el lobby o la puerta peatonal.
• Queda prohibido portar armas de cualquier tipo dentro del apartamento y en las áreas comunes.

3. ESPACIOS COMUNES Y CONVIVENCIA
• Edificio libre de humo: prohibido fumar dentro del apartamento y en balcones. No deseches colillas en balcones, ventanas ni áreas comunes.
• Horario de silencio de 10:00 p.m. a 8:00 a.m. Televisores, música y conversaciones a volumen moderado.
• No se permiten fiestas, after parties ni reuniones que excedan la capacidad máxima.
• No está permitido ingerir bebidas alcohólicas en las áreas comunes.
• No se permiten actos contra la moral, el orden, las buenas costumbres o la tranquilidad del edificio.
• El consumo, venta o distribución de sustancias ilícitas está prohibido por el reglamento y por la ley.
• Toda basura debe colocarse en bolsas selladas (A.G. 164-21), clasificarse cuando aplique y depositarse solo en el área designada.

4. CUIDADO DEL EDIFICIO Y DEL APARTAMENTO
• No lances objetos hacia la calle o áreas vecinas, ni tiendas ropa visible desde el exterior.
• No arrojes objetos al inodoro (toallas húmedas, wipes, algodón, etc.). Protege las tuberías y la planta de tratamiento.
• Usa únicamente el parqueo asignado; en espacios estrechos estaciónate de reversa. Serás responsable de daños a vehículos, portones o estructuras.
• Por el momento, no se permiten mascotas.
• Cualquier daño en el apartamento o áreas comunes será responsabilidad del huésped.

5. PRODUCCIONES, FOTOGRAFÍA Y CONTENIDO
• Cualquier sesión fotográfica o producción con fines comerciales (incluidas marcas personales) debe autorizarse previamente.
• Queda prohibido crear contenido para adultos (OnlyFans o similares) en el apartamento o áreas comunes.

6. USO DE AMENIDADES Y ÁREAS COMUNES
• El uso de amenidades del edificio está sujeto a autorización previa y a las reglas de cada edificio.
• Los huéspedes no pueden reservar una amenidad para uso exclusivo ni recibir visitas en ellas.
• No permanezcas en pasillos, ductos de gradas ni cerca de las puertas de otros apartamentos.
• El huésped es responsable de los daños ocasionados durante el uso de cualquier área.

7. CAMBIOS, CANCELACIONES Y OBJETOS OLVIDADOS
• Los cambios solicitados con 15 días o menos antes del check-in se consideran cancelación (las extensiones no aplican).
• Los objetos olvidados tras el check-out son responsabilidad del huésped; ayudamos a gestionarlos sin asumir pérdidas.

8. PROBLEMAS O REPARACIONES INESPERADAS
• Soporte 24/7: si surge un problema, contáctanos de inmediato.
• Si el inconveniente no se resuelve en un máximo de 3 horas, evaluaremos un reembolso proporcional; si se resuelve antes, no aplica compensación.

9. CHECK-OUT Y PENALIZACIONES
• Un check-out tardío afecta al equipo de limpieza y a las reservas posteriores. La penalidad equivale a una noche más el monto de cualquier reserva perdida por el retraso.

10. DISPOSICIONES LEGALES
• El huésped que incumpla estas normas, el reglamento del edificio o la ley, puede ser sujeto a desahucio según el artículo 538 del Código Civil (Decreto Ley 106), además de responder por daños y perjuicios.

11. CUADRO DE SANCIONES
CONVIVENCIA, RUIDO Y OCUPACIÓN
• Ruido excesivo, fiesta o after party — $160
• Huésped adicional no declarado (por huésped, por noche) — $50
• Check-out tardío — 1 noche + reservas perdidas por la cancelación forzada
• Consumo de alcohol en áreas comunes — $40
HUMO Y BASURA
• Fumar en espacios no autorizados / colilla desechada (cada una) — $10
• Basura mal manejada — $30
SEGURIDAD Y ACCESOS
• No cerrar puertas peatonales o portones — $40
• Permitir el ingreso de personas desconocidas — $40
• Ingreso de repartidores al edificio — $40
DAÑOS A LA PROPIEDAD Y ÁREAS COMUNES
• Daño o mal uso de instalaciones o mobiliario — $160 + reparación
• Uso no autorizado de amenidades o área social — $160
• Objetos arrojados al inodoro — $80 + reparación
• Arrojar objetos o basura por balcón o ventana — $80
• Exceso de velocidad en el parqueo — $80
• Mascota no autorizada — $40
• Dejar luces encendidas en áreas comunes — $30
PRODUCCIÓN DE CONTENIDO
• Producción o contenido comercial no autorizado (incluye adultos) — hasta $1,000
FALTAS GRAVES
• Armas, sustancias ilícitas o reincidencia — $200 + posible cancelación de la estadía
GENERAL
• Cualquier otra falta no corregida tras aviso — $40

────────────────────────
Gracias por elegir Spacio AM, donde cada detalle tiene intención.
────────────────────────`;

Object.assign(window, {
  C, IMG, ADMIN_SETTINGS, money, DIAL_CODES, DIAL_CODES_SORTED, parsePhone,
  resPhoto, resName, resListingPhoto, titleCaseName,
  T, RESERVATIONS, groupReservations, findReservation, normCode, nightsBetween,
  RULES, FINES, RULES_FULL_TEXT,
  HOSPITABLE, adminSeedRecord, isAdminCode,
  ADMIN_CREDENTIALS, checkAdminLogin, loadAdmins, saveAdmins, isPrimaryAdmin, Backend, HospitableAPI, HOSPITABLE_PROPERTIES,
  toDay, todayDay, addDays, isoDay, fmtDay, checkinBucket, checkinDiff,
});
