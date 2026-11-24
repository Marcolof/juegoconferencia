"use client";

import { useRef, useState } from "react";
import { RotateCcw, TriangleAlert, X } from "lucide-react";
import { resetScores } from "@/app/(panel)/actions";

/**
 * Botón para resetear el puntaje de todos los jugadores. Abre un modal que
 * explica qué se borra y qué se conserva antes de confirmar.
 */
export function ResetScoresButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-surface px-4 text-sm font-semibold text-bad ring-1 ring-line transition hover:bg-bad-soft"
      >
        <RotateCcw size={16} aria-hidden />
        Resetear puntaje
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="resetear-puntaje"
        onClick={(e) => {
          if (e.target === dialogRef.current && !busy) close();
        }}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
      >
        <form
          action={async () => {
            setBusy(true);
            await resetScores();
          }}
          className="p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bad-soft text-bad">
              <TriangleAlert size={20} aria-hidden />
            </span>
            <div className="flex-1">
              <h2 id="resetear-puntaje" className="text-lg font-bold">
                ¿Resetear el puntaje de todos?
              </h2>
              <p className="mt-2 text-sm text-muted">
                <strong className="text-ink">No se puede deshacer.</strong> Se borran todos los encuentros jugados y los
                puntos de cada jugador: el ranking vuelve a cero.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Las respuestas dejan de estar fijas: cada persona puede volver a editarlas hasta su próximo encuentro.</li>
                <li>Las parejas que ya jugaron pueden volver a jugar.</li>
                <li>
                  <strong className="text-ink">No se borra</strong> ninguna cuenta, foto, respuesta ni opción de la IA.
                </li>
              </ul>
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
              className="inline-flex min-h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold ring-1 ring-line hover:bg-canvas disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-bad px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <RotateCcw size={16} aria-hidden />
              {busy ? "Reseteando…" : "Sí, resetear"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
