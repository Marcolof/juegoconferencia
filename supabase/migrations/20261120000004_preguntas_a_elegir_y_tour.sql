-- =====================================================================
-- Preguntas a elegir y tour de bienvenida (F34, R80 a R84)
-- - Se suman 10 preguntas (ids 5 a 14) con su listado de respaldo (R69).
-- - Cada jugador elige qué preguntas responde: las fijas son obligatorias
--   y el total tiene que llegar al mínimo de la configuración (R81).
-- - El tour de bienvenida se marca como visto en el perfil (R84).
-- Se aplica pegándola en el SQL Editor de Supabase.
-- =====================================================================

-- ---------- Configuración y perfil ----------
alter table public.settings
  add column min_answers smallint not null default 4 check (min_answers between 1 and 30);

alter table public.profiles
  add column tour_done boolean not null default false;

-- ---------- 10 preguntas nuevas ----------
insert into public.questions (id, position, text, is_fixed) values
  (5, 5, '¿Cuál es tu comida favorita?', false),
  (6, 6, '¿Qué hacés en tu tiempo libre?', false),
  (7, 7, '¿Qué serie o película volverías a ver?', false),
  (8, 8, '¿Qué música escuchás más?', false),
  (9, 9, '¿Qué deporte practicás o mirás?', false),
  (10, 10, '¿Cuál es tu animal favorito?', false),
  (11, 11, '¿Qué país te gustaría conocer?', false),
  (12, 12, '¿Qué te gustaría aprender a hacer?', false),
  (13, 13, 'Si pudieras viajar a otra época, ¿a cuál irías?', false),
  (14, 14, '¿Cuál fue tu primer trabajo?', false);

insert into public.fallback_answers (question_id, text) values
  (5, 'Pizza'), (5, 'Sushi'), (5, 'Pastas'), (5, 'Hamburguesa'), (5, 'Empanadas'),
  (5, 'Tacos'), (5, 'Ensalada'), (5, 'Carne a la parrilla'), (5, 'Pollo al horno'),
  (5, 'Paella'), (5, 'Helado'), (5, 'Comida india'),

  (6, 'Deporte'), (6, 'Música'), (6, 'Series'), (6, 'Cocinar'), (6, 'Leer'),
  (6, 'Viajar'), (6, 'Videojuegos'), (6, 'Salir con amigos'), (6, 'Jardinería'),
  (6, 'Dibujar'), (6, 'Bailar'), (6, 'Dormir la siesta'),

  (7, 'Friends'), (7, 'El Padrino'), (7, 'Titanic'), (7, 'Breaking Bad'),
  (7, 'Harry Potter'), (7, 'Star Wars'), (7, 'The Office'), (7, 'Volver al futuro'),
  (7, 'Toy Story'), (7, 'Matrix'), (7, 'Shrek'), (7, 'Stranger Things'),

  (8, 'Rock'), (8, 'Pop'), (8, 'Electrónica'), (8, 'Reggaetón'), (8, 'Jazz'),
  (8, 'Cumbia'), (8, 'Clásica'), (8, 'Hip hop'), (8, 'Folclore'), (8, 'Indie'),
  (8, 'Salsa'), (8, 'Metal'),

  (9, 'Fútbol'), (9, 'Tenis'), (9, 'Básquet'), (9, 'Running'), (9, 'Natación'),
  (9, 'Vóley'), (9, 'Rugby'), (9, 'Pádel'), (9, 'Ciclismo'), (9, 'Yoga'),
  (9, 'Hockey'), (9, 'Ninguno'),

  (10, 'Perro'), (10, 'Gato'), (10, 'Caballo'), (10, 'Delfín'), (10, 'León'),
  (10, 'Elefante'), (10, 'Pingüino'), (10, 'Tortuga'), (10, 'Loro'), (10, 'Conejo'),
  (10, 'Lobo'), (10, 'Búho'),

  (11, 'Japón'), (11, 'Italia'), (11, 'Islandia'), (11, 'Australia'), (11, 'Canadá'),
  (11, 'Egipto'), (11, 'México'), (11, 'Grecia'), (11, 'Noruega'), (11, 'Tailandia'),
  (11, 'Perú'), (11, 'Nueva Zelanda'),

  (12, 'Tocar la guitarra'), (12, 'Cocinar'), (12, 'Bailar tango'), (12, 'Surfear'),
  (12, 'Pintar'), (12, 'Hablar japonés'), (12, 'Programar'), (12, 'Hacer magia'),
  (12, 'Bucear'), (12, 'Escalar'), (12, 'Sacar buenas fotos'), (12, 'Cantar'),

  (13, 'Prehistoria'), (13, 'Egipto antiguo'), (13, 'Grecia y Roma'), (13, 'Edad Media'),
  (13, 'Renacimiento'), (13, 'Lejano Oeste'), (13, 'Años 20'), (13, 'Años 60'),
  (13, 'Años 80'), (13, 'Época victoriana'), (13, 'Época de los dinosaurios'), (13, 'El futuro'),

  (14, 'Mozo'), (14, 'Cadete'), (14, 'Vendedor'), (14, 'Niñera'),
  (14, 'Profesor particular'), (14, 'Repartidor'), (14, 'Cajero'), (14, 'Recepcionista'),
  (14, 'Promotor'), (14, 'Pasante'), (14, 'Ayudante de cocina'), (14, 'Atención al cliente');

-- ---------- Regla: ¿tiene respuestas suficientes para jugar? (R81) ----------
create function public.has_enough_answers(p_player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    not exists (
      select 1 from questions q
      where q.is_fixed
        and not exists (select 1 from answers a where a.player_id = p_player and a.question_id = q.id))
    and (select count(*) from answers a where a.player_id = p_player)
        >= (select min_answers from settings where id = 1)
$$;
revoke execute on function public.has_enough_answers(uuid) from public, anon, authenticated;

-- ---------- Configuración visible para el juego ----------
create or replace function public.get_public_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'email_domain', nullif(trim(email_domain), ''),
    'encounter_minutes', encounter_minutes,
    'game_open', game_open,
    'min_answers', min_answers)
  from settings where id = 1
$$;

-- ---------- Estado del jugador ----------
create or replace function public.get_my_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  p profiles%rowtype;
begin
  if v_me is null then raise exception 'no_autenticado'; end if;
  select * into p from profiles where id = v_me;
  if not found then raise exception 'no_autenticado'; end if;
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
    'min_answers', (select min_answers from settings where id = 1),
    'answers_ready', has_enough_answers(v_me),
    'tour_done', p.tour_done,
    'answers', coalesce((
      select jsonb_object_agg(a.question_id::text, a.text) from answers a where a.player_id = v_me
    ), '{}'::jsonb),
    -- P79: las respuestas se pueden cambiar hasta el primer encuentro.
    'answers_locked', exists (
      select 1 from encounters e
      where v_me in (e.player_a, e.player_b) and e.status <> 'vencido')
  );
end $$;

-- ---------- Guardar respuestas: las elegidas reemplazan a las anteriores ----------
-- {"1": "texto", "2": "texto", "7": "texto"}: las preguntas que no vienen se borran.
create or replace function public.save_my_answers(p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  r record;
  v_text text;
  v_qid smallint;
  v_ids smallint[] := '{}';
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
  if coalesce(array_length(v_ids, 1), 0) < (select min_answers from settings where id = 1) then
    raise exception 'pocas_respuestas';
  end if;

  delete from answers where player_id = v_me and not (question_id = any (v_ids));

  for r in select key, value from jsonb_each_text(p_answers) loop
    insert into answers (player_id, question_id, text)
    values (v_me, r.key::smallint, trim(regexp_replace(r.value, '\s+', ' ', 'g')))
    on conflict (player_id, question_id)
      do update set text = excluded.text, hidden = false, updated_at = now();
  end loop;
end $$;

-- ---------- Marcar el tour como visto (R84) ----------
create function public.mark_tour_done()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  update profiles set tour_done = true where id = auth.uid();
end $$;
revoke execute on function public.mark_tour_done() from public, anon;

-- ---------- Empezar un encuentro: usa la regla nueva de respuestas ----------
create or replace function public.start_encounter(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  v_other profiles%rowtype;
  v_settings settings%rowtype;
  v_existing encounters%rowtype;
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
