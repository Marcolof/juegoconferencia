-- =====================================================================
-- Una cuenta de administración no es un jugador:
--   · no aparece en el ranking ni en el conteo de jugadores
--   · no puede iniciar encuentros ni ser escaneada
-- =====================================================================

create or replace function public.ranking_rows()
returns table (place bigint, player_id uuid, first_name text, last_name text,
  photo_path text, points bigint, last_point_at timestamptz)
language sql stable security definer set search_path = public as $$
  with scored as (
    select t.answerer as player_id, count(*) as points, max(e.completed_at) as last_point_at
    from turns t join encounters e on e.id = t.encounter_id
    where e.status = 'completo' and t.is_correct
    group by t.answerer
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

create or replace function public.get_my_ranking()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  r record;
begin
  if v_me is null then raise exception 'no_autenticado'; end if;
  select place, points into r from ranking_rows() where player_id = v_me;
  return jsonb_build_object(
    'place', r.place,
    'points', coalesce(r.points, 0),
    'total_players', (select count(*) from profiles where status = 'activo' and role = 'jugador'));
end $$;

create or replace function public.start_encounter(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  v_other profiles%rowtype;
  v_settings settings%rowtype;
  v_existing encounters%rowtype;
  v_total smallint;
  v_id uuid;
  v_q_for_a smallint;
  v_q_for_b smallint;
  v_opts record;
begin
  perform expire_stale();

  if exists (select 1 from profiles where id = v_me and role = 'admin') then
    raise exception 'admin_no_juega';
  end if;

  select * into v_settings from settings where id = 1;
  if not v_settings.game_open then raise exception 'juego_cerrado'; end if;

  select * into v_other from profiles where qr_token = trim(coalesce(p_token, ''));
  if not found then raise exception 'qr_invalido'; end if;
  if v_other.id = v_me then raise exception 'mismo_jugador'; end if;
  if v_other.status <> 'activo' then raise exception 'otro_suspendido'; end if;
  if v_other.role = 'admin' then raise exception 'qr_invalido'; end if;

  select count(*) into v_total from questions;
  if (select count(*) from answers where player_id = v_me) < v_total then
    raise exception 'faltan_respuestas';
  end if;
  if (select count(*) from answers where player_id = v_other.id) < v_total then
    raise exception 'otro_faltan_respuestas';
  end if;

  select * into v_existing from encounters
  where least(player_a, player_b) = least(v_me, v_other.id)
    and greatest(player_a, player_b) = greatest(v_me, v_other.id)
    and status <> 'vencido'
  limit 1;
  if found then
    if v_existing.status = 'completo' then raise exception 'ya_jugaron'; end if;
    return v_existing.id;
  end if;

  select question_id into v_q_for_a from answers
  where player_id = v_other.id and not hidden order by random() limit 1;
  select question_id into v_q_for_b from answers
  where player_id = v_me and not hidden order by random() limit 1;
  if v_q_for_a is null then raise exception 'otro_faltan_respuestas'; end if;
  if v_q_for_b is null then raise exception 'faltan_respuestas'; end if;

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

  select * into v_opts from build_options(v_other.id, v_q_for_a);
  insert into turns (encounter_id, answerer, subject, question_id, options, correct_index)
  values (v_id, v_me, v_other.id, v_q_for_a, v_opts.options, v_opts.correct_index);

  select * into v_opts from build_options(v_me, v_q_for_b);
  insert into turns (encounter_id, answerer, subject, question_id, options, correct_index)
  values (v_id, v_other.id, v_me, v_q_for_b, v_opts.options, v_opts.correct_index);

  return v_id;
end $$;
