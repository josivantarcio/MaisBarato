-- Cadastro de produto: campos estruturados (nome, marca, conteúdo, unidade) e foto própria

alter table public.produtos
  add column nome text check (char_length(nome) between 2 and 120),
  add column marca text check (char_length(marca) <= 60),
  add column conteudo numeric(10, 3) check (conteudo > 0),
  add column unidade text check (unidade in ('g', 'kg', 'ml', 'l', 'un')),
  add column atualizado_em timestamptz,
  add constraint produtos_conteudo_com_unidade check ((conteudo is null) = (unidade is null));

-- Fotos dos produtos: leitura pública; envio por logados em <ean>/<arquivo>, até 2 MB, só imagens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "fotos de produtos: logados enviam" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos' and (storage.foldername(name))[1] ~ '^\d{8,14}$');
