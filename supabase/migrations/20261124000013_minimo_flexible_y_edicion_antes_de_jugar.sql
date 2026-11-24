-- Dos reglas (F43):
-- 1. La cantidad de preguntas es un MÍNIMO flexible, no exacta: cada jugador
--    responde al menos settings.min_answers y hasta todas las que haya. Si el
--    administrador sube el mínimo, quien tenga menos tiene que completar para
--    poder participar, aunque el juego ya esté en curso. (Reemplaza F38/R92.)
-- 2. Las respuestas se pueden editar mientras el juego no está en curso (antes
--    de iniciar). Quedan fijas sólo si el juego ya empezó y el jugador ya tiene
--    un encuentro; ahí sólo puede SUMAR respuestas, no cambiar las que dio.

-- Respuestas fijas: tiene un encuentro Y el juego ya no está en la fase "antes".
create or replace function public.answers_locked(p_player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select competition_phase() <> 'antes'
    and exists (
      select 1 from encounters e
      where p_player in (e.player_a, e.player_b) and e.status <> 'vencido')
$$;
revoke execute on function public.answers_locked(uuid) from public, anon, authenticated;

-- Completo = tiene las fijas y al menos el mínimo (se quita el atajo de la migración 11).
create or replace function public.has_enough_answers(p_player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    not exists (
      select 1 from questions q
      where q.is_fixed
        and not exists (select 1 from answers a where a.player_id = p_player and a.question_id = q.id))
    and (select count(*) from answers a where a.player_id = p_player)
        >= (select min_answers from settings where id = 1)
$$;

create or replace function public.save_my_answers(p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  r record;
  v_text text;
  v_qid smallint;
  v_ids smallint[] := '{}';
  v_min integer;
  v_max integer;
  v_locked boolean := answers_locked(v_me);
begin
  select min_answers into v_min from settings where id = 1;
  select count(*) into v_max from questions;

  for r in select key, value from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) loop
    if r.key !~ '^\d+$' then raise exception 'respuesta_invalida'; end if;
    v_qid := r.key::smallint;
    v_text := trim(regexp_replace(coalesce(r.value, ''), '\s+', ' ', 'g'));
    if char_length(v_text) not between 1 and 30
      or not exists (select 1 from questions where id = v_qid) then
      raise exception 'respuesta_invalida';
    end if;
    v_ids := v_ids || v_qid;
  end loop;

  if exists (select 1 from questions q where q.is_fixed and not (q.id = any (v_ids))) then
    raise exception 'faltan_fijas';
  end if;
  if coalesce(array_length(v_ids, 1), 0) < v_min then raise exception 'pocas_respuestas'; end if;
  if coalesce(array_length(v_ids, 1), 0) > v_max then raise exception 'demasiadas_respuestas'; end if;

  if v_locked then
    -- El juego ya empezó y ya jugó: lo respondido tiene que venir igual; sólo se puede sumar.
    if exists (
      select 1 from answers a
      where a.player_id = v_me
        and trim(regexp_replace(coalesce(p_answers ->> a.question_id::text, ''), '\s+', ' ', 'g')) <> a.text) then
      raise exception 'respuestas_bloqueadas';
    end if;
  else
    delete from answers where player_id = v_me and not (question_id = any (v_ids));
  end if;

  for r in select key, value from jsonb_each_text(p_answers) loop
    insert into answers (player_id, question_id, text)
    values (v_me, r.key::smallint, trim(regexp_replace(r.value, '\s+', ' ', 'g')))
    on conflict (player_id, question_id)
      do update set text = excluded.text, hidden = false, updated_at = now();
  end loop;
end $$;

-- Estado del jugador: answers_locked usa la regla nueva.
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
    'answers_locked', answers_locked(v_me),
    'game_open', s.game_open,
    'questions_per_encounter', s.questions_per_encounter,
    'competition_start', s.competition_start,
    'competition_end', s.competition_end,
    'competition_phase', competition_phase(),
    'now', now()
  );
end $$;
