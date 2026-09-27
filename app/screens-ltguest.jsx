/* Long Term — perfil público del huésped (#lt=<token>) */
function LtAskMissing({ t, faltan, perfil, setPerfil }) {
  const a = t.lt.gAsk;
  if (!faltan || !faltan.length) return null;
  const set = (k, v) => setPerfil((p) => ({ ...p, [k]: v }));
  const row = (k, input) => <label key={k} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
    <span style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, lineHeight: 1.5, letterSpacing: "0.01em" }}>{a[k][0]}</span>{input}</label>;
  return <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 18, borderTop: `1px solid ${C.grisCalido}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: C.sans, fontSize: 12.5, color: C.tierra, letterSpacing: "0.02em" }}>
      <Sparkle size={10} color={C.peach} />{a.intro}</div>
    {faltan.includes("nombre") && row("nombre", <LtInput value={perfil.nombre} onChange={(v) => set("nombre", v)} placeholder={a.nombre[1]} autoComplete="name" />)}
    {faltan.includes("email") && row("email", <LtInput type="email" value={perfil.email} onChange={(v) => set("email", v.trim())} placeholder={a.email[1]} autoComplete="email" />)}
    {faltan.includes("telefono") && row("telefono", <LtInput type="tel" value={perfil.telefono} onChange={(v) => set("telefono", v.replace(/[^\d+ ]/g, ""))} placeholder={a.telefono[1]} autoComplete="tel" />)}
    {faltan.includes("doc") && row("doc", <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={perfil.docTipo || "DPI"} onChange={(e) => set("docTipo", e.target.value)} style={{ ...ltInputStyle, width: "auto", flex: "0 0 auto" }}>
        {["DPI", "Pasaporte", "Otro"].map((d) => <option key={d} value={d}>{d}</option>)}</select>
      <div style={{ flex: "1 1 180px" }}><LtInput value={perfil.docNumero} onChange={(v) => set("docNumero", v)} placeholder={a.doc[1]} /></div>
      <label style={{ flexBasis: "100%", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: C.sans, fontSize: 12, color: C.tierra, cursor: "pointer" }}>
        <Icon name={perfil.docImage ? "check" : "camera"} size={15} color={perfil.docImage ? "#3d6b52" : C.tierra} strokeWidth={1.5} />{perfil.docImage ? a.docPhoto : a.docPhoto + " · " + a.optional}
        <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) ltReadFile(f).then((x) => set("docImage", x.dataUrl)).catch(() => {}); }} />
      </label>
    </div>)}
  </div>;
}

function LtNotice({ t, es, lt, token, onLt, onEarlier }) {
  const ex = t.lt.ex, dias = +lt.avisoDias || 15, today = new Date().toLocaleDateString("en-CA"), min = addDaysIso(today, dias);
  const max = lt.tipoFin === "fecha" && lt.salida ? lt.salida : "";
  const [open, setOpen] = useStateLt(false);
  const [fecha, setFecha] = useStateLt(min);
  const [motivo, setMotivo] = useStateLt("");
  const [busy, setBusy] = useStateLt(false);
  const [err, setErr] = useStateLt("");
  const send = async (cancel) => {
    setBusy(true); setErr("");
    const r = await Backend.ltNotice(token, fecha, motivo, cancel); setBusy(false);
    if (r && r.ok) { onLt(r.lt); setOpen(false); setMotivo(""); }
    else { const e = r && ex.err[r.error]; setErr(typeof e === "function" ? e(dias) : e || (es ? "No se pudo enviar" : "Could not send") + (r && r.error ? " · " + r.error : "")); }
  };
  if (lt.avisoSalida) return <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "rgba(233,130,106,.10)", border: `1px solid ${C.peach}`, borderRadius: 14, padding: "12px 14px" }}>
    <span style={{ flex: "1 1 220px", minWidth: 0 }}>
      <span style={{ display: "block", fontFamily: C.sans, fontSize: 14, color: C.negro, fontWeight: 500 }}>{ex.noticed(ltDate(lt.avisoSalida, es))}</span>
      <span style={{ display: "block", fontFamily: C.sans, fontSize: 12, color: C.tierra, marginTop: 3, lineHeight: 1.5 }}>{ex.noticedSub}</span>
    </span>
    <LtPill small onClick={() => send(true)} disabled={busy}>{busy ? ex.sending : ex.cancelNotice}</LtPill>
    {err && <span style={{ flexBasis: "100%", fontFamily: C.sans, fontSize: 12.5, color: "#C0392B" }}>{err}</span>}
  </div>;
  if (max && max < min) return null;   // el contrato ya termina dentro del plazo de aviso
  if (!open) return <div><LtPill small icon="clock" onClick={() => { setFecha(min); setOpen(true); }}>{ex.noticeBtn}</LtPill></div>;
  return <div style={{ display: "flex", flexDirection: "column", gap: 12, background: C.beige, borderRadius: 14, padding: 16 }}>
    <span style={{ fontFamily: C.serif, fontSize: 22, color: C.negro, lineHeight: 1.1 }}>{ex.noticeTitle}</span>
    <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, textWrap: "pretty" }}>{ex.noticeHint(dias, ltDate(min, es))}</span>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
      <LtField label={ex.date}><LtInput type="date" value={fecha} onChange={setFecha} min={min} max={max || undefined} /></LtField>
      <LtField label={ex.reason} span><textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} style={{ ...ltInputStyle, resize: "vertical" }}></textarea></LtField>
    </div>
    {err && <span style={{ fontFamily: C.sans, fontSize: 12.5, color: "#C0392B" }}>{err}</span>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <LtPill small tone="solid" icon="check" onClick={() => send(false)} disabled={busy || !fecha || fecha < min}>{busy ? ex.sending : ex.send}</LtPill>
      <LtPill small onClick={() => { setOpen(false); setErr(""); }} disabled={busy}>{ex.cancel}</LtPill>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingTop: 12, borderTop: `1px solid ${C.grisCalido}` }}>
      <span style={{ flex: "1 1 220px", fontFamily: C.sans, fontSize: 12.5, color: C.negro, lineHeight: 1.5 }}>{ex.earlier(dias)}</span>
      <LtPill small icon="mail" onClick={() => { setOpen(false); onEarlier(ex.earlierMsg); }}>{ex.earlierBtn}</LtPill>
    </div>
  </div>;
}

function LtGuestScreen({ t, token, onSwitchLang }) {
  const es = t.code === "es", ex = t.lt.ex;
  const [lt, setLt] = useStateLt(() => (Backend.ltGuestCached && Backend.ltGuestCached(token)) || undefined);   // pinta al instante lo último visto
  const [perfil, setPerfil] = useStateLt({ docTipo: "DPI" });
  const [view, setView] = useStateLt(null);
  const [allHist, setAllHist] = useStateLt(false);
  const [draft, setDraft] = useStateLt(null);
  const msgRef = useRefLt(null);
  const load = () => Backend.ltGuest(token).then((r) => setLt((prev) => r && r.ok ? r.lt : (r && r.error === "invalid") || !prev ? null : prev)).catch(() => setLt((prev) => prev || null));
  useEffectLt(() => { load(); const id = setInterval(() => { if (!document.hidden) load(); }, 60000); return () => clearInterval(id); }, [token]);
  const today = new Date().toLocaleDateString("en-CA");
  const pagos = useMemoLt(() => ltDedupPagos(lt), [lt]);
  const open = useMemoLt(() => (lt ? ltOpenPeriods(lt, today) : []), [lt]);
  const history = pagos.filter((p) => (p.estado === "revision" || p.estado === "verificado") && !open.some((o) => o.id === p.id)).slice().reverse();
  const card = { background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 28, padding: "clamp(18px,4vw,28px)", boxShadow: "0 4px 16px rgba(62,63,63,.05)" };
  const h2 = { fontFamily: C.serif, fontWeight: 400, fontSize: 26, color: C.negro, margin: 0, lineHeight: 1.1 };
  const cur = lt ? lt.moneda : "GTQ", fmt = (v) => ltMoney(v, cur);
  const perWord = lt && (lt.frecuencia || "mensual") === "mensual" ? t.lt.perMonth : t.lt.perPeriod;
  const earlier = (text) => { setDraft({ text }); setTimeout(() => { const el = msgRef.current; if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" }); }, 30); };

  const renta = open.filter((p) => p.concepto === "renta"), overdue = renta.filter((p) => p.estado === "vencido" || p.estado === "rechazado");
  const inReview = pagos.filter((p) => p.estado === "revision").length;
  const status = !lt ? null : overdue.length ? { c: "#C0392B", text: ex.overdue(overdue.length, fmt(overdue.reduce((n, p) => n + p.need, 0))) }
    : renta[0] ? { c: C.negro, dot: C.peach, text: ex.next(renta[0].label || ltPeriod(renta[0].periodo, es), fmt(renta[0].need), ltDate(renta[0].vence, es)) }
    : { c: "#3d6b52", text: ex.allClear };
  const exitIso = lt && (lt.avisoSalida || (lt.tipoFin === "fecha" ? lt.salida : ""));
  const daysLeft = exitIso ? Math.round((new Date(exitIso + "T12:00:00") - new Date(today + "T12:00:00")) / 86400000) : null;
  const paidTotal = pagos.filter((p) => p.estado === "verificado").reduce((n, p) => n + (+p.monto || 0), 0);
  const meta = (k, v, sub) => <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
    <span style={{ ...ltLabel, fontSize: 9.5 }}>{k}</span>
    <span style={{ fontFamily: C.sans, fontSize: 14, color: C.negro, fontVariantNumeric: "tabular-nums" }}>{v}</span>
    {sub && <span style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra }}>{sub}</span>}</div>;

  return <div style={{ minHeight: "100vh", background: C.alabaster }}>
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(250,250,250,.88)", backdropFilter: "blur(20px) saturate(120%)", borderBottom: "1px solid rgba(62,63,63,.08)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <LogoMain width={120} />
        <button onClick={onSwitchLang} className="sp-btn" style={{ background: "transparent", border: `1px solid ${C.grisCalido}`, borderRadius: 999, padding: "6px 12px", cursor: "pointer",
          fontFamily: C.sans, fontSize: 10, letterSpacing: "0.16em", color: C.negro, fontWeight: 600 }}>{es ? "EN" : "ES"}</button>
      </div>
    </div>
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(20px,4vh,40px) 20px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
      {lt === undefined && [260, 220, 160].map((h, i) => <div key={i} style={{ height: h, borderRadius: 28, background: C.beige }}></div>)}
      {lt === null && <div style={{ ...card, textAlign: "center", padding: "48px 24px" }}>
        <Icon name="lock" size={24} color={C.tierra} strokeWidth={1.5} />
        <p style={{ fontFamily: C.sans, fontSize: 14, color: C.tierra, margin: "14px 0 0", lineHeight: 1.6 }}>{t.lt.gInvalid}</p>
      </div>}
      {lt && <>
        <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: "clamp(30px,6vw,44px)", color: C.negro, margin: 0, lineHeight: 1.04, letterSpacing: "-0.01em" }}>{t.lt.gHello((lt.guest.nombre || "").split(" ")[0])}</h1>

        <section style={{ ...card, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ ...ltLabel, fontSize: 11, letterSpacing: "0.32em", display: "inline-flex", alignItems: "center", gap: 8 }}><Sparkle size={11} color={C.peach} />{ex.stay}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: C.serif, fontSize: 24, color: C.negro, lineHeight: 1.15 }}>{lt.propertyName}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 16, background: C.beige, borderRadius: 14, padding: "14px 16px" }}>
            {meta(ex.entry, ltDate(lt.entrada, es))}
            {meta(ex.exit, lt.avisoSalida ? ltDate(lt.avisoSalida, es) : lt.tipoFin === "indefinido" ? ex.openEnd : ltDate(lt.salida, es), daysLeft != null && daysLeft >= 0 ? ex.daysLeft(daysLeft) : "")}
            {meta(ex.rent, fmt(lt.monto) + " / " + perWord, (lt.frecuencia || "mensual") === "mensual" ? ex.payDayV(lt.diaCobro) : "")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: C.sans, fontSize: 14, color: status.c, fontWeight: 500 }}>
              {status.dot ? <span style={{ width: 7, height: 7, borderRadius: 999, background: status.dot }}></span> : <Icon name={status.c === "#3d6b52" ? "check" : "alert"} size={16} color={status.c} strokeWidth={1.5} />}
              {status.text}{inReview > 0 && <span style={{ fontWeight: 400, color: C.tierra, fontSize: 12.5 }}>· {ex.inReview(inReview)}</span>}</div>
            {open.length > 0 && <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${C.grisCalido}`, borderRadius: 14 }}>
              {open.map((p, i) => { const luz = p.concepto === "luz", noAmt = luz && !(p.monto > 0); return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderTop: i ? `1px solid ${C.grisCalido}` : "none" }}>
                  <span style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: C.sans, fontSize: 14, color: C.negro, fontWeight: 500 }}>
                      {luz && <Icon name="zap" size={14} color={C.peach} strokeWidth={1.5} />}{(p.label || ltPeriod(p.periodo, es)) + (luz ? " · " + t.lt.luz : "")}</span>
                    <span style={{ display: "block", fontFamily: C.sans, fontSize: 11.5, color: C.tierra, marginTop: 2 }}>
                      {p.paid > 0 ? t.lt.rc.paidPart(fmt(p.paid), fmt(p.need)) : t.lt.due + " " + ltDate(p.vence, es)}{p.estado === "rechazado" && p.motivo ? " · " + p.motivo : ""}</span>
                  </span>
                  <span style={{ fontFamily: C.sans, fontSize: 13.5, color: noAmt ? C.tierra : C.negro, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{noAmt ? t.lt.luzVar : ltMoney(p.monto, p.moneda)}</span>
                  <LtBadge t={t} estado={p.estado} />
                </div>); })}
            </div>}
          </div>
          <LtNotice t={t} es={es} lt={lt} token={token} onLt={setLt} onEarlier={earlier} />
        </section>

        <section style={card}>
          <LtReceiptIntake t={t} es={es} token={token} lt={lt} perfil={perfil} resetPerfil={() => setPerfil({ docTipo: "DPI" })} hideContext
            perfilSlot={<LtAskMissing t={t} faltan={lt.faltan} perfil={perfil} setPerfil={setPerfil} />}
            onDone={(x) => { if (x) setLt(x); else load(); }} />
        </section>

        {history.length > 0 && <section style={card}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <h2 style={h2}>{ex.history}</h2>
            {paidTotal > 0 && <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <span style={{ ...ltLabel, fontSize: 9.5 }}>{ex.paidTotal}</span>
              <span style={{ fontFamily: C.sans, fontSize: 16, color: C.negro, fontVariantNumeric: "tabular-nums" }}>{fmt(paidTotal)}</span></span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(allHist ? history : history.slice(0, 4)).map((p) => { const c = (lt.comprobantes || []).find((x) => x.id === p.compId); return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 0", borderBottom: `1px solid ${C.grisCalido}` }}>
                <span style={{ flex: "1 1 150px", minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: C.sans, fontSize: 14, color: C.negro }}>
                    {p.concepto === "luz" && <Icon name="zap" size={14} color={C.peach} strokeWidth={1.5} />}{p.label || ltPeriod(p.periodo, es)}{p.concepto === "luz" ? " · " + t.lt.luz : ""}</span>
                  {c && (c.fecha || c.referencia) && <span style={{ display: "block", fontFamily: C.sans, fontSize: 11.5, color: C.tierra, marginTop: 2 }}>{[c.banco, c.fecha && ltDate(c.fecha, es), c.referencia].filter(Boolean).join(" · ")}</span>}
                </span>
                <span style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, fontVariantNumeric: "tabular-nums" }}>{p.monto > 0 ? ltMoney(p.monto, p.moneda) : c && c.monto > 0 ? ltMoney(c.monto, p.moneda) : "—"}</span>
                <LtBadge t={t} estado={p.estado} />
                {c && c.files[0] && <button onClick={() => setView(c.files[0])} aria-label={t.lt.viewProof} className="sp-btn"
                  style={{ width: 44, height: 44, borderRadius: 999, border: `1px solid ${C.grisCalido}`, background: C.white, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="eye" size={15} color={C.negro} strokeWidth={1.5} /></button>}
              </div>); })}
          </div>
          {history.length > 4 && <div style={{ marginTop: 14 }}><LtPill small onClick={() => setAllHist((v) => !v)}>{allHist ? ex.showLess : ex.showAll(history.length)}</LtPill></div>}
        </section>}

        <section ref={msgRef} style={card}>
          <h2 style={{ ...h2, marginBottom: 16 }}>{t.lt.gMessages}</h2>
          <LtThread t={t} es={es} mensajes={lt.mensajes} mine="huesped" draft={draft}
            onSend={async (v) => { const r = await Backend.ltGuestMsg(token, v); if (r && r.ok) setLt(r.lt); }} />
        </section>
      </>}
    </div>
    {view && <LtFileView t={t} fileId={view} token={token} onClose={() => setView(null)} />}
  </div>;
}
function addDaysIso(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); }

Object.assign(window, { LtGuestScreen });
