/* Long Term — piezas compartidas entre el panel y el perfil del huésped */
const { useState: useStateLt, useEffect: useEffectLt, useRef: useRefLt, useMemo: useMemoLt } = React;

const LT_TONE = {
  verificado: { fg: "#3d6b52", bg: "rgba(61,107,82,.10)" },
  revision:   { fg: "#3B6691", bg: "rgba(59,102,145,.10)" },
  pendiente:  { fg: "#6F6867", bg: "#F5F3F0" },
  rechazado:  { fg: "#C0392B", bg: "rgba(192,57,43,.09)" },
  vencido:    { fg: "#C0392B", bg: "rgba(192,57,43,.09)" },
  activa:     { fg: "#3d6b52", bg: "rgba(61,107,82,.10)" },
  terminada:  { fg: "#6F6867", bg: "#F5F3F0" },
};
const ltMoney = (v, cur) => (cur === "USD" ? "US$ " : "Q ") + Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const ltDate = (iso, es) => { if (!iso) return "—"; const d = new Date(String(iso).slice(0, 10) + "T12:00:00"); return isNaN(d) ? "—" : d.toLocaleDateString(es ? "es-GT" : "en-US", { day: "numeric", month: "short", year: "numeric" }).replace(".", ""); };
const ltPeriod = (per, es) => { if (!per) return ""; const d = new Date(per + "-15T12:00:00"); const s = d.toLocaleDateString(es ? "es-GT" : "en-US", { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); };
const ltStamp = (s, es) => { if (!s) return ""; const d = new Date(String(s).replace(" ", "T")); return isNaN(d) ? String(s) : d.toLocaleString(es ? "es-GT" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", ""); };

const ltLabel = { fontFamily: C.sans, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.tierra, fontWeight: 600 };
const ltInputStyle = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 14, border: `1px solid ${C.grisCalido}`, background: C.white,
  fontFamily: C.sans, fontSize: 14, color: C.negro, outline: "none", letterSpacing: "0.02em" };

function LtBadge({ estado, t }) {
  const tone = LT_TONE[estado] || LT_TONE.pendiente;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: tone.bg, color: tone.fg,
    fontFamily: C.sans, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.fg }}></span>{(t.lt.st || {})[estado] || estado}</span>;
}

function LtField({ label, children, span }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0, gridColumn: span ? "1 / -1" : undefined }}>
    <span style={ltLabel}>{label}</span>{children}</label>;
}
function LtInput({ value, onChange, type = "text", placeholder, ...rest }) {
  return <input type={type} value={value == null ? "" : value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={ltInputStyle} {...rest} />;
}

function LtPill({ children, onClick, tone = "ghost", disabled, icon, small }) {
  const tones = {
    solid: { background: C.negro, color: C.alabaster, border: `1px solid ${C.negro}` },
    ghost: { background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}` },
    accent: { background: "rgba(233,130,106,.12)", color: C.negro, border: `1px solid ${C.peach}` },
    danger: { background: C.white, color: "#C0392B", border: "1px solid rgba(192,57,43,.35)" },
  };
  return <button className="sp-btn" onClick={disabled ? undefined : onClick} disabled={disabled}
    style={{ ...tones[tone], display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, cursor: disabled ? "not-allowed" : "pointer",
      padding: small ? "7px 13px" : "11px 20px", fontFamily: C.sans, fontSize: small ? 10 : 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
      opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap" }}>
    {icon && <Icon name={icon} size={small ? 13 : 15} color={tone === "solid" ? C.alabaster : tone === "danger" ? "#C0392B" : C.negro} strokeWidth={1.5} />}{children}</button>;
}

function LtModal({ title, onClose, children, footer, wide }) {
  useEffectLt(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, []);
  return <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(62,63,63,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "clamp(12px,5vh,56px) 12px", overflowY: "auto", animation: "noti-in .36s " + C.ease + " both" }}>
    <div style={{ width: "100%", maxWidth: wide ? 860 : 560, background: C.white, borderRadius: 28, boxShadow: "0 28px 80px rgba(62,63,63,.10)", animation: "rise .36s " + C.ease + " both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "22px 24px 0" }}>
        <h3 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 26, margin: 0, color: C.negro, lineHeight: 1.1 }}>{title}</h3>
        <button onClick={onClose} className="sp-btn" aria-label="close" style={{ width: 36, height: 36, borderRadius: 999, border: `1px solid ${C.grisCalido}`, background: C.white, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="x" size={16} color={C.negro} strokeWidth={1.5} /></button>
      </div>
      <div style={{ padding: "18px 24px 22px" }}>{children}</div>
      {footer && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", padding: "0 24px 22px" }}>{footer}</div>}
    </div>
  </div>;
}

/* fotos → JPEG ≤1600px (~300 KB); PDF tal cual (≤8 MB) */
function ltReadFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("no-file"));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("too-big"));
    const r = new FileReader();
    r.onerror = () => reject(new Error("read"));
    r.onload = () => {
      const src = String(r.result || "");
      if (!/^data:image\//.test(src) || /svg/.test(src)) return resolve({ name: file.name, dataUrl: src, isImage: false });
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        resolve({ name: file.name.replace(/\.\w+$/, "") + ".jpg", dataUrl: cv.toDataURL("image/jpeg", 0.8), isImage: true });
      };
      img.onerror = () => resolve({ name: file.name, dataUrl: src, isImage: true });
      img.src = src;
    };
    r.readAsDataURL(file);
  });
}

/* hilo de mensajes (panel y huésped) */
function LtThread({ t, es, mensajes, mine, onSend, busy, draft }) {
  const [txt, setTxt] = useStateLt("");
  const box = useRefLt(null), ta = useRefLt(null);
  useEffectLt(() => { if (draft && draft.text) { setTxt(draft.text); setTimeout(() => { if (ta.current) { ta.current.focus(); ta.current.setSelectionRange(draft.text.length, draft.text.length); } }, 60); } }, [draft]);
  useEffectLt(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [mensajes && mensajes.length]);
  const send = () => { const v = txt.trim(); if (!v) return; Promise.resolve(onSend(v)).then(() => setTxt("")); };
  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div ref={box} style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
      {(!mensajes || !mensajes.length) && <div style={{ fontFamily: C.sans, fontSize: 13, color: C.tierra, padding: "8px 0" }}>{t.lt.noMsgs}</div>}
      {(mensajes || []).map((m) => { const own = m.autor === mine; return (
        <div key={m.id} style={{ alignSelf: own ? "flex-end" : "flex-start", maxWidth: "82%", background: own ? C.negro : C.beige, color: own ? C.alabaster : C.negro,
          borderRadius: own ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 14px" }}>
          <div style={{ fontFamily: C.sans, fontSize: 13.5, lineHeight: 1.55, letterSpacing: "0.01em", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.texto}</div>
          <div style={{ fontFamily: C.sans, fontSize: 10, marginTop: 4, letterSpacing: "0.06em", color: own ? "rgba(250,250,250,.75)" : C.tierra }}>{ltStamp(m.creado, es)}</div>
        </div>); })}
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <textarea ref={ta} value={txt} onChange={(e) => setTxt(e.target.value)} rows={2} placeholder={mine === "admin" ? t.lt.reply : t.lt.gWrite}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
        style={{ ...ltInputStyle, resize: "vertical", minHeight: 48, fontSize: 13.5 }}></textarea>
      <LtPill tone="solid" icon="arrow" onClick={send} disabled={busy || !txt.trim()}>{t.lt.send}</LtPill>
    </div>
  </div>;
}

/* visor de comprobante (imagen o PDF) */
function LtFileView({ t, fileId, token, onClose }) {
  const [src, setSrc] = useStateLt(null);
  useEffectLt(() => { Backend.ltFile(fileId, token).then((s) => setSrc(s || "")); }, [fileId]);
  const isPdf = /^data:application\/pdf/.test(src || "");
  return <LtModal title={t.lt.paidWith} onClose={onClose} wide>
    {src === null && <div style={{ height: 240, borderRadius: 14, background: C.beige }}></div>}
    {src === "" && <div style={{ fontFamily: C.sans, fontSize: 13, color: C.tierra }}>—</div>}
    {src && (isPdf ? <iframe src={src} title="pdf" style={{ width: "100%", height: "70vh", border: `1px solid ${C.grisCalido}`, borderRadius: 14 }}></iframe>
      : <img src={src} alt="" style={{ display: "block", maxWidth: "100%", maxHeight: "72vh", margin: "0 auto", borderRadius: 14 }} />)}
  </LtModal>;
}

Object.assign(window, { LT_TONE, ltMoney, ltDate, ltPeriod, ltStamp, ltLabel, ltInputStyle, LtBadge, LtField, LtInput, LtPill, LtModal, ltReadFile, LtThread, LtFileView });
