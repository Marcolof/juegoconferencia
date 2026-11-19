import Link from "next/link";
import { requireAdmin } from "@/lib/supabase-server";
import { SignOut } from "@/components/SignOut";

const NAV = [
  { href: "/", label: "Resumen" },
  { href: "/personas", label: "Personas" },
  { href: "/ranking", label: "Ranking" },
  { href: "/respuestas", label: "Respuestas" },
  { href: "/configuracion", label: "Configuración" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="font-bold">
            Juego · <span className="text-brand">Administración</span>
          </span>
          <nav aria-label="Secciones" className="flex flex-1 flex-wrap gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-soft"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="hidden text-sm text-muted md:inline">{admin.email}</span>
          <SignOut />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
