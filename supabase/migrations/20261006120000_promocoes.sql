-- Promoções (#30): preço promocional com validade e ofertas por quantidade ("leve 3 pague 2").
-- `valor` continua sendo o preço de UMA unidade na prateleira. Promoção vencida deixa de valer:
-- naquela loja volta a contar o preço anterior.

alter table public.precos
  add column promocional boolean not null default false,
  add column valido_ate date,
  -- leve 3 pague 2 → (3, 2); "2ª unidade com 50%" → (2, 1.5)
  add column leve smallint,
  add column pague numeric(4,2);

alter table public.precos
  add constraint precos_oferta_check check (
    (leve is null) = (pague is null)
    and (leve is null or (leve between 2 and 12 and pague > 0 and pague < leve))
  ),
  add constraint precos_promocao_validade_check check (not promocional or valido_ate is not null),
  -- validade só para promoção/oferta, a partir do dia do registro e por no máximo 90 dias
  add constraint precos_validade_check check (
    valido_ate is null
    or (
      (promocional or leve is not null)
      and valido_ate between (data_hora at time zone 'America/Sao_Paulo')::date
                         and (data_hora at time zone 'America/Sao_Paulo')::date + 90
    )
  );

-- Preço mais recente de cada (ean, loja), ignorando promoções e ofertas vencidas.
-- Muda o tipo de retorno (campos da oferta), por isso drop + create.
drop function public.precos_atuais(text[]);

create function public.precos_atuais(p_eans text[])
returns table (
  ean text,
  loja_id uuid,
  loja_nome text,
  valor numeric,
  data_hora timestamptz,
  promocional boolean,
  valido_ate date,
  leve smallint,
  pague numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (p.ean, p.loja_id) p.ean, p.loja_id, l.nome, p.valor, p.data_hora,
         p.promocional, p.valido_ate, p.leve, p.pague
  from public.precos p
  join public.lojas l on l.id = p.loja_id
  where p.ean = any (p_eans)
    and (p.valido_ate is null or p.valido_ate >= (now() at time zone 'America/Sao_Paulo')::date)
  order by p.ean, p.loja_id, p.data_hora desc;
$$;

revoke execute on function public.precos_atuais(text[]) from public, anon;
grant execute on function public.precos_atuais(text[]) to authenticated;

-- Mesma função da migração 20261005150000, agora ignorando promoções vencidas.
create or replace function public.alternativas_por_unidade(p_ean text, p_limite integer default 5)
returns table (
  ean text,
  descricao text,
  conteudo numeric,
  unidade text,
  valor numeric,
  loja_nome text,
  data_hora timestamptz,
  preco_unitario numeric,
  unidade_base text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select lower(coalesce(nome, descricao)) as nome,
           case when unidade in ('g', 'kg') then 'kg' when unidade in ('ml', 'l') then 'L' else 'un' end as familia
    from public.produtos
    where ean = p_ean and unidade is not null
  ),
  candidatos as (
    select p.ean, p.descricao, p.conteudo, p.unidade,
           case when p.unidade in ('g', 'ml') then p.conteudo / 1000 else p.conteudo end as quantidade_base,
           b.familia
    from public.produtos p
    join base b
      on lower(coalesce(p.nome, p.descricao)) operator(extensions.%) b.nome
     and extensions.similarity(lower(coalesce(p.nome, p.descricao)), b.nome) >= 0.4
     and (case when p.unidade in ('g', 'kg') then 'kg' when p.unidade in ('ml', 'l') then 'L' else 'un' end) = b.familia
    where p.unidade is not null
  ),
  atuais as (
    select distinct on (pr.ean, pr.loja_id) pr.ean, pr.loja_id, pr.valor, pr.data_hora
    from public.precos pr
    where pr.ean in (select c.ean from candidatos c)
      and pr.data_hora > now() - interval '60 days'
      and (pr.valido_ate is null or pr.valido_ate >= (now() at time zone 'America/Sao_Paulo')::date)
    order by pr.ean, pr.loja_id, pr.data_hora desc
  ),
  melhor as (
    select distinct on (a.ean) a.ean, a.loja_id, a.valor, a.data_hora
    from atuais a
    order by a.ean, a.valor
  )
  select c.ean, c.descricao, c.conteudo, c.unidade, m.valor, l.nome, m.data_hora,
         round(m.valor / c.quantidade_base, 2), c.familia
  from candidatos c
  join melhor m on m.ean = c.ean
  join public.lojas l on l.id = m.loja_id
  order by m.valor / c.quantidade_base
  limit p_limite;
$$;
