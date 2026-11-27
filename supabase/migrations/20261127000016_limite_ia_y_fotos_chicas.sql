-- 16 · Límite de pedidos de IA por jugador y fotos más chicas (reporte 19, S4 y S8).
--
-- 1) Cada jugador puede pedir opciones con IA para sus respuestas con un margen
--    amplio (un pedido cada 15 s y hasta 20 por hora). Alcanza de sobra para
--    guardar y corregir respuestas; corta los bucles y los pedidos en paralelo.
--    La administración no tiene límite: su modo «pendientes» no pasa por acá.
-- 2) El tope de cada foto baja de 2 MB a 300 KB. La app ya la achica antes de
--    subirla, así que una foto normal pesa decenas de KB.

create table if not exists public.ai_requests (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists ai_requests_player_at on public.ai_requests (player_id, at desc);
-- Sin políticas: nadie la lee ni la escribe desde el navegador.
alter table public.ai_requests enable row level security;

-- Reserva un pedido para el jugador si está dentro del límite. Devuelve true si
-- puede seguir. El bloqueo por jugador evita que varios pedidos simultáneos pasen juntos.
create or replace function public.take_ai_slot(p_player uuid, p_min_gap_seconds int default 15, p_max_per_hour int default 20)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext('ai:' || p_player::text));
  select max(at), count(*) into v_last, v_count
    from ai_requests where player_id = p_player and at > now() - interval '1 hour';
  if v_last is not null and v_last > now() - make_interval(secs => p_min_gap_seconds) then
    return false;
  end if;
  if v_count >= p_max_per_hour then
    return false;
  end if;
  insert into ai_requests (player_id) values (p_player);
  -- Limpieza: lo de más de un día no sirve para el límite.
  delete from ai_requests where player_id = p_player and at < now() - interval '1 day';
  return true;
end $$;
revoke execute on function public.take_ai_slot(uuid, int, int) from public, anon, authenticated;
grant execute on function public.take_ai_slot(uuid, int, int) to service_role;

update storage.buckets set file_size_limit = 307200 where id = 'fotos';
