-- =====================================================================
-- Cada jugador responde EXACTAMENTE la cantidad de preguntas configurada
-- (settings.min_answers, hoy 4): ni menos, ni más (F38, R92).
-- Reemplaza el "mínimo" de F34. La columna conserva el nombre min_answers;
-- en el panel se muestra como "Cantidad de preguntas".
-- Se aplica pegándola en el SQL Editor de Supabase.
-- =====================================================================

create or replace function public.save_my_answers(p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  r record;
  v_text text;
  v_qid smallint;
  v_ids smallint[] := '{}';
  v_total integer;
begin
  if exists (
    select 1 from encounters e
    where v_me in (e.player_a, e.player_b) and e.status <> 'vencido') then
    raise exception 'respuestas_bloqueadas';
  end if;

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

  select min_answers into v_total from settings where id = 1;
  if coalesce(array_length(v_ids, 1), 0) < v_total then
    raise exception 'pocas_respuestas';
  end if;
  if coalesce(array_length(v_ids, 1), 0) > v_total then
    raise exception 'demasiadas_respuestas';
  end if;

  delete from answers where player_id = v_me and not (question_id = any (v_ids));

  for r in select key, value from jsonb_each_text(p_answers) loop
    insert into answers (player_id, question_id, text)
    values (v_me, r.key::smallint, trim(regexp_replace(r.value, '\s+', ' ', 'g')))
    on conflict (player_id, question_id)
      do update set text = excluded.text, hidden = false, updated_at = now();
  end loop;
end $$;

-- Quien ya tenga más respuestas que la cantidad configurada se queda con las
-- primeras (por orden de pregunta), para cumplir la regla.
delete from public.answers a
using (
  select player_id, question_id,
    row_number() over (partition by player_id order by question_id) as n
  from public.answers
) x, public.settings s
where s.id = 1 and a.player_id = x.player_id and a.question_id = x.question_id and x.n > s.min_answers;
