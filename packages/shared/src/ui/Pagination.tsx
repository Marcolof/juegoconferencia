"use client";

import { pressableClass } from "./button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Elementos a mostrar en el paginador: números de página y "…" donde se
 * saltean páginas. Siempre muestra la primera, la última y las vecinas de la
 * actual. Ej.: página 6 de 12 → [1, "…", 5, 6, 7, "…", 12].
 */
export function getPageItems(page: number, totalPages: number, siblings = 1): (number | "…")[] {
  if (totalPages <= 1) return [1];
  const items: (number | "…")[] = [];
  const from = Math.max(2, page - siblings);
  const to = Math.min(totalPages - 1, page + siblings);
  items.push(1);
  if (from > 2) items.push("…");
  for (let p = from; p <= to; p++) items.push(p);
  if (to < totalPages - 1) items.push("…");
  items.push(totalPages);
  return items;
}

export interface PaginationProps {
  /** Página actual, empezando en 1. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Nombre accesible del paginador. */
  label?: string;
  className?: string;
}

/**
 * Paginador reutilizable (F35). Se usa en el ranking completo del juego y
 * sirve para cualquier listado largo de las dos apps. No se muestra si hay
 * una sola página. Los estilos usan los tokens de color de cada app
 * (brand, line, surface, muted).
 */
export function Pagination({ page, totalPages, onPageChange, label = "Páginas", className = "" }: PaginationProps) {
  if (totalPages <= 1) return null;
  const current = Math.min(Math.max(1, page), totalPages);
  const go = (p: number) => {
    if (p >= 1 && p <= totalPages && p !== current) onPageChange(p);
  };
  const arrow =
    `grid size-10 place-items-center rounded-xl bg-surface ring-1 ring-line hover:bg-brand-soft active:bg-brand-soft disabled:pointer-events-none disabled:opacity-40 ${pressableClass}`;

  return (
    <nav aria-label={label} className={`flex items-center justify-center gap-1.5 ${className}`}>
      <button type="button" onClick={() => go(current - 1)} disabled={current === 1} aria-label="Página anterior" className={arrow}>
        <ChevronLeft size={18} aria-hidden />
      </button>
      <ul className="flex items-center gap-1.5">
        {getPageItems(current, totalPages).map((item, i) =>
          item === "…" ? (
            <li key={`gap-${i}`} aria-hidden className="w-6 text-center text-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => go(item)}
                aria-label={`Página ${item}`}
                aria-current={item === current ? "page" : undefined}
                className={`min-w-10 rounded-xl px-2 py-2 text-sm font-semibold tabular-nums ${pressableClass} ${
                  item === current ? "bg-brand text-white" : "bg-surface ring-1 ring-line hover:bg-brand-soft active:bg-brand-soft"
                }`}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        onClick={() => go(current + 1)}
        disabled={current === totalPages}
        aria-label="Página siguiente"
        className={arrow}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </nav>
  );
}
