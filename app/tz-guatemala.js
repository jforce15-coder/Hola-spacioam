/* Zona horaria fija: America/Guatemala (UTC-6, sin horario de verano).
   Toda la app calcula y muestra fechas en hora de Guatemala, sin importar
   la zona del dispositivo. Se carga antes que cualquier otro script. */
(function(){
  if (window.__saTZ) return; window.__saTZ = 1;
  var TZ = "America/Guatemala", OFF = 6 * 3600000, N = Date, P = N.prototype;
  var U = { t: P.getTime, st: P.setTime, Y: P.getUTCFullYear, M: P.getUTCMonth, D: P.getUTCDate, d: P.getUTCDay, h: P.getUTCHours, m: P.getUTCMinutes, s: P.getUTCSeconds, ms: P.getUTCMilliseconds,
    sY: P.setUTCFullYear, sM: P.setUTCMonth, sD: P.setUTCDate, sh: P.setUTCHours, sm: P.setUTCMinutes, ss: P.setUTCSeconds, sms: P.setUTCMilliseconds };
  var ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,3})\d*)?)?$/;
  function parseStr(s) {
    var m = ISO_LOCAL.exec(String(s).trim());
    if (m) return N.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), +((m[7] || "0") + "00").slice(0, 3)) + OFF;
    return N.parse(s);
  }
  function GTDate(a, b, c, d, e, f, g) {
    var n = arguments.length;
    if (!(this instanceof GTDate)) return new N().toString();
    var t;
    if (n === 0) t = N.now();
    else if (n === 1) t = (typeof a === "string") ? parseStr(a) : U.t.call(new N(a instanceof N ? U.t.call(a) : a));
    else t = N.UTC(a, b, n > 2 ? c : 1, n > 3 ? d : 0, n > 4 ? e : 0, n > 5 ? f : 0, n > 6 ? g : 0) + OFF;
    return new N(t);
  }
  GTDate.prototype = P; GTDate.now = N.now; GTDate.UTC = N.UTC;
  GTDate.parse = function (s) { return typeof s === "string" ? parseStr(s) : N.parse(s); };
  function sh(x) { return new N(U.t.call(x) - OFF); }
  [["getFullYear","Y"],["getMonth","M"],["getDate","D"],["getDay","d"],["getHours","h"],["getMinutes","m"],["getSeconds","s"],["getMilliseconds","ms"]].forEach(function (p) {
    var fn = U[p[1]]; P[p[0]] = function () { return fn.call(sh(this)); };
  });
  [["setFullYear","sY"],["setMonth","sM"],["setDate","sD"],["setHours","sh"],["setMinutes","sm"],["setSeconds","ss"],["setMilliseconds","sms"]].forEach(function (p) {
    var fn = U[p[1]];
    P[p[0]] = function () { var x = sh(this); fn.apply(x, arguments); var t = U.t.call(x); return U.st.call(this, isNaN(t) ? NaN : t + OFF); };
  });
  P.getTimezoneOffset = function () { return isNaN(U.t.call(this)) ? NaN : 360; };
  ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"].forEach(function (k) {
    var o = P[k]; P[k] = function (loc, opt) { var x = {}; for (var i in (opt || {})) x[i] = opt[i]; if (!x.timeZone) x.timeZone = TZ; return o.call(this, loc, x); };
  });
  if (window.Intl && Intl.DateTimeFormat) {
    var DTF = Intl.DateTimeFormat;
    var W = function (loc, opt) { var x = {}; for (var i in (opt || {})) x[i] = opt[i]; if (!x.timeZone) x.timeZone = TZ; return new DTF(loc, x); };
    W.prototype = DTF.prototype; W.supportedLocalesOf = DTF.supportedLocalesOf;
    Intl.DateTimeFormat = W;
  }
  window.Date = GTDate;
  window.SA_TZ = TZ;
})();
