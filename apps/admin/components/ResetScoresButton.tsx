"use client";

import { useRef, useState } from "react";
import { RotateCcw, TriangleAlert, X } from "lucide-react";
import { resetScores } from "@/app/(panel)/actions";
import { buttonClass } from "@juego/shared/ui";

/**
 * Botón para resetear el juego. Abre un modal con dos opciones (F44, R103):
 * - sólo el puntaje: borra los encuentros y conserva las respuestas;
 * - puntaje y respuestas: además borra las respuestas de todos los jugadores
 *   y sus opciones de la IA, para que cada uno vuelva a elegir y responder.
 * Siempre explica qué se borra y qué se conserva antes de confirmar.
 */
export function ResetScoresButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [withAnswers, setWithAnswers] = useState(false);

  const open = () => {
    setWithAnswers(false);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const optionClass = (on: boolean) =>
    `flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition ${
      on ? "bg-bad-soft ring-bad" : "ring-line hover:bg-canvas"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={buttonClass({ variant: "dangerOutline" })}
      >
        <RotateCcw size={16} aria-hidden />
        Resetear
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="resetear"
        onClick={(e) => {
          if (e.target === dialogRef.current && !busy) close();
        }}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
      >
        <form
          action={async (form) => {
            setBusy(true);
            await resetScores(form);
          }}
          className="p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bad-soft text-bad">
              <TriangleAlert size={20} aria-hidden />
            </span>
            <div className="flex-1">
              <h2 id="resetear" className="text-lg font-bold">
                ¿Qué querés resetear?
              </h2>
              <p className="mt-1 text-sm text-muted">
                <strong className="text-ink">No se puede deshacer.</strong> En los dos casos el juego vuelve a{" "}
                <strong className="text-ink">«aún no inició»</strong> y hay que volver a iniciarlo.
              </p>
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

          <fieldset className="mt-4 flex flex-col gap-2">
            <legend className="sr-only">Qué resetear</legend>
            <label className={optionClass(!withAnswers)}>
              <input
                type="radio"
                name="scope"
                checked={!withAnswers}
                onChange={() => setWithAnswers(false)}
                className="mt-1 size-4"
              />
              <span className="text-sm">
                <span className="font-semibold">Sólo el puntaje</span>
                <span className="mt-0.5 block text-muted">
                  Borra los encuentros y los puntos: el ranking vuelve a cero y las parejas pueden volver a jugar. Las
                  respuestas de cada jugador se conservan.
                </span>
              </span>
            </label>
            <label className={optionClass(withAnswers)}>
              <input
                type="radio"
                name="scope"
                checked={withAnswers}
                onChange={() => setWithAnswers(true)}
                className="mt-1 size-4"
              />
              <span className="text-sm">
                <span className="font-semibold">Puntaje y respuestas</span>
                <span className="mt-0.5 block text-muted">
                  Además borra las respuestas de todos los jugadores y sus opciones de la IA. Cada uno vuelve a elegir y
                  responder sus preguntas al entrar.
                </span>
              </span>
            </label>
            {withAnswers && <input type="hidden" name="include_answers" value="on" />}
          </fieldset>

          <p className="mt-3 text-xs text-muted">
            <strong className="text-ink">No se borra</strong> ninguna cuenta ni foto.
          </p>

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
              className={buttonClass({ variant: "danger" })}
            >
              <RotateCcw size={16} aria-hidden />
              {busy ? "Reseteando…" : withAnswers ? "Sí, resetear puntaje y respuestas" : "Sí, resetear el puntaje"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
