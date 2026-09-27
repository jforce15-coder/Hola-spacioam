/* Long Term — carga de comprobantes con lectura automática.
   1 · Cada archivo se huella (SHA-256 del archivo original) y se lee con IA: banco, fecha, monto, moneda, referencia, cuenta, estado.
   2 · El dinero se asigna por fecha de depósito: cubre primero el periodo pendiente más antiguo que ya podía pagarse en esa fecha
       (inicio ≤ fecha + 40 días). Si alcanza para periodos completos siguientes, los adelanta; si no alcanza, queda como abono parcial.
   3 · Cada comprobante lleva avisos (bloqueantes o de atención). El servidor repite los controles contra su propia lectura:
       el navegador solo anticipa. Nada se verifica solo. */
const LT_TOL = 1, LT_MAX_FILES = 12;
const ltAddIso = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const ltNormRef = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const ltOpenSt = (p) => ["pendiente", "vencido", "rechazado"].includes(p.estado);

/* un periodo por clave (defensa ante periodos repetidos) */
function ltDedupPagos(lt) {
  const rk = (p) => ({ verificado: 5, revision: 4, rechazado: 1 }[p.estado] || (p.compId ? 3 : 0)), m = new Map();
  ((lt && lt.pagos) || []).forEach((p) => { const k = p.concepto + "|" + String(p.inicio || p.periodo).slice(0, 10), b = m.get(k); if (!b || rk(p) > rk(b)) m.set(k, p); });
  return [...m.values()].sort((a, b) => String(a.vence).localeCompare(String(b.vence)));
}
/* lo que falta por pagar en cada periodo abierto (incluye abonos parciales en revisión) */
function ltOpenPeriods(lt, today) {
  const comps = (lt && lt.comprobantes) || [], paidOn = (id) => comps.reduce((n, c) => n + (+((c.asignacion || {})[id]) || 0), 0), out = [];
  ltDedupPagos(lt).forEach((p) => {
    if (p.concepto === "luz") { if (ltOpenSt(p) && p.inicio <= today) out.push({ ...p, need: 0, paid: 0 }); return; }
    if (ltOpenSt(p)) { out.push({ ...p, need: +p.monto || 0, paid: 0 }); return; }
    if (p.estado === "revision") { const pa = paidOn(p.id), need = (+p.monto || 0) - pa; if (pa > 0 && need > LT_TOL) out.push({ ...p, need, paid: pa }); }
  });
  return out;
}

function ltAllocate(rows, open, today) {
  const need = {}; open.forEach((p) => { need[p.id] = p.need; });
  const renta = open.filter((p) => p.concepto === "renta"), luz = open.filter((p) => p.concepto === "luz"), usedLuz = new Set(), out = {};
  const live = rows.filter((r) => r.status === "ok" && !r.hard);
  live.slice().sort((a, b) => (a.pick === "auto") - (b.pick === "auto") || (a.fecha || "").localeCompare(b.fecha || "") || a.n - b.n).forEach((r) => {
    const res = { alloc: [], sobrante: 0 }, m = +r.monto || 0;
    if (r.concepto === "luz") {
      const p = r.pick !== "auto" ? luz.find((x) => x.id === r.pick) : luz.find((x) => !usedLuz.has(x.id));
      if (p && m > 0) { usedLuz.add(p.id); res.alloc.push({ id: p.id, amt: m, full: true }); }
      out[r.key] = res; return;
    }
    if (!(m > 0)) { out[r.key] = res; return; }
    let rest = m;
    const pool = r.pick !== "auto" ? renta.filter((p) => p.id === r.pick) : renta.filter((p) => p.inicio <= ltAddIso(r.fecha || today, 40));
    const first = pool.find((p) => need[p.id] > LT_TOL);
    if (first) {
      const a = Math.min(rest, need[first.id]); need[first.id] -= a; rest -= a;
      res.alloc.push({ id: first.id, amt: a, full: need[first.id] <= LT_TOL, faltan: Math.max(0, need[first.id]) });
      if (r.pick === "auto" && need[first.id] <= LT_TOL) for (const p of renta) {
        if (rest <= LT_TOL) break; if (p.vence <= first.vence || need[p.id] <= LT_TOL) continue; if (rest + LT_TOL < need[p.id]) break;
        const a2 = need[p.id]; need[p.id] = 0; rest -= a2; res.alloc.push({ id: p.id, amt: a2, full: true });
      }
    }
    res.sobrante = rest > LT_TOL ? rest : 0;
    out[r.key] = res;
  });
  return out;
}

async function ltHashFile(f) {
  try { const d = await crypto.subtle.digest("SHA-256", await f.arrayBuffer()); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40); }
  catch (e) { return ""; }
}
async function ltShrinkForAI(dataUrl) {
  try {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl; });
    let du = dataUrl;
    for (const [dim, q] of [[1400, 0.8], [1200, 0.75], [1024, 0.7], [900, 0.65]]) {
      const k = Math.min(1, dim / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      du = c.toDataURL("image/jpeg", q); if (du.length - du.indexOf(",") < 240000) break;
    }
    return du;
  } catch (e) { return dataUrl; }
}
const LT_RC_PROMPT = (hoy) => `Eres un lector de comprobantes de pago de Guatemala: transferencias, depósitos, pagos en banca en línea, boletas de depósito, capturas de apps bancarias y recibos de energía eléctrica (EEGSA, Energuate). Hoy es ${hoy}.
Observa ESTRICTAMENTE el archivo. Extrae SOLO lo que realmente aparece; NUNCA inventes ni completes datos.
Responde únicamente con un objeto JSON válido, sin texto adicional:
{"es_comprobante": true|false, "legible": true|false, "tipo": "transferencia|deposito|recibo_luz|otro", "estado": "completada|pendiente|rechazada|desconocido", "banco": "", "fecha": "YYYY-MM-DD", "monto": 0, "moneda": "GTQ|USD|", "referencia": "", "cuenta_destino": "", "beneficiario": "", "ordenante": "", "senales_edicion": false}
Reglas:
- es_comprobante=false si no es un comprobante de pago ni un recibo de luz.
- fecha = fecha de la operación. Si el año no aparece, usa el más reciente que no sea posterior a hoy.
- monto = total transferido o depositado, número sin símbolo ni comas. En recibo de luz, el total pagado.
- moneda: Q, GTQ o quetzales = GTQ; $, US$ o USD = USD. Vacío si no aparece.
- referencia = número de autorización, referencia, boleta o transacción.
- estado = "pendiente" si dice programada, en proceso o pendiente; "rechazada" si dice fallida o rechazada.
- senales_edicion = true SOLO si ves claramente texto sobrepuesto, tipografías mezcladas o cifras desalineadas.
- Si algo no se lee con claridad, deja el campo vacío.`;
/* lectura: en producción la hace el servidor (y guarda su propia copia para comparar al enviar) */
async function ltReadReceipt(file, token) {
  try {
    const du = file.isImage ? await ltShrinkForAI(file.dataUrl) : file.dataUrl, m = /^data:(.*?);base64,(.*)$/.exec(du || "");
    if (!m) return null;
    const media_type = m[1], data = m[2], isPdf = media_type === "application/pdf";
    if (!/^image\/(jpeg|png|webp|gif)$/.test(media_type) && !isPdf) return null;
    let text = "", key = "";
    if (Backend.isConnected()) { const j = await Backend.ltReadReceipt(token, media_type, data); if (!j || !j.ok) return null; text = j.text; key = j.key || ""; }
    else if (window.claude && window.claude.complete && data.length < 250000) {
      text = await window.claude.complete({ messages: [{ role: "user", content: [{ type: "text", text: LT_RC_PROMPT(new Date().toLocaleDateString("en-CA")) },
        isPdf ? { type: "document", source: { type: "base64", media_type, data } } : { type: "image", source: { type: "base64", media_type, data } }] }] });
    } else return null;
    const jm = /\{[\s\S]*\}/.exec(text || ""); if (!jm) return null;
    const j = JSON.parse(jm[0]);
    j.fecha = /^\d{4}-\d{2}-\d{2}$/.test(j.fecha || "") ? j.fecha : ""; j.monto = +String(j.monto == null ? "" : j.monto).replace(/[^\d.]/g, "") || 0;
    j.moneda = /^(GTQ|USD)$/.test(j.moneda || "") ? j.moneda : "";
    return { ai: j, key };
  } catch (e) { return null; }
}

/* avisos de un comprobante. hard = no se envía. */
function ltRowFlags(r, ctx) {
  const { t, rows, lt, cur, today, res, fmt, byId } = ctx, F = t.lt.rc.flag, out = [], ai = r.ai || {};
  if (r.status !== "ok") return out;
  const push = (code, text, hard) => out.push({ code, text, hard });
  if (r.ai && ai.es_comprobante === false) push("notReceipt", F.notReceipt, true);
  if (r.hash && rows.some((x) => x.hash === r.hash && x.n < r.n)) push("dupBatch", F.dupBatch, true);
  const comps = (lt.comprobantes || []), pagos = lt.pagos || [], rejected = (c) => c.periodos.length && c.periodos.every((id) => { const p = pagos.find((x) => x.id === id); return p && p.estado === "rechazado"; });
  const ref = ltNormRef(r.ref), prev = comps.filter((c) => (r.hash && c.hash === r.hash) || (ref.length >= 4 && ltNormRef(c.referencia) === ref));
  prev.forEach((c) => {
    if (rejected(c)) { if (!out.some((f) => f.code === "resend")) push("resend", F.resend); return; }
    if ((r.hash && c.hash === r.hash) || Math.abs((+c.monto || 0) - (+r.monto || 0)) < 0.01) { if (!out.some((f) => f.code === "dupSent")) push("dupSent", F.dupSent, true); }
    else if (!out.some((f) => f.code === "refSeen")) push("refSeen", F.refSeen);
  });
  if (ref.length >= 4 && rows.some((x) => x.n < r.n && x.status === "ok" && ltNormRef(x.ref) === ref && Math.abs((+x.monto || 0) - (+r.monto || 0)) < 0.01) && !out.some((f) => f.code === "dupBatch")) push("dupBatch", F.dupBatch, true);
  if (ai.estado === "pendiente" || ai.estado === "rechazada") push("pendingTx", F.pendingTx, true);
  if (r.concepto === "luz" && !lt.cobraLuz) push("noLuz", F.noLuz, true);
  if (!r.fecha || !(+r.monto > 0)) push("missing", F.missing, true);
  else if (r.fecha > today) push("future", F.future, true);
  if (out.some((f) => f.hard)) return out;
  if (res && !res.alloc.length) push("noPeriod", F.noPeriod, true);
  if (res && res.alloc.length) { const l = res.alloc[res.alloc.length - 1]; if (!l.full && r.concepto !== "luz") push("partial", F.partial(fmt(l.faltan))); }
  if (res && res.sobrante > 0) push("excess", F.excess(fmt(res.sobrante)));
  if (ai.moneda && ai.moneda !== cur) push("currency", F.currency(ai.moneda === "USD" ? "US$" : "Q"));
  if (r.fecha && lt.entrada && r.fecha < ltAddIso(lt.entrada, -31)) push("old", F.old);
  if (ai.senales_edicion === true) push("tampered", F.tampered);
  if (r.manual) push("manual", F.manual);
  else if (r.ai && ((ai.fecha && ai.fecha !== r.fecha) || (ai.monto > 0 && Math.abs(ai.monto - (+r.monto || 0)) > 0.01) || (ai.referencia && ltNormRef(ai.referencia) !== ref))) push("edited", F.edited);
  return out;
}

function LtFlag({ f }) {
  const hard = f.hard, fg = hard ? "#C0392B" : "#B54D36";
  return <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: hard ? "rgba(192,57,43,.07)" : "rgba(242,117,90,.10)", borderRadius: 10, padding: "8px 10px",
    fontFamily: C.sans, fontSize: 12, lineHeight: 1.5, color: fg }}>
    <Icon name="alert" size={14} color={hard ? "#C0392B" : "#F2755A"} strokeWidth={1.5} /><span style={{ flex: 1, minWidth: 0, textWrap: "pretty" }}>{f.text}</span></div>;
}

function LtReceiptIntake({ t, es, token, lt, onDone, perfilSlot, perfil, resetPerfil, hideContext }) {
  const rc = t.lt.rc, today = new Date().toLocaleDateString("en-CA"), cur = lt.moneda || "GTQ", fmt = (v) => ltMoney(v, cur);
  const [rows, setRows] = useStateLt([]);
  const [busy, setBusy] = useStateLt(false);
  const [prog, setProg] = useStateLt("");
  const [msg, setMsg] = useStateLt(null);
  const [over, setOver] = useStateLt(false);
  const fileRef = useRefLt(null), seq = useRefLt(0);
  const open = useMemoLt(() => ltOpenPeriods(lt, today), [lt]);
  const byId = {}; open.forEach((p) => { byId[p.id] = p; });
  const renta = open.filter((p) => p.concepto === "renta"), luzOpen = open.filter((p) => p.concepto === "luz");
  const lbl = (p) => p ? (p.label || ltPeriod(p.periodo, es)) + (p.concepto === "luz" ? " · " + t.lt.luz : "") : "";
  // bloqueos que no dependen de la asignación se calculan primero, para no asignar dinero a un comprobante que no se enviará
  const pre = rows.map((r) => ({ ...r, hard: ltRowFlags(r, { t, rows, lt, cur, today, res: null, fmt, byId }).some((f) => f.hard) }));
  const assign = ltAllocate(pre, open, today);
  const flags = {}; pre.forEach((r) => { flags[r.key] = ltRowFlags(r, { t, rows, lt, cur, today, res: r.status === "ok" && !r.hard ? assign[r.key] || { alloc: [], sobrante: 0 } : null, fmt, byId }); });
  const sendable = pre.filter((r) => r.status === "ok" && !flags[r.key].some((f) => f.hard) && (assign[r.key] || { alloc: [] }).alloc.length);
  const reading = rows.some((r) => r.status === "reading");
  const upd = (key, patch) => setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const add = async (fl) => {
    setMsg(null);
    const list = Array.from(fl || []), room = LT_MAX_FILES - rows.length;
    if (list.length > room) setMsg({ err: true, text: rc.max });
    for (const f of list.slice(0, Math.max(0, room))) {
      const n = seq.current++, key = "r" + n;
      let file; try { file = await ltReadFile(f); } catch (e) { setMsg({ err: true, text: rc.tooBig }); continue; }
      const hash = await ltHashFile(f);
      setRows((p) => p.concat({ key, n, file, hash, status: "reading", fecha: "", monto: "", ref: "", banco: "", concepto: "renta", pick: "auto", manual: false, editing: false }));
      ltReadReceipt(file, token).then((x) => {
        const ai = x && x.ai;
        if (!ai || ai.legible === false || (ai.es_comprobante !== false && !(ai.monto > 0 && ai.fecha))) {
          upd(key, { status: "ok", ai: ai || null, aiKey: (x && x.key) || "", manual: true, editing: true, fecha: (ai && ai.fecha) || "", monto: ai && ai.monto ? String(ai.monto) : "", ref: (ai && ai.referencia) || "", banco: (ai && ai.banco) || "" });
          return;
        }
        upd(key, { status: "ok", ai, aiKey: x.key, fecha: ai.fecha, monto: String(ai.monto), ref: ai.referencia || "", banco: ai.banco || "",
          concepto: ai.tipo === "recibo_luz" ? "luz" : "renta" });
      });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!sendable.length || busy || reading) return;
    setBusy(true); setMsg(null);
    const covered = [...new Set(sendable.flatMap((r) => assign[r.key].alloc.map((a) => a.id)))].map((id) => lbl(byId[id]));
    const total = sendable.reduce((n, r) => n + (+r.monto || 0), 0), failed = {}; let last = null;
    const pf = {}; Object.keys(perfil || {}).forEach((k) => { const v = perfil[k]; if (v && String(v).trim()) pf[k] = v; }); if (!pf.docNumero) delete pf.docTipo;
    for (let i = 0; i < sendable.length; i++) {
      const r = sendable[i], a = assign[r.key], isLast = i === sendable.length - 1;
      setProg(rc.sending(i + 1, sendable.length));
      const res = await Backend.ltUpload(token, { concepto: r.concepto, periodoIds: a.alloc.map((x) => x.id), asignacion: Object.fromEntries(a.alloc.map((x) => [x.id, x.amt])),
        files: [{ name: r.file.name, dataUrl: r.file.dataUrl }], referencia: r.ref, fecha: r.fecha, monto: +r.monto || 0, banco: r.banco, comentario: "",
        hash: r.hash, aiKey: r.aiKey || "", lectura: Backend.isConnected() ? undefined : r.ai || undefined, manual: r.manual,
        perfil: i === 0 && Object.keys(pf).length ? pf : undefined, notify: isLast, lite: !isLast, resumen: covered.join(", "), resumenMonto: total });
      if (res && res.ok) { if (res.lt) last = res.lt; } else failed[r.key] = (res && rc.srvErr[res.error]) || (res && res.error) || "";
    }
    const nFail = Object.keys(failed).length;
    setBusy(false); setProg("");
    setRows((p) => p.filter((r) => failed[r.key] !== undefined || !sendable.some((s) => s.key === r.key)).map((r) => failed[r.key] ? { ...r, srvErr: failed[r.key] } : r));
    setMsg(nFail ? { err: true, text: rc.failed(nFail) } : { text: rc.sent });
    if (!nFail && resetPerfil) resetPerfil();
    onDone(last);
  };

  const overdue = renta.filter((p) => p.estado === "vencido" || p.estado === "rechazado"), next = renta[0];
  const ctxLine = overdue.length ? { tone: "#C0392B", text: rc.overdue(overdue.length, fmt(overdue.reduce((n, p) => n + p.need, 0))) }
    : next ? { tone: C.tierra, text: rc.next(lbl(next), fmt(next.need), ltDate(next.vence, es)) } : { tone: "#3d6b52", text: rc.clear };
  const total = sendable.reduce((n, r) => n + (+r.monto || 0), 0), skipped = rows.filter((r) => r.status === "ok").length - sendable.length;

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <label onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, cursor: busy ? "default" : "pointer",
        padding: rows.length ? "22px 20px" : "clamp(32px,7vw,52px) 22px", borderRadius: 28, border: `1px dashed ${over ? C.peach : C.grisCalido}`,
        background: over ? "rgba(233,130,106,.08)" : C.beige, transition: "background .18s " + C.ease + ", border-color .18s " + C.ease }}>
      <span style={{ width: 56, height: 56, borderRadius: 999, background: C.white, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(62,63,63,.04)" }}>
        <Icon name="upload" size={24} color={C.negro} strokeWidth={1.5} /></span>
      <span style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 440 }}>
        <span style={{ fontFamily: C.serif, fontSize: rows.length ? 22 : "clamp(26px,5vw,32px)", color: C.negro, lineHeight: 1.1 }}>{over ? rc.drop : rows.length ? rc.addMore : rc.title}</span>
        {!rows.length && <span style={{ fontFamily: C.sans, fontSize: 13, color: C.tierra, lineHeight: 1.6, letterSpacing: "0.02em", textWrap: "pretty" }}>{rc.sub}</span>}
      </span>
      {!rows.length && <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.negro, color: C.alabaster, borderRadius: 999, padding: "12px 22px", minHeight: 44, boxSizing: "border-box",
        fontFamily: C.sans, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}><Icon name="camera" size={15} color={C.alabaster} strokeWidth={1.5} />{rc.pick}</span>}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden disabled={busy} onChange={(e) => add(e.target.files)} />
    </label>
    {!rows.length && !hideContext && <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", fontFamily: C.sans, fontSize: 12.5, color: ctxLine.tone, letterSpacing: "0.02em", textAlign: "center" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: ctxLine.tone === C.tierra ? C.peach : ctxLine.tone, flexShrink: 0 }}></span>{ctxLine.text}</div>}

    {pre.map((r) => { const a = assign[r.key], fl = flags[r.key] || [], hard = fl.some((f) => f.hard); return (
      <div key={r.key} style={{ display: "flex", flexDirection: "column", gap: 12, border: `1px solid ${hard ? "rgba(192,57,43,.35)" : C.grisCalido}`, borderRadius: 14, padding: 14, background: C.white }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {r.file.isImage ? <img src={r.file.dataUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
            : <span style={{ width: 48, height: 48, borderRadius: 10, background: C.beige, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="factura" size={18} color={C.tierra} strokeWidth={1.5} /></span>}
          <span style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            {r.status === "reading" ? <>
              <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra }}>{rc.reading}</span>
              <span style={{ width: "60%", height: 10, borderRadius: 6, background: C.beige }}></span>
            </> : <>
              <span style={{ fontFamily: C.sans, fontSize: 14, color: C.negro, fontWeight: 500, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
                {[r.banco, r.fecha ? ltDate(r.fecha, es) : "", +r.monto > 0 ? fmt(+r.monto) : ""].filter(Boolean).join(" · ") || r.file.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontFamily: C.sans, fontSize: 12.5, color: a && a.alloc.length ? C.negro : C.tierra }}>
                {a && a.alloc.length ? <><Icon name="arrow" size={13} color={C.peach} strokeWidth={1.5} />
                  {a.alloc.length === 1 && !a.alloc[0].full && r.concepto !== "luz" ? rc.partialTo(lbl(byId[a.alloc[0].id]), fmt(a.alloc[0].faltan)) : rc.covers + " " + a.alloc.map((x) => lbl(byId[x.id])).join(" · ")}</>
                  : !hard ? rc.noAssign : r.file.name}</span>
            </>}
          </span>
          {r.status === "ok" && !r.editing && <LtPill small icon="edit" onClick={() => upd(r.key, { editing: true })} disabled={busy}>{rc.edit}</LtPill>}
          <button onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))} disabled={busy} aria-label="remove" className="sp-btn"
            style={{ width: 44, height: 44, borderRadius: 999, border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="x" size={16} color={C.tierra} /></button>
        </div>
        {r.srvErr && <LtFlag f={{ hard: true, text: r.srvErr }} />}
        {fl.map((f) => <LtFlag key={f.code} f={f} />)}
        {r.status === "ok" && r.editing && <div style={{ display: "flex", flexDirection: "column", gap: 10, background: C.beige, borderRadius: 10, padding: 12 }}>
          {r.manual && <span style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, lineHeight: 1.5 }}>{rc.manualHint}</span>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            <LtField label={t.lt.payDate}><LtInput type="date" value={r.fecha} onChange={(v) => upd(r.key, { fecha: v, srvErr: "" })} max={today} /></LtField>
            <LtField label={t.lt.paid + " · " + (cur === "USD" ? "US$" : "Q")}><LtInput type="number" value={r.monto} onChange={(v) => upd(r.key, { monto: v, srvErr: "" })} inputMode="decimal" /></LtField>
            <LtField label={t.lt.ref}><LtInput value={r.ref} onChange={(v) => upd(r.key, { ref: v, srvErr: "" })} /></LtField>
            {lt.cobraLuz && <LtField label={rc.concept}>
              <select value={r.concepto} onChange={(e) => upd(r.key, { concepto: e.target.value, pick: "auto" })} style={ltInputStyle}>
                <option value="renta">{t.lt.rent}</option><option value="luz">{t.lt.luz}</option></select></LtField>}
            <LtField label={t.lt.bPeriod}>
              <select value={r.pick} onChange={(e) => upd(r.key, { pick: e.target.value })} style={ltInputStyle}>
                <option value="auto">{t.lt.bAuto}</option>
                {(r.concepto === "luz" ? luzOpen : renta).map((p) => <option key={p.id} value={p.id}>{lbl(p)}</option>)}
              </select></LtField>
          </div>
          <div><LtPill small icon="check" onClick={() => upd(r.key, { editing: false })}>{rc.done}</LtPill></div>
        </div>}
      </div>); })}

    {rows.length > 0 && <>
      {perfilSlot}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
        {sendable.length > 0 && <span style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, fontVariantNumeric: "tabular-nums" }}>{rc.summary(sendable.length, fmt(total))}</span>}
        {skipped > 0 && !reading && <span style={{ fontFamily: C.sans, fontSize: 12, color: "#B54D36" }}>{rc.skipped(skipped)}</span>}
        <div><LtPill tone="solid" icon="upload" onClick={submit} disabled={busy || reading || !sendable.length}>{busy ? prog : reading ? rc.reading : rc.send(sendable.length)}</LtPill></div>
      </div>
    </>}
    {msg && <div style={{ fontFamily: C.sans, fontSize: 13, color: msg.err ? "#C0392B" : "#3d6b52", lineHeight: 1.5 }}>{msg.text}</div>}
  </div>;
}

Object.assign(window, { LtReceiptIntake, ltAllocate, ltOpenPeriods, ltDedupPagos, ltRowFlags, LtFlag });
