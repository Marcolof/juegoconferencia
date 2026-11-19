import { requireAdmin } from "@/lib/supabase-server";
import { addAdminEmail, removeAdminEmail, updateSettings } from "../actions";
import { Card, Flash, PageTitle, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { db } = await requireAdmin();
  const { ok, error } = await searchParams;
  const [{ data: s }, { data: admins }] = await Promise.all([
    db.from("settings").select("email_domain, encounter_minutes, game_open, min_answers").eq("id", 1).single(),
    db.from("admin_emails").select("email").order("email"),
  ]);

  return (
    <>
      <PageTitle title="Configuración" />
      <Flash ok={ok} error={error} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Juego</h2>
          <form action={updateSettings} className="mt-4 flex flex-col gap-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="game_open" defaultChecked={s?.game_open ?? true} className="size-5" />
              <span>
                <span className="font-medium">Encuentros abiertos</span>
                <span className="block text-sm text-muted">
                  Si está apagado, nadie puede empezar un encuentro (bloque horario, S9).
                </span>
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Duración de cada encuentro (minutos)</span>
              <input
                type="number"
                name="encounter_minutes"
                min={1}
                max={60}
                required
                defaultValue={s?.encounter_minutes ?? 5}
                className={`${inputClass} w-32`}
              />
              <span className="text-xs text-muted">Se aplica a los encuentros nuevos (R65).</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Cantidad de preguntas que responde cada jugador</span>
              <input
                type="number"
                name="min_answers"
                min={1}
                max={30}
                required
                defaultValue={s?.min_answers ?? 4}
                className={`${inputClass} w-32`}
              />
              <span className="text-xs text-muted">
                Cada jugador elige libremente cuáles, pero tiene que responder exactamente esta cantidad: ni más ni
                menos (R92). Si la cambiás, quienes ya respondieron con otra cantidad tendrán que editar sus
                preguntas.
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Dominio del email corporativo</span>
              <input
                name="email_domain"
                placeholder="empresa.com"
                defaultValue={s?.email_domain ?? ""}
                className={inputClass}
              />
              <span className="text-xs text-muted">
                Vacío = se acepta cualquier email (P1 sigue abierto). Sólo afecta a las cuentas nuevas.
              </span>
            </label>
            <button className={`${buttonClass} self-start`}>Guardar</button>
          </form>
        </Card>

        <Card>
          <h2 className="font-bold">Emails de administración</h2>
          <p className="mt-1 text-sm text-muted">
            Quien se registre con uno de estos emails recibe el rol de administración (R75). Si ya tiene cuenta, lo
            recibe al agregarlo.
          </p>
          <form action={addAdminEmail} className="mt-4 flex gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="nombre@empresa.com"
              aria-label="Email a autorizar"
              className={`${inputClass} flex-1`}
            />
            <button className={buttonClass}>Agregar</button>
          </form>
          <ul className="mt-4 divide-y divide-line">
            {((admins ?? []) as { email: string }[]).map((a) => (
              <li key={a.email} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-sm">{a.email}</span>
                <form action={removeAdminEmail.bind(null, a.email)}>
                  <button className={secondaryButtonClass}>Quitar</button>
                </form>
              </li>
            ))}
            {(admins ?? []).length === 0 && <li className="py-4 text-sm text-muted">Sin emails cargados.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
