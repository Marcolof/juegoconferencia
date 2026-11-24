"use client";

import { useRef, useState } from "react";
import { Trash2, TriangleAlert, X } from "lucide-react";
import { deletePlayer } from "@/app/(panel)/actions";
import { buttonClass } from "@juego/shared/ui";

/**
 * Botón de tachito para eliminar un jugador desde el listado de Personas
 * (F37, R91). Abre un modal de confirmación antes de borrar.
 */
export function DeletePlayerButton({ id, name }: { id: string; name: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={`Eliminar a ${name}`}
        title="Eliminar"
        className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-bad-soft hover:text-bad"
      >
        <Trash2 size={18} aria-hidden />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`eliminar-${id}`}
        onClick={(e) => {
          // Cerrar al tocar fuera de la caja.
          if (e.target === dialogRef.current && !busy) close();
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
      >
        <form
          action={async () => {
            setBusy(true);
            await deletePlayer(id);
          }}
          className="p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bad-soft text-bad">
              <TriangleAlert size={20} aria-hidden />
            </span>
            <div className="flex-1">
              <h2 id={`eliminar-${id}`} className="text-lg font-bold">
                ¿Eliminar a {name}?
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Se borran su cuenta, su foto, sus respuestas y sus encuentros.</li>
                <li>Los puntos que otros jugadores ganaron con esta persona se pierden.</li>
                <li>
                  <strong className="text-ink">No queda bloqueada:</strong> puede volver a crear su cuenta con el mismo
                  email.
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
              className={buttonClass({ variant: "secondary" })}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className={buttonClass({ variant: "danger" })}
            >
              <Trash2 size={16} aria-hidden />
              {busy ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
