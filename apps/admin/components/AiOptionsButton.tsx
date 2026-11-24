"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase-browser";

// La ruta que habla con Claude vive en la app del juego (F41, R97).
const JUEGO_URL = process.env.NEXT_PUBLIC_JUEGO_URL ?? "https://juegoconferencia-juego.vercel.app";

/**
 * Genera con IA las opciones falsas que falten (jugadores que guardaron sus
 * respuestas cuando la IA no estaba configurada o falló). Va de a pocos
 * jugadores por pedido y repite hasta terminar.
 */
export function AiOptionsButton({ pending }: { pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function run() {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("no_autenticado");
      let saved = 0;
      for (let round = 0; round < 50; round++) {
        const res = await fetch(`${JUEGO_URL}/api/opciones-ia`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ modo: "pendientes" }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          saved?: number;
          remaining?: number;
          processed?: number;
          failed?: number;
        };
        if (!res.ok || !body.ok) {
          const text =
            body.error === "ia_no_configurada"
              ? "La IA no está configurada: falta cargar ANTHROPIC_API_KEY y SUPABASE_SERVICE_ROLE_KEY en el proyecto del juego en Vercel."
              : body.error === "sin_permiso"
                ? "Esta cuenta no tiene permiso de administración."
                : "No se pudo hablar con la IA. Probá de nuevo en un rato.";
          setMsg({ tone: "error", text });
          return;
        }
        saved += body.saved ?? 0;
        if (!body.remaining || body.processed === 0 || body.processed === body.failed) break;
      }
      setMsg({ tone: "ok", text: `Listo: se generaron opciones para ${saved} respuestas.` });
    } catch {
      setMsg({ tone: "error", text: "No se pudo conectar con el juego. Revisá la conexión." });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || pending === 0}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
      >
        <Sparkles size={16} aria-hidden />
        {busy ? "Generando…" : "Generar las que faltan"}
      </button>
      {msg && (
        <p
          role={msg.tone === "error" ? "alert" : "status"}
          className={`mt-3 rounded-xl px-4 py-3 text-sm ${msg.tone === "error" ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
