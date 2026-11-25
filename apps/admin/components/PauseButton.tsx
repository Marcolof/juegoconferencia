"use client";

import { useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { buttonClass } from "@juego/shared/ui";
import { setGamePaused } from "@/app/(panel)/actions";

/**
 * Pausar o reanudar el juego (F47, R110). En pausa nadie empieza encuentros ni
 * responde preguntas, y el reloj de los encuentros se congela; al reanudar,
 * cada uno recupera el tiempo que le quedaba. Siempre pide confirmación.
 */
export function PauseButton({ paused }: { paused: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();
  const Icon = paused ? Play : Pause;

  return (
    <>
      <button type="button" onClick={open} className={buttonClass({ variant: "secondary", className: "min-h-11 px-5" })}>
        <Icon size={16} aria-hidden />
        {paused ? "Reanudar juego" : "Pausar juego"}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="pausar-reanudar"
        onClick={(e) => {
          if (e.target === dialogRef.current && !busy) close();
        }}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
      >
        <form
          action={async () => {
            setBusy(true);
            await setGamePaused(!paused);
          }}
          className="p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon size={20} aria-hidden />
            </span>
            <div className="flex-1">
              <h2 id="pausar-reanudar" className="text-lg font-bold">
                {paused ? "¿Reanudar el juego?" : "¿Pausar el juego?"}
              </h2>
              {paused ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                  <li>Los jugadores pueden volver a escanear QR y a responder.</li>
                  <li>Los encuentros que estaban a medias siguen con el tiempo que les quedaba.</li>
                </ul>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                  <li>Nadie puede empezar encuentros ni responder preguntas.</li>
                  <li>El reloj de los encuentros a medias se detiene: no se pierde tiempo.</li>
                  <li>Los jugadores ven «El juego está en pausa».</li>
                  <li>El ranking y los puntos se conservan.</li>
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
            <button type="button" onClick={close} disabled={busy} className={buttonClass({ variant: "secondary" })}>
              Cancelar
            </button>
            <button type="submit" disabled={busy} className={buttonClass({ variant: "primary" })}>
              <Icon size={16} aria-hidden />
              {busy ? (paused ? "Reanudando…" : "Pausando…") : paused ? "Sí, reanudar" : "Sí, pausar"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
