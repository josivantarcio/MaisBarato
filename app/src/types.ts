export type Loja = {
  id: string;
  nome: string;
  bairro: string | null;
  endereco: string | null;
  /** distância até o usuário, quando a posição é conhecida */
  distanciaM?: number;
};

export type NovaLoja = {
  nome: string;
  bairro?: string;
  endereco?: string;
  latitude: number;
  longitude: number;
  osmId?: string;
};

export type UnidadeConteudo = 'g' | 'kg' | 'ml' | 'l' | 'un';

export type Produto = {
  ean: string;
  /** nome para exibir (nome + marca + conteúdo, ou o texto do cupom/Open Food Facts) */
  descricao: string;
  nome?: string;
  marca?: string;
  conteudo?: number;
  unidade?: UnidadeConteudo;
  imagemUrl?: string;
  /** quem cadastrou (só essa pessoa edita) */
  criadoPor?: string;
  /** false = veio do Open Food Facts e ainda não está no nosso banco */
  salvo: boolean;
};

export type DadosProduto = {
  ean: string;
  nome: string;
  marca?: string;
  conteudo?: number;
  unidade?: UnidadeConteudo;
  imagemUrl?: string;
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
