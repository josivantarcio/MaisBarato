import { Loja, Preco, Produto } from '../types';

// Dados fictícios para o protótipo. Serão substituídos pelo Supabase.

export const LOJAS: Loja[] = [
  { id: 'l1', nome: 'Mercantil São José', bairro: 'Centro' },
  { id: 'l2', nome: 'Supermercado Bom Preço', bairro: 'Aldeota' },
  { id: 'l3', nome: 'Atacadão do Povo', bairro: 'Messejana' },
  { id: 'l4', nome: 'Mercadinho da Esquina', bairro: 'Benfica' },
];

// EANs de exemplo, para testar digitando o código.
export const PRODUTOS: Produto[] = [
  { ean: '7890000000011', descricao: 'Café Torrado e Moído 500g' },
  { ean: '7890000000028', descricao: 'Arroz Branco Tipo 1 5kg' },
  { ean: '7890000000035', descricao: 'Leite Integral UHT 1L' },
];

const horasAtras = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const PRECOS: Preco[] = [
  { id: 'p1', ean: '7890000000011', lojaId: 'l1', valor: 18.99, dataHora: horasAtras(2), origem: 'manual' },
  { id: 'p2', ean: '7890000000011', lojaId: 'l2', valor: 17.49, dataHora: horasAtras(26), origem: 'nfce' },
  { id: 'p3', ean: '7890000000011', lojaId: 'l3', valor: 16.9, dataHora: horasAtras(24 * 9), origem: 'manual' },
  { id: 'p4', ean: '7890000000011', lojaId: 'l3', valor: 15.99, dataHora: horasAtras(24 * 20), origem: 'manual' },
  { id: 'p5', ean: '7890000000028', lojaId: 'l1', valor: 27.9, dataHora: horasAtras(5), origem: 'manual' },
  { id: 'p6', ean: '7890000000028', lojaId: 'l4', valor: 29.5, dataHora: horasAtras(48), origem: 'manual' },
  { id: 'p7', ean: '7890000000028', lojaId: 'l2', valor: 25.99, dataHora: horasAtras(72), origem: 'nfce' },
  { id: 'p8', ean: '7890000000035', lojaId: 'l2', valor: 5.49, dataHora: horasAtras(1), origem: 'manual' },
  { id: 'p9', ean: '7890000000035', lojaId: 'l3', valor: 4.99, dataHora: horasAtras(30), origem: 'manual' },
];
