/* ============================================================
   SPACIO AM — app shell: header (sa-topbar), avatar menu, tabs +
   bottom nav, connection farol, segmented, pill filters.
   Faithful port of mi-spacioam (dashboard.jsx TopBar / index.html CSS).
   Notifications come from the real noti-center.jsx (window.NotiBell etc).
   ============================================================ */
const { useState: uS, useEffect: uE, useRef: uR, useMemo: uM } = React;

/* ---------- SEGMENTED (pill segments) — copia de mi-spacioam ---------- */
function Segmented({ value, onChange, options, size }) {
  const sm = size === "sm";
  return (
    <div style={{ display: "inline-flex", gap: 3, background: "var(--beige-soft)", borderRadius: 999, padding: 3 }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} className="sp-btn"
            style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: sm ? "6px 12px" : "8px 15px",
              background: on ? "var(--ink)" : "transparent", color: on ? "var(--alabaster)" : "var(--fg-muted)",
              fontFamily: "var(--sans)", fontSize: sm ? 10.5 : 11.5, fontWeight: 600, letterSpacing: "0.06em",
              boxShadow: on ? "var(--shadow-xs)" : "none", transition: "all .16s var(--ease)", whiteSpace: "nowrap" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- CONNECTION FAROL — punto con halo, igual al de EPI ----------
   Solo el punto de estado con un aro tenue del mismo color detrás (sin etiqueta,
   sin ícono de wifi). Verde = conectado, azul = sincronizando, rojo = sin conexión. */
function ConnectionFarol({ connected, syncing, t, onClick }) {
  const es = !(t && t.code === "en");
  const dot = connected ? "#3d6b52" : "#C0392B";
  const halo = connected ? "rgba(61,107,82,.18)" : "rgba(192,57,43,.18)";
  const label = connected ? (es ? "Conectado" : "Connected") : (es ? "Sin conexión" : "Offline");
  return (
    <button onClick={onClick} title={label} aria-label={label}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%",
        border: "none", background: halo, cursor: onClick ? "pointer" : "default", flexShrink: 0, padding: 0 }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot }} />
    </button>
  );
}

function initialsOf(name) {
  return (name || "").trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "·";
}

/* ---------- APP HEADER — copia del sa-topbar de mi-spacioam ----------
   Estructura: logo · (divisor + notibell si hay pendientes) · [farol] · avatar
   con menú. El filtro del header original se omite a propósito. */
function AppHeader({ t, lang, onSwitchLang, user, isAdmin, guest, connected, syncing, notiTotal, onNotiOpen,
  onAccount, onSetup, onLogout, onBrand, onFarol, setupLabel }) {
  const es = t.code === "es";
  const [menu, setMenu] = uS(false);
  const mref = uR(null);
  uE(() => {
    const h = (e) => { if (mref.current && !mref.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const u = user || {};
  const NBell = window.NotiBell;
  return (
    <header className="sa-topbar">
      <div className="sa-topbar-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBrand} className="sp-link" aria-label="Spacio AM"
            style={{ background: "none", border: "none", padding: 0, cursor: onBrand ? "pointer" : "default", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <LogoMain height={34} />
          </button>
          <span aria-hidden="true" style={{ width: 1, height: 26, background: "var(--divider)", display: "inline-block", flexShrink: 0 }} />
          {/* la campana SIEMPRE está presente; con pendientes usa el bell real (con badge) */}
          {NBell && notiTotal > 0 ? <NBell total={notiTotal} onOpen={onNotiOpen} /> : (
            <button onClick={onNotiOpen} aria-label="Notificaciones" title={es ? "Notificaciones" : "Notifications"}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 999, border: "none", background: "transparent", cursor: "pointer", flexShrink: 0, padding: 0, color: "var(--fg-muted)" }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z" /><path d="M10.5 20a1.8 1.8 0 0 0 3 0" />
              </svg>
            </button>
          )}
        </div>

        <div className="sa-topbar-right">
          {isAdmin && <ConnectionFarol connected={connected} syncing={syncing} t={t} onClick={onFarol} />}
          {guest ? (
            <React.Fragment>
              <Segmented size="sm" value={lang} onChange={(v) => { if (v !== lang) onSwitchLang(); }} options={[{ value: "es", label: "ES" }, { value: "en", label: "EN" }]} />
              <button onClick={onLogout} className="sa-avatar" title={es ? "Salir" : "Log out"} aria-label={es ? "Salir" : "Log out"} style={{ background: "var(--beige-soft)" }}>
                <Icon name="logout" size={17} color="var(--fg-muted)" />
              </button>
            </React.Fragment>
          ) : (
            <div ref={mref} style={{ position: "relative" }}>
              <button onClick={() => setMenu((m) => !m)} className="sa-avatar" aria-label="account" style={u.avatar ? { padding: 0, overflow: "hidden" } : undefined}>
                {u.avatar ? <img src={u.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : initialsOf(u.name || u.email)}
              </button>
              {menu && (
                <div className="sa-menu" style={{ animation: "sa-fade .18s var(--ease)" }}>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--warm-grey)" }}>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)", lineHeight: 1.1 }}>{u.name || (es ? "Tu cuenta" : "Your account")}</div>
                    {u.email && <div style={{ fontFamily: "var(--sans)", fontSize: 11, letterSpacing: "0.06em", color: "var(--fg-muted)", marginTop: 3 }}>{u.email}</div>}
                  </div>
                  {onAccount && (
                    <button onClick={() => { setMenu(false); onAccount(); }} className="sa-menu-item">
                      <Icon name="user" size={16} color="var(--fg-muted)" /> {es ? "Mi cuenta" : "My account"}
                    </button>
                  )}
                  {isAdmin && onSetup && (
                    <button onClick={() => { setMenu(false); onSetup(); }} className="sa-menu-item">
                      <Icon name="settings" size={16} color="var(--fg-muted)" /> {setupLabel || (es ? "Configuración" : "Setup")}
                    </button>
                  )}
                  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--warm-grey)", borderBottom: "1px solid var(--warm-grey)" }}>
                    <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--fg-muted)" }}>{es ? "Idioma" : "Language"}</span>
                    <Segmented size="sm" value={lang} onChange={(v) => { if (v !== lang) onSwitchLang(); }} options={[{ value: "es", label: "ES" }, { value: "en", label: "EN" }]} />
                  </div>
                  <button onClick={() => { setMenu(false); onLogout(); }} className="sa-menu-item">
                    <Icon name="logout" size={16} color="var(--fg-muted)" /> {es ? "Cerrar sesión" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------- TABS + BOTTOM NAV — copia de mi-spacioam ----------
   Escritorio: barra de pestañas con subrayado peach. Móvil: barra inferior
   flotante con 3 principales + “+” para el resto. */
function NavTabs({ tabs, active, onSelect, t }) {
  const [more, setMore] = uS(false);
  const es = t.code === "es";
  const primary = tabs.slice(0, 3);
  const overflow = tabs.slice(3);
  const overflowActive = overflow.some((tb) => tb.id === active);
  const go = (id) => { setMore(false); onSelect(id); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {} };
  return (
    <React.Fragment>
      <div className="sa-tabs-bar">
        <div className="sa-tabs-inner">
          {tabs.map((tb) => (
            <button key={tb.id} className={"sa-tab" + (active === tb.id ? " active" : "")} onClick={() => go(tb.id)}>
              {tb.icon && <Icon name={tb.icon} size={15} color="currentColor" />}{tb.label}
            </button>
          ))}
        </div>
      </div>
      <nav className="sa-bottomnav">
        <div className="sa-bottomnav-inner">
          {primary.map((tb) => (
            <button key={tb.id} className={"sa-navbtn" + (active === tb.id ? " active" : "")} onClick={() => go(tb.id)}>
              {tb.icon && <Icon name={tb.icon} size={19} color="currentColor" />}
              <span className="sa-navdot" />
              {tb.label}
            </button>
          ))}
          {overflow.length > 0 && (
            <div className="sa-navmore">
              {more && <div className="sa-navmore-backdrop" onClick={() => setMore(false)} />}
              <button className={"sa-navbtn" + (overflowActive ? " active" : "")} onClick={() => setMore((m) => !m)} style={{ width: "100%" }}>
                <Icon name={more ? "chevronDown" : "grid"} size={19} color="currentColor" />
                <span className="sa-navdot" />
                {es ? "Más" : "More"}
              </button>
              {more && (
                <div className="sa-navmore-sheet">
                  {overflow.map((tb) => (
                    <button key={tb.id} className={"sa-navmore-item" + (active === tb.id ? " active" : "")} onClick={() => go(tb.id)}>
                      {tb.icon && <Icon name={tb.icon} size={16} color="currentColor" />} {tb.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </React.Fragment>
  );
}

/* ---------- PILL SELECT (filtro píldora buscable, multi, alfabético) ----------
   Portado del Select de mi-spacioam. */
function PillSelect({ value, options, onChange, icon, minWidth, multi, searchable, placeholder, align }) {
  const [open, setOpen] = uS(false);
  const [q, setQ] = uS("");
  const ref = uR(null);
  uE(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const sel = multi ? (Array.isArray(value) ? value : []) : value;
  const isActive = (v) => multi ? (v === "all" ? sel.length === 0 : sel.indexOf(v) >= 0) : v === value;
  const sentinel = options.filter((o) => o.value === "all");
  const rest = options.filter((o) => o.value !== "all").slice()
    .sort((a, b) => String(a.label).localeCompare(String(b.label), "es", { numeric: true, sensitivity: "base" }));
  const ordered = sentinel.concat(rest);
  const showSearch = searchable != null ? searchable : options.length > 6;
  const shown = q ? ordered.filter((o) => (String(o.label) + " " + (o.sub || "")).toLowerCase().includes(q.toLowerCase())) : ordered;
  let triggerLabel;
  if (multi) {
    triggerLabel = sel.length === 0 ? (sentinel[0] ? sentinel[0].label : (placeholder || "")) :
      sel.length === 1 ? ((options.find((o) => o.value === sel[0]) || {}).label || "") :
        (sel.length + " " + (placeholder || "seleccionadas"));
  } else { const cur = options.find((o) => o.value === value); triggerLabel = cur ? cur.label : (placeholder || ""); }
  const pick = (v) => {
    if (!multi) { onChange(v); setOpen(false); setQ(""); return; }
    if (v === "all") { onChange([]); return; }
    onChange(sel.indexOf(v) >= 0 ? sel.filter((x) => x !== v) : sel.concat(v));
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} className="sp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 9, cursor: "pointer",
        background: "var(--alabaster)", border: "1px solid var(--ink-08)", borderRadius: 999, padding: "10px 13px 10px 15px",
        fontFamily: "var(--sans)", fontSize: 12, letterSpacing: "0.04em", color: "var(--ink)", boxShadow: "var(--shadow-xs)" }}>
        {icon && <Icon name={icon} size={14} color="var(--fg-muted)" />}
        <span style={{ fontWeight: 500 }}>{triggerLabel}</span>
        {multi && sel.length > 0 && <span style={{ minWidth: 16, height: 16, padding: "0 5px", borderRadius: 999, background: "var(--peach)", color: "#fff", fontSize: 9.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{sel.length}</span>}
        <Icon name="chevronDown" size={13} color="var(--fg-muted)" />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", [align || "left"]: 0, zIndex: 90, minWidth: minWidth || 210,
          background: "var(--alabaster)", border: "1px solid var(--ink-08)", borderRadius: 16, boxShadow: "var(--shadow-md)",
          padding: 6, animation: "sa-fade .18s var(--ease)", maxHeight: 340, display: "flex", flexDirection: "column" }}>
          {showSearch && (
            <div style={{ padding: "4px 4px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--beige-soft)", border: "1px solid var(--warm-grey)", borderRadius: 10, padding: "9px 11px" }}>
                <Icon name="search" size={14} color="var(--fg-muted)" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder || "Buscar…"}
                  style={{ border: "none", outline: "none", background: "transparent", width: "100%", fontFamily: "var(--sans)", fontSize: 12.5, letterSpacing: "0.02em", color: "var(--ink)" }} />
                {q && <button onClick={() => setQ("")} style={{ border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", color: "var(--fg-muted)" }}><Icon name="x" size={13} color="var(--fg-muted)" /></button>}
              </div>
            </div>
          )}
          <div style={{ overflowY: "auto", minHeight: 0 }}>
            {shown.map((o) => {
              const active = isActive(o.value);
              return (
                <button key={o.value} onClick={() => pick(o.value)} className="sa-menu-item" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                  border: "none", cursor: "pointer", background: active ? "var(--beige-soft)" : "transparent", borderRadius: 11, padding: "11px 12px",
                  fontFamily: "var(--sans)", fontSize: 12.5, letterSpacing: "0.03em", color: "var(--ink)" }}>
                  {multi && o.value !== "all" && (
                    <span style={{ flexShrink: 0, width: 17, height: 17, borderRadius: 5, border: "1.5px solid " + (active ? "var(--peach)" : "var(--warm-grey)"), background: active ? "var(--peach)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {active && <Icon name="check" size={12} color="#fff" />}
                    </span>
                  )}
                  {o.sub ? (
                    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontWeight: 500 }}>{o.label}</span>
                      <span style={{ fontSize: 10.5, color: "var(--fg-muted)", letterSpacing: "0.05em" }}>{o.sub}</span>
                    </span>
                  ) : <span style={{ fontWeight: active ? 500 : 400 }}>{o.label}</span>}
                  {active && !multi && <span style={{ marginLeft: "auto", display: "inline-flex" }}><Icon name="check" size={15} color="var(--peach)" /></span>}
                </button>
              );
            })}
            {shown.length === 0 && <div style={{ padding: "16px 12px", textAlign: "center", fontFamily: "var(--sans)", fontSize: 12, color: "var(--fg-muted)" }}>Sin resultados</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- GUEST NOTIFICATIONS (device store → items) ----------
   Formato compatible con noti-center.jsx: { id, texto, contexto, ts, tipo, subcat, peso, abrir }. */
function buildGuestNotis(res, es) {
  if (!res) return [];
  const store = loadStore();
  const code = normCode(res.code);
  const out = [];
  const REQ_LABEL = { early: "Early check-in", late: es ? "Salida tardía" : "Late check-out", luggage: es ? "Dejar maletas" : "Luggage drop-off", extra: es ? "Noche adicional" : "Extra night", night: es ? "Noche adicional" : "Extra night" };
  const DECISION = { aprobado: es ? "Aprobada" : "Approved", approved: es ? "Aprobada" : "Approved", rechazado: es ? "No disponible" : "Not available", rejected: es ? "No disponible" : "Not available", confirmado: es ? "Confirmada" : "Confirmed" };
  (store.hostRequests || []).forEach((r, i) => {
    if (r.code && normCode(r.code) !== code) return;
    const dec = r.decision || r.status;
    if (!dec || dec === "pendiente" || dec === "pending") return;
    out.push({ id: "req|" + (r.at || i) + "|" + (r.type || ""), tipo: "accion", subcat: es ? "Tu solicitud" : "Your request",
      texto: (REQ_LABEL[r.type] || (es ? "Tu solicitud" : "Your request")) + " · " + (DECISION[dec] || dec) + ".", contexto: r.note || "", ts: r.decidedAt || r.at || Date.now(), peso: 5000 });
  });
  (store.guestAccess || []).forEach((g, i) => {
    if (g.code && normCode(g.code) !== code) return;
    const dec = g.decision; if (!dec || dec === "eliminado") return;
    const n = (g.guests || []).length;
    out.push({ id: "gacc|" + (g.at || i), tipo: "accion", subcat: es ? "Invitados" : "Guests",
      texto: (DECISION[dec] || dec) + " · " + n + " " + (es ? (n === 1 ? "invitado" : "invitados") : "guest(s)") + ".", contexto: "", ts: g.decidedAt || g.at || Date.now(), peso: 6000 });
  });
  (store.guestMessages || []).forEach((m, i) => {
    if (m.code && normCode(m.code) !== code) return;
    out.push({ id: "msg|" + (m.ts || i), tipo: "alerta", subcat: "Spacio AM", texto: m.text || "", contexto: "", ts: m.ts || Date.now(), peso: 9000 });
  });
  return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

Object.assign(window, { Segmented, ConnectionFarol, AppHeader, NavTabs, PillSelect, buildGuestNotis, initialsOf });
