-- MaisBarato: esquema inicial (perfis, lojas, produtos, preços)

-- Perfis: um por usuário do Supabase Auth
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 80),
  criado_em timestamptz not null default now()
);

-- Cria o perfil automaticamente no cadastro, usando o "nome" enviado no signUp
create function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

create table public.lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  bairro text,
  cnpj text unique check (cnpj ~ '^\d{14}$'),
  latitude double precision,
  longitude double precision,
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

create table public.produtos (
  ean text primary key check (ean ~ '^\d{8,14}$'),
  descricao text not null check (char_length(descricao) between 2 and 200),
  imagem_url text,
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

create table public.precos (
  id uuid primary key default gen_random_uuid(),
  ean text not null references public.produtos (ean) on delete cascade,
  loja_id uuid not null references public.lojas (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  valor numeric(10, 2) not null check (valor > 0 and valor < 100000),
  data_hora timestamptz not null default now(),
  origem text not null default 'manual' check (origem in ('manual', 'nfce', 'foto'))
);

create index precos_ean_data_idx on public.precos (ean, data_hora desc);
create index precos_loja_idx on public.precos (loja_id);
create index precos_usuario_idx on public.precos (usuario_id);

-- Segurança (RLS): só usuários logados leem e colaboram
alter table public.perfis enable row level security;
alter table public.lojas enable row level security;
alter table public.produtos enable row level security;
alter table public.precos enable row level security;

create policy "perfis: logados leem" on public.perfis
  for select to authenticated using (true);
create policy "perfis: dono edita" on public.perfis
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "lojas: logados leem" on public.lojas
  for select to authenticated using (true);
create policy "lojas: logados cadastram" on public.lojas
  for insert to authenticated with check ((select auth.uid()) = criado_por);

create policy "produtos: logados leem" on public.produtos
  for select to authenticated using (true);
create policy "produtos: logados cadastram" on public.produtos
  for insert to authenticated with check ((select auth.uid()) = criado_por);
create policy "produtos: criador edita" on public.produtos
  for update to authenticated using ((select auth.uid()) = criado_por) with check ((select auth.uid()) = criado_por);

create policy "precos: logados leem" on public.precos
  for select to authenticated using (true);
create policy "precos: logados registram em seu nome" on public.precos
  for insert to authenticated with check ((select auth.uid()) = usuario_id);
create policy "precos: autor apaga" on public.precos
  for delete to authenticated using ((select auth.uid()) = usuario_id);
