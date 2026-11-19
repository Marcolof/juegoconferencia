"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CircleHelp, ListChecks, LogOut, PencilLine, QrCode, ScanQrCode } from "lucide-react";
import { takePendingQr, usePlayer } from "@/lib/player";
import { useActiveEncounterRedirect } from "@/lib/encounters";
import { usePhotoUrls } from "@/lib/photos";
import { useCompetition } from "@/lib/competition";
import { CompetitionNotice } from "@/components/CompetitionNotice";
import { Ranking } from "@/components/Ranking";
import { Tour } from "@/components/Tour";
import { Avatar, LinkButton, PlayerGate, Screen, signOutAndGo } from "@/components/ui";

// Recuerda en la sesión que el tour ya se vio, por si la base tarda en guardarlo.
const TOUR_SEEN_KEY = "juego:tour-visto";

function tourSeenInSession(): boolean {
  try {
    return sessionStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markTourSeenInSession() {
  try {
    sessionStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    /* sin almacenamiento: alcanza con lo guardado en la cuenta */
  }
}

const chip =
  "flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-surface px-3 text-sm font-semibold text-ink ring-1 ring-line transition active:bg-brand-soft";

export default function PrincipalPage() {
  const router = useRouter();
  const { state, status, supabase } = usePlayer("ready");
  const photo = usePhotoUrls([state?.photo_path]);
  useActiveEncounterRedirect(status === "ok" ? supabase : null, state?.id);
  const [tourOpen, setTourOpen] = useState(false);
  const comp = useCompetition(state);

  // El tour se abre sólo la primera vez que la cuenta llega a la principal (R84).
  useEffect(() => {
    if (status === "ok" && state && !state.tour_done && !tourSeenInSession()) setTourOpen(true);
  }, [status, state]);

  const closeTour = useCallback(async () => {
    setTourOpen(false);
    markTourSeenInSession();
    if (state && !state.tour_done && supabase) {
      // El pedido a Supabase sólo se envía cuando se espera: sin el await no llegaba
      // a la base y el tour se volvía a abrir al regresar a esta pantalla (F35).
      await supabase.rpc("mark_tour_done");
    }
  }, [state, supabase]);
  const onTourClose = useCallback(() => void closeTour(), [closeTour]);

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
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">Hola,</p>
          <p className="truncate text-lg font-bold leading-tight">{state.first_name}</p>
        </div>
        <button
          onClick={() => void signOutAndGo()}
          className="flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted transition hover:bg-surface active:bg-surface"
        >
          <LogOut size={18} aria-hidden />
          Salir
        </button>
      </header>

      <CompetitionNotice phase={comp.phase} paused={comp.paused} start={comp.start} end={comp.end} />

      {comp.canScan ? (
        <div className="grid grid-cols-2 gap-3">
          <LinkButton href="/mi-qr" className="min-h-24 flex-col text-lg">
            <QrCode size={30} aria-hidden />
            Mostrar mi QR
          </LinkButton>
          <LinkButton href="/escanear" variant="secondary" className="min-h-24 flex-col text-lg">
            <ScanQrCode size={30} aria-hidden />
            Escanear QR
          </LinkButton>
        </div>
      ) : (
        // Fuera de la competencia los botones de QR quedan a la vista pero bloqueados.
        <div className="grid grid-cols-2 gap-3" aria-disabled>
          <div className="flex min-h-24 cursor-not-allowed flex-col items-center justify-center gap-2 rounded-2xl bg-brand/40 text-lg font-semibold text-white/90">
            <QrCode size={30} aria-hidden />
            Mostrar mi QR
          </div>
          <div className="flex min-h-24 cursor-not-allowed flex-col items-center justify-center gap-2 rounded-2xl bg-surface text-lg font-semibold text-muted opacity-60 ring-1 ring-line">
            <ScanQrCode size={30} aria-hidden />
            Escanear QR
          </div>
        </div>
      )}

      {/* Accesos secundarios arriba del ranking, para que no queden fuera de la vista (F35). */}
      <nav aria-label="Más opciones" className="mb-5 mt-3 grid grid-cols-2 gap-3">
        <Link href="/respuestas" className={chip}>
          {state.answers_locked ? (
            <ListChecks size={18} className="text-brand" aria-hidden />
          ) : (
            <PencilLine size={18} className="text-brand" aria-hidden />
          )}
          Mis respuestas
        </Link>
        <button type="button" onClick={() => setTourOpen(true)} className={chip}>
          <CircleHelp size={18} className="text-brand" aria-hidden />
          Cómo se juega
        </button>
      </nav>

      <Ranking supabase={supabase} playerId={state.id} />

      <Tour open={tourOpen} onClose={onTourClose} />
    </Screen>
  );
}
