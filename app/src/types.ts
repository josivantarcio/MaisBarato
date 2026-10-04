export type Loja = {
  id: string;
  nome: string;
  bairro: string | null;
};

export type Produto = {
  ean: string;
  descricao: string;
  imagemUrl?: string;
  /** false = veio do Open Food Facts e ainda não está no nosso banco */
  salvo: boolean;
};

export type OrigemPreco = 'manual' | 'nfce' | 'foto';

export type Preco = {
  id: string;
  ean: string;
  lojaId: string;
  lojaNome: string;
  valor: number;
  dataHora: string; // ISO 8601
  origem: OrigemPreco;
};
