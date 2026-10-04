import { PrecoAtual } from '../lib/comparacao';
import { supabase } from '../lib/supabase';

// Lista de compras do usuário (por enquanto, uma lista por pessoa).

export type ItemLista = {
  id: string;
  ean: string | null;
  descricao: string;
  quantidade: number;
  marcado: boolean;
};

export type SugestaoProduto = { ean: string; descricao: string };

let listaIdEmCache: { usuario: string; id: string } | undefined;

/** Devolve a lista do usuário, criando "Minha lista" no primeiro acesso. */
export async function obterListaPadrao(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const usuario = auth.user?.id;
  if (!usuario) throw new Error('Sem sessão');
  if (listaIdEmCache?.usuario === usuario) return listaIdEmCache.id;

  const { data, error } = await supabase
    .from('listas')
    .select('id')
    .eq('dono_id', usuario)
    .order('criado_em')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  let id = data?.id;
  if (!id) {
    const nova = await supabase.from('listas').insert({ nome: 'Minha lista' }).select('id').single();
    if (nova.error) throw nova.error;
    id = nova.data.id;
  }
  listaIdEmCache = { usuario, id: id! };
  return id!;
}

export async function listarItens(listaId: string): Promise<ItemLista[]> {
  const { data, error } = await supabase
    .from('itens_lista')
    .select('id, ean, descricao, quantidade, marcado')
    .eq('lista_id', listaId)
    .order('criado_em');
  if (error) throw error;
  return data;
}

export async function adicionarItem(
  listaId: string,
  item: { descricao: string; ean?: string | null; quantidade?: number },
): Promise<ItemLista> {
  const { data, error } = await supabase
    .from('itens_lista')
    .insert({ lista_id: listaId, descricao: item.descricao, ean: item.ean ?? null, quantidade: item.quantidade ?? 1 })
    .select('id, ean, descricao, quantidade, marcado')
    .single();
  if (error) throw error;
  return data;
}

/** Atalho usado pelo scanner: põe o produto na lista do usuário. */
export async function adicionarNaMinhaLista(item: { descricao: string; ean: string }): Promise<void> {
  await adicionarItem(await obterListaPadrao(), item);
}

export async function atualizarItem(id: string, campos: Partial<Pick<ItemLista, 'marcado' | 'quantidade'>>) {
  const { error } = await supabase.from('itens_lista').update(campos).eq('id', id);
  if (error) throw error;
}

export async function removerItem(id: string) {
  const { error } = await supabase.from('itens_lista').delete().eq('id', id);
  if (error) throw error;
}

export async function removerMarcados(listaId: string) {
  const { error } = await supabase.from('itens_lista').delete().eq('lista_id', listaId).eq('marcado', true);
  if (error) throw error;
}

/** Produtos já cadastrados cujo nome contém o texto digitado. */
export async function buscarProdutosPorNome(texto: string): Promise<SugestaoProduto[]> {
  const termo = texto.trim().replace(/[%_,()]/g, ' ');
  if (termo.length < 2) return [];
  const { data, error } = await supabase
    .from('produtos')
    .select('ean, descricao')
    .ilike('descricao', `%${termo}%`)
    .limit(5);
  if (error) throw error;
  return data;
}

export async function precosAtuais(eans: string[]): Promise<PrecoAtual[]> {
  if (eans.length === 0) return [];
  const { data, error } = await supabase.rpc('precos_atuais', { p_eans: eans });
  if (error) throw error;
  return (data as { ean: string; loja_id: string; loja_nome: string; valor: number; data_hora: string }[]).map(
    (p) => ({ ean: p.ean, lojaId: p.loja_id, lojaNome: p.loja_nome, valor: Number(p.valor), dataHora: p.data_hora }),
  );
}
