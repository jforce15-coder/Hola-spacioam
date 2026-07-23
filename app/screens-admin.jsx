/* ============================================================
   SPACIO AM — ADMIN login + control panel + reservation summary
   · Hidden login (email + password) → control panel
   · Roster pulled from Hospitable (API / MCP adapter; demo fallback)
   · Quick-view dropdown (today default) + status + property filters
   · Compact, image-free list for fast scanning
   · Per row: view summary · download (print → PDF) · resend email
   · Summary = all collected data + identity docs watermarked
   ============================================================ */
const { useState: useStateAd, useMemo: useMemoAd, useEffect: useEffectAd, useRef: useRefAd, useCallback: useCallbackAd } = React;

/* ---------- ADMIN LOGIN MODAL ---------- */
function AdminLogin({ t, onClose, onSuccess }) {
  const [email, setEmail] = useStateAd("");
  const [pass, setPass] = useStateAd("");
  const [err, setErr] = useStateAd("");
  const [busy, setBusy] = useStateAd(false);
  const submit = () => {
    setErr(""); setBusy(true);
    const e = (email || "").trim().toLowerCase();
    // primary admin + any local admins resolve instantly
    if (checkAdminLogin(email, pass)) { setBusy(false); onSuccess(e); return; }
    // otherwise check the backend (admins created on another device)
    Backend.adminLogin(e, pass).then((r) => {
      setBusy(false);
      if (r && r.ok) onSuccess(e);
      else setErr(t.adminLoginErr);
    }).catch(() => { setBusy(false); setErr(t.adminLoginErr); });
  };
  const fieldStyle = { width: "100%", boxSizing: "border-box", padding: "13px 15px", borderRadius: 12,
    border: `1px solid ${C.grisCalido}`, background: C.alabaster, fontFamily: C.sans, fontSize: 15, color: C.negro, outline: "none", letterSpacing: "0.01em" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(62,63,63,.42)", backdropFilter: "blur(4px)",
      display: "grid", placeItems: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "min(400px,94vw)", background: C.white, borderRadius: 22, padding: "clamp(26px,5vw,34px)",
        boxShadow: "0 28px 80px rgba(62,63,63,.18)", animation: "rise .3s " + C.ease + " both" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <span style={{ width: 52, height: 52, borderRadius: 15, background: C.beige, display: "grid", placeItems: "center" }}>
            <Icon name="lock" size={22} color={C.negro} />
          </span>
        </div>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: C.serif, fontSize: 26, color: C.negro, lineHeight: 1.1 }}>{t.adminLoginTitle}</div>
          <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, margin: "8px 0 0", letterSpacing: "0.02em" }}>{t.adminLoginSub}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <span style={{ display: "block", fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, marginBottom: 7, fontWeight: 500 }}>{t.adminLoginEmail}</span>
            <input type="email" value={email} autoFocus onChange={(e) => { setEmail(e.target.value); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && submit()} style={fieldStyle} placeholder="nombre@spacioam.com" />
          </div>
          <div>
            <span style={{ display: "block", fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, marginBottom: 7, fontWeight: 500 }}>{t.adminLoginPass}</span>
            <input type="password" value={pass} onChange={(e) => { setPass(e.target.value); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && submit()} style={fieldStyle} placeholder="••••••••" />
          </div>
          {err && <p style={{ color: C.peach, fontFamily: C.sans, fontSize: 12, margin: 0, letterSpacing: "0.02em" }}>{err}</p>}
          <div style={{ marginTop: 6 }}>
            <Btn full onClick={submit} disabled={busy || !email || !pass}>{busy ? <><Spinner /> {t.validating}</> : t.adminLoginBtn}</Btn>
          </div>
          <p style={{ textAlign: "center", fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "4px 0 0", letterSpacing: "0.03em" }}>{t.adminLoginHint}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- BACKEND CONNECTION MODAL ---------- */
function HospitablePanel({ t, onClose, onSaved }) {
  const cfg0 = Backend.loadConfig();
  const fromConfig = (window.SPACIO_CONFIG && window.SPACIO_CONFIG.backendUrl) || "";
  const [endpoint, setEndpoint] = useStateAd(cfg0.endpoint || fromConfig || "");
  const [testState, setTestState] = useStateAd(""); // "" | testing | ok | fail
  const connected = Backend.isConnected();
  const fieldStyle = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12,
    border: `1px solid ${C.grisCalido}`, background: C.alabaster, fontFamily: C.sans, fontSize: 13, color: C.negro, outline: "none", letterSpacing: "0.01em" };
  const save = () => { Backend.saveConfig({ endpoint: endpoint.trim() }); onSaved(); };
  const disconnect = () => { Backend.disconnect(); onSaved(); };
  const test = async () => {
    setTestState("testing");
    try {
      Backend.saveConfig({ endpoint: endpoint.trim() });
      await Backend.ping();
      setTestState("ok");
    } catch (e) { setTestState("fail"); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(62,63,63,.42)", backdropFilter: "blur(4px)",
      display: "grid", placeItems: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "min(460px,94vw)", background: C.white, borderRadius: 22, padding: "clamp(24px,5vw,32px)",
        boxShadow: "0 28px 80px rgba(62,63,63,.18)", animation: "rise .3s " + C.ease + " both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: C.serif, fontSize: 24, color: C.negro, lineHeight: 1.1 }}>{t.hospTitle}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#1F8A5B" : C.taupe }} />
              <span style={{ fontFamily: C.sans, fontSize: 11.5, color: connected ? "#1F8A5B" : C.tierra, letterSpacing: "0.02em" }}>{connected ? t.hospConnected : t.hospDisconnected}</span>
            </div>
          </div>
          <button onClick={onClose} className="sp-btn" style={{ width: 38, height: 38, borderRadius: 11, border: `1px solid ${C.grisCalido}`, background: C.white, cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="x" size={17} color={C.negro} /></button>
        </div>

        <span style={{ display: "block", fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, marginBottom: 7, fontWeight: 500 }}>{t.hospEndpoint}</span>
        <input value={endpoint} onChange={(e) => { setEndpoint(e.target.value); setTestState(""); }} style={fieldStyle} placeholder={t.hospEndpointPh} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, minHeight: 22 }}>
          <button onClick={test} disabled={!endpoint.trim() || testState === "testing"} className="sp-btn"
            style={{ background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 10, padding: "8px 14px",
              fontFamily: C.sans, fontSize: 11, letterSpacing: "0.04em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7, opacity: !endpoint.trim() ? 0.5 : 1 }}>
            {testState === "testing" ? <><Spinner /> {t.hospTesting}</> : <><Icon name="refresh" size={14} color={C.negro} /> {t.hospTest}</>}
          </button>
          {testState === "ok" && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: C.sans, fontSize: 12, color: "#1F8A5B", letterSpacing: "0.02em" }}><Icon name="check" size={15} color="#1F8A5B" /> {t.hospOk}</span>}
          {testState === "fail" && <span style={{ fontFamily: C.sans, fontSize: 12, color: C.peach, letterSpacing: "0.02em" }}>{t.hospFail}</span>}
        </div>

        <p style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, lineHeight: 1.6, margin: "16px 0 18px", letterSpacing: "0.01em" }}>{t.hospNote}</p>

        <div style={{ display: "flex", gap: 10 }}>
          {connected && <Btn variant="outline" onClick={disconnect}>{t.hospDisconnect}</Btn>}
          <div style={{ flex: 1 }} />
          <Btn variant="peach" onClick={save} disabled={!endpoint.trim()}>{t.hospSave}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------- WATERMARKED IDENTITY DOCUMENT ----------
   Circular Spacio AM stamp + the phrase "Documentación de registro"
   repeated in evenly-spaced parallel rows across the whole document,
   all at low opacity so the ID data stays fully legible. */
function WatermarkedDoc({ src, t }) {
  const label = (t.sumWatermark || "Documentación de registro").toUpperCase();
  // ONE tile holds the phrase drawn HORIZONTALLY (never rotated inside the tile),
  // in a 2-row brick layout so there are no vertical alignment channels. The
  // whole layer is then rotated as a unit via CSS transform → rows stay perfectly
  // straight and continuous edge to edge, with no clipping or overlap. Bold + a
  // touch less transparency per the brand request.
  const W = 380, H = 116;
  const wm = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>` +
    `<g font-family='Montserrat,Arial,sans-serif' font-size='12.5' font-weight='700' letter-spacing='2.5' fill='%23938B8A' fill-opacity='0.25'>` +
    `<text x='8' y='42'>${label}</text>` +
    `<text x='${8 + W / 2}' y='100'>${label}</text>` +
    `<text x='${8 - W / 2}' y='100'>${label}</text>` +
    `</g></svg>`
  );
  if (!src) {
    return (
      <div style={{ minHeight: 120, borderRadius: 12, border: `1px dashed ${C.grisCalido}`, background: C.beige,
        display: "grid", placeItems: "center", fontFamily: C.sans, fontSize: 12, color: C.tierra, letterSpacing: "0.02em", padding: 20, textAlign: "center" }}>
        {t.sumNoImage}
      </div>
    );
  }
  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.grisCalido}`, background: C.white }}>
      <img src={src} alt="documento" style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }} />
      {/* straight parallel rows: horizontal tile, whole layer rotated as a unit */}
      <div style={{ position: "absolute", top: "-60%", left: "-30%", width: "160%", height: "220%",
        transform: "rotate(-22deg)", transformOrigin: "center", backgroundImage: `url("data:image/svg+xml,${wm}")`,
        backgroundRepeat: "repeat", backgroundSize: `${W}px ${H}px`, pointerEvents: "none" }} />
      {/* small circular stamp in a corner — neon peach tint, 40% opacity */}
      <div style={{ position: "absolute", right: "5%", bottom: "6%", width: "8%", maxWidth: 36, aspectRatio: "1", opacity: 0.6,
        pointerEvents: "none", background: "#FF6F52",
        WebkitMaskImage: "url(assets/brand/logo-stamp-transparent.png)", maskImage: "url(assets/brand/logo-stamp-transparent.png)",
        WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskPosition: "center", maskPosition: "center" }} />
    </div>
  );
}

/* ---------- SUMMARY ROW HELPERS ---------- */
function SumRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: "10px 0", borderBottom: `1px solid ${C.beige}` }}>
      <span className="sum-label" style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: C.earthDark || "#6E6663", fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: C.sans, fontSize: 14, color: C.negro, textAlign: "right", letterSpacing: "0.01em", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
function SumSection({ title, children }) {
  return (
    <div className="sum-section" style={{ marginTop: 26 }}>
      <div style={{ fontFamily: C.serif, fontSize: 20, color: C.negro, marginBottom: 6, lineHeight: 1.15 }}>{title}</div>
      {children}
    </div>
  );
}
const phoneStr = (p) => {
  if (!p) return null;
  if (typeof p === "string") return p.trim() || null;
  return (p.number || "").trim() ? `${p.code || "+502"} ${p.number}` : null;
};

/* Robust print: clone the summary into a body-level portal so no ancestor
   (fixed overlay / #root / transforms) can clip it. Critically, WAIT for every
   image (ID docs + stamps) to decode before printing — otherwise iOS prints
   collapsed-height boxes and truncates to a single page. */
function printSummary() {
  const src = document.getElementById("summary-print");
  if (!src) { window.print(); return; }
  const clone = src.cloneNode(true);
  clone.removeAttribute("id");
  clone.querySelectorAll(".sum-noprint").forEach((n) => n.remove());
  clone.style.width = "100%"; clone.style.maxWidth = "none"; clone.style.boxShadow = "none";
  clone.style.borderRadius = "0"; clone.style.animation = "none"; clone.style.padding = "0";

  // Open the summary as its OWN top-level document and print that. This is the
  // only reliable way when the app runs inside an iframe (e.g. a preview): an
  // in-place window.print() there prints the whole parent page, not the report.
  const css = "@page{margin:14mm}" +
    "*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box}" +
    "html,body{margin:0;padding:0;background:#fff;color:#3E3F3F;font-family:Montserrat,-apple-system,system-ui,Segoe UI,sans-serif}" +
    "body{padding:24px}" +
    "img{max-width:100%!important;max-height:190mm!important;height:auto!important;display:block}" +
    ".sum-section{break-inside:auto;page-break-inside:auto}" +
    ".sum-guest-list{display:block!important;break-inside:auto;page-break-inside:auto}" +
    ".sum-guest-list>*{margin-bottom:18px}" +
    ".sum-card{break-inside:avoid;page-break-inside:avoid}" +
    /* each registered guest prints on its own page so info/photos never split; rules stay with the last guest */
    ".sum-guest-list>.sum-card{break-before:page;page-break-before:always}" +
    ".sum-noprint{display:none!important}";
  const doc = "<!doctype html><html><head><meta charset='utf-8'><base href='" + location.href + "'><title>Resumen de registro</title><style>" +
    css + "</style></head><body>" + clone.outerHTML + "</body></html>";

  let w = null;
  try { w = window.open("", "_blank"); } catch (e) { w = null; }
  if (w && w.document) {
    w.document.open(); w.document.write(doc); w.document.close();
    const go = () => {
      const imgs = Array.from(w.document.images || []);
      Promise.all(imgs.map((im) => im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = () => r(); })))
        .then(() => setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 300));
    };
    if (w.document.readyState === "complete") go(); else w.onload = go;
    return;
  }
  // fallback (popup blocked): in-place portal print
  const old = document.getElementById("print-portal");
  if (old) old.remove();
  const portal = document.createElement("div");
  portal.id = "print-portal";
  portal.appendChild(clone);
  document.body.appendChild(portal);
  let done = false;
  const cleanup = () => { if (done) return; done = true; portal.remove(); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  const imgs = Array.from(portal.querySelectorAll("img"));
  Promise.all(imgs.map((img) => (img.complete && img.naturalWidth > 0) ? Promise.resolve() : (img.decode ? img.decode().catch(() => {}) : new Promise((res) => { img.onload = img.onerror = () => res(); }))))
    .then(() => requestAnimationFrame(() => setTimeout(() => { try { window.print(); } catch (e) {} }, 150)));
  setTimeout(cleanup, 60000);
}

/* ============================================================
   RESERVATION SUMMARY — full document (email / PDF to admins)
   ============================================================ */
function ReservationSummary({ t, h, rec: localRec, onClose, onResend, autoPrint, avail }) {
  const lang = t.code;
  const es = lang === "es";
  const av = avail || { email: false, whatsapp: false };
  const generated = new Date().toLocaleString(lang === "en" ? "en-US" : "es-GT", { dateStyle: "long", timeStyle: "short" });
  const [fetchedRec, setFetchedRec] = useStateAd(null);
  const [loadingRec, setLoadingRec] = useStateAd(false);
  const rec = localRec || fetchedRec;
  const guests = rec?.guests || [];
  const booker = rec?.booker;
  const sumDone = !!rec || h.statusForm === "completo";
  // no local record but the booking is completed → pull the full data from the backend
  useEffectAd(() => {
    if (!localRec && h.statusForm === "completo" && Backend.isConnected()) {
      setLoadingRec(true);
      Backend.getRegistration(h.code).then((r) => { setFetchedRec(r); setLoadingRec(false); });
    }
  }, []);
  useEffectAd(() => {
    if (!autoPrint) return;
    if (loadingRec) return;            // espera a que el registro + documentos carguen
    // buffer para que las imágenes (data URLs) pinten antes de clonar/imprimir
    const id = setTimeout(() => printSummary(), 650);
    return () => clearTimeout(id);
  }, [autoPrint, loadingRec]);

  // registro de envíos de ESTA reserva (solo admin) — para ver si hubo problema
  const [logRows, setLogRows] = useStateAd(null);
  const [logOpen, setLogOpen] = useStateAd(false);
  useEffectAd(() => {
    if (!(Backend.isConnected && Backend.isConnected() && Backend.listSendLog)) return;
    Backend.listSendLog({ code: h.code, limit: 20 }).then((l) => { if (l) setLogRows(l); });
  }, []);

  return (
    <div className="sum-overlay" style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(62,63,63,.42)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", padding: "clamp(12px,4vh,40px) 0" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div id="summary-print" style={{ width: "min(720px,94vw)", background: C.white, borderRadius: 22, boxShadow: "0 28px 80px rgba(62,63,63,.18)",
        padding: "clamp(22px,4vw,40px)", animation: "rise .3s " + C.ease + " both" }}>

        {/* toolbar */}
        <div className="sum-noprint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <Btn variant="peach" onClick={printSummary} style={{ padding: "11px 18px" }}><Icon name="download" size={15} color={C.white} /> {t.sumPrint}</Btn>
            <Btn variant="ghost" onClick={av.email ? () => onResend("email") : undefined} disabled={!av.email} style={{ padding: "11px 16px", opacity: av.email ? 1 : 0.4, cursor: av.email ? "pointer" : "not-allowed" }} title={av.email ? "" : (es ? "Sin correo en esta propiedad" : "No email")}><Icon name="mail" size={15} color={C.negro} /> {es ? "Correo" : "Email"}</Btn>
            <Btn variant="ghost" onClick={av.whatsapp ? () => onResend("whatsapp") : undefined} disabled={!av.whatsapp} style={{ padding: "11px 16px", opacity: av.whatsapp ? 1 : 0.4, cursor: av.whatsapp ? "pointer" : "not-allowed" }} title={av.whatsapp ? (es ? "Incluye al administrador" : "") : (es ? "Sin WhatsApp en esta propiedad" : "No WhatsApp")}><Icon name="whatsapp" size={15} color={C.negro} /> WhatsApp</Btn>
          </div>
          <button onClick={onClose} className="sp-btn" style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${C.grisCalido}`,
            background: C.white, cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="x" size={18} color={C.negro} /></button>
        </div>

        {/* estado de envíos de esta reserva (solo admin, no se imprime) — colapsable */}
        {logRows && logRows.length > 0 && (() => {
          const errCount = logRows.filter((r) => r.status !== "OK").length;
          const okCount = logRows.length - errCount;
          return (
          <div className="sum-noprint" style={{ border: `1px solid ${C.grisCalido}`, borderRadius: 14, marginBottom: 20, background: C.alabaster, overflow: "hidden" }}>
            <button onClick={() => setLogOpen((v) => !v)} className="sp-btn" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              background: "transparent", border: "none", cursor: "pointer", padding: "12px 15px", textAlign: "left" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 700 }}>{es ? "Estado de envíos" : "Send status"}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: C.sans, fontSize: 10.5, color: "#177A4F", letterSpacing: "0.02em" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1F8A5B" }} />{okCount}</span>
                  {errCount > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: C.sans, fontSize: 10.5, color: C.peach, letterSpacing: "0.02em" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.peach }} />{errCount}</span>}
                </span>
              </span>
              <span style={{ flexShrink: 0, transform: logOpen ? "rotate(180deg)" : "none", transition: "transform .18s " + C.ease }}><Icon name="chevron" size={16} color={C.tierra} /></span>
            </button>
            {logOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "2px 15px 14px" }}>
              {logRows.map((r, i) => {
                const ok = r.status === "OK";
                const chLabel = { "email": es ? "Correo encargado" : "Manager email", "whatsapp": "WhatsApp", "email-huesped": es ? "Correo huésped" : "Guest email", "pdf": "PDF", "guardado": es ? "Guardado" : "Save" }[r.channel] || r.channel;
                let when = ""; try { when = new Date(r.at).toLocaleString(es ? "es-GT" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) {}
                return (
                  <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: ok ? "#1F8A5B" : C.peach }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontFamily: C.sans, fontSize: 11.5, color: C.negro, letterSpacing: "0.01em" }}><b>{chLabel}</b>{r.to ? ` · ${r.to}` : ""}</span>
                      {!ok && r.detail && <div style={{ fontFamily: C.sans, fontSize: 10.5, color: C.peach, lineHeight: 1.5, marginTop: 2, wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={r.detail}>{r.detail}</div>}
                    </div>
                    <span style={{ flexShrink: 0, fontFamily: C.sans, fontSize: 9.5, color: C.tierra, whiteSpace: "nowrap" }}>{when}</span>
                  </div>
                );
              })}
            </div>
            )}
          </div>
          );
        })()}

        {/* letterhead */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, paddingBottom: 20, borderBottom: `1.5px solid ${C.negro}` }}>
          <div>
            <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.28em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, marginBottom: 8 }}>{t.sumTitle}</div>
            <div style={{ fontFamily: C.serif, fontSize: 30, color: C.negro, lineHeight: 1.05 }}>{h.propertyShort}</div>
            {(() => {
              // only show the subtitle line when it adds info beyond the title
              const sub = (h.propertyName && h.propertyName !== h.propertyShort) ? h.propertyName : "";
              const apt = (h.apartment && !String(sub || h.propertyShort).includes(h.apartment)) ? h.apartment : "";
              const line = [sub, apt].filter(Boolean).join(" · ");
              return line ? <div style={{ fontFamily: C.sans, fontSize: 12, color: C.negro, marginTop: 4, letterSpacing: "0.02em" }}>{line}</div> : null;
            })()}
          </div>
          <LogoStamp size={64} />
        </div>

        {/* status pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: sumDone ? "rgba(31,138,91,.12)" : C.beige,
            border: `1px solid ${sumDone ? "rgba(31,138,91,.4)" : C.grisCalido}`, borderRadius: 999, padding: "6px 13px",
            fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: sumDone ? "#177A4F" : C.negro, fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: sumDone ? "#1F8A5B" : C.taupe }} />
            {sumDone ? t.adminStatusDone : t.adminStatusPending}
          </span>
          <span style={{ fontFamily: C.sans, fontSize: 11, color: C.negro, letterSpacing: "0.02em" }}>{t.sumGenerated}: {generated}</span>
        </div>

        {rec?.docsFolderUrl && (
          <a href={rec.docsFolderUrl} target="_blank" rel="noopener" className="sum-noprint" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, textDecoration: "none",
            background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 10, padding: "9px 15px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.04em", fontWeight: 500 }}>
            <Icon name="download" size={14} color={C.negro} /> {t.sumOpenFolder}
          </a>
        )}

        {/* booking */}
        <SumSection title={t.sumBooking}>
          <SumRow label={t.sumBooking} value={h.code} />
          <SumRow label={t.checkin} value={`${h.checkin} · 3:00 PM`} />
          <SumRow label={t.checkout} value={`${h.checkout} · 11:00 AM`} />
          <SumRow label={t.capacity} value={`${t.upTo} ${h.maxCapacity}`} />
          <SumRow label={t.adminAssignedTo} value={h.assignedEmail} />
        </SumSection>

        {!rec && (
          <div style={{ marginTop: 22, background: C.beige, border: `1px solid ${C.grisCalido}`, borderRadius: 14, padding: "16px 18px",
            fontFamily: C.sans, fontSize: 12.5, color: C.negro, lineHeight: 1.6, letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: 10 }}>
            {loadingRec ? <><Spinner color={C.taupe} /> {t.reading}</> : (h.statusForm === "completo" ? t.adminDoneElsewhere : t.adminNoDocs)}
          </div>
        )}

        {rec && (<>
          {/* who booked */}
          <SumSection title={t.sumBookedBy}>
            <div style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, letterSpacing: "0.01em", lineHeight: 1.6 }}>
              {booker?.type === "third" ? t.sumBookerThird : t.sumBookerSelf}
            </div>
            {booker?.type === "third" && booker.doc && (
              <div className="sum-card" style={{ marginTop: 14, background: C.beige, borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.negro, fontWeight: 600, marginBottom: 10 }}>{t.sumManager}</div>
                <SumRow label={t.fullName} value={booker.doc.name} />
                <SumRow label={t.idNumber} value={booker.doc.id} />
                <SumRow label={t.phone} value={phoneStr(booker.phone)} />
                <SumRow label={t.emergency} value={phoneStr(booker.emergency)} />
                <SumRow label={t.email} value={booker.email} />
                {booker.doc.docImage && <div style={{ marginTop: 14 }}><WatermarkedDoc src={booker.doc.docImage} t={t} /></div>}
              </div>
            )}
          </SumSection>

          {/* contact */}
          <SumSection title={t.sumContact}>
            <SumRow label={t.email} value={rec.contact?.email} />
            <SumRow label={t.phone} value={phoneStr(rec.contact?.phone)} />
            <SumRow label={t.sumEmergency} value={phoneStr(rec.contact?.emergency)} />
          </SumSection>

          {/* guests + documents */}
          <SumSection title={`${t.sumGuests} (${guests.length})`}>
            <div className="sum-guest-list" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {guests.map((g, i) => (
                <div key={i} className="sum-card" style={{ border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "16px 18px", background: C.alabaster }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                    <span style={{ fontFamily: C.serif, fontSize: 18, color: C.negro }}>{t.sumGuest} {i + 1}</span>
                    {g.main && <span style={{ fontFamily: C.sans, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", background: C.peach, color: C.white, padding: "4px 9px", borderRadius: 999, fontWeight: 600 }}>{t.main}</span>}
                    {g.manual && <span style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tierra }}>· {t.editManual}</span>}
                  </div>
                  <SumRow label={t.fullName} value={g.name || "—"} />
                  <SumRow label={t.idNumber} value={g.id || "—"} />
                  <div style={{ marginTop: 14, fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.negro, fontWeight: 600, marginBottom: 8 }}>{t.sumDocs}</div>
                  {g.docImage
                    ? <WatermarkedDoc src={g.docImage} t={t} />
                    : g.docUrl
                      ? <a href={g.docUrl} target="_blank" rel="noopener" className="sum-noprint" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
                          background: C.negro, color: C.alabaster, borderRadius: 10, padding: "10px 16px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.04em", fontWeight: 500 }}>
                          <Icon name="review" size={14} color={C.alabaster} /> {t.sumViewDoc}</a>
                      : <WatermarkedDoc src={null} t={t} />}
                </div>
              ))}
            </div>
          </SumSection>

          {/* rules acceptance */}
          <SumSection title={t.sumRules}>
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start", background: C.beige, borderRadius: 14, padding: "14px 16px" }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="check" size={16} color="#1F8A5B" /></span>
              <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.negro, lineHeight: 1.6, letterSpacing: "0.01em" }}>
                {t.sumRulesAccepted}
                {rec.acceptedRulesAt && <span style={{ display: "block", color: C.negro, marginTop: 3, fontSize: 11.5 }}>
                  {new Date(rec.acceptedRulesAt).toLocaleString(lang === "en" ? "en-US" : "es-GT", { dateStyle: "long", timeStyle: "short" })}
                </span>}
              </div>
            </div>
          </SumSection>
        </>)}

        <div style={{ textAlign: "center", marginTop: 30, paddingTop: 20, borderTop: `1px solid ${C.beige}` }}>
          <div style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.06em", color: C.negro }}>hola@spacioam.com · spacioam.com</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- styled select ---------- */
function AdSelect({ label, value, onChange, options }) {
  return (
    <label style={{ display: "block", minWidth: 150 }}>
      <span style={{ display: "block", fontFamily: C.sans, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, marginBottom: 6, fontWeight: 600 }}>{label}</span>
      <div style={{ position: "relative" }}>
        <select value={value} onChange={(e) => onChange(e.target.value)}
          style={{ appearance: "none", WebkitAppearance: "none", width: "100%", padding: "10px 34px 10px 13px", borderRadius: 11,
            border: `1px solid ${C.grisCalido}`, background: C.white, fontFamily: C.sans, fontSize: 13, color: C.negro, cursor: "pointer", outline: "none", letterSpacing: "0.01em" }}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="chevron" size={15} color={C.tierra} /></span>
      </div>
    </label>
  );
}

/* ============================================================
   ADMIN SCREEN — roster with dropdown filters + actions
   ============================================================ */
function AdminScreen({ t, adminEmail, onBack, onSwitchLang }) {
  const [mode, setMode] = useStateAd("next3");        // yesterday · today · tomorrow · next3 · last3 · range
  const [status, setStatus] = useStateAd("both");     // both · pending · done
  const [property, setProperty] = useStateAd("all");
  const [from, setFrom] = useStateAd("");
  const [to, setTo] = useStateAd("");
  const [summary, setSummary] = useStateAd(null);
  const [toast, setToast] = useStateAd("");
  const [hospOpen, setHospOpen] = useStateAd(false);
  const [roster, setRoster] = useStateAd(null);       // null = loading
  const [meta, setMeta] = useStateAd(null);
  const [tab, setTab] = useStateAd("registros");
  const [connected, setConnected] = useStateAd(HospitableAPI.isConnected());
  const [refreshing, setRefreshing] = useStateAd(false);

  // cache-first: the stored DB is always the source of truth for display.
  const loadRoster = ({ full } = {}) => {
    if (full) {
      // Actualizar: sync live from Hospitable (persists names/photos to the
      // sheet), THEN re-read the cache so what we show == what's stored —
      // including status_form (completed), which the live feed doesn't carry.
      setRefreshing(true);
      Backend.listReservations()
        .then(() => Backend.listCached())
        .then((list) => { setRoster(list); setMeta(Backend._lastMeta); setRefreshing(false); })
        .catch(() => setRefreshing(false));
      return;
    }
    setRoster(null);
    // cache-only by default: the stored DB (synced 5am/3pm) is the source of
    // truth, so the panel loads instantly and doesn't flicker.
    Backend.listCached().then((list) => { setRoster(list); setMeta(Backend._lastMeta); });
  };
  useEffectAd(() => { loadRoster(); }, []);
  const [avail, setAvail] = useStateAd(() => { try { return JSON.parse(localStorage.getItem("spacioam_avail")) || {}; } catch (e) { return {}; } });
  useEffectAd(() => {
    if (!roster || !roster.length) return;
    if (!(Backend.isConnected && Backend.isConnected() && Backend.contactsAvailability)) return;
    const names = [...new Set(roster.map((r) => r.propertyName).filter(Boolean))];
    Backend.contactsAvailability(names).then((a) => { if (a) setAvail(a); });
  }, [roster]);
  const availFor = (h) => avail[h.propertyName] || { email: false, whatsapp: false };

  const store = loadStore();
  const records = store.records || {};
  const recordFor = (h) => {
    if (records[h.id]) return records[h.id];
    const r = findReservation(h.code);
    if (r && records[r.id]) return records[r.id];
    return null;
  };

  const isDone = (h, rec) => !!rec || h.statusForm === "completo";
  const rows = useMemoAd(() => {
    if (!roster) return null;
    // dedupe by normalized code — the sheet can hold repeated rows for a code
    // (e.g. an older empty-name row + a newer synced one). Keep the BEST:
    // prefer a row that has a real property name and/or is marked completo.
    const byCode = new Map();
    const score = (h) => (h.statusForm === "completo" ? 2 : 0) + (String(h.propertyName || "").trim() && h.propertyName !== "Spacio AM" ? 1 : 0);
    roster.forEach((h) => {
      const k = normCode(h.code) || h.id;
      const cur = byCode.get(k);
      if (!cur || score(h) > score(cur)) byCode.set(k, h);
    });
    const uniq = [...byCode.values()];
    const list = uniq.map((h) => ({ h, rec: recordFor(h), bucket: checkinBucket(h.checkin) }));
    const inRange = (iso) => {
      if (mode === "all") return true;
      if (mode === "range") {
        if (!from && !to) return true;
        const c = toDay(iso + "T12:00:00");
        if (from && c < toDay(from + "T12:00:00")) return false;
        if (to && c > toDay(to + "T12:00:00")) return false;
        return true;
      }
      const d = checkinDiff(iso);
      if (mode === "next3") return d >= 0 && d <= 2;   // hoy, mañana, pasado mañana
      if (mode === "last3") return d <= 0 && d >= -2;  // hoy y los 2 días previos
      if (mode === "yesterday") return d === -1;
      if (mode === "today") return d === 0;
      if (mode === "tomorrow") return d === 1;
      return true;
    };
    return list
      .filter((row) => inRange(row.h.checkin))
      .filter((row) => property === "all" || row.h.propertyName === property)
      .filter((row) => status === "both" || (status === "done" ? isDone(row.h, row.rec) : !isDone(row.h, row.rec)))
      .sort((a, b) => String(a.h.checkin || "").localeCompare(String(b.h.checkin || "")));
  }, [roster, mode, from, to, property, status, JSON.stringify(Object.keys(records))]);

  const doneCount = rows ? rows.filter((r) => isDone(r.h, r.rec)).length : 0;
  const pendingCount = rows ? rows.length - doneCount : 0;

  const resend = (h, channel) => {
    const ch = channel || "email";
    setToast(t.adminResending || "Enviando…");
    const done = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };
    try {
      if (Backend.isConnected && Backend.isConnected() && Backend.call) {
        Backend.call("resendRegistration", { code: h.code, channel: ch })
          .then((r) => done(r && r.ok
            ? `${ch === "whatsapp" ? "WhatsApp" : t.adminResent} ${r.to || ""}`
            : ((t.adminResendFail || "No se pudo enviar") + (r && r.error ? " · " + r.error : ""))))
          .catch(() => done(t.adminResendFail || "No se pudo enviar"));
      } else { done(t.adminResendFail || "Conecta el backend para enviar"); }
    } catch (e) { done(t.adminResendFail || "No se pudo enviar"); }
  };

  const quickOptions = [
    { value: "yesterday", label: t.adminYesterday },
    { value: "today", label: t.adminToday },
    { value: "tomorrow", label: t.adminTomorrow },
    { value: "next3", label: t.adminNext3 },
    { value: "last3", label: t.adminLast3 },
    { value: "range", label: t.adminRange },
  ];
  const statusOptions = [
    { value: "both", label: t.adminBoth },
    { value: "pending", label: t.adminOnlyPending },
    { value: "done", label: t.adminOnlyDone },
  ];
  const propertyOptions = [{ value: "all", label: t.adminAllProps },
    ...[...new Set((roster || []).map((r) => r.propertyName).filter(Boolean))].sort().map((p) => ({ value: p, label: p }))];

  return (
    <div style={{ minHeight: "100vh", background: C.alabaster, position: "relative", overflow: "hidden" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(22px,4vh,36px) clamp(16px,4vw,30px) 64px", position: "relative", zIndex: 2 }}>

        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <button onClick={onBack} className="sp-link" style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 7, fontFamily: C.sans, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tierra, fontWeight: 500, marginBottom: 12 }}>
              <Icon name="arrowLeft" size={15} color={C.tierra} /> Spacio AM
            </button>
            <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: "clamp(28px,4.2vw,40px)", color: C.negro, margin: 0, lineHeight: 1.04, letterSpacing: "-0.01em" }}>{t.adminTitle}</h1>
            <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, margin: "9px 0 0", letterSpacing: "0.02em", lineHeight: 1.55, maxWidth: 460 }}>{t.adminSub}</p>
          </div>
          <button onClick={onSwitchLang} className="sp-langbtn">{t.code === "es" ? "EN" : "ES"}</button>
        </div>

        {/* Hospitable connection bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 14, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#1F8A5B" : C.taupe }} />
            <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.negro, letterSpacing: "0.02em", fontWeight: 500 }}>{connected ? t.hospConnected : t.hospDisconnected}</span>
            {refreshing && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: C.sans, fontSize: 10.5, color: C.tierra, letterSpacing: "0.04em" }}><Spinner /> {t.hospSyncing}</span>}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {connected && (
              <button onClick={() => loadRoster({ full: true })} disabled={refreshing} className="sp-btn" title={t.adminRefreshNow}
                style={{ background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 10, padding: "8px 14px",
                  fontFamily: C.sans, fontSize: 11, letterSpacing: "0.04em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7, opacity: refreshing ? 0.5 : 1 }}>
                <Icon name="refresh" size={14} color={C.negro} /> {t.adminRefreshNow}
              </button>
            )}
            <button onClick={() => setHospOpen(true)} className="sp-btn" style={{ background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`,
              borderRadius: 10, padding: "8px 14px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.04em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Icon name="settings" size={14} color={C.negro} /> {connected ? t.hospManage : t.hospConnect}
            </button>
          </div>
        </div>

        {/* tabs: Registros | Estaciones */}
        <div style={{ display: "inline-flex", gap: 4, background: C.beige, border: `1px solid ${C.grisCalido}`, borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {[["registros", t.tabRegistros], ["seguimiento", t.tabSeguimiento], ["propiedades", t.tabPropiedades]]
            .concat(isPrimaryAdmin(adminEmail) ? [["accesos", t.tabAccesos]] : [])
            .map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className="sp-btn"
              style={{ background: tab === k ? C.white : "transparent", color: C.negro, border: tab === k ? `1px solid ${C.grisCalido}` : "1px solid transparent",
                borderRadius: 9, padding: "8px 18px", fontFamily: C.sans, fontSize: 12, letterSpacing: "0.04em", cursor: "pointer",
                fontWeight: tab === k ? 600 : 500, boxShadow: tab === k ? "0 1px 4px rgba(62,63,63,.06)" : "none" }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "propiedades" && <PropertyInfoScreen t={t} roster={roster} onToast={(m) => { setToast(m); setTimeout(() => setToast(""), 2600); }} />}
        {tab === "seguimiento" && <SeguimientoScreen t={t} roster={roster} />}
        {tab === "accesos" && isPrimaryAdmin(adminEmail) && <AdminAccessScreen t={t} onToast={(m) => { setToast(m); setTimeout(() => setToast(""), 2600); }} />}

        {tab === "registros" && (<>
        {/* counts */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 13, padding: "10px 16px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: C.sans, fontSize: 20, color: "#1F8A5B", fontWeight: 600 }}>{doneCount}</span>
            <span style={{ fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: C.tierra }}>{t.adminComplete}</span>
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 13, padding: "10px 16px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: C.sans, fontSize: 20, color: C.peach, fontWeight: 600 }}>{pendingCount}</span>
            <span style={{ fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: C.tierra }}>{t.adminPending}</span>
          </div>
        </div>

        {/* filters — dropdowns */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: mode === "range" ? 12 : 6 }}>
          <AdSelect label={t.adminQuick} value={mode} onChange={setMode} options={quickOptions} />
          <AdSelect label={t.adminStatusFilter} value={status} onChange={setStatus} options={statusOptions} />
          <AdSelect label={t.adminPropertyFilter} value={property} onChange={setProperty} options={propertyOptions} />
        </div>

        {mode === "range" && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", background: C.white, border: `1px solid ${C.grisCalido}`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 12, animation: "rise .3s " + C.ease + " both" }}>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontFamily: C.sans, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, marginBottom: 6, fontWeight: 600 }}>{t.adminFrom}</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                style={{ padding: "10px 13px", borderRadius: 11, border: `1px solid ${C.grisCalido}`, background: C.alabaster, fontFamily: C.sans, fontSize: 13, color: C.negro, outline: "none" }} />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontFamily: C.sans, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, marginBottom: 6, fontWeight: 600 }}>{t.adminTo}</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                style={{ padding: "10px 13px", borderRadius: 11, border: `1px solid ${C.grisCalido}`, background: C.alabaster, fontFamily: C.sans, fontSize: 13, color: C.negro, outline: "none" }} />
            </label>
            <Btn variant="outline" onClick={() => { setFrom(""); setTo(""); }} style={{ padding: "11px 16px" }}>{t.adminClear}</Btn>
          </div>
        )}
        <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "0 0 14px", letterSpacing: "0.03em" }}>{t.adminFilterNote}</p>

        {/* list */}
        {roster === null ? (
          <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "38px 20px", textAlign: "center",
            fontFamily: C.sans, fontSize: 12.5, color: C.tierra, letterSpacing: "0.02em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Spinner /> {t.hospSyncing}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "38px 20px", textAlign: "center",
            fontFamily: C.sans, fontSize: 13, color: C.tierra, letterSpacing: "0.02em" }}>{t.adminEmpty}</div>
        ) : (
          <div style={{ border: `1px solid ${C.grisCalido}`, borderRadius: 16, overflow: "hidden", background: C.white }}>
            {rows.map(({ h, rec, bucket }, idx) => (
              <AdminRow key={(h.id || h.code) + "-" + idx} t={t} h={h} rec={rec} bucket={bucket} first={idx === 0} avail={availFor(h)}
                onView={() => setSummary({ h, rec, autoPrint: false })}
                onDownload={() => setSummary({ h, rec, autoPrint: true })}
                onResend={(ch) => resend(h, ch)} />
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 24, opacity: 0.9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#1F8A5B" : C.taupe }} />
            <span style={{ fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.06em", color: C.tierra }}>{connected ? t.adminSyncNote : t.hospDisconnected}</span>
          </div>
          {connected && meta && (meta.error || meta.note) && (
            <span style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.02em", color: C.peach, textAlign: "center", maxWidth: 520 }}>
              {meta.error ? ("Hospitable: " + meta.error) :
               meta.note === "no-properties" ? "El backend no encontró propiedades en tu cuenta de Hospitable." :
               meta.note === "no-token" ? "Falta el token de Hospitable en el backend." : String(meta.note)}
            </span>
          )}
          {connected && meta && !meta.error && !meta.note && typeof meta.reservationsRaw === "number" && (
            <span style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.02em", color: C.tierra }}>
              {meta.propertiesCount} propiedades · {meta.reservationsRaw} reservas en la ventana de fechas
            </span>
          )}
        </div>
        </>)}
      </div>

      {summary && (
        <ReservationSummary t={t} h={summary.h} rec={summary.rec} autoPrint={summary.autoPrint} avail={availFor(summary.h)}
          onClose={() => setSummary(null)} onResend={(ch) => resend(summary.h, ch)} />
      )}
      {hospOpen && (
        <HospitablePanel t={t} onClose={() => setHospOpen(false)}
          onSaved={() => { setHospOpen(false); setConnected(HospitableAPI.isConnected()); loadRoster(); }} />
      )}
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", zIndex: 400,
          background: C.negro, color: C.alabaster, borderRadius: 999, padding: "13px 22px", boxShadow: "0 12px 40px rgba(62,63,63,.24)",
          fontFamily: C.sans, fontSize: 12.5, letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 9, animation: "rise .3s " + C.ease + " both" }}>
          <Icon name="mail" size={16} color={C.peach} /> {toast}
        </div>
      )}
    </div>
  );
}

/* compact, image-free row */
function AdminRow({ t, h, rec, bucket, first, avail, onView, onDownload, onResend }) {
  const done = !!rec || h.statusForm === "completo";
  const es = t.code === "es";
  const av = avail || { email: false, whatsapp: false };
  const bucketLabel = { yesterday: t.adminYesterday, today: t.adminToday, tomorrow: t.adminTomorrow, dayAfter: t.adminDayAfter }[bucket];
  const guestName = (rec?.guests?.[0]?.name) || h.guestName;
  const actionBtn = (icon, label, onClick, dark) => (
    <button onClick={onClick} className="sp-btn" title={label}
      style={{ background: dark ? C.negro : C.white, color: dark ? C.alabaster : C.negro, border: dark ? "none" : `1px solid ${C.grisCalido}`,
        borderRadius: 9, padding: "7px 11px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: C.sans, fontSize: 10, letterSpacing: "0.05em", fontWeight: 500, whiteSpace: "nowrap" }}>
      <Icon name={icon} size={13} color={dark ? C.alabaster : C.negro} /> {label}
    </button>
  );
  // reenvío por canal — inactivo si la propiedad no tiene ese contacto
  const resendBtn = (icon, on, channel, title) => (
    <button onClick={on ? () => onResend(channel) : undefined} className="sp-btn" disabled={!on}
      title={on ? title : (es ? "Sin " + (channel === "whatsapp" ? "WhatsApp" : "correo") + " en esta propiedad" : "No " + channel + " for this property")}
      style={{ background: C.white, color: on ? C.negro : C.warmGrey || C.grisCalido, border: `1px solid ${C.grisCalido}`,
        borderRadius: 9, width: 34, height: 32, cursor: on ? "pointer" : "not-allowed", opacity: on ? 1 : 0.4,
        display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={14} color={on ? C.negro : C.tierra} />
    </button>
  );
  return (
    <div className="sp-adrow" style={{ borderTop: first ? "none" : `1px solid ${C.beige}`, padding: "13px 16px",
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      {/* identity */}
      <div style={{ minWidth: 150, flex: "1 1 210px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: C.serif, fontSize: 17, color: C.negro, lineHeight: 1.1 }}>{guestName}</span>
          <span style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.12em", color: C.tierra }}>{h.code}</span>
        </div>
        <div style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, marginTop: 2, letterSpacing: "0.02em" }}>{h.propertyName}{h.apartment && !String(h.propertyName).includes(h.apartment) ? " · " + h.apartment : ""}</div>
      </div>
      {/* checkin */}
      <div style={{ flex: "0 0 auto", minWidth: 90 }}>
        <div style={{ fontFamily: C.sans, fontSize: 14, color: C.negro }}>{fmtDay(h.checkin, t.code)}</div>
        {bucketLabel && <div style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.06em", color: C.peach, marginTop: 1, textTransform: "uppercase", fontWeight: 700 }}>{bucketLabel}</div>}
      </div>
      {/* status */}
      <div style={{ flex: "0 0 auto" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: done ? "rgba(31,138,91,.1)" : C.beige,
          border: `1px solid ${done ? "rgba(31,138,91,.3)" : C.grisCalido}`, borderRadius: 999, padding: "5px 11px",
          fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: done ? "#177A4F" : C.tierra, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: done ? "#1F8A5B" : C.taupe }} />
          {done ? t.adminStatusDone : t.adminStatusPending}
        </span>
      </div>
      {/* actions */}
      <div style={{ display: "flex", gap: 7, flex: "1 1 auto", justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}>
        {actionBtn("review", t.adminView, onView, true)}
        {actionBtn("download", t.adminDownload, onDownload, false)}
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "nowrap" }}>
          <span style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tierra }}>{es ? "Reenviar" : "Resend"}</span>
          {resendBtn("mail", av.email, "email", es ? "Reenviar por correo" : "Resend by email")}
          {resendBtn("whatsapp", av.whatsapp, "whatsapp", es ? "Reenviar por WhatsApp (incluye al administrador)" : "Resend by WhatsApp")}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ESTACIONES — propiedades + 2 correos / 2 teléfonos por propiedad.
   A esos contactos se envía el formulario completado.
   ============================================================ */
function StationsScreen({ t, onToast }) {
  const [list, setList] = useStateAd(null);   // null = loading
  const [drafts, setDrafts] = useStateAd({});
  const [savingIdx, setSavingIdx] = useStateAd(-1);

  // Nombre para MOSTRAR: normaliza los guiones al formato de Hospitable
  // ("Z10-Fiamene-404" → "Z10 - Fiamene - 404").
  const nk = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const disp = (s) => (/-/.test(s) ? String(s).replace(/\s*[-–—]\s*/g, " - ").replace(/\s{2,}/g, " ").trim() : s);

  useEffectAd(() => {
    Backend.listStations().then((rows) => {
      // reconciliar filas cuyo nombre difiere solo en espacios/guiones: se fusionan
      // en una sola tarjeta con el nombre en formato Hospitable.
      const byKey = new Map();
      (rows || []).forEach((r) => {
        const k = nk(r.propertyName); const cur = byKey.get(k);
        const merged = cur ? { ...cur } : { propertyName: disp(r.propertyName), propertyId: "", email1: "", email2: "", phone1: "", phone2: "" };
        merged.propertyName = disp(r.propertyName);
        merged.propertyId = merged.propertyId || r.propertyId || "";
        ["email1", "email2", "phone1", "phone2"].forEach((f) => { if (!merged[f] && r[f]) merged[f] = r[f]; });
        byKey.set(k, merged);
      });
      const clean = [...byKey.values()].sort((a, b) => a.propertyName.localeCompare(b.propertyName));
      setList(clean);
      const d = {};
      clean.forEach((r) => { d[r.propertyName] = { email1: r.email1 || "", email2: r.email2 || "", phone1: r.phone1 || "", phone2: r.phone2 || "" }; });
      setDrafts(d);
    });
  }, []);

  const upd = (name, key, val) => setDrafts((d) => ({ ...d, [name]: { ...(d[name] || {}), [key]: val } }));
  const save = async (st, idx) => {
    setSavingIdx(idx);
    const d = drafts[st.propertyName] || {};
    try { await Backend.saveStation({ propertyId: st.propertyId || "", propertyName: st.propertyName, ...d }); onToast(`${t.stSaved} · ${st.propertyName}`); }
    catch (e) { onToast(t.hospFail); }
    setSavingIdx(-1);
  };

  const field = (name, key, label, type) => (
    <label style={{ display: "block", flex: "1 1 200px", minWidth: 160 }}>
      <span style={{ display: "block", fontFamily: C.sans, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, marginBottom: 6, fontWeight: 600 }}>{label}</span>
      <input type={type} value={(drafts[name] || {})[key] || ""} onChange={(e) => upd(name, key, e.target.value)}
        placeholder={type === "email" ? "correo@ejemplo.com" : "+502 0000 0000"}
        style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 11, border: `1px solid ${C.grisCalido}`,
          background: C.alabaster, fontFamily: C.sans, fontSize: 13, color: C.negro, outline: "none", letterSpacing: "0.01em" }} />
    </label>
  );

  return (
    <div>
      <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, margin: "0 0 18px", letterSpacing: "0.02em", lineHeight: 1.55, maxWidth: 520 }}>{t.stSub}</p>
      {list === null ? (
        <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "38px 20px", textAlign: "center",
          fontFamily: C.sans, fontSize: 12.5, color: C.tierra, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Spinner /> {t.stLoading}
        </div>
      ) : list.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "38px 20px", textAlign: "center",
          fontFamily: C.sans, fontSize: 13, color: C.tierra }}>{t.stEmpty}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((st, idx) => (
            <div key={st.propertyName + idx} style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontFamily: C.serif, fontSize: 20, color: C.negro, lineHeight: 1.1 }}>{st.propertyName}</span>
                <button onClick={() => save(st, idx)} className="sp-btn" disabled={savingIdx === idx}
                  style={{ background: C.negro, color: C.alabaster, border: "none", borderRadius: 10, padding: "9px 18px",
                    fontFamily: C.sans, fontSize: 11, letterSpacing: "0.06em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7 }}>
                  {savingIdx === idx ? <><Spinner /> {t.stSave}</> : <><Icon name="check" size={14} color={C.alabaster} /> {t.stSave}</>}
                </button>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                {field(st.propertyName, "email1", t.stEmail1, "email")}
                {field(st.propertyName, "email2", t.stEmail2, "email")}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {field(st.propertyName, "phone1", t.stPhone1, "tel")}
                {field(st.propertyName, "phone2", t.stPhone2, "tel")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PROPIEDADES — parqueo, wifi, cerradura, tipo (por propiedad)
   ============================================================ */
const PROP_INFO_KEY = "spacioam_property_info";
function loadPropInfo() { try { return JSON.parse(localStorage.getItem(PROP_INFO_KEY)) || {}; } catch (e) { return {}; } }
function savePropInfoAll(o) { try { localStorage.setItem(PROP_INFO_KEY, JSON.stringify(o)); } catch (e) {} }

/* ============================================================
   ESTÁNDAR LOCAL (sin IA / sin tokens)
   ------------------------------------------------------------
   Toma la información ya guardada de cada propiedad (llegada,
   dirección, parqueo, nota) y la ordena en la estructura estándar
   { arrivalIntro, arrivalSteps[], parking, wifiNote, tip }.
   Solo reordena y limpia lo que el admin ya escribió — no inventa
   datos y nunca incluye el código de ingreso (va aparte).
   ============================================================ */
function stdSplitSteps(text) {
  if (!text) return [];
  let t = String(text).replace(/\r/g, "");
  t = t.replace(/[✦◾▪•●◦]/g, "\n").replace(/✔️|✔|✚|➤|→/g, "\n");
  t = t.replace(/\s*paso\s*\d+\s*[:.\-–)]*/gi, "\n").replace(/\s*step\s*\d+\s*[:.\-–)]*/gi, "\n");
  const parts = t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const skipLabel = /^(hora|horario|time|dirección|direccion|address|apartamento|apartment|número de apartamento|numero de apartamento|casa|piso|cómo encontrar|como encontrar|cómo entrar|como entrar|cómo ubicar|como ubicar|cómo llegar|como llegar|how to find|contacto|contact|internet|wi-?fi|estacionamiento|aparcamiento|parqueo|parking|basura|trash|agua|agua potable|drinkable water|códigos? de acceso|codigos? de acceso|access codes?|protocolo (de|para)( el)? ingreso|check-?in protocol|ingreso al edificio|llegada a tu apartamento|servicios extra)\s*[:：]?\s*$/i;
  const codeRe = /(código de acceso|codigo de acceso|access code|recibir[aá]s un c[oó]digo|you will receive an access code|se habilita autom|automatically enabled|si llegas (antes|a antes)|if you arrive before)/i;
  const dropRe = /^(wifi|wi-fi|red|network|contraseñ|contrasen|password|contacto|contact|si necesitas? (ayuda|asistencia)|si necesita ayuda|if you need (assistance|help)|el agua del ecofiltro|the water from|si necesitas? (tirar|deshacerte|dispose)|número whatsapp|numero whatsapp|clave wifi|internet)/i;
  const steps = [];
  parts.forEach((raw) => {
    let l = raw.replace(/^\s*\d+\s*[).\-–]\s*/, "").trim();
    l = l.replace(/^(protocolo[^:：]*|cómo[^:：]*|como[^:：]*|ingreso[^:：]*|llegada[^:：]*|primer paso[^:：]*)\s*[:：]\s*/i, "").trim();
    if (!l) return;
    if (skipLabel.test(l)) return;
    if (codeRe.test(l)) return;
    if (dropRe.test(l)) return;
    if (/^(google\s*maps|mapas de google|waze)\s*[:：]?/i.test(l)) return;
    if (/^https?:\/\//i.test(l)) return;
    l = l.replace(/\s*https?:\/\/\S+/gi, "").trim();
    if (l.length < 3) return;
    steps.push(l);
  });
  return steps.slice(0, 6);
}
function localStandardize(raw) {
  raw = raw || {};
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const dir = clean(raw.direccion), apt = clean(raw.apartamento), piso = clean(raw.piso);
  const steps = stdSplitSteps(String(raw.llegada || ""));
  let intro = "";
  if (dir) {
    intro = "Tu espacio está en " + dir;
    if (apt && dir.toLowerCase().indexOf(apt.toLowerCase()) === -1) intro += ", apartamento " + apt;
    if (piso && dir.toLowerCase().indexOf("piso") === -1) intro += ", piso " + piso;
    intro += ".";
  }
  const has = raw.tieneParqueo;
  let parking = clean(raw.notaParqueo);
  const num = clean(raw.numeroParqueo);
  if (!parking) {
    if (has === "yes" || has === "si" || has === "sí") parking = "Cuentas con parqueo asignado" + (num ? " · No. " + num : "") + ".";
    else if (has === "no") parking = clean(raw.parqueoExterno) || "Este alojamiento no cuenta con parqueo propio.";
  } else if (num && parking.toLowerCase().indexOf(num.toLowerCase()) === -1) {
    parking += (parking.endsWith(".") ? "" : ".") + " Parqueo No. " + num + ".";
  }
  if ((has === "no" || !parking) && clean(raw.parqueoExterno) && parking.toLowerCase().indexOf(clean(raw.parqueoExterno).toLowerCase()) === -1) {
    parking = (parking ? parking + " " : "") + clean(raw.parqueoExterno);
  }
  const tip = clean(raw.notaAdicional);
  if (!steps.length && !parking && !intro && !tip) return null;
  const block = { arrivalIntro: intro, arrivalSteps: steps, parking: parking, wifiNote: "", tip: tip };
  return { es: block, en: block };
}

function PropertyInfoScreen({ t, roster, onToast }) {
  const [store, setStore] = useStateAd(loadPropInfo());
  const [openKey, setOpenKey] = useStateAd(null);
  const autosave = useRefAd({ keys: new Set(), stKeys: new Set(), t1: null, mounted: false });
  const get = (name) => store[name] || {};
  const set = (name, patch) => { autosave.current.keys.add(name); setStore((s) => ({ ...s, [name]: { ...(s[name] || {}), ...patch } })); };
  // instrucciones generales compartidas: editar una propiedad propaga a todo su grupo
  const INSTR_FIELDS = ["address", "arrival", "tip", "maps", "waze", "checkoutMsg"];
  const instrGroup = (name) => { const a = (get(name).instrApply || []).filter((x) => x !== name); return [...new Set([name, ...a])]; };
  const setInstr = (name, patch) => {
    const group = instrGroup(name);
    group.forEach((m) => autosave.current.keys.add(m));
    setStore((s) => { const n = { ...s }; group.forEach((m) => { n[m] = { ...(n[m] || {}), ...patch }; }); return n; });
  };
  const toggleInstrApply = (name, target) => {
    if (target === name) return;
    const cur = instrGroup(name);
    const has = cur.includes(target);
    const group = has ? cur.filter((x) => x !== target) : [...cur, target];
    [...cur, ...group, target].forEach((m) => autosave.current.keys.add(m));
    setStore((s) => {
      const n = { ...s };
      if (!has) { const src = n[name] || {}; const inh = {}; INSTR_FIELDS.forEach((f) => { if (src[f] != null) inh[f] = src[f]; }); n[target] = { ...(n[target] || {}), ...inh }; }
      group.forEach((m) => { n[m] = { ...(n[m] || {}), instrApply: group.filter((x) => x !== m) }; });
      if (has) n[target] = { ...(n[target] || {}), instrApply: [] };
      return n;
    });
  };

  // contact block per property (was the old “Contactos” tab) — 2 emails + 2 phones
  const [stations, setStations] = useStateAd({});
  useEffectAd(() => {
    if (Backend.listStations) Backend.listStations().then((rows) => {
      const m = {};
      (rows || []).forEach((r) => { m[r.propertyName] = { email1: r.email1 || "", email2: r.email2 || "", phone1: r.phone1 || "", phone2: r.phone2 || "", propertyId: r.propertyId || "" }; });
      setStations(m);
    });
  }, []);
  const getC = (name) => stations[name] || {};
  const setC = (name, patch) => { autosave.current.stKeys.add(name); setStations((s) => ({ ...s, [name]: { ...(s[name] || {}), ...patch } })); };
  // toda propiedad = reservas en la ventana ∪ todos los listados de Hospitable,
  // así aparecen también las que no tienen una reserva próxima.
  // El nombre de Hospitable (roster) es la fuente de verdad: si un registro
  // guardado difiere solo en espacios/guiones/mayúsculas, se colapsa al de Hospitable.
  const nkName = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const liveNames = useMemoAd(() => [...new Set((roster || []).map((r) => r.propertyName).filter(Boolean))], [roster]);
  const canonName = useCallbackAd((name) => { const k = nkName(name); return liveNames.find((n) => nkName(n) === k) || name; }, [liveNames]);
  // nombre para MOSTRAR: usa el exacto de Hospitable si está; si no, normaliza los
  // guiones al formato de Hospitable ("Z10-Fiamene-404" → "Z10 - Fiamene - 404").
  const displayName = useCallbackAd((name) => {
    const live = canonName(name);
    if (live !== name) return live;
    return /-/.test(name) ? String(name).replace(/\s*[-–—]\s*/g, " - ").replace(/\s{2,}/g, " ").trim() : name;
  }, [canonName]);
  const props = useMemoAd(() => {
    const byKey = new Map(); // nk -> nombre a mostrar (prefiere el de Hospitable)
    const add = (nm, isLive) => {
      if (!nm || nm === "__manual__" || nm === "__hidden__") return;
      const k = nkName(nm); const cur = byKey.get(k);
      if (!cur || (isLive && !cur.live)) byKey.set(k, { name: isLive ? nm : canonName(nm), live: isLive || (cur && cur.live) });
    };
    (roster || []).forEach((r) => add(r.propertyName, true));
    Object.keys(stations).forEach((n) => add(n, false));
    Object.keys(store).forEach((n) => { if (n !== "__manual__") add(n, false); });
    return [...byKey.values()].map((v) => v.name).sort();
  }, [roster, stations, store, liveNames]);
  // autosave: guarda store + contactos poco después de cada cambio, sin botón
  useEffectAd(() => {
    savePropInfoAll(store);
    if (!autosave.current.mounted) { autosave.current.mounted = true; return; }
    clearTimeout(autosave.current.t1);
    autosave.current.t1 = setTimeout(() => {
      const keys = [...autosave.current.keys]; autosave.current.keys = new Set();
      keys.forEach((k) => { try { Backend.call && Backend.call("savePropertyInfo", { property: k, info: store[k] || {} }).catch(() => {}); } catch (e) {} });
      const sk = [...autosave.current.stKeys]; autosave.current.stKeys = new Set();
      sk.forEach((k) => { const c = stations[k] || {}; try { Backend.saveStation && Backend.saveStation({ propertyId: c.propertyId || "", propertyName: k, email1: c.email1 || "", email2: c.email2 || "", phone1: c.phone1 || "", phone2: c.phone2 || "" }); } catch (e) {} });
      if (keys.length || sk.length) onToast(t.code === "es" ? "Guardado automáticamente" : "Saved automatically");
    }, 900);
  }, [store, stations]);
  // building defaults from the check-in data, so instruction fields pre-fill
  const buildingOf = (name) => (typeof matchBuilding === "function" ? matchBuilding({ propertyName: name, apartment: "" }) : null);
  const es = t.code === "es";

  // ---- Estándar de instrucciones (copywriting con IA, disparado manualmente) ----
  const [aligning, setAligning] = useStateAd("");   // "" | "<name>" | "__all__"
  const [alignMsg, setAlignMsg] = useStateAd("");
  const hashStr = (s) => { let h = 5381; s = String(s || ""); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff; return (h >>> 0).toString(36); };
  const bff = (v, bv) => (v != null && String(v) !== "") ? v : (bv != null ? bv : "");
  const effectiveRaw = (name) => {
    const info = get(name), b = buildingOf(name) || {};
    return {
      propiedad: name,
      apartamento: bff(info.unit, b.apartment) || "",
      piso: String(info.floor || ""),
      direccion: bff(info.address, b.address) || "",
      llegada: bff(info.arrival, b.arrival) || "",
      notaAdicional: bff(info.tip, b.tip) || "",
      cerradura: bff(info.lock, b.lock) || "",
      contactoNombre: bff(info.contactName, b.contactName) || "",
      contactoTelefono: bff(info.contactPhone, b.contactPhone) || "",
      tieneParqueo: info.hasParking || "",
      numeroParqueo: info.parkNumber || "",
      parqueoPropiedad: info.parkOwnership || "",
      hayOpcionParqueo: info.parkOption || "",
      parqueoExterno: info.parkExtInfo || "",
      enlaceParqueo: info.parkLink || "",
      notaParqueo: info.parkNote || "",
      wifiRed: info.wifiNet || "",
      wifiClave: info.wifiPass || "",
    };
  };
  const rawSig = (name) => hashStr(JSON.stringify(effectiveRaw(name)));
  const hasStdContent = (name) => { const r = effectiveRaw(name); return !!(String(r.llegada).trim() || String(r.notaParqueo).trim() || String(r.parqueoExterno).trim() || r.tieneParqueo); };
  const stdState = (name) => {
    if (!hasStdContent(name)) return "empty";
    const meta = get(name).stdMeta;
    if (!meta || !meta.hash) return "none";
    return meta.hash === rawSig(name) ? "ok" : "stale";
  };
  const pendingProps = props.filter((n) => { const s = stdState(n); return s === "none" || s === "stale"; });
  const alignOne = async (name) => {
    const raw = effectiveRaw(name); const hash = hashStr(JSON.stringify(raw));
    const std = localStandardize(raw);
    if (!std) return false;
    const patch = { std, stdMeta: { hash, at: Date.now(), by: "local" } };
    setStore((s) => ({ ...s, [name]: { ...(s[name] || {}), ...patch } }));
    const cur = { ...loadPropInfo() }; cur[name] = { ...(cur[name] || {}), ...patch }; savePropInfoAll(cur);
    try { Backend.call && Backend.call("savePropertyInfo", { property: name, info: cur[name] }).catch(() => {}); } catch (e) {}
    return true;
  };
  const alignSingle = async (name) => {
    if (aligning) return;
    setAligning(name); setAlignMsg("");
    const ok = await alignOne(name);
    setAligning("");
    onToast(ok ? `${es ? "Estándar aplicado" : "Standard applied"} · ${name}` : (es ? "No hay información suficiente para alinear" : "Not enough info to align"));
  };
  const alignAll = async () => {
    if (aligning) return;
    const list = [...pendingProps]; if (!list.length) return;
    setAligning("__all__");
    let done = 0, fail = 0;
    for (const name of list) {
      setAlignMsg(`${es ? "Alineando" : "Aligning"} ${name}… (${done + fail + 1}/${list.length})`);
      (await alignOne(name)) ? done++ : fail++;
    }
    setAligning(""); setAlignMsg("");
    onToast(`${es ? "Estándar aplicado a" : "Standard applied to"} ${done}${fail ? ` · ${fail} ${es ? "con error" : "failed"}` : ""}`);
  };

  // ---- RECONCILIACIÓN DE NOMBRES (renombres en Hospitable) ----
  // Cuando una propiedad se renombra en Hospitable, su info queda guardada bajo el
  // nombre viejo (huérfana). Reconciliamos por: (1) hospId durable, (2) nombre
  // normalizado idéntico → automático; (3) parecido → confirmación manual.
  const [recOpen, setRecOpen] = useStateAd(false);
  const [stdOpen, setStdOpen] = useStateAd(false);
  const [orphanTarget, setOrphanTarget] = useStateAd({}); // oldName -> chosen newName
  const firstBatchRef = useRefAd(false);
  const BATCH_FLAG = "spacioam_std_batch_done";
  const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const META_ONLY = new Set(["instrApply", "std", "stdMeta", "hospId"]);
  const recHasData = (rec) => !!rec && Object.keys(rec).some((k) => !META_ONLY.has(k) && rec[k] != null && !(typeof rec[k] === "string" && rec[k].trim() === "") && !(Array.isArray(rec[k]) && rec[k].length === 0));
  const idOfName = (name) => (stations[name] || {}).propertyId || (get(name).hospId) || "";
  const bigrams = (s) => { const g = {}; for (let i = 0; i < s.length - 1; i++) { const b = s.slice(i, i + 2); g[b] = (g[b] || 0) + 1; } return g; };
  const simScore = (a, b) => { if (!a || !b) return 0; if (a === b) return 1; const ga = bigrams(a), gb = bigrams(b); let inter = 0, na = 0, nb = 0; for (const k in ga) na += ga[k]; for (const k in gb) nb += gb[k]; for (const k in ga) if (gb[k]) inter += Math.min(ga[k], gb[k]); return (2 * inter) / (na + nb || 1); };
  const orphans = useMemoAd(() => { const cur = new Set(props); return Object.keys(store).filter((k) => k !== "__manual__" && k !== "__hidden__" && !cur.has(k) && recHasData(store[k])); }, [store, props]);
  const bestTargetFor = (oldName) => {
    const oid = (store[oldName] || {}).hospId || "";
    if (oid) { const byIdEmpty = props.find((p) => idOfName(p) === oid && !recHasData(store[p])); const byId = byIdEmpty || props.find((p) => idOfName(p) === oid); if (byId) return { name: byId, conf: "id" }; }
    const ok = normKey(oldName);
    const exact = props.find((p) => normKey(p) === ok);
    if (exact) return { name: exact, conf: "exact" };
    let best = null, bestScore = 0;
    props.forEach((p) => { const s = simScore(ok, normKey(p)); if (s > bestScore) { bestScore = s; best = p; } });
    if (best && bestScore >= 0.68) return { name: best, conf: "fuzzy", score: bestScore };
    return null;
  };
  const manualOrphans = orphans.filter((o) => { const tt = bestTargetFor(o); return !tt || tt.conf === "fuzzy"; });
  const mergeRecords = (oldRec, newRec, newName) => {
    const merged = { ...(oldRec || {}) };
    Object.keys(newRec || {}).forEach((k) => { const v = newRec[k]; if (v != null && !(typeof v === "string" && v.trim() === "") && !(Array.isArray(v) && v.length === 0)) merged[k] = v; });
    merged.hospId = idOfName(newName) || (oldRec && oldRec.hospId) || "";
    return merged;
  };
  const mergeInto = (oldName, newName) => {
    if (!newName || newName === oldName) return;
    const merged = mergeRecords(store[oldName], store[newName], newName);
    const next = { ...store }; next[newName] = merged; delete next[oldName];
    setStore(next); savePropInfoAll(next);
    try { Backend.call && Backend.call("savePropertyInfo", { property: newName, info: merged }).catch(() => {}); } catch (e) {}
    try { Backend.call && Backend.call("savePropertyInfo", { property: oldName, info: {} }).catch(() => {}); } catch (e) {}
    onToast(es ? `Fusionado: ${oldName} → ${newName}` : `Merged: ${oldName} → ${newName}`);
  };
  const discardOrphan = (oldName) => {
    const next = { ...store }; delete next[oldName];
    setStore(next); savePropInfoAll(next);
    try { Backend.call && Backend.call("savePropertyInfo", { property: oldName, info: {} }).catch(() => {}); } catch (e) {}
    onToast(es ? `Descartada: ${oldName}` : `Discarded: ${oldName}`);
  };
  // MIGRAR nombres a la ortografía exacta de Hospitable: si un registro guardado
  // (info o contacto) coincide en forma normalizada con un nombre del roster pero
  // difiere en espacios/guiones/mayúsculas, se mueve al nombre exacto de Hospitable.
  useEffectAd(() => {
    if (!liveNames.length) return;
    const liveByKey = {}; liveNames.forEach((n) => { liveByKey[nkName(n)] = n; });
    // info store
    setStore((s) => {
      let ch = false; const n = { ...s };
      Object.keys(s).forEach((old) => {
        if (old === "__manual__") return;
        const live = liveByKey[nkName(old)];
        if (live && live !== old) {
          const merged = { ...(n[live] || {}) };
          Object.keys(s[old] || {}).forEach((k) => { const v = s[old][k]; if (v != null && !(typeof v === "string" && v.trim() === "") && !(Array.isArray(v) && v.length === 0)) merged[k] = v; });
          n[live] = merged; delete n[old]; ch = true;
          try { Backend.call && Backend.call("savePropertyInfo", { property: live, info: merged }).catch(() => {}); } catch (e) {}
          try { Backend.call && Backend.call("savePropertyInfo", { property: old, info: {} }).catch(() => {}); } catch (e) {}
        }
      });
      if (ch) savePropInfoAll(n);
      return ch ? n : s;
    });
    // contactos (stations)
    setStations((s) => {
      let ch = false; const n = { ...s };
      Object.keys(s).forEach((old) => {
        const live = liveByKey[nkName(old)];
        if (live && live !== old) {
          const merged = { ...(n[live] || {}), ...Object.fromEntries(Object.entries(s[old] || {}).filter(([, v]) => v != null && v !== "")) };
          n[live] = merged; delete n[old]; ch = true;
          try { Backend.saveStation && Backend.saveStation({ propertyId: merged.propertyId || "", propertyName: live, email1: merged.email1 || "", email2: merged.email2 || "", phone1: merged.phone1 || "", phone2: merged.phone2 || "" }); } catch (e) {}
        }
      });
      return ch ? n : s;
    });
  }, [liveNames.join("|")]);

  // estampar hospId durable en cada info que tenga estación con id (previene futuros huérfanos)
  useEffectAd(() => {
    const ids = {}; Object.keys(stations).forEach((n) => { if (stations[n].propertyId) ids[n] = stations[n].propertyId; });
    if (!Object.keys(ids).length) return;
    setStore((s) => { let ch = false; const n = { ...s }; Object.keys(ids).forEach((nm) => { if (n[nm] && n[nm].hospId !== ids[nm]) { n[nm] = { ...n[nm], hospId: ids[nm] }; ch = true; } }); return ch ? n : s; });
  }, [stations]);
  // auto-reconciliar coincidencias seguras (por id o nombre normalizado idéntico)
  useEffectAd(() => {
    if (!props.length) return;
    const auto = orphans.map((o) => ({ o, t: bestTargetFor(o) })).filter((x) => x.t && (x.t.conf === "id" || x.t.conf === "exact"));
    if (!auto.length) return;
    const next = { ...store };
    auto.forEach(({ o, t }) => {
      if (!next[o]) return;
      const merged = mergeRecords(next[o], next[t.name], t.name);
      next[t.name] = merged; delete next[o];
      try { Backend.call && Backend.call("savePropertyInfo", { property: t.name, info: merged }).catch(() => {}); } catch (e) {}
      try { Backend.call && Backend.call("savePropertyInfo", { property: o, info: {} }).catch(() => {}); } catch (e) {}
    });
    setStore(next); savePropInfoAll(next);
    onToast(es ? `Nombres reconciliados automáticamente: ${auto.length}` : `Names auto-reconciled: ${auto.length}`);
  }, [props.join("|"), Object.keys(store).join("|"), Object.keys(stations).join("|")]);
  // PRIMER BATCH automático: alinear todo una sola vez (local, sin tokens), tras reconciliar.
  // Se omite si hay un estándar precargado (seed) — ese tiene prioridad.
  useEffectAd(() => {
    if (firstBatchRef.current) return;
    if (window.SPACIO_STD_SEED) { firstBatchRef.current = true; return; }
    try { if (localStorage.getItem(BATCH_FLAG)) { firstBatchRef.current = true; return; } } catch (e) {}
    if (!props.length) return;
    // esperar a que la reconciliación automática termine
    const hasAutoPending = orphans.some((o) => { const tt = bestTargetFor(o); return tt && (tt.conf === "id" || tt.conf === "exact"); });
    if (hasAutoPending) return;
    if (!pendingProps.length) return;
    firstBatchRef.current = true;
    try { localStorage.setItem(BATCH_FLAG, String(Date.now())); } catch (e) {}
    (async () => { await alignAll(); })();
  }, [props.join("|"), pendingProps.length, orphans.length]);

  // SEED estándar precargado (estandarización hecha por Claude, cero tokens del web app).
  // Si existe window.SPACIO_STD_SEED, aplica el std ya hecho a las propiedades que coincidan.
  useEffectAd(() => {
    const seed = window.SPACIO_STD_SEED; if (!seed || !props.length) return;
    const nk = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const entries = Array.isArray(seed) ? seed : Object.keys(seed).map((k) => ({ match: [nk(k)], std: seed[k] }));
    const next = { ...store }; let changed = false;
    props.forEach((name) => {
      const rec = next[name] || {};
      const key = nk(name);
      const found = entries.find((e) => (e.match || []).some((m) => key.indexOf(nk(m)) !== -1));
      if (!found || !found.std) return;
      const sig = found.sig || (rec.stdMeta && rec.stdMeta.seedSig);
      if (rec.stdMeta && rec.stdMeta.by === "seed" && rec.stdMeta.seedSig === (found.sig || "")) return; // ya aplicado
      next[name] = { ...rec, std: found.std, stdMeta: { hash: rawSig(name), at: Date.now(), by: "seed", seedSig: found.sig || "" } };
      changed = true;
      try { Backend.call && Backend.call("savePropertyInfo", { property: name, info: next[name] }).catch(() => {}); } catch (e) {}
    });
    if (changed) { setStore(next); savePropInfoAll(next); onToast(es ? "Estándar precargado aplicado" : "Preloaded standard applied"); }
  }, [props.join("|")]);

  // MERGE dirigido (window.SPACIO_MERGE_MAP): fusiona nombres distintos que NO
  // coinciden por normalización (ej. "…- 11102" → "…- 1102"). Corre una vez por
  // sig y escribe al backend, así aplica en todos los dispositivos.
  useEffectAd(() => {
    const map = window.SPACIO_MERGE_MAP; if (!map || !map.length) return;
    const nkm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const findKey = (obj, name) => { const k = nkm(name); return Object.keys(obj).find((n) => nkm(n) === k); };
    map.forEach((m) => {
      const flag = "spacioam_merge_" + nkm(m.from) + "_" + nkm(m.to) + "_" + (m.sig || "v1");
      try { if (localStorage.getItem(flag)) return; } catch (e) {}
      // info store
      setStore((s) => {
        const fromK = findKey(s, m.from); if (!fromK) return s;
        const toName = findKey(s, m.to) || m.to;
        const merged = { ...(s[toName] || {}) };
        Object.keys(s[fromK] || {}).forEach((k) => { const v = s[fromK][k]; const cur = merged[k]; const curEmpty = cur == null || (typeof cur === "string" && cur.trim() === "") || (Array.isArray(cur) && cur.length === 0); if (curEmpty && v != null && !(typeof v === "string" && v.trim() === "") && !(Array.isArray(v) && v.length === 0)) merged[k] = v; });
        const n = { ...s }; n[toName] = merged; delete n[fromK];
        savePropInfoAll(n);
        try { Backend.call && Backend.call("savePropertyInfo", { property: toName, info: merged }).catch(() => {}); } catch (e) {}
        try { Backend.call && Backend.call("savePropertyInfo", { property: fromK, info: {} }).catch(() => {}); } catch (e) {}
        return n;
      });
      // contactos
      setStations((s) => {
        const fromK = findKey(s, m.from); if (!fromK) return s;
        const toName = findKey(s, m.to) || m.to;
        const merged = { ...(s[toName] || {}) };
        Object.entries(s[fromK] || {}).forEach(([k, v]) => { if ((merged[k] == null || merged[k] === "") && v) merged[k] = v; });
        const n = { ...s }; n[toName] = merged; delete n[fromK];
        try { Backend.saveStation && Backend.saveStation({ propertyId: merged.propertyId || "", propertyName: toName, email1: merged.email1 || "", email2: merged.email2 || "", phone1: merged.phone1 || "", phone2: merged.phone2 || "" }); } catch (e) {}
        return n;
      });
      try { localStorage.setItem(flag, String(Date.now())); } catch (e) {}
      onToast(es ? `Fusionado: ${m.from} → ${m.to}` : `Merged: ${m.from} → ${m.to}`);
    });
  }, [props.join("|"), Object.keys(store).join("|")]);

  // Exportar la información guardada de todas las propiedades (para estandarizar fuera del web app)
  const exportPropInfo = () => {
    const out = {};
    props.forEach((name) => { out[name] = { raw: effectiveRaw(name), stored: get(name) }; });
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "spacioam-propiedades-info.json";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    onToast(es ? "Información exportada" : "Info exported");
  };

  // ---- Manual de la casa (aplica a varias propiedades) — clave especial __manual__ ----
  const manualSeed = () => (typeof HOUSE_MANUAL_EXTRAS !== "undefined"
    ? Object.keys(HOUSE_MANUAL_EXTRAS).map((k) => ({ id: k, title: HOUSE_MANUAL_EXTRAS[k].title, icon: HOUSE_MANUAL_EXTRAS[k].icon || "manual", intro: HOUSE_MANUAL_EXTRAS[k].intro || "", steps: (HOUSE_MANUAL_EXTRAS[k].steps || []).slice() }))
    : []);
  useEffectAd(() => { if (!store.__manual__) setStore((s) => ({ ...s, __manual__: { items: manualSeed(), assign: {} } })); }, []);
  const manual = store.__manual__ || { items: [], assign: {} };
  const manualItems = manual.items || [];
  const manualAssign = manual.assign || {};
  const setManual = (patch) => { autosave.current.keys.add("__manual__"); setStore((s) => ({ ...s, __manual__: { ...(s.__manual__ || { items: [], assign: {} }), ...patch } })); };
  const setManualItem = (id, patch) => setManual({ items: manualItems.map((it) => it.id === id ? { ...it, ...patch } : it) });
  const toggleAssign = (id, name) => { const cur = manualAssign[id] || []; const has = cur.includes(name); setManual({ assign: { ...manualAssign, [id]: has ? cur.filter((x) => x !== name) : [...cur, name] } }); };
  const addManualItem = () => { const id = "m" + Date.now().toString(36); setManual({ items: [...manualItems, { id, title: "", icon: "manual", intro: "", steps: [] }] }); };
  const removeManualItem = (id) => { const a = { ...manualAssign }; delete a[id]; setManual({ items: manualItems.filter((it) => it.id !== id), assign: a }); };
  const [manualOpen, setManualOpen] = useStateAd(false);
  const saveManual = () => {
    const all = { ...loadPropInfo(), __manual__: store.__manual__ || { items: [], assign: {} } };
    savePropInfoAll(all);
    try { Backend.call && Backend.call("savePropertyInfo", { property: "__manual__", info: store.__manual__ || {} }).catch(() => {}); } catch (e) {}
    onToast(es ? "Manual de la casa guardado" : "House manual saved");
  };

  // ---- Farol: campos pendientes por propiedad ----
  const eff = (v, bv) => (v != null && String(v) !== "") ? v : bv;
  const missingFields = (name) => {
    const info = get(name), c = getC(name), b = buildingOf(name);
    const miss = [];
    if (!String(info.wifiNet || "") || !String(info.wifiPass || "")) miss.push(t.piWifi);
    if (!String(info.lock || "")) miss.push(t.piLock);
    if (!String(info.hasParking || "")) miss.push(t.piParking);
    if (!(String(c.email1 || "") || String(c.phone1 || ""))) miss.push(t.piContact);
    if (!eff(info.address, b && b.address)) miss.push(t.ckAddress);
    if (!eff(info.arrival, b && b.arrival)) miss.push(t.ckArrival);
    if (!String(info.propType || "")) miss.push(t.piType);
    return miss;
  };

  const save = (name) => {
    const all = { ...loadPropInfo(), [name]: store[name] || {} };
    savePropInfoAll(all);
    const c = stations[name] || {};
    try { Backend.call && Backend.call("savePropertyInfo", { property: name, info: store[name] || {} }).catch(() => {}); } catch (e) {}
    try { Backend.saveStation && Backend.saveStation({ propertyId: c.propertyId || "", propertyName: name, email1: c.email1 || "", email2: c.email2 || "", phone1: c.phone1 || "", phone2: c.phone2 || "" }); } catch (e) {}
    // if the admin pasted a LISTING url (airbnb/booking), resolve its og:image (high-res) and store it
    const purl = (store[name] || {}).photoUrl || "";
    if (/airbnb\.|booking\.com|hospitable|\/rooms\//i.test(purl) && !/\.(jpg|jpeg|png|webp)(\?|$)/i.test(purl) && Backend.call) {
      Backend.call("listingPhoto", { url: purl }).then((r) => {
        if (r && r.ok && r.image) {
          const cur = { ...loadPropInfo() };
          cur[name] = { ...(cur[name] || {}), photoUrl: r.image };
          savePropInfoAll(cur); setStore((s) => ({ ...s, [name]: { ...(s[name] || {}), photoUrl: r.image } }));
          try { Backend.call("savePropertyInfo", { property: name, info: cur[name] }).catch(() => {}); } catch (e) {}
        }
      }).catch(() => {});
    }
    onToast(`${t.piSaved} · ${name}`);
  };

  // ---- Ocultar / eliminar propiedades ----
  const [showHidden, setShowHidden] = useStateAd(false);
  const hiddenList = (store.__hidden__ && store.__hidden__.names) || [];
  const isHidden = (name) => hiddenList.some((h) => nkName(h) === nkName(name));
  const inRoster = (name) => (roster || []).some((r) => nkName(r.propertyName) === nkName(name));
  const persistHidden = (names) => {
    const rec = { names };
    setStore((s) => ({ ...s, __hidden__: rec }));
    const all = { ...loadPropInfo(), __hidden__: rec }; savePropInfoAll(all);
    try { Backend.call && Backend.call("savePropertyInfo", { property: "__hidden__", info: rec }).catch(() => {}); } catch (e) {}
  };
  const toggleHidden = (name) => {
    const on = isHidden(name);
    persistHidden(on ? hiddenList.filter((h) => nkName(h) !== nkName(name)) : [...hiddenList, canonName(name)]);
    if (openKey === name) setOpenKey(null);
    onToast(on ? (es ? `Se muestra: ${name}` : `Shown: ${name}`) : (es ? `Oculta: ${name}` : `Hidden: ${name}`));
  };
  // eliminar: solo para propiedades que ya NO existen en Hospitable (huérfanas);
  // las que siguen en el roster reaparecerían, así que esas solo se ocultan.
  const deleteProp = (name) => {
    if (!window.confirm(es ? `¿Eliminar \u00ab${name}\u00bb y toda su información guardada? Esta acción no se puede deshacer.` : `Delete \u201c${name}\u201d and all its saved info? This cannot be undone.`)) return;
    setStore((s) => { const n = { ...s }; const k = Object.keys(n).find((x) => nkName(x) === nkName(name)); if (k) delete n[k]; if (n.__hidden__) n.__hidden__ = { names: (n.__hidden__.names || []).filter((h) => nkName(h) !== nkName(name)) }; savePropInfoAll(n); return n; });
    setStations((s) => { const n = { ...s }; const k = Object.keys(n).find((x) => nkName(x) === nkName(name)); if (k) delete n[k]; return n; });
    const k = Object.keys(store).find((x) => nkName(x) === nkName(name)) || name;
    try { Backend.call && Backend.call("savePropertyInfo", { property: k, info: {} }).catch(() => {}); } catch (e) {}
    if (openKey === name) setOpenKey(null);
    onToast(es ? `Eliminada: ${name}` : `Deleted: ${name}`);
  };
  const visibleProps = props.filter((n) => showHidden || !isHidden(n));
  const hiddenCount = props.filter((n) => isHidden(n)).length;

  const seg = (name, field, options) => (
    <div style={{ display: "inline-flex", gap: 4, background: C.beige, border: `1px solid ${C.grisCalido}`, borderRadius: 10, padding: 3, flexWrap: "wrap" }}>
      {options.map(([val, label]) => {
        const on = get(name)[field] === val;
        return <button key={val} onClick={() => set(name, { [field]: val })} className="sp-btn"
          style={{ background: on ? C.negro : "transparent", color: on ? C.alabaster : C.negro, border: "none", borderRadius: 8,
            padding: "7px 13px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.02em", cursor: "pointer", fontWeight: on ? 600 : 500 }}>{label}</button>;
      })}
    </div>
  );
  const label = (s) => <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, margin: "16px 0 8px" }}>{s}</div>;
  const fieldStyle = { width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 10, border: `1px solid ${C.grisCalido}`, background: C.alabaster, fontFamily: C.sans, fontSize: 13, color: C.negro, outline: "none", marginTop: 8 };

  return (
    <div>
      <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, margin: "0 0 18px", letterSpacing: "0.02em", lineHeight: 1.55, maxWidth: 520 }}>{t.piSub}</p>

      {/* RECONCILIACIÓN DE NOMBRES — huérfanas por renombre en Hospitable (confirmación manual) */}
      {manualOrphans.length > 0 && (
        <div style={{ background: C.white, border: "1px solid rgba(233,130,106,.35)", borderRadius: 16, marginBottom: 14, overflow: "hidden" }}>
          <button onClick={() => setRecOpen((v) => !v)} className="sp-btn" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "transparent", border: "none", padding: "15px 18px", cursor: "pointer", textAlign: "left" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: C.peach, boxShadow: "0 0 0 3px rgba(233,130,106,.16)" }} />
              <span style={{ fontFamily: C.serif, fontSize: 18, color: C.negro }}>{es ? "Nombres por reconciliar" : "Names to reconcile"}</span>
              <span style={{ fontFamily: C.sans, fontSize: 10.5, fontWeight: 700, color: C.peach, background: "rgba(233,130,106,.12)", borderRadius: 999, padding: "2px 9px" }}>{manualOrphans.length}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.tierra} strokeWidth="1.25" style={{ transform: recOpen ? "rotate(180deg)" : "none", transition: "transform .18s" }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {recOpen && (
            <div style={{ padding: "0 18px 16px" }}>
              <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, margin: "0 0 14px", letterSpacing: "0.01em", lineHeight: 1.55, maxWidth: 560 }}>
                {es ? "Estas propiedades tienen información guardada bajo un nombre que ya no coincide con Hospitable. Confirma a qué propiedad actual pertenece cada una para conservar sus datos." : "These properties have info saved under a name that no longer matches Hospitable. Confirm which current property each belongs to so its data is kept."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {manualOrphans.map((o) => {
                  const sug = bestTargetFor(o);
                  const chosen = orphanTarget[o] || (sug && sug.name) || "";
                  return (
                    <div key={o} style={{ background: C.alabaster, border: `1px solid ${C.grisCalido}`, borderRadius: 12, padding: "12px 13px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: C.sans, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: C.peach, background: "rgba(233,130,106,.12)", borderRadius: 999, padding: "3px 9px" }}>{es ? "Nombre anterior" : "Old name"}</span>
                        <span style={{ fontFamily: C.sans, fontSize: 13, color: C.negro }}>{o}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.tierra} strokeWidth="1.25"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                        <select value={chosen} onChange={(e) => setOrphanTarget((m) => ({ ...m, [o]: e.target.value }))} style={{ flex: "1 1 220px", minWidth: 200, padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.grisCalido}`, background: C.white, fontFamily: C.sans, fontSize: 12.5, color: C.negro, outline: "none" }}>
                          <option value="">{es ? "Elegir propiedad actual…" : "Choose current property…"}</option>
                          {props.map((p) => <option key={p} value={p}>{p}{normKey(p) === normKey(o) ? "  ·  =" : ""}</option>)}
                        </select>
                        <button onClick={() => mergeInto(o, chosen)} disabled={!chosen} className="sp-btn" style={{ background: chosen ? C.negro : C.beige, color: chosen ? C.alabaster : C.tierra, border: "none", borderRadius: 10, padding: "9px 15px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.03em", cursor: chosen ? "pointer" : "default", fontWeight: 500 }}>{es ? "Fusionar" : "Merge"}</button>
                        <button onClick={() => discardOrphan(o)} className="sp-btn" style={{ background: "transparent", color: C.tierra, border: `1px solid ${C.grisCalido}`, borderRadius: 10, padding: "9px 13px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.03em", cursor: "pointer" }}>{es ? "Descartar" : "Discard"}</button>
                      </div>
                      {sug && sug.conf === "fuzzy" && <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "8px 0 0", letterSpacing: "0.01em" }}>{es ? "Sugerencia por similitud — verifica antes de fusionar." : "Similarity suggestion — verify before merging."}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ESTÁNDAR DE INSTRUCCIONES — colapsable. Primer batch automático; luego manual (por propiedad o todas) */}
      {pendingProps.length > 0 && (
        <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, marginBottom: 14, overflow: "hidden" }}>
          <button onClick={() => setStdOpen((v) => !v)} className="sp-btn" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "transparent", border: "none", padding: "15px 18px", cursor: "pointer", textAlign: "left" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: C.peach, boxShadow: "0 0 0 3px rgba(233,130,106,.16)" }} />
              <span style={{ fontFamily: C.serif, fontSize: 18, color: C.negro }}>{es ? "Estándar de instrucciones" : "Instruction standard"}</span>
              <span style={{ fontFamily: C.sans, fontSize: 10.5, fontWeight: 700, color: C.peach, background: "rgba(233,130,106,.12)", borderRadius: 999, padding: "2px 9px" }}>{pendingProps.length}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.tierra} strokeWidth="1.25" style={{ transform: stdOpen ? "rotate(180deg)" : "none", transition: "transform .18s" }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {stdOpen && (
            <div style={{ padding: "0 18px 16px" }}>
              <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, margin: "0 0 14px", letterSpacing: "0.01em", lineHeight: 1.55, maxWidth: 560 }}>
                {es
                  ? `${pendingProps.length} ${pendingProps.length === 1 ? "propiedad nueva o modificada" : "propiedades nuevas o modificadas"} por alinear. Al alinear se ordenan las instrucciones de check-in y parqueo ya guardadas en la estructura estándar de Spacio AM — sin cambiar los datos.`
                  : `${pendingProps.length} new or modified ${pendingProps.length === 1 ? "property" : "properties"} to align. Aligning reorders the saved check-in and parking info into Spacio AM's standard structure — facts unchanged.`}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {pendingProps.map((n) => {
                  const st = stdState(n);
                  const busy = !!aligning;
                  return (
                    <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: C.alabaster, border: `1px solid ${C.grisCalido}`, borderRadius: 12, padding: "9px 12px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <span style={{ flexShrink: 0, fontFamily: C.sans, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, borderRadius: 999, padding: "3px 9px", color: st === "none" ? C.peach : "#9A7B12", background: st === "none" ? "rgba(233,130,106,.12)" : "rgba(176,137,0,.14)" }}>{st === "none" ? (es ? "Nueva" : "New") : (es ? "Modificada" : "Modified")}</span>
                        <span style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(n)}</span>
                      </span>
                      <button onClick={() => alignSingle(n)} disabled={busy} className="sp-btn" style={{ flexShrink: 0, background: "transparent", color: busy ? C.tierra : C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 10, padding: "7px 13px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.03em", cursor: busy ? "default" : "pointer", fontWeight: 500 }}>{aligning === n ? (es ? "Alineando…" : "Aligning…") : (es ? "Alinear" : "Align")}</button>
                    </div>
                  );
                })}
              </div>
              {alignMsg && <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, margin: "0 0 12px", letterSpacing: "0.01em" }}>{alignMsg}</p>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={alignAll} disabled={!!aligning} className="sp-btn" style={{ background: C.negro, color: C.alabaster, border: "none", borderRadius: 11, padding: "11px 18px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.06em", cursor: aligning ? "default" : "pointer", fontWeight: 500, opacity: aligning ? 0.6 : 1 }}>
                  {aligning === "__all__" ? (es ? "Alineando todas…" : "Aligning all…") : (es ? "Alinear todas al estándar" : "Align all to standard")}
                </button>
                <button onClick={exportPropInfo} className="sp-btn" style={{ background: "transparent", color: C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 11, padding: "11px 18px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.04em", cursor: "pointer", fontWeight: 500 }}>
                  {es ? "Exportar información" : "Export info"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANUAL DE LA CASA — aplica a varias propiedades */}
      <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
        <button onClick={() => setManualOpen((o) => !o)} className="sp-btn" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          background: "transparent", border: "none", cursor: "pointer", padding: "16px 18px", textAlign: "left" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="manual" size={18} color={C.peach} />
            <span style={{ fontFamily: C.serif, fontSize: 19, color: C.negro }}>{es ? "Manual de la casa" : "House manual"}</span>
          </span>
          <Icon name={manualOpen ? "chevronUp" : "chevronDown"} size={18} color={C.tierra} />
        </button>
        {manualOpen && (
          <div style={{ padding: "0 18px 20px" }}>
            <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, margin: "-2px 0 14px", letterSpacing: "0.02em", lineHeight: 1.55, maxWidth: 520 }}>
              {es ? "Cada instrucción puede aplicarse a varias propiedades. Marca las propiedades a las que aplica y aparecerá en su manual del bento." : "Each instruction can apply to several properties. Select the ones it applies to and it will appear in their bento manual."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {manualItems.map((it) => (
                <div key={it.id} style={{ border: `1px solid ${C.grisCalido}`, borderRadius: 14, padding: "14px 15px", background: C.alabaster }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <input value={it.title || ""} onChange={(e) => setManualItem(it.id, { title: e.target.value })} placeholder={es ? "Título (ej. Estufa de inducción)" : "Title"} style={{ ...fieldStyle, marginTop: 0, flex: 1, fontFamily: C.serif, fontSize: 15 }} />
                    <button onClick={() => removeManualItem(it.id)} className="sp-btn" title={es ? "Eliminar" : "Delete"} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}><Icon name="x" size={16} color={C.tierra} /></button>
                  </div>
                  <textarea value={it.intro || ""} onChange={(e) => setManualItem(it.id, { intro: e.target.value })} placeholder={es ? "Introducción (opcional)" : "Intro (optional)"} rows={2} style={{ ...fieldStyle, marginTop: 0, resize: "vertical" }} />
                  <textarea value={(it.steps || []).join("\n")} onChange={(e) => setManualItem(it.id, { steps: e.target.value.split("\n").map((s) => s.trimStart()).filter((s, i, a) => s !== "" || i < a.length) })} placeholder={es ? "Pasos — uno por línea" : "Steps — one per line"} rows={4} style={{ ...fieldStyle, resize: "vertical" }} />
                  <div style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, margin: "12px 0 8px" }}>{es ? "Aplica a" : "Applies to"}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {props.map((pn) => {
                      const on = (manualAssign[it.id] || []).includes(pn);
                      return <button key={pn} onClick={() => toggleAssign(it.id, pn)} className="sp-btn" style={{ background: on ? C.negro : C.white, color: on ? C.alabaster : C.negro,
                        border: `1px solid ${on ? C.negro : C.grisCalido}`, borderRadius: 999, padding: "7px 13px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.02em", cursor: "pointer", fontWeight: on ? 600 : 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {on && <Icon name="check" size={12} color={C.alabaster} />}{pn}</button>;
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={addManualItem} className="sp-btn" style={{ background: "transparent", color: C.negro, border: `1px dashed ${C.grisCalido}`, borderRadius: 11, padding: "10px 16px",
                fontFamily: C.sans, fontSize: 11, letterSpacing: "0.04em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="user" size={14} color={C.negro} /> {es ? "Agregar instrucción" : "Add instruction"}</button>
              <button onClick={saveManual} className="sp-btn" style={{ background: C.negro, color: C.alabaster, border: "none", borderRadius: 11, padding: "10px 18px",
                fontFamily: C.sans, fontSize: 11, letterSpacing: "0.06em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="check" size={14} color={C.alabaster} /> {es ? "Guardar manual" : "Save manual"}</button>
            </div>
          </div>
        )}
      </div>

      {props.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "38px 20px", textAlign: "center", fontFamily: C.sans, fontSize: 13, color: C.tierra }}>{t.stEmpty}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {hiddenCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "2px 4px 6px" }}>
              <span style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, letterSpacing: "0.02em" }}>{hiddenCount} {es ? (hiddenCount === 1 ? "propiedad oculta" : "propiedades ocultas") : (hiddenCount === 1 ? "hidden property" : "hidden properties")}</span>
              <button onClick={() => setShowHidden((v) => !v)} className="sp-btn" style={{ background: "transparent", color: C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 999, padding: "6px 13px", fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.04em", cursor: "pointer", fontWeight: 500 }}>{showHidden ? (es ? "Ocultar" : "Hide") : (es ? "Mostrar ocultas" : "Show hidden")}</button>
            </div>
          )}
          {visibleProps.map((name) => {
            const info = get(name);
            const open = openKey === name;
            const miss = missingFields(name);
            const hid = isHidden(name);
            return (
              <div key={name} style={{ background: C.white, border: `1px solid ${hid ? C.grisCalido : C.grisCalido}`, borderRadius: 16, overflow: "hidden", opacity: hid ? 0.62 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", padding: "16px 12px 16px 18px", gap: 8 }}>
                  <button onClick={() => setOpenKey(open ? null : name)} className="sp-btn" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, minWidth: 0,
                    background: "transparent", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                      <span title={miss.length ? (es ? "Campos pendientes" : "Pending fields") : (es ? "Completo" : "Complete")} style={{ flexShrink: 0, width: 10, height: 10, borderRadius: "50%",
                        background: miss.length ? C.peach : "#1F8A5B", boxShadow: `0 0 0 3px ${miss.length ? "rgba(233,130,106,.16)" : "rgba(31,138,91,.16)"}` }} />
                      <span style={{ fontFamily: C.serif, fontSize: 19, color: C.negro, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(name)}</span>
                      {hid && <span style={{ flexShrink: 0, fontFamily: C.sans, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", color: C.tierra, fontWeight: 700, border: `1px solid ${C.grisCalido}`, borderRadius: 999, padding: "2px 9px" }}>{es ? "Oculta" : "Hidden"}</span>}
                      {miss.length > 0 && !hid && <span style={{ flexShrink: 0, fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: C.peach, fontWeight: 600 }}>· {miss.length} {es ? "pendientes" : "pending"}</span>}
                    </span>
                    <Icon name={open ? "chevronUp" : "chevronDown"} size={18} color={C.tierra} />
                  </button>
                  <button onClick={() => toggleHidden(name)} className="sp-btn" title={hid ? (es ? "Mostrar" : "Show") : (es ? "Ocultar" : "Hide")} style={{ flexShrink: 0, background: "transparent", border: `1px solid ${C.grisCalido}`, borderRadius: 9, padding: "6px 7px", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name={hid ? "eye" : "eyeOff"} size={15} color={C.tierra} /></button>
                  {!inRoster(name) && <button onClick={() => deleteProp(name)} className="sp-btn" title={es ? "Eliminar" : "Delete"} style={{ flexShrink: 0, background: "transparent", border: `1px solid ${C.grisCalido}`, borderRadius: 9, padding: "6px 7px", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="trash" size={15} color={C.tierra} /></button>}
                </div>
                {open && (
                  <div style={{ padding: "0 18px 20px" }}>
                    {miss.length > 0 && (
                      <div style={{ background: "#FBEEEA", border: "1px solid rgba(233,130,106,.3)", borderRadius: 12, padding: "12px 15px", marginBottom: 4 }}>
                        <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.peach, fontWeight: 700, marginBottom: 6 }}>{es ? "Campos pendientes" : "Pending fields"}</div>
                        <div style={{ fontFamily: C.sans, fontSize: 12, color: C.negro, letterSpacing: "0.01em", lineHeight: 1.5 }}>{miss.join(" · ")}</div>
                      </div>
                    )}
                    {/* ESTÁNDAR DE INSTRUCCIONES — estado + botón + vista previa de pasos */}
                    {hasStdContent(name) && (() => {
                      const st = stdState(name);
                      const sc = (info.std && info.std[es ? "es" : "en"]) || null;
                      const busy = !!aligning;
                      return (
                        <div style={{ background: C.alabaster, border: `1px solid ${C.grisCalido}`, borderRadius: 12, padding: "14px 15px", margin: "12px 0 4px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 9, height: 9, borderRadius: "50%", background: st === "ok" ? "#1F8A5B" : C.peach }} />
                              <span style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600 }}>{es ? "Estándar de instrucciones" : "Instruction standard"}</span>
                            </span>
                            <button onClick={() => alignSingle(name)} disabled={busy} className="sp-btn" style={{ background: st === "ok" ? "transparent" : C.negro, color: st === "ok" ? C.negro : C.alabaster, border: `1px solid ${st === "ok" ? C.grisCalido : C.negro}`, borderRadius: 10, padding: "7px 13px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.03em", cursor: busy ? "default" : "pointer", fontWeight: 500 }}>{aligning === name ? (es ? "Alineando…" : "Aligning…") : st === "ok" ? (es ? "Rehacer" : "Redo") : (es ? "Alinear al estándar" : "Align to standard")}</button>
                          </div>
                          <p style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, margin: "9px 0 0", letterSpacing: "0.01em", lineHeight: 1.5 }}>
                            {st === "ok" ? (es ? "Alineado. Los textos que ve el huésped usan la versión estándar." : "Aligned. Guest-facing texts use the standard version.")
                              : st === "stale" ? (es ? "Se modificaron las instrucciones desde la última alineación." : "Instructions changed since last alignment.")
                              : (es ? "Aún sin alinear al estándar." : "Not aligned to the standard yet.")}
                          </p>
                          {sc && sc.arrivalSteps && sc.arrivalSteps.length > 0 && (
                            <ol style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                              {sc.arrivalSteps.map((s, i) => (
                                <li key={i} style={{ display: "flex", gap: 10 }}>
                                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: C.peach, color: C.white, fontFamily: C.sans, fontSize: 10.5, display: "grid", placeItems: "center" }}>{i + 1}</span>
                                  <span style={{ fontFamily: C.sans, fontSize: 12, color: C.negro, lineHeight: 1.5, letterSpacing: "0.01em" }}>{s}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      );
                    })()}
                    {/* PARQUEO */}
                    {label(t.piParking)}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: C.sans, fontSize: 12, color: C.negro }}>{t.piHasParking}</span>
                      {seg(name, "hasParking", [["yes", t.piYes], ["no", t.piNo]])}
                    </div>
                    {info.hasParking === "yes" && <input value={info.parkNumber || ""} onChange={(e) => set(name, { parkNumber: e.target.value })} placeholder={t.piParkNumber} style={fieldStyle} />}
                    {info.hasParking === "no" && <>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                        <span style={{ fontFamily: C.sans, fontSize: 12, color: C.negro }}>{t.piParkOption}</span>
                        {seg(name, "parkOption", [["yes", t.piYes], ["no", t.piNo]])}
                      </div>
                      {info.parkOption === "yes" && <>
                        <div style={{ marginTop: 12 }}>{seg(name, "parkOwnership", [["own", t.piParkOwn], ["third", t.piParkThird]])}</div>
                        {info.parkOwnership === "own" && <input value={info.parkLink || ""} onChange={(e) => set(name, { parkLink: e.target.value })} placeholder={t.piParkLink} style={fieldStyle} />}
                        {info.parkOwnership === "third" && <textarea value={info.parkExtInfo || ""} onChange={(e) => set(name, { parkExtInfo: e.target.value })} placeholder={t.piParkExtInfo} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />}
                      </>}
                    </>}

                    <textarea value={info.parkNote || ""} onChange={(e) => set(name, { parkNote: e.target.value })} placeholder={es ? "Nota de parqueo (texto libre que verá el huésped)" : "Parking note (free text shown to guest)"} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />

                    {/* WIFI */}
                    {label(t.piWifi)}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <input value={info.wifiNet || ""} onChange={(e) => set(name, { wifiNet: e.target.value })} placeholder={t.piWifiNet} style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                      <input value={info.wifiPass || ""} onChange={(e) => set(name, { wifiPass: e.target.value })} placeholder={t.piWifiPass} style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                      <input value={info.wifiNetBk || ""} onChange={(e) => set(name, { wifiNetBk: e.target.value })} placeholder={`${t.piWifiBackup} — ${t.piWifiNet}`} style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                      <input value={info.wifiPassBk || ""} onChange={(e) => set(name, { wifiPassBk: e.target.value })} placeholder={`${t.piWifiBackup} — ${t.piWifiPass}`} style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                      <input value={info.wifiNetBk2 || ""} onChange={(e) => set(name, { wifiNetBk2: e.target.value })} placeholder={`${t.piWifiBackup} 2 — ${t.piWifiNet}`} style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                      <input value={info.wifiPassBk2 || ""} onChange={(e) => set(name, { wifiPassBk2: e.target.value })} placeholder={`${t.piWifiBackup} 2 — ${t.piWifiPass}`} style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                    </div>
                    <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "8px 0 0", letterSpacing: "0.02em" }}>{t.piWifiBackupNote}</p>

                    {/* CERRADURA */}
                    {label(t.piLock)}
                    {seg(name, "lock", [["smart", t.piLockSmart], ["box", t.piLockBox], ["key", t.piLockKey], ["other", t.piLockOther]])}
                    {info.lock === "smart" && (
                      <div style={{ marginTop: 10 }}>{seg(name, "smartBrand", [["Igloohome", "Igloohome"], ["Nuki", "Nuki"], ["Smart Life", "Smart Life"], ["Kwikset", "Kwikset"], ["other", t.piLockOther]])}</div>
                    )}

                    {/* TIPO */}
                    {label(t.piType)}
                    {seg(name, "propType", [["apt", t.piTypeApt], ["condo", t.piTypeCondo], ["off", t.piTypeOff]])}

                    {/* CONTACTO (recibe el formulario completado) */}
                    {label(t.piContact)}
                    <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "-2px 0 10px", letterSpacing: "0.02em", lineHeight: 1.5 }}>{t.piContactNote}</p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <input value={getC(name).email1 || ""} onChange={(e) => setC(name, { email1: e.target.value })} placeholder={t.stEmail1} type="email" style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                      <input value={getC(name).email2 || ""} onChange={(e) => setC(name, { email2: e.target.value })} placeholder={t.stEmail2} type="email" style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                      <input value={getC(name).phone1 || ""} onChange={(e) => setC(name, { phone1: e.target.value })} placeholder={t.stPhone1} type="tel" style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                      <input value={getC(name).phone2 || ""} onChange={(e) => setC(name, { phone2: e.target.value })} placeholder={t.stPhone2} type="tel" style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                    </div>

                    {/* INSTRUCCIONES GENERALES (edificio / condominio / región) */}
                    {label(t.piInstructions)}
                    <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "-2px 0 10px", letterSpacing: "0.02em", lineHeight: 1.5 }}>{t.piInstructionsNote}</p>
                    <input value={info.address != null ? info.address : (buildingOf(name)?.address || "")} onChange={(e) => setInstr(name, { address: e.target.value })} placeholder={t.ckAddress} style={{ ...fieldStyle, marginTop: 0 }} />
                    <textarea value={info.arrival != null ? info.arrival : (buildingOf(name)?.arrival || "")} onChange={(e) => setInstr(name, { arrival: e.target.value })} placeholder={t.ckArrival} rows={4} style={{ ...fieldStyle, resize: "vertical" }} />
                    <textarea value={info.tip != null ? info.tip : (buildingOf(name)?.tip || "")} onChange={(e) => setInstr(name, { tip: e.target.value })} placeholder={t.piCheckinNote} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
                    <input value={info.maps != null ? info.maps : (buildingOf(name)?.maps || "")} onChange={(e) => setInstr(name, { maps: e.target.value })} placeholder={t.ckMaps + " URL"} style={{ ...fieldStyle }} />
                    <input value={info.waze != null ? info.waze : (buildingOf(name)?.waze || "")} onChange={(e) => setInstr(name, { waze: e.target.value })} placeholder={t.ckWaze + " URL"} style={{ ...fieldStyle }} />
                    {label(t.ckCheckoutTitle)}
                    <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "-2px 0 10px", letterSpacing: "0.02em", lineHeight: 1.5 }}>{t.piCheckoutNote}</p>
                    <textarea value={info.checkoutMsg != null ? info.checkoutMsg : ""} onChange={(e) => setInstr(name, { checkoutMsg: e.target.value })} placeholder={t.ckCheckoutDefault} rows={8} style={{ ...fieldStyle, resize: "vertical" }} />
                    {/* Aplica estas instrucciones a otras propiedades (compartidas y sincronizadas) */}
                    <div style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, margin: "14px 0 4px" }}>{es ? "Aplica estas instrucciones a" : "Apply these instructions to"}</div>
                    <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "0 0 9px", letterSpacing: "0.02em", lineHeight: 1.5 }}>{es ? "Las propiedades marcadas comparten estas mismas instrucciones; al editar una se actualizan todas." : "Selected properties share these instructions; editing one updates them all."}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {props.filter((pn) => pn !== name).map((pn) => {
                        const on = (info.instrApply || []).includes(pn);
                        return <button key={pn} onClick={() => toggleInstrApply(name, pn)} className="sp-btn" style={{ background: on ? C.negro : C.white, color: on ? C.alabaster : C.negro,
                          border: `1px solid ${on ? C.negro : C.grisCalido}`, borderRadius: 999, padding: "7px 13px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.02em", cursor: "pointer", fontWeight: on ? 600 : 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {on && <Icon name="check" size={12} color={C.alabaster} />}{pn}</button>;
                      })}
                    </div>
                    <input value={info.photoUrl || ""} onChange={(e) => set(name, { photoUrl: e.target.value })} placeholder={t.piPhotoUrl} style={{ ...fieldStyle, marginTop: 12 }} />
                    <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "6px 0 0", letterSpacing: "0.02em", lineHeight: 1.5 }}>{t.piPhotoNote}</p>

                    {/* EN SITIO */}
                    {label(es ? "En sitio (piso, unidad, contacto)" : "On site (floor, unit, contact)")}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <input value={info.floor || ""} onChange={(e) => set(name, { floor: e.target.value })} placeholder={es ? "Piso / nivel" : "Floor / level"} style={{ ...fieldStyle, marginTop: 0, flex: "1 1 120px" }} />
                      <input value={info.unit || ""} onChange={(e) => set(name, { unit: e.target.value })} placeholder={es ? "Unidad / apto" : "Unit / apt"} style={{ ...fieldStyle, marginTop: 0, flex: "1 1 120px" }} />
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                      <input value={info.contactName || ""} onChange={(e) => set(name, { contactName: e.target.value })} placeholder={es ? "Contacto en sitio (nombre)" : "On-site contact (name)"} style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                      <input value={info.contactPhone || ""} onChange={(e) => set(name, { contactPhone: e.target.value })} placeholder={es ? "Teléfono del contacto" : "Contact phone"} type="tel" style={{ ...fieldStyle, marginTop: 0, flex: "1 1 160px" }} />
                    </div>

                    {/* AMENIDADES */}
                    {label(es ? "Amenidades (una por línea)" : "Amenities (one per line)")}
                    <textarea value={(info.amenities || []).join("\n")} onChange={(e) => set(name, { amenities: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} placeholder={es ? "Piscina\nGimnasio\nRooftop" : "Pool\nGym\nRooftop"} rows={4} style={{ ...fieldStyle, marginTop: 8, resize: "vertical" }} />
                    <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, margin: "6px 0 0", letterSpacing: "0.02em", lineHeight: 1.5 }}>{es ? "Si dejas esto vacío, se usan las amenidades de Hospitable." : "If left empty, Hospitable amenities are used."}</p>

                    <div style={{ marginTop: 20 }}>
                      <button onClick={() => save(name)} className="sp-btn" style={{ background: C.negro, color: C.alabaster, border: "none", borderRadius: 10, padding: "10px 20px",
                        fontFamily: C.sans, fontSize: 11, letterSpacing: "0.06em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <Icon name="check" size={14} color={C.alabaster} /> {t.piSave}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SEGUIMIENTO — pendientes hoy, facturas, día adicional, early
   ============================================================ */
/* botón admin: avisar al huésped que la factura está lista */
function InvoiceNotifyButton({ t, iv }) {
  const [state, setState] = useStateAd(""); // "" | sending | done | fail
  const notify = () => {
    setState("sending");
    Backend.call("notifyInvoiceReady", { code: iv.code, apartment: iv.apartment })
      .then((r) => setState(r && r.ok ? "done" : "fail"))
      .catch(() => setState("fail"));
  };
  if (state === "done") return <span style={{ fontFamily: C.sans, fontSize: 11, color: "#1F8A5B", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="check" size={14} color="#1F8A5B" /> {t.segInvoiceSent}</span>;
  return (
    <button onClick={notify} disabled={state === "sending"} className="sp-btn"
      style={{ background: C.negro, color: C.alabaster, border: "none", borderRadius: 10, padding: "8px 14px",
        fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.05em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7 }}>
      <Icon name="mail" size={13} color={C.alabaster} /> {state === "sending" ? t.segInvoiceSending : (state === "fail" ? t.hospFail : t.segInvoiceReady)}
    </button>
  );
}

function SeguimientoScreen({ t, roster }) {
  const store = typeof loadStore === "function" ? loadStore() : {};
  const es = t.code === "es";
  const [, force] = useStateAd(0);
  const [busyKey, setBusyKey] = useStateAd("");
  const connected = !!(Backend.isConnected && Backend.isConnected());
  // marca local (fallback sin conexión): decision por solicitud
  const reqKey = (r) => `${r.type}|${r.code}|${r.at || ""}`;
  const [marksV, setMarksV] = useStateAd(0);
  const marks = (loadStore().reqMarks) || {};
  const setMark = (r, patch) => {
    const s = loadStore();
    const m = { ...(s.reqMarks || {}) };
    m[reqKey(r)] = { ...(m[reqKey(r)] || {}), ...patch };
    saveStore({ ...s, reqMarks: m });
    setMarksV((n) => n + 1);
  };
  // solicitudes: del backend (cualquier dispositivo) o de localStorage si no hay conexión
  const [reqs, setReqs] = useStateAd(null);
  const reload = () => {
    if (connected && Backend.listRequests) {
      Backend.listRequests().then((list) => { if (list) setReqs(list); }).catch(() => {});
    } else {
      setReqs((loadStore().hostRequests || []).map((r) => ({ ...r, decision: null })));
    }
  };
  useEffectAd(() => { reload(); }, [connected]);
  // decisión efectiva: la del backend, o la marca local como respaldo
  const decisionOf = (r) => r.decision || (marks[reqKey(r)] && marks[reqKey(r)].decision) || null;
  // aprobar / rechazar → registra y avisa al huésped por correo
  const resolveReq = (r, decision) => {
    setBusyKey(reqKey(r) + "|" + decision);
    const payload = { code: r.code, kind: r.type, apartment: r.apartment, decision };
    if (connected && Backend.hostRequestResolve) {
      Backend.hostRequestResolve(payload).catch(() => {}).then(() => { setBusyKey(""); reload(); });
    } else {
      setMark(r, { decision }); setBusyKey("");
    }
  };
  // borrar → quita la solicitud de la lista (sin avisar al huésped)
  const deleteReq = (r) => {
    if (typeof window !== "undefined" && window.confirm && !window.confirm(t.segDeleteConfirm)) return;
    if (connected && Backend.hostRequestResolve) {
      Backend.hostRequestResolve({ code: r.code, kind: r.type, apartment: r.apartment, decision: "deleted" }).catch(() => {}).then(() => reload());
    } else {
      const s = loadStore();
      const list = (s.hostRequests || []).filter((x) => reqKey(x) !== reqKey(r));
      const m = { ...(s.reqMarks || {}) }; delete m[reqKey(r)];
      saveStore({ ...s, hostRequests: list, reqMarks: m });
    }
    setReqs((prev) => (prev || []).filter((x) => reqKey(x) !== reqKey(r)));
  };
  // documento más viejo + retención (control de almacenamiento)
  const [stor, setStor] = useStateAd(null);
  useEffectAd(() => {
    if (!(Backend.isConnected && Backend.isConnected() && Backend.storageStats)) return;
    Backend.storageStats().then((s) => { if (s && s.ok) setStor(s); }).catch(() => {});
  }, []);
  // pending registrations checking-in today
  const pendingToday = (roster || []).filter((r) => checkinBucket(r.checkin) === "today" && r.statusForm !== "completo");
  const invoices = (store.invoices || []).filter((i) => i.status !== "done");
  const hostReqs = reqs || [];
  const dayReqs = hostReqs.filter((r) => r.type === "late" || r.type === "day");
  const earlyReqs = hostReqs.filter((r) => r.type === "early" || r.type === "luggage");
  const suggestions = store.suggestions || [];

  const checkbox = (r, label) => {
    const done = !!(marks[reqKey(r)] && marks[reqKey(r)].done);
    return (
      <button onClick={() => setMark(r, { done: !done })} className="sp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8,
        background: done ? "rgba(31,138,91,.1)" : C.white, border: `1px solid ${done ? "rgba(31,138,91,.4)" : C.grisCalido}`, borderRadius: 999,
        padding: "6px 12px", cursor: "pointer", fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.04em", color: done ? "#177A4F" : C.tierra, fontWeight: 500 }}>
        <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${done ? "#1F8A5B" : C.taupe}`, background: done ? "#1F8A5B" : "transparent", display: "grid", placeItems: "center" }}>
          {done && <Icon name="check" size={10} color={C.white} />}
        </span>
        {done ? (es ? "Gestionado" : "Handled") : label}
      </button>
    );
  };
  // aprobar · rechazar · borrar — con aviso al huésped al resolver
  const trashBtn = (r) => (
    <button onClick={() => deleteReq(r)} className="sp-btn" title={t.segDelete}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10,
        background: C.white, border: `1px solid ${C.grisCalido}`, color: C.tierra, cursor: "pointer" }}>
      <Icon name="trash" size={15} color={C.tierra} />
    </button>
  );
  const resolveBtns = (r) => {
    const decision = decisionOf(r);
    const busy = busyKey.indexOf(reqKey(r) + "|") === 0;
    if (decision === "approved" || decision === "rejected") {
      const ap = decision === "approved";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, padding: "7px 14px", fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.05em", fontWeight: 600,
            background: ap ? "rgba(31,138,91,.1)" : "rgba(233,130,106,.12)", border: `1px solid ${ap ? "rgba(31,138,91,.4)" : "rgba(233,130,106,.45)"}`, color: ap ? "#177A4F" : C.peach }}>
            <Icon name={ap ? "check" : "x"} size={13} color={ap ? "#1F8A5B" : C.peach} /> {ap ? t.segApproved : t.segRejected}
          </span>
          {trashBtn(r)}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => resolveReq(r, "approved")} disabled={busy} className="sp-btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.negro, color: C.alabaster, border: "none", borderRadius: 999,
            padding: "7px 15px", cursor: busy ? "wait" : "pointer", fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.05em", fontWeight: 500, opacity: busy ? 0.6 : 1 }}>
          <Icon name="check" size={13} color={C.alabaster} /> {t.segApprove}
        </button>
        <button onClick={() => resolveReq(r, "rejected")} disabled={busy} className="sp-btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.white, color: C.peach, border: `1px solid rgba(233,130,106,.5)`, borderRadius: 999,
            padding: "7px 15px", cursor: busy ? "wait" : "pointer", fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.05em", fontWeight: 500, opacity: busy ? 0.6 : 1 }}>
          <Icon name="x" size={13} color={C.peach} /> {t.segReject}
        </button>
        {trashBtn(r)}
      </div>
    );
  };

  const card = (children, key) => <div key={key} style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 14, padding: "14px 16px" }}>{children}</div>;
  const sectionHead = (icon, title, count) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px" }}>
      <Icon name={icon} size={17} color={C.peach} />
      <span style={{ fontFamily: C.serif, fontSize: 20, color: C.negro }}>{title}</span>
      <span style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, background: C.beige, borderRadius: 999, padding: "2px 9px", fontWeight: 600 }}>{count}</span>
    </div>
  );
  const empty = () => <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, margin: 0, letterSpacing: "0.02em" }}>{t.segEmpty}</p>;
  const reqLabel = { early: t.segReqEarly, late: t.segReqLate, day: t.segReqDay, luggage: t.segReqLuggage };

  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(es ? "es-GT" : "en-US", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return "—"; } };
  const storStat = (label, value, accent) => (
    <div>
      <div style={{ fontFamily: C.sans, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: C.sans, fontSize: 17, color: accent ? C.peach : C.negro, fontWeight: 500, letterSpacing: "0.01em" }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {stor && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px" }}>
            <Icon name="lock" size={17} color={C.peach} />
            <span style={{ fontFamily: C.serif, fontSize: 20, color: C.negro }}>{t.storTitle}</span>
          </div>
          {stor.stored > 0 ? (
            <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 14, padding: "18px 20px",
              display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 18 }}>
              {storStat(t.storOldest, stor.oldest ? fmtDate(stor.oldest) : "—")}
              {storStat(t.storAge, stor.oldestAgeDays != null ? `${stor.oldestAgeDays} ${t.storDays}` : "—", true)}
              {storStat(t.storStored, String(stor.stored))}
              {storStat(t.storNextPurge, stor.nextPurge ? fmtDate(stor.nextPurge) : "—")}
              {storStat(t.storRetention, `${stor.retentionMonths} ${t.storMonths}`)}
            </div>
          ) : (
            <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, margin: 0, letterSpacing: "0.02em" }}>{t.storNone}</p>
          )}
        </section>
      )}
      <section>
        {sectionHead("checkin", t.segPending, pendingToday.length)}
        {pendingToday.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingToday.map((r, i) => card(
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div><div style={{ fontFamily: C.serif, fontSize: 16, color: C.negro }}>{r.propertyName}</div>
                  <div style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, marginTop: 2 }}>{r.code} · {r.guestName || "—"}</div></div>
                <span style={{ fontFamily: C.sans, fontSize: 10.5, color: C.negro, background: C.beige, borderRadius: 999, padding: "5px 11px", letterSpacing: "0.04em" }}>{r.checkin}</span>
              </div>, i
            ))}
          </div>
        ) : empty()}
      </section>

      <section>
        {sectionHead("factura", t.segInvoices, invoices.length)}
        {invoices.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invoices.map((iv, i) => {
              const deadline = new Date((iv.at || Date.now()) + 5 * 86400000);
              return card(
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: C.serif, fontSize: 16, color: C.negro }}>{iv.name || "—"}</div>
                      <div style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, marginTop: 2 }}>NIT {iv.nit} · {iv.code}{iv.apartment ? " · " + iv.apartment : ""}</div>
                      {iv.comment && <div style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, marginTop: 4, fontStyle: "italic" }}>{iv.comment}</div>}
                    </div>
                    <span style={{ flexShrink: 0, fontFamily: C.sans, fontSize: 10, color: C.peach, background: "rgba(233,130,106,.12)", borderRadius: 999, padding: "5px 11px", letterSpacing: "0.03em", fontWeight: 600 }}>
                      {t.segDeadline}: {deadline.toISOString().slice(0, 10)}
                    </span>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <InvoiceNotifyButton t={t} iv={iv} />
                  </div>
                </div>, i
              );
            })}
          </div>
        ) : empty()}
      </section>

      <section>
        {sectionHead("clock", t.segDayReq, dayReqs.length)}
        {dayReqs.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dayReqs.map((r, i) => card(
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div><div style={{ fontFamily: C.serif, fontSize: 16, color: C.negro }}>{r.apartment || r.code}</div>
                  <div style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, marginTop: 2 }}>{reqLabel[r.type] || r.type} · {r.code}</div></div>
                {resolveBtns(r)}
              </div>, i
            ))}
          </div>
        ) : empty()}
      </section>

      <section>
        {sectionHead("clock", t.segEarly, earlyReqs.length)}
        {earlyReqs.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {earlyReqs.map((r, i) => card(
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div><div style={{ fontFamily: C.serif, fontSize: 16, color: C.negro }}>{r.apartment || r.code}</div>
                  <div style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, marginTop: 2 }}>{reqLabel[r.type] || r.type} · {r.code}</div></div>
                {resolveBtns(r)}
              </div>, i
            ))}
          </div>
        ) : empty()}
      </section>

      <section>
        {sectionHead("review", t.segSuggestions, suggestions.length)}
        {suggestions.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map((s, i) => card(
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div style={{ fontFamily: C.serif, fontSize: 16, color: C.negro }}>{s.propertyName || s.apartment || s.code}</div>
                  <span style={{ flexShrink: 0, fontFamily: C.sans, fontSize: 10, color: C.tierra }}>{new Date(s.at).toISOString().slice(0, 10)}</span>
                </div>
                <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.55, margin: "6px 0 0", letterSpacing: "0.01em" }}>{s.text}</p>
              </div>, i
            ))}
          </div>
        ) : empty()}
      </section>
    </div>
  );
}

/* ============================================================
   ACCESOS — el administrador principal crea/elimina otros admins
   ============================================================ */
function AdminAccessScreen({ t, onToast }) {
  const [list, setList] = useStateAd(loadAdmins());
  const [email, setEmail] = useStateAd("");
  const [pass, setPass] = useStateAd("");
  const [err, setErr] = useStateAd("");
  const [busy, setBusy] = useStateAd(false);
  const es = t.code === "es";
  const [testTo, setTestTo] = useStateAd(ADMIN_CREDENTIALS.email || "");
  const [testMsg, setTestMsg] = useStateAd(null); // { ok, text }
  const [testBusy, setTestBusy] = useStateAd(false);
  const sendTest = () => {
    const e = (testTo || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setTestMsg({ ok: false, text: es ? "Correo inválido." : "Invalid email." }); return; }
    if (!Backend.isConnected()) { setTestMsg({ ok: false, text: es ? "El backend no está conectado." : "Backend not connected." }); return; }
    setTestBusy(true); setTestMsg(null);
    Backend.sendTestEmail(e).then((r) => {
      setTestBusy(false);
      setTestMsg({ ok: true, text: (es ? "Correo de prueba enviado a " : "Test email sent to ") + (r.to || e) + "." });
    }).catch((error) => {
      setTestBusy(false);
      setTestMsg({ ok: false, text: (es ? "No se pudo enviar. " : "Could not send. ") + (error && error.message || error) });
    });
  };
  const [waTo, setWaTo] = useStateAd("");
  const [waMsg, setWaMsg] = useStateAd(null);
  const [waBusy, setWaBusy] = useStateAd(false);
  const [contacts, setContacts] = useStateAd(null);
  const [contactsBusy, setContactsBusy] = useStateAd(false);
  const [copied, setCopied] = useStateAd(false);
  const [sendLog, setSendLog] = useStateAd(null);
  const [logBusy, setLogBusy] = useStateAd(false);
  const loadLog = () => {
    if (!Backend.isConnected() || !Backend.listSendLog) return;
    setLogBusy(true);
    Backend.listSendLog(80).then((l) => { setLogBusy(false); if (l) setSendLog(l); }).catch(() => setLogBusy(false));
  };
  useEffectAd(() => { loadLog(); }, []);
  const loadContacts = () => {
    if (!Backend.isConnected()) return;
    setContactsBusy(true);
    Backend.listContacts().then((r) => { setContactsBusy(false); if (r && r.ok) setContacts(r); }).catch(() => setContactsBusy(false));
  };
  useEffectAd(() => { loadContacts(); }, []);
  const copyNums = () => {
    const txt = (contacts && contacts.numbers || []).join(", ");
    try { navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {}
  };
  const sendWaTest = () => {
    if (!Backend.isConnected()) { setWaMsg({ ok: false, text: es ? "El backend no está conectado." : "Backend not connected." }); return; }
    setWaBusy(true); setWaMsg(null);
    Backend.sendTestWhatsApp((waTo || "").trim()).then((r) => {
      setWaBusy(false);
      setWaMsg({ ok: true, text: (es ? "WhatsApp de prueba enviado a " : "Test WhatsApp sent to ") + (r.to || "") + "." });
    }).catch((error) => {
      setWaBusy(false);
      setWaMsg({ ok: false, text: (es ? "No se pudo enviar. " : "Could not send. ") + (error && error.message || error) });
    });
  };
  // cross-device: load the admin list from the backend when connected
  useEffectAd(() => {
    if (Backend.isConnected()) Backend.listAdmins().then((rows) => { if (rows) setList(rows); });
  }, []);
  const add = () => {
    const e = (email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setErr(t.accEmailErr); return; }
    if ((pass || "").length < 6) { setErr(t.accPassErr); return; }
    if (e === ADMIN_CREDENTIALS.email || list.some((a) => a.email === e)) { setErr(t.accDup); return; }
    setBusy(true);
    // keep a local copy (works offline) AND persist to backend (cross-device)
    const local = [...loadAdmins().filter((a) => a.email !== e), { email: e, pass, at: Date.now() }];
    saveAdmins(local);
    Backend.saveAdmin(e, pass, ADMIN_CREDENTIALS.email).then(() => {
      setBusy(false);
      setList((l) => [...l.filter((a) => a.email !== e), { email: e }]);
      setEmail(""); setPass(""); setErr("");
      onToast(`${t.accAdded} · ${e}`);
    }).catch(() => { setBusy(false); setList((l) => [...l.filter((a) => a.email !== e), { email: e }]); setEmail(""); setPass(""); onToast(`${t.accAdded} · ${e}`); });
  };
  const remove = (e) => {
    saveAdmins(loadAdmins().filter((a) => a.email !== e));
    setList((l) => l.filter((a) => a.email !== e));
    Backend.removeAdmin(e).catch(() => {});
    onToast(t.accRemoved);
  };
  const fieldStyle = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.grisCalido}`,
    background: C.alabaster, fontFamily: C.sans, fontSize: 13.5, color: C.negro, outline: "none", letterSpacing: "0.01em" };
  return (
    <div>
      <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, margin: "0 0 18px", letterSpacing: "0.02em", lineHeight: 1.55, maxWidth: 520 }}>{t.accSub}</p>

      <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "18px 18px", marginBottom: 18 }}>
        <div style={{ fontFamily: C.serif, fontSize: 19, color: C.negro, marginBottom: 14 }}>{t.accNew}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder={t.accEmail} type="email" style={fieldStyle} />
          <input value={pass} onChange={(e) => { setPass(e.target.value); setErr(""); }} placeholder={t.accPass} type="text" style={fieldStyle} />
          {err && <span style={{ fontFamily: C.sans, fontSize: 11.5, color: C.peach, letterSpacing: "0.02em" }}>{err}</span>}
          <button onClick={add} className="sp-btn" style={{ background: C.negro, color: C.alabaster, border: "none", borderRadius: 11, padding: "11px 18px",
            fontFamily: C.sans, fontSize: 11, letterSpacing: "0.06em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "flex-start" }}>
            <Icon name="user" size={14} color={C.alabaster} /> {t.accCreate}
          </button>
        </div>
      </div>

      <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, marginBottom: 10 }}>{t.accCurrent}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: C.beige, border: `1px solid ${C.grisCalido}`, borderRadius: 12, padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, letterSpacing: "0.01em" }}>{ADMIN_CREDENTIALS.email}</div>
            <div style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, marginTop: 2, letterSpacing: "0.04em", textTransform: "uppercase" }}>{t.accPrimary}</div>
          </div>
        </div>
        {list.map((a) => (
          <div key={a.email} style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 12, padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, letterSpacing: "0.01em" }}>{a.email}</div>
            <button onClick={() => remove(a.email)} className="sp-btn" title={t.accRemove} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
              <Icon name="x" size={16} color={C.tierra} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "18px 18px", marginTop: 22 }}>
        <div style={{ fontFamily: C.serif, fontSize: 19, color: C.negro, marginBottom: 4 }}>{es ? "Prueba de correo" : "Email test"}</div>
        <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, margin: "0 0 14px", letterSpacing: "0.02em", lineHeight: 1.55, maxWidth: 460 }}>
          {es ? "Envía un mensaje de prueba para verificar que el sistema de correos está funcionando." : "Send a test message to verify that outgoing email is working."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={testTo} onChange={(e) => { setTestTo(e.target.value); setTestMsg(null); }} placeholder={es ? "Correo de destino" : "Recipient email"} type="email" style={fieldStyle} />
          {testMsg && <span style={{ fontFamily: C.sans, fontSize: 11.5, color: testMsg.ok ? "#1F8A5B" : C.peach, letterSpacing: "0.02em", lineHeight: 1.5 }}>{testMsg.text}</span>}
          <button onClick={sendTest} disabled={testBusy} className="sp-btn" style={{ background: C.negro, color: C.alabaster, border: "none", borderRadius: 11, padding: "11px 18px",
            fontFamily: C.sans, fontSize: 11, letterSpacing: "0.06em", cursor: testBusy ? "default" : "pointer", opacity: testBusy ? 0.6 : 1, fontWeight: 500, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "flex-start" }}>
            <Icon name="review" size={14} color={C.alabaster} /> {testBusy ? (es ? "Enviando…" : "Sending…") : (es ? "Enviar correo de prueba" : "Send test email")}
          </button>
        </div>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "18px 18px", marginTop: 18 }}>
        <div style={{ fontFamily: C.serif, fontSize: 19, color: C.negro, marginBottom: 4 }}>{es ? "Prueba de WhatsApp" : "WhatsApp test"}</div>
        <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, margin: "0 0 14px", letterSpacing: "0.02em", lineHeight: 1.55, maxWidth: 460 }}>
          {es ? "Envía el formulario de ejemplo (PDF) por WhatsApp a los números configurados. Puedes escribir uno o dos números (con código de país, sin +) para probar; si lo dejas vacío usa los de la configuración." : "Sends the example form (PDF) via WhatsApp to the configured numbers. Enter one or two numbers (country code, no +) to test, or leave blank to use the configured ones."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={waTo} onChange={(e) => { setWaTo(e.target.value); setWaMsg(null); }} placeholder={es ? "Ej: 50255555555, 50244444444" : "e.g. 50255555555, 50244444444"} type="text" style={fieldStyle} />
          {waMsg && <span style={{ fontFamily: C.sans, fontSize: 11.5, color: waMsg.ok ? "#1F8A5B" : C.peach, letterSpacing: "0.02em", lineHeight: 1.5 }}>{waMsg.text}</span>}
          <button onClick={sendWaTest} disabled={waBusy} className="sp-btn" style={{ background: C.negro, color: C.alabaster, border: "none", borderRadius: 11, padding: "11px 18px",
            fontFamily: C.sans, fontSize: 11, letterSpacing: "0.06em", cursor: waBusy ? "default" : "pointer", opacity: waBusy ? 0.6 : 1, fontWeight: 500, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "flex-start" }}>
            <Icon name="review" size={14} color={C.alabaster} /> {waBusy ? (es ? "Enviando…" : "Sending…") : (es ? "Enviar WhatsApp de prueba" : "Send test WhatsApp")}
          </button>
        </div>
      </div>

      {/* REGISTRO DE ENVÍOS — diagnóstico de correos y WhatsApp */}
      <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "18px 18px", marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={{ fontFamily: C.serif, fontSize: 19, color: C.negro }}>{es ? "Registro de envíos" : "Send log"}</div>
          <button onClick={loadLog} disabled={logBusy} className="sp-btn" style={{ background: "transparent", color: C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 9, padding: "8px 14px",
            fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.04em", cursor: logBusy ? "default" : "pointer", opacity: logBusy ? 0.6 : 1, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="review" size={13} color={C.negro} /> {logBusy ? (es ? "Cargando…" : "Loading…") : (es ? "Actualizar" : "Refresh")}
          </button>
        </div>
        <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, margin: "0 0 14px", letterSpacing: "0.02em", lineHeight: 1.55, maxWidth: 520 }}>
          {es ? "Cada correo y WhatsApp enviado (automático o manual). Si algo falla, aquí verás el motivo." : "Every email and WhatsApp sent (automatic or manual). Failures show the reason here."}
        </p>
        {sendLog === null ? (
          <div style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, padding: "10px 0", letterSpacing: "0.02em" }}>{es ? "Conecta el backend para ver el registro." : "Connect the backend to view the log."}</div>
        ) : sendLog.length === 0 ? (
          <div style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, padding: "10px 0", letterSpacing: "0.02em" }}>{es ? "Aún no hay envíos registrados." : "No sends logged yet."}</div>
        ) : (
          <div style={{ border: `1px solid ${C.beige}`, borderRadius: 12, overflow: "hidden", maxHeight: 420, overflowY: "auto" }}>
            {sendLog.map((r, i) => {
              const ok = r.status === "OK";
              const chLabel = { "email": "Correo", "whatsapp": "WhatsApp", "email-huesped": "Correo huésped", "prueba-email": "Prueba correo", "prueba-whatsapp": "Prueba WhatsApp", "pdf": "PDF" }[r.channel] || r.channel;
              let when = r.at; try { when = new Date(r.at).toLocaleString(es ? "es-GT" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) {}
              return (
                <div key={i} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.beige}`, padding: "11px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0, marginTop: 3, width: 8, height: 8, borderRadius: "50%", background: ok ? "#1F8A5B" : C.peach }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, color: ok ? "#177A4F" : C.peach }}>{chLabel}</span>
                      <span style={{ fontFamily: C.sans, fontSize: 12, color: C.negro, letterSpacing: "0.01em" }}>{r.property || r.code || "—"}</span>
                      <span style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, letterSpacing: "0.02em" }}>{r.to || ""}</span>
                    </div>
                    {!ok && r.detail && <div style={{ fontFamily: C.sans, fontSize: 10.5, color: C.peach, letterSpacing: "0.01em", lineHeight: 1.5, marginTop: 3, wordBreak: "break-word" }}>{r.detail}</div>}
                    {ok && r.detail && <div style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, letterSpacing: "0.01em", marginTop: 2 }}>{r.detail}</div>}
                  </div>
                  <span style={{ flexShrink: 0, fontFamily: C.sans, fontSize: 10, color: C.tierra, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{when}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 16, padding: "18px 18px", marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontFamily: C.serif, fontSize: 19, color: C.negro, marginBottom: 4 }}>{es ? "Números internos para ElevenLabs" : "Internal numbers for ElevenLabs"}</div>
          <button onClick={loadContacts} className="sp-btn" title={es ? "Actualizar" : "Refresh"} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
            <Icon name="refresh" size={16} color={C.tierra} />
          </button>
        </div>
        <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, margin: "0 0 14px", letterSpacing: "0.02em", lineHeight: 1.55, maxWidth: 480 }}>
          {es ? "Lista actual de WhatsApp de recepción (de todas las propiedades, sin el administrador). Cópiala y pégala en la regla de números internos del prompt del agente de ElevenLabs cada vez que agregues o cambies un número." : "Current list of reception WhatsApp numbers (all properties, admin excluded). Copy and paste it into the internal-numbers rule of the ElevenLabs agent prompt whenever a number changes."}
        </p>
        {contactsBusy && !contacts ? (
          <div style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra }}>{es ? "Cargando…" : "Loading…"}</div>
        ) : contacts ? (<>
          <div style={{ background: C.beige, border: `1px solid ${C.grisCalido}`, borderRadius: 12, padding: "13px 15px", fontFamily: C.sans, fontSize: 13, color: C.negro, letterSpacing: "0.02em", lineHeight: 1.7, wordBreak: "break-word" }}>
            {(contacts.numbers || []).length ? (contacts.numbers || []).join(", ") : (es ? "Sin números configurados." : "No numbers configured.")}
          </div>
          <button onClick={copyNums} className="sp-btn" style={{ marginTop: 12, background: C.negro, color: C.alabaster, border: "none", borderRadius: 11, padding: "10px 16px",
            fontFamily: C.sans, fontSize: 11, letterSpacing: "0.06em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
            <Icon name="copy" size={14} color={C.alabaster} /> {copied ? (es ? "¡Copiado!" : "Copied!") : (es ? "Copiar lista" : "Copy list")}
          </button>
          {(contacts.properties || []).length > 0 && (<>
            <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, margin: "20px 0 10px" }}>{es ? "Contactos editados desde el panel" : "Contacts edited from the panel"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(contacts.properties || []).map((p, i) => (
                <div key={i} style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 12, padding: "12px 15px" }}>
                  <div style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, letterSpacing: "0.01em", marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, letterSpacing: "0.02em", lineHeight: 1.6 }}>
                    {[...(p.whatsapps || []).map((w) => "WA " + w), ...(p.emails || [])].join("  ·  ") || "—"}
                  </div>
                </div>
              ))}
            </div>
          </>)}
        </>) : (
          <div style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra }}>{es ? "Conéctate al backend para ver la lista." : "Connect the backend to see the list."}</div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AdminScreen, AdminLogin, HospitablePanel, ReservationSummary, WatermarkedDoc, StationsScreen, PropertyInfoScreen, SeguimientoScreen, AdminAccessScreen, loadPropInfo });
