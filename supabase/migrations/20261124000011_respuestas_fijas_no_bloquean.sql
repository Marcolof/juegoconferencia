-- Quien ya jugó un encuentro tiene las respuestas fijas: no se las puede obligar
-- a completarlas. Si el administrador sube la cantidad exigida (min_answers)
-- después de que alguien ya jugó, esa persona quedaba atrapada: la pantalla
-- principal la mandaba a /respuestas y ahí no podía editar ni volver.
-- Ahora las respuestas fijas cuentan como completas.

create or replace function public.has_enough_answers(p_player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from encounters e
      where p_player in (e.player_a, e.player_b) and e.status <> 'vencido')
    or (
      not exists (
        select 1 from questions q
        where q.is_fixed
          and not exists (select 1 from answers a where a.player_id = p_player and a.question_id = q.id))
      and (select count(*) from answers a where a.player_id = p_player)
          >= (select min_answers from settings where id = 1)
    )
$$;
revoke execute on function public.has_enough_answers(uuid) from public, anon, authenticated;
