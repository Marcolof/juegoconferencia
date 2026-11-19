-- =====================================================================
-- Juego de la convención · esquema inicial
-- Reglas: R50 a R78 (ver el README del repositorio).
-- Principio: el navegador nunca recibe la respuesta correcta. Las opciones
-- se arman y se corrigen en estas funciones (security definer).
-- =====================================================================

-- ---------- Tipos ----------
create type public.user_role as enum ('jugador', 'admin');
create type public.account_status as enum ('activo', 'suspendido');
create type public.encounter_status as enum ('turno_a', 'turno_b', 'completo', 'vencido');

-- ---------- Configuración (una sola fila) ----------
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  -- Dominio permitido para registrarse (P1). Null = cualquier dominio.
  email_domain text,
  -- Duración del encuentro desde el escaneo (R65).
  encounter_minutes smallint not null default 5 check (encounter_minutes between 1 and 60),
  -- Si se pueden iniciar encuentros (bloque horario propio, S9).
  game_open boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- Emails que reciben el rol admin al registrarse (R75).
create table public.admin_emails (
  email text primary key check (email = lower(trim(email)))
);

-- ---------- Personas ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  first_name text not null check (char_length(trim(first_name)) between 1 and 60),
  last_name text not null check (char_length(trim(last_name)) between 1 and 60),
  photo_path text,
  -- true cuando la persona sacó la foto o eligió pasar sin foto (R52).
  photo_step_done boolean not null default false,
  role public.user_role not null default 'jugador',
  status public.account_status not null default 'activo',
  -- Código opaco del QR: no es el email ni el id.
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

-- ---------- Preguntas y respuestas ----------
create table public.questions (
  id smallint primary key,
  position smallint not null unique,
  text text not null,
  is_fixed boolean not null default false
);

create table public.answers (
  player_id uuid not null references public.profiles (id) on delete cascade,
  question_id smallint not null references public.questions (id),
  text text not null check (char_length(text) between 1 and 30),       -- R70
  hidden boolean not null default false,                                -- R71
  updated_at timestamptz not null default now(),
  primary key (player_id, question_id)
);

-- Listado de respaldo para las opciones falsas (R69).
create table public.fallback_answers (
  id bigint generated always as identity primary key,
  question_id smallint not null references public.questions (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 30)
);

-- ---------- Encuentros ----------
create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references public.profiles (id) on delete cascade,  -- escanea (R54)
  player_b uuid not null references public.profiles (id) on delete cascade,  -- muestra su QR
  status public.encounter_status not null default 'turno_a',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  check (player_a <> player_b)
);
-- Cada pareja juega una sola vez (R62). Un encuentro vencido no cuenta:
-- la pareja puede reintentar (R66, propuesta).
create unique index encounters_una_vez_por_pareja
  on public.encounters (least(player_a, player_b), greatest(player_a, player_b))
  where status <> 'vencido';
create index encounters_player_a_idx on public.encounters (player_a);
create index encounters_player_b_idx on public.encounters (player_b);

-- Un turno por jugador y encuentro. correct_index nunca se expone antes de tiempo.
create table public.turns (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  answerer uuid not null references public.profiles (id) on delete cascade,
  subject uuid not null references public.profiles (id) on delete cascade,
  question_id smallint not null references public.questions (id),
  options text[] not null check (array_length(options, 1) = 3),
  correct_index smallint not null check (correct_index between 0 and 2),
  chosen_index smallint check (chosen_index between 0 and 2),
  is_correct boolean,
  answered_at timestamptz,
  unique (encounter_id, answerer)
);
create index turns_answerer_idx on public.turns (answerer);

-- =====================================================================
-- Funciones internas (no se pueden llamar desde el navegador)
-- =====================================================================

-- Misma regla que normalizeAnswer() en packages/shared (R68).
create function public.normalize_answer(t text)
returns text language sql immutable as $$
  select trim(regexp_replace(
    translate(lower(coalesce(t, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '\s+', ' ', 'g'))
$$;

-- Crea el perfil cuando alguien se registra (R50, R51, R75).
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_domain text;
  v_email text := lower(trim(new.email));
begin
  select nullif(trim(email_domain), '') into v_domain from settings where id = 1;
  if v_domain is not null and v_email not like '%@' || lower(v_domain) then
    raise exception 'dominio_no_permitido';
  end if;

  insert into profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    v_email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), 'Sin nombre'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), '-'),
    case when exists (select 1 from admin_emails where email = v_email)
      then 'admin'::user_role else 'jugador'::user_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Devuelve el id de quien llama si su cuenta está activa.
create function public.require_active_player()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := auth.uid();
  v_status account_status;
begin
  if v_id is null then raise exception 'no_autenticado'; end if;
  select status into v_status from profiles where id = v_id;
  if v_status is null then raise exception 'no_autenticado'; end if;
  if v_status = 'suspendido' then raise exception 'cuenta_suspendida'; end if;
  return v_id;
end $$;

-- Marca como vencidos los encuentros que pasaron el tiempo límite (R58).
create function public.expire_stale()
returns void language sql security definer set search_path = public as $$
  update encounters set status = 'vencido'
  where status in ('turno_a', 'turno_b') and expires_at < now();
$$;

-- Arma las 3 opciones: la real y 2 falsas de otros jugadores (R55, R67),
-- sin repetidas (R68), sin ocultas (R71) y con respaldo (R69).
create function public.build_options(p_subject uuid, p_question smallint,
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

  select coalesce(array_agg(x.t), '{}') into v_fakes from (
    select d.t from (
      select distinct on (normalize_answer(a.text)) a.text as t
      from answers a join profiles p on p.id = a.player_id
      where a.question_id = p_question
        and a.player_id <> p_subject
        and not a.hidden
        and p.status = 'activo'
        and normalize_answer(a.text) <> normalize_answer(v_real)
      order by normalize_answer(a.text), random()
    ) d order by random() limit 2
  ) x;

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

-- Ranking completo. Mismo puntaje = mismo puesto; queda más arriba quien
-- llegó primero a ese puntaje (P77). Sólo cuentan encuentros completos (R57).
create function public.ranking_rows()
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
  where p.status = 'activo'
  order by coalesce(s.points, 0) desc, s.last_point_at asc nulls last, p.first_name, p.last_name
$$;

-- =====================================================================
-- Funciones públicas (las llama la app con la sesión del jugador)
-- =====================================================================

create function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'activo')
$$;

-- Datos de configuración que necesita la pantalla de registro.
create function public.get_public_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'email_domain', nullif(trim(email_domain), ''),
    'encounter_minutes', encounter_minutes,
    'game_open', game_open)
  from settings where id = 1
$$;

-- Estado del jugador para decidir a qué pantalla va.
create function public.get_my_state()
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
    'answers', coalesce((
      select jsonb_object_agg(a.question_id::text, a.text) from answers a where a.player_id = v_me
    ), '{}'::jsonb),
    -- P79: las respuestas se pueden cambiar hasta el primer encuentro.
    'answers_locked', exists (
      select 1 from encounters e
      where v_me in (e.player_a, e.player_b) and e.status <> 'vencido')
  );
end $$;

-- Guarda la foto (o la ausencia de foto) y marca el paso como hecho (R52).
create function public.set_my_photo(p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
begin
  if p_path is not null and p_path not like v_me::text || '/%' then
    raise exception 'foto_invalida';
  end if;
  update profiles set photo_path = p_path, photo_step_done = true where id = v_me;
end $$;

-- Guarda las respuestas del cuestionario: {"1": "texto", "2": "texto", ...}
create function public.save_my_answers(p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  r record;
  v_text text;
  v_qid smallint;
begin
  if exists (
    select 1 from encounters e
    where v_me in (e.player_a, e.player_b) and e.status <> 'vencido') then
    raise exception 'respuestas_bloqueadas';
  end if;

  for r in select key, value from jsonb_each_text(p_answers) loop
    v_text := trim(regexp_replace(coalesce(r.value, ''), '\s+', ' ', 'g'));
    if r.key !~ '^\d+$' then raise exception 'respuesta_invalida'; end if;
    v_qid := r.key::smallint;
    if char_length(v_text) not between 1 and 30
      or not exists (select 1 from questions where id = v_qid) then
      raise exception 'respuesta_invalida';
    end if;
    insert into answers (player_id, question_id, text)
    values (v_me, v_qid, v_text)
    on conflict (player_id, question_id)
      do update set text = excluded.text, hidden = false, updated_at = now();
  end loop;
end $$;

-- Lo que ve cada jugador de su encuentro, sin revelar la respuesta correcta
-- hasta que los dos respondieron (R57).
create function public.get_encounter(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  e encounters%rowtype;
  o profiles%rowtype;
  t_mine turns%rowtype;
  t_other turns%rowtype;
  v_is_a boolean;
  v_my_turn jsonb := null;
begin
  if v_me is null then raise exception 'no_autenticado'; end if;
  perform expire_stale();

  select * into e from encounters where id = p_id and v_me in (player_a, player_b);
  if not found then raise exception 'encuentro_inexistente'; end if;

  v_is_a := (e.player_a = v_me);
  select * into o from profiles where id = case when v_is_a then e.player_b else e.player_a end;
  select * into t_mine from turns where encounter_id = e.id and answerer = v_me;
  select * into t_other from turns where encounter_id = e.id and answerer = o.id;

  -- A ve su pregunta desde el principio; B, cuando A ya respondió (R56).
  if (v_is_a and e.status in ('turno_a', 'turno_b', 'completo'))
     or (not v_is_a and e.status in ('turno_b', 'completo')) then
    v_my_turn := jsonb_build_object(
      'question', (select q.text from questions q where q.id = t_mine.question_id),
      'options', to_jsonb(t_mine.options),
      'chosen_index', t_mine.chosen_index,
      'is_correct', case when e.status = 'completo' then t_mine.is_correct end,
      'correct_index', case when e.status = 'completo' then t_mine.correct_index end
    );
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
    'my_turn', v_my_turn,
    'other_correct', case when e.status = 'completo' then t_other.is_correct end
  );
end $$;

-- A escanea el QR de B y empieza el encuentro (R54 a R56, R62, R65).
create function public.start_encounter(p_token text)
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

  select * into v_settings from settings where id = 1;
  if not v_settings.game_open then raise exception 'juego_cerrado'; end if;

  select * into v_other from profiles where qr_token = trim(coalesce(p_token, ''));
  if not found then raise exception 'qr_invalido'; end if;
  if v_other.id = v_me then raise exception 'mismo_jugador'; end if;
  if v_other.status <> 'activo' then raise exception 'otro_suspendido'; end if;

  select count(*) into v_total from questions;
  if (select count(*) from answers where player_id = v_me) < v_total then
    raise exception 'faltan_respuestas';
  end if;
  if (select count(*) from answers where player_id = v_other.id) < v_total then
    raise exception 'otro_faltan_respuestas';
  end if;

  -- Si ya hay un encuentro válido entre los dos: completo = ya jugaron;
  -- en curso = los dos entran al mismo (se escanearon a la vez).
  select * into v_existing from encounters
  where least(player_a, player_b) = least(v_me, v_other.id)
    and greatest(player_a, player_b) = greatest(v_me, v_other.id)
    and status <> 'vencido'
  limit 1;
  if found then
    if v_existing.status = 'completo' then raise exception 'ya_jugaron'; end if;
    return v_existing.id;
  end if;

  -- La pregunta sale al azar entre las respuestas visibles (R63).
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
    -- El otro escaneó en el mismo instante: se usa su encuentro.
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

-- El jugador elige una opción. Primero A, después B (R56).
create function public.answer_turn(p_id uuid, p_index smallint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  e encounters%rowtype;
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
    if exists (select 1 from turns where encounter_id = e.id and answerer = v_me
               and chosen_index is not null) then
      raise exception 'ya_respondiste';
    end if;
    raise exception 'no_es_tu_turno';
  end if;

  if p_index is null or p_index not between 0 and 2 then
    raise exception 'opcion_invalida';
  end if;

  update turns
  set chosen_index = p_index, is_correct = (p_index = correct_index), answered_at = now()
  where encounter_id = e.id and answerer = v_me and chosen_index is null;
  if not found then raise exception 'ya_respondiste'; end if;

  if e.status = 'turno_a' then
    update encounters set status = 'turno_b' where id = e.id;
  else
    update encounters set status = 'completo', completed_at = now() where id = e.id;
  end if;

  return get_encounter(e.id);
end $$;

-- Encuentro en curso del jugador (para que B se entere cuando lo escanean).
create function public.get_my_active_encounter()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then raise exception 'no_autenticado'; end if;
  perform expire_stale();
  select id into v_id from encounters
  where v_me in (player_a, player_b) and status in ('turno_a', 'turno_b')
  order by started_at desc limit 1;
  return v_id;
end $$;

-- Ranking: el jugador ve el top 10 (P76); la administración, todo.
create function public.get_ranking(p_limit integer default 10)
returns table (place bigint, player_id uuid, first_name text, last_name text,
  photo_path text, points bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if is_admin() then
    v_limit := p_limit;                       -- null = todos
  else
    perform require_active_player();
    v_limit := least(coalesce(p_limit, 10), 10);
  end if;
  return query
    select r.place, r.player_id, r.first_name, r.last_name, r.photo_path, r.points
    from ranking_rows() r
    limit v_limit;
end $$;

create function public.get_my_ranking()
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
    'total_players', (select count(*) from profiles where status = 'activo'));
end $$;

-- =====================================================================
-- Permisos
-- =====================================================================

alter table public.settings enable row level security;
alter table public.admin_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.fallback_answers enable row level security;
alter table public.encounters enable row level security;
alter table public.turns enable row level security;

-- Sin políticas en settings, admin_emails, fallback_answers y turns:
-- desde el navegador no se leen. El panel usa la clave de servicio en el servidor.
create policy "perfil propio" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "preguntas visibles" on public.questions
  for select to authenticated using (true);
create policy "respuestas propias" on public.answers
  for select to authenticated using (player_id = auth.uid());
-- Los encuentros no guardan secretos; se leen para Realtime.
create policy "encuentros propios" on public.encounters
  for select to authenticated using (auth.uid() in (player_a, player_b));

-- Las funciones internas no se pueden llamar desde afuera.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.require_active_player() from public, anon, authenticated;
revoke execute on function public.expire_stale() from public, anon, authenticated;
revoke execute on function public.build_options(uuid, smallint) from public, anon, authenticated;
revoke execute on function public.ranking_rows() from public, anon, authenticated;

-- Las públicas sólo con sesión, salvo la configuración del registro.
revoke execute on function public.get_my_state() from public, anon;
revoke execute on function public.set_my_photo(text) from public, anon;
revoke execute on function public.save_my_answers(jsonb) from public, anon;
revoke execute on function public.get_encounter(uuid) from public, anon;
revoke execute on function public.start_encounter(text) from public, anon;
revoke execute on function public.answer_turn(uuid, smallint) from public, anon;
revoke execute on function public.get_my_active_encounter() from public, anon;
revoke execute on function public.get_ranking(integer) from public, anon;
revoke execute on function public.get_my_ranking() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.get_public_settings() to anon, authenticated;

-- Realtime: avisa a B cuando lo escanean y a los dos cuando cambia el turno.
alter publication supabase_realtime add table public.encounters;

-- =====================================================================
-- Fotos (Storage)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Las ven sólo los jugadores registrados (P80); cada uno maneja su carpeta.
create policy "fotos: ver con sesion" on storage.objects
  for select to authenticated using (bucket_id = 'fotos');
create policy "fotos: subir la propia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: cambiar la propia" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: borrar la propia" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
