// Lógica de los modos del ranking del panel (F49), sin React, para poder probarla.

import { RANKING_GROUPS, normalizeAnswer, type RankingMode, type StandingRow } from "@juego/shared";

export const RANKING_MODES: readonly { id: RankingMode; label: string; hint: string }[] = [
  { id: "participantes", label: "Participantes", hint: "Todos al azar, sin puntaje ni encuentros" },
  { id: "grupos", label: "Por grupos", hint: "Top 10, Top 20, Top 50 y el resto, con encuentros" },
  { id: "ranking", label: "Ranking", hint: "Puesto, encuentros y puntaje" },
];

export function isRankingMode(value: unknown): value is RankingMode {
  return RANKING_MODES.some((m) => m.id === value);
}

/** Busca por nombre y apellido, sin importar mayúsculas ni acentos. */
export function matchesSearch(row: Pick<StandingRow, "first_name" | "last_name">, query: string): boolean {
  const q = normalizeAnswer(query);
  if (!q) return true;
  return normalizeAnswer(`${row.first_name} ${row.last_name}`).includes(q);
}

function byName(a: StandingRow, b: StandingRow): number {
  return (
    a.first_name.localeCompare(b.first_name, "es", { sensitivity: "base" }) ||
    a.last_name.localeCompare(b.last_name, "es", { sensitivity: "base" }) ||
    a.player_id.localeCompare(b.player_id)
  );
}

export interface StandingGroup {
  id: string;
  label: string;
  detail: string;
  rows: StandingRow[];
}

/**
 * Modo «por grupos»: reparte por orden en el ranking (ord) en Top 10, Top 20,
 * Top 50 y Resto. Dentro de cada grupo van por nombre, para no revelar el
 * puesto exacto. Quien todavía no sumó puntos va en un grupo aparte. Los grupos
 * se arman con todos los jugadores y después se filtra la búsqueda, así un
 * jugador no cambia de grupo por lo que se busque.
 */
export function groupStandings(rows: StandingRow[], query = ""): StandingGroup[] {
  const groups: StandingGroup[] = RANKING_GROUPS.map((g) => ({ id: g.id, label: g.label, detail: g.detail, rows: [] }));
  const noPoints: StandingGroup = {
    id: "sin-puntos",
    label: "Todavía sin puntos",
    detail: "Les falta su primer acierto",
    rows: [],
  };
  for (const row of rows) {
    if (!matchesSearch(row, query)) continue;
    if (row.points <= 0) {
      noPoints.rows.push(row);
      continue;
    }
    const index = RANKING_GROUPS.findIndex((g) => row.ord >= g.from && row.ord <= g.to);
    groups[index === -1 ? groups.length - 1 : index].rows.push(row);
  }
  return [...groups, noPoints].filter((g) => g.rows.length > 0).map((g) => ({ ...g, rows: g.rows.sort(byName) }));
}

/**
 * Modo «participantes»: orden al azar pero estable. Cada jugador recibe una
 * clave al azar la primera vez que aparece y la conserva, así la pantalla no
 * se reordena en cada actualización.
 */
export function shuffledStable(rows: StandingRow[], keys: Map<string, number>, random: () => number = Math.random) {
  for (const row of rows) if (!keys.has(row.player_id)) keys.set(row.player_id, random());
  return [...rows].sort((a, b) => keys.get(a.player_id)! - keys.get(b.player_id)!);
}
