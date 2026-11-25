-- =====================================================================
-- F47 · Devolución del superior (R107 a R112)
--   1. Preguntas en tercera persona cuando se pregunta por otro (text_other).
--   2. Una sola partida a la vez: si A y B están jugando, nadie más los escanea.
--   3. Puntaje compartido: los dos suman los aciertos de los dos.
--   4. Pausa total: nadie empieza ni responde, y el reloj se congela.
--   5. Ingreso con Google: nombre y apellido salen de la cuenta de Google; el
--      botón se habilita desde el panel (google_login).
--   6. Sólo emails @vortex-it.com pueden crear cuenta (P1 confirmado).
-- Se aplica pegándola en el SQL Editor de Supabase.
-- =====================================================================

-- ---------- Configuración ----------
alter table public.settings
  add column paused_at timestamptz,
  add column google_login boolean not null default false;

-- Sólo emails de Vortex (P1, confirmado por Marco el 2026-11-24).
update public.settings set email_domain = 'vortex-it.com' where id = 1;

-- ---------- 1. Preguntas sobre otra persona ----------
alter table public.questions add column text_other text;
update public.questions set text_other = case id
  when 1 then '¿Hace cuánto que {nombre} trabaja en Vortex?'
  when 2 then '¿Cuál es el rol de {nombre} en la empresa?'
  when 3 then '¿Qué superpoder elegiría {nombre}?'
  when 4 then '¿Cuál es el lugar ideal de {nombre} para unas vacaciones?'
  when 5 then '¿Cuál es la comida favorita de {nombre}?'
  when 6 then '¿Qué hace {nombre} en su tiempo libre?'
  when 7 then '¿Qué serie o película volvería a ver {nombre}?'
  when 8 then '¿Qué música escucha más {nombre}?'
  when 9 then '¿Qué deporte practica o mira {nombre}?'
  when 10 then '¿Cuál es el animal favorito de {nombre}?'
  when 11 then '¿Qué país le gustaría conocer a {nombre}?'
  when 12 then '¿Qué le gustaría aprender a hacer a {nombre}?'
  when 13 then 'Si {nombre} pudiera viajar a otra época, ¿a cuál iría?'
  when 14 then '¿Cuál fue el primer trabajo de {nombre}?'
  else text_other end;

-- Texto de la pregunta sobre otra persona, con su nombre.
create or replace function public.question_about(p_question smallint, p_first_name text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(replace(q.text_other, '{nombre}', p_first_name), q.text)
  from questions q where q.id = p_question
$$;
revoke execute on function public.question_about(smallint, text) from public, anon, authenticated;

-- ---------- 4. Pausa ----------
create or replace function public.is_paused()
returns boolean language sql stable security definer set search_path = public as $$
  select not game_open from settings where id = 1
$$;
revoke execute on function public.is_paused() from public, anon, authenticated;

-- En pausa, los encuentros no vencen: el reloj está congelado.
create or replace function public.expire_stale()
returns void language sql security definer set search_path = public as $$
  update encounters set status = 'vencido'
  where status in ('turno_a', 'turno_b') and expires_at < now()
    and not is_paused();
$$;
revoke execute on function public.expire_stale() from public, anon, authenticated;

-- Pausar o reanudar (lo llama el panel). Al reanudar, cada encuentro en curso
-- recupera el tiempo que estuvo en pausa.
create or replace function public.set_game_paused(p_paused boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  s settings%rowtype;
begin
  select * into s from settings where id = 1 for update;
  if p_paused then
    if s.game_open then
      update settings set game_open = false, paused_at = now(), updated_at = now() where id = 1;
    end if;
  else
    if not s.game_open then
      update encounters
      set expires_at = expires_at + (now() - coalesce(s.paused_at, now()))
      where status in ('turno_a', 'turno_b');
      update settings set game_open = true, paused_at = null, updated_at = now() where id = 1;
    end if;
  end if;
end $$;
revoke execute on function public.set_game_paused(boolean) from public, anon, authenticated;
grant execute on function public.set_game_paused(boolean) to service_role;

-- ---------- Configuración visible para el juego (suma google_login) ----------
create or replace function public.get_public_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'email_domain', nullif(trim(email_domain), ''),
    'encounter_minutes', encounter_minutes,
    'game_open', game_open,
    'min_answers', min_answers,
    'questions_per_encounter', questions_per_encounter,
    'competition_start', competition_start,
    'competition_end', competition_end,
    'google_login', google_login)
  from settings where id = 1
$$;
grant execute on function public.get_public_settings() to anon, authenticated;

-- ---------- 2. Empezar un encuentro: una sola partida a la vez ----------
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
  if v_settings.competition_start is null or now() < v_settings.competition_start then
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

  -- Una sola partida a la vez (R108).
  if exists (select 1 from encounters
             where v_me in (player_a, player_b) and status in ('turno_a', 'turno_b')) then
    raise exception 'estas_jugando';
  end if;
  if exists (select 1 from encounters
             where v_other.id in (player_a, player_b) and status in ('turno_a', 'turno_b')) then
    raise exception 'otro_jugando';
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

-- ---------- Lo que ve cada jugador (tercera persona, pausa, total compartido) ----------
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
  v_paused boolean := is_paused();
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

  if (v_is_a and e.status = 'turno_a') or (not v_is_a and e.status = 'turno_b') then
    select * into t from turns
    where encounter_id = e.id and answerer = v_me and chosen_index is null
    order by position limit 1;
    if found then
      v_my_turn := jsonb_build_object(
        'question', question_about(t.question_id, o.first_name),
        'options', to_jsonb(t.options),
        'number', t.position);
    end if;
  end if;

  if e.status = 'completo' then
    select coalesce(jsonb_agg(jsonb_build_object(
        'question', question_about(x.question_id, o.first_name),
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
    'paused', v_paused,
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

-- ---------- Responder: no se puede en pausa ----------
create or replace function public.answer_turn(p_id uuid, p_index smallint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  e encounters%rowtype;
  t turns%rowtype;
begin
  perform expire_stale();
  if is_paused() then raise exception 'juego_en_pausa'; end if;

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

-- ---------- 3. Puntaje compartido: cada uno suma los aciertos de los dos (R109) ----------
create or replace function public.ranking_rows()
returns table (place bigint, player_id uuid, first_name text, last_name text,
  photo_path text, points bigint, last_point_at timestamptz)
language sql stable security definer set search_path = public as $$
  with enc as (
    select e.id, e.player_a, e.player_b, e.completed_at,
           count(*) filter (where t.is_correct) as pts
    from encounters e join turns t on t.encounter_id = e.id
    where e.status = 'completo'
    group by e.id
  ),
  per_player as (
    select player_a as player_id, pts, completed_at from enc
    union all
    select player_b, pts, completed_at from enc
  ),
  scored as (
    select player_id, sum(pts)::bigint as points,
           max(completed_at) filter (where pts > 0) as last_point_at
    from per_player group by player_id
  )
  select
    rank() over (order by coalesce(s.points, 0) desc) as place,
    p.id, p.first_name, p.last_name, p.photo_path,
    coalesce(s.points, 0) as points, s.last_point_at
  from profiles p
  left join scored s on s.player_id = p.id
  where p.status = 'activo' and p.role = 'jugador'
  order by coalesce(s.points, 0) desc, s.last_point_at asc nulls last, p.first_name, p.last_name
$$;
revoke execute on function public.ranking_rows() from public, anon, authenticated;

-- ---------- 5. Ingreso con Google: nombre y apellido de la cuenta de Google ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_domain text;
  v_email text := lower(trim(new.email));
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full text := nullif(trim(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', '')), '');
  v_first text;
  v_last text;
begin
  select nullif(trim(email_domain), '') into v_domain from settings where id = 1;
  if v_domain is not null and v_email not like '%@' || lower(v_domain) then
    raise exception 'dominio_no_permitido';
  end if;

  v_first := coalesce(
    nullif(trim(v_meta ->> 'first_name'), ''),
    nullif(trim(v_meta ->> 'given_name'), ''),
    nullif(split_part(coalesce(v_full, ''), ' ', 1), ''),
    'Sin nombre');
  v_last := coalesce(
    nullif(trim(v_meta ->> 'last_name'), ''),
    nullif(trim(v_meta ->> 'family_name'), ''),
    nullif(trim(substr(coalesce(v_full, ''), length(split_part(coalesce(v_full, ''), ' ', 1)) + 1)), ''),
    '-');

  insert into profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    v_email,
    left(v_first, 60),
    left(v_last, 60),
    case when exists (select 1 from admin_emails where email = v_email)
      then 'admin'::user_role else 'jugador'::user_role end
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
