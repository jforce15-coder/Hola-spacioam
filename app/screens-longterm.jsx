/* Long Term — pestaña del panel de administración */
function ltEmpty() {
  return { code: "", propertyCode: "", propertyName: "", entrada: new Date().toLocaleDateString("en-CA"), tipoFin: "fecha", salida: "", monto: "", moneda: "GTQ", diaCobro: new Date().getDate(), notas: "", frecuencia: "mensual", cadaDias: 30, cobraLuz: false,
    guest: { nombre: "", telefono: "", email: "", docTipo: "DPI", docNumero: "" } };
}

function LtKpi({ value, label, tone }) {
  return <div style={{ background: C.beige, borderRadius: 14, padding: "16px 18px", minWidth: 0 }}>
    <div className="t-num" style={{ fontFamily: C.sans, fontSize: 28, fontWeight: 600, lineHeight: 1, color: tone || C.negro, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ ...ltLabel, fontSize: 9.5, marginTop: 8 }}>{label}</div>
  </div>;
}

function LtEditModal({ t, es, initial, properties, onClose, onSaved }) {
  const [f, setF] = useStateLt(() => JSON.parse(JSON.stringify(initial || ltEmpty())));
  const [busy, setBusy] = useStateLt(false);
  const [err, setErr] = useStateLt("");
  const busyRef = React.useRef(false);
  const reqId = React.useRef("r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));   // mismo id en reintentos → nunca duplica
  const close = () => { if (!busyRef.current) onClose(); };
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setG = (k, v) => setF((p) => ({ ...p, guest: { ...p.guest, [k]: v } }));
  const valid = f.propertyName && f.entrada && +f.monto > 0 && (f.tipoFin === "indefinido" || f.salida > f.entrada) && (f.frecuencia !== "personalizado" || +f.cadaDias > 0);
  const save = async () => {
    if (!valid) { setErr(es ? "Completa propiedad, fechas y monto." : "Fill in property, dates and amount."); return; }
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setErr("");
    const r = await Backend.ltSave({ ...f, reqId: reqId.current, monto: +f.monto, diaCobro: Math.max(1, Math.min(31, +f.diaCobro || 1)), cadaDias: Math.max(1, +f.cadaDias || 30) });
    busyRef.current = false; setBusy(false);
    if (!r || !r.ok) { setErr((es ? "No se pudo confirmar el guardado" : "Could not confirm the save") + (r && r.error ? " · " + r.error : "") + ". " + t.lt.retrySafe); return; }
    onSaved(r, !initial);
  };
  const g2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 };
  return <LtModal title={initial ? t.lt.edit + " · " + initial.code : t.lt.newRes} onClose={close} wide
    footer={<><LtPill onClick={close} disabled={busy}>{t.lt.cancel}</LtPill><LtPill tone="solid" icon="check" onClick={save} disabled={busy}>{busy ? t.lt.saving : t.lt.save}</LtPill></>}>
    <div style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
      {busy && <div style={{ position: "absolute", inset: -8, zIndex: 3, background: "rgba(255,255,255,.82)", borderRadius: 14, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 320, textAlign: "center" }}>
          <div style={{ width: 160, height: 3, borderRadius: 999, background: C.beige, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, width: "40%", borderRadius: 999, background: C.peach, animation: "lt-slide 1.2s " + C.ease + " infinite" }}></div></div>
          <div style={{ fontFamily: C.sans, fontSize: 13, color: C.negro }}>{t.lt.savingLong}</div>
          <div style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, lineHeight: 1.5 }}>{t.lt.savingHint}</div>
        </div>
        <style>{"@keyframes lt-slide{0%{left:-40%}100%{left:100%}}"}</style>
      </div>}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...ltLabel, color: C.negro }}>{t.lt.stay}</div>
        <div style={g2}>
          <LtField label={t.lt.prop} span>
            <select value={f.propertyName} onChange={(e) => set("propertyName", e.target.value)} style={ltInputStyle}>
              <option value="">—</option>
              {properties.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </LtField>
          <LtField label={t.lt.entry}><LtInput type="date" value={f.entrada} onChange={(v) => set("entrada", v)} /></LtField>
          <LtField label={t.lt.endType}>
            <select value={f.tipoFin} onChange={(e) => set("tipoFin", e.target.value)} style={ltInputStyle}>
              <option value="fecha">{t.lt.endDate}</option><option value="indefinido">{t.lt.endOpen}</option>
            </select>
          </LtField>
          {f.tipoFin === "fecha" && <LtField label={t.lt.exit}><LtInput type="date" value={f.salida} onChange={(v) => set("salida", v)} min={f.entrada} /></LtField>}
          <LtField label={t.lt.amount}><LtInput type="number" value={f.monto} onChange={(v) => set("monto", v)} min="0" inputMode="decimal" /></LtField>
          <LtField label={t.lt.currency}>
            <select value={f.moneda} onChange={(e) => set("moneda", e.target.value)} style={ltInputStyle}><option value="GTQ">GTQ · Q</option><option value="USD">USD · US$</option></select>
          </LtField>
          <LtField label={t.lt.freq}>
            <select value={f.frecuencia || "mensual"} onChange={(e) => set("frecuencia", e.target.value)} style={ltInputStyle}>
              <option value="mensual">{t.lt.fMensual}</option><option value="quincenal">{t.lt.fQuincenal}</option><option value="semanal">{t.lt.fSemanal}</option><option value="personalizado">{t.lt.fCustom}</option>
            </select>
          </LtField>
          {(f.frecuencia || "mensual") === "mensual"
            ? <LtField label={t.lt.payDay}><LtInput type="number" value={f.diaCobro} onChange={(v) => set("diaCobro", v)} min="1" max="31" inputMode="numeric" />
                <span style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, lineHeight: 1.5 }}>{t.lt.payDayHint(Math.max(1, Math.min(31, +f.diaCobro || 1)))}</span></LtField>
            : f.frecuencia === "personalizado" && <LtField label={t.lt.everyDays}><LtInput type="number" value={f.cadaDias} onChange={(v) => set("cadaDias", v)} min="1" /></LtField>}
          <label style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "flex-start", background: f.cobraLuz ? "rgba(233,130,106,.08)" : C.beige, border: `1px solid ${f.cobraLuz ? C.peach : "transparent"}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer" }}>
            <input type="checkbox" checked={!!f.cobraLuz} onChange={(e) => set("cobraLuz", e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: C.negro }} />
            <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: C.sans, fontSize: 13.5, color: C.negro, fontWeight: 500 }}>{t.lt.luzToggle}</span>
              <span style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, lineHeight: 1.55 }}>{t.lt.luzHint}</span>
            </span>
          </label>
          <LtField label={t.lt.notes} span>
            <textarea value={f.notas} onChange={(e) => set("notas", e.target.value)} rows={2} style={{ ...ltInputStyle, resize: "vertical" }}></textarea>
          </LtField>
        </div>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...ltLabel, color: C.negro }}>{t.lt.guest}</div>
        <div style={g2}>
          <LtField label={t.lt.name} span><LtInput value={f.guest.nombre} onChange={(v) => setG("nombre", v)} /></LtField>
          <LtField label={t.lt.phone}><LtInput type="tel" value={f.guest.telefono} onChange={(v) => setG("telefono", v.replace(/[^\d+]/g, ""))} placeholder="50255555555" /></LtField>
          <LtField label={t.lt.email}><LtInput type="email" value={f.guest.email} onChange={(v) => setG("email", v.trim())} /></LtField>
          <LtField label={t.lt.docType}>
            <select value={f.guest.docTipo} onChange={(e) => setG("docTipo", e.target.value)} style={ltInputStyle}>
              {["DPI", "Pasaporte", "Otro"].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </LtField>
          <LtField label={t.lt.docNum}><LtInput value={f.guest.docNumero} onChange={(v) => setG("docNumero", v)} /></LtField>
          <LtField label={t.lt.docImg} span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => { const fl = e.target.files && e.target.files[0]; if (fl) ltReadFile(fl).then((x) => setG("docImage", x.dataUrl)).catch(() => setErr(es ? "Archivo de más de 8 MB." : "File over 8 MB.")); }}
              style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra }} />
          </LtField>
        </div>
      </section>
      {err && <div style={{ fontFamily: C.sans, fontSize: 12.5, color: "#C0392B" }}>{err}</div>}
    </div>
  </LtModal>;
}

function LtSendModal({ t, es, lt, onClose, onToast, onSent }) {
  const [url, setUrl] = useStateLt("");
  const [canal, setCanal] = useStateLt(lt.guest.email ? "email" : "whatsapp");
  const [txt, setTxt] = useStateLt("");
  const [busy, setBusy] = useStateLt(false);
  useEffectLt(() => { (lt.url ? Promise.resolve({ url: lt.url }) : Backend.ltLink(lt.code)).then((r) => { const u = (r && r.url) || ""; setUrl(u); setTxt(t.lt.linkMsg((lt.guest.nombre || "").split(" ")[0], lt.propertyName, u)); }); }, []);
  const send = async () => {
    setBusy(true);
    if (canal === "whatsapp") window.open("https://wa.me/" + String(lt.guest.telefono || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(txt), "_blank");
    const r = await Backend.ltSend(lt.code, canal, txt);
    setBusy(false);
    onToast(r && r.ok ? t.lt.sent + (r.to ? " · " + r.to : "") : (es ? "No se pudo enviar" : "Could not send") + (r && r.error ? " · " + r.error : ""));
    if (r && r.ok) { onSent && onSent(); onClose(); }
  };
  return <LtModal title={t.lt.sendTitle} onClose={onClose}
    footer={<><LtPill onClick={onClose}>{t.lt.cancel}</LtPill><LtPill tone="solid" icon={canal === "whatsapp" ? "whatsapp" : "mail"} onClick={send} disabled={busy || !url}>{t.lt.send}</LtPill></>}>
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <LtField label={t.lt.channel}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["email", "mail", lt.guest.email], ["whatsapp", "whatsapp", lt.guest.telefono]].map(([k, ic, to]) =>
            <LtPill key={k} small icon={ic} tone={canal === k ? "solid" : "ghost"} disabled={!to} onClick={() => setCanal(k)}>{k === "email" ? t.lt.email : "WhatsApp"}{to ? " · " + to : ""}</LtPill>)}
        </div>
      </LtField>
      <LtField label={t.lt.msgLabel}>
        <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={6} style={{ ...ltInputStyle, resize: "vertical", lineHeight: 1.55 }}></textarea>
      </LtField>
    </div>
  </LtModal>;
}

function ltGroups(pagos) {
  const m = new Map();
  (pagos || []).forEach((p) => { const k = p.periodo; if (!m.has(k)) m.set(k, { key: k, items: [] }); m.get(k).items.push(p); });
  return [...m.values()];
}

function LtPayRow({ t, es, p, first, c, busy, onFile, onVerify, onAdjust }) {
  const [adj, setAdj] = useStateLt(false);
  const [monto, setMonto] = useStateLt(String(p.monto || ""));
  const [vence, setVence] = useStateLt(p.vence);
  const [rej, setRej] = useStateLt(false);
  const [motivo, setMotivo] = useStateLt("");
  const isLuz = p.concepto === "luz", noAmt = isLuz && !(p.monto > 0);
  return <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, borderTop: first ? "none" : `1px dashed ${C.grisCalido}`, background: isLuz ? "#FCFBF9" : C.white }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 170px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLuz && <Icon name="zap" size={14} color={C.peach} strokeWidth={1.5} />}
          <span style={{ fontFamily: C.sans, fontSize: isLuz ? 13 : 14, color: C.negro, fontWeight: 500 }}>{isLuz ? t.lt.luz : (p.label || ltPeriod(p.periodo, es))}</span>
          {p.ajustado && <span style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: C.tierra }}>· {t.lt.adjusted}</span>}
        </div>
        <div style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, marginTop: 3 }}>{t.lt.due} {ltDate(p.vence, es)}</div>
      </div>
      <span style={{ fontFamily: C.sans, fontSize: 14, color: noAmt ? C.tierra : C.negro, fontVariantNumeric: "tabular-nums" }}>{noAmt ? t.lt.luzVar : ltMoney(p.monto, p.moneda)}</span>
      <LtBadge t={t} estado={p.estado} />
      {(p.estado === "pendiente" || p.estado === "vencido" || p.estado === "rechazado") && !adj &&
        <LtPill small icon="edit" onClick={() => { setMonto(String(p.monto || "")); setVence(p.vence); setAdj(true); }}>{t.lt.adjust}</LtPill>}
    </div>
    {adj && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", background: C.beige, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ flex: "1 1 140px" }}><LtField label={t.lt.amount + " · " + (p.moneda === "USD" ? "US$" : "Q")}><LtInput type="number" value={monto} onChange={setMonto} inputMode="decimal" min="0" /></LtField></div>
      <div style={{ flex: "1 1 160px" }}><LtField label={t.lt.due}><LtInput type="date" value={vence} onChange={setVence} /></LtField></div>
      <LtPill small onClick={() => setAdj(false)}>{t.lt.cancel}</LtPill>
      <LtPill small tone="solid" icon="check" disabled={busy || !(+monto >= 0)} onClick={() => { onAdjust(monto, vence); setAdj(false); }}>{t.lt.apply}</LtPill>
    </div>}
    {c && <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", background: C.beige, borderRadius: 10, padding: "10px 12px", fontFamily: C.sans, fontSize: 12, color: C.negro }}>
      {c.referencia && <span><span style={{ color: C.tierra }}>{t.lt.ref} </span>{c.referencia}</span>}
      {c.fecha && <span><span style={{ color: C.tierra }}>{t.lt.payDate} </span>{ltDate(c.fecha, es)}</span>}
      {c.monto > 0 && <span><span style={{ color: C.tierra }}>{t.lt.paid} </span>{ltMoney(c.monto, p.moneda)}</span>}
      {c.periodos.length > 1 && <span style={{ color: C.tierra }}>{c.periodos.length} {es ? "periodos" : "periods"}</span>}
      {c.comentario && <span style={{ flexBasis: "100%", color: C.tierra }}>{c.comentario}</span>}
      {c.files.map((fid, i) => <LtPill key={fid} small icon="eye" onClick={() => onFile(fid)}>{t.lt.viewProof}{c.files.length > 1 ? " " + (i + 1) : ""}</LtPill>)}
    </div>}
    {p.estado === "rechazado" && p.motivo && <div style={{ fontFamily: C.sans, fontSize: 12, color: "#C0392B" }}>{p.motivo}</div>}
    {p.estado === "revision" && (rej
      ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px" }}><LtInput value={motivo} onChange={setMotivo} placeholder={t.lt.reason} /></div>
          <LtPill small onClick={() => setRej(false)}>{t.lt.cancel}</LtPill>
          <LtPill small tone="danger" disabled={busy || !motivo.trim()} onClick={() => { onVerify("rechazado", motivo); setRej(false); }}>{t.lt.reject}</LtPill>
        </div>
      : <div style={{ display: "flex", gap: 8 }}>
          <LtPill small tone="solid" icon="check" disabled={busy} onClick={() => onVerify("verificado")}>{t.lt.verify}</LtPill>
          <LtPill small tone="danger" disabled={busy} onClick={() => { setRej(true); setMotivo(""); }}>{t.lt.reject}</LtPill>
        </div>)}
  </div>;
}

/* copia en el mismo gesto del clic (Safari/iPad bloquea el portapapeles después de un await) */
function ltCopy(text) {
  let ok = false;
  try {
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length); ok = document.execCommand("copy"); ta.remove();
  } catch (e) {}
  try { if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).catch(() => {}); ok = true; } } catch (e) {}
  return ok;
}

function LtLinkBox({ t, url, onToast }) {
  return <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: C.beige, borderRadius: 14, padding: "10px 12px" }}>
    <span style={{ ...ltLabel, fontSize: 9.5, flexBasis: "100%" }}>{t.lt.linkReady}</span>
    <input readOnly value={url} onFocus={(e) => e.target.select()} style={{ ...ltInputStyle, flex: "1 1 240px", fontSize: 12.5, padding: "9px 12px", background: C.white }} />
    <LtPill small icon="link" onClick={() => onToast(ltCopy(url) ? t.lt.copied : t.lt.copyFail)}>{t.lt.copyAgain}</LtPill>
  </div>;
}

function LtDetail({ t, es, code, seed, onClose, onChanged, onEdit, onToast, onDeleted }) {
  const [confirmDel, setConfirmDel] = useStateLt(false);
  const [lt, setLt] = useStateLt(() => (seed && Array.isArray(seed.pagos) ? seed : null));   // del listado: abre al instante
  const [linkBox, setLinkBox] = useStateLt("");
  const [busy, setBusy] = useStateLt(false);
  const [file, setFile] = useStateLt(null);
  const [sendOpen, setSendOpen] = useStateLt(false);
  const [confirmRegen, setConfirmRegen] = useStateLt(false);
  const [sec, setSec] = useStateLt("periods");
  const [loadErr, setLoadErr] = useStateLt("");
  const load = () => Backend.ltGet(code).then((r) => { if (r && r.ok) { setLt(r.lt); setLoadErr(""); } else setLoadErr((r && r.error) || "backend-error"); });
  useEffectLt(() => {
    if (!lt) load();
    if (seed && seed.unread) Backend.ltRead(code).then(() => onChanged && onChanged({ ...seed, unread: 0 }));
  }, [code]);
  const apply = (r) => { if (r && r.ok && r.lt) { setLt(r.lt); onChanged && onChanged(r.lt); } else if (r && !r.ok) onToast((es ? "No se pudo" : "Failed") + (r.error ? " · " + r.error : "")); };
  const verify = async (p, estado, m) => { setBusy(true); apply(await Backend.ltVerify(code, p.id, estado, m || "")); setBusy(false); };
  const copyLink = async () => {
    if (lt.url) { setLinkBox(lt.url); onToast(ltCopy(lt.url) ? t.lt.copied : t.lt.copyFail); return; }
    const r = await Backend.ltLink(code);
    if (r && r.url) { setLinkBox(r.url); setLt((p) => ({ ...p, url: r.url })); } else onToast((es ? "No se pudo obtener el enlace" : "Could not get the link") + (r && r.error ? " · " + r.error : ""));
  };
  const regen = async () => {
    setConfirmRegen(false); const r = await Backend.ltToken(code);
    if (r && r.url) { setLinkBox(r.url); const n = { ...lt, url: r.url }; setLt(n); onChanged && onChanged(n); } else onToast((es ? "No se pudo" : "Failed") + (r && r.error ? " · " + r.error : ""));
  };
  const endStay = async () => { setBusy(true); apply(await Backend.ltEnd(code, lt.estado === "terminada")); setBusy(false); };
  const del = async () => {
    setBusy(true); const r = await Backend.ltDelete(code); setBusy(false);
    if (r && r.ok) { onToast(t.lt.deleted + " · " + code); onDeleted && onDeleted(code); }
    else onToast((es ? "No se pudo eliminar" : "Could not delete") + (r && r.error ? " · " + r.error : ""));
  };
  if (!lt) return <LtModal title={code} onClose={onClose} wide>{loadErr
    ? <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}><span style={{ fontFamily: C.sans, fontSize: 13, color: "#C0392B" }}>{loadErr}</span><LtPill small icon="refresh" onClick={() => { setLoadErr(""); load(); }}>{es ? "Reintentar" : "Retry"}</LtPill></div>
    : <div style={{ height: 280, borderRadius: 14, background: C.beige }}></div>}</LtModal>;
  const compOf = (p) => (lt.comprobantes || []).find((c) => c.id === p.compId);
  const tabs = [["periods", t.lt.periods], ["messages", t.lt.messages + (lt.unread ? " · " + lt.unread : "")], ["log", t.lt.log]];
  const meta = (k, v) => v ? <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}><span style={{ ...ltLabel, fontSize: 9.5 }}>{k}</span>
    <span style={{ fontFamily: C.sans, fontSize: 13.5, color: C.negro, overflowWrap: "anywhere" }}>{v}</span></div> : null;
  return <LtModal title={lt.guest.nombre || lt.code} onClose={onClose} wide>
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <LtBadge t={t} estado={lt.estado} />
        <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, letterSpacing: "0.04em" }}>{lt.code} · {lt.propertyName}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 16, background: C.beige, borderRadius: 14, padding: "16px 18px" }}>
        {meta(t.lt.entry, ltDate(lt.entrada, es))}
        {meta(t.lt.exit, lt.tipoFin === "indefinido" ? t.lt.endOpen : ltDate(lt.salida, es))}
        {meta(t.lt.amount, ltMoney(lt.monto, lt.moneda))}
        {meta(t.lt.freq, ({ mensual: t.lt.fMensual, quincenal: t.lt.fQuincenal, semanal: t.lt.fSemanal, personalizado: t.lt.fCustom + " · " + lt.cadaDias + (es ? " días" : " days") })[lt.frecuencia || "mensual"] + ((lt.frecuencia || "mensual") === "mensual" ? " · " + (es ? "día " : "day ") + lt.diaCobro : ""))}
        {lt.cobraLuz ? meta(t.lt.luz, t.lt.luzToggle) : null}
        {meta(t.lt.phone, lt.guest.telefono)}
        {meta(t.lt.email, lt.guest.email)}
        {meta(lt.guest.docTipo || t.lt.docNum, lt.guest.docNumero)}
        {lt.notas ? <div style={{ gridColumn: "1 / -1" }}>{meta(t.lt.notes, lt.notas)}</div> : null}
        {(lt.faltan || []).length > 0 && <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ ...ltLabel, fontSize: 9.5, color: "#B54D36" }}>{t.lt.missingData}</span>
          {lt.faltan.map((k) => <span key={k} style={{ fontFamily: C.sans, fontSize: 11.5, color: C.negro, background: C.white, border: "1px solid rgba(242,117,90,.45)", borderRadius: 999, padding: "3px 10px" }}>
            {({ nombre: t.lt.name, email: t.lt.email, telefono: t.lt.phone, doc: t.lt.docNum })[k]}</span>)}
        </div>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <LtPill small icon="link" onClick={copyLink} disabled={lt.estado === "terminada"}>{t.lt.copyLink}</LtPill>
        {lt.url && lt.estado !== "terminada" && <LtPill small icon="eye" onClick={() => window.open(lt.url, "_blank", "noopener")}>{es ? "Ver como huésped" : "View as guest"}</LtPill>}
        <LtPill small icon="mail" tone="accent" onClick={() => setSendOpen(true)} disabled={lt.estado === "terminada"}>{t.lt.sendLink}</LtPill>
        <LtPill small icon="refresh" onClick={() => setConfirmRegen(true)} disabled={lt.estado === "terminada"}>{t.lt.regen}</LtPill>
        {lt.guest.docFileId && <LtPill small icon="image" onClick={() => setFile(lt.guest.docFileId)}>{t.lt.docImg}</LtPill>}
        <LtPill small icon="edit" onClick={() => onEdit(lt)}>{t.lt.edit}</LtPill>
        <LtPill small tone={lt.estado === "terminada" ? "ghost" : "danger"} onClick={endStay} disabled={busy}>{lt.estado === "terminada" ? t.lt.reopen : t.lt.end}</LtPill>
        <LtPill small icon="trash" tone="danger" onClick={() => setConfirmDel(true)} disabled={busy}>{t.lt.del}</LtPill>
      </div>
      {linkBox && <LtLinkBox t={t} url={linkBox} onToast={onToast} />}
      {confirmDel && <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: "1px solid rgba(192,57,43,.35)", background: "rgba(192,57,43,.05)", borderRadius: 14, padding: "12px 14px" }}>
        <span style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, flex: "1 1 220px", lineHeight: 1.5 }}>{t.lt.delWarn}</span>
        <LtPill small onClick={() => setConfirmDel(false)} disabled={busy}>{t.lt.cancel}</LtPill>
        <LtPill small tone="danger" onClick={del} disabled={busy}>{busy ? t.lt.deleting : t.lt.delConfirm}</LtPill>
      </div>}
      {confirmRegen && <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: `1px solid ${C.peach}`, background: "rgba(233,130,106,.08)", borderRadius: 14, padding: "12px 14px" }}>
        <span style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, flex: "1 1 200px" }}>{t.lt.regenWarn}</span>
        <LtPill small onClick={() => setConfirmRegen(false)}>{t.lt.cancel}</LtPill><LtPill small tone="solid" onClick={regen}>{t.lt.regen}</LtPill>
      </div>}

      <div style={{ display: "flex", gap: 22, borderBottom: `1px solid ${C.grisCalido}` }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => setSec(k)} style={{ background: "none", border: "none", padding: "0 0 10px", cursor: "pointer", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.16em",
          textTransform: "uppercase", fontWeight: 600, color: sec === k ? C.negro : C.tierra, borderBottom: `2px solid ${sec === k ? C.peach : "transparent"}`, marginBottom: -1 }}>{l}</button>)}
      </div>

      {sec === "periods" && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ltGroups(lt.pagos).map((grp) => <div key={grp.key} style={{ border: `1px solid ${C.grisCalido}`, borderRadius: 14, overflow: "hidden" }}>
          {grp.items.map((p, i) => <LtPayRow key={p.id} t={t} es={es} p={p} first={i === 0} c={compOf(p)} busy={busy} onFile={setFile}
            onVerify={(estado, m) => verify(p, estado, m)}
            onAdjust={async (monto, vence) => { setBusy(true); apply(await Backend.ltSetPeriod(code, p.id, monto, vence)); setBusy(false); }} />)}
        </div>)}
      </div>}

      {sec === "messages" && <LtThread t={t} es={es} mensajes={lt.mensajes} mine="admin" busy={busy}
        onSend={async (v) => { setBusy(true); apply(await Backend.ltAdminMsg(code, v)); setBusy(false); }} />}

      {sec === "log" && <div style={{ display: "flex", flexDirection: "column" }}>
        {!(lt.envios || []).length && <div style={{ fontFamily: C.sans, fontSize: 13, color: C.tierra }}>{t.lt.noLog}</div>}
        {(lt.envios || []).map((e) => <div key={e.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 0", borderBottom: `1px solid ${C.grisCalido}`, fontFamily: C.sans, fontSize: 12.5, color: C.negro }}>
          <Icon name={e.canal === "whatsapp" ? "whatsapp" : "mail"} size={15} color={C.tierra} strokeWidth={1.5} />
          <span style={{ flex: "1 1 160px", minWidth: 0, overflowWrap: "anywhere" }}>{e.tipo} · {e.destino}</span>
          <span style={{ color: e.estado === "fallido" ? "#C0392B" : C.tierra }}>{e.estado}</span>
          <span style={{ color: C.tierra }}>{ltStamp(e.creado, es)}</span>
        </div>)}
      </div>}
    </div>
    {file && <LtFileView t={t} fileId={file} onClose={() => setFile(null)} />}
    {sendOpen && <LtSendModal t={t} es={es} lt={lt} onClose={() => setSendOpen(false)} onToast={onToast} onSent={load} />}
  </LtModal>;
}

/* fila con gestos tipo iOS: ← revela Eliminar (deslizar hasta el final elimina) · → abre la edición rápida */
function LtSwipeRow({ t, onOpen, onEdit, onDelete, children }) {
  const box = useRefLt(null);
  const g = useRefLt({ x0: null, y0: 0, base: 0, dx: 0, lock: null, moved: false });
  const [dx, setDxS] = useStateLt(0);
  const [anim, setAnim] = useStateLt(false);
  const OPEN = -112;
  const setDx = (v) => { g.current.dx = v; setDxS(v); };
  const kill = () => { const w = (box.current && box.current.offsetWidth) || 400; setAnim(true); setDx(-w - 20); setTimeout(onDelete, 260); };
  const down = (e) => { if (e.pointerType === "mouse" && e.button !== 0) return; Object.assign(g.current, { x0: e.clientX, y0: e.clientY, base: g.current.dx, lock: null, moved: false }); setAnim(false); };
  const move = (e) => {
    const s = g.current; if (s.x0 == null) return;
    const mx = e.clientX - s.x0, my = e.clientY - s.y0;
    if (!s.lock) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; s.lock = Math.abs(mx) > Math.abs(my) ? "x" : "y"; if (s.lock === "x") { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {} } }
    if (s.lock !== "x") return;
    s.moved = true; let v = s.base + mx;
    if (v > 110) v = 110 + (v - 110) * 0.25;   // resistencia al editar
    setDx(v);
  };
  const up = () => {
    const s = g.current; if (s.x0 == null) return; s.x0 = null;
    if (s.lock !== "x") return;
    setTimeout(() => { g.current.moved = false; }, 0);   // si el navegador no dispara click tras el arrastre, el próximo toque no se pierde
    const w = (box.current && box.current.offsetWidth) || 400, v = s.dx; setAnim(true);
    if (v < -w * 0.55) kill();
    else if (v < -56) setDx(OPEN);
    else if (v > 72) { setDx(0); onEdit(); }
    else setDx(0);
  };
  const click = () => { if (g.current.moved) { g.current.moved = false; return; } if (g.current.dx !== 0) { setAnim(true); setDx(0); return; } onOpen(); };
  const tr = anim ? "transform .36s " + C.ease : "none";
  return <div ref={box} style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: dx < 0 ? "#C0392B" : C.beige }}>
    <div aria-hidden={dx <= 0} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 20, gap: 8, opacity: dx > 0 ? Math.min(1, dx / 72) : 0,
      fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, color: C.negro }}>
      <Icon name="edit" size={16} color={C.negro} strokeWidth={1.5} />{t.lt.quickEdit}</div>
    <button onClick={kill} tabIndex={dx < 0 ? 0 : -1} aria-hidden={dx >= 0} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: Math.max(-OPEN, -dx), border: "none", background: "transparent", cursor: "pointer",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "#fff", opacity: dx < 0 ? 1 : 0,
      fontFamily: C.sans, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>
      <Icon name="trash" size={18} color="#fff" strokeWidth={1.5} />{t.lt.del}</button>
    <div role="button" tabIndex={0} onClick={click} onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{ position: "relative", transform: "translateX(" + dx + "px)", transition: tr, touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none", cursor: "pointer" }}>
      {children}</div>
  </div>;
}

function LtQuickEdit({ t, es, lt, onClose, onSaved }) {
  const [f, setF] = useStateLt({ tipoFin: lt.tipoFin || "fecha", salida: lt.salida || "", monto: String(lt.monto || ""), diaCobro: lt.diaCobro || 1, cobraLuz: !!lt.cobraLuz });
  const [busy, setBusy] = useStateLt(false);
  const [err, setErr] = useStateLt("");
  const busyRef = useRefLt(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const mensual = (lt.frecuencia || "mensual") === "mensual";
  const valid = +f.monto > 0 && (f.tipoFin === "indefinido" || f.salida > lt.entrada);
  const save = async () => {
    if (!valid) { setErr(es ? "Revisa el monto y la fecha de salida." : "Check amount and check-out date."); return; }
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setErr("");
    const g = lt.guest || {};
    const r = await Backend.ltSave({ code: lt.code, propertyCode: lt.propertyCode, propertyName: lt.propertyName, entrada: lt.entrada, moneda: lt.moneda, notas: lt.notas || "",
      frecuencia: lt.frecuencia || "mensual", cadaDias: lt.cadaDias || 30, tipoFin: f.tipoFin, salida: f.tipoFin === "indefinido" ? "" : f.salida, monto: +f.monto,
      diaCobro: Math.max(1, Math.min(31, +f.diaCobro || 1)), cobraLuz: f.cobraLuz,
      guest: { nombre: g.nombre || "", telefono: g.telefono || "", email: g.email || "", docTipo: g.docTipo || "", docNumero: g.docNumero || "" } });
    busyRef.current = false; setBusy(false);
    if (!r || !r.ok) { setErr((es ? "No se pudo guardar" : "Could not save") + (r && r.error ? " · " + r.error : "")); return; }
    onSaved(r);
  };
  return <LtModal title={t.lt.quickEdit} onClose={() => { if (!busyRef.current) onClose(); }}
    footer={<><LtPill onClick={onClose} disabled={busy}>{t.lt.cancel}</LtPill><LtPill tone="solid" icon="check" onClick={save} disabled={busy}>{busy ? t.lt.saving : t.lt.save}</LtPill></>}>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra }}>{(lt.guest && lt.guest.nombre) || lt.code} · {lt.propertyName}</div>
      <LtField label={t.lt.endType}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["fecha", t.lt.endDate], ["indefinido", t.lt.endOpen]].map(([k, l]) => <LtPill key={k} small tone={f.tipoFin === k ? "solid" : "ghost"} onClick={() => set("tipoFin", k)}>{l}</LtPill>)}
        </div>
      </LtField>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        {f.tipoFin === "fecha" && <LtField label={t.lt.exit}><LtInput type="date" value={f.salida} onChange={(v) => set("salida", v)} min={lt.entrada} /></LtField>}
        <LtField label={t.lt.amount + " · " + (lt.moneda === "USD" ? "US$" : "Q")}><LtInput type="number" value={f.monto} onChange={(v) => set("monto", v)} min="0" inputMode="decimal" /></LtField>
        {mensual && <LtField label={t.lt.payDay}><LtInput type="number" value={f.diaCobro} onChange={(v) => set("diaCobro", v)} min="1" max="31" inputMode="numeric" /></LtField>}
      </div>
      {mensual && <span style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, lineHeight: 1.5, marginTop: -8 }}>{t.lt.payDayHint(Math.max(1, Math.min(31, +f.diaCobro || 1)))}</span>}
      <label style={{ display: "flex", gap: 12, alignItems: "center", background: f.cobraLuz ? "rgba(233,130,106,.08)" : C.beige, border: `1px solid ${f.cobraLuz ? C.peach : "transparent"}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer" }}>
        <input type="checkbox" checked={f.cobraLuz} onChange={(e) => set("cobraLuz", e.target.checked)} style={{ width: 18, height: 18, accentColor: C.negro }} />
        <Icon name="zap" size={16} color={C.peach} strokeWidth={1.5} />
        <span style={{ fontFamily: C.sans, fontSize: 13.5, color: C.negro, fontWeight: 500 }}>{t.lt.luzToggle}</span>
      </label>
      {err && <div style={{ fontFamily: C.sans, fontSize: 12.5, color: "#C0392B" }}>{err}</div>}
    </div>
  </LtModal>;
}

function LongTermScreen({ t, roster, onToast, openCode, onOpened }) {
  const es = t.code === "es";
  const [list, setList] = useStateLt(() => (Backend.cachedList && Backend.isConnected() && Backend.cachedList("lt")) || null);
  const [q, setQ] = useStateLt("");
  const [filter, setFilter] = useStateLt("activa");
  const [edit, setEdit] = useStateLt(null);    // null · "new" · lt
  const [quick, setQuick] = useStateLt(null);
  const [open, setOpen] = useStateLt(openCode || "");
  const [ver, setVer] = useStateLt(0);
  const [loadErr, setLoadErr] = useStateLt("");
  const [pend, setPend] = useStateLt(null);    // eliminación con opción de deshacer
  const pendRef = useRefLt(null);
  const load = () => Backend.ltList().then((r) => { if (r && r.ok && Array.isArray(r.list)) { setList(r.list); setLoadErr(""); } else { setLoadErr((r && r.error) || "backend-error"); setList((p) => p || []); } });
  useEffectLt(() => { load(); const id = setInterval(() => { if (!document.hidden) load(); }, 60000); return () => clearInterval(id); }, []);
  useEffectLt(() => { if (openCode) { setOpen(openCode); onOpened && onOpened(); } }, [openCode]);
  const merge = (x) => { if (!x || !x.code) return; setList((p) => { const a = p || []; return a.some((l) => l.code === x.code) ? a.map((l) => (l.code === x.code ? { ...l, ...x } : l)) : a.concat(x); }); };
  const commitDel = (l) => {
    if (pendRef.current && pendRef.current.lt.code === l.code) { clearTimeout(pendRef.current.timer); pendRef.current = null; setPend(null); }
    setList((p) => (p || []).filter((x) => x.code !== l.code));
    Backend.ltDelete(l.code).then((r) => { if (!(r && r.ok)) { onToast((es ? "No se pudo eliminar" : "Could not delete") + (r && r.error ? " · " + r.error : "")); load(); } });
  };
  const swipeDelete = (l) => {
    if (pendRef.current) commitDel(pendRef.current.lt);
    const p = { lt: l, timer: setTimeout(() => commitDel(l), 5000) }; pendRef.current = p; setPend(p);
  };
  const undo = () => { if (!pendRef.current) return; clearTimeout(pendRef.current.timer); pendRef.current = null; setPend(null); };
  useEffectLt(() => () => { if (pendRef.current) { clearTimeout(pendRef.current.timer); Backend.ltDelete(pendRef.current.lt.code); } }, []);
  const properties = useMemoLt(() => {
    const s = new Set((roster || []).map((r) => r.propertyName).filter((p) => p && p !== "Spacio AM"));
    (list || []).forEach((l) => l.propertyName && s.add(l.propertyName));
    try { Object.keys(loadPropInfo()).forEach((k) => s.add(k)); } catch (e) {}
    return [...s].sort();
  }, [roster, list]);
  const rows = (list || []).filter((l) => !(pend && pend.lt.code === l.code)).filter((l) => filter === "all" || l.estado === filter).filter((l) => {
    const n = q.trim().toLowerCase(); if (!n) return true;
    return [l.code, l.propertyName, l.guest && l.guest.nombre, l.guest && l.guest.email].some((v) => String(v || "").toLowerCase().includes(n));
  }).sort((a, b) => (b.counts.revision - a.counts.revision) || (b.counts.vencido - a.counts.vencido) || (b.unread - a.unread) || String((a.next || {}).vence || "9").localeCompare(String((b.next || {}).vence || "9")));
  const act = (list || []).filter((l) => l.estado === "activa");
  const sum = (k) => act.reduce((n, l) => n + (l.counts[k] || 0), 0);
  const onSaved = (r, isNew) => {
    setEdit(null);
    onToast(isNew ? t.lt.created : t.lt.savedOk);
    if (r.lt) { merge(r.lt); setOpen(r.lt.code); setVer((v) => v + 1); } else load();
  };
  const seedOf = (c) => (list || []).find((l) => l.code === c);
  return <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ ...ltLabel, fontSize: 11, letterSpacing: "0.28em", marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><Sparkle size={11} color={C.peach} /> {t.lt.eyebrow}</div>
        <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: "clamp(28px,4.4vw,44px)", color: C.negro, margin: 0, lineHeight: 1.04, letterSpacing: "-0.015em" }}>{t.lt.title}</h1>
        <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, margin: "10px 0 0", lineHeight: 1.55, maxWidth: 460 }}>{t.lt.sub}</p>
      </div>
      <LtPill tone="solid" icon="plus" onClick={() => setEdit("new")}>{t.lt.newRes}</LtPill>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
      <LtKpi value={act.length} label={t.lt.kActive} />
      <LtKpi value={sum("revision")} label={t.lt.kReview} tone={sum("revision") ? "#3B6691" : undefined} />
      <LtKpi value={sum("vencido")} label={t.lt.kOverdue} tone={sum("vencido") ? "#C0392B" : undefined} />
      <LtKpi value={act.reduce((n, l) => n + (l.unread || 0), 0)} label={t.lt.kUnread} tone={act.some((l) => l.unread) ? "#B54D36" : undefined} />
    </div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ position: "relative", flex: "1 1 260px", minWidth: 0 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "inline-flex" }}><Icon name="search" size={16} color={C.tierra} strokeWidth={1.5} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.lt.search} style={{ ...ltInputStyle, borderRadius: 999, paddingLeft: 40 }} />
      </div>
      <PillSelect value={filter} onChange={setFilter} minWidth={160}
        options={[{ value: "activa", label: t.lt.active }, { value: "terminada", label: t.lt.ended }, { value: "all", label: t.lt.all }]} />
    </div>
    {loadErr && <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: C.sans, fontSize: 13, color: "#C0392B", background: "rgba(192,57,43,.06)", border: "1px solid rgba(192,57,43,.25)", borderRadius: 14, padding: "12px 16px" }}>
      <span style={{ flex: "1 1 220px" }}>{loadErr}</span><LtPill small icon="refresh" onClick={() => { setLoadErr(""); load(); }}>{es ? "Reintentar" : "Retry"}</LtPill></div>}
    {list === null && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[0, 1, 2].map((i) => <div key={i} style={{ height: 68, borderRadius: 14, background: C.beige }}></div>)}</div>}
    {list && !rows.length && <div style={{ textAlign: "center", padding: "40px 0", fontFamily: C.sans, fontSize: 13, color: C.tierra }}>{t.lt.empty}</div>}
    {rows.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((l) => { const n = l.next; const flag = l.counts.revision ? "revision" : l.counts.vencido ? "vencido" : l.counts.rechazado ? "rechazado" : n ? "pendiente" : "verificado";
        return <LtSwipeRow key={l.code} t={t} onOpen={() => setOpen(l.code)} onEdit={() => setQuick(l)} onDelete={() => swipeDelete(l)}>
          <div className="sp-card" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) auto", gap: 14, alignItems: "center", textAlign: "left", width: "100%", boxSizing: "border-box",
            background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 2px rgba(62,63,63,.04)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: C.sans, fontSize: 14, color: C.negro, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.guest.nombre || l.code}</span>
                {l.unread > 0 && <span title={t.lt.kUnread} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: C.sans, fontSize: 10.5, color: "#B54D36", fontWeight: 600 }}>
                  <Icon name="chat" size={13} color="#F2755A" strokeWidth={1.5} />{l.unread}</span>}
                {l.cobraLuz && <span title={t.lt.luzToggle} style={{ display: "inline-flex" }}><Icon name="zap" size={13} color={C.peach} strokeWidth={1.5} /></span>}
              </div>
              <div style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.propertyName} · {l.code}</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...ltLabel, fontSize: 9 }}>{t.lt.thNext}</div>
              <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.negro, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{l.estado === "terminada" ? "—" : n ? (n.label || ltDate(n.vence, es)) + " · " + ltMoney(n.monto != null ? n.monto : l.monto, l.moneda) : "—"}</div>
            </div>
            <LtBadge t={t} estado={l.estado === "terminada" ? "terminada" : flag} />
          </div>
        </LtSwipeRow>; })}
      <div style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, textAlign: "center", paddingTop: 4 }}>{t.lt.swipeHint}</div>
    </div>}
    {pend && <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 95, display: "flex", alignItems: "center", gap: 16, maxWidth: "calc(100vw - 32px)",
      background: C.negro, color: C.alabaster, borderRadius: 999, padding: "10px 10px 10px 20px", boxShadow: "0 12px 40px rgba(62,63,63,.18)", animation: "rise .36s " + C.ease + " both" }}>
      <span style={{ fontFamily: C.sans, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.lt.deleted} · {(pend.lt.guest && pend.lt.guest.nombre) || pend.lt.code}</span>
      <button onClick={undo} className="sp-btn" style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "9px 16px", background: C.alabaster, color: C.negro,
        fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, flexShrink: 0 }}>{t.lt.undo}</button>
    </div>}
    {open && <LtDetail key={open + "|" + ver} t={t} es={es} code={open} seed={seedOf(open)} onClose={() => setOpen("")} onChanged={(x) => (x ? merge(x) : load())} onToast={onToast} onEdit={(lt) => setEdit(lt)}
      onDeleted={(c) => { setOpen(""); setList((p) => (p || []).filter((l) => l.code !== c)); }} />}
    {edit && <LtEditModal t={t} es={es} initial={edit === "new" ? null : edit} properties={properties} onClose={() => setEdit(null)} onSaved={onSaved} />}
    {quick && <LtQuickEdit t={t} es={es} lt={quick} onClose={() => setQuick(null)} onSaved={(r) => { setQuick(null); if (r.lt) merge(r.lt); onToast(t.lt.savedOk); }} />}
  </div>;
}

Object.assign(window, { LongTermScreen });
