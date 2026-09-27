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

function LtGuestScreen({ t, token, onSwitchLang }) {
  const es = t.code === "es";
  const [lt, setLt] = useStateLt(() => (Backend.ltGuestCached && Backend.ltGuestCached(token)) || undefined);   // pinta al instante lo último visto
  const [concepto, setConcepto] = useStateLt("renta");
  const [modo, setModo] = useStateLt("uno");   // uno · varios
  const [sel, setSel] = useStateLt([]);
  const [files, setFiles] = useStateLt([]);
  const [ref, setRef] = useStateLt("");
  const [fecha, setFecha] = useStateLt(() => new Date().toLocaleDateString("en-CA"));
  const [monto, setMonto] = useStateLt("");
  const [coment, setComent] = useStateLt("");
  const [perfil, setPerfil] = useStateLt({ docTipo: "DPI" });
  const [busy, setBusy] = useStateLt(false);
  const [msg, setMsg] = useStateLt("");
  const [view, setView] = useStateLt(null);
  const fileRef = useRefLt(null);
  const load = () => Backend.ltGuest(token).then((r) => setLt((prev) => r && r.ok ? r.lt : (r && r.error === "invalid") || !prev ? null : prev)).catch(() => setLt((prev) => prev || null));
  useEffectLt(() => { load(); const id = setInterval(() => { if (!document.hidden && !busy) load(); }, 60000); return () => clearInterval(id); }, [token]);
  const today = new Date().toLocaleDateString("en-CA");
  // defensa: si llegan periodos repetidos, se muestra uno por periodo (el más avanzado)
  const pagos = useMemoLt(() => {
    const rk = (p) => ({ verificado: 5, revision: 4, rechazado: 1 }[p.estado] || (p.compId ? 3 : 0)), m = new Map();
    ((lt && lt.pagos) || []).forEach((p) => { const k = p.concepto + "|" + String(p.inicio || p.periodo).slice(0, 10), b = m.get(k); if (!b || rk(p) > rk(b)) m.set(k, p); });
    return [...m.values()].sort((a, b) => String(a.vence).localeCompare(String(b.vence)));
  }, [lt]);
  const isOpen = (p) => ["pendiente", "vencido", "rechazado"].includes(p.estado);
  const payable = (p) => isOpen(p) && (p.concepto !== "luz" || p.inicio <= today);   // luz: sin monto fijo, se paga cuando llega el recibo
  const luzOpen = pagos.filter((p) => p.concepto === "luz" && payable(p));
  const luzWaiting = [];
  const hasLuz = !!(lt && lt.cobraLuz);
  const list = pagos.filter((p) => p.concepto === concepto && payable(p));
  const soon = addDaysIso(today, 10);
  const groups = [
    ["gOverdue", list.filter((p) => p.estado === "vencido" || p.estado === "rechazado")],
    ["gNow", list.filter((p) => p.estado === "pendiente" && p.vence <= soon)],
    ["gNext", list.filter((p) => p.estado === "pendiente" && p.vence > soon)],
  ].filter((g) => g[1].length);
  const history = pagos.filter((p) => p.estado === "revision" || p.estado === "verificado").slice().reverse();
  const totalOpen = pagos.filter(payable).length;
  // preselección: lo vencido + lo que toca ahora (o el siguiente)
  useEffectLt(() => {
    if (!lt) return;
    const now = list.filter((p) => p.estado !== "pendiente" || p.vence <= soon).map((p) => p.id);
    setSel(now.length ? now : list[0] ? [list[0].id] : []);
  }, [lt && lt.code, concepto]);
  useEffectLt(() => {
    const s = pagos.filter((p) => sel.includes(p.id)).reduce((n, p) => n + (+p.monto || 0), 0);
    setMonto(s ? String(Math.round(s * 100) / 100) : "");
  }, [sel.join(",")]);
  useEffectLt(() => { if (lt && concepto === "luz" && !luzOpen.length) setConcepto("renta"); }, [lt]);
  const addFiles = async (fl) => {
    const arr = Array.from(fl || []).slice(0, 5 - files.length);
    for (const f of arr) { try { const x = await ltReadFile(f); setFiles((p) => p.concat(x).slice(0, 5)); } catch (e) { setMsg(es ? "Un archivo pesa más de 8 MB." : "A file is over 8 MB."); } }
    if (fileRef.current) fileRef.current.value = "";
  };
  const submit = async () => {
    if (!sel.length || !files.length) { setMsg(t.lt.gMissing); return; }
    setBusy(true); setMsg("");
    const pf = {}; Object.keys(perfil).forEach((k) => { const v = perfil[k]; if (v && String(v).trim()) pf[k] = v; });
    if (!pf.docNumero) { delete pf.docTipo; }
    const r = await Backend.ltUpload(token, { concepto, periodoIds: sel, files: files.map((f) => ({ name: f.name, dataUrl: f.dataUrl })), referencia: ref, fecha, monto: +monto || 0, comentario: coment,
      perfil: Object.keys(pf).length ? pf : undefined });
    setBusy(false);
    if (r && r.ok) { setLt(r.lt); setFiles([]); setRef(""); setComent(""); setPerfil({ docTipo: "DPI" }); setMsg(t.lt.gDone); }
    else setMsg((es ? "No se pudo enviar" : "Could not send") + (r && r.error ? " · " + r.error : ""));
  };
  const card = { background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 28, padding: "clamp(18px,4vw,28px)", boxShadow: "0 4px 16px rgba(62,63,63,.05)" };
  const h2 = { fontFamily: C.serif, fontWeight: 400, fontSize: 26, color: C.negro, margin: 0, lineHeight: 1.1 };
  const cur = lt ? lt.moneda : "GTQ";
  const perWord = lt && (lt.frecuencia || "mensual") === "mensual" ? t.lt.perMonth : t.lt.perPeriod;

  return <div style={{ minHeight: "100vh", background: C.alabaster }}>
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(250,250,250,.88)", backdropFilter: "blur(20px) saturate(120%)", borderBottom: "1px solid rgba(62,63,63,.08)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <LogoMain width={120} />
        <button onClick={onSwitchLang} className="sp-btn" style={{ background: "transparent", border: `1px solid ${C.grisCalido}`, borderRadius: 999, padding: "6px 12px", cursor: "pointer",
          fontFamily: C.sans, fontSize: 10, letterSpacing: "0.16em", color: C.negro, fontWeight: 600 }}>{es ? "EN" : "ES"}</button>
      </div>
    </div>
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(24px,5vh,48px) 20px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
      {lt === undefined && [220, 160, 200].map((h, i) => <div key={i} style={{ height: h, borderRadius: 28, background: C.beige }}></div>)}
      {lt === null && <div style={{ ...card, textAlign: "center", padding: "48px 24px" }}>
        <Icon name="lock" size={24} color={C.tierra} strokeWidth={1.5} />
        <p style={{ fontFamily: C.sans, fontSize: 14, color: C.tierra, margin: "14px 0 0", lineHeight: 1.6 }}>{t.lt.gInvalid}</p>
      </div>}
      {lt && <>
        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ ...ltLabel, fontSize: 11, letterSpacing: "0.32em", display: "inline-flex", alignItems: "center", gap: 8 }}><Sparkle size={11} color={C.peach} /> {t.lt.gEyebrow}</div>
          <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: "clamp(34px,7vw,52px)", color: C.negro, margin: 0, lineHeight: 1.04, letterSpacing: "-0.01em" }}>{t.lt.gHello((lt.guest.nombre || "").split(" ")[0])}</h1>
          <p style={{ fontFamily: C.sans, fontSize: 14, color: C.tierra, margin: 0, lineHeight: 1.6, letterSpacing: "0.02em", textWrap: "pretty" }}>{t.lt.gSub}</p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 8, fontFamily: C.sans, fontSize: 12.5, color: C.negro }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="pin" size={15} color={C.tierra} strokeWidth={1.5} />{lt.propertyName}</span>
            <span><span style={{ color: C.tierra }}>{t.lt.gSince} </span>{ltDate(lt.entrada, es)}</span>
            <span>{lt.tipoFin === "indefinido" ? <span style={{ color: C.tierra }}>{t.lt.gOpenEnd}</span> : <><span style={{ color: C.tierra }}>{t.lt.gUntil} </span>{ltDate(lt.salida, es)}</>}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{ltMoney(lt.monto, cur)} / {perWord}</span>
          </div>
        </header>

        <section style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <h2 style={h2}>{t.lt.gPending}</h2>
            {hasLuz && luzOpen.length > 0 && <div style={{ display: "inline-flex", background: C.beige, borderRadius: 999, padding: 3 }}>
              {[["renta", t.lt.rent], ["luz", t.lt.luz]].map(([k, l]) => <button key={k} onClick={() => setConcepto(k)} className="sp-btn"
                style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "8px 16px", minHeight: 36, fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
                  background: concepto === k ? C.white : "transparent", color: C.negro, boxShadow: concepto === k ? "0 1px 2px rgba(62,63,63,.08)" : "none" }}>{l}</button>)}
            </div>}
          </div>
          {!totalOpen && <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: C.sans, fontSize: 14, color: "#3d6b52" }}><Icon name="check" size={18} color="#3d6b52" strokeWidth={1.5} />{t.lt.gAllClear}</div>}
          {concepto === "renta" && list.length > 1 && <div style={{ display: "inline-flex", alignSelf: "flex-start", background: C.beige, borderRadius: 999, padding: 3, marginBottom: 16 }}>
            {[["uno", t.lt.bOne], ["varios", t.lt.bMany]].map(([k, l]) => <button key={k} onClick={() => setModo(k)} className="sp-btn"
              style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "8px 16px", minHeight: 36, fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
                background: modo === k ? C.white : "transparent", color: C.negro, boxShadow: modo === k ? "0 1px 2px rgba(62,63,63,.08)" : "none" }}>{l}</button>)}
          </div>}
          {concepto === "renta" && modo === "varios" && list.length > 1 && <LtBatch t={t} es={es} token={token} cur={cur} periods={list} onDone={(x) => { if (x) setLt(x); else load(); }} />}
          {list.length > 0 && !(concepto === "renta" && modo === "varios" && list.length > 1) && <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {concepto === "luz" && <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, display: "flex", gap: 8, alignItems: "center" }}><Icon name="zap" size={15} color={C.peach} strokeWidth={1.5} />{t.lt.gLuzNote}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <span style={ltLabel}>{t.lt.gSelect}</span>
              {groups.map(([gk, items]) => <div key={gk} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: C.sans, fontSize: 11, color: gk === "gOverdue" ? "#C0392B" : C.tierra, letterSpacing: "0.06em" }}>{t.lt[gk]} · {items.length}</span>
                {items.map((p) => { const on = sel.includes(p.id); return (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${on ? C.negro : C.grisCalido}`, borderRadius: 14, padding: "12px 14px", cursor: "pointer", minHeight: 44, transition: "border-color .18s " + C.ease }}>
                    <input type="checkbox" checked={on} onChange={() => setSel((s) => on ? s.filter((x) => x !== p.id) : s.concat(p.id))} style={{ width: 18, height: 18, accentColor: C.negro, flexShrink: 0 }} />
                    <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: C.sans, fontSize: 14, color: C.negro, fontWeight: 500 }}>{p.label || ltPeriod(p.periodo, es)}</span>
                      <span style={{ display: "block", fontFamily: C.sans, fontSize: 11.5, color: C.tierra, marginTop: 2 }}>{t.lt.due} {ltDate(p.vence, es)}{p.estado === "rechazado" && p.motivo ? " · " + p.motivo : ""}</span>
                    </span>
                    <span style={{ fontFamily: C.sans, fontSize: 13.5, color: p.concepto === "luz" && !(p.monto > 0) ? C.tierra : C.negro, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{p.concepto === "luz" && !(p.monto > 0) ? t.lt.luzVar : ltMoney(p.monto, p.moneda)}</span>
                    {p.estado !== "pendiente" && <LtBadge t={t} estado={p.estado} />}
                  </label>); })}
              </div>)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={ltLabel}>{t.lt.gFiles}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {files.map((f, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.beige, borderRadius: 10, padding: "6px 8px 6px 10px", fontFamily: C.sans, fontSize: 12, color: C.negro, maxWidth: "100%" }}>
                  {f.isImage ? <img src={f.dataUrl} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 6 }} /> : <Icon name="factura" size={16} color={C.tierra} strokeWidth={1.5} />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{f.name}</span>
                  <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label="remove" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "inline-flex" }}><Icon name="x" size={14} color={C.tierra} /></button>
                </span>)}
                {files.length < 5 && <LtPill small icon="upload" onClick={() => fileRef.current && fileRef.current.click()}>{t.lt.gAddFile}</LtPill>}
                <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
              <LtField label={t.lt.ref}><LtInput value={ref} onChange={setRef} /></LtField>
              <LtField label={t.lt.payDate}><LtInput type="date" value={fecha} onChange={setFecha} max={today} /></LtField>
              <LtField label={t.lt.paid + " · " + (cur === "USD" ? "US$" : "Q")}><LtInput type="number" value={monto} onChange={setMonto} inputMode="decimal" /></LtField>
              <LtField label={t.lt.comment} span><textarea value={coment} onChange={(e) => setComent(e.target.value)} rows={2} style={{ ...ltInputStyle, resize: "vertical" }}></textarea></LtField>
            </div>
            <LtAskMissing t={t} faltan={lt.faltan} perfil={perfil} setPerfil={setPerfil} />
            <div><LtPill tone="solid" icon="upload" onClick={submit} disabled={busy}>{busy ? t.lt.gSending : t.lt.gUpload}</LtPill></div>
          </div>}
          {hasLuz && luzWaiting.length > 0 && <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {luzWaiting.map((p) => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: C.sans, fontSize: 12.5, color: C.tierra }}>
              <Icon name="zap" size={14} color={C.earth} strokeWidth={1.5} />{t.lt.luz} · {p.label || ltPeriod(p.periodo, es)} · {t.lt.gLuzWait}</div>)}
          </div>}
          {msg && <div style={{ marginTop: 14, fontFamily: C.sans, fontSize: 13, color: msg === t.lt.gDone ? "#3d6b52" : "#C0392B" }}>{msg}</div>}
        </section>

        {history.length > 0 && <section style={card}>
          <h2 style={{ ...h2, marginBottom: 16 }}>{t.lt.gHistory}</h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {history.map((p) => { const c = (lt.comprobantes || []).find((x) => x.id === p.compId); return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 0", borderBottom: `1px solid ${C.grisCalido}` }}>
                <span style={{ flex: "1 1 150px", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: C.sans, fontSize: 14, color: C.negro }}>
                  {p.concepto === "luz" && <Icon name="zap" size={14} color={C.peach} strokeWidth={1.5} />}{p.label || ltPeriod(p.periodo, es)}{p.concepto === "luz" ? " · " + t.lt.luz : ""}</span>
                <span style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, fontVariantNumeric: "tabular-nums" }}>{p.monto > 0 ? ltMoney(p.monto, p.moneda) : c && c.monto > 0 ? ltMoney(c.monto, p.moneda) : "—"}</span>
                <LtBadge t={t} estado={p.estado} />
                {c && c.files[0] && <button onClick={() => setView(c.files[0])} aria-label={t.lt.viewProof} className="sp-btn"
                  style={{ width: 44, height: 44, borderRadius: 999, border: `1px solid ${C.grisCalido}`, background: C.white, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="eye" size={15} color={C.negro} strokeWidth={1.5} /></button>}
              </div>); })}
          </div>
        </section>}

        <section style={card}>
          <h2 style={{ ...h2, marginBottom: 16 }}>{t.lt.gMessages}</h2>
          <LtThread t={t} es={es} mensajes={lt.mensajes} mine="huesped" busy={busy}
            onSend={async (v) => { const r = await Backend.ltGuestMsg(token, v); if (r && r.ok) setLt(r.lt); }} />
        </section>
      </>}
    </div>
    {view && <LtFileView t={t} fileId={view} token={token} onClose={() => setView(null)} />}
  </div>;
}
function addDaysIso(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); }

Object.assign(window, { LtGuestScreen });
