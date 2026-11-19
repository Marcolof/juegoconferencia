-- =====================================================================
-- Sin fecha de inicio, el juego NO está lanzado (F40, R96).
-- Antes, sin fechas la competencia estaba abierta siempre. Ahora hay que
-- activarla desde el panel (fecha de inicio o botón "Iniciar ahora"); hasta
-- entonces los jugadores ven que el juego va a comenzar y no pueden escanear.
-- Sin fecha de fin, la competencia no termina nunca.
-- Se aplica pegándola en el SQL Editor de Supabase.
-- =====================================================================

create or replace function public.competition_phase()
returns text language sql stable security definer set search_path = public as $$
  select case
    when competition_start is null or now() < competition_start then 'antes'
    when competition_end is not null and now() >= competition_end then 'terminada'
    else 'en_curso'
  end
  from settings where id = 1
$$;

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
  -- Sin fecha de inicio el juego no se lanzó; antes de la fecha, tampoco (R94, R96).
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
