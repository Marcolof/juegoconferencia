"use client";

import { useRef, useState } from "react";
import { Play, Square, TriangleAlert, X } from "lucide-react";
import { endCompetitionNow, startCompetitionNow } from "@/app/(panel)/actions";
import { buttonClass } from "@juego/shared/ui";

/**
 * Un solo botón para iniciar o finalizar el juego (F44, R102). Cambia según el
 * estado: «Iniciar juego» si no está en curso y «Finalizar juego» si lo está.
 * Siempre pide confirmación en un modal.
 */
export function GameToggleButton({ running }: { running: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  const Icon = running ? Square : Play;
  const label = running ? "Finalizar juego" : "Iniciar juego";

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={buttonClass({ variant: running ? "danger" : "success", className: "min-h-11 px-5" })}
      >
        <Icon size={16} aria-hidden />
        {label}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="iniciar-finalizar"
        onClick={(e) => {
          if (e.target === dialogRef.current && !busy) close();
        }}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
      >
        <form
          action={async () => {
            setBusy(true);
            if (running) await endCompetitionNow();
            else await startCompetitionNow();
          }}
          className="p-6"
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${
                running ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"
              }`}
            >
              {running ? <TriangleAlert size={20} aria-hidden /> : <Play size={20} aria-hidden />}
            </span>
            <div className="flex-1">
              <h2 id="iniciar-finalizar" className="text-lg font-bold">
                {running ? "¿Finalizar el juego?" : "¿Iniciar el juego?"}
              </h2>
              {running ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                  <li>Desde ahora nadie puede escanear un QR ni empezar un encuentro nuevo.</li>
                  <li>Los encuentros que ya empezaron se pueden terminar.</li>
                  <li>El ranking y los puntos se conservan.</li>
                  <li>Lo podés volver a iniciar cuando quieras.</li>
                </ul>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                  <li>Los jugadores ven las opciones para jugar y pueden escanear QR desde ahora.</li>
                  <li>Las respuestas quedan fijas para quien juegue su primer encuentro.</li>
                  <li>Si el juego ya se había finalizado, se reabre: los puntos anteriores se conservan.</li>
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label="Cerrar"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas"
            >
              <X size={18} aria-hidden />
            </button>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className={buttonClass({ variant: "secondary" })}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className={buttonClass({ variant: running ? "danger" : "success" })}
            >
              <Icon size={16} aria-hidden />
              {busy ? (running ? "Finalizando…" : "Iniciando…") : running ? "Sí, finalizar" : "Sí, iniciar"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
