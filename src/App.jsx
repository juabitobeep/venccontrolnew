/* eslint-disable */
import { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPA_URL = "https://syexfyalggndghrajlgt.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZXhmeWFsZ2duZGdocmFqbGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MDk0MTAsImV4cCI6MjEwMDA4NTQxMH0.2eKW6iRPoIQVp4dNZGaH_N_6rr3eySsMYtc0OiuqZPE";

const supaFetch = async (path, opts={}) => {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "return=representation",
      ...opts.headers
    },
    ...opts
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const db = {
  getProductos:  ()  => supaFetch("/productos?order=created_at.desc"),
  addProducto:   (p) => supaFetch("/productos", { method:"POST", body:JSON.stringify(p) }),
  updateProducto:(id,changes) => supaFetch(`/productos?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(changes), prefer:"return=minimal" }),
  deleteProducto:(id) => supaFetch(`/productos?id=eq.${id}`, { method:"DELETE", prefer:"return=minimal" }),
  getHistorial:  ()  => supaFetch("/historial?order=created_at.desc"),
  addHistorial:  (h) => supaFetch("/historial", { method:"POST", body:JSON.stringify(h) }),
  clearHistorial:()  => supaFetch("/historial?id=not.is.null", { method:"DELETE", prefer:"return=minimal" }),
  getFrecuentes: ()  => supaFetch("/frecuentes?order=veces.desc"),
  upsertFrecuente:(f) => supaFetch("/frecuentes", { method:"POST", prefer:"resolution=merge-duplicates", body:JSON.stringify(f) }),
  deleteFrecuente:(codigo) => supaFetch(`/frecuentes?codigo=eq.${encodeURIComponent(codigo)}`, { method:"DELETE", prefer:"return=minimal" }),
};

// Mapear filas de Supabase (snake_case) a los campos que usa la app (camelCase)
const mapProd = (p) => ({
  id: p.id, codigo: p.codigo, descripcion: p.descripcion, categoria: p.categoria || "", vencimiento: p.vencimiento,
  fechaCarga: p.fecha_carga, enGondola: p.en_gondola || false,
  stockLiquida: p.stock_liquida || "", pasadoLiquida: p.pasado_liquida || false, dap: p.dap || false,
});
const mapHist = (h) => ({ ...h, fechaRetiro: h.fecha_retiro });

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = "BD3SCKpdZa_vR_805zsq6h0jOny-hQkkXA8_86JKRB-dnolFsVpaXDhqBbIdMYzf5lQLrjThMd0gjsJlvWYZwgU";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function suscribirPush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await supaFetch("/push_subscriptions", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: JSON.stringify({ endpoint: sub.endpoint, subscription: sub.toJSON() })
    });
  } catch(e) {
    console.error("Error suscripción push:", e);
  }
}

// ─── Tema claro / oscuro ──────────────────────────────────────────────────────
const ThemeCtx = createContext("dark");
const useTheme = () => useContext(ThemeCtx);

const DARK = {
  bg0:"#0d1117", bg1:"#161b22", bg2:"#0d1117",
  border:"#1e2d3d", border2:"#2a3d52",
  text:"#e6edf3", textSub:"#8b949e", textMuted:"#555", textFaint:"#444",
  headerBg:"rgba(13,17,23,.96)", navBg:"rgba(13,17,23,.97)",
  inputBg:"#0d1117", cardBg:"#161b22",
  searchBg:"#161b22", toggleOff:"#1e2d3d", toggleThumb:"#555",
  weekCountBg:"#1e2d3d", weekCountColor:"#555",
  modalBg:"#161b22", modalOverlay:"rgba(0,0,0,.78)",
  btnSecBg:"#1e2d3d", btnMotivoBg:"#1e2d3d", btnMotivoColor:"#ccc",
  configBlockBg:"#0d1117",
};

const LIGHT = {
  bg0:"#f0f4f8", bg1:"#ffffff", bg2:"#f8fafc",
  border:"#dde3ea", border2:"#c8d0da",
  text:"#0d1117", textSub:"#4a5568", textMuted:"#718096", textFaint:"#a0aec0",
  headerBg:"rgba(240,244,248,.97)", navBg:"rgba(255,255,255,.97)",
  inputBg:"#f8fafc", cardBg:"#ffffff",
  searchBg:"#ffffff", toggleOff:"#dde3ea", toggleThumb:"#a0aec0",
  weekCountBg:"#e2e8f0", weekCountColor:"#718096",
  modalBg:"#ffffff", modalOverlay:"rgba(0,0,0,.45)",
  btnSecBg:"#e2e8f0", btnMotivoBg:"#e2e8f0", btnMotivoColor:"#2d3748",
  configBlockBg:"#f8fafc",
};

const getThemeColors = (mode) => mode === "light" ? LIGHT : DARK;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];

const diffDays = (dateStr) => {
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((new Date(dateStr + "T00:00:00") - now) / 86400000);
};

const getStatus = (days, diasLiquida, diasRetiro) => {
  if (days < 0)            return "vencido";
  if (days <= diasRetiro)  return "retiro";
  if (days <= diasLiquida) return "liquida";
  return "ok";
};

const getSaludo = () => {
  const h = new Date().getHours();
  if (h >= 6  && h < 12) return "¡Buenos días";
  if (h >= 12 && h < 19) return "¡Buenas tardes";
  return "¡Buenas noches";
};

const fmtDate = (d) => {
  if (!d) return "—";
  const [y,m,dd] = d.split("-");
  return `${dd}/${m}/${y}`;
};

// Semana ISO del año para agrupar por semana
const getWeekLabel = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const days = diffDays(dateStr);
  if (days < 0)  return "⛔ Vencidos";
  if (days <= 7)  return "📌 Esta semana";
  if (days <= 14) return "📅 Semana que viene";
  if (days <= 30) return "🗓️ Este mes";
  return "✅ Más de 30 días";
};

const WEEK_ORDER = ["⛔ Vencidos","📌 Esta semana","📅 Semana que viene","🗓️ Este mes","✅ Más de 30 días"];

const SM = {
  ok:      { label:"OK",                color:"#00e676", bg:"#002a12", icon:"✅", desc:"En góndola" },
  liquida: { label:"LIQUIDA",           color:"#ffd600", bg:"#2a2200", icon:"🏷️", desc:"Mandar a Liquida" },
  retiro:  { label:"RETIRO ANTICIPADO", color:"#ff6b00", bg:"#2a1200", icon:"⚠️", desc:"Retirar de góndola" },
  vencido: { label:"VENCIDO",           color:"#ff2d55", bg:"#2a0010", icon:"💀", desc:"Vencido" },
};

const SECTORES = ["Lácteos","Fiambres","Congelados","Panadería","Bebidas","Limpieza","Perfumería","Otro"];
const CATEGORIAS_PRODUCTO = [
  "Aguas", "Aguas saborizadas", "Aguas con gas", "Gaseosas", "Sodas",
  "Snacks", "Jugos líquidos", "Jugos en polvo", "Amargos", "Aperitivos",
  "Energizantes", "Cervezas", "Otro"
];
const AVATAR_SEEDS = ["Simba","Luna","Rocky","Nina","Max","Coco","Toby","Mia","Leo"];
const avatarUrl = (seed) => `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=00e5ff,ffd600,ff6b00,00e676`;
const DEFAULT_CONFIG = { diasLiquida: 30, diasRetiro: 15, sector: "Lácteos" };

// ─── localStorage helpers (solo para preferencias locales: tema, nombre, config) ──
const lsGet = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ─── Detectar OS / Browser ────────────────────────────────────────────────────
const getOS = () => { const u = navigator.userAgent; return /iPad|iPhone|iPod/.test(u) ? "ios" : /Android/.test(u) ? "android" : "other"; };
const getBrowser = () => { const u = navigator.userAgent; return /SamsungBrowser/.test(u) ? "samsung" : /Chrome/.test(u) ? "chrome" : /Firefox/.test(u) ? "firefox" : /Safari/.test(u) ? "safari" : "other"; };

// ════════════════════════════════════════════════════════════════════════════════
// PANTALLA DE BIENVENIDA (onboarding)
// ════════════════════════════════════════════════════════════════════════════════
function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh", background: "#0d0d0d", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 42, height: 42, border: "3px solid #1e2d3d", borderTop: "3px solid #00e5ff",
        borderRadius: "50%", animation: "spin .8s linear infinite",
      }} />
      <span style={{ color: "#8b949e", fontSize: 14, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
        Cargando productos...
      </span>
    </div>
  );
}
function WelcomeScreen({ onComplete }) {
  const tema = useTheme(); const T = getThemeColors(tema);
  const [nombre, setNombre] = useState("");
  const [error, setError]   = useState("");
  const go = () => { if (!nombre.trim()) { setError("Escribí tu nombre para continuar"); return; } onComplete(nombre.trim()); };
  return (
    <div style={{...W.root, background:T.bg0}}>
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;} input,select,textarea{font-family:inherit;}`}</style>
      <div style={W.content}>
        <div style={W.logoWrap}><span style={{ fontSize:52, position:"relative", zIndex:1 }}>📦</span><div style={W.ring}/></div>
        <h1 style={{...W.title, color:T.text}}>VencControl</h1>
        <p style={W.sub}>Control de vencimientos para repositores</p>
        <div style={{...W.card, background:T.bg1, borderColor:T.border}}>
          <p style={{ margin:0, fontWeight:800, fontSize:18, color:"#e6edf3", textAlign:"center" }}>¿Cómo te llamás?</p>
          <p style={{ margin:0, fontSize:13, color:"#666", textAlign:"center" }}>Lo usaremos para personalizar la app</p>
          <input autoFocus style={W.input} placeholder="Tu nombre o apodo..." value={nombre} maxLength={30}
            onChange={e => { setNombre(e.target.value); setError(""); }} onKeyDown={e => e.key==="Enter" && go()} />
          {error && <div style={W.error}>⚠️ {error}</div>}
          <button style={W.btn} onClick={go}>Empezar →</button>
        </div>
        <p style={{ fontSize:11, color:"#333", textAlign:"center" }}>Podés cambiar tu nombre en Configuración</p>
      </div>
    </div>
  );
}
const W = {
  root:    { minHeight:"100vh", background:"#0d1117", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'DM Sans','Segoe UI',sans-serif" },
  content: { width:"100%", maxWidth:360, display:"flex", flexDirection:"column", alignItems:"center", gap:16, animation:"fadeInUp .5s ease" },
  logoWrap:{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center", width:84, height:84 },
  ring:    { position:"absolute", inset:0, borderRadius:"50%", background:"rgba(0,229,255,0.07)", border:"1px solid rgba(0,229,255,0.18)" },
  title:   { margin:0, fontSize:34, fontWeight:900, color:"#e6edf3", letterSpacing:-1 },
  sub:     { margin:0, fontSize:13, color:"#555", textAlign:"center" },
  card:    { width:"100%", background:"#161b22", border:"1px solid #1e2d3d", borderRadius:16, padding:"24px 20px", display:"flex", flexDirection:"column", gap:12 },
  input:   { width:"100%", background:"#0d1117", border:"1px solid #1e2d3d", borderRadius:10, color:"#e6edf3", padding:14, fontSize:18, outline:"none", textAlign:"center", fontWeight:700 },
  error:   { background:"rgba(255,45,85,.1)", border:"1px solid #ff2d55", color:"#ff6b7a", borderRadius:8, padding:"8px 12px", fontSize:13, textAlign:"center" },
  btn:     { background:"linear-gradient(135deg,#00e5ff,#00b4d8)", border:"none", borderRadius:10, padding:14, fontWeight:800, fontSize:16, cursor:"pointer", color:"#0d1117", marginTop:4 },
};

// ════════════════════════════════════════════════════════════════════════════════
// PANEL DE RESUMEN DEL DÍA
// ════════════════════════════════════════════════════════════════════════════════
function DaySummary({ productos, config, nombre, onClose }) {
  const tema = useTheme(); const T = getThemeColors(tema);
  const counts = { ok:0, liquida:0, retiro:0, vencido:0 };
  productos.forEach(p => counts[getStatus(diffDays(p.vencimiento), config.diasLiquida, config.diasRetiro)]++);
  const urgentes = counts.retiro + counts.vencido;
  return (
    <div style={DS.overlay}>
      <div style={{...DS.box, background:T.bg1, borderColor:T.border}}>
        <div style={DS.greeting}>
          <span style={{ fontSize:32 }}>👋</span>
          <div>
            <div style={DS.greetingName}>{getSaludo()}, {nombre}!</div>
            <div style={DS.greetingDate}>{new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</div>
          </div>
        </div>

        {urgentes > 0 && (
          <div style={DS.alertRow}>
            <span style={{ fontSize:20 }}>🚨</span>
            <span style={{ color:"#ff6b00", fontWeight:700, fontSize:14 }}>
              Tenés {urgentes} producto{urgentes>1?"s":""} urgente{urgentes>1?"s":""} hoy
            </span>
          </div>
        )}
        {urgentes === 0 && counts.liquida > 0 && (
          <div style={{ ...DS.alertRow, background:"rgba(255,214,0,.08)", borderColor:"rgba(255,214,0,.25)" }}>
            <span style={{ fontSize:20 }}>🏷️</span>
            <span style={{ color:"#ffd600", fontWeight:700, fontSize:14 }}>
              Tenés {counts.liquida} producto{counts.liquida>1?"s":""} para Liquida
            </span>
          </div>
        )}
        {urgentes === 0 && counts.liquida === 0 && (
          <div style={{ ...DS.alertRow, background:"rgba(0,230,118,.06)", borderColor:"rgba(0,230,118,.2)" }}>
            <span style={{ fontSize:20 }}>✅</span>
            <span style={{ color:"#00e676", fontWeight:700, fontSize:14 }}>¡Todo en orden por hoy!</span>
          </div>
        )}

        <div style={DS.statsGrid}>
          {Object.entries(counts).map(([s, n]) => (
            <div key={s} style={{ ...DS.statBox, borderColor:SM[s].color, background:SM[s].bg }}>
              <span style={{ fontSize:20 }}>{SM[s].icon}</span>
              <span style={{ fontSize:26, fontWeight:900, color:SM[s].color, lineHeight:1 }}>{n}</span>
              <span style={{ fontSize:10, color:"#666", fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>
                {s==="liquida"?"Liquida":s==="retiro"?"Retiro":SM[s].label}
              </span>
            </div>
          ))}
        </div>

        <button style={DS.btn} onClick={onClose}>Ir a la lista →</button>
      </div>
    </div>
  );
}
const DS = {
  overlay:      { position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" },
  box:          { background:"#161b22", border:"1px solid #1e2d3d", borderRadius:20, padding:"28px 20px 32px", width:"92%", maxWidth:480, display:"flex", flexDirection:"column", gap:16, animation:"popIn .3s ease" },
  greeting:     { display:"flex", gap:14, alignItems:"center" },
  greetingName: { fontWeight:800, fontSize:20, color:"#e6edf3" },
  greetingDate: { fontSize:12, color:"#555", textTransform:"capitalize", marginTop:2 },
  alertRow:     { display:"flex", gap:10, alignItems:"center", background:"rgba(255,107,0,.06)", border:"1px solid rgba(255,107,0,.2)", borderRadius:10, padding:"10px 14px" },
  statsGrid:    { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 },
  statBox:      { border:"1px solid", borderRadius:10, padding:"10px 4px", display:"flex", flexDirection:"column", alignItems:"center", gap:3 },
  btn:          { background:"linear-gradient(135deg,#00e5ff,#00b4d8)", border:"none", borderRadius:10, padding:14, fontWeight:800, fontSize:15, cursor:"pointer", color:"#0d1117" },
};

// ════════════════════════════════════════════════════════════════════════════════
// CÁMARA SCANNER
// ════════════════════════════════════════════════════════════════════════════════
function CameraErrorGuide({ errorType, onRetry }) {
  const os=getOS(), browser=getBrowser();
  const [nivel, setNivel] = useState(1);
  const n1 = {
    android:{ chrome:{intro:"Probá desde Chrome:",steps:["Tocá el candado 🔒 en la barra de dirección","Tocá \"Permisos\"","Cambiá \"Cámara\" a \"Permitir\"","Recargá la página"]},
      samsung:{intro:"Desde Samsung Browser:",steps:["Tocá el menú ☰","\"Configuración\" → \"Sitios y descargas\" → \"Permisos del sitio\"","Buscá este sitio y habilitá \"Cámara\""]},
      firefox:{intro:"Desde Firefox:",steps:["Tocá el candado 🔒","\"Editar permisos del sitio\"","Cambiá \"Cámara\" a \"Permitir\"","Recargá la página"]},
      other:{intro:"Desde la barra de dirección:",steps:["Tocá el candado o ⓘ","Buscá \"Permisos\"","Habilitá \"Cámara\"","Recargá"]}},
    ios:{ safari:{intro:"Desde Safari:",steps:["Tocá Aa en la barra","\"Configuración del sitio web\"","Cambiá \"Cámara\" a \"Permitir\"","Recargá"]},
      chrome:{intro:"Chrome en iPhone requiere ir a Ajustes:",steps:[],skipToLevel2:true},
      other:{intro:"Desde la barra:",steps:["Tocá Aa o ⓘ","\"Configuración del sitio\"","Habilitá \"Cámara\"","Recargá"]}},
  };
  const n2 = {
    android:{ chrome:{app:"Chrome",steps:["Abrí \"Ajustes\" del teléfono","\"Aplicaciones\" → \"Chrome\"","\"Permisos\" → \"Cámara\" → \"Permitir\"","Volvé y reabrí el escáner"]},
      samsung:{app:"Samsung Internet",steps:["Abrí \"Ajustes\"","\"Aplicaciones\" → \"Samsung Internet\"","\"Permisos\" → \"Cámara\" → \"Permitir\"","Volvé y reabrí"]},
      firefox:{app:"Firefox",steps:["Abrí \"Ajustes\"","\"Aplicaciones\" → \"Firefox\"","\"Permisos\" → \"Cámara\" → \"Permitir\"","Volvé y reabrí"]},
      other:{app:"el navegador",steps:["Abrí \"Ajustes\"","\"Aplicaciones\" → buscá tu navegador","\"Permisos\" → \"Cámara\" → \"Permitir\"","Volvé y reabrí"]}},
    ios:{ safari:{app:"Safari",steps:["Abrí \"Configuración\"","Bajá a \"Safari\"","\"Cámara\" → \"Permitir\"","Volvé y reabrí"]},
      chrome:{app:"Chrome",steps:["Abrí \"Configuración\"","Bajá hasta \"Chrome\"","Activá el interruptor de \"Cámara\"","Volvé y reabrí"]},
      other:{app:"el navegador",steps:["Abrí \"Configuración\"","Buscá tu navegador","Activá \"Cámara\"","Volvé y reabrí"]}},
    other:{ other:{app:"el navegador",steps:["Abrí la Configuración del sistema","Aplicaciones → tu navegador","Permisos → Cámara → Permitir","Volvé y reabrí"]}},
  };
  const otros = {
    notfound:{ icon:"📷", title:"No se encontró cámara", steps:["Asegurate de que el celular tenga cámara","Cerrá otras apps que usen la cámara","Reiniciá el navegador"], tip:"Podés ingresar el código manualmente." },
    insecure:{ icon:"🔐", title:"Conexión no segura (HTTP)", steps:["La URL debe empezar con \"https://\"","Con http:// la cámara no puede funcionar","Pedile al admin que active HTTPS"], tip:"Mientras tanto usá el ingreso manual." },
    unknown:{ icon:"❌", title:"Error inesperado", steps:["Cerrá otras apps que usen la cámara","Recargá la página","Reiniciá el celular si sigue fallando"], tip:"También podés ingresar el código a mano." },
  };
  if (errorType !== "denied") {
    const g = otros[errorType]||otros.unknown;
    return (<div style={sc.errorGuide}><div style={{fontSize:40,marginBottom:6}}>{g.icon}</div><div style={sc.errorTitle}>{g.title}</div>
      <div style={sc.stepsList}>{g.steps.map((s,i)=><div key={i} style={sc.stepRow}><span style={sc.stepNum}>{i+1}</span><span style={sc.stepText}>{s}</span></div>)}</div>
      {g.tip&&<div style={sc.tipBox}>💡 {g.tip}</div>}
      {errorType!=="insecure"&&<button style={{...sc.ctrlBtn,marginTop:18,width:"100%"}} onClick={onRetry}>🔄 Reintentar</button>}
    </div>);
  }
  const byOS1=(n1[os]||n1.android), g1=byOS1[browser]||byOS1.other;
  const byOS2=(n2[os]||n2.other),   g2=byOS2[browser]||byOS2.other;
  return (
    <div style={sc.errorGuide}>
      <div style={{fontSize:40,marginBottom:6}}>🔒</div>
      <div style={sc.errorTitle}>Cámara bloqueada</div>
      {nivel===1&&!g1?.skipToLevel2&&<>
        <div style={sc.errorIntro}>{g1.intro}</div>
        <div style={sc.stepsList}>{g1.steps.map((s,i)=><div key={i} style={sc.stepRow}><span style={sc.stepNum}>{i+1}</span><span style={sc.stepText}>{s}</span></div>)}</div>
        <button style={{...sc.ctrlBtn,marginTop:18,width:"100%"}} onClick={onRetry}>🔄 Ya lo habilité — Reintentar</button>
        <button style={sc.btnNivel2} onClick={()=>setNivel(2)}>El candado no funciona o no aparece →</button>
      </>}
      {(nivel===2||g1?.skipToLevel2)&&<>
        <div style={sc.errorIntro}>{g1?.skipToLevel2?"Hay que ir a los Ajustes del iPhone:":"Hay que ir a los Ajustes del celular:"}</div>
        <div style={sc.osBadge}>{os==="ios"?"🍎 iPhone":"🤖 Android"} · {browser==="chrome"?"Chrome":browser==="samsung"?"Samsung Browser":browser==="firefox"?"Firefox":browser==="safari"?"Safari":"Navegador"}</div>
        <div style={sc.stepsList}>{g2.steps.map((s,i)=><div key={i} style={{...sc.stepRow,borderColor:"#ff6b0044",background:"#1a0d00"}}><span style={{...sc.stepNum,background:"#ff6b00",color:"#000"}}>{i+1}</span><span style={sc.stepText}>{s}</span></div>)}</div>
        <div style={sc.tipBox}>💡 Buscá "{g2.app}" en la lista de apps de Ajustes.</div>
        <button style={{...sc.ctrlBtn,marginTop:18,width:"100%"}} onClick={onRetry}>🔄 Ya lo habilité — Reintentar</button>
        {nivel===2&&<button style={sc.btnNivel2} onClick={()=>setNivel(1)}>← Volver</button>}
      </>}
    </div>
  );
}

function CameraScanner({ onDetected, onClose }) {
  const videoRef=useRef(null), canvasRef=useRef(null), streamRef=useRef(null);
  const rafRef=useRef(null), detectedRef=useRef(false), readerRef=useRef(null);
  const [phase, setPhase]         = useState("starting");
  const [errorType, setErrorType] = useState("");
  const [manualCod, setManualCod] = useState("");
  const [hasTorch, setHasTorch]   = useState(false);
  const [torchOn, setTorchOn]     = useState(false);
  const [camCount, setCamCount]   = useState(1);
  const [facingEnv, setFacingEnv] = useState(true);

  const stopAll = () => {
    cancelAnimationFrame(rafRef.current);
    if (readerRef.current) { try { readerRef.current.reset(); } catch {} readerRef.current=null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; }
  };

  const startCamera = async (envFacing=true) => {
    stopAll(); detectedRef.current=false; setPhase("starting"); setErrorType("");
    // eslint-disable-next-line no-restricted-globals
    if (window.location.protocol!=="https:"&&window.location.hostname!=="localhost") { setErrorType("insecure"); setPhase("error"); return; }
    const constraints = { video:{ facingMode: envFacing?{ideal:"environment"}:{ideal:"user"}, width:{ideal:1280}, height:{ideal:720} } };
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia(constraints); }
    catch(e) {
      try { stream = await navigator.mediaDevices.getUserMedia({video:true}); }
      catch(e2) {
        setErrorType(e2.name==="NotAllowedError"||e2.name==="PermissionDeniedError"?"denied":e2.name==="NotFoundError"?"notfound":"unknown");
        setPhase("error"); return;
      }
    }
    streamRef.current=stream;
    try { const devs=await navigator.mediaDevices.enumerateDevices(); setCamCount(devs.filter(d=>d.kind==="videoinput").length); } catch {}
    try { const caps=stream.getVideoTracks()[0].getCapabilities?.()||{}; if(caps.torch) setHasTorch(true); } catch {}
    if (videoRef.current) {
      videoRef.current.srcObject=stream;
      videoRef.current.onloadedmetadata=()=>videoRef.current.play().then(()=>{ setPhase("scanning"); startDecoding(); }).catch(()=>setPhase("scanning"));
    }
  };

  const startDecoding = () => {
    if ("BarcodeDetector" in window) {
      const det = new window.BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","qr_code"]});
      const tick = async () => {
        if (detectedRef.current||!videoRef.current) return;
        if (videoRef.current.readyState===videoRef.current.HAVE_ENOUGH_DATA) {
          try { const r=await det.detect(videoRef.current); if(r.length>0&&!detectedRef.current){ detectedRef.current=true; navigator.vibrate?.(120); stopAll(); onDetected(r[0].rawValue); return; } } catch {}
        }
        rafRef.current=requestAnimationFrame(tick);
      };
      rafRef.current=requestAnimationFrame(tick); return;
    }
    const tryZXing=()=>{
      try {
        const Z=window.ZXing; if(!Z){setPhase("manual");return;}
        const h=new Map(); h.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.CODE_128]); h.set(Z.DecodeHintType.TRY_HARDER,true);
        const reader=new Z.BrowserMultiFormatReader(h); readerRef.current=reader;
        const canvas=canvasRef.current, ctx=canvas?.getContext("2d"); if(!canvas||!ctx){setPhase("manual");return;}
        const tick=()=>{
          if(detectedRef.current||!videoRef.current) return;
          if(videoRef.current.readyState===videoRef.current.HAVE_ENOUGH_DATA){
            canvas.width=videoRef.current.videoWidth; canvas.height=videoRef.current.videoHeight; ctx.drawImage(videoRef.current,0,0);
            try { const l=new Z.HTMLCanvasElementLuminanceSource(canvas),b=new Z.BinaryBitmap(new Z.HybridBinarizer(l)),r=reader.decode(b); if(r&&!detectedRef.current){detectedRef.current=true;navigator.vibrate?.(120);stopAll();onDetected(r.getText());return;} } catch {}
          }
          rafRef.current=requestAnimationFrame(tick);
        };
        rafRef.current=requestAnimationFrame(tick);
      } catch{setPhase("manual");}
    };
    if(window.ZXing){tryZXing();return;}
    if(!document.getElementById("zxing-cdn")){const s=document.createElement("script");s.id="zxing-cdn";s.src="https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.19.1/index.min.js";s.onload=tryZXing;s.onerror=()=>setPhase("manual");document.head.appendChild(s);}
    else{const w=setInterval(()=>{if(window.ZXing){clearInterval(w);tryZXing();}},200);setTimeout(()=>{clearInterval(w);if(!window.ZXing)setPhase("manual");},8000);}
  };

  const toggleTorch=async()=>{if(!streamRef.current)return;const t=streamRef.current.getVideoTracks()[0];try{await t.applyConstraints({advanced:[{torch:!torchOn}]});setTorchOn(x=>!x);}catch{}};
  const switchCamera=()=>{if(camCount<2)return;stopAll();detectedRef.current=false;const n=!facingEnv;setFacingEnv(n);startCamera(n);};
  useEffect(()=>{startCamera(true);return()=>stopAll();},[]);

  return (
    <div style={sc.overlay}>
      <div style={sc.header}><span style={{color:"#e6edf3",fontWeight:700,fontSize:15}}>📷 Escanear código de barras</span><button style={sc.closeBtn} onClick={()=>{stopAll();onClose();}}>✕</button></div>
      <div style={sc.viewfinder}>
        <video ref={videoRef} style={sc.video} playsInline muted autoPlay />
        <canvas ref={canvasRef} style={{display:"none"}}/>
        {phase==="scanning"&&<><div style={{...sc.corner,top:24,left:24,borderTop:"3px solid #00e5ff",borderLeft:"3px solid #00e5ff"}}/><div style={{...sc.corner,top:24,right:24,borderTop:"3px solid #00e5ff",borderRight:"3px solid #00e5ff"}}/><div style={{...sc.corner,bottom:24,left:24,borderBottom:"3px solid #00e5ff",borderLeft:"3px solid #00e5ff"}}/><div style={{...sc.corner,bottom:24,right:24,borderBottom:"3px solid #00e5ff",borderRight:"3px solid #00e5ff"}}/><div style={sc.scanLine}/><div style={sc.hintBox}>Apuntá al código de barras del producto</div></>}
        {phase==="starting"&&<div style={sc.centerOverlay}><div style={sc.spinner}/><span style={{color:"#aaa",fontSize:13,marginTop:14}}>Abriendo cámara...</span></div>}
        {phase==="error"&&<CameraErrorGuide errorType={errorType} onRetry={()=>startCamera(true)}/>}
        {phase==="manual"&&<div style={sc.centerOverlay}><span style={{fontSize:36}}>⌨️</span><p style={{color:"#ccc",fontSize:14,textAlign:"center",padding:"0 24px",marginTop:8}}>Ingresá el código manualmente:</p><input autoFocus style={sc.manualInput} placeholder="Código de barras..." value={manualCod} onChange={e=>setManualCod(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&manualCod.trim()){stopAll();onDetected(manualCod.trim());}}}/><button style={{...sc.ctrlBtn,marginTop:10}} onClick={()=>{if(manualCod.trim()){stopAll();onDetected(manualCod.trim());}}}>Confirmar</button></div>}
      </div>
      <div style={sc.controls}><div style={{display:"flex",gap:10}}>{camCount>1&&<button style={sc.ctrlBtnIcon} onClick={switchCamera}>🔄</button>}{hasTorch&&<button style={{...sc.ctrlBtnIcon,background:torchOn?"#ffd600":"#1a2533",color:torchOn?"#000":"#ccc"}} onClick={toggleTorch}>🔦</button>}<button style={{...sc.ctrlBtnSec,flex:1}} onClick={()=>setPhase("manual")}>✏️ Ingresar código manualmente</button></div></div>
    </div>
  );
}

const sc = {
  overlay:     { position:"fixed",inset:0,zIndex:300,background:"#000",display:"flex",flexDirection:"column" },
  header:      { display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",background:"rgba(0,0,0,.88)",borderBottom:"1px solid #111",flexShrink:0 },
  closeBtn:    { background:"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#e6edf3",padding:"6px 14px",cursor:"pointer",fontSize:16,fontWeight:700 },
  viewfinder:  { flex:1,position:"relative",overflow:"hidden",background:"#111" },
  video:       { width:"100%",height:"100%",objectFit:"cover",display:"block" },
  corner:      { position:"absolute",width:32,height:32 },
  scanLine:    { position:"absolute",left:"6%",right:"6%",height:2,background:"linear-gradient(90deg,transparent,#00e5ff,transparent)",animation:"scanMove 1.8s ease-in-out infinite",boxShadow:"0 0 10px #00e5ff" },
  hintBox:     { position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,.72)",color:"#ccc",fontSize:12,padding:"6px 18px",borderRadius:20,whiteSpace:"nowrap",backdropFilter:"blur(8px)" },
  centerOverlay:{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.75)",padding:24 },
  spinner:     { width:40,height:40,border:"3px solid #111",borderTop:"3px solid #00e5ff",borderRadius:"50%",animation:"spin .8s linear infinite" },
  controls:    { padding:"13px 16px",background:"rgba(0,0,0,.92)",flexShrink:0 },
  ctrlBtn:     { background:"#0d1f2d",border:"1px solid #00e5ff",borderRadius:10,color:"#00e5ff",padding:"12px 16px",fontWeight:700,cursor:"pointer",fontSize:14,width:"100%" },
  ctrlBtnIcon: { background:"#1a2533",border:"1px solid #2a3d52",borderRadius:10,color:"#ccc",padding:"12px 16px",fontWeight:700,cursor:"pointer",fontSize:18,flexShrink:0 },
  ctrlBtnSec:  { background:"#161b22",border:"1px solid #1e2d3d",borderRadius:10,color:"#8b949e",padding:"12px 16px",fontWeight:700,cursor:"pointer",fontSize:14 },
  manualInput: { width:"100%",background:"#0d1117",border:"1px solid #2a3d52",borderRadius:10,color:"#e6edf3",padding:"13px 14px",fontSize:16,outline:"none",textAlign:"center",letterSpacing:1,maxWidth:280 },
  errorGuide:  { position:"absolute",inset:0,overflowY:"auto",display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 24px 20px",background:"rgba(13,17,23,.97)" },
  errorTitle:  { fontWeight:800,fontSize:18,color:"#e6edf3",marginBottom:6,textAlign:"center" },
  errorIntro:  { color:"#8b949e",fontSize:13,textAlign:"center",lineHeight:1.6,marginBottom:14 },
  stepsList:   { width:"100%",display:"flex",flexDirection:"column",gap:8 },
  stepRow:     { display:"flex",alignItems:"flex-start",gap:12,background:"#161b22",border:"1px solid #1e2d3d",borderRadius:10,padding:"10px 14px" },
  stepNum:     { background:"#00e5ff",color:"#000",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,flexShrink:0,marginTop:1 },
  stepText:    { color:"#ccc",fontSize:13,lineHeight:1.5 },
  tipBox:      { marginTop:12,background:"rgba(255,214,0,.07)",border:"1px solid rgba(255,214,0,.2)",borderRadius:10,padding:"10px 14px",color:"#ffd600",fontSize:12,lineHeight:1.6,width:"100%",textAlign:"left" },
  btnNivel2:   { marginTop:12,background:"transparent",border:"none",color:"#555",fontSize:12,cursor:"pointer",textDecoration:"underline",padding:"4px 0" },
  osBadge:     { background:"#1e2d3d",border:"1px solid #2a3d52",borderRadius:20,padding:"4px 14px",fontSize:11,color:"#8b949e",fontWeight:700,marginBottom:10,marginTop:4 },
};

// ════════════════════════════════════════════════════════════════════════════════
// MODAL NUEVO PRODUCTO
// ════════════════════════════════════════════════════════════════════════════════
function NuevoProductoModal({ codigo, onSave, onCancel, config, frecuentes, productos }) {
  const sugerido = frecuentes.find(f => f.codigo === codigo);
  const [descripcion, setDescripcion] = useState(sugerido?.descripcion || "");
  const [categoria, setCategoria]     = useState(sugerido?.categoria || "");
  const [fecha, setFecha]             = useState("");
  const [error, setError]             = useState("");
  const [confirmarDuplicado, setConfirmarDuplicado] = useState(false);

  const esDuplicado = codigo && fecha && (productos || []).some(p => p.codigo === codigo && p.vencimiento === fecha);

  const handleSave = () => {
    if (!descripcion.trim()) { setError("Escribí una descripción del producto"); return; }
    if (!fecha)               { setError("Seleccioná la fecha de vencimiento");  return; }
    if (esDuplicado && !confirmarDuplicado) { setError("⚠️ Ya existe un producto igual con esta fecha. Tocá 'Guardar' de nuevo para confirmar."); setConfirmarDuplicado(true); return; }
    setError("");
    onSave({ id:Date.now().toString(), codigo:codigo||"—", descripcion:descripcion.trim(), categoria:categoria, vencimiento:fecha, fechaCarga:todayStr() });
  };

  const days   = fecha ? diffDays(fecha) : null;
  const status = days !== null ? getStatus(days, config.diasLiquida, config.diasRetiro) : null;
  const meta   = status ? SM[status] : null;

  return (
    <div style={mo.overlay}>
      <div style={mo.box}>
        <div style={mo.codigoRow}>
          <span style={{fontSize:22}}>🔍</span>
          <div>
            <div style={mo.codigoLabel}>Código escaneado</div>
            <div style={mo.codigoVal}>{codigo||"Sin código"}</div>
          </div>
          {sugerido && <div style={mo.frecBadge}>⭐ Frecuente</div>}
        </div>

        <div style={mo.field}>
          <label style={mo.label}>Descripción del producto</label>
          <textarea autoFocus style={mo.textarea} placeholder={"Marca, nombre, gramaje...\nEj: Yogur Ser Frutilla 200g"} value={descripcion} onChange={e=>setDescripcion(e.target.value)} rows={3}/>
        </div>
        <div style={mo.field}>
          <label style={mo.label}>Categoría</label>
          <select style={mo.dateInput} value={categoria} onChange={e=>setCategoria(e.target.value)}>
            <option value="">Seleccioná una categoría...</option>
            {CATEGORIAS_PRODUCTO.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={mo.field}>
          <label style={mo.label}>Fecha de vencimiento</label>
          <input type="date" style={mo.dateInput} value={fecha} onChange={e=>setFecha(e.target.value)}/>
        </div>

        {meta&&<div style={{display:"flex",gap:10,alignItems:"center",border:`1px solid ${meta.color}`,background:meta.bg,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13}}>
          <span style={{fontSize:18}}>{meta.icon}</span>
          <span style={{color:meta.color,fontWeight:700}}>{status==="liquida"?"LIQUIDA":status==="retiro"?"RETIRO ANTICIPADO":meta.label}</span>
          <span style={{color:"#aaa",fontSize:12}}>{days===0?"Vence hoy":days<0?`Venció hace ${Math.abs(days)} días`:`Vence en ${days} días`}</span>
        </div>}

        {esDuplicado && !error && (
          <div style={{ background:"rgba(255,214,0,.1)", border:"1px solid #ffd600", color:"#b38f00", borderRadius:8, padding:"8px 12px", fontSize:13, marginBottom:12 }}>
            ⚠️ Ya existe un producto igual con esta fecha de vencimiento.
          </div>
        )}
        {error&&<div style={mo.error}>⚠️ {error}</div>}
        <div style={{display:"flex",gap:10}}>
          <button style={mo.btnPrimary} onClick={handleSave}>✓ Guardar</button>
          <button style={mo.btnSecondary} onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
const mo = {
  overlay:     { position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:250,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(6px)" },
  box:         { background:"#161b22",border:"1px solid #1e2d3d",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",width:"100%",maxWidth:480,animation:"slideUp .28s ease" },
  codigoRow:   { display:"flex",gap:12,alignItems:"center",background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:10,padding:"10px 14px",marginBottom:18 },
  codigoLabel: { fontSize:11,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:.5 },
  codigoVal:   { fontSize:15,fontWeight:800,color:"#00e5ff",fontFamily:"monospace",letterSpacing:1 },
  frecBadge:   { marginLeft:"auto",background:"rgba(255,214,0,.1)",border:"1px solid rgba(255,214,0,.3)",color:"#ffd600",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,flexShrink:0 },
  field:       { marginBottom:16 },
  label:       { display:"block",fontSize:12,fontWeight:700,color:"#8b949e",marginBottom:7,textTransform:"uppercase",letterSpacing:.5 },
  textarea:    { width:"100%",background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:10,color:"#e6edf3",padding:"12px 14px",fontSize:15,outline:"none",resize:"none",lineHeight:1.5,boxSizing:"border-box" },
  dateInput:   { width:"100%",background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:10,color:"#e6edf3",padding:"13px 14px",fontSize:16,outline:"none",boxSizing:"border-box" },
  error:       { background:"rgba(255,45,85,.1)",border:"1px solid #ff2d55",color:"#ff6b7a",borderRadius:8,padding:"8px 12px",fontSize:13,marginBottom:12 },
  btnPrimary:  { flex:1,background:"linear-gradient(135deg,#00e5ff,#00b4d8)",border:"none",borderRadius:10,padding:14,fontWeight:800,fontSize:15,cursor:"pointer",color:"#0d1117" },
  btnSecondary:{ background:"#1e2d3d",border:"1px solid #2a3d52",borderRadius:10,padding:"14px 18px",color:"#8b949e",fontWeight:700,fontSize:14,cursor:"pointer" },
};

// ════════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tema, setTema] = useState(() => localStorage.getItem("vc_tema") || "dark");
  const [showGuia, setShowGuia] = useState(false);
  const T = getThemeColors(tema);

  const [productos,  setProductos]  = useState([]);
  const [historial,  setHistorial]  = useState([]);
  const [frecuentes, setFrecuentes] = useState([]);
  const [config,     setConfig]     = useState(() => lsGet("vc_config", DEFAULT_CONFIG));
  const [nombre,     setNombre]     = useState(() => localStorage.getItem("vc_nombre") || "");
  const [avatar,    setAvatar]    = useState(() => localStorage.getItem("vc_avatar") || "");
  const [showWelcome,  setShowWelcome]  = useState(() => !localStorage.getItem("vc_nombre"));
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [showSummary,  setShowSummary]  = useState(false);
  const [view,         setView]         = useState("lista");
  const [vistaLista,   setVistaLista]   = useState(() => localStorage.getItem("vc_vista_lista") || "semana");
  const [scanning,     setScanning]     = useState(false);
  const [pendingCod,   setPendingCod]   = useState(null);
  const [filtro,       setFiltro]       = useState("todos");
  const [busqueda,     setBusqueda]     = useState("");
  const [toast,        setToast]        = useState(null);
  const [confirmDel,   setConfirmDel]   = useState(null);

  useEffect(()=>{ localStorage.setItem("vc_tema", tema); }, [tema]);
  useEffect(()=>{ lsSet("vc_config",     config);     }, [config]);
  useEffect(()=>{ localStorage.setItem("vc_vista_lista", vistaLista); }, [vistaLista]);
  useEffect(()=>{ if(nombre) localStorage.setItem("vc_nombre", nombre); }, [nombre]);
  useEffect(()=>{ localStorage.setItem("vc_avatar", avatar); }, [avatar]);

  // Suscribirse a notificaciones push cuando el usuario ya tiene nombre
  useEffect(()=>{ if (nombre) suscribirPush(); }, [nombre]);

  // Cargar datos desde Supabase al iniciar y sincronizar cada 30 segundos
  useEffect(()=>{
    const cargar = async (esInicial) => {
      try {
        const [prods, hist, frecs] = await Promise.all([db.getProductos(), db.getHistorial(), db.getFrecuentes()]);
        setProductos((prods || []).map(mapProd));
        setHistorial((hist || []).map(mapHist));
        setFrecuentes(frecs || []);
        if (esInicial && (prods || []).length > 0) setShowSummary(true);
      } catch(e) {
        console.error("Error al cargar datos:", e);
        if (esInicial) showToast("Error al cargar datos", "warn");
      } finally {
        if (esInicial) setCargandoInicial(false);
      }
    };
    if (!showWelcome) {
      cargar(true);
      const interval = setInterval(() => cargar(false), 30000);
      return () => clearInterval(interval);
    }
  }, [showWelcome]);

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  // ── Guardar producto ───────────────────────────────────────────────────────
  const handleSaveProducto = async (p) => {
    setProductos(prev => [p, ...prev]);
    setPendingCod(null);
    showToast("✓ Producto guardado","ok");
    try {
      await db.addProducto({
        id: p.id, codigo: p.codigo, descripcion: p.descripcion, categoria: p.categoria || "",
        vencimiento: p.vencimiento, fecha_carga: p.fechaCarga,
        en_gondola: false, stock_liquida: "", pasado_liquida: false, dap: false
      });
    } catch(e) { console.error("Error guardando producto:", e); showToast("Error al guardar en la nube","warn"); }
    // Actualizar productos frecuentes
    if (p.codigo !== "—") {
      const existente = frecuentes.find(f => f.codigo === p.codigo);
      const nuevo = { codigo: p.codigo, descripcion: p.descripcion, veces: (existente?.veces || 0) + 1 };
      setFrecuentes(prev => {
        const idx = prev.findIndex(f => f.codigo === p.codigo);
        if (idx >= 0) { const u=[...prev]; u[idx]=nuevo; return u; }
        return [...prev, nuevo];
      });
      try { await db.upsertFrecuente(nuevo); } catch(e) { console.error("Error frecuentes:", e); }
    }
  };

  // ── Eliminar → historial ───────────────────────────────────────────────────
  const deleteProducto = async (id, motivo="eliminado") => {
    const p = productos.find(x => x.id === id);
    const fechaRetiro = todayStr();
    if (p) setHistorial(prev => [{ ...p, fechaRetiro, motivo }, ...prev].slice(0,200));
    setProductos(prev => prev.filter(x => x.id !== id));
    showToast("Producto retirado del registro","warn");
    setConfirmDel(null);
    try {
      await db.deleteProducto(id);
      if (p) await db.addHistorial({ codigo:p.codigo||"", descripcion:p.descripcion, vencimiento:p.vencimiento, motivo, fecha_retiro:fechaRetiro });
    } catch(e) { console.error("Error al retirar:", e); }
  };

  const updateProducto = async (id, changes) => {
    setProductos(prev => prev.map(p => p.id===id?{...p,...changes}:p));
    try {
      const M = { enGondola:"en_gondola", stockLiquida:"stock_liquida", pasadoLiquida:"pasado_liquida", vencimiento:"vencimiento", dap:"dap", descripcion:"descripcion", categoria:"categoria" };
      const dbChanges = {};
      Object.entries(changes).forEach(([k,v]) => { if (M[k]) dbChanges[M[k]] = v; });
      if (Object.keys(dbChanges).length > 0) await db.updateProducto(id, dbChanges);
    } catch(e) { console.error("Error update:", e); }
  };

  const st = p => getStatus(diffDays(p.vencimiento), config.diasLiquida, config.diasRetiro);
  const alertas = productos.filter(p => ["retiro","vencido"].includes(st(p)));
  const liquidar = productos.filter(p => st(p)==="liquida");

  const counts = { todos:productos.length };
  ["ok","liquida","retiro","vencido"].forEach(s => { counts[s]=productos.filter(p=>st(p)===s).length; });

  const lista = productos
    .filter(p => {
      if (filtro!=="todos" && st(p)!==filtro) return false;
      if (busqueda) { const q=busqueda.toLowerCase(); if(!p.descripcion?.toLowerCase().includes(q)&&!p.codigo?.includes(busqueda)) return false; }
      return true;
    })
    .sort((a,b) => diffDays(a.vencimiento)-diffDays(b.vencimiento));

  // Agrupado por semana
  const porSemana = useMemo(()=>{
    const groups = {};
    lista.forEach(p => {
      const k = getWeekLabel(p.vencimiento);
      if (!groups[k]) groups[k]=[];
      groups[k].push(p);
    });
    return WEEK_ORDER.filter(k=>groups[k]).map(k=>({ label:k, items:groups[k] }));
  }, [lista]);

  if (showWelcome) return <ThemeCtx.Provider value={tema}><WelcomeScreen onComplete={n=>{setNombre(n);setShowWelcome(false);}}/></ThemeCtx.Provider>;
  if (!showWelcome && cargandoInicial) return <LoadingScreen />;
  if (scanning)    return <CameraScanner onDetected={cod=>{setScanning(false);setPendingCod(cod);}} onClose={()=>setScanning(false)} />;

  return (
    <ThemeCtx.Provider value={tema}>
    <div style={{...S.root, background:T.bg0, color:T.text}}>
      <style>{`
        @keyframes scanMove{0%,100%{top:18%}50%{top:76%}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes popIn{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:.5;}
        ::-webkit-scrollbar{display:none;}
        textarea,input,select{font-family:inherit;}
      `}</style>

      {showSummary && <DaySummary productos={productos} config={config} nombre={nombre} onClose={()=>setShowSummary(false)}/>}
      {pendingCod!==null && <NuevoProductoModal codigo={pendingCod} onSave={handleSaveProducto} onCancel={()=>setPendingCod(null)} config={config} frecuentes={frecuentes} productos={productos}/>}

      {confirmDel && (
        <div style={S.modalOverlay} onClick={()=>setConfirmDel(null)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,textAlign:"center"}}>
              <span style={{fontSize:36}}>🗑️</span>
              <p style={{fontWeight:800,fontSize:17,margin:0}}>¿Retirar este producto?</p>
              <p style={{color:"#666",fontSize:13,margin:"0 0 4px"}}>Quedará guardado en el historial</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginBottom:8}}>
                {["retirado","vencido","a liquida","sin stock","devolucion proveedor"].map(m=>(
                  <button key={m} style={{...S.btnMotivo, ...(m==="sin stock"?{borderColor:"#ff6b0055",color:"#ff6b00",background:"#1a0d00"}:m==="devolucion proveedor"?{borderColor:"#3b82f644",color:"#60a5fa",background:"#0d1a2a"}:{})}} onClick={()=>deleteProducto(confirmDel,m)}>
                    {m==="retirado"?"⚠️ Retiro anticipado":m==="vencido"?"💀 Vencido":m==="a liquida"?"🏷️ Enviado a Liquida":m==="sin stock"?"📭 Sin stock":"🔵 Devolución al proveedor"}
                  </button>
                ))}
              </div>
              <button style={S.btnSecondary} onClick={()=>setConfirmDel(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type}/>}

      {/* ── GUÍA DE USO ── */}
      {showGuia && <GuiaModal onClose={()=>setShowGuia(false)}/>}

      {/* Header */}
      <header style={{...S.header, background:T.headerBg, borderBottomColor:T.border}}>
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setShowSummary(true)}>
          {avatar ? (
            <img src={avatarUrl(avatar)} alt="avatar" style={{width:38,height:38,borderRadius:"50%",flexShrink:0,background:T.bg1}}/>
          ) : (
            <div style={{width:38,height:38,borderRadius:"50%",background:T.accent||"#00e5ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#0d1117",flexShrink:0}}>
              {nombre.trim().split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
            </div>
          )}
          <div>
            <div style={S.appTitle}>{getSaludo()}, {nombre}!</div>
            <div style={S.appSub}>{config.sector}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {liquidar.length>0&&<button style={S.liquidaBadge} onClick={()=>setView("liquida")}>🏷️ {liquidar.length}</button>}
          {alertas.length>0&&<button style={S.alertBadge} onClick={()=>setView("alertas")}>⚠️ {alertas.length}</button>}
          <button
            onClick={()=>setTema(t=>t==="dark"?"light":"dark")}
            title={tema==="dark"?"Cambiar a modo claro":"Cambiar a modo oscuro"}
            style={{background:"transparent",border:"none",fontSize:22,cursor:"pointer",padding:"4px 2px",lineHeight:1,transition:"transform .2s",display:"flex",alignItems:"center",justifyContent:"center"}}
            onMouseEnter={e=>e.currentTarget.style.transform="scale(1.2)"}
            onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
            {tema==="dark"?"☀️":"🌙"}
          </button>
          <button
            onClick={()=>setShowGuia(true)}
            title="Guía de uso"
            style={{background:"transparent",border:"none",fontSize:20,cursor:"pointer",padding:"4px 2px",lineHeight:1,transition:"transform .2s",display:"flex",alignItems:"center",justifyContent:"center"}}
            onMouseEnter={e=>e.currentTarget.style.transform="scale(1.2)"}
            onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
            ❓
          </button>
        </div>
      </header>

      <main style={S.main}>

        {/* ── LISTA ── */}
        {view==="lista"&&(
          <div style={S.view}>
            <div style={S.statsRow}>
              {["ok","liquida","retiro","vencido"].map(s=>(
                <button key={s} style={{...S.statCard,borderColor:SM[s].color,background:filtro===s?SM[s].color:SM[s].bg}} onClick={()=>setFiltro(filtro===s?"todos":s)}>
                  <span style={{fontSize:16}}>{SM[s].icon}</span>
                  <span style={{fontWeight:900,fontSize:20,lineHeight:1,color:filtro===s?"#000":SM[s].color}}>{counts[s]}</span>
                  <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.4,color:filtro===s?"#000":"#666"}}>{s==="liquida"?"Liquida":s==="retiro"?"Retiro":SM[s].label}</span>
                </button>
              ))}
            </div>

            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <div style={{...S.searchRow,flex:1,marginBottom:0,background:T.searchBg,borderColor:T.border}}>
                <span style={{opacity:.4}}>🔍</span>
                <input style={S.searchInput} placeholder="Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
                {busqueda&&<button style={S.clearBtn} onClick={()=>setBusqueda("")}>✕</button>}
              </div>
              <button style={{...S.viewToggle,background:vistaLista==="lista"?"#00e5ff":"#161b22",color:vistaLista==="lista"?"#000":"#555"}} onClick={()=>setVistaLista("lista")} title="Vista lista">☰</button>
              <button style={{...S.viewToggle,background:vistaLista==="semana"?"#00e5ff":"#161b22",color:vistaLista==="semana"?"#000":"#555"}} onClick={()=>setVistaLista("semana")} title="Vista por semana">📅</button>
            </div>

            {filtro!=="todos"&&(
              <div style={{...S.filtroActivo,background:SM[filtro].bg,borderColor:SM[filtro].color,color:SM[filtro].color}}>
                {SM[filtro].icon} {filtro==="liquida"?"Liquida":filtro==="retiro"?"Retiro anticipado":SM[filtro].label}
                <button style={{marginLeft:"auto",background:"transparent",border:"none",color:"inherit",cursor:"pointer",fontSize:14}} onClick={()=>setFiltro("todos")}>✕</button>
              </div>
            )}

            {lista.length===0?(
              <div style={S.emptyState}>
                <span style={{fontSize:52}}>📭</span>
                <p style={{color:"#555",margin:0}}>{productos.length===0?"Todavía no hay productos cargados":"Sin productos en esta categoría"}</p>
                {productos.length===0&&<p style={{color:"#444",fontSize:13}}>Tocá 📷 para escanear tu primer producto</p>}
              </div>
            ): vistaLista==="lista"?(
              <div style={S.productList}>{lista.map(p=><ProductCard key={p.id} p={p} config={config} onDelete={()=>setConfirmDel(p.id)} onUpdate={updateProducto}/>)}</div>
            ):(
              <div>{porSemana.map(g=>(
                <div key={g.label} style={{marginBottom:20}}>
                  <div style={S.weekHeader}>{g.label} <span style={S.weekCount}>{g.items.length}</span></div>
                  <div style={S.productList}>{g.items.map(p=><ProductCard key={p.id} p={p} config={config} onDelete={()=>setConfirmDel(p.id)} onUpdate={updateProducto}/>)}</div>
                </div>
              ))}</div>
            )}
          </div>
        )}

        {/* ── LIQUIDA ── */}
        {view==="liquida"&&(
          <div style={S.view}>
            <SectionHeader icon="🏷️" title="Mandar a Liquida" subtitle={`Vencen en ≤ ${config.diasLiquida} días`} color="#ffd600" count={liquidar.length}/>
            {liquidar.length===0?<Empty icon="✨" msg="No hay productos para liquidar"/>
              :<div style={S.productList}>{liquidar.sort((a,b)=>diffDays(a.vencimiento)-diffDays(b.vencimiento)).map(p=><ProductCard key={p.id} p={p} config={config} onDelete={()=>setConfirmDel(p.id)} onUpdate={updateProducto}/>)}</div>}
          </div>
        )}

        {/* ── ALERTAS ── */}
        {view==="alertas"&&(
          <div style={S.view}>
            <SectionHeader icon="🚨" title="Retiro Anticipado" subtitle={`Vencen en ≤ ${config.diasRetiro} días`} color="#ff6b00" count={alertas.length}/>
            {alertas.length===0?<Empty icon="🎉" msg="¡Sin urgencias por ahora!"/>
              :<div style={S.productList}>{alertas.sort((a,b)=>diffDays(a.vencimiento)-diffDays(b.vencimiento)).map(p=><ProductCard key={p.id} p={p} config={config} onDelete={()=>setConfirmDel(p.id)} onUpdate={updateProducto}/>)}</div>}
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {view==="historial"&&<HistorialView historial={historial} onClear={async ()=>{setHistorial([]);showToast("Historial limpiado","warn");try{await db.clearHistorial();}catch(e){console.error(e);}}}/>}

        {/* ── FRECUENTES ── */}
        {view==="frecuentes"&&<FrecuentesView frecuentes={frecuentes} onDelete={async cod=>{setFrecuentes(prev=>prev.filter(f=>f.codigo!==cod));showToast("Eliminado de frecuentes","warn");try{await db.deleteFrecuente(cod);}catch(e){console.error(e);}}}/>}
          {view==="categorias" && <CategoriasView productos={productos} config={config} onDelete={(id)=>setConfirmDel(id)} onUpdate={updateProducto}/>}

        {/* ── REPORTE ── */}
        {view==="reporte"&&<ReporteView historial={historial} productos={productos} config={config} nombre={nombre}/>}

        {/* ── CONFIG ── */}
        {view==="config"    && <ConfigView config={config} setConfig={setConfig} nombre={nombre} setNombre={setNombre} showToast={showToast} alertas={alertas} tema={tema} setTema={setTema} avatar={avatar} setAvatar={setAvatar}/>}

      </main>

      {/* FAB */}
      <button style={S.fab} onClick={()=>setScanning(true)}>
        <span style={{fontSize:24}}>📷</span>
        <span style={{fontSize:11,fontWeight:800,letterSpacing:.5}}>ESCANEAR</span>
      </button>

      {/* Nav */}
      <nav style={{...S.nav, background:T.navBg, borderTopColor:T.border}}>
        {[
          {id:"lista",      icon:"📋", label:"Lista",      badge:null},
          {id:"alertas",    icon:"🚨", label:"Alertas",    badge:alertas.length||null},
          {id:"historial",  icon:"📝", label:"Historial",  badge:null},
          {id:"reporte",    icon:"📊", label:"Reporte",    badge:null},
          {id:"categorias", icon:"🗂️", label:"Categorías", badge:null},
          {id:"config",     icon:"⚙️", label:"Config",     badge:null},
        ].map(t=>(
          <button key={t.id} style={{...S.navBtn,...(view===t.id?S.navBtnActive:{})}} onClick={()=>setView(t.id)}>
            <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:18}}>{t.icon}</span>
              {t.badge?<span style={S.navBadge}>{t.badge}</span>:null}
            </div>
            <span style={S.navLabel}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
    </ThemeCtx.Provider>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GUÍA DE USO
// ════════════════════════════════════════════════════════════════════════════════
const GUIA_PASOS = [
  {
    emoji:"📦", num:"1 de 8", titulo:"Escaneá o ingresá un producto",
    desc:["Tocá el botón 📷 azul en el centro inferior para escanear el código de barras con la cámara del celular.",
          "Si no podés escanear, ingresá el código a mano y completá la descripción y la fecha de vencimiento."]
  },
  {
    emoji:"🟢🟡🟠🔴", num:"2 de 8", titulo:"Los colores indican el estado",
    desc:["✅ OK — En fecha, sin acción requerida.",
          "🏷️ Liquida — Cerca de vencer, llevalo a la góndola de descuentos.",
          "⚠️ Retiro — Retiralo del estante inmediatamente.",
          "💀 Vencido — Producto vencido, fuera de venta."]
  },
  {
    emoji:"🛒", num:"3 de 8", titulo:"Góndola de Liquida",
    desc:["Cuando un producto pasa a Liquida, tocalo para abrirlo.",
          "Dentro encontrás el botón 'Puesto en góndola de liquida' y un campo para anotar el stock disponible.",
          "Una vez confirmado aparece un ✅ en la tarjeta para saber cuáles ya llevaste."]
  },
  {
    emoji:"🏷️", num:"4 de 8", titulo:"Pasado para Liquida (productos OK)",
    desc:["Los productos con buena fecha también pueden mandarse a la góndola de descuentos si tienen poca rotación.",
          "Abrí cualquier producto OK y tocá el botón 'Pasado para Liquida'.",
          "En la tarjeta cerrada aparece el badge amarillo ✓ LIQUIDA para identificarlos de un vistazo."]
  },
  {
    emoji:"⚙️", num:"5 de 8", titulo:"Configurá los umbrales",
    desc:["En ⚙️ Config podés ajustar cuántos días antes un producto pasa a Liquida y cuántos días antes pasa a Retiro.",
          "Por defecto: 30 días para Liquida y 15 días para Retiro.",
          "También podés cambiar tu nombre que aparece en el saludo."]
  },
  {
    emoji:"📊", num:"6 de 8", titulo:"Reportes, historial y retiros",
    desc:["En 📊 Reporte generás un resumen del mes para compartir por WhatsApp o guardar como PDF.",
          "En 📝 Historial quedan registrados todos los productos retirados con fecha y motivo.",
          "Al retirar un producto podés elegir: Retiro anticipado, Vencido, Enviado a Liquida o 📭 Sin stock."]
  },
  {
    emoji:"🔵", num:"7 de 8", titulo:"D.A.P. — Devolución al proveedor",
    desc:["Algunos productos tienen devolución al proveedor aunque estén próximos a vencer — no van a la góndola de Liquida.",
          "Abrí cualquier producto (OK, Liquida o Retiro) y tocá 'Marcar como D.A.P.' para identificarlo.",
          "En la tarjeta cerrada aparece el badge azul D.A.P. como recordatorio. Al retirarlo podés registrarlo como 'Devolución al proveedor' en el historial."]
  },
  {
    emoji:"🔔", num:"8 de 8", titulo:"Notificaciones y sincronización",
    desc:["Los datos se comparten entre todos los celulares que usen la app — lo que carga un compañero lo ven todos.",
          "Dos veces al día la app revisa sola los productos y te avisa si hay algo para Liquida, D.A.P. o para retirar de góndola.",
          "Aceptá el permiso de notificaciones cuando la app lo pida para recibir los avisos."]
  },
];

function GuiaModal({ onClose }) {
  const [paso, setPaso] = useState(0);
  const total = GUIA_PASOS.length;
  const g = GUIA_PASOS[paso];
  const tema = useTheme(); const T = getThemeColors(tema);

  // Soporte swipe
  const touchStart = useRef(0);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{background:T.bg1,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,paddingBottom:32,overflow:"hidden"}}
        onTouchStart={e=>{ touchStart.current = e.touches[0].clientX; }}
        onTouchEnd={e=>{ const diff = touchStart.current - e.changedTouches[0].clientX; if(diff>50&&paso<total-1) setPaso(p=>p+1); else if(diff<-50&&paso>0) setPaso(p=>p-1); }}>

        {/* Handle */}
        <div style={{width:40,height:4,background:"#2a3a4a",borderRadius:2,margin:"14px auto 0"}}/>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 0"}}>
          <div style={{fontWeight:800,fontSize:17,color:T.text}}>❓ Cómo usar VencControl</div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:"#1e2d3d",border:"none",color:"#8b949e",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        {/* Contenido */}
        <div style={{padding:"28px 24px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:14,textAlign:"center",minHeight:280}}>
          <div style={{fontSize:58,lineHeight:1}}>{g.emoji}</div>
          <div style={{fontSize:11,fontWeight:700,color:"#00e5ff",textTransform:"uppercase",letterSpacing:1}}>Paso {g.num}</div>
          <div style={{fontSize:20,fontWeight:800,color:T.text,lineHeight:1.3}}>{g.titulo}</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,width:"100%"}}>
            {g.desc.map((d,i)=>(
              <div key={i} style={{fontSize:13.5,color:T.textSub,lineHeight:1.65,background:T.bg0,borderRadius:10,padding:"10px 14px",textAlign:"left"}}>{d}</div>
            ))}
          </div>
        </div>

        {/* Dots */}
        <div style={{display:"flex",gap:8,justifyContent:"center",margin:"20px 0 0"}}>
          {GUIA_PASOS.map((_,i)=>(
            <div key={i} onClick={()=>setPaso(i)} style={{height:8,borderRadius:4,cursor:"pointer",transition:"all .2s",background: i===paso?"#00e5ff":"#1e2d3d",width: i===paso?20:8}}/>
          ))}
        </div>

        {/* Botones */}
        <div style={{display:"flex",gap:10,padding:"16px 24px 0"}}>
          {paso>0
            ? <button onClick={()=>setPaso(p=>p-1)} style={{flex:1,background:"#1e2d3d",border:"none",borderRadius:12,padding:14,color:"#8b949e",fontSize:14,fontWeight:700,cursor:"pointer"}}>← Anterior</button>
            : <div style={{flex:1}}/>
          }
          <button
            onClick={()=>{ if(paso<total-1) setPaso(p=>p+1); else onClose(); }}
            style={{flex:2,background:paso===total-1?"linear-gradient(135deg,#00e676,#00b894)":"linear-gradient(135deg,#00e5ff,#00b4d8)",border:"none",borderRadius:12,padding:14,color:"#0d1117",fontSize:14,fontWeight:800,cursor:"pointer"}}>
            {paso===total-1?"¡Entendido! ✓":"Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PRODUCT CARD
// ════════════════════════════════════════════════════════════════════════════════
function ProductCard({ p, config, onDelete, onUpdate }) {
  const tema = useTheme(); const T = getThemeColors(tema);
  const days=diffDays(p.vencimiento), status=getStatus(days,config.diasLiquida,config.diasRetiro), meta=SM[status];
  const [expanded,    setExpanded]    = useState(false);
  const [editFecha,   setEditFecha]   = useState(false);
  const [newFecha,    setNewFecha]    = useState(p.vencimiento);
  const [editDatos,      setEditDatos]      = useState(false);
  const [newDescripcion, setNewDescripcion] = useState(p.descripcion);
  const [newCategoria,   setNewCategoria]   = useState(p.categoria || "");
  const [enGondola,     setEnGondola]     = useState(p.enGondola || false);
  const [stockLiquida,  setStockLiquida]   = useState(p.stockLiquida || "");
  const [pasadoLiquida, setPasadoLiquida]  = useState(p.pasadoLiquida || false);
  const [dap,           setDap]            = useState(p.dap || false);
  const daysLabel = days<0?`Venció hace ${Math.abs(days)} día${Math.abs(days)>1?"s":""}`:days===0?"Vence HOY":`${days} día${days>1?"s":""}`;
  const isLiquida = status === "liquida";

  // Sincronizar con cambios que vengan de otros celulares
  useEffect(()=>{ setEnGondola(p.enGondola||false); setStockLiquida(p.stockLiquida||""); setPasadoLiquida(p.pasadoLiquida||false); setDap(p.dap||false); }, [p.enGondola, p.stockLiquida, p.pasadoLiquida, p.dap]);

  const toggleGondola = () => {
    const nuevo = !enGondola;
    setEnGondola(nuevo);
    onUpdate(p.id, { enGondola: nuevo });
  };

  const guardarStock = (val) => {
    setStockLiquida(val);
    onUpdate(p.id, { stockLiquida: val });
  };

  return (
    <div style={{...S.card,borderLeftColor:meta.color,animation:"fadeIn .2s ease",background:T.cardBg,borderColor:T.border}}>
      <div style={S.cardHeader} onClick={()=>setExpanded(e=>!e)}>
        <div style={S.cardLeft}>
          <span style={{width:10,height:10,borderRadius:"50%",background:meta.color,flexShrink:0,boxShadow:`0 0 6px ${meta.color}88`}}/>
          <div style={{minWidth:0}}>
            {/* Descripción completa cuando expandido, recortada cuando cerrado */}
            <div style={{...S.cardName, whiteSpace: expanded?"normal":"nowrap"}}>{p.descripcion}</div>
            <div style={S.cardCode}>COD: {p.codigo}{p.categoria?` · ${p.categoria}`:""}</div>
          </div>
        </div>
        <div style={S.cardRight}>
          <span style={{...S.statusPill,background:meta.bg,color:meta.color}}>{meta.icon} {status==="liquida"?"Liquida":status==="retiro"?"Retiro":meta.label}</span>
          <span style={{fontSize:11,fontWeight:700,color:meta.color}}>{daysLabel}</span>
          {/* Tilde verde para Liquida en góndola */}
          {isLiquida && enGondola && (
            <span style={{fontSize:16,marginTop:2}} title="Puesto en góndola de liquida">✅</span>
          )}
          {/* Badge amarillo para OK pasado a Liquida manualmente */}
          {status==="ok" && pasadoLiquida && (
            <span style={{background:"#ffd600",color:"#0d1117",fontSize:10,fontWeight:900,padding:"2px 7px",borderRadius:20,marginTop:2,letterSpacing:.5}} title="Pasado para Liquida">✓ LIQUIDA</span>
          )}
          {/* Badge azul D.A.P. — aparece en cualquier estado */}
          {dap && (
            <span style={{background:"#1d4ed822",color:"#60a5fa",fontSize:10,fontWeight:900,padding:"2px 8px",borderRadius:20,border:"1px solid #3b82f633",letterSpacing:.5,marginTop:2}} title="Devolución al proveedor">D.A.P.</span>
          )}
        </div>
      </div>
      {expanded&&(
        <div style={{...S.cardBody,borderTopColor:T.border}}>
          <div style={S.cardRow}><span style={{color:"#555"}}>📝 Descripción</span>
            {editDatos?(
              <span style={{display:"flex",flexDirection:"column",gap:6,alignItems:"stretch",width:"100%"}}>
                <textarea value={newDescripcion} rows={2} style={{...S.dateInputSm,width:"100%",resize:"none",textAlign:"left",padding:"6px 8px"}} onChange={e=>setNewDescripcion(e.target.value)}/>
                <select value={newCategoria} style={{...S.dateInputSm,width:"100%"}} onChange={e=>setNewCategoria(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {CATEGORIAS_PRODUCTO.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <span style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                  <button style={S.btnSm} onClick={()=>{onUpdate(p.id,{descripcion:newDescripcion.trim()||p.descripcion, categoria:newCategoria});setEditDatos(false);}}>✓ Guardar</button>
                  <button style={{...S.btnSm,background:"#2a2a2a",color:"#888"}} onClick={()=>setEditDatos(false)}>✕</button>
                </span>
              </span>
            ):(
              <span style={{color:"#ccc",fontWeight:600,cursor:"pointer",textAlign:"right"}} onClick={()=>{setNewDescripcion(p.descripcion);setNewCategoria(p.categoria||"");setEditDatos(true);}}>
                ✏️ Editar
              </span>
            )}
          </div>
          <div style={S.cardRow}><span style={{color:"#555"}}>📅 Vencimiento</span>
            {editFecha?(
              <span style={{display:"flex",gap:6,alignItems:"center"}}>
                <input type="date" value={newFecha} style={S.dateInputSm} onChange={e=>setNewFecha(e.target.value)}/>
                <button style={S.btnSm} onClick={()=>{onUpdate(p.id,{vencimiento:newFecha});setEditFecha(false);}}>✓</button>
                <button style={{...S.btnSm,background:"#2a2a2a",color:"#888"}} onClick={()=>setEditFecha(false)}>✕</button>
              </span>
            ):(
              <span style={{color:meta.color,fontWeight:600,cursor:"pointer"}} onClick={()=>{setNewFecha(p.vencimiento);setEditFecha(true);}}>
                {fmtDate(p.vencimiento)} ✏️
              </span>
            )}
          </div>
          <div style={S.cardRow}><span style={{color:"#555"}}>📌 Estado</span><span style={{color:meta.color,fontWeight:700}}>{meta.icon} {meta.desc}</span></div>
          <div style={S.cardRow}><span style={{color:"#555"}}>➕ Cargado</span><span style={{color:"#444"}}>{fmtDate(p.fechaCarga)}</span></div>

          {/* ── SECCIÓN PASADO PARA LIQUIDA — solo para productos OK ── */}
          {status==="ok" && (
            <div style={{background: pasadoLiquida?"#1a160088":"#0d111788", border:`1px solid ${pasadoLiquida?"#ffd60055":"#1e2d3d"}`, borderRadius:10, padding:12, display:"flex", flexDirection:"column", gap:8}}>
              <div style={{fontSize:12, fontWeight:700, color: pasadoLiquida?"#ffd600":"#8b949e"}}>🏷️ Góndola de Liquida</div>
              <button
                onClick={()=>{ const n=!pasadoLiquida; setPasadoLiquida(n); onUpdate(p.id,{pasadoLiquida:n}); }}
                style={{border: pasadoLiquida?"1px solid #ffd60055":"1px solid #2a2a2a", borderRadius:8, padding:"10px 14px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, justifyContent:"center", background: pasadoLiquida?"#ffd60018":"#1e2d3d", color: pasadoLiquida?"#ffd600":"#8b949e", transition:"all .15s", width:"100%"}}>
                {pasadoLiquida ? "✓ Pasado para Liquida" : "Pasado para Liquida"}
              </button>
            </div>
          )}

          {/* ── SECCIÓN GÓNDOLA — solo para productos en Liquida ── */}
          {isLiquida && (
            <div style={{background:"#1a160044",border:"1px solid #ffd60033",borderRadius:10,padding:12,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:12,fontWeight:700,color:"#ffd600"}}>🛒 Góndola de Liquida</div>

              {/* Botón puesto/no puesto */}
              <button
                onClick={toggleGondola}
                style={{
                  border: enGondola ? "1px solid #ffd60055" : "1px solid #2a2a2a",
                  borderRadius:8, padding:"10px 14px", fontSize:13, fontWeight:700,
                  cursor:"pointer", display:"flex", alignItems:"center", gap:8, justifyContent:"center",
                  background: enGondola ? "#ffd60018" : "#1e2d3d",
                  color: enGondola ? "#ffd600" : "#8b949e",
                  transition:"all .15s"
                }}>
                {enGondola ? "✅ Puesto en góndola de liquida" : "🛒 Marcar como puesto en góndola"}
              </button>

              {/* Campo de stock */}
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:12,color:"#8b949e",fontWeight:600,whiteSpace:"nowrap"}}>Stock para liquidar:</span>
                <input
                  type="number"
                  min="0"
                  value={stockLiquida}
                  placeholder="0"
                  onChange={e=>guardarStock(e.target.value)}
                  style={{
                    width:65, background:"#0d1117", border:"1px solid #1e2d3d",
                    borderRadius:8, padding:"7px 10px", color:"#e6edf3",
                    fontSize:14, fontWeight:700, textAlign:"center",
                    outline:"none", fontFamily:"inherit"
                  }}
                />
                <span style={{fontSize:12,color:"#555"}}>unid.</span>
              </div>
            </div>
          )}

          {/* ── SECCIÓN D.A.P. — disponible en todos los estados ── */}
          <div style={{background: dap?"#0d1a2a":"#0d111788", border:`1px solid ${dap?"#3b82f644":"#1e2d3d"}`, borderRadius:10, padding:12, display:"flex", flexDirection:"column", gap:8}}>
            <div style={{fontSize:12, fontWeight:700, color: dap?"#60a5fa":"#8b949e"}}>🔵 Devolución al proveedor</div>
            <button
              onClick={()=>{ const n=!dap; setDap(n); onUpdate(p.id,{dap:n}); }}
              style={{border: dap?"1px solid #3b82f655":"1px solid #2a2a2a", borderRadius:8, padding:"10px 14px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, justifyContent:"center", background: dap?"#1d4ed818":"#1e2d3d", color: dap?"#60a5fa":"#8b949e", transition:"all .15s", width:"100%"}}>
              {dap ? "🔵 Marcado para devolución" : "Marcar como D.A.P."}
            </button>
          </div>

          <button style={S.btnDelCard} onClick={onDelete}>🗑️ Retirar del registro</button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// HISTORIAL
// ════════════════════════════════════════════════════════════════════════════════
function HistorialView({ historial, onClear }) {
  const tema = useTheme(); const T = getThemeColors(tema);
  const motivoIcon = { retirado:"⚠️", vencido:"💀", "a liquida":"🏷️", eliminado:"🗑️", "sin stock":"📭", "devolucion proveedor":"🔵" };
  const motivoColor = { retirado:"#ff6b00", vencido:"#ff2d55", "a liquida":"#ffd600", eliminado:"#555", "sin stock":"#ff6b00", "devolucion proveedor":"#60a5fa" };
  return (
    <div style={S.view}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div><h2 style={{margin:0,fontWeight:800,fontSize:18}}>📝 Historial</h2><p style={{margin:0,color:"#555",fontSize:12}}>Últimos {historial.length} productos retirados</p></div>
        {historial.length>0&&<button style={{background:"transparent",border:"1px solid #2a2a2a",borderRadius:8,color:"#555",padding:"6px 12px",fontSize:12,cursor:"pointer"}} onClick={onClear}>Limpiar</button>}
      </div>
      {historial.length===0?<Empty icon="📭" msg="El historial está vacío"/>:(
        <div style={S.productList}>
          {historial.map((p,i)=>{
            const mc=motivoColor[p.motivo]||"#555", mi=motivoIcon[p.motivo]||"🗑️";
            return (
              <div key={i} style={{...S.card,borderLeftColor:mc,opacity:.9}}>
                <div style={{padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                    <div style={{minWidth:0}}>
                      <div style={S.cardName}>{p.descripcion}</div>
                      <div style={S.cardCode}>COD: {p.codigo}</div>
                    </div>
                    <span style={{...S.statusPill,background:`${mc}22`,color:mc,flexShrink:0}}>{mi} {p.motivo}</span>
                  </div>
                  <div style={{display:"flex",gap:16,marginTop:8,fontSize:12,color:"#555"}}>
                    <span>📅 Venc: {fmtDate(p.vencimiento)}</span>
                    <span>🗓️ Retirado: {fmtDate(p.fechaRetiro)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// FRECUENTES
// ════════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════════
// CATEGORÍAS
// ════════════════════════════════════════════════════════════════════════════════
function CategoriasView({ productos, config, onDelete, onUpdate }) {
  const [activa, setActiva] = useState(null);
  const st = p => getStatus(diffDays(p.vencimiento), config.diasLiquida, config.diasRetiro);

  const conteos = {};
  CATEGORIAS_PRODUCTO.forEach(c => { conteos[c] = productos.filter(p => (p.categoria||"Sin categoría") === c).length; });
  const sinCategoria = productos.filter(p => !p.categoria).length;

  if (activa) {
    const items = productos.filter(p => (activa==="Sin categoría" ? !p.categoria : p.categoria===activa))
      .sort((a,b)=>diffDays(a.vencimiento)-diffDays(b.vencimiento));
    return (
      <div style={S.view}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button onClick={()=>setActiva(null)} style={{background:"transparent",border:"none",fontSize:20,cursor:"pointer",color:"#8b949e"}}>←</button>
          <div>
            <h2 style={{margin:0,fontWeight:800,fontSize:18}}>🗂️ {activa}</h2>
            <p style={{margin:0,color:"#555",fontSize:12}}>{items.length} producto{items.length!==1?"s":""}</p>
          </div>
        </div>
        {items.length===0
          ? <Empty icon="📭" msg="Sin productos en esta categoría"/>
          : <div style={S.productList}>{items.map(p=><ProductCard key={p.id} p={p} config={config} onDelete={()=>onDelete(p.id)} onUpdate={onUpdate}/>)}</div>}
      </div>
    );
  }

  return (
    <div style={S.view}>
      <div style={{marginBottom:16}}>
        <h2 style={{margin:0,fontWeight:800,fontSize:18}}>🗂️ Categorías</h2>
        <p style={{margin:"4px 0 0",color:"#555",fontSize:12}}>Tocá una categoría para ver sus productos</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[...CATEGORIAS_PRODUCTO, "Sin categoría"].map(c => {
          const n = c==="Sin categoría" ? sinCategoria : conteos[c];
          return (
            <div key={c} onClick={()=>setActiva(c)} style={{
              background:"#161b22", border:"1px solid #1e2d3d", borderRadius:12, padding:"14px 16px",
              display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer",
            }}>
              <span style={{fontWeight:700,fontSize:14,color: n>0 ? "#e6edf3" : "#555"}}>{c}</span>
              <span style={{
                background: n>0 ? "#00e5ff22" : "#1e2d3d", color: n>0 ? "#00e5ff" : "#555",
                borderRadius:20, padding:"3px 12px", fontSize:12, fontWeight:700,
              }}>{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function FrecuentesView({ frecuentes, onDelete }) {
  const tema = useTheme(); const T = getThemeColors(tema);
  const sorted = [...frecuentes].sort((a,b)=>(b.veces||1)-(a.veces||1));
  return (
    <div style={S.view}>
      <div style={{marginBottom:16}}>
        <h2 style={{margin:0,fontWeight:800,fontSize:18}}>⭐ Productos Frecuentes</h2>
        <p style={{margin:"4px 0 0",color:"#555",fontSize:12}}>La app completa el nombre automáticamente al escanear estos códigos</p>
      </div>
      {sorted.length===0?<Empty icon="📦" msg="Aún no hay productos frecuentes. Se agregan solos cuando escaneás el mismo código más de una vez."/>:(
        <div style={S.productList}>
          {sorted.map((f,i)=>(
            <div key={i} style={{...S.card,borderLeftColor:"#ffd600",animation:"fadeIn .2s ease"}}>
              <div style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <div style={{minWidth:0}}>
                  <div style={S.cardName}>{f.descripcion}</div>
                  <div style={S.cardCode}>COD: {f.codigo}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                  <span style={{...S.statusPill,background:"rgba(255,214,0,.1)",color:"#ffd600"}}>⭐ {f.veces||1} vez{(f.veces||1)>1?"es":""}</span>
                  <button style={{background:"transparent",border:"none",color:"#333",cursor:"pointer",fontSize:13,padding:0}} onClick={()=>onDelete(f.codigo)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// REPORTE MENSUAL
// ════════════════════════════════════════════════════════════════════════════════
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function ReporteView({ historial, productos, config, nombre }) {
  const now   = new Date();
  const [mes, setMes]   = useState(now.getMonth());
  const [anio, setAnio] = useState(now.getFullYear());
  const [sharing, setSharing] = useState(false);

  // Filtrar historial del mes seleccionado
  const registros = historial.filter(p => {
    if (!p.fechaRetiro) return false;
    const [y,m] = p.fechaRetiro.split("-");
    return parseInt(y)===anio && parseInt(m)-1===mes;
  });

  // Productos activos cuya fecha de vencimiento cae en ese mes
  const vencenEseMes = productos.filter(p => {
    const [y,m] = p.vencimiento.split("-");
    return parseInt(y)===anio && parseInt(m)-1===mes;
  });

  const porMotivo = { retirado:0, vencido:0, "a liquida":0, eliminado:0, "sin stock":0, "devolucion proveedor":0 };
  registros.forEach(p => { if (porMotivo[p.motivo]!==undefined) porMotivo[p.motivo]++; else porMotivo.eliminado++; });

  // Generar texto del reporte
  const generarTexto = () => {
    const lineas = [
      `📦 REPORTE VENCIMIENTOS — ${MESES[mes].toUpperCase()} ${anio}`,
      `👤 Repositor: ${nombre}`,
      `🏪 Sector: ${config.sector}`,
      `📅 Generado: ${fmtDate(todayStr())}`,
      ``,
      `── RESUMEN DEL MES ──`,
      `⚠️  Retiros anticipados: ${porMotivo.retirado}`,
      `🏷️  Enviados a Liquida:  ${porMotivo["a liquida"]}`,
      `💀 Vencidos:            ${porMotivo.vencido}`,
      `📭 Sin stock:           ${porMotivo["sin stock"]}`,
      `🔵 Dev. al proveedor:  ${porMotivo["devolucion proveedor"]}`,
      `📦 Total retirados:     ${registros.length}`,
      ``,
      `── VENCEN ESTE MES (activos) ──`,
      vencenEseMes.length === 0 ? `Sin productos activos que venzan este mes.` :
        vencenEseMes.map(p => `• ${p.descripcion} — vence ${fmtDate(p.vencimiento)}`).join("\n"),
      ``,
      `── DETALLE DE RETIRADOS ──`,
      registros.length === 0 ? `Sin registros para este período.` :
        registros.map(p => `• ${p.descripcion} [${p.motivo}] — retirado ${fmtDate(p.fechaRetiro)}`).join("\n"),
    ];
    return lineas.join("\n");
  };

  const compartirWhatsApp = () => {
    const texto = encodeURIComponent(generarTexto());
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  };

  const descargarPDF = async () => {
    setSharing(true);
    try {
      // Usamos la API de impresión del navegador como PDF
      const texto = generarTexto();
      const win = window.open("", "_blank");
      win.document.write(`
        <html><head><title>Reporte VencControl</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111; max-width: 600px; margin: 0 auto; }
          h1 { font-size: 20px; border-bottom: 2px solid #111; padding-bottom: 8px; }
          h2 { font-size: 15px; color: #444; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          p, li { font-size: 13px; line-height: 1.8; }
          ul { padding-left: 20px; }
          .meta { color: #666; font-size: 12px; }
          .stat { display: inline-block; background: #f5f5f5; border-radius: 8px; padding: 8px 16px; margin: 4px; font-size: 13px; font-weight: bold; }
          @media print { button { display: none; } }
        </style></head><body>
        <h1>📦 Reporte de Vencimientos</h1>
        <p class="meta">👤 ${nombre} &nbsp;·&nbsp; 🏪 ${config.sector} &nbsp;·&nbsp; 📅 ${MESES[mes]} ${anio}</p>
        <p class="meta">Generado: ${fmtDate(todayStr())}</p>
        <h2>Resumen del mes</h2>
        <span class="stat">⚠️ Retiros: ${porMotivo.retirado}</span>
        <span class="stat">🏷️ A Liquida: ${porMotivo["a liquida"]}</span>
        <span class="stat">💀 Vencidos: ${porMotivo.vencido}</span>
        <span class="stat">📦 Total: ${registros.length}</span>
        <h2>Vencen este mes (activos)</h2>
        ${vencenEseMes.length===0 ? "<p>Sin productos activos que venzan este mes.</p>" :
          "<ul>"+vencenEseMes.map(p=>`<li>${p.descripcion} — vence ${fmtDate(p.vencimiento)}</li>`).join("")+"</ul>"}
        <h2>Detalle de retirados</h2>
        ${registros.length===0 ? "<p>Sin registros para este período.</p>" :
          "<ul>"+registros.map(p=>`<li>${p.descripcion} <b>[${p.motivo}]</b> — retirado ${fmtDate(p.fechaRetiro)}</li>`).join("")+"</ul>"}
        <script>window.onload=()=>{ window.print(); }</script>
        </body></html>
      `);
      win.document.close();
    } finally {
      setSharing(false);
    }
  };

  // Meses disponibles (hasta el actual)
  const mesesDisp = [];
  for (let i=0; i<12; i++) {
    const m = (now.getMonth()-i+12)%12;
    const a = now.getFullYear() - (i > now.getMonth() ? 1 : 0);
    mesesDisp.push({m,a,label:`${MESES[m]} ${a}`});
  }

  return (
    <div style={S.view}>
      {/* Selector de mes */}
      <div style={R.card}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <span style={{fontSize:26}}>📊</span>
          <div><div style={{fontWeight:800,fontSize:17}}>Reporte Mensual</div><div style={{color:"#555",fontSize:12}}>Seleccioná el mes a reportar</div></div>
        </div>
        <select style={S.inp} value={`${mes}-${anio}`} onChange={e=>{const [m,a]=e.target.value.split("-");setMes(Number(m));setAnio(Number(a));}}>
          {mesesDisp.map(({m,a,label})=><option key={`${m}-${a}`} value={`${m}-${a}`}>{label}</option>)}
        </select>
      </div>

      {/* Resumen */}
      <div style={{...R.card,marginTop:12}}>
        <div style={R.sectionTitle}>Resumen — {MESES[mes]} {anio}</div>
        <div style={R.statsGrid}>
          {[
            {icon:"⚠️",label:"Retiros",  val:porMotivo.retirado,     color:"#ff6b00"},
            {icon:"🏷️",label:"A Liquida",val:porMotivo["a liquida"], color:"#ffd600"},
            {icon:"💀",label:"Vencidos", val:porMotivo.vencido,      color:"#ff2d55"},
            {icon:"📦",label:"Total",    val:registros.length,       color:"#00e5ff"},
          ].map(({icon,label,val,color})=>(
            <div key={label} style={{...R.statBox,borderColor:color}}>
              <span style={{fontSize:20}}>{icon}</span>
              <span style={{fontSize:24,fontWeight:900,color,lineHeight:1}}>{val}</span>
              <span style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase"}}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Vencen este mes */}
      {vencenEseMes.length>0&&(
        <div style={{...R.card,marginTop:12}}>
          <div style={R.sectionTitle}>📅 Vencen este mes ({vencenEseMes.length})</div>
          {vencenEseMes.sort((a,b)=>a.vencimiento.localeCompare(b.vencimiento)).map((p,i)=>{
            const st=getStatus(diffDays(p.vencimiento),config.diasLiquida,config.diasRetiro);
            const m=SM[st];
            return(<div key={i} style={R.row}><span style={{color:m.color,fontSize:13}}>{m.icon}</span><span style={R.rowName}>{p.descripcion}</span><span style={{color:m.color,fontSize:12,fontWeight:700,flexShrink:0}}>{fmtDate(p.vencimiento)}</span></div>);
          })}
        </div>
      )}

      {/* Detalle retirados */}
      <div style={{...R.card,marginTop:12,marginBottom:16}}>
        <div style={R.sectionTitle}>🗂️ Retirados este mes ({registros.length})</div>
        {registros.length===0
          ? <p style={{color:"#555",fontSize:13,margin:"8px 0 0"}}>Sin registros para {MESES[mes]} {anio}.</p>
          : registros.slice(0,50).map((p,i)=>{
              const mc={retirado:"#ff6b00",vencido:"#ff2d55","a liquida":"#ffd600"}[p.motivo]||"#555";
              return(<div key={i} style={R.row}>
                <span style={{fontSize:13,flexShrink:0}}>{p.motivo==="retirado"?"⚠️":p.motivo==="vencido"?"💀":"🏷️"}</span>
                <span style={R.rowName}>{p.descripcion}</span>
                <span style={{color:"#555",fontSize:11,flexShrink:0}}>{fmtDate(p.fechaRetiro)}</span>
              </div>);
            })
        }
      </div>

      {/* Botones compartir */}
      <div style={{display:"flex",flexDirection:"column",gap:10,paddingBottom:8}}>
        <button style={R.btnWA} onClick={compartirWhatsApp}>
          <span style={{fontSize:20}}>💬</span> Compartir por WhatsApp
        </button>
        <button style={{...R.btnPDF,opacity:sharing?0.9:1}} onClick={descargarPDF} disabled={sharing}>
          <span style={{fontSize:20}}>📄</span> {sharing?"Generando...":"Descargar / Imprimir PDF"}
        </button>
      </div>
    </div>
  );
}

const R = {
  card:        { background:"#161b22",border:"1px solid #1e2d3d",borderRadius:12,padding:"16px" },
  sectionTitle:{ fontWeight:800,fontSize:14,color:"#e6edf3",marginBottom:12 },
  statsGrid:   { display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8 },
  statBox:     { border:"1px solid",borderRadius:10,padding:"10px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:2 },
  row:         { display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #1e2d3d" },
  rowName:     { flex:1,fontSize:13,color:"#ccc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" },
  btnWA:       { background:"#075e54",border:"none",borderRadius:12,padding:"14px",fontWeight:800,fontSize:15,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:10 },
  btnPDF:      { background:"#1e2d3d",border:"1px solid #2a3d52",borderRadius:12,padding:"14px",fontWeight:800,fontSize:15,cursor:"pointer",color:"#8b949e",display:"flex",alignItems:"center",justifyContent:"center",gap:10 },
};

// ════════════════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════════════════
function ConfigView({ config, setConfig, nombre, setNombre, showToast, alertas, tema, setTema, avatar, setAvatar }) {
  const T = getThemeColors(tema);
  const [form,         setForm]         = useState(config);
  const [editNombre,   setEditNombre]   = useState(nombre);
  const [nomErr,       setNomErr]       = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = () => {
    if (!editNombre.trim()) { setNomErr("El nombre no puede estar vacío"); return; }
    setNomErr(""); setNombre(editNombre.trim()); setConfig(form);
    showToast("✓ Configuración guardada","ok");
  };

  return (
    <div style={S.view}>
      <div style={{...S.formCard,background:T.bg1,borderColor:T.border}}>
        <h2 style={{margin:"0 0 20px",fontWeight:800,fontSize:20,color:T.text}}>⚙️ Configuración</h2>

        {/* Nombre */}
        <div style={{marginBottom:20,background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:12,padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:22}}>👤</span>
            <div><div style={{fontWeight:800,color:"#e6edf3",fontSize:15}}>Tu nombre</div><div style={{color:"#555",fontSize:12}}>Aparece en el saludo</div></div>
          </div>
          <input style={{...S.inp,fontSize:16,fontWeight:700,textAlign:"center"}} value={editNombre} maxLength={30} placeholder="Tu nombre..." onChange={e=>{setEditNombre(e.target.value);setNomErr("");}}/>
          {nomErr&&<div style={{color:"#ff6b7a",fontSize:12,marginTop:6,textAlign:"center"}}>⚠️ {nomErr}</div>}
        </div>
        {/* Avatar */}
        <div style={{marginBottom:20,background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:12,padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:22}}>🖼️</span>
            <div><div style={{fontWeight:800,color:"#e6edf3",fontSize:15}}>Tu avatar</div><div style={{color:"#555",fontSize:12}}>Elegí uno o usá tus iniciales</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
            <div onClick={()=>setAvatar("")} style={{
              aspectRatio:"1",borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
              background:"#00e5ff",color:"#0d1117",fontWeight:800,fontSize:13,
              border: avatar===""?"3px solid #fff":"3px solid transparent",
            }}>
              {nombre.trim().split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"?"}
            </div>
            {AVATAR_SEEDS.map(seed=>(
              <img key={seed} src={avatarUrl(seed)} alt={seed} onClick={()=>setAvatar(seed)} style={{
                aspectRatio:"1",borderRadius:"50%",cursor:"pointer",background:"#1e2d3d",
                border: avatar===seed?"3px solid #00e5ff":"3px solid transparent",
              }}/>
            ))}
          </div>
        </div>

        {/* Sector */}
        <div style={{marginBottom:18}}>
          <label style={S.fLabel}>Mi Sector</label>
          <select style={S.inp} value={form.sector} onChange={e=>set("sector",e.target.value)}>
            {SECTORES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Slider Liquida */}
        <div style={{...S.cfgBlock,borderColor:"#ffd600",background:"#1a1600"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontSize:22}}>🏷️</span>
            <div style={{flex:1}}><div style={{fontWeight:800,color:"#ffd600"}}>Días para "Liquida"</div><div style={{color:"#666",fontSize:12}}>Cuándo mandar a descuentos</div></div>
            <span style={{fontSize:28,fontWeight:900,color:"#ffd600"}}>{form.diasLiquida}</span>
          </div>
          <input type="range" min="5" max="60" value={form.diasLiquida} onChange={e=>{const v=Number(e.target.value);set("diasLiquida",v);if(v<=form.diasRetiro)set("diasRetiro",v-1);}} style={{width:"100%",accentColor:"#ffd600"}}/>
          <div style={{display:"flex",justifyContent:"space-between",color:"#444",fontSize:11,marginTop:3}}><span>5d</span><span>30d</span><span>60d</span></div>
        </div>

        {/* Slider Retiro */}
        <div style={{...S.cfgBlock,borderColor:"#ff6b00",background:"#1a0d00",marginTop:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontSize:22}}>⚠️</span>
            <div style={{flex:1}}><div style={{fontWeight:800,color:"#ff6b00"}}>Días para "Retiro anticipado"</div><div style={{color:"#666",fontSize:12}}>Cuándo sacar de la góndola</div></div>
            <span style={{fontSize:28,fontWeight:900,color:"#ff6b00"}}>{form.diasRetiro}</span>
          </div>
          <input type="range" min="1" max={form.diasLiquida-1} value={form.diasRetiro} onChange={e=>set("diasRetiro",Number(e.target.value))} style={{width:"100%",accentColor:"#ff6b00"}}/>
          <div style={{display:"flex",justifyContent:"space-between",color:"#444",fontSize:11,marginTop:3}}><span>1d</span><span>{Math.round((form.diasLiquida-1)/2)}d</span><span>{form.diasLiquida-1}d</span></div>
        </div>

        {/* Resumen */}
        <div style={{background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#8b949e",lineHeight:2,marginTop:14}}>
          <div>✅ Más de <strong style={{color:"#00e676"}}>{form.diasLiquida} días</strong> → <strong style={{color:"#00e676"}}>OK</strong></div>
          <div>🏷️ Entre <strong style={{color:"#ffd600"}}>{form.diasRetiro+1}–{form.diasLiquida} días</strong> → <strong style={{color:"#ffd600"}}>Liquida</strong></div>
          <div>⚠️ Entre <strong style={{color:"#ff6b00"}}>0–{form.diasRetiro} días</strong> → <strong style={{color:"#ff6b00"}}>Retiro anticipado</strong></div>
          <div>💀 Pasada la fecha → <strong style={{color:"#ff2d55"}}>Vencido</strong></div>
        </div>

        <button style={{...S.btnPrimary,width:"100%",marginTop:16}} onClick={save}>✓ Guardar configuración</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// HELPERS UI
// ════════════════════════════════════════════════════════════════════════════════
function SectionHeader({icon,title,subtitle,color,count}){return(<div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16,padding:"14px 16px",background:`${color}10`,border:`1px solid ${color}30`,borderRadius:12}}><span style={{fontSize:28}}>{icon}</span><div><h2 style={{margin:0,color,fontSize:17,fontWeight:800}}>{title}</h2><p style={{margin:0,color:"#777",fontSize:12}}>{subtitle} · {count} producto{count!==1?"s":""}</p></div></div>);}
function Empty({icon,msg}){return <div style={S.emptyState}><span style={{fontSize:46}}>{icon}</span><p style={{color:"#555"}}>{msg}</p></div>;}
function Toast({msg,type}){const ok=type==="ok";return(<div style={{position:"fixed",top:66,left:"50%",transform:"translateX(-50%)",border:"1px solid",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:700,zIndex:999,backdropFilter:"blur(12px)",animation:"slideDown .25s ease",whiteSpace:"nowrap",background:ok?"#003a1f":"#3a1a00",borderColor:ok?"#00e676":"#ff6b00",color:ok?"#00e676":"#ff6b00"}}>{msg}</div>);}

// ════════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════════
const S = {
  root:         { minHeight:"100vh",background:"#0d1117",color:"#e6edf3",fontFamily:"'DM Sans','Segoe UI',sans-serif",display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto",position:"relative" },
  header:       { position:"sticky",top:0,zIndex:10,background:"rgba(13,17,23,.96)",borderBottom:"1px solid #1e2d3d",padding:"11px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",backdropFilter:"blur(12px)" },
  appTitle:     { fontWeight:800,fontSize:16,color:"#e6edf3" },
  appSub:       { fontSize:10,color:"#00e5ff",fontWeight:700,textTransform:"uppercase",letterSpacing:1 },
  alertBadge:   { background:"#2a1200",border:"1px solid #ff6b00",color:"#ff6b00",borderRadius:20,padding:"4px 10px",fontSize:12,fontWeight:800,cursor:"pointer",animation:"pulse 2s infinite" },
  liquidaBadge: { background:"#2a2200",border:"1px solid #ffd600",color:"#ffd600",borderRadius:20,padding:"4px 10px",fontSize:12,fontWeight:800,cursor:"pointer" },
  main:         { flex:1,overflowY:"auto",paddingBottom:140 },
  view:         { padding:"14px 12px" },
  statsRow:     { display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:14 },
  statCard:     { border:"1px solid",borderRadius:10,padding:"9px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",transition:"all .15s" },
  searchRow:    { display:"flex",alignItems:"center",gap:8,background:"#161b22",border:"1px solid #1e2d3d",borderRadius:10,padding:"9px 12px",marginBottom:10 },
  searchInput:  { flex:1,background:"transparent",border:"none",outline:"none",color:"#e6edf3",fontSize:14 },
  clearBtn:     { background:"transparent",border:"none",color:"#555",cursor:"pointer",fontSize:14,padding:0 },
  viewToggle:   { border:"1px solid #1e2d3d",borderRadius:8,padding:"0 12px",cursor:"pointer",fontSize:16,height:40,flexShrink:0,fontWeight:700,color:"inherit" },
  filtroActivo: { display:"flex",alignItems:"center",gap:6,border:"1px solid",borderRadius:8,padding:"6px 10px",marginBottom:12,fontSize:12,fontWeight:700 },
  productList:  { display:"flex",flexDirection:"column",gap:8 },
  weekHeader:   { display:"flex",alignItems:"center",gap:8,fontWeight:800,fontSize:13,color:"#8b949e",marginBottom:8,paddingLeft:2 },
  weekCount:    { background:"#1e2d3d",borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700,color:"#555" },
  emptyState:   { display:"flex",flexDirection:"column",alignItems:"center",gap:10,padding:"60px 20px",textAlign:"center" },
  card:         { background:"#161b22",border:"1px solid #1e2d3d",borderLeft:"4px solid",borderRadius:10,overflow:"hidden" },
  cardHeader:   { padding:"13px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",gap:8 },
  cardLeft:     { display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0 },
  cardName:     { fontWeight:700,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:190 },
  cardCode:     { fontSize:11,color:"#444",fontFamily:"monospace" },
  cardRight:    { display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0 },
  statusPill:   { fontSize:10,fontWeight:800,borderRadius:20,padding:"2px 8px",textTransform:"uppercase",whiteSpace:"nowrap" },
  cardBody:     { padding:"12px 14px 14px",borderTop:"1px solid #1e2d3d",display:"flex",flexDirection:"column",gap:10 },
  cardRow:      { display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,gap:8 },
  dateInputSm:  { background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:6,color:"#e6edf3",padding:"4px 8px",fontSize:12,outline:"none" },
  btnSm:        { background:"#00e676",border:"none",borderRadius:6,padding:"4px 8px",fontWeight:700,cursor:"pointer",fontSize:12,color:"#000" },
  btnDelCard:   { background:"rgba(255,45,85,.08)",border:"1px solid #ff2d5540",color:"#ff2d55",borderRadius:8,padding:"7px 12px",fontSize:12,cursor:"pointer",fontWeight:600,alignSelf:"flex-start" },
  btnMotivo:    { background:"#1e2d3d",border:"1px solid #2a3d52",borderRadius:8,color:"#ccc",padding:"8px 12px",fontSize:12,cursor:"pointer",fontWeight:600 },
  fab:          { position:"fixed",bottom:74,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#00e5ff,#0090b8)",border:"none",borderRadius:50,padding:"12px 28px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:"#0d1117",fontWeight:800,zIndex:50,boxShadow:"0 4px 20px rgba(0,229,255,.4)" },
  nav:          { position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(13,17,23,.97)",borderTop:"1px solid #1e2d3d",display:"flex",backdropFilter:"blur(16px)",zIndex:100 },
  navBtn:       { flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"10px 0",border:"none",background:"transparent",cursor:"pointer" },
  navBtnActive: { background:"rgba(0,229,255,.07)",borderTop:"2px solid #00e5ff" },
  navLabel:     { fontSize:9,color:"#8b949e",fontWeight:600,letterSpacing:.3 },
  navBadge:     { position:"absolute",top:-4,right:-7,background:"#ff2d55",color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,padding:"1px 5px",minWidth:16,textAlign:"center" },
  modalOverlay: { position:"fixed",inset:0,background:"rgba(0,0,0,.78)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" },
  modalBox:     { background:"#161b22",border:"1px solid #1e2d3d",borderRadius:16,padding:24,maxWidth:320,width:"90%",color:"#e6edf3" },
  formCard:     { background:"#161b22",border:"1px solid #1e2d3d",borderRadius:14,padding:20 },
  fLabel:       { display:"block",fontSize:12,fontWeight:700,color:"#8b949e",marginBottom:7,textTransform:"uppercase",letterSpacing:.5 },
  inp:          { width:"100%",background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:8,color:"#e6edf3",padding:"10px 12px",fontSize:14,outline:"none",boxSizing:"border-box" },
  cfgBlock:     { border:"1px solid",borderRadius:12,padding:"14px 16px" },
  btnPrimary:   { background:"linear-gradient(135deg,#00e5ff,#00b4d8)",border:"none",borderRadius:10,padding:"13px 20px",fontWeight:800,fontSize:15,cursor:"pointer",color:"#0d1117" },
  btnSecondary: { background:"#1e2d3d",border:"1px solid #2a3d52",borderRadius:10,padding:"12px 16px",color:"#8b949e",fontWeight:700,fontSize:14,cursor:"pointer" },
  btnDanger:    { background:"rgba(255,45,85,.15)",border:"1px solid #ff2d55",color:"#ff2d55",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:14,cursor:"pointer" },
};