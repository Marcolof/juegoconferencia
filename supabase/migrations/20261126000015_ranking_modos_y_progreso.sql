-- =====================================================================
-- Modos del ranking en el panel y "Mi progreso" / "Jugadores" en el juego (F49).
--
-- 1. player_standings(): como ranking_rows() pero con la cantidad de
--    encuentros completos de cada jugador y el orden exacto (ord), que
--    desempata por quien llegó primero al puntaje (P77). Interna.
-- 2. get_admin_ranking(): todo eso, sólo para administración. El panel arma
--    los tres modos (participantes al azar, por grupos, ranking) en el navegador.
-- 3. get_my_progress(): encuentros y puntos propios, SIN puesto. Sólo dice si
--    está entre los primeros 10 o 50 (y sólo si hay más jugadores que eso y
--    ya sumó algún punto).
-- 4. get_players_page(): todos los jugadores, por orden alfabético y sin puntaje.
-- 5. El ranking con puntaje deja de estar disponible para los jugadores
--    (reemplaza R86): get_ranking sólo para administración; get_ranking_page y
--    get_my_ranking ya no se pueden llamar desde el navegador.
-- Se aplica pegándola en el SQL Editor de Supabase.
-- =====================================================================

-- ---------- 1. Posiciones con encuentros ----------
create or replace function public.player_standings()
returns table (ord bigint, place bigint, player_id uuid, first_name text, last_name text,
  photo_path text, points bigint, encounters bigint, last_point_at timestamptz)
language sql stable security definer set search_path = public as $$
  with enc as (
    select e.id, e.player_a, e.player_b, e.completed_at,
           count(t.id) filter (where t.is_correct) as pts
    from encounters e left join turns t on t.encounter_id = e.id
    where e.status = 'completo'
    group by e.id
  ),
  per_player as (
    select player_a as player_id, pts, completed_at from enc
    union all
    select player_b, pts, completed_at from enc
  ),
  scored as (
    select player_id, sum(pts)::bigint as points, count(*)::bigint as encounters,
           max(completed_at) filter (where pts > 0) as last_point_at
    from per_player group by player_id
  )
  select
    row_number() over (order by coalesce(s.points, 0) desc, s.last_point_at asc nulls last,
                       p.first_name, p.last_name, p.id) as ord,
    rank() over (order by coalesce(s.points, 0) desc) as place,
    p.id, p.first_name, p.last_name, p.photo_path,
    coalesce(s.points, 0), coalesce(s.encounters, 0), s.last_point_at
  from profiles p
  left join scored s on s.player_id = p.id
  where p.status = 'activo' and p.role = 'jugador'
  order by 1
$$;
revoke execute on function public.player_standings() from public, anon, authenticated;

-- ---------- 2. Panel: todo el ranking con encuentros ----------
create or replace function public.get_admin_ranking()
returns table (ord bigint, place bigint, player_id uuid, first_name text, last_name text,
  photo_path text, points bigint, encounters bigint, last_point_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_admin() then raise exception 'sin_permiso'; end if;
  return query select * from player_standings();
end $$;
revoke execute on function public.get_admin_ranking() from public, anon;

-- ---------- 3. Juego: mi progreso, sin puesto ----------
create or replace function public.get_my_progress()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := require_active_player();
  r record;
  v_total integer;
begin
  select * into r from player_standings() s where s.player_id = v_me;
  select count(*) into v_total from profiles where status = 'activo' and role = 'jugador';
  return jsonb_build_object(
    'encounters', coalesce(r.encounters, 0),
    'points', coalesce(r.points, 0),
    'tier', case
      when coalesce(r.points, 0) = 0 then null
      when r.ord <= 10 and v_total > 10 then 'top10'
      when r.ord <= 50 and v_total > 50 then 'top50'
      else null
    end);
end $$;
revoke execute on function public.get_my_progress() from public, anon;

-- ---------- 4. Juego: todos los jugadores, sin puntaje ----------
create or replace function public.get_players_page(
  p_page integer default 1,
  p_page_size integer default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_total integer;
  v_rows jsonb;
begin
  perform require_active_player();
  select count(*) into v_total from profiles where status = 'activo' and role = 'jugador';
  select coalesce(jsonb_agg(jsonb_build_object(
      'player_id', x.id,
      'first_name', x.first_name,
      'last_name', x.last_name,
      'photo_path', x.photo_path) order by x.k1, x.k2, x.id), '[]'::jsonb)
  into v_rows
  from (
    select id, first_name, last_name, photo_path,
           lower(first_name) as k1, lower(last_name) as k2
    from profiles
    where status = 'activo' and role = 'jugador'
    order by k1, k2, id
    offset (v_page - 1) * v_size
    limit v_size
  ) x;
  return jsonb_build_object('rows', v_rows, 'total', v_total, 'page', v_page, 'page_size', v_size);
end $$;
revoke execute on function public.get_players_page(integer, integer) from public, anon;

-- ---------- 5. El ranking con puntaje queda sólo para administración ----------
create or replace function public.get_ranking(p_limit integer default 10)
returns table (place bigint, player_id uuid, first_name text, last_name text,
  photo_path text, points bigint)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_admin() then raise exception 'sin_permiso'; end if;
  return query
    select r.place, r.player_id, r.first_name, r.last_name, r.photo_path, r.points
    from ranking_rows() r
    limit p_limit;
end $$;
revoke execute on function public.get_ranking_page(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.get_my_ranking() from public, anon, authenticated;
