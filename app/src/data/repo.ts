import { Loja, Preco, Produto } from '../types';
import { LOJAS, PRECOS, PRODUTOS } from './mock';

// Camada de acesso a dados. Hoje usa memória + Open Food Facts;
// depois trocamos a implementação por Supabase mantendo as mesmas funções.

const produtos = new Map(PRODUTOS.map((p) => [p.ean, p]));
const precos: Preco[] = [...PRECOS];

export function listarLojas(): Loja[] {
  return LOJAS;
}

export function buscarLoja(id: string): Loja | undefined {
  return LOJAS.find((l) => l.id === id);
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
    return { ean, descricao: descricao || `Produto ${ean}`, imagemUrl: p.image_front_small_url };
  } catch {
    return undefined;
  }
}

export async function buscarProduto(ean: string): Promise<Produto | undefined> {
  const local = produtos.get(ean);
  if (local) return local;
  const externo = await buscarOpenFoodFacts(ean);
  if (externo) produtos.set(ean, externo);
  return externo;
}

export function cadastrarProduto(produto: Produto) {
  produtos.set(produto.ean, produto);
}

/** Histórico do produto, do mais recente para o mais antigo. */
export function historicoPrecos(ean: string): Preco[] {
  return precos
    .filter((p) => p.ean === ean)
    .sort((a, b) => b.dataHora.localeCompare(a.dataHora));
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

export function registrarPreco(ean: string, lojaId: string, valor: number): Preco {
  const novo: Preco = {
    id: `p${Date.now()}`,
    ean,
    lojaId,
    valor,
    dataHora: new Date().toISOString(),
    origem: 'manual',
  };
  precos.push(novo);
  return novo;
}
