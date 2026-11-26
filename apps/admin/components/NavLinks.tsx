"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pressableClass } from "@juego/shared/ui";

const NAV = [
  { href: "/", label: "Resumen" },
  { href: "/personas", label: "Personas" },
  { href: "/ranking", label: "Ranking" },
  { href: "/respuestas", label: "Respuestas" },
  { href: "/configuracion", label: "Configuración" },
];

/** La sección activa: exacta para el inicio, por prefijo para las demás (incluye sus detalles). */
export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Barra de secciones del panel con la sección actual marcada (F49): fondo de
 * marca, texto en negrita y aria-current para lectores de pantalla.
 */
export function NavLinks() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Secciones" className="flex flex-1 flex-wrap gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm ${pressableClass} ${
              active
                ? "bg-brand font-semibold text-white shadow-sm"
                : "font-medium text-ink hover:bg-brand-soft hover:text-brand"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
