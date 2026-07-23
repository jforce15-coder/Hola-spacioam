/* ============================================================
   SPACIO AM — primitives: brand marks, motifs, UI atoms, icons
   ============================================================ */
const { useState, useEffect, useRef } = React;

/* ---------- BRAND MARKS (official logo files) ---------- */
function LogoMain({ width = 200, light = false, style }) {
  return <img src={light ? "assets/brand/logo-primary-white.png" : "assets/brand/logo-primary-transparent.png"} alt="Spacio AM"
    style={{ width, height: "auto", display: "block", ...style }} />;
}
function LogoS({ size = 40, light = false, style }) {
  return <img src={light ? "assets/brand/logo-monogram-white.png" : "assets/brand/logo-monogram.png"} alt="Spacio AM"
    style={{ width: "auto", height: size, display: "block", ...style }} />;
}
function LogoStamp({ size = 72, light = false, style }) {
  return <img src={light ? "assets/brand/logo-stamp-white.png" : "assets/brand/logo-stamp-transparent.png"} alt="Spacio AM"
    style={{ width: size, height: size, objectFit: "contain", display: "block", ...style }} />;
}

/* ---------- SPARKLE (4-point accent) ---------- */
function Sparkle({ size = 14, color = C.peach, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill={color} style={style} aria-hidden="true">
      <path d="M50 4 C 52 32, 58 42, 96 50 C 58 58, 52 68, 50 96 C 48 68, 42 58, 4 50 C 42 42, 48 32, 50 4 Z" />
    </svg>
  );
}

/* ============================================================
   PETMA BRUSHSTROKE — volumetric 3D ribbon
   Lit-from-top gradient + bristle texture + tapered ends.
   Weaves BEHIND an element and re-emerges IN FRONT (see WeaveHero).
   ============================================================ */
const BRUSH_PATHS = {
  1: "M -150 360 C 170 150, 460 150, 660 330 C 840 490, 1080 470, 1360 250",
  2: "M -120 200 C 200 380, 430 110, 690 290 C 920 450, 1060 170, 1360 320",
  3: "M -150 300 C 220 470, 470 150, 700 250 C 930 350, 1090 470, 1360 220",
  4: "M -120 250 C 230 90, 470 430, 700 300 C 910 180, 1080 420, 1360 240",
};
let _brushId = 0;
/* PETMA 3D LINE — ONE thick brushstroke in #F5F3F0 @ ~30% opacity.
   Tapered brushstroke ends (fade mask + round caps); subtle in-hue
   shading gives volume. In WeaveHero it wraps BEHIND an element and
   re-emerges IN FRONT for depth. */
function Brush3D({ variant = 1, width = 92, opacity = 0.3, shadow = false, color = "#F5F3F0", style }) {
  const id = useRef(`br${_brushId++}`).current;
  const d = BRUSH_PATHS[variant];
  return (
    <svg viewBox="0 0 1200 540" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none",
        opacity, filter: shadow ? "drop-shadow(0 6px 14px rgba(62,63,63,.10))" : "none", ...style }}>
      <defs>
        {/* volume within the single tone: faint highlight top → faint shade bottom */}
        <linearGradient id={`vol${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor="#E8E4DE" />
        </linearGradient>
        {/* wide fade at both ends → brushstroke taper */}
        <linearGradient id={`fade${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.82" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`mk${id}`}><rect x="-40" y="-40" width="1280" height="620" fill={`url(#fade${id})`} /></mask>
        <filter id={`soft${id}`} x="-10%" y="-30%" width="120%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>
      <g mask={`url(#mk${id})`} filter={`url(#soft${id})`}>
        {/* single body stroke with in-hue volume */}
        <path d={d} stroke={`url(#vol${id})`} strokeWidth={width} fill="none" strokeLinecap="round" />
        {/* soft top sheen — keeps it one line, just lit */}
        <path d={d} stroke="#FFFFFF" strokeWidth={width * 0.18} fill="none" strokeLinecap="round" opacity="0.45" transform={`translate(0,${-width * 0.2})`} />
      </g>
    </svg>
  );
}

/* Ambient, low-opacity brushstroke for screen backgrounds */
function FlowLine({ variant = 2, opacity = 0.5, width = 60 }) {
  return <Brush3D variant={variant} width={width} opacity={opacity * 0.6} />;
}

/* ============================================================
   WeaveHero — image card with the 3D ribbon weaving behind & in front.
   back layer (z0) shows on the alabaster margins around the card;
   the card (z1) occludes the middle; a masked front segment (z2)
   re-emerges ON the image with a drop-shadow → 3D depth.
   ============================================================ */
function WeaveHero({ img, height = 240, radius = "24px 24px 0 0", variant = 1, width = 86,
  frontMask = "radial-gradient(120% 90% at 24% 92%, #000 0 38%, transparent 60%)", overlay, children, style }) {
  return (
    <div className="sp-weave" style={{ position: "relative", ...style }}>
      {/* BACK — peeks out past the card edges */}
      <div style={{ position: "absolute", inset: "-26px -16px -22px", zIndex: 0, opacity: 0.92 }}>
        <Brush3D variant={variant} width={width} />
      </div>
      {/* CARD */}
      <div className="sp-imgwrap" style={{ position: "relative", zIndex: 1, height, borderRadius: radius, overflow: "hidden",
        boxShadow: "0 6px 22px rgba(62,63,63,.08)" }}>
        <img src={img} alt="" className="sp-img" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {overlay}
        {children}
      </div>
      {/* FRONT — masked segment re-emerges over the image */}
      <div style={{ position: "absolute", inset: "-26px -16px -22px", zIndex: 2,
        WebkitMaskImage: frontMask, maskImage: frontMask }}>
        <Brush3D variant={variant} width={width} shadow />
      </div>
    </div>
  );
}

/* ---------- GRAIN ---------- */
function Grain() {
  return (
    <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.035, mixBlendMode: "multiply", zIndex: 9 }} aria-hidden="true">
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" /></filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}

/* ---------- BUTTON ---------- */
function Btn({ children, onClick, variant = "solid", disabled, full, style }) {
  const base = {
    fontFamily: C.sans, fontSize: 12, letterSpacing: "0.14em", fontWeight: 500,
    padding: "16px 30px", borderRadius: 14, cursor: disabled ? "not-allowed" : "pointer",
    border: "none", textTransform: "uppercase", width: full ? "100%" : "auto",
    opacity: disabled ? 0.38 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
  };
  const variants = {
    solid:   { background: C.negro, color: C.alabaster },
    outline: { background: "transparent", color: C.negro, border: `1px solid ${C.grisCalido}` },
    peach:   { background: C.peach, color: C.white },
    ghost:   { background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}` },
  };
  return (
    <button className="sp-btn" onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

/* ---------- FIELD ---------- */
function Field({ label, value, onChange, placeholder, type = "text", required }) {
  const [focus, setFocus] = useState(false);
  return (
    <label style={{ display: "block", width: "100%" }}>
      <span style={{ display: "block", fontFamily: C.sans, fontSize: 10, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.tierra, marginBottom: 8, fontWeight: 500 }}>
        {label}{required && <span style={{ color: C.peach, marginLeft: 5 }}>•</span>}
      </span>
      <input type={type} value={value} placeholder={placeholder}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", borderRadius: 12,
          border: `1px solid ${focus ? C.tierra : C.grisCalido}`, background: C.alabaster,
          fontFamily: C.sans, fontSize: 15, color: C.negro, outline: "none", letterSpacing: "0.02em",
          transition: "border .2s ease, box-shadow .2s ease", boxShadow: focus ? `0 0 0 4px ${C.beige}` : "none" }} />
    </label>
  );
}

/* ---------- PHONE INPUT (country dial code + auto-detect on paste) ---------- */
function PhoneInput({ label, value, onChange, required, hint }) {
  const [focus, setFocus] = useState(false);
  const v = value || { code: "+502", number: "" };
  const handleNumber = (raw) => {
    const parsed = parsePhone(raw, v.code);
    onChange({ code: parsed.code, number: parsed.number });
  };
  return (
    <label style={{ display: "block", width: "100%" }}>
      <span style={{ display: "block", fontFamily: C.sans, fontSize: 10, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.tierra, marginBottom: 8, fontWeight: 500 }}>
        {label}{required && <span style={{ color: C.peach, marginLeft: 5 }}>•</span>}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select value={v.code} onChange={(e) => onChange({ ...v, code: e.target.value })}
            style={{ appearance: "none", WebkitAppearance: "none", padding: "14px 30px 14px 14px", borderRadius: 12,
              border: `1px solid ${C.grisCalido}`, background: C.alabaster, fontFamily: C.sans, fontSize: 14,
              color: C.negro, outline: "none", cursor: "pointer", letterSpacing: "0.02em" }}>
            {DIAL_CODES.map((c) => <option key={c.code + c.iso} value={c.code}>{c.iso} {c.code}</option>)}
          </select>
          <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <Icon name="chevron" size={14} color={C.tierra} />
          </span>
        </div>
        <input type="tel" value={v.number} placeholder="1234 5678"
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onChange={(e) => handleNumber(e.target.value)}
          style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "14px 16px", borderRadius: 12,
            border: `1px solid ${focus ? C.tierra : C.grisCalido}`, background: C.alabaster,
            fontFamily: C.sans, fontSize: 15, color: C.negro, outline: "none", letterSpacing: "0.02em",
            transition: "border .2s ease, box-shadow .2s ease", boxShadow: focus ? `0 0 0 4px ${C.beige}` : "none" }} />
      </div>
      {hint && <span style={{ display: "block", fontFamily: C.sans, fontSize: 10.5, color: C.tierra, marginTop: 7, letterSpacing: "0.02em", lineHeight: 1.5 }}>{hint}</span>}
    </label>
  );
}

/* ---------- AI DOCUMENT READER ----------
   Sends the uploaded image to Claude vision, extracts EXACTLY what's on
   the document (never invents), and validates legibility / document type. */

/* claude.complete caps the whole request at ~262 KB. A modern phone photo's
   base64 easily exceeds that, so the model never sees it and the read fails
   even on a perfectly clear document. We downscale + JPEG-compress in-browser
   until the base64 fits a safe budget (documents stay legible at ~900px). */
function loadImg(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
async function downscaleForAI(dataUrl, budget = 180000) {
  try {
    const img = await loadImg(dataUrl);
    const draw = (maxDim, q) => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      return c.toDataURL("image/jpeg", q);
    };
    let du = dataUrl;
    for (const [dim, q] of [[1400, 0.8], [1200, 0.75], [1024, 0.7], [900, 0.65], [800, 0.6], [680, 0.55]]) {
      du = draw(dim, q);
      const b64 = du.slice(du.indexOf(",") + 1);
      if (b64.length < budget) break;
    }
    return du;
  } catch (e) { return dataUrl; }
}

async function readDocumentAI(dataUrl) {
  const src = /^data:(.*?);base64,/.test(dataUrl || "") ? await downscaleForAI(dataUrl) : dataUrl;
  const m = /^data:(.*?);base64,(.*)$/.exec(src || "");
  if (!m) return { ok: false, reason: "invalid" };
  const media_type = m[1], data = m[2];
  const supported = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!supported.includes(media_type)) return { ok: false, reason: "invalid", canManual: true };
  const prompt = `Eres un lector de documentos de identidad. Observa ESTRICTAMENTE la imagen.
Extrae SOLO lo que realmente aparece en el documento. NUNCA inventes ni completes datos que no puedas leer con claridad.
Responde únicamente con un objeto JSON válido, sin texto adicional, con esta forma:
{"is_document": true|false, "legible": true|false, "doc_type": "dpi|pasaporte|licencia|otro|ninguno", "full_name": "", "id_number": ""}
Reglas:
- is_document=false si la imagen NO es un documento de identidad (foto de una persona, paisaje, captura, objeto, etc.).
- legible=false si el documento está borroso, cortado, muy oscuro o no se pueden leer nombre ni número.
- full_name debe incluir nombres + apellidos, EXACTAMENTE como aparecen. id_number es el CUI / número de identificación. Si algo no se lee, deja el campo vacío "".`;
  try {
    let resp;
    const backend = window.Backend;
    if (backend && backend.isConnected && backend.isConnected()) {
      // Producción: la lectura ocurre en el backend (Anthropic Claude),
      // la llave vive server-side. Ver readDocument_ en Code.gs.
      const json = await backend.call("readDocument", { media_type, data, prompt });
      resp = json && json.text || "";
    } else if (window.claude && window.claude.complete) {
      // Vista previa / desarrollo dentro del editor.
      resp = await window.claude.complete({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "image", source: { type: "base64", media_type, data } },
        ]}],
      });
    } else {
      return { ok: false, reason: "invalid", isDocument: true, canManual: true };
    }
    const jm = /\{[\s\S]*\}/.exec(resp);
    if (!jm) return { ok: false, reason: "invalid", canManual: true };
    const j = JSON.parse(jm[0]);
    if (!j.is_document) return { ok: false, reason: "notId", isDocument: false };
    if (!j.legible || !(j.full_name || "").trim()) return { ok: false, reason: "invalid", isDocument: true };
    return { ok: true, isDocument: true, name: (j.full_name || "").trim(), id: (j.id_number || "").trim(), docType: j.doc_type };
  } catch (e) {
    // vision unavailable / network → allow manual entry so the flow never deadlocks
    return { ok: false, reason: "invalid", isDocument: true, canManual: true };
  }
}

/* ---------- DOCUMENT UPLOADER (upload → AI read → confirm / correct) ---------- */
function DocUploader({ t, roleLabel, badge, badgeColor, doc, update }) {
  const camRef = useRef(null);
  const fileRef = useRef(null);
  const d = doc || {};
  const pick = (file, inputEl) => {
    // reset the input so re-selecting the SAME file fires onChange again
    if (inputEl) inputEl.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      update({ file: file.name, dataUrl: reader.result, reading: true, error: null, manual: false, name: "", id: "" });
      const res = await readDocumentAI(reader.result);
      if (res.ok) {
        update({ reading: false, error: null, name: res.name, id: res.id, isDocument: true });
      } else {
        const attempts = (d.attempts || 0) + 1;
        // 1st–2nd try: inline retry with escalating tips.
        // 3rd try on an image we DO recognize as a document but can't read
        // cleanly → offer the friendly fallback popup (clear photo OR keep
        // this photo + type the data). The photo is always kept & submitted.
        const showFallback = attempts >= 3 && res.isDocument === true;
        update({ reading: false, error: res.reason, canManual: !!res.canManual, attempts, lastWasDocument: !!res.isDocument, showFallback });
      }
    };
    reader.readAsDataURL(file);
  };
  const showFields = d.file && !d.reading && (!d.error || d.manual);
  const pickBtn = (iconName, label, onClick, primary) => (
    <button className="sp-btn" onClick={onClick}
      style={{ background: primary ? C.negro : C.white, color: primary ? C.alabaster : C.negro,
        border: primary ? "none" : `1px solid ${C.grisCalido}`, borderRadius: 12, padding: "11px 15px",
        fontFamily: C.sans, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 500 }}>
      <Icon name={iconName} size={15} color={primary ? C.alabaster : C.negro} /> {label}
    </button>
  );
  return (
    <div style={{ background: C.white, border: `1px solid ${d.file && !d.error ? C.taupe : (d.error ? "rgba(233,130,106,.5)" : C.grisCalido)}`,
      borderRadius: 18, padding: "18px 20px", transition: "border .2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontFamily: C.serif, fontSize: 18, color: C.negro }}>{roleLabel}</span>
          {badge && <span style={{ fontFamily: C.sans, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase",
            background: badgeColor || C.peach, color: C.white, padding: "4px 9px", borderRadius: 999, fontWeight: 600 }}>{badge}</span>}
          {d.file && !d.error && <span style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.taupe, fontWeight: 500 }}>✓</span>}
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={(e) => pick(e.target.files[0], e.target)} />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => pick(e.target.files[0], e.target)} />
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          {pickBtn("camera", t.takePhoto, () => camRef.current.click(), !d.file)}
          {pickBtn("image", t.chooseFile, () => fileRef.current.click(), false)}
        </div>
      </div>

      {d.reading && <div style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, marginTop: 14, display: "flex", alignItems: "center", gap: 9, letterSpacing: "0.02em" }}><Spinner color={C.taupe} /> {t.reading}</div>}

      {d.error && !d.manual && (
        <div style={{ marginTop: 14, background: "#FBEEEA", border: "1px solid rgba(233,130,106,.3)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
            {d.dataUrl && <img src={d.dataUrl} alt="" style={{ width: 46, height: 46, borderRadius: 9, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.grisCalido}` }} />}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: C.sans, fontSize: 12, color: C.negro, lineHeight: 1.55, margin: 0, letterSpacing: "0.01em" }}>
                {d.error === "notId" ? t.docNotId : ((d.attempts || 1) >= 2 ? t.docInvalid2 : t.docInvalid)}
              </p>
              {d.error !== "notId" && <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, lineHeight: 1.5, margin: "7px 0 0", letterSpacing: "0.02em" }}>{t.docTips}</p>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button className="sp-btn" onClick={() => fileRef.current.click()} style={{ background: C.negro, color: C.alabaster, border: "none",
              borderRadius: 10, padding: "9px 15px", fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontWeight: 500 }}>{t.retry}</button>
            {d.canManual && <button onClick={() => update({ manual: true, error: null, isDocument: true })} className="sp-link" style={{ background: "transparent", border: "none",
              fontFamily: C.sans, fontSize: 11, color: C.tierra, cursor: "pointer", letterSpacing: "0.02em", textDecoration: "underline" }}>{t.docFallbackManual}</button>}
          </div>
        </div>
      )}

      {d.showFallback && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(62,63,63,.42)", backdropFilter: "blur(4px)",
          display: "grid", placeItems: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) update({ showFallback: false }); }}>
          <div style={{ width: "min(440px,94vw)", background: C.white, borderRadius: 22, padding: "clamp(24px,5vw,30px)",
            boxShadow: "0 28px 80px rgba(62,63,63,.18)", animation: "rise .3s " + C.ease + " both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <Sparkle size={13} color={C.peach} />
              <span style={{ fontFamily: C.serif, fontSize: 22, color: C.negro, lineHeight: 1.15 }}>{t.docFallbackTitle}</span>
            </div>
            {d.dataUrl && <img src={d.dataUrl} alt="" style={{ width: "100%", maxHeight: 150, objectFit: "contain", borderRadius: 12, border: `1px solid ${C.grisCalido}`, background: C.beige, marginBottom: 14 }} />}
            <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, margin: "0 0 18px", letterSpacing: "0.01em" }}>{t.docFallbackBody}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="sp-btn" onClick={() => { update({ showFallback: false }); camRef.current.click(); }}
                style={{ background: C.negro, color: C.alabaster, border: "none", borderRadius: 12, padding: "13px 16px",
                  fontFamily: C.sans, fontSize: 11.5, letterSpacing: "0.04em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Icon name="camera" size={15} color={C.alabaster} /> {t.docFallbackUpload}
              </button>
              <button className="sp-btn" onClick={() => update({ showFallback: false, manual: true, error: null, isDocument: true })}
                style={{ background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 12, padding: "13px 16px",
                  fontFamily: C.sans, fontSize: 11.5, letterSpacing: "0.04em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Icon name="edit" size={15} color={C.negro} /> {t.docFallbackManual}
              </button>
            </div>
            <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, lineHeight: 1.5, margin: "14px 0 0", textAlign: "center", letterSpacing: "0.02em" }}>{t.docFallbackTip}</p>
          </div>
        </div>
      )}

      {showFields && (
        <div style={{ background: C.beige, borderRadius: 12, padding: 16, marginTop: 14, animation: "rise .4s " + C.ease + " both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
            <Sparkle size={11} color={C.taupe} />
            <span style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.taupe, fontWeight: 500 }}>{d.manual ? t.docManualLabel : t.autoFilled}</span>
          </div>
          {d.manual && d.dataUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <img src={d.dataUrl} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: "cover", border: `1px solid ${C.grisCalido}` }} />
              <span style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, letterSpacing: "0.02em", lineHeight: 1.4 }}>{t.docPhotoKept}</span>
            </div>
          )}
          <Field label={t.fullName} value={d.name || ""} required onChange={(v) => update({ name: v })} />
          <div style={{ marginTop: 12 }}><Field label={t.idNumber} value={d.id || ""} onChange={(v) => update({ id: v })} /></div>
          <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "12px 0 0", letterSpacing: "0.02em", lineHeight: 1.5 }}>{t.confirmData}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- LAYOUT WRAPPERS ---------- */
function Screen({ children, maxW = 460, flowTop = true, pad }) {
  return (
    <div className="sp-screen" style={{ position: "relative", background: C.alabaster, alignItems: "center", overflow: "hidden" }}>
      {flowTop && (
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: "min(820px,150%)", height: 320, opacity: 0.4, pointerEvents: "none" }}>
          <FlowLine variant={2} width={64} />
        </div>
      )}
      <div className="sp-center" style={{ maxWidth: maxW, position: "relative", zIndex: 2,
        padding: pad || "clamp(30px,6vh,76px) clamp(20px,5vw,28px) 64px", margin: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function TopBar({ t, onSwitchLang, onHome }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
      <button onClick={onHome} className="sp-link" style={{ background: "none", border: "none", padding: 0, cursor: onHome ? "pointer" : "default", display: "flex" }}>
        <LogoS size={28} />
      </button>
      <button onClick={onSwitchLang} className="sp-link" style={{ background: "transparent", border: `1px solid ${C.grisCalido}`,
        borderRadius: 999, padding: "7px 15px", fontFamily: C.sans, fontSize: 10, letterSpacing: "0.18em",
        color: C.tierra, cursor: "pointer", fontWeight: 500 }}>
        {t.code === "es" ? "EN" : "ES"}
      </button>
    </div>
  );
}

function Steps({ step, t, labels }) {
  const ls = labels || [t.stepBooker, t.stepDocs, t.stepContact, t.stepRules];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 30px", maxWidth: 360 }}>
      {ls.map((l, i) => (
        <React.Fragment key={l}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
              background: i <= step ? C.negro : C.alabaster, border: `1px solid ${i <= step ? C.negro : C.grisCalido}`,
              transition: "all .36s " + C.ease }}>
              {i < step
                ? <Icon name="check" size={13} color={C.alabaster} />
                : <span style={{ color: i === step ? C.peach : C.tierra, fontSize: 10, fontFamily: C.sans, fontWeight: 600 }}>{i + 1}</span>}
            </div>
            <span style={{ fontFamily: C.sans, fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase",
              color: i <= step ? C.negro : C.tierra, fontWeight: 500 }}>{l}</span>
          </div>
          {i < ls.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? C.negro : C.grisCalido,
            margin: "0 8px", marginBottom: 18, transition: "background .36s " + C.ease }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function H({ children, sub, align = "center" }) {
  return (
    <div style={{ textAlign: align, marginBottom: 28 }}>
      <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 36, lineHeight: 1.08, color: C.negro,
        margin: 0, letterSpacing: "-0.01em", textWrap: "balance" }}>{children}</h1>
      {sub && <p style={{ fontFamily: C.sans, fontSize: 13.5, lineHeight: 1.65, color: C.tierra,
        margin: align === "center" ? "14px auto 0" : "14px 0 0", maxWidth: 380, letterSpacing: "0.02em", textWrap: "pretty" }}>{sub}</p>}
    </div>
  );
}

function Alert({ tone = "soft", title, body }) {
  const block = tone === "block";
  return (
    <div style={{ display: "flex", gap: 13, alignItems: "flex-start",
      background: block ? "#FBEEEA" : C.beige, border: `1px solid ${block ? "rgba(233,130,106,.3)" : C.grisCalido}`,
      borderRadius: 16, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}><Sparkle size={13} color={C.peach} /></div>
      <div>
        <div style={{ fontFamily: C.serif, fontSize: 18, color: C.negro, marginBottom: 5, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontFamily: C.sans, fontSize: 12.5, lineHeight: 1.6, color: C.tierra, letterSpacing: "0.01em" }}>{body}</div>
      </div>
    </div>
  );
}

function Spinner({ color = C.alabaster, size = 14 }) {
  return <span className="sp-spin" style={{ width: size, height: size, border: `2px solid ${C.grisCalido}`,
    borderTopColor: color, borderRadius: "50%", display: "inline-block" }} />;
}

/* ---------- LINE-ART ICONS (Lucide-weight, 1.4 stroke) ---------- */
const Icon = ({ name, size = 22, color = C.negro, strokeWidth = 1.4 }) => {
  const s = { width: size, height: size, stroke: color, strokeWidth, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  const p = {
    checkin: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4M8 14l3 3 5-6" /></>,
    visits: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11l2 2 4-4" /></>,
    parqueo: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 16V8h3.5a2.5 2.5 0 0 1 0 5H9" /></>,
    factura: <><path d="M6 3h9l3 3v13.5a.5.5 0 0 1-.8.4L15 18l-1.5 1.4a.7.7 0 0 1-1 0L11 18l-1.5 1.4a.7.7 0 0 1-1 0L7 18l-1.2 1.3a.5.5 0 0 1-.8-.4V3z" /><path d="M9 8h6M9 11h6M9 14h4" /></>,
    flame: <><path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1-.5-2-.5-2 2 1 3.5 3 3.5 5.5a5 5 0 0 1-10 0C7 9 11 8 12 3z" /></>,
    tv: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M8 21h8" /></>,
    wifi: <><path d="M2 8.5C5.5 5.5 18.5 5.5 22 8.5M5 12c3-2.5 11-2.5 14 0M8 15.5c2-1.5 6-1.5 8 0" /><circle cx="12" cy="19" r="1" /></>,
    manual: <><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z" /><path d="M8 7h7M8 11h7M8 15h4" /></>,
    chat: <><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z" /></>,
    review: <><path d="M12 3l2.5 6 6.5.5-5 4.3 1.6 6.4L12 16.8 6.4 20.2 8 13.8l-5-4.3L9.5 9z" /></>,
    emergency: <><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M12 8v4M12 16h.01" /></>,
    activities: <><path d="M3 17l4-8 4 5 3-6 4 9" /><circle cx="18" cy="6" r="2" /></>,
    amenities: <><path d="M3 21V10l9-7 9 7v11" /><path d="M9 21v-6h6v6" /></>,
    upsells: <><path d="M12 2l2.4 5.6L20 9l-4 4.3.9 6.1L12 16.7 7.1 19.4 8 13.3 4 9l5.6-1.4z" /></>,
    selflove: <><path d="M12 21s-7-4.5-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 3.5C19 16.5 12 21 12 21z" /></>,
    check: <path d="M5 12l4 4 10-11" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
    camera: <><path d="M4 8a2 2 0 0 1 2-2h1.5l1-2h5l1 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.4" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.6" /><path d="M21 16l-5-5-8 8" /></>,
    download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 20h16" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    pin: <><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
    phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 18v3a1 1 0 0 1-1 1A16 16 0 0 1 3 6a1 1 0 0 1 1-1" />,
    whatsapp: <><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.2-5.3A8.5 8.5 0 1 1 21 11.5z" /><path d="M8.5 9c0 4 2.5 6.5 6.5 6.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    chevron: <path d="M6 9l6 6 6-6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronUp: <path d="M6 15l6-6 6 6" />,
    alert: <><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
    key: <><circle cx="8" cy="14" r="4" /><path d="M11 11l9-9M17 4l3 3M14 7l3 3" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <><path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.1A9.6 9.6 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.3 4M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 003.6-.7" /></>,
    x: <path d="M6 6l12 12M18 6L6 18" />,
  };
  return <svg viewBox="0 0 24 24" style={s} aria-hidden="true">{p[name]}</svg>;
};

Object.assign(window, {
  LogoMain, LogoS, LogoStamp, Sparkle, FlowLine, Brush3D, WeaveHero, Grain, Btn, Field,
  PhoneInput, DocUploader, readDocumentAI, Screen, TopBar, Steps, H, Alert, Spinner, Icon,
});
