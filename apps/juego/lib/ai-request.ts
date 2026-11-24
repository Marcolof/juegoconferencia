"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pide al servidor que genere con IA las opciones falsas de mis respuestas
 * (F41, R97). No espera el resultado ni muestra errores: si falla o la IA no
 * está configurada, el juego usa la regla anterior. `keepalive` deja que el
 * pedido termine aunque el jugador ya haya cambiado de pantalla.
 */
export async function requestAiOptions(supabase: SupabaseClient): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/opciones-ia", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ modo: "mias" }),
      keepalive: true,
    });
  } catch {
    /* sin conexión o sin IA: se usan las opciones de siempre */
  }
}
