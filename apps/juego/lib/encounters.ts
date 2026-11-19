"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lleva al jugador a su encuentro en curso apenas alguien lo escanea.
 * Usa Realtime y, por si la conexión en vivo falla, consulta cada 4 segundos.
 */
export function useActiveEncounterRedirect(supabase: SupabaseClient | null, playerId: string | undefined) {
  const router = useRouter();

  useEffect(() => {
    if (!supabase || !playerId) return;
    let stopped = false;

    async function check() {
      if (stopped || !supabase) return;
      const { data } = await supabase.rpc("get_my_active_encounter");
      if (!stopped && typeof data === "string" && data) {
        stopped = true;
        router.push(`/encuentro/${data}`);
      }
    }

    const channel = supabase
      .channel(`mis-encuentros-${playerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "encounters", filter: `player_b=eq.${playerId}` },
        () => void check(),
      )
      .subscribe();

    void check();
    const timer = setInterval(() => void check(), 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [supabase, playerId, router]);
}
