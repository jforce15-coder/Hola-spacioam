/* ============================================================
   SPACIO AM — Mi espacio (Bento home) + Tile detail + Account modal
   ============================================================ */
const { useState: useStateB, useEffect: useEffectB, useRef: useRefB } = React;

/* tile config */
const BENTO = [
  { key: "checkin",    span: "hero", kind: "photo", img: "PROP" },
  { key: "wifi",       span: "sq",   kind: "dark" },
  { key: "parqueo",    span: "sq",   kind: "light" },
  { key: "manual",     span: "sq",   kind: "light" },
  { key: "amenities",  span: "wide", kind: "photo", img: IMG.rooftop },
  { key: "upsells",    span: "tall", kind: "photo", img: IMG.welcome, accent: true },
  { key: "chat",       span: "sq",   kind: "peach" },
  { key: "visits",     span: "sq",   kind: "light" },
  { key: "factura",    span: "sq",   kind: "light" },
  { key: "emergency",  span: "sq",   kind: "light" },
  { key: "activities", span: "sq",   kind: "light" },
  { key: "selflove",   span: "wide", kind: "photo", img: IMG.selfcare },
  { key: "review",     span: "wide", kind: "light" },
];

const spanStyle = {
  hero: { gridColumn: "span 2", gridRow: "span 2" },
  wide: { gridColumn: "span 2" },
  tall: { gridRow: "span 2" },
  sq: {},
};

/* ---------- STAY SWITCHER (one user, several bookings) ---------- */
function StaySwitcher({ t, res, siblings, onSwitch }) {
  const [open, setOpen] = useStateB(false);
  const ref = useRefB(null);
  useEffectB(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 18 }}>
      <button onClick={() => setOpen((o) => !o)} className="sp-btn"
        style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.white, border: `1px solid ${C.grisCalido}`,
          borderRadius: 999, padding: "9px 9px 9px 16px", cursor: "pointer", boxShadow: "0 4px 16px rgba(62,63,63,.05)" }}>
        <span style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: C.tierra, fontWeight: 500 }}>{t.yourStays}</span>
        <span style={{ fontFamily: C.serif, fontSize: 16, color: C.negro, lineHeight: 1 }}>{resName(res)}</span>
        <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.beige, display: "grid", placeItems: "center" }}>
          <Icon name="chevron" size={15} color={C.negro} style={{}} />
        </span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 30, background: C.white, borderRadius: 16,
          border: `1px solid ${C.grisCalido}`, boxShadow: "0 20px 60px rgba(62,63,63,.14)", padding: 8, minWidth: 280, animation: "rise .3s " + C.ease + " both" }}>
          {siblings.map((r) => {
            const active = r.id === res.id;
            return (
              <button key={r.id} onClick={() => { onSwitch(r); setOpen(false); }} className="sp-row"
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer",
                  background: active ? C.beige : "transparent", border: "none", borderRadius: 12, padding: "10px 12px" }}>
                <span className="sp-imgwrap" style={{ width: 46, height: 46, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                  <img src={resPhoto(r)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontFamily: C.serif, fontSize: 17, color: C.negro, lineHeight: 1.1 }}>{resName(r)}</span>
                  <span style={{ display: "block", fontFamily: C.sans, fontSize: 10.5, color: C.tierra, marginTop: 2, letterSpacing: "0.02em" }}>{r.checkin} → {r.checkout}</span>
                </span>
                {active && <Icon name="check" size={16} color={C.peach} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BentoScreen({ t, res, siblings, onSwitch, firstName, emails, onSwitchLang, onLogout }) {
  const nights = nightsBetween(res.checkin, res.checkout);
  const hasSwitcher = siblings && siblings.length > 1;
  return (
    <div style={{ minHeight: "100vh", background: C.alabaster, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -50, left: "50%", transform: "translateX(-50%)", width: "min(900px,150%)", height: 300, opacity: 0.4, pointerEvents: "none" }}>
        <FlowLine variant={2} width={62} />
      </div>
      <div className="bento-wrap" style={{ padding: "clamp(26px,5vh,46px) clamp(18px,5vw,28px) 68px", position: "relative", zIndex: 2 }}>
        {/* header */}
        <div className="reveal" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "clamp(20px,3vh,30px)" }}>
          <div style={{ minWidth: 0 }}>
            {hasSwitcher
              ? <StaySwitcher t={t} res={res} siblings={siblings} onSwitch={onSwitch} />
              : <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.24em", textTransform: "uppercase", color: C.tierra, marginBottom: 8, fontWeight: 500 }}>{t.yourStay} · {resName(res)}</div>}
            <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: "clamp(34px,5vw,46px)", color: C.negro, margin: 0, lineHeight: 1.04, letterSpacing: "-0.01em" }}>
              {t.hello}{firstName ? `, ${titleCaseName(firstName)}` : ""}.
            </h1>
            <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, margin: "10px 0 0", letterSpacing: "0.02em", lineHeight: 1.55, maxWidth: 340 }}>{t.bentoSub}</p>
          </div>
          <div style={{ flexShrink: 0, paddingTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onSwitchLang} className="sp-langbtn">{t.code === "es" ? "EN" : "ES"}</button>
            <button onClick={onLogout} className="sp-btn" title={t.logout} aria-label={t.logout}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.white, border: `1px solid ${C.grisCalido}`,
                borderRadius: 999, padding: "8px 14px", cursor: "pointer", fontFamily: C.sans, fontSize: 10, letterSpacing: "0.12em",
                textTransform: "uppercase", color: C.tierra, fontWeight: 500 }}>
              <Icon name="logout" size={14} color={C.tierra} /> {t.logout}
            </button>
          </div>
        </div>

        {/* grid */}
        <div className="bento">
          {BENTO.map((tile, idx) => (
            <BentoTile key={tile.key} tile={tile} t={t} res={res} nights={nights} idx={idx} onOpen={(k) => (window.location.hash = k)} />
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 44, opacity: 0.9 }}>
          <div style={{ display: "flex", justifyContent: "center" }}><LogoMain width={120} /></div>
          <p style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.06em", color: C.tierra, marginTop: 14 }}>hola@spacioam.com</p>
        </div>
      </div>
    </div>
  );
}

function BentoTile({ tile, t, res, nights, idx, onOpen }) {
  const info = t.tiles[tile.key];
  const img = tile.img === "PROP" ? resPhoto(res) : tile.img;
  const isPhoto = tile.kind === "photo", isDark = tile.kind === "dark", isPeach = tile.kind === "peach";
  const fg = isPhoto || isDark ? C.alabaster : (isPeach ? C.white : C.negro);
  const subFg = isPhoto || isDark ? "rgba(250,250,250,.8)" : (isPeach ? "rgba(255,255,255,.82)" : C.tierra);
  const bg = isDark ? C.negro : isPeach ? C.peach : C.white;
  const big = tile.span === "hero";
  return (
    <button className={`tile sp-tile reveal ${isPhoto ? "sp-imgwrap" : ""}`} onClick={() => onOpen(tile.key)}
      style={{ ...spanStyle[tile.span], animationDelay: `${idx * 0.04}s`, background: bg,
        border: `1px solid ${isPhoto || isDark || isPeach ? "transparent" : C.grisCalido}`,
        borderRadius: 18, padding: big ? 20 : 15, position: "relative", overflow: "hidden", cursor: "pointer",
        display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "left",
        boxShadow: "0 4px 16px rgba(62,63,63,.05)", minHeight: 0 }}>
      {isPhoto && (
        <>
          <img src={img} alt="" className="sp-img" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(62,63,63,.66), rgba(62,63,63,.05) 62%)", zIndex: 1 }} />
        </>
      )}
      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center",
          background: isPhoto || isDark ? "rgba(255,255,255,.16)" : isPeach ? "rgba(255,255,255,.22)" : C.beige,
          backdropFilter: isPhoto ? "blur(6px)" : "none" }}>
          <Icon name={tile.key} size={19} color={fg} />
        </span>
        {tile.accent && <Sparkle size={14} color={C.peach} />}
      </div>
      <div style={{ position: "relative", zIndex: 2, marginTop: big ? 0 : 10 }}>
        <div style={{ fontFamily: C.serif, fontSize: big ? 26 : 17.5, color: fg, lineHeight: 1.05, letterSpacing: "-0.01em" }}>{info.t}</div>
        <div style={{ fontFamily: C.sans, fontSize: 10.5, color: subFg, lineHeight: 1.35, marginTop: 4, letterSpacing: "0.01em" }}>{info.d}</div>
        {tile.key === "checkin" && (
          <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
            <HeroStat label={t.checkin} value={res.checkin} />
            <HeroStat label={t.checkout} value={res.checkout} />
            <HeroStat label={t.nights} value={`${nights}`} />
          </div>
        )}
      </div>
    </button>
  );
}

function HeroStat({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: C.sans, fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(250,250,250,.7)", marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: C.serif, fontSize: 18, color: C.beigeDeep }}>{value}</div>
    </div>
  );
}

/* ============================================================
   ACCOUNT MODAL — offered a moment after landing in Mi espacio.
   create user → choose email → password → share → invitations
   ============================================================ */
function AccountModal({ t, emails, maxShare, onClose, onCreated }) {
  const [step, setStep] = useStateB("ask"); // ask · email · password · shareAsk · shareEmails · done
  const candidates = (emails || []).filter(Boolean);
  const [chosen, setChosen] = useStateB(candidates[0] || "");
  const [customEmail, setCustomEmail] = useStateB(candidates.length ? "" : "");
  const [pass, setPass] = useStateB("");
  const [shareList, setShareList] = useStateB(Array.from({ length: Math.max(1, (maxShare || 2) - 1) }, () => ""));
  const [err, setErr] = useStateB("");

  const wrap = (children) => (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center",
      background: "rgba(62,63,63,.42)", backdropFilter: "blur(4px)", padding: "0", animation: "rise .3s " + C.ease + " both" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "100%", maxWidth: 460, background: C.alabaster, borderRadius: "26px 26px 0 0", padding: "26px clamp(20px,5vw,30px) 34px",
        boxShadow: "0 -20px 60px rgba(62,63,63,.16)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: C.grisCalido, margin: "0 auto 20px" }} />
        {children}
      </div>
    </div>
  );

  const header = (icon, title, sub) => (
    <div style={{ textAlign: "center", marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <span style={{ width: 52, height: 52, borderRadius: 16, background: C.white, border: `1px solid ${C.grisCalido}`, display: "grid", placeItems: "center", boxShadow: "0 4px 16px rgba(62,63,63,.05)" }}>
          <Icon name={icon} size={24} color={C.peach} />
        </span>
      </div>
      <h2 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 27, color: C.negro, margin: 0, lineHeight: 1.1, letterSpacing: "-0.01em", textWrap: "balance" }}>{title}</h2>
      {sub && <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, margin: "10px auto 0", maxWidth: 340, lineHeight: 1.6, letterSpacing: "0.01em", textWrap: "pretty" }}>{sub}</p>}
    </div>
  );

  if (step === "ask") return wrap(<>
    {header("user", t.acctTitle, t.acctSub)}
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <Btn full variant="peach" onClick={() => setStep(candidates.length > 1 ? "email" : "password")}>{t.acctYes}</Btn>
      <button onClick={onClose} className="sp-link" style={{ background: "transparent", border: "none", cursor: "pointer",
        fontFamily: C.sans, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.tierra, padding: "10px", fontWeight: 500 }}>{t.acctNo}</button>
    </div>
  </>);

  if (step === "email") return wrap(<>
    {header("mail", t.acctChooseEmail, t.acctChooseEmailSub)}
    <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 20 }}>
      {candidates.map((em) => (
        <button key={em} onClick={() => setChosen(em)} className="sp-row"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", textAlign: "left", cursor: "pointer",
            background: chosen === em ? C.beige : C.white, border: `1.5px solid ${chosen === em ? C.negro : C.grisCalido}`, borderRadius: 14, padding: "15px 18px" }}>
          <span style={{ fontFamily: C.sans, fontSize: 14, color: C.negro, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis" }}>{em}</span>
          {chosen === em && <Icon name="check" size={17} color={C.peach} />}
        </button>
      ))}
    </div>
    <Btn full onClick={() => setStep("password")} disabled={!chosen}>{t.next}</Btn>
  </>);

  if (step === "password") return wrap(<>
    {header("key", t.acctPassword, chosen || candidates[0] ? `${t.acctChooseEmail}: ${chosen || candidates[0]}` : "")}
    <Field label={t.acctPassword} type="password" value={pass} placeholder={t.acctPasswordPh} onChange={setPass} />
    {err && <p style={{ color: C.peach, fontFamily: C.sans, fontSize: 12, margin: "12px 0 0", letterSpacing: "0.02em" }}>{err}</p>}
    <div style={{ marginTop: 20 }}>
      <Btn full variant="peach" onClick={() => {
        if ((pass || "").length < 6) { setErr(t.acctPasswordPh); return; }
        if (maxShare > 1) { setStep("shareAsk"); }
        else { onCreated({ email: chosen || candidates[0], pass, sharedEmails: [] }); setStep("done"); }
      }}>{t.acctCreate}</Btn>
    </div>
  </>);

  if (step === "shareAsk") return wrap(<>
    {header("user", t.shareTitle, t.shareSub)}
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <Btn full variant="peach" onClick={() => setStep("shareEmails")}>{t.shareYes}</Btn>
      <button onClick={() => { onCreated({ email: chosen || candidates[0], pass, sharedEmails: [] }); setStep("done"); }} className="sp-link" style={{ background: "transparent", border: "none", cursor: "pointer",
        fontFamily: C.sans, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.tierra, padding: "10px", fontWeight: 500 }}>{t.shareNo}</button>
    </div>
  </>);

  if (step === "shareEmails") return wrap(<>
    {header("mail", t.shareEmailsTitle, t.shareEmailsSub.replace("{n}", maxShare))}
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
      {shareList.map((v, i) => (
        <Field key={i} label={`${t.email} ${i + 1}`} type="email" value={v}
          onChange={(val) => { const n = [...shareList]; n[i] = val; setShareList(n); }} />
      ))}
    </div>
    <Btn full variant="peach" onClick={() => { onCreated({ email: chosen || candidates[0], pass, sharedEmails: shareList.map((e) => (e || "").trim()).filter(Boolean) }); setStep("done"); }}
      disabled={!shareList.some((e) => (e || "").trim())}>{t.shareSend}</Btn>
  </>);

  // done
  return wrap(<>
    {header("check", shareList.some((e) => (e || "").trim()) ? t.shareSent : t.acctCreated,
      shareList.some((e) => (e || "").trim()) ? t.shareSentDesc : null)}
    <Btn full onClick={onClose}>{t.finishAcct}</Btn>
  </>);
}

/* ============================================================
   TILE DETAIL
   ============================================================ */
const DETAIL_HERO = { checkin: "PROP", amenities: IMG.rooftop, upsells: IMG.welcome, selflove: IMG.selfcare, manual: IMG.kitchen, activities: IMG.rooftop, parqueo: null, factura: null, visits: null };

function TileDetail({ t, tileKey, res, onBack }) {
  const tile = t.tiles[tileKey];
  const heroImg = DETAIL_HERO[tileKey] === "PROP" ? resPhoto(res) : DETAIL_HERO[tileKey];
  return (
    <div style={{ minHeight: "100vh", background: C.alabaster, position: "relative", overflow: "hidden" }}>
      <div style={{ maxWidth: "min(720px, 100%)", margin: "0 auto", padding: "0 0 72px", position: "relative", zIndex: 2 }}>
        <div style={{ padding: "20px clamp(16px,5vw,22px) 14px" }}>
          <button onClick={onBack} className="sp-link" style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 7, fontFamily: C.sans, fontSize: 11, letterSpacing: "0.1em",
            textTransform: "uppercase", color: C.tierra, fontWeight: 500 }}>
            <Icon name="arrowLeft" size={15} color={C.tierra} /> {t.yourStay}
          </button>
        </div>
        <div style={{ padding: "0 clamp(16px,5vw,22px)" }}>
          {heroImg ? (
            <WeaveHero img={heroImg} variant={2} height="clamp(220px,30vh,300px)" radius="24px" width={88}
              frontMask="radial-gradient(120% 92% at 80% 84%, #000 0 38%, transparent 60%)"
              overlay={<>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(62,63,63,.6), transparent 56%)" }} />
                <div style={{ position: "absolute", left: 22, bottom: 20, zIndex: 5, display: "flex", alignItems: "center", gap: 13 }}>
                  <span style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,.18)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center" }}>
                    <Icon name={tileKey} size={23} color={C.white} />
                  </span>
                  <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: "clamp(26px,4vw,32px)", color: C.white, margin: 0, lineHeight: 1, letterSpacing: "-0.01em" }}>{tile.t}</h1>
                </div>
              </>} />
          ) : (
            <div style={{ position: "relative", height: 158, borderRadius: 24, overflow: "hidden", background: C.beige }}>
              <Brush3D variant={2} width={64} opacity={0.7} />
              <div style={{ position: "absolute", left: 22, bottom: 20, zIndex: 2, display: "flex", alignItems: "center", gap: 13 }}>
                <span style={{ width: 46, height: 46, borderRadius: 13, background: C.white, display: "grid", placeItems: "center", boxShadow: "0 4px 12px rgba(62,63,63,.08)" }}>
                  <Icon name={tileKey} size={23} color={C.negro} />
                </span>
                <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: "clamp(26px,4vw,32px)", color: C.negro, margin: 0, lineHeight: 1, letterSpacing: "-0.01em" }}>{tile.t}</h1>
              </div>
            </div>
          )}
        </div>

        <div className="reveal" style={{ padding: "24px clamp(16px,5vw,22px) 0" }}>
          <p style={{ fontFamily: C.sans, fontSize: 13, color: C.tierra, lineHeight: 1.65, margin: "0 0 20px", letterSpacing: "0.02em" }}>{tile.d}.</p>
          <div style={{ background: C.white, border: `1px solid ${C.grisCalido}`, borderRadius: 18, padding: "8px 22px 22px" }}>
            {renderTileContent(tileKey, t, res)}
          </div>
          <p style={{ fontFamily: C.sans, fontSize: 10, color: C.tierra, textAlign: "center", margin: "18px 0 0", letterSpacing: "0.04em" }}>
            guest.spacioam.com/#{tileKey}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${C.beige}` }}>
      <span style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.tierra, fontWeight: 500 }}>{label}</span>
      <span style={{ fontFamily: C.serif, fontSize: 19, color: C.negro }}>{value}</span>
    </div>
  );
}
function ActionBtn({ children, onClick, accent }) {
  return <Btn variant={accent ? "peach" : "solid"} full onClick={onClick} style={{ marginTop: 18 }}>{children}</Btn>;
}
function Chips({ items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 9, paddingTop: 14 }}>
      {items.map((a) => (
        <span key={a} style={{ fontFamily: C.sans, fontSize: 12, color: C.negro, background: C.beige, borderRadius: 999, padding: "9px 15px", letterSpacing: "0.02em" }}>{a}</span>
      ))}
    </div>
  );
}

/* small labeled field for the bento forms */
function MiniField({ label, value, onChange, placeholder, type, textarea }) {
  const base = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.grisCalido}`,
    background: C.alabaster, fontFamily: C.sans, fontSize: 13.5, color: C.negro, outline: "none", letterSpacing: "0.01em" };
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, marginBottom: 7, fontWeight: 500 }}>{label}</span>
      {textarea
        ? <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...base, resize: "vertical" }} />
        : <input type={type || "text"} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={base} />}
    </label>
  );
}

/* ---------- WIFI: network + quick-connect + troubleshoot ---------- */
function WifiContent({ t, res }) {
  const es = t.code === "es";
  const w = (typeof wifiForRes === "function" ? wifiForRes(res) : null) || res.wifi || { network: "Spacio AM", pass: "selfloveclub" };
  const b = typeof matchBuilding === "function" ? matchBuilding(res) : null;
  const piW = (typeof loadPropInfo === "function" ? loadPropInfo() : {})[res.propertyName] || {};
  const piBackups = [];
  if (piW.wifiNetBk || piW.wifiPassBk) piBackups.push({ network: piW.wifiNetBk || "", pass: piW.wifiPassBk || "" });
  if (piW.wifiNetBk2 || piW.wifiPassBk2) piBackups.push({ network: piW.wifiNetBk2 || "", pass: piW.wifiPassBk2 || "" });
  const backups = piBackups.length ? piBackups : ((b && b.wifiBackup) || []);
  const [copied, setCopied] = useStateB(false);
  const [connecting, setConnecting] = useStateB(false);
  const [trouble, setTrouble] = useStateB(false);

  const quickConnect = () => {
    navigator.clipboard?.writeText(w.pass);
    setConnecting(true);
    // WIFI: URI scheme — on supported devices this can hand off to the OS
    try {
      const uri = `WIFI:T:WPA;S:${w.network};P:${w.pass};;`;
      const a = document.createElement("a"); a.href = uri; a.click();
    } catch (e) {}
    setTimeout(() => setConnecting(false), 1600);
  };

  return (
    <>
      {w.byLevel && <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, lineHeight: 1.55, margin: "12px 0 0", letterSpacing: "0.02em" }}>{t.wifiByLevelNote} <b style={{ color: C.negro }}>({es ? "Nivel" : "Level"} {w.byLevel})</b></p>}
      <InfoRow label={es ? "Red / Network" : "Network"} value={w.network} />
      <InfoRow label="Password" value={w.pass} />
      <ActionBtn accent onClick={quickConnect}>
        <Icon name="wifi" size={16} color={C.white} /> {connecting ? t.wifiConnected : t.wifiQuick}
      </ActionBtn>
      <div style={{ height: 10 }} />
      <Btn variant="outline" full onClick={() => { navigator.clipboard?.writeText(w.pass); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
        <Icon name="copy" size={15} color={C.negro} /> {copied ? t.copied : t.copy}
      </Btn>

      {w.alt && (
        <p style={{ fontFamily: C.sans, fontSize: 11, color: C.tierra, lineHeight: 1.55, margin: "16px 0 0", letterSpacing: "0.02em" }}>
          {es ? "Red alternativa" : "Alternate network"}: <b style={{ color: C.negro }}>{w.alt.network}</b> · {w.alt.pass}
        </p>
      )}

      {/* troubleshoot */}
      <div style={{ marginTop: 20, borderTop: `1px solid ${C.beige}`, paddingTop: 16 }}>
        <button onClick={() => setTrouble((v) => !v)} className="sp-btn" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.negro, letterSpacing: "0.02em", fontWeight: 500 }}>{t.wifiTrouble}</span>
          <Icon name={trouble ? "chevronUp" : "chevronDown"} size={17} color={C.tierra} />
        </button>
        {trouble && (
          <ol style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12, counterReset: "ws" }}>
            {[t.wifiStep1, t.wifiStep2].map((s, i) => (
              <li key={i} style={{ display: "flex", gap: 11 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: C.beige, display: "grid", placeItems: "center",
                  fontFamily: C.sans, fontSize: 11, fontWeight: 600, color: C.negro }}>{i + 1}</span>
                <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, letterSpacing: "0.01em" }}>{s}</span>
              </li>
            ))}
          </ol>
        )}
        {trouble && backups.length > 0 && (
          <div style={{ marginTop: 16, background: C.beige, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, marginBottom: 10 }}>{t.wifiBackupTitle}</div>
            {backups.map((bk, i) => (
              <div key={i} style={{ fontFamily: C.sans, fontSize: 12.5, color: C.negro, letterSpacing: "0.02em", padding: "3px 0" }}>
                <b>{bk.network}</b> · {bk.pass}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- CHECK-IN: real building data + subtle early/late buttons ---------- */
function CheckinContent({ t, res }) {
  const es = t.code === "es";
  const b = typeof matchBuilding === "function" ? matchBuilding(res) : null;
  // admin overrides (Propiedades tab) take priority over building defaults
  const pi = (typeof loadPropInfo === "function" ? loadPropInfo() : {})[res.propertyName] || {};
  const addr = (pi.address != null && pi.address !== "") ? pi.address : (b && b.address);
  const arrival = (pi.arrival != null && pi.arrival !== "") ? pi.arrival : (b && b.arrival);
  const maps = (pi.maps != null && pi.maps !== "") ? pi.maps : (b && b.maps);
  const waze = (pi.waze != null && pi.waze !== "") ? pi.waze : (b && b.waze);
  const tip = (pi.tip != null && pi.tip !== "") ? pi.tip : (b && b.tip);
  const hasInfo = !!(b || addr || arrival);
  const unit = (pi.unit != null && pi.unit !== "") ? pi.unit : (typeof unitFromRes === "function" ? unitFromRes(res) : res.apartment);
  const floor = (pi.floor != null && pi.floor !== "") ? pi.floor : (b && typeof floorFromUnit === "function" ? floorFromUnit(unit, b.key) : null);
  const contactName = (pi.contactName != null && pi.contactName !== "") ? pi.contactName : (b && b.contactName);
  const contactPhone = (pi.contactPhone != null && pi.contactPhone !== "") ? pi.contactPhone : (b && b.contactPhone);
  const [flexOpen, setFlexOpen] = useStateB(false);
  const [flexMode, setFlexMode] = useStateB("");   // "" | "early" | "late"
  const [sentMsg, setSentMsg] = useStateB("");
  const [avail, setAvail] = useStateB(null);        // { ci, co }

  // ask the backend whether an extra night is available (turnover check).
  // CHECK-IN: not available if a checkout lands on the check-in date.
  // CHECKOUT: not available if a check-in lands on the checkout date.
  useEffectB(() => {
    let alive = true;
    if (typeof Backend !== "undefined" && Backend.isConnected && Backend.isConnected() && Backend.call) {
      Backend.call("flexAvailability", { code: res.code, propertyName: res.propertyName, checkin: res.checkin, checkout: res.checkout })
        .then((r) => { if (alive && r) setAvail({ ci: !!r.extraNightCheckin, co: !!r.extraNightCheckout }); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [res.code]);
  const extraCiOk = !avail || avail.ci;   // default to showing until we know
  const extraCoOk = !avail || avail.co;

  // reqType routes the request to the right admin flow + automatic message:
  //  early    → availability check + auto email ~10pm the night before
  //  luggage  → notify team (bag storage)
  //  day      → extra-night follow-up
  const submitFlex = (reqType, msg) => {
    const store = loadStore();
    const reqs = store.hostRequests || [];
    reqs.push({ type: reqType, code: res.code, apartment: res.apartment, checkin: res.checkin, checkout: res.checkout, at: Date.now(), status: "pending" });
    saveStore({ ...store, hostRequests: reqs });
    try { Backend.call && Backend.call("hostRequest", { kind: reqType, code: res.code, apartment: res.apartment, checkin: res.checkin, checkout: res.checkout }).catch(() => {}); } catch (e) {}
    setSentMsg(msg);
  };

  const flexOpt = (title, desc, reqType, msg) => (
    <button onClick={() => submitFlex(reqType, msg)} className="sp-btn" style={{ display: "block", width: "100%", textAlign: "left",
      background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 13, padding: "14px 16px", cursor: "pointer" }}>
      <div style={{ fontFamily: C.sans, fontSize: 12.5, fontWeight: 600, color: C.negro, letterSpacing: "0.01em", marginBottom: 5 }}>{title}</div>
      <div style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, lineHeight: 1.55, letterSpacing: "0.01em" }}>{desc}</div>
    </button>
  );

  return (
    <>
      <InfoRow label={t.checkin} value={`${res.checkin} · 3:00 PM`} />
      <InfoRow label={t.checkout} value={`${res.checkout} · 11:00 AM`} />
      {unit && <InfoRow label={t.ckUnit} value={unit} />}
      {floor ? <InfoRow label={t.ckFloor} value={`${floor}`} /> : null}

      {hasInfo ? (
        <div style={{ marginTop: 18 }}>
          {addr && <>
          <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, marginBottom: 8 }}>{t.ckAddress}</div>
          <p style={{ fontFamily: C.sans, fontSize: 13, color: C.negro, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em" }}>{addr}</p>
          </>}
          <div style={{ display: "flex", gap: 9, marginTop: 12, flexWrap: "wrap" }}>
            {maps && <a href={maps} target="_blank" rel="noopener" className="sp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none",
              background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 999, padding: "8px 15px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.03em", fontWeight: 500 }}>
              <Icon name="pin" size={14} color={C.peach} /> {t.ckMaps}</a>}
            {waze && <a href={waze} target="_blank" rel="noopener" className="sp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none",
              background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`, borderRadius: 999, padding: "8px 15px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.03em", fontWeight: 500 }}>
              <Icon name="pin" size={14} color={C.peach} /> {t.ckWaze}</a>}
          </div>

          {arrival && <>
            <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, margin: "18px 0 8px" }}>{t.ckArrival}</div>
            <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.65, margin: 0, letterSpacing: "0.01em", whiteSpace: "pre-line" }}>{arrival}</p>
          </>}
          {tip && <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, lineHeight: 1.6, margin: "12px 0 0", letterSpacing: "0.01em", fontStyle: "italic" }}>{tip}</p>}
          {contactName && <p style={{ fontFamily: C.sans, fontSize: 12, color: C.negro, margin: "12px 0 0", letterSpacing: "0.01em" }}>{t.ckContactName}: <b>{contactName}</b>{contactPhone ? ` · ${contactPhone}` : ""}</p>}
          {/^(smart|keybox|locker|box)/.test(b.lock || "") && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, background: C.beige, borderRadius: 12, padding: "13px 15px" }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="lock" size={15} color={C.peach} /></span>
              <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.negro, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em" }}>{t.ckCodeNote}</p>
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.65, margin: "16px 0 0", letterSpacing: "0.02em" }}>
          {es ? "El acceso es con código digital. Te lo enviamos por WhatsApp el día de tu llegada." : "Access is via digital code. We'll send it on WhatsApp the day you arrive."}
        </p>
      )}

      {/* subtle early/late — intentionally low-key, honest about availability */}
      <div style={{ marginTop: 22, borderTop: `1px solid ${C.beige}`, paddingTop: 14 }}>
        <button onClick={() => { setFlexOpen((v) => !v); setFlexMode(""); setSentMsg(""); }} className="sp-btn" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, letterSpacing: "0.02em" }}>{t.ckEarlyLate}</span>
          <Icon name={flexOpen ? "chevronUp" : "chevronDown"} size={16} color={C.tierra} />
        </button>

        {flexOpen && sentMsg && (
          <div style={{ marginTop: 14, background: C.beige, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon name="check" size={16} color={C.peach} />
              <span style={{ fontFamily: C.sans, fontSize: 12, fontWeight: 600, color: C.negro, letterSpacing: "0.02em" }}>{t.ckSentTitle}</span>
            </div>
            <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em" }}>{sentMsg}</p>
          </div>
        )}

        {flexOpen && !sentMsg && !flexMode && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
            <button onClick={() => setFlexMode("early")} className="sp-btn" style={{ background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`,
              borderRadius: 11, padding: "12px 15px", fontFamily: C.sans, fontSize: 12, letterSpacing: "0.02em", cursor: "pointer", textAlign: "left", fontWeight: 500,
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>{t.ckEarly}<Icon name="arrow" size={15} color={C.tierra} /></button>
            <button onClick={() => setFlexMode("late")} className="sp-btn" style={{ background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`,
              borderRadius: 11, padding: "12px 15px", fontFamily: C.sans, fontSize: 12, letterSpacing: "0.02em", cursor: "pointer", textAlign: "left", fontWeight: 500,
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>{t.ckLate}<Icon name="arrow" size={15} color={C.tierra} /></button>
            <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, lineHeight: 1.5, margin: "2px 0 0", letterSpacing: "0.02em" }}>{t.ckFlexNote}</p>
          </div>
        )}

        {flexOpen && !sentMsg && flexMode && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontFamily: C.sans, fontSize: 12, color: C.tierra, lineHeight: 1.6, margin: "0 0 12px", letterSpacing: "0.01em" }}>{flexMode === "early" ? t.ckEarlyIntro : t.ckLateIntro}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {flexMode === "early" ? <>
                {extraCiOk && flexOpt(t.ckEO3t, t.ckEO3d, "day", t.ckSentNight)}
                {flexOpt(t.ckEO1t, t.ckEO1d, "early", t.ckSentEarly)}
                {flexOpt(t.ckEO2t, t.ckEO2d, "luggage", t.ckSentLuggage)}
              </> : <>
                {extraCoOk && flexOpt(t.ckLO2t, t.ckLO2d, "day", t.ckSentNight)}
                {flexOpt(t.ckLO1t, t.ckLO1d, "luggage", t.ckSentLuggage)}
              </>}
            </div>
            <button onClick={() => setFlexMode("")} className="sp-btn" style={{ background: "transparent", border: "none", cursor: "pointer",
              fontFamily: C.sans, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.tierra, padding: "12px 0 2px", fontWeight: 500,
              display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="arrowLeft" size={14} color={C.tierra} /> {t.ckBack}</button>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- PARQUEO ---------- */
function ParqueoContent({ t, res }) {
  const es = t.code === "es";
  const b = typeof matchBuilding === "function" ? matchBuilding(res) : null;
  const p = b && b.parking;
  const pi = (typeof loadPropInfo === "function" ? loadPropInfo() : {})[res.propertyName] || {};
  const piPark = pi.hasParking || pi.parkNote || pi.parkNumber || pi.parkExtInfo || pi.parkLink;
  const kindLabel = { own: t.parkOwn, "pay-us": t.parkPayUs, "pay-building": t.parkPayBuilding, external: t.parkExternal, street: t.parkExternal };
  if (piPark) {
    const yes = pi.hasParking === "yes";
    const note = pi.parkNote
      || (yes ? ((es ? "Parqueo asignado" : "Assigned parking") + (pi.parkNumber ? ` · ${pi.parkNumber}` : ""))
             : (pi.parkExtInfo || (es ? "Este alojamiento no cuenta con parqueo propio." : "This property has no private parking.")));
    return (
      <div style={{ paddingTop: 14 }}>
        <div style={{ background: C.beige, borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
            <Icon name="parqueo" size={17} color={C.peach} />
            <span style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.negro, fontWeight: 600 }}>{es ? "Parqueo" : "Parking"}</span>
          </div>
          <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em", whiteSpace: "pre-line" }}>{note}</p>
          {pi.parkLink && <a href={pi.parkLink} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, textDecoration: "none", background: C.negro, color: C.alabaster, borderRadius: 10, padding: "10px 16px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.04em", fontWeight: 500 }}><Icon name="pin" size={14} color={C.alabaster} /> {t.parkPayLink}</a>}
        </div>
      </div>
    );
  }
  if (!b || !p) {
    return <p style={{ fontFamily: C.sans, fontSize: 13, color: C.tierra, lineHeight: 1.65, margin: "14px 0 0", letterSpacing: "0.02em" }}>
      {es ? "Consulta con nuestro equipo la información de parqueo para tu alojamiento." : "Ask our team about parking for your stay."}</p>;
  }
  const block = (kind, note, payUrl) => (
    <div style={{ background: C.beige, borderRadius: 14, padding: "16px 18px", margintop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <Icon name="parqueo" size={17} color={C.peach} />
        <span style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.negro, fontWeight: 600 }}>{kindLabel[kind] || kind}</span>
      </div>
      <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em" }}>{note}</p>
      {payUrl && <a href={payUrl} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, textDecoration: "none",
        background: C.negro, color: C.alabaster, borderRadius: 10, padding: "10px 16px", fontFamily: C.sans, fontSize: 11, letterSpacing: "0.04em", fontWeight: 500 }}>
        <Icon name="pin" size={14} color={C.alabaster} /> {t.parkPayLink}</a>}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 14 }}>
      {block(p.kind, p.note, p.payUrl)}
      {p.extra && block(p.extra.kind, p.extra.note, p.extra.payUrl)}
      {b.parkingPayNote && block("pay-building", b.parkingPayNote)}
    </div>
  );
}

/* ---------- FACTURA ---------- */
function FacturaContent({ t, res }) {
  const [nit, setNit] = useStateB("");
  const [name, setName] = useStateB("");
  const [comment, setComment] = useStateB("");
  const [sent, setSent] = useStateB(false);
  const send = () => {
    const store = loadStore();
    const inv = store.invoices || [];
    inv.push({ code: res.code, apartment: res.apartment, checkin: res.checkin, nit, name, comment, at: Date.now(), status: "pending" });
    saveStore({ ...store, invoices: inv });
    try { Backend.call && Backend.call("invoiceRequest", { code: res.code, checkin: res.checkin, nit, razon: name, comment }).catch(() => {}); } catch (e) {}
    setSent(true);
  };
  if (sent) return (
    <div style={{ textAlign: "center", padding: "24px 8px 8px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <span style={{ width: 48, height: 48, borderRadius: 14, background: C.beige, display: "grid", placeItems: "center" }}><Icon name="check" size={24} color={C.peach} /></span>
      </div>
      <div style={{ fontFamily: C.serif, fontSize: 22, color: C.negro, marginBottom: 8 }}>{t.facturaSent}</div>
      <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em" }}>{t.facturaSentDesc}</p>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 14 }}>
      <div style={{ background: C.beige, borderRadius: 12, padding: "13px 16px" }}>
        <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, lineHeight: 1.55, margin: 0, letterSpacing: "0.01em" }}>{t.facturaNote}</p>
      </div>
      <MiniField label={t.facturaNit} value={nit} onChange={setNit} placeholder="CF / 1234567-8" />
      <MiniField label={t.facturaName} value={name} onChange={setName} placeholder={t.code === "es" ? "Nombre o empresa" : "Name or company"} />
      <MiniField label={t.facturaComment} value={comment} onChange={setComment} textarea />
      <Btn full variant="peach" onClick={send} disabled={!nit.trim() || !name.trim()}>{t.facturaSend}</Btn>
    </div>
  );
}

/* ---------- GUEST ACCESS ---------- */
function GuestAccessContent({ t, res }) {
  const es = t.code === "es";
  const blank = () => ({ name: "", doc: "", id: "", date: res.checkin || "", time: "" });
  const [guests, setGuests] = useStateB([blank()]);
  const [result, setResult] = useStateB(null); // "auto" | "manual"
  const upd = (i, k, v) => setGuests((g) => g.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const valid = guests.every((g) => g.name.trim() && g.id.trim() && g.date);
  const send = () => {
    const store = loadStore();
    const list = store.guestAccess || [];
    const manual = guests.length > 2;
    list.push({ code: res.code, apartment: res.apartment, guests, at: Date.now(), status: manual ? "needs-approval" : "auto-sent" });
    saveStore({ ...store, guestAccess: list });
    try { Backend.call && Backend.call("guestAccess", { code: res.code, apartment: res.apartment, guests, needsApproval: manual }).catch(() => {}); } catch (e) {}
    setResult(manual ? "manual" : "auto");
  };
  if (result) return (
    <div style={{ textAlign: "center", padding: "22px 8px 8px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <span style={{ width: 48, height: 48, borderRadius: 14, background: C.beige, display: "grid", placeItems: "center" }}>
          <Icon name={result === "auto" ? "check" : "clock"} size={24} color={C.peach} /></span>
      </div>
      <div style={{ fontFamily: C.serif, fontSize: 22, color: C.negro, marginBottom: 8 }}>{result === "auto" ? t.guestReqAutoSent : t.guestReqManualTitle}</div>
      <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em" }}>{result === "auto" ? t.guestReqAutoDesc : t.guestReqManualDesc}</p>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 14 }}>
      <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, margin: 0, letterSpacing: "0.02em" }}>{t.guestReqSub}</p>
      {guests.map((g, i) => (
        <div key={i} style={{ background: C.beige, borderRadius: 14, padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600 }}>{t.guestReqOne} {i + 1}</span>
            {guests.length > 1 && <button onClick={() => setGuests((gg) => gg.filter((_, j) => j !== i))} className="sp-btn" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}><Icon name="x" size={15} color={C.tierra} /></button>}
          </div>
          <MiniField label={t.guestName} value={g.name} onChange={(v) => upd(i, "name", v)} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><MiniField label={t.guestDoc} value={g.doc} onChange={(v) => upd(i, "doc", v)} placeholder={es ? "DPI / Pasaporte" : "ID / Passport"} /></div>
            <div style={{ flex: 1 }}><MiniField label={t.guestId} value={g.id} onChange={(v) => upd(i, "id", v)} /></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><MiniField label={t.guestDate} type="date" value={g.date} onChange={(v) => upd(i, "date", v)} /></div>
            <div style={{ flex: 1 }}><MiniField label={t.guestTime} type="time" value={g.time} onChange={(v) => upd(i, "time", v)} /></div>
          </div>
        </div>
      ))}
      <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, lineHeight: 1.5, margin: 0, letterSpacing: "0.02em", fontStyle: "italic" }}>{t.guestTimeWarn}</p>
      <button onClick={() => setGuests((g) => [...g, blank()])} className="sp-btn" style={{ background: "transparent", color: C.negro, border: `1px dashed ${C.grisCalido}`,
        borderRadius: 12, padding: "11px 14px", fontFamily: C.sans, fontSize: 12, letterSpacing: "0.03em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Icon name="user" size={15} color={C.negro} /> {t.guestAdd}
      </button>
      {guests.length > 2 && (
        <div style={{ background: "#FBEEEA", border: "1px solid rgba(233,130,106,.3)", borderRadius: 12, padding: "13px 16px" }}>
          <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.negro, lineHeight: 1.55, margin: 0, letterSpacing: "0.01em" }}>{t.guestReqManualDesc}</p>
        </div>
      )}
      <Btn full variant="peach" onClick={send} disabled={!valid}>{t.guestReqSend}</Btn>
    </div>
  );
}

/* house-manual extras that apply to this property (induction, cable, smart house) */
function ManualExtras({ t, res }) {
  const es = t.code === "es";
  const b = typeof matchBuilding === "function" ? matchBuilding(res) : null;
  const extras = typeof HOUSE_MANUAL_EXTRAS !== "undefined" ? HOUSE_MANUAL_EXTRAS : {};

  // universal cards shown for every property
  const universal = es ? [
    { icon: "manual", title: "Basura y reciclaje", intro: "En Guatemala la basura se separa por ley (Acuerdo Gubernativo 164-2021). Es sencillo:",
      steps: [
        "Orgánico (restos de comida, cáscaras): bolsa verde.",
        "Inorgánico reciclable (plástico, vidrio, papel, lata) limpio y seco: bolsa blanca o azul.",
        "No reciclable / sanitario: bolsa negra.",
        "Toda la basura debe salir en bolsa cerrada y llevarse al área designada del edificio o casa. No la dejes en pasillos ni fuera de la puerta.",
      ] },
    { icon: "wifi", title: "Ecofiltro — agua pura", intro: "El apartamento tiene un ecofiltro: un invento guatemalteco que purifica el agua con un filtro de barro, aserrín y plata coloidal.",
      steps: [
        "Sirve directo de la llave del ecofiltro: el agua es 100% segura para beber.",
        "No necesitas comprar agua embotellada — es mejor para ti y para el planeta.",
        "Elimina bacterias y sedimentos conservando el sabor natural del agua.",
        "Un orgullo local: creado en Guatemala y usado en todo el mundo.",
      ] },
    { icon: "manual", title: "Netflix y Disney+", intro: "La TV tiene acceso a Netflix y Disney+ para que disfrutes tus noches en casa.",
      body: "Si tu TV no aparece conectada a nuestras cuentas, tómale una foto al código QR que sale en la pantalla y envíanoslo por la app — así te conectamos de forma remota en minutos.",
      qr: true },
  ] : [
    { icon: "manual", title: "Trash & recycling", intro: "In Guatemala waste is separated by law (Government Accord 164-2021). It's simple:",
      steps: [
        "Organic (food scraps, peels): green bag.",
        "Recyclable inorganic (plastic, glass, paper, cans) clean and dry: white or blue bag.",
        "Non-recyclable / sanitary: black bag.",
        "All trash must leave in a closed bag and be taken to the building's designated area. Don't leave it in hallways or outside the door.",
      ] },
    { icon: "wifi", title: "Ecofiltro — pure water", intro: "The apartment has an ecofiltro: a Guatemalan invention that purifies water with a filter of clay, sawdust and colloidal silver.",
      steps: [
        "Pour straight from the ecofiltro tap: the water is 100% safe to drink.",
        "No need to buy bottled water — better for you and the planet.",
        "Removes bacteria and sediment while keeping water's natural taste.",
        "A local pride: created in Guatemala and used around the world.",
      ] },
    { icon: "manual", title: "Netflix & Disney+", intro: "The TV has access to Netflix and Disney+ so you can enjoy your nights in.",
      body: "If your TV isn't connected to our accounts, snap a photo of the QR code shown on screen and send it to us through the app — we'll connect you remotely in minutes.",
      qr: true },
  ];

  const buildingCards = b ? ["induction", "cable", "smartHouse"].filter((k) => b[k] && extras[k]).map((k) => extras[k]) : [];
  // admin-managed house manual (Propiedades → Manual de la casa) takes over once configured
  const pi = (typeof loadPropInfo === "function" ? loadPropInfo() : {});
  const manual = pi.__manual__ || {};
  const mItems = manual.items || [];
  const mAssign = manual.assign || {};
  const assignedCards = mItems.length
    ? mItems.filter((it) => (mAssign[it.id] || []).includes(res.propertyName)).map((it) => ({ icon: it.icon || "manual", title: it.title, intro: it.intro || "", steps: it.steps || [] }))
    : buildingCards;
  const cards = universal.concat(assignedCards);

  const renderCard = (e, k) => (
    <div key={k} style={{ background: C.beige, borderRadius: 18, overflow: "hidden", border: `1px solid ${C.grisCalido}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px 12px" }}>
        <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: C.white, display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(62,63,63,.05)" }}>
          <Icon name={e.icon || "manual"} size={19} color={C.peach} />
        </span>
        <div style={{ fontFamily: C.serif, fontSize: 19, color: C.negro, lineHeight: 1.15 }}>{e.title}</div>
      </div>
      {e.intro && <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, margin: 0, padding: "0 18px 14px", letterSpacing: "0.01em" }}>{e.intro}</p>}
      {e.steps && (
        <ol style={{ margin: 0, padding: "0 18px 18px", listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {e.steps.map((s, i) => (
            <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: C.negro, color: C.alabaster, display: "grid", placeItems: "center",
                fontFamily: C.sans, fontSize: 11.5, fontWeight: 600 }}>{i + 1}</span>
              <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.negro, lineHeight: 1.6, letterSpacing: "0.01em", paddingTop: 2 }}>{s}</span>
            </li>
          ))}
        </ol>
      )}
      {e.body && <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, margin: 0, padding: "0 18px 18px", letterSpacing: "0.01em" }}>{e.body}</p>}
      {e.qr && (
        <div style={{ margin: "0 18px 18px" }}>
          <button onClick={() => window.open("https://wa.me/50256909499", "_blank")} className="sp-btn" style={{ width: "100%", background: C.white, color: C.negro, border: `1px solid ${C.grisCalido}`,
            borderRadius: 11, padding: "11px 14px", fontFamily: C.sans, fontSize: 11.5, letterSpacing: "0.03em", cursor: "pointer", fontWeight: 500, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="camera" size={15} color={C.negro} /> {es ? "Enviar código QR" : "Send QR code"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 14 }}>
      {cards.map((e, i) => renderCard(e, i))}
    </div>
  );
}

/* guest suggestion → goes straight to the admin tracking panel */
function SuggestionContent({ t, res }) {
  const es = t.code === "es";
  const [text, setText] = useStateB("");
  const [sent, setSent] = useStateB(false);
  const send = () => {
    const store = loadStore();
    const list = store.suggestions || [];
    list.push({ code: res.code, apartment: res.apartment, propertyName: res.propertyName, text: text.trim(), at: Date.now(), status: "new" });
    saveStore({ ...store, suggestions: list });
    try { Backend.call && Backend.call("suggestion", { code: res.code, apartment: res.apartment, text: text.trim() }).catch(() => {}); } catch (e) {}
    setSent(true);
  };
  if (sent) return (
    <div style={{ textAlign: "center", padding: "24px 8px 8px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <span style={{ width: 48, height: 48, borderRadius: 14, background: C.beige, display: "grid", placeItems: "center" }}><Icon name="check" size={24} color={C.peach} /></span>
      </div>
      <div style={{ fontFamily: C.serif, fontSize: 22, color: C.negro, marginBottom: 8 }}>{es ? "Gracias por escribirnos" : "Thank you for writing"}</div>
      <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, margin: 0, letterSpacing: "0.01em" }}>{es ? "Tu mensaje llegó directo a nuestro equipo. Lo leeremos con atención." : "Your message reached our team directly. We'll read it with care."}</p>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 14 }}>
      <p style={{ fontFamily: C.sans, fontSize: 13, color: C.tierra, lineHeight: 1.65, margin: 0, letterSpacing: "0.02em" }}>
        {es ? "Tu opinión es privada y llega directo a nosotros, fuera de la plataforma." : "Your feedback is private and reaches us directly, outside the platform."}
      </p>
      <MiniField label={es ? "Tu sugerencia" : "Your suggestion"} value={text} onChange={setText} textarea />
      <Btn full variant="peach" onClick={send} disabled={!text.trim()}>{es ? "Enviar sugerencia" : "Send suggestion"}</Btn>
    </div>
  );
}

/* "coming soon" placeholder for sections in progress */
function ComingSoon({ t }) {
  const es = t.code === "es";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 16px 20px", gap: 12 }}>
      <Sparkle size={16} color={C.peach} />
      <div style={{ fontFamily: C.serif, fontSize: 22, color: C.negro, lineHeight: 1.2 }}>{es ? "Estamos trabajando en ello" : "We're working on it"}</div>
      <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.6, margin: 0, letterSpacing: "0.02em", maxWidth: 280 }}>
        {es ? "Muy pronto encontrarás aquí recomendaciones seleccionadas con cariño para tu estadía." : "Soon you'll find recommendations here, curated with care for your stay."}
      </p>
    </div>
  );
}

/* ---------- EMERGENCY: national + local by location, no host contact ---------- */
function EmergencyContent({ t, res }) {
  const es = t.code === "es";
  const data = typeof emergencyForRes === "function" ? emergencyForRes(res) : { national: [], local: [] };
  const areaLabel = { gt: "Ciudad de Guatemala", antigua: "Antigua Guatemala", likin: "Likín", monterrico: "Monterrico" }[data.zone] || "";
  const row = (item, i, arr) => (
    <a key={i} href={"tel:" + String(item.num).replace(/[^0-9+]/g, "")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
      padding: "12px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.beige}` : "none", textDecoration: "none" }}>
      <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.negro, letterSpacing: "0.01em" }}>{es ? item.es : item.en}</span>
      <span style={{ fontFamily: C.sans, fontSize: 14, fontWeight: 600, color: C.peach, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{item.num}</span>
    </a>
  );
  const head = (s) => <div style={{ fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 600, margin: "18px 0 2px" }}>{s}</div>;
  return (
    <div style={{ paddingTop: 14 }}>
      {head(es ? "Nacional" : "National")}
      {data.national.map((x, i) => row(x, i, data.national))}
      {data.local.length > 0 && <>
        {head((es ? "Local · " : "Local · ") + areaLabel)}
        {data.local.map((x, i) => row(x, i, data.local))}
      </>}
    </div>
  );
}

/* ---------- ACTIVITIES: curated, location-aware, non-mainstream ---------- */
function ActivitiesContent({ t, res }) {
  const es = t.code === "es";
  const data = typeof activitiesForRes === "function" ? activitiesForRes(res) : { list: [], areaName: "" };
  const pics = [IMG.rooftop, IMG.antigua, IMG.nook, IMG.morning, IMG.welcome, IMG.selfcare];
  const moreLink = (title) => "https://www.google.com/search?q=" + encodeURIComponent(title + " " + (data.areaName || "Guatemala"));
  return (
    <div style={{ paddingTop: 14 }}>
      <p style={{ fontFamily: C.sans, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: C.tierra, fontWeight: 500, margin: "0 0 16px" }}>{data.areaName}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {data.list.map((a, i) => {
          const c = es ? a.es : a.en;
          return (
            <div key={i} style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${C.grisCalido}`, background: C.white }}>
              <div style={{ position: "relative", height: 150, overflow: "hidden" }}>
                <img src={pics[i % pics.length]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(62,63,63,.42), transparent 55%)" }} />
                <div style={{ position: "absolute", left: 16, right: 16, bottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkle size={12} color={C.white} />
                  <span style={{ fontFamily: C.serif, fontSize: 20, color: C.white, lineHeight: 1.1 }}>{c[0]}</span>
                </div>
              </div>
              <div style={{ padding: "14px 16px 16px" }}>
                <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, margin: 0, letterSpacing: "0.01em", lineHeight: 1.6 }}>{c[1]}</p>
                <a href={moreLink(c[0])} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 12, textDecoration: "none",
                  fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: C.negro, fontWeight: 500 }}>
                  {es ? "Ver más" : "See more"} <Icon name="arrow" size={14} color={C.peach} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontFamily: C.sans, fontSize: 10.5, color: C.tierra, lineHeight: 1.55, margin: "18px 0 0", letterSpacing: "0.02em", fontStyle: "italic", textAlign: "center" }}>
        {es ? "Actividades sugeridas, no gestionadas por nosotros." : "Suggested activities, not managed by us."}
      </p>
    </div>
  );
}

/* ---------- AMENITIES: from Hospitable listing, else "coming soon" ---------- */
function AmenitiesContent({ t, res }) {
  const es = t.code === "es";
  const pi = (typeof loadPropInfo === "function" ? loadPropInfo() : {})[res.propertyName] || {};
  const piAm = (pi.amenities && pi.amenities.length) ? pi.amenities : null;
  const [state, setState] = useStateB(piAm ? "ok" : (res.amenities && res.amenities.length ? "ok" : "loading"));
  const [items, setItems] = useStateB(piAm || res.amenities || []);
  useEffectB(() => {
    if (items.length) { setState("ok"); return; }
    let alive = true;
    if (typeof Backend !== "undefined" && Backend.isConnected && Backend.isConnected() && Backend.call) {
      Backend.call("listingAmenities", { code: res.code, propertyName: res.propertyName })
        .then((r) => { if (!alive) return; const a = (r && r.amenities) || []; if (a.length) { setItems(a); setState("ok"); } else setState("empty"); })
        .catch(() => { if (alive) setState("empty"); });
    } else { setState("empty"); }
    return () => { alive = false; };
  }, [res.code]);
  if (state === "loading") return <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 18, fontFamily: C.sans, fontSize: 12.5, color: C.tierra }}><Spinner color={C.taupe} /> {es ? "Cargando amenidades…" : "Loading amenities…"}</div>;
  if (state === "ok") return <Chips items={items} />;
  return (
    <div style={{ background: C.beige, borderRadius: 14, padding: "16px 18px", marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon name="clock" size={16} color={C.peach} />
        <span style={{ fontFamily: C.sans, fontSize: 12, fontWeight: 600, color: C.negro, letterSpacing: "0.02em" }}>{es ? "Estamos trabajando en ello" : "We're working on it"}</span>
      </div>
      <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.65, margin: 0, letterSpacing: "0.01em" }}>
        {es ? "Estamos preparando la lista de amenidades de este alojamiento. Muy pronto la verás aquí." : "We're preparing this property's amenities list. You'll see it here very soon."}
      </p>
    </div>
  );
}

function renderTileContent(key, t, res) {
  const es = t.code === "es";
  switch (key) {
    case "checkin": return <CheckinContent t={t} res={res} />;
    case "wifi": return <WifiContent t={t} res={res} />;
    case "parqueo": return <ParqueoContent t={t} res={res} />;
    case "factura": return <FacturaContent t={t} res={res} />;
    case "visits": return <GuestAccessContent t={t} res={res} />;
    case "manual": return <ManualExtras t={t} res={res} />;
    case "chat": return <>
      <div style={{ background: C.beige, borderRadius: 14, padding: "16px 18px", marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="clock" size={16} color={C.peach} />
          <span style={{ fontFamily: C.sans, fontSize: 12, fontWeight: 600, color: C.negro, letterSpacing: "0.02em" }}>{es ? "Estamos trabajando en ello" : "We're working on it"}</span>
        </div>
        <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.tierra, lineHeight: 1.65, margin: 0, letterSpacing: "0.01em" }}>
          {es ? "El chat dentro de la app estará disponible muy pronto. Por ahora, toda la comunicación se realiza a través de la plataforma donde hiciste tu reserva (Airbnb, Booking, etc.)." : "In-app chat is coming very soon. For now, all communication happens through the platform where you booked (Airbnb, Booking, etc.)."}
        </p>
      </div>
    </>;
    case "review": return <SuggestionContent t={t} res={res} />;
    case "emergency": return <EmergencyContent t={t} res={res} />;
    case "activities": return <ActivitiesContent t={t} res={res} />;
    case "amenities": return <AmenitiesContent t={t} res={res} />;
    case "upsells": return <ComingSoon t={t} />;
    case "upsells_OLD": return <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 14 }}>
      {(es ? [["Late check-out", "$20", true], ["Canasta de bienvenida", "$32", true], ["Tour privado", "Por fecha", false], ["Limpieza extra", "$26", true]]
           : [["Late check-out", "$20", true], ["Welcome basket", "$32", true], ["Private tour", "By date", false], ["Extra cleaning", "$26", true]]).map((u, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingBottom: 12, borderBottom: i < 3 ? `1px solid ${C.beige}` : "none" }}>
          <div><div style={{ fontFamily: C.serif, fontSize: 18, color: C.negro }}>{u[0]}</div>
            <div style={{ fontFamily: C.sans, fontSize: 11.5, color: C.tierra, marginTop: 2, letterSpacing: "0.03em" }}>{u[1]}</div></div>
          <Btn variant="peach" style={{ padding: "9px 16px", fontSize: 10.5 }}>{u[2] ? (es ? "Añadir" : "Add") : (es ? "Reservar" : "Book")}</Btn>
        </div>
      ))}
    </div>;
    case "selflove": return <>
      <p style={{ fontFamily: C.serif, fontStyle: "italic", fontWeight: 300, fontSize: 21, color: C.negro, lineHeight: 1.35, margin: "16px 0 0", letterSpacing: "-0.01em", textWrap: "balance" }}>
        “{es ? "Un espacio para volver a ti, sin prisa." : "A space to return to yourself, unhurried."}”
      </p>
      <p style={{ fontFamily: C.sans, fontSize: 13, color: C.tierra, lineHeight: 1.65, margin: "12px 0 0", letterSpacing: "0.02em" }}>
        {es ? "Encontrarás una vela, sales de baño y una playlist pensada para ti. Tómate el momento." : "You'll find a candle, bath salts and a playlist made for you. Take the moment."}
      </p>
      <ActionBtn accent>{es ? "Descubrir el ritual" : "Discover the ritual"}</ActionBtn>
    </>;
    default: return null;
  }
}

Object.assign(window, { BentoScreen, TileDetail, AccountModal });
