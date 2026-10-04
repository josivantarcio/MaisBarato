-- Lojas reais: endereço, vínculo com o OpenStreetMap e busca por proximidade

alter table public.lojas
  add column endereco text check (char_length(endereco) <= 200),
  add column osm_id text unique,
  add constraint lojas_latitude_valida check (latitude between -90 and 90),
  add constraint lojas_longitude_valida check (longitude between -180 and 180),
  add constraint lojas_coordenadas_juntas check ((latitude is null) = (longitude is null));

create index lojas_lat_lng_idx on public.lojas (latitude, longitude);

-- Lojas num raio (em metros) da posição informada, da mais perto para a mais longe.
-- Distância pela fórmula de Haversine; o filtro de latitude corta a busca antes do cálculo.
create function public.lojas_proximas(
  p_lat double precision,
  p_lng double precision,
  p_raio_m double precision default 5000
)
returns table (
  id uuid,
  nome text,
  bairro text,
  endereco text,
  latitude double precision,
  longitude double precision,
  distancia_m double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.id, l.nome, l.bairro, l.endereco, l.latitude, l.longitude, d.m
  from public.lojas l
  cross join lateral (
    select 6371000 * 2 * asin(sqrt(
      power(sin(radians(l.latitude - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(l.latitude)) * power(sin(radians(l.longitude - p_lng) / 2), 2)
    )) as m
  ) d
  where l.latitude between p_lat - p_raio_m / 111320.0 and p_lat + p_raio_m / 111320.0
    and d.m <= p_raio_m
  order by d.m
  limit 30;
$$;

revoke execute on function public.lojas_proximas(double precision, double precision, double precision) from public, anon;
grant execute on function public.lojas_proximas(double precision, double precision, double precision) to authenticated;
