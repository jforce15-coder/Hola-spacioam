/* ============================================================
   SPACIO AM — tutoriales del huésped
   · TutorialFab: botón flotante (FAB peach, estilo EPI) en Mi espacio
   · GuestTour: recorrido de 3 pasos (check-in · parqueo · wifi)
     obligatorio las 2 primeras sesiones (la 2a permite saltar)
   · AirbnbCodeHelp: "¿Dónde encuentro el código en Airbnb?"
   Exporta a window.
   ============================================================ */
const { useState: uS2, useEffect: uE2, useRef: uR2 } = React;

/* ---- sesiones vistas por dispositivo ---- */
const TOUR_KEY = "spacioam_tour_v1";
function tourState() { try { return JSON.parse(localStorage.getItem(TOUR_KEY)) || { sessions: 0, done: false }; } catch (e) { return { sessions: 0, done: false }; } }
function saveTourState(s) { try { localStorage.setItem(TOUR_KEY, JSON.stringify(s)); } catch (e) {} }

function tourSteps(es) {
  return [
    { tile: "checkin", eyebrow: es ? "Primer bloque" : "First block", icon: "checkin",
      title: es ? "Tus instrucciones de llegada" : "Your arrival instructions",
      body: es ? "El primer bloque del inicio es tu check-in: dirección, cómo llegar, a qué hora y cómo entrar al apartamento."
               : "The first block on the home screen is your check-in: address, how to get there, what time and how to get in." },
    { tile: "parqueo", eyebrow: es ? "Dentro del check-in" : "Inside check-in", icon: "parqueo",
      title: es ? "Dónde parquear" : "Where to park",
      body: es ? "Las instrucciones del parqueo están en ese mismo bloque de check-in, y también en su propio bloque de Parqueo."
               : "Parking instructions live in that same check-in block, and also in their own Parking block." },
    { tile: "wifi", eyebrow: es ? "Bloque de Wi-Fi" : "Wi-Fi block", icon: "wifi",
      title: es ? "La clave del Wi-Fi" : "The Wi-Fi password",
      body: es ? "En el bloque de Wi-Fi tienes la red y la contraseña, con un botón para copiarla y conectarte de una vez."
               : "The Wi-Fi block has the network and password, with a button to copy it and connect right away." },
  ];
}

/* ---- FAB de tutoriales ---- */
function TutorialFab({ t, onOpen }) {
  const es = t.code === "es";
  return (
    <button onClick={onOpen} aria-label={es ? "Ver tutorial" : "View tutorial"} title={es ? "Ver tutorial" : "View tutorial"}
      style={{ position: "fixed", right: "max(18px,env(safe-area-inset-right))", bottom: "max(22px,calc(env(safe-area-inset-bottom) + 18px))",
        zIndex: 300, width: 54, height: 54, borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
        background: "var(--accent,#E9826A)", boxShadow: "0 12px 40px rgba(62,63,63,.07), 0 4px 16px rgba(233,130,106,.35)",
        display: "grid", placeItems: "center", transition: "transform .18s var(--ease)" }}>
      <Icon name="help" size={24} color="#FFFFFF" />
    </button>
  );
}

/* ---- recorrido de 3 pasos ---- */
function GuestTour({ t, onClose, onGoTile, mandatory, canSkip }) {
  const es = t.code === "es";
  const steps = tourSteps(es);
  const [i, setI] = uS2(0);
  const [show, setShow] = uS2(false);
  uE2(() => { const a = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(a); }, []);
  const finish = () => { setShow(false); setTimeout(onClose, 340); };
  const s = steps[i];
  const last = i === steps.length - 1;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 430, display: "grid", placeItems: "end center", padding: "20px 18px max(20px,env(safe-area-inset-bottom))",
      background: "rgba(62,63,63,.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      opacity: show ? 1 : 0, transition: "opacity .36s var(--ease)" }}
      onClick={mandatory ? undefined : finish}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(430px,100%)", background: "var(--surface,#fff)", borderRadius: 28,
        padding: "clamp(22px,5vw,28px)", boxShadow: "0 28px 80px rgba(62,63,63,.10)",
        transform: show ? "none" : "translateY(14px)", transition: "transform .36s var(--ease)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--sans)", fontSize: 9.5, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "var(--fg-muted,#6F6867)", fontWeight: 600 }}>
            <Sparkle size={11} color="var(--accent,#E9826A)" /> {s.eyebrow}
          </span>
          <div style={{ display: "flex", gap: 5 }}>
            {steps.map((_, k) => (
              <span key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 999, background: k === i ? "var(--accent,#E9826A)" : "var(--warm-grey,#D8D4CE)", transition: "width .24s var(--ease)" }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 14, background: "var(--beige-soft,#F5F3F0)", display: "grid", placeItems: "center" }}>
            <Icon name={s.icon} size={21} color="var(--accent,#E9826A)" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 23, color: "var(--fg,#3E3F3F)", lineHeight: 1.12, letterSpacing: "-0.01em" }}>{s.title}</div>
            <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--fg-muted,#6F6867)", lineHeight: 1.7, letterSpacing: "0.02em", margin: "8px 0 0", textWrap: "pretty" }}>{s.body}</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          <button onClick={() => { if (last) finish(); else setI(i + 1); }} className="sp-btn"
            style={{ flex: "1 1 auto", background: "var(--fg,#3E3F3F)", color: "var(--bg,#FAFAFA)", border: "none", borderRadius: 999,
              padding: "14px 22px", fontFamily: "var(--sans)", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", fontWeight: 500 }}>
            {last ? (es ? "Entendido" : "Got it") : (es ? "Siguiente" : "Next")}
          </button>
          {onGoTile && (
            <button onClick={() => { finish(); setTimeout(() => onGoTile(s.tile), 360); }} className="sp-btn"
              style={{ background: "var(--surface,#fff)", color: "var(--fg,#3E3F3F)", border: "1px solid var(--warm-grey,#D8D4CE)", borderRadius: 999,
                padding: "13px 18px", fontFamily: "var(--sans)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
              {es ? "Verlo" : "Show me"}
            </button>
          )}
        </div>
        {(canSkip || !mandatory) && (
          <button onClick={finish} className="sp-link"
            style={{ display: "block", margin: "12px auto 0", background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "var(--sans)", fontSize: 10.5, letterSpacing: "0.1em", color: "var(--fg-muted,#6F6867)", textDecoration: "underline", textUnderlineOffset: 3 }}>
            {es ? "Saltar tutorial" : "Skip tutorial"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- ¿Dónde encuentro el código en Airbnb? ----
   Dos caminos reales: la pestaña Mensajes, o "Message your host" dentro del
   anuncio en My trips. Las capturas se colocan en assets/tutorial/. */
const AIRBNB_SHOTS = {
  m1: "assets/tutorial/airbnb-mensajes-w760.png",
  m2a: "assets/tutorial/airbnb-trips-w760.png",
  m2b: "assets/tutorial/airbnb-your-stay-w760.png",
};

function AirbnbCodeHelp({ t }) {
  const es = t.code === "es";
  const [open, setOpen] = uS2(false);
  return (
    <React.Fragment>
      <button onClick={() => setOpen(true)} className="sp-btn"
        style={{ display: "inline-flex", alignItems: "center", gap: 9, marginTop: 14, background: "var(--accent-tint,rgba(233,130,106,.12))",
          color: "var(--fg,#3E3F3F)", border: "1px solid var(--accent,#E9826A)", borderRadius: 999, padding: "11px 18px",
          fontFamily: "var(--sans)", fontSize: 11.5, letterSpacing: "0.06em", cursor: "pointer", fontWeight: 500 }}>
        <Icon name="search" size={15} color="var(--accent,#E9826A)" />
        {es ? "¿Dónde encuentro el código en Airbnb?" : "Where do I find the code on Airbnb?"}
      </button>
      {open && <AirbnbCodeTutorial t={t} onClose={() => setOpen(false)} />}
    </React.Fragment>
  );
}

function AirbnbCodeTutorial({ t, onClose }) {
  const es = t.code === "es";
  const [show, setShow] = uS2(false);
  uE2(() => {
    const a = requestAnimationFrame(() => setShow(true));
    const b = document.body, prev = b.style.overflow; b.style.overflow = "hidden";
    return () => { cancelAnimationFrame(a); b.style.overflow = prev; };
  }, []);
  const close = () => { setShow(false); setTimeout(onClose, 340); };

  const shot = (src, caption) => (
    <figure style={{ margin: "12px 0 0" }}
      ref={(el) => { if (el) el.dataset.shot = "1"; }}>
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--warm-grey,#D8D4CE)", background: "var(--beige-soft,#F5F3F0)" }}>
        <img src={src} alt={caption} loading="lazy"
          onError={(e) => {
            // Sin la captura real, el tutorial degrada a solo texto: se oculta
            // la figura completa (antes quedaba un rectángulo beige vacío).
            const fig = e.target.closest ? e.target.closest("figure") : null;
            if (fig) fig.style.display = "none";
          }}
          style={{ display: "block", width: "100%", height: "auto" }} />
      </div>
      <figcaption style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--fg-muted,#6F6867)", letterSpacing: "0.02em", lineHeight: 1.55, marginTop: 7 }}>{caption}</figcaption>
    </figure>
  );

  const stepRow = (n, text) => (
    <li style={{ display: "flex", gap: 12 }}>
      <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--accent,#E9826A)", color: "#fff",
        fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, display: "grid", placeItems: "center" }}>{n}</span>
      <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--fg,#3E3F3F)", lineHeight: 1.6, letterSpacing: "0.01em", paddingTop: 2 }}>{text}</span>
    </li>
  );

  const head = (label) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--sans)", fontSize: 9.5, letterSpacing: "0.2em",
      textTransform: "uppercase", color: "var(--fg-muted,#6F6867)", fontWeight: 600, marginBottom: 12 }}>
      <Sparkle size={11} color="var(--accent,#E9826A)" /> {label}
    </div>
  );

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 440, overflowY: "auto", WebkitOverflowScrolling: "touch",
      background: "rgba(62,63,63,.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", padding: "22px 16px 40px",
      opacity: show ? 1 : 0, transition: "opacity .36s var(--ease)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(460px,100%)", margin: "0 auto", background: "var(--surface,#fff)",
        borderRadius: 28, padding: "clamp(22px,5vw,30px)", boxShadow: "0 28px 80px rgba(62,63,63,.10)",
        transform: show ? "none" : "translateY(14px)", transition: "transform .36s var(--ease)" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 26, color: "var(--fg,#3E3F3F)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              {es ? "Tu código está en los mensajes de Airbnb" : "Your code is in your Airbnb messages"}
            </div>
            <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--fg-muted,#6F6867)", lineHeight: 1.7, letterSpacing: "0.02em", margin: "10px 0 0", textWrap: "pretty" }}>
              {es ? "No está en “My trips”: ahí solo verás la información general del espacio. Te lo enviamos por mensaje, y hay dos formas de llegar a esa conversación."
                  : "It isn't under “My trips” — that only shows general info about the space. We send it by message, and there are two ways to reach that conversation."}
            </p>
          </div>
          <button onClick={close} aria-label={es ? "Cerrar" : "Close"}
            style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 12, border: "1px solid var(--warm-grey,#D8D4CE)",
              background: "var(--surface,#fff)", cursor: "pointer", display: "grid", placeItems: "center" }}>
            <Icon name="x" size={16} color="var(--fg-muted,#6F6867)" />
          </button>
        </div>

        {/* Camino 1 */}
        <div style={{ marginTop: 24, borderTop: "1px solid var(--warm-grey,#D8D4CE)", paddingTop: 20 }}>
          {head(es ? "Opción 1 · la más rápida" : "Option 1 · fastest")}
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {stepRow(1, es ? "En el menú de navegación de Airbnb toca “Mensajes”." : "In Airbnb's navigation menu, tap “Messages”.")}
            {stepRow(2, es ? "Busca la conversación con nosotros y ahí encontrarás tu código." : "Find the conversation with us — your code is there.")}
          </ol>
          {shot(AIRBNB_SHOTS.m1, es ? "En “Mensajes” busca la conversación con Spacio AM: ahí te dejamos tu código." : "Under “Messages”, find the conversation with Spacio AM — your code is there.")}
        </div>

        {/* Camino 2 */}
        <div style={{ marginTop: 24, borderTop: "1px solid var(--warm-grey,#D8D4CE)", paddingTop: 20 }}>
          {head(es ? "Opción 2 · desde tu estadía" : "Option 2 · from your stay")}
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {stepRow(1, es ? "Entra a “My trips” y selecciona tu estadía." : "Open “My trips” and select your stay.")}
            {stepRow(2, es ? "Toca la foto del anuncio: te lleva a “Your stay”." : "Tap the listing photo — it takes you to “Your stay”.")}
            {stepRow(3, es ? "Abajo toca “Message your host”: ahí está la conversación con tu código." : "Tap “Message your host” — that's the conversation with your code.")}
          </ol>
          {shot(AIRBNB_SHOTS.m2a, es ? "En “My trips”, toca la foto del anuncio de tu estadía." : "In “My trips”, tap your stay's listing photo.")}
          {shot(AIRBNB_SHOTS.m2b, es ? "En “Your stay”, baja hasta “Message your host”." : "In “Your stay”, scroll down to “Message your host”.")}
        </div>

        <div style={{ marginTop: 22, display: "flex", gap: 10, alignItems: "flex-start", background: "var(--beige-soft,#F5F3F0)", borderRadius: 14, padding: "14px 16px" }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="mail" size={15} color="var(--accent,#E9826A)" /></span>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--fg,#3E3F3F)", lineHeight: 1.65, margin: 0, letterSpacing: "0.01em" }}>
            {es ? "Si no lo encuentras, escríbenos por WhatsApp y te lo pasamos de una vez." : "If you can't find it, message us on WhatsApp and we'll send it right over."}
          </p>
        </div>

        <button onClick={close} className="sp-btn"
          style={{ width: "100%", marginTop: 18, background: "var(--fg,#3E3F3F)", color: "var(--bg,#FAFAFA)", border: "none", borderRadius: 999,
            padding: "14px", fontFamily: "var(--sans)", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", fontWeight: 500 }}>
          {es ? "Entendido" : "Got it"}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { TutorialFab, GuestTour, AirbnbCodeHelp, AirbnbCodeTutorial, tourState, saveTourState });
