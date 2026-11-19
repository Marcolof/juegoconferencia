// Reglas y tipos compartidos entre la app del juego y el panel.
// Las reglas que importan para el puntaje también se validan en la base
// (supabase/migrations); estas copias sirven para avisar antes en pantalla.

/** Largo máximo de cada respuesta escrita (R70). */
export const MAX_ANSWER_LENGTH = 30;

/** Largo mínimo de la contraseña (R76). Coincide con el mínimo de Supabase. */
export const MIN_PASSWORD_LENGTH = 6;

/** Puestos del ranking que se ven en la pantalla principal (F35, R85). */
export const PLAYER_RANKING_TOP = 8;

/** Jugadores por página en el ranking completo (F35, R86). */
export const RANKING_PAGE_SIZE = 20;

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

/** Una página del ranking completo, con búsqueda por nombre (R86). */
export interface RankingPage {
  rows: RankingRow[];
  /** Total de jugadores que coinciden con la búsqueda. */
  total: number;
  page: number;
  page_size: number;
}

export interface PublicSettings {
  email_domain: string | null;
  encounter_minutes: number;
  game_open: boolean;
  /** Cantidad exacta de preguntas que cada jugador responde (R92). */
  min_answers: number;
  /** Preguntas que cada uno responde dentro de un encuentro (R93). */
  questions_per_encounter: number;
  competition_start: string | null;
  competition_end: string | null;
}

/** Fases de la competencia (R94). */
export type CompetitionPhase = "antes" | "en_curso" | "terminada";

/**
 * Fase de la competencia en un momento dado. Sin fechas, siempre está en curso.
 * La base decide con su propio reloj; esto sirve para avisar en pantalla.
 */
export function competitionPhase(
  start: string | null | undefined,
  end: string | null | undefined,
  now: number = Date.now(),
): CompetitionPhase {
  if (start && now < new Date(start).getTime()) return "antes";
  if (end && now >= new Date(end).getTime()) return "terminada";
  return "en_curso";
}

/** Zona horaria con la que se cargan y se muestran las fechas de la competencia. */
export const COMPETITION_TIMEZONE = "America/Argentina/Buenos_Aires";
/** Argentina no tiene horario de verano: el desfase es fijo. */
export const COMPETITION_UTC_OFFSET = "-03:00";

/**
 * De una fecha guardada (UTC) al valor de un campo `datetime-local`
 * ("2026-11-21T14:30") en hora de Argentina.
 */
export function toCompetitionInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: COMPETITION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Del valor de un `datetime-local` ("2026-11-21T14:30", hora de Argentina) a
 * una fecha ISO. Devuelve null si está vacío y undefined si no es válido.
 */
export function fromCompetitionInput(value: string): string | null | undefined {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}:00${COMPETITION_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Fecha y hora legible en hora de Argentina, por ejemplo «viernes 21/11, 14:30». */
export function formatCompetitionDate(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: COMPETITION_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
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
  /** Mínimo de preguntas a responder, contando las fijas (R81). */
  min_answers: number;
  /** Respondió las fijas y llegó al mínimo: ya puede jugar (R81). */
  answers_ready: boolean;
  /** Ya vio el tour de bienvenida (R84). */
  tour_done: boolean;
  answers: Record<string, string>;
  answers_locked: boolean;
  /** Pausa manual de los encuentros (Configuración → Encuentros abiertos). */
  game_open: boolean;
  questions_per_encounter: number;
  competition_start: string | null;
  competition_end: string | null;
  competition_phase: CompetitionPhase;
  /** Hora del servidor: sirve para calcular el desfase con el reloj del teléfono. */
  now: string;
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

/** La pregunta que toca responder ahora (sin la respuesta correcta). */
export interface EncounterCurrentTurn {
  question: string;
  options: string[];
  /** Número de la pregunta dentro de las mías, desde 1. */
  number: number;
}

/** Resultado de una de mis preguntas; sólo viene con el encuentro completo (R57). */
export interface EncounterTurnResult {
  question: string;
  options: string[];
  chosen_index: number | null;
  correct_index: number;
  is_correct: boolean;
}

/** Lo que el servidor le muestra a cada jugador de su encuentro. */
export interface EncounterView {
  id: string;
  status: EncounterStatus;
  i_am: "a" | "b";
  expires_at: string;
  now: string;
  other: EncounterOtherPlayer;
  /** Cuántas preguntas me tocan en total y cuántas ya respondí (R93). */
  total: number;
  answered: number;
  /** Lo mismo para la otra persona. */
  other_total: number;
  other_answered: number;
  /** La pregunta que me toca ahora; null si todavía no es mi turno o ya terminé las mías. */
  my_turn: EncounterCurrentTurn | null;
  /** Todas mis preguntas con su resultado; sólo cuando el encuentro está completo. */
  results: EncounterTurnResult[] | null;
  /** Cuántas acertó la otra persona; sólo cuando el encuentro está completo. */
  other_correct: number | null;
}

/** Traduce los códigos de error de las funciones de la base a texto. */
export function gameErrorMessage(raw: string | undefined | null): string {
  const code = (raw ?? "").trim();
  const map: Record<string, string> = {
    no_autenticado: "Tenés que ingresar de nuevo.",
    cuenta_suspendida: "Tu cuenta está suspendida. Hablá con la organización.",
    juego_cerrado: "Los encuentros están en pausa en este momento.",
    competencia_no_empezo: "La competencia todavía no empezó.",
    competencia_terminada: "La competencia terminó: ya no se pueden escanear más QR.",
    faltan_respuestas: "Primero elegí y respondé tus preguntas.",
    faltan_fijas: "Las preguntas obligatorias tienen que tener respuesta.",
    pocas_respuestas: "Te faltan preguntas: tenés que responder la cantidad exacta que se pide.",
    demasiadas_respuestas: "Elegiste más preguntas de las que se piden: sacá las que sobran.",
    otro_faltan_respuestas: "Esa persona todavía no completó sus respuestas.",
    qr_invalido: "Ese QR no es de este juego.",
    mismo_jugador: "Ese es tu propio QR.",
    otro_suspendido: "Esa cuenta no puede jugar.",
    admin_no_juega: "Las cuentas de administración no juegan.",
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
