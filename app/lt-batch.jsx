/* Long Term — carga de varios comprobantes a la vez.
   Clasificación: los depósitos se ordenan por fecha y se asignan al periodo de renta pendiente más antiguo
   (así un pago atrasado de julio hecho en septiembre cubre julio, no septiembre). Un depósito cuyo monto
   alcanza para varios periodos los cubre todos. El huésped puede corregir cualquier asignación. */
function ltClassify(rows, periods) {
  const used = new Set(rows.filter((r) => r.pick !== "auto").map((r) => r.pick));
  const free = periods.filter((p) => !used.has(p.id));
  const out = {};
  rows.forEach((r) => { if (r.pick !== "auto") out[r.key] = periods.some((p) => p.id === r.pick) ? [r.pick] : []; });
  let k = 0;
  rows.filter((r) => r.pick === "auto").slice().sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || a.n - b.n).forEach((r) => {
    const ids = [], m = +r.monto || 0; let acc = 0;
    while (k < free.length && (!ids.length || (m > 0 && acc + (+free[k].monto || 0) <= m + 0.5))) { ids.push(free[k].id); acc += +free[k].monto || 0; k++; }
    out[r.key] = ids;
  });
  return out;
}

function LtBatch({ t, es, token, periods, cur, onDone }) {
  const today = new Date().toLocaleDateString("en-CA");
  const [rows, setRows] = useStateLt([]);
  const [busy, setBusy] = useStateLt(false);
  const [prog, setProg] = useStateLt("");
  const [msg, setMsg] = useStateLt("");
  const fileRef = useRefLt(null);
  const seq = useRefLt(0);
  const base = periods[0] ? +periods[0].monto || 0 : 0;
  const assign = ltClassify(rows, periods);
  const byId = {}; periods.forEach((p) => { byId[p.id] = p; });
  const lbl = (p) => p.label || ltPeriod(p.periodo, es);
  const add = async (fl) => {
    setMsg("");
    for (const f of Array.from(fl || []).slice(0, 12 - rows.length)) {
      try {
        const x = await ltReadFile(f);
        let d = f.lastModified ? new Date(f.lastModified).toLocaleDateString("en-CA") : today; if (d > today) d = today;
        const n = seq.current++;
        setRows((p) => p.concat({ key: "b" + n, n, file: x, fecha: d, monto: base ? String(base) : "", ref: "", pick: "auto" }).slice(0, 12));
      } catch (e) { setMsg(es ? "Un archivo pesa más de 8 MB." : "A file is over 8 MB."); }
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const upd = (key, k, v) => setRows((p) => p.map((r) => (r.key === key ? { ...r, [k]: v } : r)));
  const covered = periods.filter((p) => rows.some((r) => (assign[r.key] || []).includes(p.id)));
  const ready = rows.filter((r) => (assign[r.key] || []).length);
  const submit = async () => {
    if (!ready.length || busy) return;
    setBusy(true); setMsg("");
    const resumen = covered.map(lbl).join(", "), total = ready.reduce((n, r) => n + (+r.monto || 0), 0);
    const failed = []; let last = null;
    for (let i = 0; i < ready.length; i++) {
      const r = ready[i], isLast = i === ready.length - 1;
      setProg(t.lt.bSending(i + 1, ready.length));
      const res = await Backend.ltUpload(token, { concepto: "renta", periodoIds: assign[r.key], files: [{ name: r.file.name, dataUrl: r.file.dataUrl }],
        referencia: r.ref, fecha: r.fecha, monto: +r.monto || 0, comentario: "", notify: isLast, lite: !isLast, resumen, resumenMonto: total });
      if (res && res.ok) { if (res.lt) last = res.lt; } else failed.push(r.key);
    }
    setBusy(false); setProg("");
    setRows((p) => p.filter((r) => failed.includes(r.key) || !(assign[r.key] || []).length));
    setMsg(failed.length ? t.lt.bFailed(failed.length) : t.lt.gDone);
    onDone(last);
  };
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, margin: 0, lineHeight: 1.6, textWrap: "pretty" }}>{t.lt.bHint}</p>
    {rows.map((r) => { const ids = assign[r.key] || []; return (
      <div key={r.key} style={{ display: "flex", flexDirection: "column", gap: 12, border: `1px solid ${ids.length ? C.grisCalido : "rgba(192,57,43,.35)"}`, borderRadius: 14, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {r.file.isImage ? <img src={r.file.dataUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
            : <span style={{ width: 44, height: 44, borderRadius: 10, background: C.beige, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="factura" size={18} color={C.tierra} strokeWidth={1.5} /></span>}
          <span style={{ flex: "1 1 auto", minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: C.sans, fontSize: 12, color: C.tierra, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.file.name}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3, fontFamily: C.sans, fontSize: 13.5, color: ids.length ? C.negro : "#C0392B", fontWeight: 500 }}>
              <Icon name={ids.length ? "arrow" : "alert"} size={14} color={ids.length ? C.peach : "#C0392B"} strokeWidth={1.5} />
              {ids.length ? ids.map((id) => lbl(byId[id])).join(" · ") : t.lt.bNone}</span>
          </span>
          <button onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))} disabled={busy} aria-label="remove" className="sp-btn"
            style={{ width: 44, height: 44, borderRadius: 999, border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="x" size={16} color={C.tierra} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          <LtField label={t.lt.payDate}><LtInput type="date" value={r.fecha} onChange={(v) => upd(r.key, "fecha", v)} max={today} /></LtField>
          <LtField label={t.lt.paid + " · " + (cur === "USD" ? "US$" : "Q")}><LtInput type="number" value={r.monto} onChange={(v) => upd(r.key, "monto", v)} inputMode="decimal" /></LtField>
          <LtField label={t.lt.bPeriod}>
            <select value={r.pick} onChange={(e) => upd(r.key, "pick", e.target.value)} style={ltInputStyle}>
              <option value="auto">{t.lt.bAuto}</option>
              {periods.map((p) => <option key={p.id} value={p.id}>{lbl(p)}</option>)}
            </select></LtField>
          <LtField label={t.lt.ref}><LtInput value={r.ref} onChange={(v) => upd(r.key, "ref", v)} /></LtField>
        </div>
      </div>); })}
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      {rows.length < 12 && <LtPill small icon="upload" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>{rows.length ? t.lt.gAddFile : t.lt.bPick}</LtPill>}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => add(e.target.files)} />
      {rows.length > 0 && <span style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra }}>{t.lt.bSummary(rows.length, covered.length)}</span>}
    </div>
    {rows.length > 0 && <div><LtPill tone="solid" icon="upload" onClick={submit} disabled={busy || !ready.length}>{busy ? prog : t.lt.bSend(ready.length)}</LtPill></div>}
    {msg && <div style={{ fontFamily: C.sans, fontSize: 13, color: msg === t.lt.gDone ? "#3d6b52" : "#C0392B" }}>{msg}</div>}
  </div>;
}

Object.assign(window, { LtBatch, ltClassify });
