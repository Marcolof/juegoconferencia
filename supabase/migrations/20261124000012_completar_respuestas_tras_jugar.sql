-- Quien ya jugó un encuentro no puede cambiar ni sacar lo que respondió, pero
-- sí AGREGAR respuestas si el administrador subió la cantidad exigida
-- (settings.min_answers) después de que jugara. Sin esto quedaba sin forma de
-- completar. Las respuestas que ya tenía tienen que llegar idénticas.
-- Quien todavía no jugó sigue igual: exactamente min_answers, editables.

create or replace function public.save_my_answers(p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  r record;
  v_text text;
  v_qid smallint;
  v_ids smallint[] := '{}';
  v_total integer;
  v_have integer;
  v_locked boolean;
begin
  v_locked := exists (
    select 1 from encounters e
    where v_me in (e.player_a, e.player_b) and e.status <> 'vencido');
  select min_answers into v_total from settings where id = 1;
  select count(*) into v_have from answers where player_id = v_me;

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

  if v_locked then
    -- Ya jugó: lo respondido tiene que venir igual; sólo se puede sumar.
    if exists (
      select 1 from answers a
      where a.player_id = v_me
        and trim(regexp_replace(coalesce(p_answers ->> a.question_id::text, ''), '\s+', ' ', 'g')) <> a.text) then
      raise exception 'respuestas_bloqueadas';
    end if;
    if coalesce(array_length(v_ids, 1), 0) < v_total then raise exception 'pocas_respuestas'; end if;
    if coalesce(array_length(v_ids, 1), 0) > greatest(v_total, v_have) then raise exception 'demasiadas_respuestas'; end if;
  else
    if exists (select 1 from questions q where q.is_fixed and not (q.id = any (v_ids))) then
      raise exception 'faltan_fijas';
    end if;
    if coalesce(array_length(v_ids, 1), 0) < v_total then raise exception 'pocas_respuestas'; end if;
    if coalesce(array_length(v_ids, 1), 0) > v_total then raise exception 'demasiadas_respuestas'; end if;
    delete from answers where player_id = v_me and not (question_id = any (v_ids));
  end if;

  for r in select key, value from jsonb_each_text(p_answers) loop
    insert into answers (player_id, question_id, text)
    values (v_me, r.key::smallint, trim(regexp_replace(r.value, '\s+', ' ', 'g')))
    on conflict (player_id, question_id)
      do update set text = excluded.text, hidden = false, updated_at = now();
  end loop;
end $$;
