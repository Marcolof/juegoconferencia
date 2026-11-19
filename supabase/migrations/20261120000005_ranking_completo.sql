-- =====================================================================
-- Ranking completo con búsqueda y páginas (F35, R86)
-- Todos los jugadores pueden ver el ranking entero (reemplaza P76: antes
-- sólo veían el top 10). El puesto es siempre el del ranking general,
-- aunque se filtre por nombre.
-- Se aplica pegándola en el SQL Editor de Supabase.
-- =====================================================================

create or replace function public.get_ranking_page(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_q text := normalize_answer(coalesce(p_search, ''));
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not is_admin() then perform require_active_player(); end if;

  select count(*) into v_total
  from ranking_rows() r
  where v_q = '' or normalize_answer(r.first_name || ' ' || r.last_name) like '%' || v_q || '%';

  select coalesce(jsonb_agg(jsonb_build_object(
      'place', x.place,
      'player_id', x.player_id,
      'first_name', x.first_name,
      'last_name', x.last_name,
      'photo_path', x.photo_path,
      'points', x.points) order by x.ord), '[]'::jsonb)
  into v_rows
  from (
    select r.*,
      row_number() over (order by r.place, r.last_point_at asc nulls last, r.first_name, r.last_name) as ord
    from ranking_rows() r
    where v_q = '' or normalize_answer(r.first_name || ' ' || r.last_name) like '%' || v_q || '%'
    order by ord
    offset (v_page - 1) * v_size
    limit v_size
  ) x;

  return jsonb_build_object('rows', v_rows, 'total', v_total, 'page', v_page, 'page_size', v_size);
end $$;

revoke execute on function public.get_ranking_page(text, integer, integer) from public, anon;
