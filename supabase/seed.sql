-- Dados de demonstração (lojas e produtos fictícios).
-- Local: aplicado no `supabase db reset`. Nuvem: `supabase db push --include-seed`.
insert into public.lojas (nome, bairro, criado_por) values
  ('Mercantil São José', 'Centro', null),
  ('Supermercado Bom Preço', 'Aldeota', null),
  ('Atacadão do Povo', 'Messejana', null),
  ('Mercadinho da Esquina', 'Benfica', null)
on conflict do nothing;

insert into public.produtos (ean, descricao, criado_por) values
  ('7890000000011', 'Café Torrado e Moído 500g', null),
  ('7890000000028', 'Arroz Branco Tipo 1 5kg', null),
  ('7890000000035', 'Leite Integral UHT 1L', null)
on conflict do nothing;
