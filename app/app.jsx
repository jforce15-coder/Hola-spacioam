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

function emptyForm(res) {
  return {
    booker: { type: null, doc: {}, phone: { code: "+502", number: "" }, emergency: { code: "+502", number: "" }, email: "" },
    count: res?.reservedGuests || 1,
    docs: [],
    contact: { email: "", phone: { code: "+502", number: "" }, emergency: { code: "+502", number: "" } },
  };
}

function App() {
  const [lang, setLang] = useStateA(loadStore().lang || null);
  const [stage, setStage] = useStateA(loadStore().lang ? "code" : "lang");
  const [res, setRes] = useStateA(null);
  const [siblings, setSiblings] = useStateA([]);
  const [form, setForm] = useStateA(emptyForm(null));
  const [tile, setTile] = useStateA(null);
  const [acctOpen, setAcctOpen] = useStateA(false);
  const acctTimer = useRefA(null);
  const t = lang ? T[lang] : T.es;

  // purge expired documents once, on mount
  useEffectA(() => { purgeExpiredDocuments(); }, []);

  // hash routing for bento tiles
  useEffectA(() => {
    const onHash = () => {
      if (stage !== "bento" && stage !== "tile") return;
      const h = window.location.hash.replace("#", "");
      if (h && T.es.tiles[h]) { setTile(h); setStage("tile"); }
      else { setTile(null); setStage("bento"); }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [stage]);

  useEffectA(() => { window.scrollTo(0, 0); }, [stage, tile]);

  // account prompt — a moment after landing in Mi espacio, once per reservation
  useEffectA(() => {
    clearTimeout(acctTimer.current);
    if (stage === "bento" && res) {
      const store = loadStore();
      const prompted = store.acctPrompted?.[res.id];
      const hasAccount = store.account && store.account.reservationIds?.includes(res.id);
      if (!prompted && !hasAccount) {
        acctTimer.current = setTimeout(() => setAcctOpen(true), 5000);
      }
    } else {
      setAcctOpen(false);
    }
    return () => clearTimeout(acctTimer.current);
  }, [stage, res]);

  const pickLang = (c) => { setLang(c); saveStore({ ...loadStore(), lang: c }); setStage("code"); };
  const switchLang = () => { const n = lang === "es" ? "en" : "es"; setLang(n); saveStore({ ...loadStore(), lang: n }); };

  const goBento = (r, sibs) => { setRes(r); setSiblings(sibs); setStage("bento"); };

  const onResolved = (r) => {
    // demo account (pre-completed) or an already-registered reservation → Mi espacio directly
    if (r.group) { goBento(r, groupReservations(r.group) || [r]); return; }
    // completed = local record (this browser) OR backend says status "completo"
    if (isCompleted(r) || r.statusForm === "completo") { goBento(r, [r]); return; }
    setRes(r); setSiblings([r]); setForm(emptyForm(r)); setStage("overview");
  };

  const switchStay = (r) => { window.location.hash = ""; setTile(null); setRes(r); };

  // ADMIN — seed one completed demo form, then open the control panel
  const [adminEmail, setAdminEmail] = useStateA("");
  const goAdmin = (email) => {
    setAdminEmail(email || "");
    const store = loadStore();
    const records = { ...(store.records || {}) };
    const seed = adminSeedRecord();
    if (!records[seed.resId]) { records[seed.resId] = seed.record; saveStore({ ...store, records }); }
    setStage("admin");
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

  // log out of Mi espacio → back to the reservation-code screen
  const onLogout = () => {
    window.location.hash = "";
    setTile(null); setAcctOpen(false); setRes(null); setSiblings([]);
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
    setAcctOpen(false);
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
    return ((form?.docs?.[0]?.name || rec?.firstName || "").split(" ")[0]) || "";
  })();

  let view;
  switch (stage) {
    case "lang":     view = <LangScreen onPick={pickLang} />; break;
    case "code":     view = <CodeScreen t={t} onResolved={onResolved} onAdmin={goAdmin} onSwitchLang={switchLang} />; break;
    case "overview": view = <OverviewScreen t={t} res={res} onStart={() => setStage("booker")} onSwitchLang={switchLang} />; break;
    case "booker":   view = <BookerScreen t={t} res={res} form={form} setForm={setForm} onBack={() => setStage("overview")} onNext={() => setStage("docs")} onSwitchLang={switchLang} />; break;
    case "docs":     view = <DocsScreen t={t} res={res} form={form} setForm={setForm} onBack={() => setStage("booker")} onNext={() => setStage("contact")} onSwitchLang={switchLang} />; break;
    case "contact":  view = <ContactScreen t={t} res={res} form={form} setForm={setForm} onBack={() => setStage("docs")} onNext={() => setStage("rules")} onSwitchLang={switchLang} />; break;
    case "rules":    view = <RulesScreen t={t} onBack={() => setStage("contact")} onAccept={finish} onSwitchLang={switchLang} />; break;
    case "done":     view = <DoneScreen t={t} onEnter={onDoneEnter} />; break;
    case "bento":    view = <BentoScreen t={t} res={res} siblings={siblings} onSwitch={switchStay} firstName={firstName} emails={acctEmails()} onSwitchLang={switchLang} onLogout={onLogout} />; break;
    case "admin":    view = <AdminScreen t={t} adminEmail={adminEmail} onBack={() => setStage("code")} onSwitchLang={switchLang} />; break;
    case "tile":     view = <TileDetail t={t} tileKey={tile} res={res} onBack={() => { window.location.hash = ""; }} />; break;
    default:         view = <LangScreen onPick={pickLang} />;
  }

  return (
    <div className="sp-stage">
      <div key={stage + (tile || "") + (res?.id || "")}>{view}</div>
      {acctOpen && res && (
        <AccountModal t={t} emails={acctEmails()} maxShare={res.maxCapacity}
          onClose={dismissAcct} onCreated={createAccount} />
      )}
    </div>
  );
}

Object.assign(window, { loadStore, saveStore });
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
