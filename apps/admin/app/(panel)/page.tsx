import Link from "next/link";
import { requireAdmin } from "@/lib/supabase-server";
import { Card, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ResumenPage() {
  const { db } = await requireAdmin();
  // Marca como vencidos los encuentros pasados de tiempo antes de contar.
  await db.rpc("expire_stale");

  const count = async (table: string, apply?: (q: any) => any) => {
    let q = db.from(table).select("*", { count: "exact", head: true });
    if (apply) q = apply(q);
    const { count } = await q;
    return count ?? 0;
  };

  const [registered, suspended, admins, completed, inProgress, expired, settings] = await Promise.all([
    count("profiles"),
    count("profiles", (q) => q.eq("status", "suspendido")),
    count("profiles", (q) => q.eq("role", "admin")),
    count("encounters", (q) => q.eq("status", "completo")),
    count("encounters", (q) => q.in("status", ["turno_a", "turno_b"])),
    count("encounters", (q) => q.eq("status", "vencido")),
    db.from("settings").select("game_open, encounter_minutes, email_domain").eq("id", 1).single(),
  ]);

  const stats = [
    { label: "Registrados", value: registered, href: "/personas" },
    { label: "Encuentros completos", value: completed },
    { label: "Encuentros en curso", value: inProgress },
    { label: "Encuentros vencidos", value: expired },
    { label: "Cuentas suspendidas", value: suspended, href: "/personas" },
    { label: "Administradores", value: admins, href: "/personas" },
  ];

  const s = settings.data;

  return (
    <>
      <PageTitle title="Resumen" subtitle="Cómo viene el juego (S10)." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {stats.map((st) => {
          const body = (
            <>
              <p className="text-sm text-muted">{st.label}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">{st.value}</p>
            </>
          );
          return st.href ? (
            <Link key={st.label} href={st.href} className="rounded-2xl bg-surface p-5 shadow-sm hover:ring-2 hover:ring-brand-soft">
              {body}
            </Link>
          ) : (
            <Card key={st.label}>{body}</Card>
          );
        })}
      </div>

      {s && (
        <Card className="mt-6">
          <h2 className="font-bold">Estado del juego</h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              Encuentros: <strong>{s.game_open ? "abiertos" : "cerrados"}</strong>
            </li>
            <li>
              Duración de cada encuentro: <strong>{s.encounter_minutes} min</strong>
            </li>
            <li>
              Dominio del email: <strong>{s.email_domain ? `@${s.email_domain}` : "cualquiera (falta definir, P1)"}</strong>
            </li>
          </ul>
          <Link href="/configuracion" className="mt-4 inline-block text-sm font-semibold text-brand">
            Cambiar configuración →
          </Link>
        </Card>
      )}
    </>
  );
}
