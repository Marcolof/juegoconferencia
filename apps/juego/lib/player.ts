"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MyState } from "@juego/shared";
import { getSupabase } from "./supabase";

export type PlayerStatus = "loading" | "ok" | "no-config" | "suspended" | "admin" | "error";

const PENDING_QR_KEY = "juego:qr-pendiente";

/**
 * Carga el estado del jugador y lo manda a la pantalla que corresponde.
 * - "auth": alcanza con tener sesión (pantallas de foto y respuestas).
 * - "ready": además tiene que haber completado la foto y sus respuestas (R81).
 */
export function usePlayer(gate: "auth" | "ready") {
  const router = useRouter();
  const supabase = getSupabase();
  const [state, setState] = useState<MyState | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");

  const load = useCallback(async (): Promise<MyState | null> => {
    if (!supabase) {
      setStatus("no-config");
      return null;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.replace("/ingresar");
      return null;
    }
    const { data, error } = await supabase.rpc("get_my_state");
    if (error) {
      if (error.message.includes("no_autenticado")) {
        await supabase.auth.signOut();
        router.replace("/ingresar");
        return null;
      }
      setStatus("error");
      return null;
    }
    const s = data as MyState;
    setState(s);
    if (s.status === "suspendido") {
      setStatus("suspended");
      return s;
    }
    // Las cuentas de administración no juegan: usan el panel.
    if (s.role === "admin") {
      setStatus("admin");
      return s;
    }
    if (gate === "ready") {
      if (!s.photo_step_done) {
        router.replace("/foto");
        return s;
      }
      if (!s.answers_ready) {
        router.replace("/respuestas");
        return s;
      }
    }
    setStatus("ok");
    return s;
  }, [supabase, router, gate]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, status, reload: load, supabase };
}

/** Guarda un QR escaneado con la cámara del teléfono para usarlo después de ingresar. */
export function savePendingQr(token: string) {
  try {
    sessionStorage.setItem(PENDING_QR_KEY, token);
  } catch {
    /* sin almacenamiento: se pierde el QR pendiente, no es grave */
  }
}

export function takePendingQr(): string | null {
  try {
    const t = sessionStorage.getItem(PENDING_QR_KEY);
    if (t) sessionStorage.removeItem(PENDING_QR_KEY);
    return t;
  } catch {
    return null;
  }
}

/** Saca el código del QR, sea la URL completa (…/q/CODIGO) o el código solo. */
export function tokenFromQr(raw: string): string {
  const text = raw.trim();
  const match = text.match(/\/q\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : text;
}
