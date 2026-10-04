-- Compartilhar lista com a família: membros, convite por código e tempo real

alter table public.listas
  add column codigo_convite text unique check (codigo_convite ~ '^[A-Z2-9]{6}$'),
  add column codigo_expira_em timestamptz;

create table public.membros_lista (
  lista_id uuid not null references public.listas (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  entrou_em timestamptz not null default now(),
  primary key (lista_id, usuario_id)
);

create index membros_lista_usuario_idx on public.membros_lista (usuario_id);

-- Quem adicionou cada item (aponta para perfis para o app buscar o nome junto)
alter table public.itens_lista
  add column adicionado_por uuid references public.perfis (id) on delete set null default auth.uid();

-- Dono ou membro? security definer evita recursão entre as policies de listas e membros_lista.
create function public.pode_acessar_lista(p_lista uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.listas where id = p_lista and dono_id = (select auth.uid()))
      or exists (select 1 from public.membros_lista where lista_id = p_lista and usuario_id = (select auth.uid()));
$$;

revoke execute on function public.pode_acessar_lista(uuid) from public, anon;
grant execute on function public.pode_acessar_lista(uuid) to authenticated;

-- Listas: dono e membros leem; só o dono edita e apaga (policies de escrita já existem)
drop policy "listas: dono lê" on public.listas;
create policy "listas: dono e membros leem" on public.listas
  for select to authenticated using ((select auth.uid()) = dono_id or public.pode_acessar_lista(id));

-- Itens: qualquer participante da lista
drop policy "itens: dono da lista acessa" on public.itens_lista;
create policy "itens: participantes da lista acessam" on public.itens_lista
  for all to authenticated
  using (public.pode_acessar_lista(lista_id))
  with check (public.pode_acessar_lista(lista_id));

-- Membros: participantes veem quem está na lista; sai quem quiser, e o dono remove qualquer um.
-- Entrar só pela função entrar_na_lista (não há policy de insert).
alter table public.membros_lista enable row level security;

create policy "membros: participantes veem" on public.membros_lista
  for select to authenticated using (public.pode_acessar_lista(lista_id));
create policy "membros: sair ou dono remove" on public.membros_lista
  for delete to authenticated using (
    (select auth.uid()) = usuario_id
    or exists (select 1 from public.listas l where l.id = lista_id and l.dono_id = (select auth.uid()))
  );

-- Gera (ou troca) o código de convite da lista. Só o dono. Vale por 7 dias.
create function public.gerar_codigo_convite(p_lista uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 símbolos, sem 0/O/1/I
  bytes bytea;
  codigo text;
begin
  if not exists (select 1 from public.listas where id = p_lista and dono_id = (select auth.uid())) then
    raise exception 'Só o dono da lista pode convidar' using errcode = '42501';
  end if;
  loop
    bytes := extensions.gen_random_bytes(6);
    codigo := '';
    for i in 0..5 loop
      -- 256 é múltiplo de 32: o resto não vicia a distribuição
      codigo := codigo || substr(alfabeto, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    begin
      update public.listas
        set codigo_convite = codigo, codigo_expira_em = now() + interval '7 days'
        where id = p_lista;
      return codigo;
    exception when unique_violation then
      -- código já usado por outra lista: tenta de novo
    end;
  end loop;
end;
$$;

revoke execute on function public.gerar_codigo_convite(uuid) from public, anon;
grant execute on function public.gerar_codigo_convite(uuid) to authenticated;

-- Entra na lista dona do código. Devolve o id da lista.
create function public.entrar_na_lista(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lista uuid;
  v_dono uuid;
begin
  select id, dono_id into v_lista, v_dono
  from public.listas
  where codigo_convite = upper(trim(p_codigo)) and codigo_expira_em > now();

  if v_lista is null then
    raise exception 'Código inválido ou expirado' using errcode = 'P0002';
  end if;

  if v_dono <> (select auth.uid()) then
    insert into public.membros_lista (lista_id, usuario_id)
    values (v_lista, (select auth.uid()))
    on conflict do nothing;
  end if;

  return v_lista;
end;
$$;

revoke execute on function public.entrar_na_lista(text) from public, anon;
grant execute on function public.entrar_na_lista(text) to authenticated;

-- Tempo real: mudanças nos itens chegam aos participantes (o Realtime respeita o RLS)
alter publication supabase_realtime add table public.itens_lista;
