-- Preço por kg/L: conteúdo extraído do nome e comparação entre embalagens parecidas

create extension if not exists pg_trgm with schema extensions;

-- "CAFE PILAO 500G" → (500, g); "Coca-Cola 1,5 L" → (1.5, l); "Nescau · Nestlé · 400g" → (400, g)
create function public.extrair_conteudo(p_texto text, out conteudo numeric, out unidade text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  m text[];
begin
  m := regexp_match(lower(coalesce(p_texto, '')), '(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|l|lt|litros?)(?![a-z])');
  if m is null then
    return;
  end if;
  conteudo := replace(m[1], ',', '.')::numeric;
  unidade := case
    when m[2] in ('g', 'gr') then 'g'
    when m[2] = 'kg' then 'kg'
    when m[2] = 'ml' then 'ml'
    else 'l'
  end;
  if conteudo <= 0 then
    conteudo := null;
    unidade := null;
  end if;
end;
$$;

-- Ao cadastrar sem conteúdo (Open Food Facts, cupom, vínculo), tenta tirar do nome
create function public.preencher_conteudo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c record;
begin
  if new.conteudo is null then
    select * into c from public.extrair_conteudo(coalesce(new.nome, new.descricao));
    new.conteudo := c.conteudo;
    new.unidade := c.unidade;
  end if;
  return new;
end;
$$;

create trigger produtos_preencher_conteudo
  before insert on public.produtos
  for each row execute function public.preencher_conteudo();

-- Produtos que já existem
-- (o update não pode citar a própria tabela num "from lateral"; por isso a subconsulta)
update public.produtos p
set (conteudo, unidade) = (
  select c.conteudo, c.unidade
  from public.extrair_conteudo(coalesce(p.nome, p.descricao)) c
)
where p.conteudo is null
  and (public.extrair_conteudo(coalesce(p.nome, p.descricao))).conteudo is not null;

create index produtos_nome_trgm_idx on public.produtos
  using gin (lower(coalesce(nome, descricao)) extensions.gin_trgm_ops);

-- Produtos parecidos (nome semelhante e mesma família de unidade), com o menor preço atual de cada um
-- (últimos 60 dias) e o preço por kg, L ou unidade. Inclui o próprio produto, para comparar.
create function public.alternativas_por_unidade(p_ean text, p_limite integer default 5)
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
    where pr.ean in (select c.ean from candidatos c) and pr.data_hora > now() - interval '60 days'
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

revoke execute on function public.alternativas_por_unidade(text, integer) from public, anon;
grant execute on function public.alternativas_por_unidade(text, integer) to authenticated;
