"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { TourScene } from "@/components/TourScene";
import { pressableClass } from "@juego/shared/ui";

/** Pasos del tour de bienvenida (F34, R83). Cada uno lleva una ilustración animada (F51). */
const STEPS: readonly { title: string; text: string }[] = [
  {
    title: "Conocé gente nueva",
    text: "El objetivo es charlar con personas de la convención y descubrir algo de cada una. Cada vez que adivinás una respuesta, sumás 1 punto.",
  },
  {
    title: "Mostrá o escaneá un QR",
    text: "Con «Escanear QR» leés el código de otra persona y empieza el encuentro. Con «Mostrar mi QR» dejás que te escaneen a vos. Cada pareja juega una sola vez.",
  },
  {
    title: "Charlá y elegí",
    text: "Vas a ver una pregunta sobre la otra persona con 3 opciones: una es la verdadera. Preguntale y elegí. Después le toca a ella con una pregunta sobre vos. Tienen 5 minutos.",
  },
  {
    title: "Mirá tu progreso",
    text: "Abajo, en «Mi progreso», ves tus encuentros y tus puntos; en «Jugadores», a todas las personas que participan. Tus respuestas las podés cambiar con «Mis respuestas» mientras el juego no esté en curso.",
  },
];

/**
 * Tour de bienvenida: se muestra la primera vez que el jugador llega a la
 * pantalla principal (R84) y se puede volver a abrir con «¿Cómo se juega?».
 */
export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, i, onClose]);

  if (!open) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {/* Casi toda la altura de la pantalla: la ilustración animada ocupa lo que dejan los textos (F51). */}
      <div className="flex h-[calc(100dvh-1.5rem)] max-h-[860px] w-full max-w-md flex-col rounded-3xl bg-surface p-5 shadow-xl sm:h-[calc(100dvh-2rem)] sm:p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">
            {i + 1} de {STEPS.length}
          </span>
          {!last && (
            <button onClick={onClose} className={`rounded-md text-sm text-muted underline-offset-4 hover:underline ${pressableClass}`}>
              Saltar
            </button>
          )}
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-2xl bg-illus">
          <TourScene key={i} step={i} />
        </div>
        <h2 id="tour-title" ref={titleRef} tabIndex={-1} className="mt-4 text-xl font-bold outline-none">
          {step.title}
        </h2>
        <p className="mt-2 text-base leading-relaxed text-muted">{step.text}</p>

        <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
          {STEPS.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-brand" : "w-1.5 bg-line"}`} />
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          {i > 0 && (
            <Button variant="secondary" onClick={() => setI(i - 1)}>
              Atrás
            </Button>
          )}
          <Button onClick={() => (last ? onClose() : setI(i + 1))}>{last ? "¡A jugar!" : "Siguiente"}</Button>
        </div>
      </div>
    </div>
  );
}
