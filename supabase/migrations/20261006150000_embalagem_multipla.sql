-- Embalagens múltiplas (#31): "Biscoito 3 x 120g" tem 360 g, não 120 g.
-- Mesma assinatura da versão de 20261005150000; o gatilho preencher_conteudo passa a usar esta.
--
--   "3 x 120g", "3x120g", "6 un x 200 ml"    → multiplicador antes do tamanho
--   "CERVEJA 350ML C/12", "LEITE 1L X12"     → multiplicador depois do tamanho (comum no cupom fiscal)
--   "OVOS C/ 12", "30 un", "dúzia"           → sem peso/volume: conteúdo em unidades
create or replace function public.extrair_conteudo(p_texto text, out conteudo numeric, out unidade text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text := lower(coalesce(p_texto, ''));
  -- número + unidade de peso/volume: "500g", "1,5 L", "2 litros"
  tamanho constant text := '(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|l|lt|litros?)(?![a-z])';
  m text[];
  vezes numeric := 1;
begin
  -- até 3 dígitos no multiplicador, com borda de palavra: não confunde com códigos ("7891 x 5g")
  m := regexp_match(t, '\y(\d{1,3})\s*(?:un\w*\.?\s*)?[x×]\s*' || tamanho);
  if m is not null then
    vezes := m[1]::numeric;
    m := m[2:3];
  else
    m := regexp_match(t, tamanho || '\s*(?:[x×]|c/|com)\s*(\d{1,3})\y');
    if m is not null then
      vezes := m[3]::numeric;
      m := m[1:2];
    else
      m := regexp_match(t, tamanho);
    end if;
  end if;

  if m is not null then
    conteudo := replace(m[1], ',', '.')::numeric * vezes;
    unidade := case
      when m[2] in ('g', 'gr') then 'g'
      when m[2] = 'kg' then 'kg'
      when m[2] = 'ml' then 'ml'
      else 'l'
    end;
  else
    -- sem peso/volume: quantidade de unidades
    m := regexp_match(t, '(?:c/|com)\s*(\d{1,3})\y|\y(\d{1,3})\s*(?:un|und|unid|unidades?)\y');
    if m is not null then
      conteudo := coalesce(m[1], m[2])::numeric;
      unidade := 'un';
    elsif t ~ '\y(dz|d[uú]zia)\y' then
      conteudo := 12;
      unidade := 'un';
    end if;
  end if;

  if conteudo <= 0 then
    conteudo := null;
    unidade := null;
  end if;
end;
$$;

-- Corrige o que o gatilho já preencheu com a regra antiga: só onde o valor gravado é exatamente o que a regra
-- antiga daria (ou está vazio). Conteúdo digitado à mão, diferente disso, fica como está.
with antiga as (
  select p.ean,
         regexp_match(lower(coalesce(p.nome, p.descricao)),
                      '(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|l|lt|litros?)(?![a-z])') as m
  from public.produtos p
),
calculo as (
  select p.ean,
         n.conteudo as novo_conteudo,
         n.unidade as nova_unidade,
         case when a.m is not null then replace(a.m[1], ',', '.')::numeric end as velho_conteudo,
         case
           when a.m is null then null
           when a.m[2] in ('g', 'gr') then 'g'
           when a.m[2] = 'kg' then 'kg'
           when a.m[2] = 'ml' then 'ml'
           else 'l'
         end as velha_unidade
  from public.produtos p
  join antiga a on a.ean = p.ean
  cross join lateral public.extrair_conteudo(coalesce(p.nome, p.descricao)) n
)
update public.produtos p
set conteudo = c.novo_conteudo, unidade = c.nova_unidade
from calculo c
where c.ean = p.ean
  and c.novo_conteudo is not null
  and (
    p.conteudo is null
    or (p.conteudo = c.velho_conteudo and p.unidade = c.velha_unidade
        and (c.novo_conteudo, c.nova_unidade) is distinct from (c.velho_conteudo, c.velha_unidade))
  );
