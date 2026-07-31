import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

const supabase = createClient(SUPA_URL, SERVICE_KEY);

function diasDesde(fecha: string) {
  const f = new Date(fecha + "T00:00:00");
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

Deno.serve(async () => {
  try {
    // Config de umbrales: usamos los valores por defecto de VencControl (30 / 15)
    // ya que la configuración vive en localStorage de cada celular, no en Supabase.
    const DIAS_LIQUIDA = 30;
    const DIAS_RETIRO = 15;

    const { data: productos, error } = await supabase.from("productos").select("*");
    if (error) throw error;

    let liquida = 0, dap = 0, retirarGondola = 0, retiroAnticipado = 0;

    for (const p of productos ?? []) {
      if (!p.vencimiento) continue;
      const dias = diasDesde(p.vencimiento);

      // 2. Liquida — automático (status liquida) o marcado manual (pasado_liquida)
      const esLiquidaAuto = dias > DIAS_RETIRO && dias <= DIAS_LIQUIDA;
      const esLiquida = esLiquidaAuto || p.pasado_liquida;
      if (esLiquida) liquida++;

      // 4. Retiro anticipado — status retiro (todavía no vencido, aún no pasó por Liquida)
      const esRetiroAnticipado = dias >= 0 && dias <= DIAS_RETIRO;
      if (esRetiroAnticipado) retiroAnticipado++;

      // 1. D.A.P. — solo si además está en Liquida o Retiro anticipado
      if (p.dap && (esLiquida || esRetiroAnticipado)) dap++;

      // 3. Retirar de góndola — vencido Y ya pasó por Liquida
      if (dias < 0 && (p.en_gondola || p.pasado_liquida)) retirarGondola++;
    }

    let body: string;
    if (liquida + dap + retirarGondola + retiroAnticipado === 0) {
      body = "Todo en orden. Sin productos para Liquida, D.A.P. ni para retirar.";
    } else {
      const partes = [];
      if (liquida > 0) partes.push(`${liquida} en góndola de Liquida`);
      if (dap > 0) partes.push(`${dap} para D.A.P.`);
      if (retirarGondola > 0) partes.push(`${retirarGondola} para retirar de góndola`);
      if (retiroAnticipado > 0) partes.push(`${retiroAnticipado} para retiro anticipado`);
      body = partes.join(" · ");
    }

    const { data: subs } = await supabase.from("push_subscriptions").select("*");

    const webpush = await import("npm:web-push@3");
    webpush.setVapidDetails("mailto:juan@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    let enviados = 0;
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify({
          title: "📦 VencControl",
          body,
          tag: "venccontrol-alerta",
          url: "/"
        }));
        enviados++;
      } catch (e) {
        console.error("Error enviando a", s.endpoint, e);
        if (e.statusCode === 404 || e.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, enviados, body }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});