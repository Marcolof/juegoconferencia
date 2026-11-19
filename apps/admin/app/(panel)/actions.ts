"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MIN_PASSWORD_LENGTH, PHOTOS_BUCKET } from "@juego/shared";
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

export async function updateSettings(form: FormData) {
  const { db } = await requireAdmin();
  const path = "/configuracion";
  const domain = text(form, "email_domain").replace(/^@/, "").toLowerCase();
  const minutes = Number(text(form, "encounter_minutes"));
  const gameOpen = form.get("game_open") === "on";
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
    back(path, "error", "La duración tiene que ser un número entero entre 1 y 60.");
  }
  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    back(path, "error", "El dominio no parece válido (ejemplo: empresa.com).");
  }
  const { error } = await db
    .from("settings")
    .update({
      email_domain: domain || null,
      encounter_minutes: minutes,
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
