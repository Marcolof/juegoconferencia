"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { takePendingQr, usePlayer } from "@/lib/player";
import { useActiveEncounterRedirect } from "@/lib/encounters";
import { usePhotoUrls } from "@/lib/photos";
import { Ranking } from "@/components/Ranking";
import { Tour } from "@/components/Tour";
import { Avatar, LinkButton, PlayerGate, Screen, signOutAndGo } from "@/components/ui";

export default function PrincipalPage() {
  const router = useRouter();
  const { state, status, supabase } = usePlayer("ready");
  const photo = usePhotoUrls([state?.photo_path]);
  useActiveEncounterRedirect(status === "ok" ? supabase : null, state?.id);
  const [tourOpen, setTourOpen] = useState(false);

  // La primera vez que llega a la pantalla principal se abre el tour (R84).
  useEffect(() => {
    if (status === "ok" && state && !state.tour_done) setTourOpen(true);
  }, [status, state]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    if (state && !state.tour_done && supabase) void supabase.rpc("mark_tour_done");
  }, [state, supabase]);

  // Si entró escaneando un QR con la cámara del teléfono, se retoma ese QR.
  useEffect(() => {
    if (status !== "ok") return;
    const pending = takePendingQr();
    if (pending) router.replace(`/q/${pending}`);
  }, [status, router]);

  if (status !== "ok" || !state || !supabase) return <PlayerGate status={status} />;

  return (
    <Screen>
      <header className="mb-5 flex items-center gap-3">
        <Link href="/foto" aria-label="Cambiar foto">
          <Avatar
            firstName={state.first_name}
            lastName={state.last_name}
            url={state.photo_path ? photo[state.photo_path] : null}
            size={48}
          />
        </Link>
        <div className="flex-1">
          <p className="text-sm text-muted">Hola,</p>
          <p className="text-lg font-bold leading-tight">{state.first_name}</p>
        </div>
        <button onClick={() => void signOutAndGo()} className="text-sm text-muted underline-offset-4 hover:underline">
          Salir
        </button>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <LinkButton href="/mi-qr" className="min-h-24 flex-col text-lg">
          <span aria-hidden className="text-2xl">▣</span>
          Mostrar mi QR
        </LinkButton>
        <LinkButton href="/escanear" variant="secondary" className="min-h-24 flex-col text-lg">
          <span aria-hidden className="text-2xl">⌖</span>
          Escanear QR
        </LinkButton>
      </div>

      <Ranking supabase={supabase} playerId={state.id} />

      <p className="mt-6 flex justify-center gap-5 text-sm">
        <Link href="/respuestas" className="text-brand underline-offset-4 hover:underline">
          {state.answers_locked ? "Ver mis respuestas" : "Editar mis respuestas"}
        </Link>
        <button onClick={() => setTourOpen(true)} className="text-brand underline-offset-4 hover:underline">
          ¿Cómo se juega?
        </button>
      </p>

      <Tour open={tourOpen} onClose={closeTour} />
    </Screen>
  );
}
