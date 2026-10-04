-- Importação de NFC-e (cupom fiscal): notas, itens, vínculo código interno → EAN

-- Notas já importadas. A chave de acesso é única: a mesma nota não entra duas vezes.
create table public.notas_fiscais (
  chave text primary key check (chave ~ '^\d{44}$'),
  loja_id uuid not null references public.lojas (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  emitida_em timestamptz not null,
  valor_total numeric(12, 2),
  importada_em timestamptz not null default now()
);

create index notas_fiscais_usuario_idx on public.notas_fiscais (usuario_id);

create table public.itens_nota (
  id uuid primary key default gen_random_uuid(),
  chave text not null references public.notas_fiscais (chave) on delete cascade,
  ordem integer not null,
  descricao text not null,
  codigo text,                       -- código do produto no mercado (nem sempre é o EAN)
  quantidade numeric(12, 4),
  unidade text,
  valor_unitario numeric(12, 2) not null check (valor_unitario > 0),
  valor_total numeric(12, 2),
  ean text references public.produtos (ean) on delete set null,
  preco_id uuid references public.precos (id) on delete set null,
  unique (chave, ordem)
);

-- Código interno de cada mercado → EAN. Preenchido quando alguém vincula um item da nota
-- escaneando o produto; daí em diante as notas desse mercado já vêm com o produto certo.
create table public.codigos_loja (
  loja_id uuid not null references public.lojas (id) on delete cascade,
  codigo text not null check (char_length(codigo) between 1 and 60),
  ean text not null references public.produtos (ean) on delete cascade,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (loja_id, codigo)
);

alter table public.notas_fiscais enable row level security;
alter table public.itens_nota enable row level security;
alter table public.codigos_loja enable row level security;

-- Escrita só pelo servidor (Edge Function com service role) ou pela função vincular_item_nota.
create policy "notas: dono lê" on public.notas_fiscais
  for select to authenticated using ((select auth.uid()) = usuario_id);
create policy "itens_nota: dono da nota lê" on public.itens_nota
  for select to authenticated using (
    exists (select 1 from public.notas_fiscais n where n.chave = itens_nota.chave and n.usuario_id = (select auth.uid()))
  );
create policy "codigos_loja: logados leem" on public.codigos_loja
  for select to authenticated using (true);

-- Preço com origem "nfce" (selo "cupom fiscal") só pode vir do servidor.
drop policy "precos: logados registram em seu nome" on public.precos;
create policy "precos: logados registram em seu nome" on public.precos
  for insert to authenticated with check ((select auth.uid()) = usuario_id and origem = 'manual');

-- Vincula um item da nota (sem EAN) ao produto escaneado pelo usuário que importou a nota.
-- Registra o preço com origem nfce e ensina o código interno daquele mercado.
create function public.vincular_item_nota(p_item uuid, p_ean text, p_descricao text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.itens_nota%rowtype;
  v_nota public.notas_fiscais%rowtype;
  v_preco uuid;
begin
  if p_ean !~ '^\d{8,14}$' then
    raise exception 'Código de barras inválido' using errcode = '22023';
  end if;

  select * into v_item from public.itens_nota where id = p_item for update;
  select * into v_nota from public.notas_fiscais where chave = v_item.chave;
  if v_item.id is null or v_nota.usuario_id is distinct from (select auth.uid()) then
    raise exception 'Item não encontrado' using errcode = 'P0002';
  end if;
  if v_item.preco_id is not null then
    raise exception 'Item já vinculado' using errcode = '23505';
  end if;

  insert into public.produtos (ean, descricao, criado_por)
  values (p_ean, coalesce(nullif(trim(p_descricao), ''), v_item.descricao), (select auth.uid()))
  on conflict (ean) do nothing;

  insert into public.precos (ean, loja_id, usuario_id, valor, data_hora, origem)
  values (p_ean, v_nota.loja_id, (select auth.uid()), v_item.valor_unitario, v_nota.emitida_em, 'nfce')
  returning id into v_preco;

  update public.itens_nota set ean = p_ean, preco_id = v_preco where id = p_item;

  if v_item.codigo is not null then
    insert into public.codigos_loja (loja_id, codigo, ean, criado_por)
    values (v_nota.loja_id, v_item.codigo, p_ean, (select auth.uid()))
    on conflict (loja_id, codigo) do nothing;  -- o primeiro vínculo vale
  end if;

  return v_preco;
end;
$$;

revoke execute on function public.vincular_item_nota(uuid, text, text) from public, anon;
grant execute on function public.vincular_item_nota(uuid, text, text) to authenticated;
