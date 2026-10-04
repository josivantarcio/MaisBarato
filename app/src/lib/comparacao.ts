// Comparação de preços da lista de compras. Sem dependências, para poder testar fora do app.

export type PrecoAtual = {
  ean: string;
  lojaId: string;
  lojaNome: string;
  valor: number;
  dataHora: string;
  /** conteúdo da embalagem, para o preço por kg/L */
  conteudo?: number;
  unidade?: string;
};

export type ItemComparavel = {
  id: string;
  ean: string | null;
  quantidade: number;
  marcado: boolean;
};

export type TotalLoja = {
  lojaId: string;
  lojaNome: string;
  /** soma (preço x quantidade) dos itens que a loja tem */
  total: number;
  itensCobertos: number;
};

export type Comparacao = {
  /** menor preço atual de cada ean */
  melhorPorEan: Map<string, PrecoAtual>;
  /** lojas ordenadas: mais itens cobertos primeiro, depois menor total */
  totaisPorLoja: TotalLoja[];
  /** itens pendentes (não marcados) que têm código e entram na comparação */
  itensComparaveis: number;
  /** total comprando cada item na loja onde ele é mais barato */
  totalNoMaisBarato: number;
  lojasNoMaisBarato: number;
};

/** `precos` deve ter só o preço mais recente de cada (ean, loja), como devolve `precos_atuais`. */
export function compararLista(itens: ItemComparavel[], precos: PrecoAtual[]): Comparacao {
  const melhorPorEan = new Map<string, PrecoAtual>();
  for (const p of precos) {
    const atual = melhorPorEan.get(p.ean);
    if (!atual || p.valor < atual.valor) melhorPorEan.set(p.ean, p);
  }

  // Só o que ainda falta comprar entra nos totais.
  const pendentes = itens.filter((i): i is ItemComparavel & { ean: string } => !i.marcado && !!i.ean);

  const precoPorLoja = new Map<string, Map<string, PrecoAtual>>();
  for (const p of precos) {
    if (!precoPorLoja.has(p.lojaId)) precoPorLoja.set(p.lojaId, new Map());
    precoPorLoja.get(p.lojaId)!.set(p.ean, p);
  }

  const totaisPorLoja: TotalLoja[] = [];
  for (const [lojaId, porEan] of precoPorLoja) {
    let total = 0;
    let itensCobertos = 0;
    for (const item of pendentes) {
      const p = porEan.get(item.ean);
      if (p) {
        total += p.valor * item.quantidade;
        itensCobertos++;
      }
    }
    if (itensCobertos > 0) {
      totaisPorLoja.push({ lojaId, lojaNome: porEan.values().next().value!.lojaNome, total, itensCobertos });
    }
  }
  totaisPorLoja.sort((a, b) => b.itensCobertos - a.itensCobertos || a.total - b.total);

  let totalNoMaisBarato = 0;
  const lojasUsadas = new Set<string>();
  for (const item of pendentes) {
    const melhor = melhorPorEan.get(item.ean);
    if (melhor) {
      totalNoMaisBarato += melhor.valor * item.quantidade;
      lojasUsadas.add(melhor.lojaId);
    }
  }

  return {
    melhorPorEan,
    totaisPorLoja,
    itensComparaveis: pendentes.length,
    totalNoMaisBarato,
    lojasNoMaisBarato: lojasUsadas.size,
  };
}
