-- =====================================================================
-- Opciones falsas generadas con IA (F41, R97)
-- Cuando un jugador guarda sus respuestas, el servidor del juego le pide a
-- Claude opciones falsas "del mismo tipo pero claramente distintas" y las
-- guarda acá. build_options usa primero estas; si no hay (o la respuesta
-- cambió después), sigue con la regla anterior: respuestas de otros
-- jugadores y listado de respaldo.
-- Se aplica pegándola en el SQL Editor de Supabase.
-- =====================================================================

create table public.ai_distractors (
  player_id uuid not null,
  question_id smallint not null,
  -- Texto de la respuesta para el que se generaron: si el jugador la cambia,
  -- estas opciones dejan de usarse hasta que se generen de nuevo.
  answer_text text not null,
  options text[] not null,
  -- La IA marcó la respuesta como inapropiada (no se oculta sola: decide el panel).
  flagged boolean not null default false,
  flag_reason text,
  model text,
  created_at timestamptz not null default now(),
  primary key (player_id, question_id),
  foreign key (player_id, question_id)
    references public.answers (player_id, question_id) on delete cascade
);

-- Sin políticas: el navegador no la lee. La escribe y la lee sólo el servidor
-- (clave de servicio) y las funciones de la base.
alter table public.ai_distractors enable row level security;

-- Arma las 3 opciones: la real y 2 falsas (R55).
-- Orden de preferencia: 1) opciones de la IA (R97); 2) respuestas de otros
-- jugadores (R67); 3) listado de respaldo (R69). Siempre sin repetidas (R68)
-- y sin opciones iguales a la real.
create or replace function public.build_options(p_subject uuid, p_question smallint,
  out options text[], out correct_index smallint)
language plpgsql security definer set search_path = public as $$
declare
  v_real text;
  v_fakes text[] := '{}';
  v_extra text[];
  v_all text[];
begin
  select a.text into v_real from answers a
  where a.player_id = p_subject and a.question_id = p_question;
  if v_real is null then raise exception 'otro_faltan_respuestas'; end if;

  -- 1) Opciones de la IA para esta respuesta exacta.
  select coalesce(array_agg(x.t), '{}') into v_fakes from (
    select d.t from (
      select distinct on (normalize_answer(o)) trim(o) as t
      from ai_distractors ai, unnest(ai.options) o
      where ai.player_id = p_subject
        and ai.question_id = p_question
        and ai.answer_text = v_real
        and char_length(trim(o)) between 1 and 30
        and normalize_answer(o) <> normalize_answer(v_real)
      order by normalize_answer(o), random()
    ) d order by random() limit 2
  ) x;

  -- 2) Respuestas de otros jugadores.
  if coalesce(array_length(v_fakes, 1), 0) < 2 then
    select coalesce(array_agg(x.t), '{}') into v_extra from (
      select d.t from (
        select distinct on (normalize_answer(a.text)) a.text as t
        from answers a join profiles p on p.id = a.player_id
        where a.question_id = p_question
          and a.player_id <> p_subject
          and not a.hidden
          and p.status = 'activo'
          and normalize_answer(a.text) <> normalize_answer(v_real)
          and normalize_answer(a.text) <> all (
            select normalize_answer(u) from unnest(v_fakes) u)
        order by normalize_answer(a.text), random()
      ) d order by random() limit (2 - coalesce(array_length(v_fakes, 1), 0))
    ) x;
    v_fakes := v_fakes || v_extra;
  end if;

  -- 3) Listado de respaldo.
  if coalesce(array_length(v_fakes, 1), 0) < 2 then
    select coalesce(array_agg(x.t), '{}') into v_extra from (
      select d.t from (
        select distinct on (normalize_answer(f.text)) f.text as t
        from fallback_answers f
        where f.question_id = p_question
          and normalize_answer(f.text) <> normalize_answer(v_real)
          and normalize_answer(f.text) <> all (
            select normalize_answer(u) from unnest(v_fakes) u)
        order by normalize_answer(f.text), random()
      ) d order by random() limit (2 - coalesce(array_length(v_fakes, 1), 0))
    ) x;
    v_fakes := v_fakes || v_extra;
  end if;

  if coalesce(array_length(v_fakes, 1), 0) < 2 then
    raise exception 'sin_opciones';
  end if;

  select array_agg(o order by random()) into v_all
  from unnest(array[v_real] || v_fakes) o;

  options := v_all;
  correct_index := array_position(v_all, v_real) - 1;
end $$;

revoke execute on function public.build_options(uuid, smallint) from public, anon, authenticated;
