// Ruta del servidor que genera con Claude las opciones falsas (F41, R97).
//
//   POST { modo: "mias" }       → las del jugador que llama (al guardar sus respuestas).
//   POST { modo: "pendientes" } → las que falten de todos (sólo administración, desde el panel).
//
// Siempre con el token de sesión de Supabase en Authorization: Bearer <token>.
// Variables de entorno del servidor (nunca NEXT_PUBLIC_): ANTHROPIC_API_KEY y
// SUPABASE_SERVICE_ROLE_KEY. Sin ellas responde 503 y el juego sigue con la
// regla anterior (respuestas de otros jugadores y listado de respaldo).

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AiProviderError, createProvider, findPendingPlayers, generateForPlayer } from "@/lib/ai-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Jugadores que se procesan por llamada en modo "pendientes" (el panel repite hasta terminar). */
const PLAYERS_PER_BATCH = 4;

// La llama también el panel de administración, que vive en otro dominio. La
// ruta exige un token de sesión válido, así que el origen no da acceso por sí solo.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const provider = createProvider();
  if (!url || !serviceKey || !provider) return reply({ ok: false, error: "ia_no_configurada" }, 503);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply({ ok: false, error: "no_autenticado" }, 401);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await db.auth.getUser(token);
  const user = auth?.user;
  if (!user) return reply({ ok: false, error: "no_autenticado" }, 401);

  const body = (await req.json().catch(() => ({}))) as { modo?: string };

  try {
    if (body.modo === "pendientes") {
      const { data: me } = await db.from("profiles").select("role, status").eq("id", user.id).maybeSingle();
      if (me?.role !== "admin" || me?.status !== "activo") return reply({ ok: false, error: "sin_permiso" }, 403);

      const pending = await findPendingPlayers(db);
      const batch = pending.slice(0, PLAYERS_PER_BATCH);
      const results = await Promise.allSettled(batch.map((id) => generateForPlayer(db, provider, id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      const saved = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value.saved : 0), 0);
      return reply({
        ok: true,
        processed: batch.length,
        failed,
        saved,
        remaining: pending.length - (batch.length - failed),
      });
    }

    const result = await generateForPlayer(db, provider, user.id);
    return reply({ ok: true, ...result });
  } catch (err) {
    // Errores del proveedor de IA (Gemini o Claude): el detalle queda en el log, no se expone.
    if (err instanceof AiProviderError || (err instanceof Error && "status" in err)) {
      console.error(`opciones-ia: error de ${provider.name}`, err.message);
      return reply({ ok: false, error: "ia_error" }, 502);
    }
    console.error("opciones-ia:", err instanceof Error ? err.message : err);
    return reply({ ok: false, error: "fallo_interno" }, 500);
  }
}
