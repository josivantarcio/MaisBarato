import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrecoAtual } from '../lib/comparacao';
import { supabase } from '../lib/supabase';

// Listas de compras: a própria do usuário e as que compartilharam com ele.

export type ItemLista = {
  id: string;
  ean: string | null;
  descricao: string;
  quantidade: number;
  marcado: boolean;
  adicionadoPor: string | null;
};

export type InfoLista = {
  id: string;
  nome: string;
  souDono: boolean;
  donoNome: string;
  codigoConvite: string | null;
  codigoExpiraEm: string | null;
};

export type Membro = { usuarioId: string; nome: string };

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

/** Todas as listas que o usuário acessa: a dele primeiro, depois as compartilhadas. */
export async function listarMinhasListas(): Promise<InfoLista[]> {
  const meuId = await obterListaPadrao().then(() => listaIdEmCache!.usuario);
  const { data, error } = await supabase
    .from('listas')
    .select('id, nome, dono_id, codigo_convite, codigo_expira_em, criado_em')
    .order('criado_em');
  if (error) throw error;

  const donos = [...new Set(data.map((l) => l.dono_id))];
  const { data: perfis, error: erroPerfis } = await supabase.from('perfis').select('id, nome').in('id', donos);
  if (erroPerfis) throw erroPerfis;
  const nomePorId = new Map(perfis.map((p) => [p.id, p.nome]));

  return data
    .map((l) => ({
      id: l.id,
      nome: l.nome,
      souDono: l.dono_id === meuId,
      donoNome: nomePorId.get(l.dono_id) ?? '?',
      codigoConvite: l.codigo_convite,
      codigoExpiraEm: l.codigo_expira_em,
    }))
    .sort((a, b) => Number(b.souDono) - Number(a.souDono));
}

export async function listarItens(listaId: string): Promise<ItemLista[]> {
  const { data, error } = await supabase
    .from('itens_lista')
    .select('id, ean, descricao, quantidade, marcado, perfis(nome)')
    .eq('lista_id', listaId)
    .order('criado_em');
  if (error) throw error;
  return data.map((i) => ({
    id: i.id,
    ean: i.ean,
    descricao: i.descricao,
    quantidade: i.quantidade,
    marcado: i.marcado,
    adicionadoPor: (i.perfis as unknown as { nome: string } | null)?.nome ?? null,
  }));
}

export async function adicionarItem(
  listaId: string,
  item: { descricao: string; ean?: string | null; quantidade?: number },
): Promise<ItemLista> {
  const { data, error } = await supabase
    .from('itens_lista')
    .insert({ lista_id: listaId, descricao: item.descricao, ean: item.ean ?? null, quantidade: item.quantidade ?? 1 })
    .select('id, ean, descricao, quantidade, marcado, perfis(nome)')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    ean: data.ean,
    descricao: data.descricao,
    quantidade: data.quantidade,
    marcado: data.marcado,
    adicionadoPor: (data.perfis as unknown as { nome: string } | null)?.nome ?? null,
  };
}

const CHAVE_LISTA_ATUAL = 'maisbarato:listaAtual';

/** Última lista aberta na aba Lista (guardada no aparelho). */
export async function lerListaAtual(): Promise<string | undefined> {
  try {
    return (await AsyncStorage.getItem(CHAVE_LISTA_ATUAL)) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function guardarListaAtual(listaId: string) {
  try {
    await AsyncStorage.setItem(CHAVE_LISTA_ATUAL, listaId);
  } catch {
    // sem armazenamento: o app volta para a lista própria na próxima vez
  }
}

/** Atalho do scanner: põe o produto na lista aberta por último (ou na própria). */
export async function adicionarNaListaAtual(item: { descricao: string; ean: string }): Promise<void> {
  const atual = await lerListaAtual();
  if (atual) {
    try {
      await adicionarItem(atual, item);
      return;
    } catch {
      // saiu da lista compartilhada ou foi removido: cai na lista própria
    }
  }
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
  const [precos, produtos] = await Promise.all([
    supabase.rpc('precos_atuais', { p_eans: eans }),
    supabase.from('produtos').select('ean, conteudo, unidade').in('ean', eans).not('conteudo', 'is', null),
  ]);
  if (precos.error) throw precos.error;
  if (produtos.error) throw produtos.error;
  const medida = new Map(produtos.data.map((p) => [p.ean, p]));
  return (
    precos.data as {
      ean: string;
      loja_id: string;
      loja_nome: string;
      valor: number;
      data_hora: string;
      promocional: boolean;
      valido_ate: string | null;
      leve: number | null;
      pague: number | null;
    }[]
  ).map(
    (p) => ({
      ean: p.ean,
      lojaId: p.loja_id,
      lojaNome: p.loja_nome,
      valor: Number(p.valor),
      dataHora: p.data_hora,
      conteudo: medida.has(p.ean) ? Number(medida.get(p.ean)!.conteudo) : undefined,
      unidade: medida.get(p.ean)?.unidade ?? undefined,
      promocional: p.promocional,
      validoAte: p.valido_ate ?? undefined,
      leve: p.leve ?? undefined,
      pague: p.pague !== null ? Number(p.pague) : undefined,
    }),
  );
}

// --- Compartilhamento ---

export async function listarMembros(listaId: string): Promise<Membro[]> {
  const { data, error } = await supabase.from('membros_lista').select('usuario_id').eq('lista_id', listaId);
  if (error) throw error;
  if (data.length === 0) return [];
  const { data: perfis, error: erroPerfis } = await supabase
    .from('perfis')
    .select('id, nome')
    .in(
      'id',
      data.map((m) => m.usuario_id),
    );
  if (erroPerfis) throw erroPerfis;
  return perfis.map((p) => ({ usuarioId: p.id, nome: p.nome }));
}

/** Gera um código novo (o anterior deixa de valer). Só o dono. */
export async function gerarCodigoConvite(listaId: string): Promise<string> {
  const { data, error } = await supabase.rpc('gerar_codigo_convite', { p_lista: listaId });
  if (error) throw error;
  return data as string;
}

/** Entra na lista do código. Devolve o id da lista, ou undefined se o código não vale. */
export async function entrarComCodigo(codigo: string): Promise<string | undefined> {
  const { data, error } = await supabase.rpc('entrar_na_lista', { p_codigo: codigo });
  if (error?.code === 'P0002') return undefined;
  if (error) throw error;
  return data as string;
}

export async function removerMembro(listaId: string, usuarioId: string) {
  const { error } = await supabase.from('membros_lista').delete().eq('lista_id', listaId).eq('usuario_id', usuarioId);
  if (error) throw error;
}

export async function sairDaLista(listaId: string) {
  await removerMembro(listaId, listaIdEmCache!.usuario);
}

/**
 * Avisa quando algo muda nos itens da lista (outra pessoa marcou, adicionou ou removeu).
 * O Realtime só entrega linhas que o usuário pode ver (RLS). Devolve a função para cancelar.
 */
export function acompanharLista(listaId: string, aoMudar: () => void): () => void {
  const canal = supabase
    .channel(`lista-${listaId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_lista' }, (mudanca) => {
      const novo = mudanca.new as { lista_id?: string } | undefined;
      const antigo = mudanca.old as { lista_id?: string } | undefined;
      const daLista = novo?.lista_id ?? antigo?.lista_id;
      // Em DELETE o registro antigo vem só com o id; na dúvida, recarrega.
      if (!daLista || daLista === listaId) aoMudar();
    })
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
