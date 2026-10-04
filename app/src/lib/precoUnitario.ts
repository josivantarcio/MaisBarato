// Preço por kg, L ou unidade, para comparar embalagens de tamanhos diferentes. Sem dependências.

import { brl } from '../format';

export type UnidadeBase = 'kg' | 'L' | 'un';

export type PrecoUnitario = { valor: number; base: UnidadeBase };

/** 500 g → 0,5 kg; 350 ml → 0,35 L; 12 un → 12 un. */
export function quantidadeBase(conteudo: number, unidade: string): { quantidade: number; base: UnidadeBase } | undefined {
  if (!(conteudo > 0)) return undefined;
  switch (unidade) {
    case 'g':
      return { quantidade: conteudo / 1000, base: 'kg' };
    case 'kg':
      return { quantidade: conteudo, base: 'kg' };
    case 'ml':
      return { quantidade: conteudo / 1000, base: 'L' };
    case 'l':
      return { quantidade: conteudo, base: 'L' };
    case 'un':
      return { quantidade: conteudo, base: 'un' };
    default:
      return undefined;
  }
}

/** R$ 10,00 por 500 g → R$ 20,00/kg. Sem conteúdo conhecido, não há preço por unidade. */
export function precoUnitario(valor: number, conteudo?: number | null, unidade?: string | null): PrecoUnitario | undefined {
  if (conteudo == null || !unidade) return undefined;
  const q = quantidadeBase(conteudo, unidade);
  if (!q) return undefined;
  return { valor: valor / q.quantidade, base: q.base };
}

/**
 * Só vale mostrar quando acrescenta informação: num pacote de 1 kg, 1 L ou 1 unidade,
 * o preço por unidade é o próprio preço.
 */
export function mostrarPorUnidade(conteudo?: number | null, unidade?: string | null): boolean {
  if (conteudo == null || !unidade) return false;
  const q = quantidadeBase(conteudo, unidade);
  return !!q && q.quantidade !== 1;
}

/** "R$ 20,00/kg" */
export function formatarPrecoUnitario(p: PrecoUnitario): string {
  return `${brl(p.valor)}/${p.base}`;
}

/**
 * A alternativa compensa se sai pelo menos 2% mais barata por unidade
 * (diferenças menores são arredondamento ou ruído).
 */
export function compensa(alternativa: PrecoUnitario, atual: PrecoUnitario | undefined): boolean {
  if (!atual) return true;
  return alternativa.base === atual.base && alternativa.valor < atual.valor * 0.98;
}
