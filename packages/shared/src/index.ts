// Reglas y tipos compartidos entre la app del juego y el panel.
// Las reglas que importan para el puntaje también se validan en la base
// (supabase/migrations); estas copias sirven para avisar antes en pantalla.

/** Largo máximo de cada respuesta escrita (R70). */
export const MAX_ANSWER_LENGTH = 30;

/** Largo mínimo de la contraseña (R76). Coincide con el mínimo de Supabase. */
export const MIN_PASSWORD_LENGTH = 6;

/** Cantidad de puestos del ranking que ve el jugador (P76). */
export const PLAYER_RANKING_TOP = 10;

/** Nombre del bucket de Storage donde van las fotos. */
export const PHOTOS_BUCKET = "fotos";

export type UserRole = "jugador" | "admin";
export type AccountStatus = "activo" | "suspendido";
export type EncounterStatus = "turno_a" | "turno_b" | "completo" | "vencido";

/** Iniciales: primera letra del nombre y del apellido (R64). */
export function initials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

/**
 * Normaliza una respuesta para compararla (R68): minúsculas, sin acentos
 * y sin espacios de más. La base usa la misma regla en `normalize_answer`.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Valida el dominio del email cuando está configurado (P1). */
export function emailMatchesDomain(email: string, domain: string | null): boolean {
  if (!domain) return true;
  return email.trim().toLowerCase().endsWith("@" + domain.trim().toLowerCase());
}

export interface RankingRow {
  /** Puesto: mismo puntaje = mismo puesto (P77). */
  place: number;
  player_id: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
  points: number;
}

export interface MyRanking {
  place: number | null;
  points: number;
  total_players: number;
}

export interface PublicSettings {
  email_domain: string | null;
  encounter_minutes: number;
  game_open: boolean;
}

export interface MyState {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
  photo_step_done: boolean;
  role: UserRole;
  status: AccountStatus;
  qr_token: string | null;
  total_questions: number;
  answers: Record<string, string>;
  answers_locked: boolean;
}

export interface Question {
  id: number;
  position: number;
  text: string;
  is_fixed: boolean;
}

export interface EncounterOtherPlayer {
  id: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
}

export interface EncounterTurnView {
  question: string;
  options: string[];
  chosen_index: number | null;
  /** Sólo viene cuando el encuentro está completo (R57). */
  is_correct: boolean | null;
  /** Sólo viene cuando el encuentro está completo. */
  correct_index: number | null;
}

/** Lo que el servidor le muestra a cada jugador de su encuentro. */
export interface EncounterView {
  id: string;
  status: EncounterStatus;
  i_am: "a" | "b";
  expires_at: string;
  now: string;
  other: EncounterOtherPlayer;
  /** La pregunta que me toca responder; null si todavía no es mi turno. */
  my_turn: EncounterTurnView | null;
  /** Resultado del otro; sólo cuando el encuentro está completo. */
  other_correct: boolean | null;
}

/** Traduce los códigos de error de las funciones de la base a texto. */
export function gameErrorMessage(raw: string | undefined | null): string {
  const code = (raw ?? "").trim();
  const map: Record<string, string> = {
    no_autenticado: "Tenés que ingresar de nuevo.",
    cuenta_suspendida: "Tu cuenta está suspendida. Hablá con la organización.",
    juego_cerrado: "El juego no está abierto en este momento.",
    faltan_respuestas: "Primero completá tus 4 respuestas.",
    otro_faltan_respuestas: "Esa persona todavía no completó sus respuestas.",
    qr_invalido: "Ese QR no es de este juego.",
    mismo_jugador: "Ese es tu propio QR.",
    otro_suspendido: "Esa cuenta no puede jugar.",
    ya_jugaron: "Ya jugaron juntos: cada pareja juega una sola vez.",
    no_es_tu_turno: "Todavía no es tu turno.",
    ya_respondiste: "Ya respondiste.",
    vencido: "Se terminó el tiempo de este encuentro.",
    encuentro_inexistente: "No encontramos ese encuentro.",
    opcion_invalida: "Elegí una de las opciones.",
    respuestas_bloqueadas: "Tus respuestas ya no se pueden cambiar: jugaste tu primer encuentro.",
    respuesta_invalida: `Cada respuesta tiene que tener entre 1 y ${MAX_ANSWER_LENGTH} caracteres.`,
    sin_opciones: "No hay suficientes respuestas para armar las opciones. Avisale a la organización.",
    dominio_no_permitido: "Usá tu email corporativo de Vortex.",
    foto_invalida: "No pudimos guardar la foto.",
    "User already registered": "Ya hay una cuenta con ese email. Probá ingresar.",
    "Invalid login credentials": "Email o contraseña incorrectos.",
    "Database error saving new user": "No pudimos crear la cuenta. Revisá que sea tu email corporativo de Vortex.",
  };
  for (const key of Object.keys(map)) {
    if (code.includes(key)) return map[key];
  }
  return "Algo salió mal. Probá de nuevo.";
}
