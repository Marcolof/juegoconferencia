import Link from "next/link";
import { notFound } from "next/navigation";
import { PHOTOS_BUCKET } from "@juego/shared";
import { requireAdmin } from "@/lib/supabase-server";
import {
  removePhoto,
  resetPassword,
  setAnswerHidden,
  setRole,
  setSuspended,
  updateNames,
  deleteAccount,
} from "../../actions";
import {
  Badge,
  Card,
  Flash,
  Initials,
  buttonClass,
  dangerButtonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PersonaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { db } = admin;
  const { id } = await params;
  const { ok, error } = await searchParams;

  const { data: p } = await db
    .from("profiles")
    .select("id, email, first_name, last_name, photo_path, role, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: answers }, { data: questions }, { count: encounters }, { data: ranking }, photo] = await Promise.all([
    db.from("answers").select("question_id, text, hidden").eq("player_id", id),
    db.from("questions").select("id, text").order("position"),
    db
      .from("encounters")
      .select("*", { count: "exact", head: true })
      .eq("status", "completo")
      .or(`player_a.eq.${id},player_b.eq.${id}`),
    db.rpc("ranking_rows"),
    p.photo_path
      ? db.storage.from(PHOTOS_BUCKET).createSignedUrl(p.photo_path, 600)
      : Promise.resolve({ data: null }),
  ]);

  const mine = ((ranking ?? []) as { player_id: string; place: number; points: number }[]).find(
    (r) => r.player_id === id,
  );
  const answerByQ = new Map(
    ((answers ?? []) as { question_id: number; text: string; hidden: boolean }[]).map((a) => [a.question_id, a]),
  );
  const isMe = id === admin.userId;
  const returnTo = `/personas/${id}`;

  return (
    <>
      <Link href="/personas" className="text-sm text-brand">
        ← Personas
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-4">
        <Initials firstName={p.first_name} lastName={p.last_name} url={photo.data?.signedUrl} size={64} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {p.first_name === "Sin nombre" ? p.email : `${p.first_name} ${p.last_name}`.trim()}
          </h1>
          <p className="text-muted">{p.email}</p>
        </div>
        <div className="flex gap-2">
          {p.role === "admin" ? <Badge tone="brand">Admin</Badge> : <Badge tone="muted">Jugador</Badge>}
          {p.status === "activo" ? <Badge tone="ok">Activa</Badge> : <Badge tone="bad">Suspendida</Badge>}
        </div>
      </div>

      <Flash ok={ok} error={error} />

      <div className="grid gap-5 lg:grid-cols-2">
        {p.role === "admin" && (
          <Card className="lg:col-span-2">
            <p className="text-sm text-muted">
              Cuenta de administración: no juega, no tiene puntos ni respuestas y no aparece en el ranking.
            </p>
          </Card>
        )}

        {p.role !== "admin" && (
        <Card>
          <h2 className="font-bold">Juego</h2>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-canvas p-3">
              <dt className="text-xs text-muted">Puntos</dt>
              <dd className="text-2xl font-extrabold">{mine?.points ?? 0}</dd>
            </div>
            <div className="rounded-xl bg-canvas p-3">
              <dt className="text-xs text-muted">Puesto</dt>
              <dd className="text-2xl font-extrabold">{mine?.place ?? "—"}</dd>
            </div>
            <div className="rounded-xl bg-canvas p-3">
              <dt className="text-xs text-muted">Encuentros</dt>
              <dd className="text-2xl font-extrabold">{encounters ?? 0}</dd>
            </div>
          </dl>
        </Card>
        )}

        <Card>
          <h2 className="font-bold">Nombre</h2>
          <form action={updateNames.bind(null, id)} className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input name="first_name" defaultValue={p.first_name} aria-label="Nombre" className={`${inputClass} flex-1`} />
            <input name="last_name" defaultValue={p.last_name} aria-label="Apellido" className={`${inputClass} flex-1`} />
            <button className={buttonClass}>Guardar</button>
          </form>
        </Card>

        {p.role !== "admin" && (
        <Card className="lg:col-span-2">
          <h2 className="font-bold">Respuestas</h2>
          <p className="mt-1 text-sm text-muted">Una respuesta oculta deja de aparecer como opción falsa (R71).</p>
          <ul className="mt-3 divide-y divide-line">
            {((questions ?? []) as { id: number; text: string }[]).map((q) => {
              const a = answerByQ.get(q.id);
              return (
                <li key={q.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted">{q.text}</p>
                    <p className={`font-medium ${a?.hidden ? "text-muted line-through" : ""}`}>
                      {a ? a.text : <span className="text-muted">Sin responder</span>}
                    </p>
                  </div>
                  {a && (
                    <form action={setAnswerHidden.bind(null, id, q.id, !a.hidden, returnTo)}>
                      <button className={secondaryButtonClass}>{a.hidden ? "Mostrar" : "Ocultar"}</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
        )}

        <Card>
          <h2 className="font-bold">Rol</h2>
          <form action={setRole.bind(null, id)} className="mt-3 flex gap-3">
            <select name="role" defaultValue={p.role} aria-label="Rol" className={`${inputClass} flex-1`} disabled={isMe}>
              <option value="jugador">Jugador</option>
              <option value="admin">Administración</option>
            </select>
            <button className={buttonClass} disabled={isMe}>
              Cambiar
            </button>
          </form>
          {isMe && <p className="mt-2 text-xs text-muted">No podés cambiar tu propio rol.</p>}
        </Card>

        <Card>
          <h2 className="font-bold">Contraseña</h2>
          <p className="mt-1 text-sm text-muted">Para quien se la olvidó (P73). Pasásela en mano.</p>
          <form action={resetPassword.bind(null, id)} className="mt-3 flex gap-3">
            <input
              name="password"
              type="text"
              minLength={6}
              required
              autoComplete="off"
              placeholder="Contraseña nueva"
              aria-label="Contraseña nueva"
              className={`${inputClass} flex-1`}
            />
            <button className={buttonClass}>Restablecer</button>
          </form>
        </Card>

        <Card>
          <h2 className="font-bold">Foto</h2>
          {p.photo_path ? (
            <form action={removePhoto.bind(null, id)} className="mt-3">
              <button className={secondaryButtonClass}>Quitar foto</button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-muted">No tiene foto: se muestran sus iniciales.</p>
          )}
        </Card>

        <Card>
          <h2 className="font-bold">Suspender</h2>
          <p className="mt-1 text-sm text-muted">
            No puede ingresar, sale del ranking y sus respuestas dejan de usarse. Los puntos que otros ganaron con
            esta persona se mantienen (P74).
          </p>
          {!isMe && (
            <form action={setSuspended.bind(null, id, p.status === "activo")} className="mt-3">
              <button className={p.status === "activo" ? dangerButtonClass : buttonClass}>
                {p.status === "activo" ? "Suspender cuenta" : "Reactivar cuenta"}
              </button>
            </form>
          )}
        </Card>

        {!isMe && (
          <Card className="lg:col-span-2 ring-1 ring-bad-soft">
            <h2 className="font-bold text-bad">Borrar cuenta</h2>
            <p className="mt-1 text-sm text-muted">
              No se puede deshacer. Borra también sus encuentros: <strong>los puntos que otros ganaron con esta
              persona se pierden</strong>. Para conservarlos, suspendé la cuenta.
            </p>
            <form action={deleteAccount.bind(null, id)} className="mt-3 flex flex-wrap gap-3">
              <input
                name="confirm"
                placeholder="Escribí BORRAR"
                aria-label="Confirmación: escribí BORRAR"
                autoComplete="off"
                className={inputClass}
              />
              <button className={dangerButtonClass}>Borrar definitivamente</button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
