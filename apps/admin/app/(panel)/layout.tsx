import { requireAdmin } from "@/lib/supabase-server";
import { SignOut } from "@/components/SignOut";
import { NavLinks } from "@/components/NavLinks";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="font-bold">
            Juego · <span className="text-brand">Administración</span>
          </span>
          <NavLinks />
          <span className="hidden text-sm text-muted md:inline">{admin.email}</span>
          <SignOut />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
