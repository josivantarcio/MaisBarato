import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Importação de cupom fiscal (NFC-e) pela Edge Function "importar-nfce".

export type ItemNota = {
  id: string;
  ordem: number;
  descricao: string;
  codigo: string | null;
  quantidade: number | null;
  unidade: string | null;
  valorUnitario: number;
  valorTotal: number | null;
  ean: string | null;
  precoRegistrado: boolean;
};

export type NotaImportada = {
  chave: string;
  loja: { id: string; nome: string };
  emitidaEm: string;
  valorTotal: number | null;
  itens: ItemNota[];
};

export class ErroNfce extends Error {}

/** O QR Code do cupom é uma URL com a chave de acesso de 44 dígitos (parâmetro p ou chNFe). */
export function pareceQrNfce(conteudo: string): boolean {
  let texto = conteudo.trim();
  try {
    texto = decodeURIComponent(texto);
  } catch {
    // "%" malformado: testa o texto como veio
  }
  return /^https?:\/\//i.test(texto) && /([?&]p=\d{44}|chNFe=\d{44})/i.test(texto);
}

export async function importarNfce(qr: string): Promise<NotaImportada> {
  const { data, error } = await supabase.functions.invoke('importar-nfce', { body: { qr } });
  if (error) {
    // A função devolve {erro: "..."} com uma mensagem pronta para o usuário
    if (error instanceof FunctionsHttpError) {
      const corpo = await error.context.json().catch(() => undefined);
      if (corpo?.erro) throw new ErroNfce(corpo.erro);
    }
    throw new ErroNfce('Não foi possível importar o cupom. Verifique a internet e tente de novo.');
  }
  return data as NotaImportada;
}

/** Liga um item da nota ao produto escaneado; registra o preço do cupom. */
export async function vincularItemNota(itemId: string, ean: string, descricao?: string): Promise<void> {
  const { error } = await supabase.rpc('vincular_item_nota', {
    p_item: itemId,
    p_ean: ean,
    p_descricao: descricao ?? null,
  });
  if (error) {
    if (error.code === '23505') throw new ErroNfce('Este item já foi vinculado.');
    if (error.code === '22023') throw new ErroNfce('Código de barras inválido.');
    throw new ErroNfce('Não foi possível vincular o item.');
  }
}
