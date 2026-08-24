/* ============================================================
   SPACIO AM — root app: state machine, routing, persistence
   ============================================================ */
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

const STORE_KEY = "spacioam_guest_v4";
const loadStore = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; } };
const saveStore = (o) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(o)); } catch (e) {} };

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/* ---- AUTOMATIC DOCUMENT DELETION ----
   Documents are purged automatically 3 months after checkout. Runs on
   every load: any stored record past its purge date has its document
   data removed and is flagged docsPurged. */
function purgeExpiredDocuments() {
  const store = loadStore();
  const records = store.records || {};
  let changed = false;
  const now = Date.now();
  for (const id in records) {
    const r = records[id];
    if (r && r.docsPurgeAt && !r.docsPurged && now >= r.docsPurgeAt) {
      delete r.docs;
      r.docsPurged = true;
      changed = true;
    }
  }
  if (changed) saveStore({ ...store, records });
}

/* a completed registration keeps access to Mi espacio through checkout day.
   Match by reservation id OR by normalized code (the resolved id can differ
   between the registration session and later logins). */
function completedRecordFor(res) {
  if (!res) return null;
  const recs = loadStore().records || {};
  if (recs[res.id] && recs[res.id].completedAt) return recs[res.id];
  const code = normCode(res.code);
  if (code) { for (const k in recs) { if (recs[k].completedAt && normCode(recs[k].code) === code) return recs[k]; } }
  return null;
}
function isCompleted(res) {
  return !!completedRecordFor(res);
}

/* El administrador reinició el formulario: el registro local de este dispositivo
   ya no vale, hay que volver a llenarlo. */
function dropLocalRecord(res) {
  if (!res) return;
  const store = loadStore();
  const records = { ...(store.records || {}) };
  const code = normCode(res.code);
  let changed = false;
  Object.keys(records).forEach((k) => {
    if (k === res.id || (code && normCode(records[k]?.code) === code)) { delete records[k]; changed = true; }
  });
  if (changed) saveStore({ ...store, records });
}

function emptyForm(res) {
  return {
    booker: { type: null, doc: {}, phone: { code: "+502", number: "" }, emergency: { code: "+502", number: "" }, email: "" },
    count: res?.reservedGuests || 1,
    docs: [],
    contact: { email: "", phone: { code: "+502", number: "" }, emergency: { code: "+502", number: "" } },
  };
}

/* ---- SESIÓN DEL HUÉSPED ----
   Escribir el código de reserva ES iniciar sesión. Guardamos la reserva en el
   dispositivo: al volver a abrir hola.spacioam.com el huésped entra directo a
   Mi espacio y los datos se refrescan en segundo plano. La sesión caduca el día
   después del checkout. */
const SESSION_KEY = "spacioam_session";
function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; } }
function saveSession(res) {
  try { if (res && res.code) localStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now(), code: res.code, res })); } catch (e) {}
}
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
function sessionAlive(s) {
  if (!(s && s.res && s.res.code)) return false;
  const co = s.res.checkout;
  if (!co) return Date.now() - (s.at || 0) < 7 * 86400000;
  return Date.now() < new Date(co + "T12:00:00").getTime() + 2 * 86400000;
}
function adminSession() { try { return localStorage.getItem("spacioam_admin_session") || ""; } catch (e) { return ""; } }

/* Punto de partida al abrir la app: enlace firmado > sesión de admin >
   sesión del huésped > pantalla de código. */
function bootState() {
  const hash = (typeof window !== "undefined" && window.location.hash) || "";
  if (/[#&]r=/.test(hash) || /invite=/.test(hash)) return { stage: loadStore().lang ? "code" : "lang", res: null };
  if (adminSession()) return { stage: "admin", res: null };
  const s = loadSession();
  if (s && sessionAlive(s)) {
    const done = isCompleted(s.res) || s.res.statusForm === "completo";
    return { stage: done ? "bento" : "overview", res: s.res };
  }
  return { stage: loadStore().lang ? "code" : "lang", res: null };
}

function App() {
  const boot = useRefA(bootState()).current;
  const [lang, setLang] = useStateA(loadStore().lang || (boot.stage !== "lang" ? "es" : null));
  const [stage, setStage] = useStateA(boot.stage);
  const [res, setRes] = useStateA(boot.res);
  const [siblings, setSiblings] = useStateA(boot.res ? [boot.res] : []);
  const [form, setForm] = useStateA(emptyForm(boot.res));
  const [tile, setTile] = useStateA(null);
  const [adminPreview, setAdminPreview] = useStateA(false);
  const [acctOpen, setAcctOpen] = useStateA(false);
  const [acctNudge, setAcctNudge] = useStateA(false);
  const [inviteEmail, setInviteEmail] = useStateA("");
  const acctTimer = useRefA(null);
  const t = lang ? T[lang] : T.es;

  // purge expired documents once, on mount
  useEffectA(() => { purgeExpiredDocuments(); }, []);

  // sesión restaurada: la reserva guardada se muestra al instante y se refresca
  // en segundo plano (sin spinner, sin bloquear al huésped).
  useEffectA(() => {
    if (!boot.res) return;
    Backend.findReservation(boot.res.code, "").then(({ reservation: r, fresh }) => {
      if (!r) return;
      saveSession(r);
      // el administrador reinició este formulario → el huésped vuelve al registro.
      // Solo con evidencia POSITIVA del servidor (marca de reinicio posterior al
      // registro guardado): nunca por una respuesta local, un timeout o sin red.
      const rec = completedRecordFor(r);
      const doneAt = rec ? new Date(rec.completedAt || 0).getTime() : 0;
      if (fresh && Backend.isConnected() && rec && r.resetAt && r.resetAt > doneAt && r.statusForm !== "completo") {
        dropLocalRecord(r);
        setTile(null); setRes(r); setSiblings([r]); setForm(emptyForm(r)); setStage("overview");
        return;
      }
      setRes((cur) => (cur && normCode(cur.code) === normCode(r.code) ? { ...cur, ...r } : cur));
    }).catch(() => {});
  }, []);

  // hydrate property info (incl. house manual) from backend → localStorage, so
  // the bento + admin panel reflect admin edits across devices.
  const [, forcePropInfo] = useStateA(0);
  useEffectA(() => {
    if (!(Backend.isConnected && Backend.isConnected() && Backend.listPropertyInfo)) return;
    Backend.listPropertyInfo().then((info) => {
      if (!info) return;
      try {
        const cur = JSON.parse(localStorage.getItem("spacioam_property_info")) || {};
        localStorage.setItem("spacioam_property_info", JSON.stringify({ ...cur, ...info }));
        forcePropInfo((n) => n + 1);
      } catch (e) {}
    });
  }, []);

  // enlace firmado (#r=CODIGO&s=FIRMA&t=seccion) — el huésped entra directo a
  // su estancia, sin escribir el código. La firma se valida en el backend.
  const [linkErr, setLinkErr] = useStateA("");
  useEffectA(() => {
    const h = window.location.hash || "";
    const m = h.match(/[#&]r=([^&]+)/);
    const sg = h.match(/[#&]s=([^&]+)/);
    if (!m || !sg) return;
    const code = decodeURIComponent(m[1] || "");
    const tl = (h.match(/[#&]t=([^&]+)/) || [])[1];
    const want = tl ? decodeURIComponent(tl) : "";
    if (!lang) setLang("es");
    Backend.openLink({ code, sig: decodeURIComponent(sg[1] || "") }).then(({ reservation: r, error }) => {
      if (!r) {
        // enlace inválido o vencido → pantalla de código normal, con aviso
        window.location.hash = "";
        setLinkErr(error === "expired" ? "expired" : "invalid");
        setStage("code");
        return;
      }
      setRes(r); setSiblings([r]);
      if (want && T.es.tiles[want]) { setTile(want); setStage("tile"); window.location.hash = want; }
      else { window.location.hash = ""; setStage("bento"); }
    }).catch(() => { window.location.hash = ""; setLinkErr("invalid"); setStage("code"); });
  }, []);

  // invite link (#invite=CODE&email=…) — a secondary guest lands here from the
  // email; resolve the reservation by code and open account creation synced to it.
  useEffectA(() => {
    const h = window.location.hash || "";
    const m = h.match(/invite=([^&]+)/);
    if (!m) return;
    const code = decodeURIComponent(m[1] || "");
    const em = (h.match(/email=([^&]+)/) || [])[1];
    const inviteEmail = em ? decodeURIComponent(em) : "";
    if (!code) return;
    if (!lang) setLang("es");
    Backend.findReservation(code, "quick").then(({ reservation: r }) => {
      if (!r) return;
      window.location.hash = "";
      setRes(r); setSiblings([r]); setInviteEmail(inviteEmail); setStage("bento");
      setTimeout(() => setAcctOpen(true), 400);
    }).catch(() => {});
  }, []);

  // hash routing for bento tiles
  useEffectA(() => {
    const onHash = () => {
      if (stage !== "bento" && stage !== "tile") return;
      const h = window.location.hash.replace("#", "");
      if (h && T.es.tiles[h]) { setTile(h); setStage("tile"); }
      else { setTile(null); setStage("bento"); }
    };
    // al ENTRAR a la estancia, respeta el #hash con el que llegó el huésped:
    // así hola.spacioam.com/#amenities abre esa sección directamente tras validar
    // el código, en vez de quedarse en el menú.
    if (stage === "bento") onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [stage]);

  useEffectA(() => { window.scrollTo(0, 0); }, [stage, tile]);

  // aviso de cuenta — NUNCA en la primera visita. Solo a partir de la segunda
  // vez que el huésped entra a Mi espacio, y como banda discreta arriba.
  useEffectA(() => {
    clearTimeout(acctTimer.current);
    if (stage === "bento" && res && !adminPreview) {
      const store = loadStore();
      const prompted = store.acctPrompted?.[res.id];
      const hasAccount = store.account && store.account.reservationIds?.includes(res.id);
      // cuenta una visita por SESIÓN del navegador, no por recarga
      let visits = (store.visits || {})[res.id] || 0;
      const mark = `spacioam_v_${res.id}`;
      let fresh = false;
      try { fresh = !sessionStorage.getItem(mark); } catch (e) { fresh = false; }
      if (fresh) {
        visits += 1;
        try { sessionStorage.setItem(mark, "1"); } catch (e) {}
        saveStore({ ...store, visits: { ...(store.visits || {}), [res.id]: visits } });
      }
      if (!prompted && !hasAccount && visits >= 2) {
        acctTimer.current = setTimeout(() => setAcctNudge(true), 2600);
      }
    } else {
      setAcctNudge(false); setAcctOpen(false);
    }
    return () => clearTimeout(acctTimer.current);
  }, [stage, res]);
  const pickLang = (c) => { setLang(c); saveStore({ ...loadStore(), lang: c }); setStage("code"); };
  const switchLang = () => { const n = lang === "es" ? "en" : "es"; setLang(n); saveStore({ ...loadStore(), lang: n }); };

  const goBento = (r, sibs) => { setRes(r); setSiblings(sibs); setStage("bento"); };

  const onResolved = (r) => {
    saveSession(r);
    // demo account (pre-completed) or an already-registered reservation → Mi espacio directly
    if (r.group) { goBento(r, groupReservations(r.group) || [r]); return; }
    // completed = local record (this browser) OR backend says status "completo"
    if (isCompleted(r) || r.statusForm === "completo") { goBento(r, [r]); return; }
    setRes(r); setSiblings([r]); setForm(emptyForm(r)); setStage("overview");
  };

  const switchStay = (r) => { window.location.hash = ""; setTile(null); setRes(r); };

  // ADMIN — seed one completed demo form, then open the control panel
  const [adminEmail, setAdminEmail] = useStateA(() => adminSession());
  const seedAdminRecord = () => {
    const store = loadStore();
    const records = { ...(store.records || {}) };
    const seed = adminSeedRecord();
    if (!records[seed.resId]) { records[seed.resId] = seed.record; saveStore({ ...store, records }); }
  };
  const goAdmin = (email) => {
    const em = email || adminEmail || "";
    setAdminEmail(em);
    try { if (em) localStorage.setItem("spacioam_admin_session", em); } catch (e) {}
    seedAdminRecord();
    setStage("admin");
  };
  // sesión de administrador activa → el panel abre solo al cargar la app
  useEffectA(() => { if (boot.stage === "admin") seedAdminRecord(); }, []);
  const leaveAdmin = () => {
    try { localStorage.removeItem("spacioam_admin_session"); } catch (e) {}
    setAdminEmail(""); setStage("code");
  };

  /* el administrador entra a “Mi espacio” tal como lo ve el huésped */
  const previewGuest = (h) => {
    window.location.hash = "";
    const r = { ...h };
    setTile(null); setRes(r); setSiblings([r]); setAdminPreview(true); setStage("bento");
  };
  const exitPreview = () => {
    window.location.hash = "";
    setTile(null); setAdminPreview(false); setRes(null); setSiblings([]); setStage("admin");
  };

  /* el admin ingresa un formulario manualmente: abre el registro del huésped
     para esa reserva (formulario si falta, Mi espacio si ya está completo). */
  const manualForm = (r) => {
    if (!r) return;
    window.location.hash = "";
    setTile(null); setRes(r); setSiblings([r]); setForm(emptyForm(r)); setAdminPreview(true);
    setStage(isCompleted(r) || r.statusForm === "completo" ? "bento" : "overview");
  };

  /* el administrador reinicia un formulario mal enviado: la reserva vuelve a
     pedirle el registro al huésped (en la hoja queda la traza del anterior) */
  const resetGuestForm = (h) => {
    const store = loadStore();
    const records = { ...(store.records || {}) };
    const n = normCode(h.code);
    Object.keys(records).forEach((k) => {
      if (k === h.id || normCode(records[k]?.code) === n) delete records[k];
    });
    saveStore({ ...store, records });
    return Backend.resetForm({ code: h.code, by: adminEmail });
  };

  const finish = () => {
    const store = loadStore();
    const records = { ...(store.records || {}) };
    const emails = [form.contact?.email, form.booker?.type === "third" ? form.booker?.email : null].filter(Boolean);
    const completedAt = Date.now();
    // documents auto-delete 3 months after checkout
    const purgeAt = new Date(res.checkout + "T12:00:00").getTime() + ADMIN_SETTINGS.docRetentionMonths * MONTH_MS;
    const guests = (form.docs || []).slice(0, form.count).map((d, i) => ({
      name: d.name || "", id: d.id || "", docImage: d.dataUrl || null, manual: !!d.manual, main: i === 0,
    }));
    records[res.id] = {
      completedAt, count: form.count, code: res.code, resId: res.id,
      firstName: (form.docs?.[0]?.name || "").split(" ")[0] || "",
      booker: { type: form.booker?.type,
        doc: form.booker?.type === "third" ? { name: form.booker?.doc?.name || "", id: form.booker?.doc?.id || "", docImage: form.booker?.doc?.dataUrl || null } : null,
        phone: form.booker?.phone, emergency: form.booker?.emergency, email: form.booker?.email },
      guests,
      contact: form.contact,
      emails, acceptedRulesAt: completedAt,
      docsPurgeAt: purgeAt, docsPurged: false, docs: true,
    };
    saveStore({ ...store, records });
    // send to backend (Sheets + Drive) — non-blocking; demo works offline
    try {
      Backend.submitForm(
        { code: res.code, propertyName: res.propertyName, apartment: res.apartment, checkin: res.checkin, checkout: res.checkout, maxCapacity: res.maxCapacity },
        { booker: records[res.id].booker, guests, contact: form.contact, count: form.count, acceptedRulesAt: completedAt }
      ).catch(() => {});
    } catch (e) { /* offline / no endpoint */ }
    setStage("done");
  };
  const onDoneEnter = () => goBento(res, siblings.length ? siblings : [res]);

  /* Un paso atrás desde el resumen de la reserva: cierra la sesión de ese
     código y vuelve a la pantalla del código (útil para el administrador que
     entró a revisar o para cancelar un formulario empezado por error). */
  const exitToCode = () => {
    if (adminPreview) { exitPreview(); return; }
    clearSession();
    setTile(null); setRes(null); setSiblings([]); setForm(emptyForm(null)); setStage("code");
  };

  // log out of Mi espacio → back to the reservation-code screen
  const onLogout = () => {
    if (adminPreview) { exitPreview(); return; }
    window.location.hash = "";
    clearSession();
    setTile(null); setAcctOpen(false); setAcctNudge(false); setRes(null); setSiblings([]);
    setStage("code");
  };

  // account creation
  const acctEmails = () => {
    const rec = loadStore().records?.[res?.id];
    const set = new Set();
    if (form?.contact?.email) set.add(form.contact.email.trim());
    if (form?.booker?.type === "third" && form?.booker?.email) set.add(form.booker.email.trim());
    (rec?.emails || []).forEach((e) => e && set.add(e));
    if (set.size === 0) { set.add("huesped@correo.com"); set.add("familia@correo.com"); }
    return [...set];
  };
  const dismissAcct = () => {
    const store = loadStore();
    saveStore({ ...store, acctPrompted: { ...(store.acctPrompted || {}), [res.id]: true } });
    setAcctOpen(false); setAcctNudge(false);
  };
  const createAccount = ({ email, pass, sharedEmails }) => {
    const store = loadStore();
    const existing = store.account || { reservationIds: [] };
    const ids = new Set(existing.reservationIds || []);
    (siblings.length ? siblings : [res]).forEach((r) => ids.add(r.id));
    saveStore({ ...store, account: { email, reservationIds: [...ids] },
      acctPrompted: { ...(store.acctPrompted || {}), [res.id]: true } });
    // persist account to backend (Usuarios tab)
    try {
      Backend.createAccount({
        email, password: pass,
        reservationCodes: (siblings.length ? siblings : [res]).map((r) => r.code),
        sharedEmails: sharedEmails || [],
      }).catch(() => {});
    } catch (e) { /* offline / no endpoint */ }
  };

  const firstName = (() => {
    const rec = completedRecordFor(res) || loadStore().records?.[res?.id];
    const fromForm = form?.docs?.[0]?.name || "";
    const fromRec = rec?.firstName || "";
    const fromRes = res?.guestFirstName || (res?.guestName || "").trim();
    return ((fromForm || fromRec || fromRes || "").split(" ")[0]) || "";
  })();

  let view;
  switch (stage) {
    case "lang":     view = <LangScreen onPick={pickLang} />; break;
    case "code":     view = <CodeScreen t={t} linkErr={linkErr} onClearLinkErr={() => setLinkErr("")} onResolved={onResolved} onAdmin={goAdmin} onSwitchLang={switchLang} />; break;
    case "overview": view = <OverviewScreen t={t} res={res} onStart={() => setStage("booker")} onExit={exitToCode} onSwitchLang={switchLang} />; break;
    case "booker":   view = <BookerScreen t={t} res={res} form={form} setForm={setForm} onBack={() => setStage("overview")} onNext={() => setStage("docs")} onSwitchLang={switchLang} />; break;
    case "docs":     view = <DocsScreen t={t} res={res} form={form} setForm={setForm} onBack={() => setStage("booker")} onNext={() => setStage("contact")} onSwitchLang={switchLang} />; break;
    case "contact":  view = <ContactScreen t={t} res={res} form={form} setForm={setForm} onBack={() => setStage("docs")} onNext={() => setStage("rules")} onSwitchLang={switchLang} />; break;
    case "rules":    view = <RulesScreen t={t} onBack={() => setStage("contact")} onAccept={finish} onSwitchLang={switchLang} />; break;
    case "done":     view = <DoneScreen t={t} onEnter={onDoneEnter} />; break;
    case "bento":    view = <BentoScreen t={t} res={res} siblings={siblings} onSwitch={switchStay} firstName={firstName} emails={acctEmails()} onSwitchLang={switchLang} onLogout={onLogout} />; break;
    case "admin":    view = <AdminScreen t={t} adminEmail={adminEmail} onBack={leaveAdmin} onSwitchLang={switchLang} onPreviewGuest={previewGuest} onResetForm={resetGuestForm} onManualForm={manualForm} />; break;
    case "tile":     view = <TileDetail t={t} tileKey={tile} res={res} onBack={() => { window.location.hash = ""; }} />; break;
    default:         view = <LangScreen onPick={pickLang} />;
  }

  return (
    <div className="sp-stage">
      {adminPreview && stage !== "admin" && (
        <div style={{ position: "fixed", left: 0, right: 0, top: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
          background: "rgba(62,63,63,.94)", backdropFilter: "blur(20px) saturate(120%)", padding: "9px 16px" }}>
          <span style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FAFAFA", fontWeight: 500 }}>
            {t.code === "es" ? "Vista del huésped" : "Guest view"}{res?.code ? " · " + res.code : ""}
          </span>
          <button onClick={exitPreview} className="sp-btn" style={{ background: "transparent", border: "1px solid rgba(250,250,250,.35)", borderRadius: 999,
            padding: "5px 13px", fontFamily: C.sans, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FAFAFA", cursor: "pointer" }}>
            {t.code === "es" ? "Volver al panel" : "Back to panel"}
          </button>
        </div>
      )}
      <div style={adminPreview && stage !== "admin" ? { paddingTop: 38 } : undefined} key={stage + (tile || "") + (res?.id || "")}>{view}</div>
      {acctNudge && !acctOpen && res && stage === "bento" && (
        <AccountNudge t={t} onOpen={() => { setAcctNudge(false); setAcctOpen(true); }} onDismiss={dismissAcct} />
      )}
      {acctOpen && res && (
        <AccountModal t={t} emails={inviteEmail ? [inviteEmail] : acctEmails()} maxShare={res.maxCapacity} invited={!!inviteEmail}
          onClose={dismissAcct} onCreated={createAccount} />
      )}
    </div>
  );
}

Object.assign(window, { loadStore, saveStore });
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
