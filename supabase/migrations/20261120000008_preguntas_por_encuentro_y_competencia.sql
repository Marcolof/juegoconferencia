-- =====================================================================
-- F39 · Varias preguntas por encuentro y ventana de la competencia
--   · Cada jugador responde N preguntas del otro (N configurable, hoy 4).
--   · El administrador fija cuándo empieza y cuándo termina la competencia.
--     Crear la cuenta es libre; escanear un QR sólo se puede dentro de la
--     ventana. Los encuentros ya empezados se pueden terminar.
-- Se aplica pegándola en el SQL Editor de Supabase.
-- =====================================================================

-- ---------- Configuración ----------
alter table public.settings
  add column questions_per_encounter smallint not null default 4
    check (questions_per_encounter between 1 and 30),
  add column competition_start timestamptz,
  add column competition_end timestamptz,
  add constraint competition_dates_ok
    check (competition_start is null or competition_end is null or competition_end > competition_start);

-- ---------- Varias preguntas por jugador en un encuentro ----------
alter table public.turns add column position smallint not null default 1;
alter table public.turns drop constraint if exists turns_encounter_id_answerer_key;
alter table public.turns add constraint turns_encuentro_jugador_posicion_key
  unique (encounter_id, answerer, position);

-- ---------- Fase de la competencia ----------
-- 'antes' | 'en_curso' | 'terminada' (null = sin fecha). La pausa manual
-- (game_open) se informa aparte.
create function public.competition_phase()
returns text language sql stable security definer set search_path = public as $$
  select case
    when competition_start is not null and now() < competition_start then 'antes'
    when competition_end is not null and now() >= competition_end then 'terminada'
    else 'en_curso'
  end
  from settings where id = 1
$$;
revoke execute on function public.competition_phase() from public, anon, authenticated;

-- ---------- Configuración visible para el juego ----------
create or replace function public.get_public_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'email_domain', nullif(trim(email_domain), ''),
    'encounter_minutes', encounter_minutes,
    'game_open', game_open,
    'min_answers', min_answers,
    'questions_per_encounter', questions_per_encounter,
    'competition_start', competition_start,
    'competition_end', competition_end)
  from settings where id = 1
$$;

-- ---------- Estado del jugador (suma la competencia) ----------
create or replace function public.get_my_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  p profiles%rowtype;
  s settings%rowtype;
begin
  if v_me is null then raise exception 'no_autenticado'; end if;
  select * into p from profiles where id = v_me;
  if not found then raise exception 'no_autenticado'; end if;
  select * into s from settings where id = 1;
  return jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'photo_path', p.photo_path,
    'photo_step_done', p.photo_step_done,
    'role', p.role,
    'status', p.status,
    'qr_token', case when p.status = 'activo' then p.qr_token end,
    'total_questions', (select count(*) from questions),
    'min_answers', s.min_answers,
    'answers_ready', has_enough_answers(v_me),
    'tour_done', p.tour_done,
    'answers', coalesce((
      select jsonb_object_agg(a.question_id::text, a.text) from answers a where a.player_id = v_me
    ), '{}'::jsonb),
    'answers_locked', exists (
      select 1 from encounters e
      where v_me in (e.player_a, e.player_b) and e.status <> 'vencido'),
    'game_open', s.game_open,
    'questions_per_encounter', s.questions_per_encounter,
    'competition_start', s.competition_start,
    'competition_end', s.competition_end,
    'competition_phase', competition_phase(),
    'now', now()
  );
end $$;

-- ---------- Empezar un encuentro: N preguntas para cada uno + ventana ----------
create or replace function public.start_encounter(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  v_other profiles%rowtype;
  v_settings settings%rowtype;
  v_existing encounters%rowtype;
  v_id uuid;
  v_opts record;
  rec record;
  v_pos smallint;
begin
  perform expire_stale();

  if exists (select 1 from profiles where id = v_me and role = 'admin') then
    raise exception 'admin_no_juega';
  end if;

  select * into v_settings from settings where id = 1;
  -- La competencia manda: antes de empezar o después de terminar no se escanea (R94).
  if v_settings.competition_start is not null and now() < v_settings.competition_start then
    raise exception 'competencia_no_empezo';
  end if;
  if v_settings.competition_end is not null and now() >= v_settings.competition_end then
    raise exception 'competencia_terminada';
  end if;
  if not v_settings.game_open then raise exception 'juego_cerrado'; end if;

  select * into v_other from profiles where qr_token = trim(coalesce(p_token, ''));
  if not found then raise exception 'qr_invalido'; end if;
  if v_other.id = v_me then raise exception 'mismo_jugador'; end if;
  if v_other.status <> 'activo' then raise exception 'otro_suspendido'; end if;
  if v_other.role = 'admin' then raise exception 'qr_invalido'; end if;

  if not has_enough_answers(v_me) then raise exception 'faltan_respuestas'; end if;
  if not has_enough_answers(v_other.id) then raise exception 'otro_faltan_respuestas'; end if;

  select * into v_existing from encounters
  where least(player_a, player_b) = least(v_me, v_other.id)
    and greatest(player_a, player_b) = greatest(v_me, v_other.id)
    and status <> 'vencido'
  limit 1;
  if found then
    if v_existing.status = 'completo' then raise exception 'ya_jugaron'; end if;
    return v_existing.id;
  end if;

  begin
    insert into encounters (player_a, player_b, expires_at)
    values (v_me, v_other.id, now() + make_interval(mins => v_settings.encounter_minutes))
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from encounters
    where least(player_a, player_b) = least(v_me, v_other.id)
      and greatest(player_a, player_b) = greatest(v_me, v_other.id)
      and status <> 'vencido'
    limit 1;
    return v_id;
  end;

  -- A responde N preguntas sobre B (las que B eligió y no están ocultas).
  v_pos := 0;
  for rec in
    select question_id from answers
    where player_id = v_other.id and not hidden
    order by random() limit v_settings.questions_per_encounter
  loop
    v_pos := v_pos + 1;
    select * into v_opts from build_options(v_other.id, rec.question_id);
    insert into turns (encounter_id, answerer, subject, question_id, position, options, correct_index)
    values (v_id, v_me, v_other.id, rec.question_id, v_pos, v_opts.options, v_opts.correct_index);
  end loop;
  if v_pos = 0 then raise exception 'otro_faltan_respuestas'; end if;

  -- B responde N preguntas sobre A.
  v_pos := 0;
  for rec in
    select question_id from answers
    where player_id = v_me and not hidden
    order by random() limit v_settings.questions_per_encounter
  loop
    v_pos := v_pos + 1;
    select * into v_opts from build_options(v_me, rec.question_id);
    insert into turns (encounter_id, answerer, subject, question_id, position, options, correct_index)
    values (v_id, v_other.id, v_me, rec.question_id, v_pos, v_opts.options, v_opts.correct_index);
  end loop;
  if v_pos = 0 then raise exception 'faltan_respuestas'; end if;

  return v_id;
end $$;

-- ---------- Lo que ve cada jugador de su encuentro ----------
-- Las respuestas correctas sólo se revelan cuando el encuentro está completo (R57).
create or replace function public.get_encounter(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  e encounters%rowtype;
  o profiles%rowtype;
  v_is_a boolean;
  v_total integer;
  v_answered integer;
  v_other_total integer;
  v_other_answered integer;
  v_my_turn jsonb := null;
  v_results jsonb := null;
  v_other_correct integer := null;
  t turns%rowtype;
begin
  if v_me is null then raise exception 'no_autenticado'; end if;
  perform expire_stale();

  select * into e from encounters where id = p_id and v_me in (player_a, player_b);
  if not found then raise exception 'encuentro_inexistente'; end if;

  v_is_a := (e.player_a = v_me);
  select * into o from profiles where id = case when v_is_a then e.player_b else e.player_a end;

  select count(*), count(*) filter (where chosen_index is not null)
    into v_total, v_answered
  from turns where encounter_id = e.id and answerer = v_me;
  select count(*), count(*) filter (where chosen_index is not null)
    into v_other_total, v_other_answered
  from turns where encounter_id = e.id and answerer = o.id;

  -- La pregunta que toca ahora: la primera sin responder, si es mi turno.
  if (v_is_a and e.status = 'turno_a') or (not v_is_a and e.status = 'turno_b') then
    select * into t from turns
    where encounter_id = e.id and answerer = v_me and chosen_index is null
    order by position limit 1;
    if found then
      v_my_turn := jsonb_build_object(
        'question', (select q.text from questions q where q.id = t.question_id),
        'options', to_jsonb(t.options),
        'number', t.position);
    end if;
  end if;

  if e.status = 'completo' then
    select coalesce(jsonb_agg(jsonb_build_object(
        'question', (select q.text from questions q where q.id = x.question_id),
        'options', to_jsonb(x.options),
        'chosen_index', x.chosen_index,
        'correct_index', x.correct_index,
        'is_correct', x.is_correct) order by x.position), '[]'::jsonb)
    into v_results
    from turns x where x.encounter_id = e.id and x.answerer = v_me;

    select count(*) filter (where is_correct) into v_other_correct
    from turns where encounter_id = e.id and answerer = o.id;
  end if;

  return jsonb_build_object(
    'id', e.id,
    'status', e.status,
    'i_am', case when v_is_a then 'a' else 'b' end,
    'expires_at', e.expires_at,
    'now', now(),
    'other', jsonb_build_object(
      'id', o.id, 'first_name', o.first_name, 'last_name', o.last_name,
      'photo_path', o.photo_path),
    'total', v_total,
    'answered', v_answered,
    'other_total', v_other_total,
    'other_answered', v_other_answered,
    'my_turn', v_my_turn,
    'results', v_results,
    'other_correct', v_other_correct
  );
end $$;

-- ---------- Responder la pregunta que toca ----------
-- Primero responde A todas las suyas; después B las suyas (R56). Al terminar
-- las suyas, el turno pasa al otro; al terminar B, el encuentro se completa.
create or replace function public.answer_turn(p_id uuid, p_index smallint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  e encounters%rowtype;
  t turns%rowtype;
begin
  perform expire_stale();

  select * into e from encounters
  where id = p_id and v_me in (player_a, player_b)
  for update;
  if not found then raise exception 'encuentro_inexistente'; end if;
  if e.status = 'vencido' then raise exception 'vencido'; end if;
  if e.status = 'completo' then raise exception 'ya_respondiste'; end if;

  if (e.status = 'turno_a' and v_me <> e.player_a)
     or (e.status = 'turno_b' and v_me <> e.player_b) then
    if not exists (select 1 from turns where encounter_id = e.id and answerer = v_me
                   and chosen_index is null) then
      raise exception 'ya_respondiste';
    end if;
    raise exception 'no_es_tu_turno';
  end if;

  if p_index is null or p_index not between 0 and 2 then
    raise exception 'opcion_invalida';
  end if;

  select * into t from turns
  where encounter_id = e.id and answerer = v_me and chosen_index is null
  order by position limit 1
  for update;
  if not found then raise exception 'ya_respondiste'; end if;

  update turns
  set chosen_index = p_index, is_correct = (p_index = correct_index), answered_at = now()
  where id = t.id;

  if not exists (select 1 from turns where encounter_id = e.id and answerer = v_me
                 and chosen_index is null) then
    if e.status = 'turno_a' then
      update encounters set status = 'turno_b' where id = e.id;
    else
      update encounters set status = 'completo', completed_at = now() where id = e.id;
    end if;
  end if;

  return get_encounter(e.id);
end $$;
