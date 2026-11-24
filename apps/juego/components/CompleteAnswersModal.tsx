"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ListChecks } from "lucide-react";

/**
 * Aviso que no se puede cerrar: hay que completar las respuestas para poder
 * participar (el administrador subió el mínimo). Lleva a la pantalla de preguntas.
 */
export function CompleteAnswersModal({ missing, min, have }: { missing: number; min: number; have: number }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="completar-titulo"
      // Con Escape no se cierra: es obligatorio completarlas.
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
          <ListChecks size={24} aria-hidden />
        </span>
        <h2 id="completar-titulo" className="mt-4 text-xl font-bold">
          Completá tus preguntas para participar
        </h2>
        <p className="mt-2 text-muted">
          Ahora se piden al menos <strong className="text-ink">{min} preguntas</strong> y vos respondiste {have}. Te{" "}
          {missing === 1 ? "falta 1" : `faltan ${missing}`}.
        </p>
        <Link
          href="/respuestas"
          className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-brand px-4 text-base font-semibold text-white active:opacity-90"
        >
          Completar mis preguntas
        </Link>
      </div>
    </dialog>
  );
}
