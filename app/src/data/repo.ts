import { supabase } from '../lib/supabase';
import { Loja, OrigemPreco, Preco, Produto } from '../types';

// Camada de acesso a dados: Supabase + Open Food Facts como fonte extra de produtos.

export async function listarLojas(): Promise<Loja[]> {
  const { data, error } = await supabase.from('lojas').select('id, nome, bairro').order('nome');
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

export async function buscarProduto(ean: string): Promise<Produto | undefined> {
  const { data, error } = await supabase
    .from('produtos')
    .select('ean, descricao, imagem_url')
    .eq('ean', ean)
    .maybeSingle();
  if (error) throw error;
  if (data) return { ean: data.ean, descricao: data.descricao, imagemUrl: data.imagem_url ?? undefined, salvo: true };
  return buscarOpenFoodFacts(ean);
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
  return { ...produto, salvo: true };
}

/** Histórico do produto, do mais recente para o mais antigo. */
export async function historicoPrecos(ean: string): Promise<Preco[]> {
  const { data, error } = await supabase
    .from('precos')
    .select('id, ean, loja_id, valor, data_hora, origem, lojas(nome)')
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
  }));
}

/**
 * Mais barato considerando só o preço mais recente de cada loja
 * (um preço antigo da mesma loja já foi substituído pelo atual).
 */
export function maisBarato(historico: Preco[]): Preco | undefined {
  const atualPorLoja = new Map<string, Preco>();
  for (const p of historico) {
    if (!atualPorLoja.has(p.lojaId)) atualPorLoja.set(p.lojaId, p);
  }
  let melhor: Preco | undefined;
  for (const p of atualPorLoja.values()) {
    if (!melhor || p.valor < melhor.valor) melhor = p;
  }
  return melhor;
}

export async function registrarPreco(ean: string, lojaId: string, valor: number): Promise<void> {
  const { error } = await supabase.from('precos').insert({ ean, loja_id: lojaId, valor, origem: 'manual' });
  if (error) throw error;
}
