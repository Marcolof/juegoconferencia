import Link from "next/link";
import { requireAdmin } from "@/lib/supabase-server";
import { Badge, Flash, Initials, PageTitle, inputClass, secondaryButtonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "jugador" | "admin";
  status: "activo" | "suspendido";
  created_at: string;
}

export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rol?: string; ok?: string; error?: string }>;
}) {
  const { db } = await requireAdmin();
  const { q = "", rol, ok, error } = await searchParams;
  // Una cuenta de administración no es un jugador: se lista aparte.
  const showAdmins = rol === "admin";

  let query = db
    .from("profiles")
    .select("id, email, first_name, last_name, role, status, created_at")
    .eq("role", showAdmins ? "admin" : "jugador")
    .order("created_at", { ascending: false });
  const term = q.trim().replace(/[%,()]/g, "");
  if (term) {
    query = query.or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
  }

  const [
    { data: people },
    { data: ranking },
    { data: answers },
    { count: adminCount },
    { count: playerCount },
    { data: settings },
  ] = await Promise.all([
    query,
    db.rpc("ranking_rows"),
    db.from("answers").select("player_id"),
    db.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin"),
    db.from("profiles").select("*", { count: "exact", head: true }).eq("role", "jugador"),
    db.from("settings").select("min_answers").eq("id", 1).single(),
  ]);
  // Cada jugador elige cuántas preguntas responde (R81): se compara con el mínimo configurado.
  const minAnswers: number = settings?.min_answers ?? 4;

  const points = new Map<string, number>();
  for (const r of (ranking ?? []) as { player_id: string; points: number }[]) points.set(r.player_id, r.points);
  const answered = new Map<string, number>();
  for (const a of (answers ?? []) as { player_id: string }[]) {
    answered.set(a.player_id, (answered.get(a.player_id) ?? 0) + 1);
  }
  const rows = (people ?? []) as Row[];

  const tab = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold ${active ? "bg-brand text-white" : "bg-surface ring-1 ring-line hover:bg-canvas"}`;

  return (
    <>
      <PageTitle
        title="Personas"
        subtitle={
          showAdmins
            ? "Cuentas de administración: no juegan ni aparecen en el ranking."
            : "Jugadores registrados en el juego."
        }
      />
      <Flash ok={ok} error={error} />

      <div className="mb-5 flex gap-2">
        <Link href="/personas" className={tab(!showAdmins)}>
          Jugadores ({playerCount ?? 0})
        </Link>
        <Link href="/personas?rol=admin" className={tab(showAdmins)}>
          Administradores ({adminCount ?? 0})
        </Link>
      </div>

      <form className="mb-5 flex gap-2" role="search">
        {showAdmins && <input type="hidden" name="rol" value="admin" />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o email"
          aria-label="Buscar por nombre o email"
          className={`${inputClass} flex-1`}
        />
        <button className={secondaryButtonClass}>Buscar</button>
      </form>

      <p className="mb-3 text-sm text-muted">
        {rows.length} {rows.length === 1 ? "cuenta" : "cuentas"}
        {term && ` para “${term}”`}
      </p>

      <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{showAdmins ? "Cuenta" : "Persona"}</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              {!showAdmins && <th className="px-4 py-3 font-medium">Respuestas</th>}
              {!showAdmins && <th className="px-4 py-3 text-right font-medium">Puntos</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const named = p.first_name !== "Sin nombre";
              return (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3">
                    <Link href={`/personas/${p.id}`} className="flex items-center gap-3">
                      <Initials firstName={p.first_name} lastName={p.last_name} />
                      <span>
                        <span className="block font-semibold">
                          {named ? `${p.first_name} ${p.last_name}`.trim() : p.email}
                        </span>
                        {named && <span className="block text-muted">{p.email}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {p.role === "admin" ? <Badge tone="brand">Admin</Badge> : <Badge tone="muted">Jugador</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {p.status === "activo" ? <Badge tone="ok">Activa</Badge> : <Badge tone="bad">Suspendida</Badge>}
                  </td>
                  {!showAdmins && (
                    <td className="px-4 py-3 tabular-nums">
                      {(() => {
                        const n = answered.get(p.id) ?? 0;
                        return n >= minAnswers ? (
                          n
                        ) : (
                          <span className="text-bad" title={`Le faltan respuestas: el mínimo es ${minAnswers}`}>
                            {n} <span className="text-xs">(mín. {minAnswers})</span>
                          </span>
                        );
                      })()}
                    </td>
                  )}
                  {!showAdmins && (
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {p.status === "activo" ? (points.get(p.id) ?? 0) : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No hay cuentas para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
