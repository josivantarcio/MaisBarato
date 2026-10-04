export type Loja = {
  id: string;
  nome: string;
  bairro: string;
};

export type Produto = {
  ean: string;
  descricao: string;
  imagemUrl?: string;
};

export type OrigemPreco = 'manual' | 'nfce' | 'foto';

export type Preco = {
  id: string;
  ean: string;
  lojaId: string;
  valor: number;
  dataHora: string; // ISO 8601
  origem: OrigemPreco;
};
