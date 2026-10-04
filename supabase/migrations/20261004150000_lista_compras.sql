-- Lista de compras: itens com caixa de marcação e comparação de preços

create table public.listas (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  nome text not null default 'Minha lista' check (char_length(nome) between 1 and 60),
  criado_em timestamptz not null default now()
);

create index listas_dono_idx on public.listas (dono_id);

create table public.itens_lista (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references public.listas (id) on delete cascade,
  -- ean é opcional: dá para anotar "pão" sem código; só itens com ean entram na comparação
  ean text references public.produtos (ean) on delete set null,
  descricao text not null check (char_length(descricao) between 1 and 200),
  quantidade integer not null default 1 check (quantidade between 1 and 999),
  marcado boolean not null default false,
  criado_em timestamptz not null default now()
);

create index itens_lista_lista_idx on public.itens_lista (lista_id);

alter table public.listas enable row level security;
alter table public.itens_lista enable row level security;

-- Por enquanto cada lista é só do dono (compartilhar com a família vem depois).
create policy "listas: dono lê" on public.listas
  for select to authenticated using ((select auth.uid()) = dono_id);
create policy "listas: dono cria" on public.listas
  for insert to authenticated with check ((select auth.uid()) = dono_id);
create policy "listas: dono edita" on public.listas
  for update to authenticated using ((select auth.uid()) = dono_id) with check ((select auth.uid()) = dono_id);
create policy "listas: dono apaga" on public.listas
  for delete to authenticated using ((select auth.uid()) = dono_id);

create policy "itens: dono da lista acessa" on public.itens_lista
  for all to authenticated
  using (exists (select 1 from public.listas l where l.id = lista_id and l.dono_id = (select auth.uid())))
  with check (exists (select 1 from public.listas l where l.id = lista_id and l.dono_id = (select auth.uid())));

-- Preço mais recente de cada produto em cada loja (base da comparação da lista).
create function public.precos_atuais(p_eans text[])
returns table (
  ean text,
  loja_id uuid,
  loja_nome text,
  valor numeric,
  data_hora timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (p.ean, p.loja_id) p.ean, p.loja_id, l.nome, p.valor, p.data_hora
  from public.precos p
  join public.lojas l on l.id = p.loja_id
  where p.ean = any (p_eans)
  order by p.ean, p.loja_id, p.data_hora desc;
$$;

revoke execute on function public.precos_atuais(text[]) from public, anon;
grant execute on function public.precos_atuais(text[]) to authenticated;
