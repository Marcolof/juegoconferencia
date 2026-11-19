"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MIN_PASSWORD_LENGTH, PHOTOS_BUCKET, fromCompetitionInput } from "@juego/shared";
import { requireAdmin } from "@/lib/supabase-server";

const BAN_FOREVER = "876000h"; // unos 100 años: la cuenta suspendida no puede ingresar

function back(path: string, kind: "ok" | "error", message: string): never {
  revalidatePath(path.split("?")[0]);
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

// ---------- Personas (P74, P75, R78) ----------

export async function updateNames(id: string, form: FormData) {
  const { db } = await requireAdmin();
  const path = `/personas/${id}`;
  const firstName = text(form, "first_name");
  const lastName = text(form, "last_name");
  if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) {
    back(path, "error", "Nombre y apellido tienen que tener entre 1 y 60 caracteres.");
  }
  const { error } = await db.from("profiles").update({ first_name: firstName, last_name: lastName }).eq("id", id);
  if (error) back(path, "error", "No se pudo guardar el nombre.");
  back(path, "ok", "Nombre actualizado.");
}

export async function setRole(id: string, form: FormData) {
  const admin = await requireAdmin();
  const path = `/personas/${id}`;
  const role = text(form, "role");
  if (role !== "jugador" && role !== "admin") back(path, "error", "Rol inválido.");
  if (id === admin.userId && role !== "admin") {
    back(path, "error", "No podés quitarte tu propio rol de administración.");
  }
  const { error } = await admin.db.from("profiles").update({ role }).eq("id", id);
  if (error) back(path, "error", "No se pudo cambiar el rol.");
  back(path, "ok", role === "admin" ? "Ahora tiene rol de administración." : "Ahora tiene rol de jugador.");
}

export async function setSuspended(id: string, suspend: boolean) {
  const admin = await requireAdmin();
  const path = `/personas/${id}`;
  if (id === admin.userId) back(path, "error", "No podés suspender tu propia cuenta.");
  const { error } = await admin.db
    .from("profiles")
    .update({ status: suspend ? "suspendido" : "activo" })
    .eq("id", id);
  if (error) back(path, "error", "No se pudo cambiar el estado.");
  const ban = await admin.db.auth.admin.updateUserById(id, { ban_duration: suspend ? BAN_FOREVER : "none" });
  if (ban.error) back(path, "error", "Se cambió el estado, pero no se pudo bloquear el ingreso.");
  back(
    path,
    "ok",
    suspend
      ? "Cuenta suspendida: no puede ingresar, salió del ranking y sus respuestas ya no se usan como opciones."
      : "Cuenta reactivada.",
  );
}

export async function removePhoto(id: string) {
  const { db } = await requireAdmin();
  const path = `/personas/${id}`;
  const { data } = await db.from("profiles").select("photo_path").eq("id", id).maybeSingle();
  if (data?.photo_path) await db.storage.from(PHOTOS_BUCKET).remove([data.photo_path]);
  const { error } = await db.from("profiles").update({ photo_path: null }).eq("id", id);
  if (error) back(path, "error", "No se pudo quitar la foto.");
  back(path, "ok", "Foto quitada: ahora se ven las iniciales.");
}

export async function resetPassword(id: string, form: FormData) {
  const { db } = await requireAdmin();
  const path = `/personas/${id}`;
  const password = String(form.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    back(path, "error", `La contraseña nueva tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  const { error } = await db.auth.admin.updateUserById(id, { password });
  if (error) back(path, "error", "No se pudo restablecer la contraseña.");
  back(path, "ok", "Contraseña restablecida. Pasásela a la persona en mano.");
}

export async function deleteAccount(id: string, form: FormData) {
  const admin = await requireAdmin();
  const path = `/personas/${id}`;
  if (id === admin.userId) back(path, "error", "No podés borrar tu propia cuenta.");
  if (text(form, "confirm").toUpperCase() !== "BORRAR") {
    back(path, "error", "Para borrar, escribí BORRAR en el campo de confirmación.");
  }
  const { data } = await admin.db.from("profiles").select("photo_path").eq("id", id).maybeSingle();
  if (data?.photo_path) await admin.db.storage.from(PHOTOS_BUCKET).remove([data.photo_path]);
  const { error } = await admin.db.auth.admin.deleteUser(id);
  if (error) back(path, "error", "No se pudo borrar la cuenta.");
  back("/personas", "ok", "Cuenta borrada.");
}

/**
 * Elimina un jugador desde el listado de Personas, después de confirmar en
 * el modal (F37, R91). Se borra la cuenta de acceso, así que la persona
 * puede volver a registrarse con el mismo email: no queda bloqueada.
 */
export async function deletePlayer(id: string) {
  const admin = await requireAdmin();
  const path = "/personas";
  if (id === admin.userId) back(path, "error", "No podés eliminar tu propia cuenta.");
  const { data } = await admin.db
    .from("profiles")
    .select("first_name, last_name, role, photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) back(path, "error", "Esa cuenta ya no existe.");
  if (data.role !== "jugador") back(path, "error", "Desde aquí sólo se eliminan jugadores.");
  if (data.photo_path) await admin.db.storage.from(PHOTOS_BUCKET).remove([data.photo_path]);
  const { error } = await admin.db.auth.admin.deleteUser(id);
  if (error) back(path, "error", "No se pudo eliminar la cuenta.");
  back(path, "ok", `Se eliminó a ${data.first_name} ${data.last_name}. Puede volver a crear su cuenta cuando quiera.`);
}

// ---------- Respuestas (R71) ----------

export async function setAnswerHidden(playerId: string, questionId: number, hidden: boolean, returnTo: string) {
  const { db } = await requireAdmin();
  const { error } = await db
    .from("answers")
    .update({ hidden })
    .eq("player_id", playerId)
    .eq("question_id", questionId);
  if (error) back(returnTo, "error", "No se pudo cambiar la respuesta.");
  back(returnTo, "ok", hidden ? "Respuesta oculta: ya no aparece como opción." : "Respuesta visible de nuevo.");
}

// ---------- Configuración (S9, S10, P1) ----------

/**
 * Cuándo empieza y cuándo termina la competencia (F39, R94). Crear la cuenta
 * es libre siempre; escanear QR sólo se puede dentro de estas fechas. Las
 * fechas se cargan en hora de Argentina. Vacío = sin límite.
 */
/** Lanza el juego ya: pone la fecha de inicio en este momento (F40, R96). */
export async function startCompetitionNow() {
  const { db } = await requireAdmin();
  const path = "/configuracion";
  const { data } = await db.from("settings").select("competition_end").eq("id", 1).single();
  if (data?.competition_end && new Date(data.competition_end) <= new Date()) {
    back(path, "error", "La fecha de fin ya pasó. Cambiala o borrala antes de iniciar el juego.");
  }
  const { error } = await db
    .from("settings")
    .update({ competition_start: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) back(path, "error", "No se pudo iniciar el juego.");
  back(path, "ok", "¡El juego empezó! Los jugadores ya pueden escanear QR.");
}

/** Termina el juego ya: pone la fecha de fin en este momento. */
export async function endCompetitionNow() {
  const { db } = await requireAdmin();
  const path = "/configuracion";
  const { data } = await db.from("settings").select("competition_start").eq("id", 1).single();
  if (!data?.competition_start || new Date(data.competition_start) > new Date()) {
    back(path, "error", "El juego todavía no empezó: no hay nada que terminar.");
  }
  const { error } = await db
    .from("settings")
    .update({ competition_end: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) back(path, "error", "No se pudo terminar el juego.");
  back(path, "ok", "El juego terminó: ya no se pueden escanear QR nuevos.");
}

export async function updateCompetition(form: FormData) {
  const { db } = await requireAdmin();
  const path = "/configuracion";
  const start = fromCompetitionInput(text(form, "competition_start"));
  const end = fromCompetitionInput(text(form, "competition_end"));
  if (start === undefined || end === undefined) {
    back(path, "error", "Alguna fecha no es válida. Usá el selector de fecha y hora.");
  }
  if (start && end && new Date(end) <= new Date(start)) {
    back(path, "error", "La competencia tiene que terminar después de empezar.");
  }
  const { error } = await db
    .from("settings")
    .update({ competition_start: start, competition_end: end, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) back(path, "error", "No se pudieron guardar las fechas de la competencia.");
  back(
    path,
    "ok",
    !start
      ? "Fechas guardadas. Sin fecha de inicio el juego queda sin lanzar: los jugadores ven que va a comenzar."
      : "Fechas de la competencia guardadas.",
  );
}

export async function updateSettings(form: FormData) {
  const { db } = await requireAdmin();
  const path = "/configuracion";
  const domain = text(form, "email_domain").replace(/^@/, "").toLowerCase();
  const minutes = Number(text(form, "encounter_minutes"));
  const minAnswers = Number(text(form, "min_answers"));
  const perEncounter = Number(text(form, "questions_per_encounter"));
  const gameOpen = form.get("game_open") === "on";
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
    back(path, "error", "La duración tiene que ser un número entero entre 1 y 60.");
  }
  if (!Number.isInteger(minAnswers) || minAnswers < 1 || minAnswers > 30) {
    back(path, "error", "La cantidad de preguntas tiene que ser un número entero entre 1 y 30.");
  }
  if (!Number.isInteger(perEncounter) || perEncounter < 1 || perEncounter > minAnswers) {
    back(
      path,
      "error",
      `Las preguntas por encuentro tienen que ser un número entero entre 1 y ${minAnswers} (lo que responde cada jugador).`,
    );
  }
  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    back(path, "error", "El dominio no parece válido (ejemplo: empresa.com).");
  }
  const { error } = await db
    .from("settings")
    .update({
      email_domain: domain || null,
      encounter_minutes: minutes,
      min_answers: minAnswers,
      questions_per_encounter: perEncounter,
      game_open: gameOpen,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) back(path, "error", "No se pudo guardar la configuración.");
  back(path, "ok", "Configuración guardada.");
}

export async function addAdminEmail(form: FormData) {
  const { db } = await requireAdmin();
  const path = "/configuracion";
  const email = text(form, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back(path, "error", "Email inválido.");
  const { error } = await db.from("admin_emails").upsert({ email });
  if (error) back(path, "error", "No se pudo agregar el email.");
  // Si la persona ya tiene cuenta, recibe el rol ahora.
  await db.from("profiles").update({ role: "admin" }).eq("email", email);
  back(path, "ok", "Email autorizado como administración.");
}

export async function removeAdminEmail(email: string) {
  const { db } = await requireAdmin();
  const { error } = await db.from("admin_emails").delete().eq("email", email);
  if (error) back("/configuracion", "error", "No se pudo quitar el email.");
  back("/configuracion", "ok", "Email quitado de la lista. El rol de quien ya tiene cuenta se cambia en Personas.");
}
