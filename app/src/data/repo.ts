import { supabase } from '../lib/supabase';
import { Coordenadas } from '../lib/geo';
import { formatarConteudo } from '../format';
import { Oferta, vigente } from '../lib/oferta';
import { PrecoUnitario, UnidadeBase } from '../lib/precoUnitario';
import { DadosProduto, Loja, NovaLoja, OrigemPreco, Preco, Produto, UnidadeConteudo } from '../types';

// Camada de acesso a dados: Supabase + Open Food Facts como fonte extra de produtos.

/** Todas as lojas por nome. Usado quando não temos a localização do usuário. */
export async function listarLojas(): Promise<Loja[]> {
  const { data, error } = await supabase.from('lojas').select('id, nome, bairro, endereco').order('nome').limit(100);
  if (error) throw error;
  return data;
}

/** Lojas cadastradas num raio da posição, da mais perto para a mais longe. */
export async function lojasProximas(pos: Coordenadas, raioM = 5000): Promise<Loja[]> {
  const { data, error } = await supabase.rpc('lojas_proximas', {
    p_lat: pos.latitude,
    p_lng: pos.longitude,
    p_raio_m: raioM,
  });
  if (error) throw error;
  return (data as (Loja & { distancia_m: number })[]).map((l) => ({
    id: l.id,
    nome: l.nome,
    bairro: l.bairro,
    endereco: l.endereco,
    distanciaM: l.distancia_m,
  }));
}

/**
 * Cadastra uma loja. Se ela veio do OpenStreetMap e alguém já cadastrou,
 * devolve a existente em vez de duplicar.
 */
export async function cadastrarLoja(nova: NovaLoja): Promise<Loja> {
  if (nova.osmId) {
    const { data: existente, error } = await supabase
      .from('lojas')
      .select('id, nome, bairro, endereco')
      .eq('osm_id', nova.osmId)
      .maybeSingle();
    if (error) throw error;
    if (existente) return existente;
  }
  const { data, error } = await supabase
    .from('lojas')
    .insert({
      nome: nova.nome,
      bairro: nova.bairro ?? null,
      endereco: nova.endereco ?? null,
      latitude: nova.latitude,
      longitude: nova.longitude,
      osm_id: nova.osmId ?? null,
    })
    .select('id, nome, bairro, endereco')
    .single();
  if (error) throw error;
  return data;
}

async function buscarOpenFoodFacts(ean: string): Promise<Produto | undefined> {
  try {
    const resp = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,brands,quantity,image_front_small_url`,
      { headers: { 'User-Agent': 'MaisBarato/0.1 (prototipo)' } },
    );
    if (!resp.ok) return undefined;
    const json = await resp.json();
    if (json.status !== 1 || !json.product) return undefined;
    const p = json.product;
    const descricao = [p.product_name, p.brands, p.quantity].filter(Boolean).join(' · ');
    return {
      ean,
      descricao: descricao || `Produto ${ean}`,
      imagemUrl: p.image_front_small_url,
      salvo: false,
    };
  } catch {
    return undefined;
  }
}

const COLUNAS_PRODUTO = 'ean, descricao, nome, marca, conteudo, unidade, imagem_url, criado_por';

type LinhaProduto = {
  ean: string;
  descricao: string;
  nome: string | null;
  marca: string | null;
  conteudo: number | null;
  unidade: string | null;
  imagem_url: string | null;
  criado_por: string | null;
};

function produtoDaLinha(l: LinhaProduto): Produto {
  return {
    ean: l.ean,
    descricao: l.descricao,
    nome: l.nome ?? undefined,
    marca: l.marca ?? undefined,
    conteudo: l.conteudo !== null ? Number(l.conteudo) : undefined,
    unidade: (l.unidade as UnidadeConteudo | null) ?? undefined,
    imagemUrl: l.imagem_url ?? undefined,
    criadoPor: l.criado_por ?? undefined,
    salvo: true,
  };
}

export async function buscarProduto(ean: string): Promise<Produto | undefined> {
  const { data, error } = await supabase.from('produtos').select(COLUNAS_PRODUTO).eq('ean', ean).maybeSingle();
  if (error) throw error;
  if (data) return produtoDaLinha(data);
  return buscarOpenFoodFacts(ean);
}

/** "Feijão Carioca Kicaldo 1 kg" */
export function montarDescricao(d: Pick<DadosProduto, 'nome' | 'marca' | 'conteudo' | 'unidade'>): string {
  const tamanho = d.conteudo && d.unidade ? formatarConteudo(d.conteudo, d.unidade) : '';
  return [d.nome.trim(), d.marca?.trim(), tamanho].filter(Boolean).join(' ').slice(0, 200);
}

/** Cadastra um produto novo com os campos do formulário. */
export async function cadastrarProdutoCompleto(d: DadosProduto): Promise<Produto> {
  const { data, error } = await supabase
    .from('produtos')
    .insert({
      ean: d.ean,
      descricao: montarDescricao(d),
      nome: d.nome.trim(),
      marca: d.marca?.trim() || null,
      conteudo: d.conteudo ?? null,
      unidade: d.unidade ?? null,
      imagem_url: d.imagemUrl ?? null,
    })
    .select(COLUNAS_PRODUTO)
    .single();
  if (error) throw error;
  return produtoDaLinha(data);
}

/** Edita um produto (o banco só permite a quem cadastrou). */
export async function editarProduto(d: DadosProduto): Promise<Produto> {
  const { data, error } = await supabase
    .from('produtos')
    .update({
      descricao: montarDescricao(d),
      nome: d.nome.trim(),
      marca: d.marca?.trim() || null,
      conteudo: d.conteudo ?? null,
      unidade: d.unidade ?? null,
      imagem_url: d.imagemUrl ?? null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('ean', d.ean)
    .select(COLUNAS_PRODUTO)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Sem permissão para editar este produto');
  return produtoDaLinha(data);
}

/** Garante que o produto existe no banco antes de registrar um preço para ele. */
export async function salvarProduto(produto: Omit<Produto, 'salvo'>): Promise<Produto> {
  const { error } = await supabase
    .from('produtos')
    .upsert(
      { ean: produto.ean, descricao: produto.descricao, imagem_url: produto.imagemUrl ?? null },
      { onConflict: 'ean', ignoreDuplicates: true },
    );
  if (error) throw error;
  // Lê de volta: se já existia, vale o que está no banco
  return (await buscarProduto(produto.ean)) ?? { ...produto, salvo: true };
}

/** Histórico do produto, do mais recente para o mais antigo. */
export async function historicoPrecos(ean: string): Promise<Preco[]> {
  const { data, error } = await supabase
    .from('precos')
    .select('id, ean, loja_id, valor, data_hora, origem, promocional, valido_ate, leve, pague, lojas(nome)')
    .eq('ean', ean)
    .order('data_hora', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    ean: p.ean,
    lojaId: p.loja_id,
    lojaNome: (p.lojas as unknown as { nome: string } | null)?.nome ?? '?',
    valor: Number(p.valor),
    dataHora: p.data_hora,
    origem: p.origem as OrigemPreco,
    promocional: p.promocional,
    validoAte: p.valido_ate ?? undefined,
    leve: p.leve ?? undefined,
    pague: p.pague !== null ? Number(p.pague) : undefined,
  }));
}

/**
 * Mais barato considerando só o preço mais recente de cada loja
 * (um preço antigo da mesma loja já foi substituído pelo atual).
 * Promoção vencida não conta: naquela loja vale o preço anterior.
 */
export function maisBarato(historico: Preco[], dia?: string): Preco | undefined {
  const atualPorLoja = new Map<string, Preco>();
  for (const p of historico) {
    if (!atualPorLoja.has(p.lojaId) && vigente(p, dia)) atualPorLoja.set(p.lojaId, p);
  }
  let melhor: Preco | undefined;
  for (const p of atualPorLoja.values()) {
    if (!melhor || p.valor < melhor.valor) melhor = p;
  }
  return melhor;
}

/** Embalagem parecida (nome semelhante, mesma família kg/L/un) com o menor preço atual. */
export type Alternativa = {
  ean: string;
  descricao: string;
  valor: number;
  lojaNome: string;
  dataHora: string;
  precoUnitario: PrecoUnitario;
};

/**
 * Produtos parecidos com o menor preço dos últimos 60 dias, do menor para o maior preço por kg|L|un.
 * Inclui o próprio produto. Lista vazia se o produto não tem conteúdo cadastrado.
 */
export async function alternativasPorUnidade(ean: string): Promise<Alternativa[]> {
  const { data, error } = await supabase.rpc('alternativas_por_unidade', { p_ean: ean });
  if (error) throw error;
  return (
    data as {
      ean: string;
      descricao: string;
      valor: number;
      loja_nome: string;
      data_hora: string;
      preco_unitario: number;
      unidade_base: UnidadeBase;
    }[]
  ).map((a) => ({
    ean: a.ean,
    descricao: a.descricao,
    valor: Number(a.valor),
    lojaNome: a.loja_nome,
    dataHora: a.data_hora,
    precoUnitario: { valor: Number(a.preco_unitario), base: a.unidade_base },
  }));
}

export async function registrarPreco(ean: string, lojaId: string, valor: number, oferta?: Oferta): Promise<void> {
  const { error } = await supabase.from('precos').insert({
    ean,
    loja_id: lojaId,
    valor,
    origem: 'manual',
    promocional: oferta?.promocional ?? false,
    valido_ate: oferta?.validoAte ?? null,
    leve: oferta?.leve ?? null,
    pague: oferta?.pague ?? null,
  });
  if (error) throw error;
}
