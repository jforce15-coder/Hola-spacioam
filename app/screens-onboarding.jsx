/* ============================================================
   SPACIO AM — onboarding screens
   Language · Code · Overview · Booker · Docs · Contact · Rules · Done
   Flow: quién reserva → documentos (primero) → contacto → normas
   ============================================================ */
const { useState: useStateO, useEffect: useEffectO, useRef: useRefO } = React;

/* ---------- LANGUAGE (brushstroke baked into photo — unchanged) ---------- */
function LangScreen({ onPick }) {
  return (
    <Screen maxW={460} flowTop={false} pad="0 0 48px">
      <div style={{ position: "absolute", top: -30, left: 0, right: 0, height: 320, opacity: 0.45, pointerEvents: "none" }}>
        <FlowLine variant={2} opacity={0.45} />
      </div>
      <div style={{ position: "relative", zIndex: 2, padding: "44px 30px 0", textAlign: "center" }}>
        <div className="reveal" style={{ display: "flex", justifyContent: "center" }}>
          <LogoMain width={216} />
        </div>
        <p className="reveal" style={{ animationDelay: ".08s", fontFamily: C.serif, fontStyle: "normal", fontWeight: 400,
          fontSize: 24, lineHeight: 1.34, color: C.negro, margin: "30px auto 0", maxWidth: 380, letterSpacing: "0", textWrap: "balance" }}>
          {T.es.slogan}
        </p>
      </div>

      <div className="reveal" style={{ animationDelay: ".16s", position: "relative", zIndex: 2, margin: "34px clamp(18px,5vw,26px) 0" }}>
        <div className="sp-imgwrap" style={{ position: "relative", height: "clamp(208px,30vh,262px)", borderRadius: "24px 24px 0 0",
          overflow: "hidden", boxShadow: "0 6px 22px rgba(62,63,63,.08)" }}>
          <img src={IMG.weave} alt="" className="sp-img" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(62,63,63,.18), transparent 44%)" }} />
        </div>
        <div style={{ position: "relative", zIndex: 3, background: C.white, padding: "22px 24px 10px", borderRadius: "0 0 24px 24px",
          boxShadow: "0 18px 50px rgba(62,63,63,.1)" }}>
          <div style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase",
            color: C.tierra, textAlign: "center", marginBottom: 16, fontWeight: 500 }}>
            {T.es.chooseLang} · {T.en.chooseLang}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {Object.values(T).map((lang) => (
              <button key={lang.code} className="sp-row" onClick={() => onPick(lang.code)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                  background: C.alabaster, border: `1px solid ${C.grisCalido}`, borderRadius: 14, padding: "16px 20px", cursor: "pointer" }}>
                <span style={{ fontFamily: C.sans, fontSize: 15, color: C.negro, letterSpacing: "0.02em" }}>{lang.label}</span>
                <Icon name="arrow" size={18} color={C.peach} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}

/* ---------- RESERVATION CODE ---------- */
function CodeScreen({ t, onResolved, onAdmin, onSwitchLang }) {
  const [code, setCode] = useStateO("");
  const [err, setErr] = useStateO("");
  const [loading, setLoading] = useStateO(false);
  const [showLogin, setShowLogin] = useStateO(false);
  const submit = () => {
    setErr(""); setLoading(true);
    // acceso permitido hasta 10 días después del checkout; luego, vencida.
    const isExpired = (res) => {
      const co = res && res.checkout ? String(res.checkout).slice(0, 10) : "";
      if (!co) return false;
      const limit = new Date(co + "T12:00:00").getTime() + 10 * 86400000;
      return Date.now() > limit;
    };
    // demo/local codes resolve instantly; otherwise ask the backend (which
    // re-syncs from Hospitable on a miss before giving up).
    const local = findReservation(code);
    if (local) { setTimeout(() => { setLoading(false); if (isExpired(local)) { setErr(t.expired); return; } onResolved(local); }, 500); return; }
    Backend.findReservation(code).then((res) => {
      setLoading(false);
      if (!res) { setErr(t.notFound); return; }
      if (isExpired(res)) { setErr(t.expired); return; }
      onResolved(res);
    }).catch(() => { setLoading(false); setErr(t.notFound); });
  };
  return (
    <Screen maxW={480}>
      {/* discreet admin access — top-right corner */}
      <button onClick={() => { const s = (function(){try{return localStorage.getItem("spacioam_admin_session")||""}catch(e){return ""}})(); if (s) onAdmin(s); else setShowLogin(true); }} title={t.adminLoginTitle} aria-label={t.adminLoginTitle}
        style={{ position: "fixed", top: 16, right: 16, zIndex: 60, width: 38, height: 38, borderRadius: 11,
          border: `1px solid ${C.grisCalido}`, background: "rgba(250,250,250,.7)", backdropFilter: "blur(20px) saturate(120%)",
          cursor: "pointer", display: "grid", placeItems: "center", opacity: 0.5, transition: "opacity .18s " + C.ease }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)} onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.5)}>
        <Icon name="lock" size={16} color={C.tierra} />
      </button>
      {showLogin && <AdminLogin t={t} onClose={() => setShowLogin(false)} onSuccess={(email) => { setShowLogin(false); onAdmin(email); }} />}
      <TopBar t={t} onSwitchLang={onSwitchLang} />
      <div className="reveal"><H sub={t.reservationSub}>{t.reservationTitle}</H></div>
      <div className="reveal" style={{ animationDelay: ".08s", background: C.white, borderRadius: 22, padding: 26,
        border: `1px solid ${C.grisCalido}`, boxShadow: "0 4px 16px rgba(62,63,63,.05)" }}>
        <input value={code} placeholder={t.reservationPh}
          onChange={(e) => { setCode(e.target.value.replace(/\s+/g, "").toUpperCase()); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ width: "100%", boxSizing: "border-box", textAlign: "center", padding: "18px 12px",
            fontFamily: C.sans, fontSize: 24, letterSpacing: "0.18em", color: C.negro, fontWeight: 500,
            border: `1px solid ${C.grisCalido}`, borderRadius: 14, background: C.alabaster, outline: "none" }} />
        {err && <p style={{ color: C.peach, fontFamily: C.sans, fontSize: 12, marginTop: 12, textAlign: "center", letterSpacing: "0.02em" }}>{err}</p>}
        <div style={{ marginTop: 18 }}>
          <Btn full onClick={submit} disabled={loading || normCode(code).length < 3}>
            {loading ? <><Spinner /> {t.validating}</> : t.validate}
          </Btn>
        </div>
      </div>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start", marginTop: 22, padding: "0 4px" }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="lock" size={14} color={C.taupe} /></span>
        <p style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, margin: 0, letterSpacing: "0.02em", lineHeight: 1.7, textWrap: "pretty" }}>{t.codeHelp}</p>
      </div>
    </Screen>
  );
}

/* ---------- STAY OVERVIEW ---------- */
function OverviewScreen({ t, res, onStart, onSwitchLang }) {
  const nights = nightsBetween(res.checkin, res.checkout);
  const row = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0",
      borderBottom: `1px solid ${C.beige}` }}>
      <span style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.tierra, fontWeight: 500 }}>{label}</span>
      <span style={{ fontFamily: C.serif, fontSize: 20, color: C.negro }}>{value}</span>
    </div>
  );
  return (
    <Screen maxW={500}>
      <TopBar t={t} onSwitchLang={onSwitchLang} />
      <div className="reveal"><H>{t.foundTitle}</H></div>
      <div className="reveal" style={{ animationDelay: ".08s", position: "relative", marginBottom: -1 }}>
        <WeaveHero img={resListingPhoto(res)} variant={3} height="clamp(220px,30vh,288px)" width={90}
          frontMask="radial-gradient(130% 92% at 78% 86%, #000 0 38%, transparent 60%)"
          overlay={<>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(62,63,63,.58), transparent 52%)" }} />
            <div style={{ position: "absolute", left: 22, bottom: 18, zIndex: 5 }}>
              <div style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase",
                color: "rgba(255,255,255,.82)", marginBottom: 5, fontWeight: 500 }}>{res.propertyName}</div>
              <div style={{ fontFamily: C.serif, fontSize: 28, color: C.white, lineHeight: 1 }}>{res.propertyShort}</div>
            </div>
          </>} />
      </div>
      <div className="reveal" style={{ animationDelay: ".14s", background: C.white, borderRadius: "0 0 24px 24px",
        padding: "10px 26px 26px", border: `1px solid ${C.grisCalido}`, borderTop: "none" }}>
        {row(t.checkin, res.checkin)}
        {row(t.checkout, res.checkout)}
        {row(t.nights, nights)}
        {row(t.capacity, `${t.upTo} ${res.maxCapacity}`)}
        <div style={{ marginTop: 22 }}><Btn full onClick={onStart}>{t.startForm} <Icon name="arrow" size={17} color={C.alabaster} /></Btn></div>
      </div>
    </Screen>
  );
}

/* ---------- BOOKER — ¿quién reserva? (self / tercero + datos del encargado) ---------- */
function BookerScreen({ t, res, form, setForm, onBack, onNext, onSwitchLang }) {
  const b = form.booker;
  const [err, setErr] = useStateO("");
  const setB = (patch) => setForm((prev) => ({ ...prev, booker: { ...prev.booker, ...patch } }));
  const updateDoc = (patch) => setForm((prev) => ({ ...prev, booker: { ...prev.booker, doc: { ...prev.booker.doc, ...patch } } }));
  const managerReady = () => {
    const d = b.doc || {};
    const docOk = d.file && !d.reading && (!d.error || d.manual) && (d.name || "").trim();
    return docOk && (b.phone?.number || "").trim() && (b.email || "").trim();
  };
  const proceed = () => {
    setErr("");
    if (!b.type) { setErr(t.requiredFields || "Selecciona una opción."); return; }
    if (b.type === "third" && !managerReady()) { setErr(t.requiredFields || "Completa los datos del encargado."); return; }
    onNext();
  };
  const opt = (value, title, desc) => (
    <button className="sp-row" onClick={() => { setB({ type: value }); setErr(""); }}
      style={{ display: "flex", alignItems: "flex-start", gap: 14, width: "100%", textAlign: "left", cursor: "pointer",
        background: b.type === value ? C.beige : C.alabaster, border: `1.5px solid ${b.type === value ? C.negro : C.grisCalido}`,
        borderRadius: 16, padding: "18px 20px" }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "grid", placeItems: "center",
        border: `1.5px solid ${b.type === value ? C.negro : C.grisCalido}`, background: b.type === value ? C.negro : "transparent" }}>
        {b.type === value && <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.alabaster }} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: C.serif, fontSize: 19, color: C.negro, lineHeight: 1.2 }}>{title}</span>
        <span style={{ display: "block", fontFamily: C.sans, fontSize: 12, color: C.tierra, marginTop: 4, letterSpacing: "0.01em", lineHeight: 1.5 }}>{desc}</span>
      </span>
    </button>
  );
  return (
    <Screen maxW={560}>
      <TopBar t={t} onSwitchLang={onSwitchLang} />
      <Steps step={0} t={t} />
      <H sub={t.bookerSub}>{t.bookerTitle}</H>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {opt("self", t.bookerSelf, t.bookerSelfDesc)}
        {opt("third", t.bookerThird, t.bookerThirdDesc)}
      </div>

      {b.type === "third" && (
        <div style={{ marginTop: 20, animation: "rise .4s " + C.ease + " both" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: C.serif, fontSize: 22, color: C.negro, lineHeight: 1.15 }}>{t.managerTitle}</div>
            <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, margin: "6px 0 0", letterSpacing: "0.01em", lineHeight: 1.55 }}>{t.managerSub}</p>
          </div>
          <DocUploader t={t} roleLabel={t.manager} badge={t.manager} badgeColor={C.taupe} doc={b.doc} update={updateDoc} />
          <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.grisCalido}`, padding: "20px 22px", marginTop: 14 }}>
            <PhoneInput label={t.phone} value={b.phone} required hint={t.phoneHint} onChange={(v) => setB({ phone: v })} />
            <div style={{ marginTop: 16 }}>
              <PhoneInput label={t.emergency} value={b.emergency} hint={t.emergencyHint} onChange={(v) => setB({ emergency: v })} />
            </div>
            <div style={{ marginTop: 16 }}>
              <Field label={t.email} type="email" value={b.email} required onChange={(v) => setB({ email: v })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 11, alignItems: "flex-start", marginTop: 14, background: C.beige, borderRadius: 14, padding: "14px 16px" }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><Sparkle size={12} color={C.taupe} /></span>
            <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em" }}>{t.managerNote}</p>
          </div>
        </div>
      )}

      {err && <p style={{ color: C.peach, fontFamily: C.sans, fontSize: 12, margin: "16px 0 0", letterSpacing: "0.02em" }}>{err}</p>}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Btn variant="outline" onClick={onBack}>{t.back}</Btn>
        <div style={{ flex: 1 }} />
        <Btn onClick={proceed} disabled={!b.type || (b.type === "third" && !managerReady())}>{t.next}</Btn>
      </div>
    </Screen>
  );
}

/* ---------- DOCUMENTS FIRST (count + each guest's ID via AI read) ---------- */
function DocsScreen({ t, res, form, setForm, onBack, onNext, onSwitchLang }) {
  const max = res.maxCapacity;
  const count = form.count || res.reservedGuests || 1;
  const [err, setErr] = useStateO("");
  const setCount = (n) => {
    setForm((prev) => {
      const docs = [...(prev.docs || [])];
      while (docs.length < n) docs.push({});
      return { ...prev, count: n, docs };
    });
  };
  const updateDoc = (i, patch) => {
    setForm((prev) => {
      const docs = [...(prev.docs || [])];
      docs[i] = { ...(docs[i] || {}), ...patch };
      return { ...prev, docs };
    });
  };
  const docs = form.docs || [];
  const largeCap = res.maxCapacity > 8;
  const drivers = Math.min(Math.max(1, form.drivers || 1), count);
  const setDrivers = (n) => setForm((prev) => ({ ...prev, drivers: Math.min(Math.max(1, n), prev.count || count) }));
  const mismatch = count !== res.reservedGuests;
  const docOk = (d) => d && d.file && !d.reading && (!d.error || d.manual) && (d.name || "").trim();
  const nameOk = (d) => d && (d.name || "").trim();
  const allDone = largeCap
    ? Array.from({ length: count }).every((_, i) => (i < drivers ? docOk(docs[i]) : nameOk(docs[i])))
    : Array.from({ length: count }).every((_, i) => docOk(docs[i]));
  const proceed = () => {
    if (!allDone) { setErr(largeCap ? t.allDriversRequired : t.allDocsRequired); return; }
    onNext();
  };
  return (
    <Screen maxW={560}>
      <TopBar t={t} onSwitchLang={onSwitchLang} />
      <Steps step={1} t={t} />
      <H sub={t.guestsSub}>{t.guestsTitle}</H>

      <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.grisCalido}`, padding: "20px 22px", marginBottom: 18 }}>
        <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.negro, marginBottom: 4, letterSpacing: "0.02em", fontWeight: 500 }}>{t.howMany}</div>
        <div style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, marginBottom: 16, letterSpacing: "0.02em" }}>{t.capacityNote} {max} {t.people}.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button key={n} className="sp-btn" onClick={() => setCount(n)}
              style={{ width: 46, height: 46, borderRadius: 12, cursor: "pointer", fontFamily: C.sans, fontSize: 15, fontWeight: 500,
                border: `1px solid ${n === count ? C.negro : C.grisCalido}`, background: n === count ? C.negro : C.alabaster,
                color: n === count ? C.alabaster : C.negro, transition: "all .18s " + C.ease }}>{n}</button>
          ))}
        </div>
        {count === max && <div style={{ fontFamily: C.sans, fontSize: 11, color: C.peach, marginTop: 12, letterSpacing: "0.02em" }}>{t.capacityReached}</div>}
      </div>

      {largeCap && (
        <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.grisCalido}`, padding: "20px 22px", marginBottom: 18 }}>
          <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.negro, marginBottom: 4, letterSpacing: "0.02em", fontWeight: 500 }}>{t.driversHowMany}</div>
          <div style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, marginBottom: 16, letterSpacing: "0.02em", lineHeight: 1.55 }}>{t.driversNote}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
              <button key={n} className="sp-btn" onClick={() => setDrivers(n)}
                style={{ width: 46, height: 46, borderRadius: 12, cursor: "pointer", fontFamily: C.sans, fontSize: 15, fontWeight: 500,
                  border: `1px solid ${n === drivers ? C.negro : C.grisCalido}`, background: n === drivers ? C.negro : C.alabaster,
                  color: n === drivers ? C.alabaster : C.negro, transition: "all .18s " + C.ease }}>{n}</button>
            ))}
          </div>
        </div>
      )}

      <Alert tone="soft" title={t.mismatchTitle} body={
        <>
          {t.regReminderBase}
          <span style={{ display: "block", marginTop: 8, color: mismatch ? C.peach : C.tierra }}>
            {mismatch
              ? t.regReminderMismatch.replace("{res}", res.reservedGuests).replace("{n}", count)
              : t.regReminderMatch}
          </span>
        </>
      } />

      <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, lineHeight: 1.6, margin: "0 0 16px", letterSpacing: "0.02em" }}>{largeCap ? t.driversNote : t.docsSub}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: count }).map((_, i) => (
          largeCap && i >= drivers
            ? <div key={i} style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "16px 18px" }}>
                <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, marginBottom: 10 }}>{t.passengerN} {i - drivers + 1}</div>
                <Field label={t.passengerName} value={docs[i]?.name || ""} required onChange={(v) => updateDoc(i, { name: v, nameOnly: true })} />
              </div>
            : <DocUploader key={i} t={t} roleLabel={`${largeCap ? t.driverN : t.guestN} ${i + 1}`} badge={i === 0 ? t.main : null}
                doc={docs[i]} update={(patch) => updateDoc(i, patch)} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 14, padding: "14px 16px", marginTop: 18 }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="lock" size={16} color={C.taupe} /></span>
        <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em" }}>{t.encryption}</p>
      </div>
      {err && <p style={{ color: C.peach, fontFamily: C.sans, fontSize: 12, margin: "14px 0 0", letterSpacing: "0.02em" }}>{err}</p>}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Btn variant="outline" onClick={onBack}>{t.back}</Btn>
        <div style={{ flex: 1 }} />
        <Btn onClick={proceed} disabled={!allDone}>{t.next}</Btn>
      </div>
    </Screen>
  );
}

/* ---------- CONTACT — main guest only (email · phone · emergency) ---------- */
function ContactScreen({ t, res, form, setForm, onBack, onNext, onSwitchLang }) {
  const c = form.contact;
  const [err, setErr] = useStateO("");
  const setC = (patch) => setForm({ ...form, contact: { ...form.contact, ...patch } });
  const mainName = (form.docs?.[0]?.name || "").split(" ")[0] || "";
  const ready = (c.email || "").trim() && (c.phone?.number || "").trim();
  const proceed = () => {
    if (!ready) { setErr(t.requiredFields || "Completa los campos requeridos."); return; }
    onNext();
  };
  return (
    <Screen maxW={520}>
      <TopBar t={t} onSwitchLang={onSwitchLang} />
      <Steps step={2} t={t} />
      <H sub={t.contactSub}>{t.contactTitle}</H>
      <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.grisCalido}`, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
          <span style={{ fontFamily: C.serif, fontSize: 18, color: C.negro }}>{t.mainGuestContact}</span>
          {mainName && <span style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, letterSpacing: "0.02em" }}>· {mainName}</span>}
        </div>
        <Field label={t.email} type="email" value={c.email} required onChange={(v) => setC({ email: v })} />
        <div style={{ marginTop: 16 }}>
          <PhoneInput label={t.phone} value={c.phone} required hint={t.phoneHint} onChange={(v) => setC({ phone: v })} />
        </div>
        <div style={{ marginTop: 16 }}>
          <PhoneInput label={t.emergency} value={c.emergency} hint={t.emergencyHint} onChange={(v) => setC({ emergency: v })} />
        </div>
      </div>
      {err && <p style={{ color: C.peach, fontFamily: C.sans, fontSize: 12, margin: "14px 0 0", letterSpacing: "0.02em" }}>{err}</p>}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Btn variant="outline" onClick={onBack}>{t.back}</Btn>
        <div style={{ flex: 1 }} />
        <Btn onClick={proceed} disabled={!ready}>{t.next}</Btn>
      </div>
    </Screen>
  );
}

/* ---------- HOUSE RULES + FINES · unified accept (Siguiente = Aceptar) ---------- */
function downloadRules() {
  const a = document.createElement("a");
  a.href = "assets/docs/Spacio AM - Normas de Convivencia.pdf";
  a.download = "Spacio AM - Normas de Convivencia.pdf";
  a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
}

function fineAmountLabel(f, t) {
  if (f.custom) return t[f.custom];
  let s = money(f.amount);
  if (f.prefix) s = `${t[f.prefix]} ${s}`;
  if (f.note && f.note !== "graveNote") s = `${s} ${t[f.note]}`;
  return s;
}

function RulesScreen({ t, onBack, onAccept, onSwitchLang }) {
  const [sending, setSending] = useStateO(false);
  const [finesOpen, setFinesOpen] = useStateO(false);
  const rules = RULES[t.code];
  // the 5 fines that occur most often and most easily become a problem
  const topFineIds = ["noise", "extraGuest", "smoking", "lateCheckout", "strangers"];
  const allFines = FINES.flatMap((g) => g.items);
  const topFines = topFineIds.map((id) => allFines.find((f) => f.id === id)).filter(Boolean);
  const go = () => {
    setSending(true);
    setTimeout(() => { setSending(false); onAccept(); }, 1000);
  };
  const fineRow = (f, i) => (
    <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14,
      padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid rgba(236,209,189,.16)" }}>
      <span style={{ fontFamily: C.sans, fontSize: 12, color: "rgba(250,250,250,.86)", letterSpacing: "0.01em", lineHeight: 1.4 }}>{t.fineNames[f.id]}</span>
      <span style={{ fontFamily: C.sans, fontSize: f.custom ? 11.5 : 15, fontWeight: 600, color: C.beigeDeep, flexShrink: 0, textAlign: "right", maxWidth: 150, letterSpacing: "0.01em" }}>{fineAmountLabel(f, t)}</span>
    </div>
  );
  return (
    <Screen maxW={620}>
      <TopBar t={t} onSwitchLang={onSwitchLang} />
      <Steps step={3} t={t} />
      <H sub={t.rulesSub}>{t.rulesTitle}</H>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rules.map((sec) => (
          <div key={sec.n} style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 18, padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
              <span style={{ fontFamily: C.serif, fontSize: 16, color: C.taupe }}>{sec.n}</span>
              <span style={{ fontFamily: C.serif, fontSize: 21, color: C.negro, lineHeight: 1.15 }}>{sec.title}</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {sec.items.map((it, i) => (
                <li key={i} style={{ display: "flex", gap: 10, fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.55, letterSpacing: "0.01em" }}>
                  <span style={{ color: C.peach, flexShrink: 0 }}>—</span><span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* FINES — dark block, minimized to the 5 most common, expandable */}
        <div style={{ background: C.negro, borderRadius: 18, padding: "24px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Sparkle size={13} color={C.peach} />
            <span style={{ fontFamily: C.serif, fontSize: 23, color: C.alabaster }}>{t.finesTitle}</span>
          </div>
          <p style={{ fontFamily: C.sans, fontSize: 11.5, color: "rgba(250,250,250,.6)", margin: "0 0 16px", letterSpacing: "0.02em", lineHeight: 1.5 }}>
            {finesOpen ? t.finesSub : t.finesTopSub}
          </p>

          {!finesOpen && topFines.map((f, i) => fineRow(f, i))}

          {finesOpen && FINES.map((grp) => (
            <div key={grp.group} style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: C.beigeDeep, fontWeight: 600, marginBottom: 4 }}>{t.fineGroupNames[grp.group]}</div>
              {grp.items.map((f, i) => fineRow(f, i))}
            </div>
          ))}

          <button onClick={() => setFinesOpen((v) => !v)} className="sp-btn"
            style={{ marginTop: 16, width: "100%", background: "transparent", color: C.beigeDeep, border: "1px solid rgba(236,209,189,.3)",
              borderRadius: 11, padding: "11px 16px", fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase",
              cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {finesOpen ? t.finesCollapse : t.finesExpand}
            <Icon name={finesOpen ? "chevronUp" : "chevronDown"} size={15} color={C.beigeDeep} />
          </button>
        </div>
      </div>

      {/* download the full house rules — at the very end */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 22 }}>
        <button onClick={downloadRules} className="sp-btn" style={{ background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`,
          borderRadius: 12, padding: "11px 18px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
          <Icon name="download" size={15} color={C.negro} /> {t.downloadFull}
        </button>
        <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, textAlign: "center", margin: "10px 0 0", letterSpacing: "0.03em" }}>{t.downloadNote}</p>
      </div>

      {/* UNIFIED ACCEPT — pressing the button IS the acceptance */}
      <div style={{ background: C.beige, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "18px 20px", marginTop: 22 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="check" size={16} color={C.peach} /></span>
          <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.negro, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em", fontWeight: 500 }}>{t.acceptUnified}</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <Btn variant="outline" onClick={onBack}>{t.back}</Btn>
        <div style={{ flex: 1 }} />
        <Btn onClick={go} disabled={sending}>{sending ? <><Spinner /> {t.sending}</> : t.acceptAndFinish}</Btn>
      </div>
    </Screen>
  );
}

/* ---------- DONE ---------- */
function DoneScreen({ t, onEnter }) {
  return (
    <Screen maxW={480}>
      <div style={{ textAlign: "center", paddingTop: 18 }}>
        <div className="reveal" style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <div className="sp-float"><LogoStamp size={92} /></div>
        </div>
        <div className="reveal" style={{ animationDelay: ".08s" }}><H sub={t.doneSub}>{t.doneTitle}</H></div>
        <p className="reveal" style={{ animationDelay: ".14s", fontFamily: C.serif, fontWeight: 400,
          fontSize: 22, lineHeight: 1.35, color: C.negro, margin: "8px auto 30px", maxWidth: 360, letterSpacing: "-0.01em", textWrap: "balance" }}>
          {t.doneQuote}
        </p>
        <div className="reveal" style={{ animationDelay: ".2s" }}>
          <Btn variant="peach" onClick={onEnter}>{t.enterSpace} <Icon name="arrow" size={17} color={C.white} /></Btn>
        </div>
      </div>
    </Screen>
  );
}

Object.assign(window, { LangScreen, CodeScreen, OverviewScreen, BookerScreen, DocsScreen, ContactScreen, RulesScreen, DoneScreen });
