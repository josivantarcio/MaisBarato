import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Compartilhar } from '../components/Compartilhar';
import {
  acompanharLista,
  adicionarItem,
  atualizarItem,
  buscarProdutosPorNome,
  guardarListaAtual,
  InfoLista,
  ItemLista,
  lerListaAtual,
  listarItens,
  listarMembros,
  listarMinhasListas,
  Membro,
  precosAtuais,
  removerItem,
  removerMarcados,
  SugestaoProduto,
} from '../data/lista';
import { brl } from '../format';
import { compararLista, PrecoAtual } from '../lib/comparacao';
import { seloOferta } from '../lib/oferta';
import { formatarPrecoUnitario, mostrarPorUnidade, precoUnitario } from '../lib/precoUnitario';
import { cores } from '../tema';

/** Carrega as listas do usuário e a escolhida (ou a última aberta, ou a própria). */
async function buscarListaComPrecos(preferida?: string) {
  const listas = await listarMinhasListas();
  const guardada = preferida ?? (await lerListaAtual());
  const escolhida = listas.find((l) => l.id === guardada) ?? listas[0];
  const [itens, membros] = await Promise.all([listarItens(escolhida.id), listarMembros(escolhida.id)]);
  const eans = [...new Set(itens.map((i) => i.ean).filter((e): e is string => !!e))];
  await guardarListaAtual(escolhida.id);
  return { listas, escolhida, itens, membros, precos: await precosAtuais(eans) };
}

export function Lista() {
  const [listas, setListas] = useState<InfoLista[]>([]);
  const [listaId, setListaId] = useState<string>();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [compartilhando, setCompartilhando] = useState(false);
  const [itens, setItens] = useState<ItemLista[]>();
  const [precos, setPrecos] = useState<PrecoAtual[]>([]);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [texto, setTexto] = useState('');
  const [sugestoes, setSugestoes] = useState<SugestaoProduto[]>([]);

  const carregar = useCallback(
    (preferida?: string) =>
      buscarListaComPrecos(preferida)
        .then((r) => {
          setListas(r.listas);
          setListaId(r.escolhida.id);
          setMembros(r.membros);
          setItens(r.itens);
          setPrecos(r.precos);
          setErro(undefined);
        })
        .catch(() => {
          setErro('Não foi possível carregar a lista.');
          setItens((atual) => atual ?? []);
        }),
    [],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Tempo real: quando outra pessoa mexe na lista, recarrega (agrupando mudanças seguidas).
  useEffect(() => {
    if (!listaId) return;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const parar = acompanharLista(listaId, () => {
      clearTimeout(espera);
      espera = setTimeout(() => carregar(listaId), 400);
    });
    return () => {
      clearTimeout(espera);
      parar();
    };
  }, [listaId, carregar]);

  // Sugere produtos já cadastrados enquanto digita (com uma pequena espera).
  useEffect(() => {
    if (texto.trim().length < 2) return;
    let ativo = true;
    const espera = setTimeout(() => {
      buscarProdutosPorNome(texto)
        .then((s) => ativo && setSugestoes(s))
        .catch(() => ativo && setSugestoes([]));
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [texto]);

  const comparacao = useMemo(() => compararLista(itens ?? [], precos), [itens, precos]);

  const ordenados = useMemo(
    () => [...(itens ?? [])].sort((a, b) => Number(a.marcado) - Number(b.marcado)),
    [itens],
  );
  const marcados = itens?.filter((i) => i.marcado).length ?? 0;
  const pendentes = (itens?.length ?? 0) - marcados;

  async function adicionar(item: { descricao: string; ean?: string }) {
    if (!listaId) return;
    setTexto('');
    setSugestoes([]);
    try {
      const novo = await adicionarItem(listaId, item);
      setItens((atual) => [...(atual ?? []), novo]);
      if (novo.ean && !precos.some((p) => p.ean === novo.ean)) {
        const novos = await precosAtuais([novo.ean]);
        setPrecos((atual) => [...atual, ...novos]);
      }
    } catch {
      setErro('Não foi possível adicionar o item.');
    }
  }

  // Atualização otimista: muda na tela na hora e desfaz se o banco recusar.
  async function alterar(item: ItemLista, campos: Partial<Pick<ItemLista, 'marcado' | 'quantidade'>>) {
    setItens((atual) => atual?.map((i) => (i.id === item.id ? { ...i, ...campos } : i)));
    try {
      await atualizarItem(item.id, campos);
    } catch {
      setItens((atual) => atual?.map((i) => (i.id === item.id ? item : i)));
      setErro('Não foi possível salvar a alteração.');
    }
  }

  async function remover(item: ItemLista) {
    setItens((atual) => atual?.filter((i) => i.id !== item.id));
    try {
      await removerItem(item.id);
    } catch {
      setItens((atual) => [...(atual ?? []), item]);
      setErro('Não foi possível remover o item.');
    }
  }

  async function limparMarcados() {
    if (!listaId) return;
    const antes = itens;
    setItens((atual) => atual?.filter((i) => !i.marcado));
    try {
      await removerMarcados(listaId);
    } catch {
      setItens(antes);
      setErro('Não foi possível limpar os itens marcados.');
    }
  }

  async function atualizarPuxando() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  if (!itens) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={cores.verde} />
      </View>
    );
  }

  const melhorLoja = comparacao.totaisPorLoja[0];
  const textoDigitado = texto.trim();
  const listaAtual = listas.find((l) => l.id === listaId);
  const compartilhada = !!listaAtual && (!listaAtual.souDono || membros.length > 0);

  if (compartilhando && listaAtual) {
    return (
      <View style={styles.tela}>
        <Compartilhar
          lista={listaAtual}
          membros={membros}
          onVoltar={() => setCompartilhando(false)}
          onMudou={(abrir) => {
            // '' = saiu da lista compartilhada: volta para a própria
            if (abrir !== undefined) setCompartilhando(false);
            carregar(abrir === '' ? listas.find((l) => l.souDono)?.id : (abrir ?? listaId));
          }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo} numberOfLines={1}>
            {listaAtual && !listaAtual.souDono ? `Lista de ${listaAtual.donoNome}` : (listaAtual?.nome ?? 'Minha lista')}
          </Text>
          <Text style={styles.contagem}>
            {pendentes} {pendentes === 1 ? 'item' : 'itens'} para comprar
            {compartilhada ? ` · ${membros.length + 1} pessoas` : ''}
          </Text>
        </View>
        <Pressable style={styles.botaoCompartilhar} onPress={() => setCompartilhando(true)} disabled={!listaAtual}>
          <Text style={styles.botaoCompartilharTexto}>{compartilhada ? '👥 Pessoas' : '👥 Compartilhar'}</Text>
        </Pressable>
      </View>

      {listas.length > 1 && (
        <View style={styles.seletor}>
          {listas.map((l) => (
            <Pressable
              key={l.id}
              style={[styles.chip, l.id === listaId && styles.chipAtivo]}
              onPress={() => l.id !== listaId && carregar(l.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: l.id === listaId }}
            >
              <Text style={[styles.chipTexto, l.id === listaId && styles.chipTextoAtivo]} numberOfLines={1}>
                {l.souDono ? l.nome : `de ${l.donoNome}`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.adicionar}>
        <TextInput
          style={styles.input}
          placeholder="Adicionar item (ex.: café)"
          value={texto}
          onChangeText={(t) => {
            setTexto(t);
            if (t.trim().length < 2) setSugestoes([]);
          }}
          onSubmitEditing={() => textoDigitado && adicionar({ descricao: textoDigitado })}
          returnKeyType="done"
        />
        <Pressable
          style={[styles.botaoAdd, !textoDigitado && styles.desativado]}
          disabled={!textoDigitado}
          onPress={() => adicionar({ descricao: textoDigitado })}
        >
          <Text style={styles.botaoAddTexto}>+</Text>
        </Pressable>
      </View>
      {sugestoes.length > 0 && (
        <View style={styles.sugestoes}>
          {sugestoes.map((s) => (
            <Pressable key={s.ean} style={styles.sugestao} onPress={() => adicionar({ descricao: s.descricao, ean: s.ean })}>
              <Text style={styles.sugestaoTexto} numberOfLines={1}>
                {s.descricao}
              </Text>
              <Text style={styles.sugestaoDica}>com preços</Text>
            </Pressable>
          ))}
        </View>
      )}
      {erro && <Text style={styles.erro}>{erro}</Text>}

      {melhorLoja && (
        <View style={styles.resumo}>
          <Text style={styles.resumoRotulo}>MELHOR MERCADO PARA SUA LISTA</Text>
          <Text style={styles.resumoLoja} numberOfLines={1}>
            {melhorLoja.lojaNome}
          </Text>
          <Text style={styles.resumoValor}>
            {brl(melhorLoja.total)}{' '}
            <Text style={styles.resumoDetalhe}>
              ({melhorLoja.itensCobertos} de {comparacao.itensComparaveis} itens com preço)
            </Text>
          </Text>
          {comparacao.lojasNoMaisBarato > 1 && (
            <Text style={styles.resumoDetalhe}>
              Comprando cada item onde é mais barato: {brl(comparacao.totalNoMaisBarato)} em{' '}
              {comparacao.lojasNoMaisBarato} lojas
            </Text>
          )}
          {comparacao.totaisPorLoja.slice(1, 3).map((t) => (
            <Text key={t.lojaId} style={styles.resumoOutra} numberOfLines={1}>
              {t.lojaNome}: {brl(t.total)} ({t.itensCobertos} itens)
            </Text>
          ))}
        </View>
      )}

      <FlatList
        data={ordenados}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizarPuxando} />}
        ListEmptyComponent={
          <Text style={styles.vazio}>
            Sua lista está vazia. Digite um item acima ou toque em &quot;+ Lista&quot; ao escanear um produto.
          </Text>
        }
        renderItem={({ item }) => {
          const melhor = item.ean ? comparacao.melhorPorEan.get(item.ean) : undefined;
          const porUnidade = melhor && precoUnitario(melhor.valor, melhor.conteudo, melhor.unidade);
          const selo = melhor && seloOferta(melhor.valor, { promocional: false, ...melhor });
          return (
            <View style={[styles.item, item.marcado && styles.itemMarcado]}>
              <Pressable
                style={styles.toque}
                onPress={() => alterar(item, { marcado: !item.marcado })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.marcado }}
                accessibilityLabel={item.descricao}
                hitSlop={4}
              >
                <View style={[styles.caixa, item.marcado && styles.caixaMarcada]}>
                  {item.marcado && <Text style={styles.check}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemNome, item.marcado && styles.riscado]} numberOfLines={2}>
                    {item.descricao}
                  </Text>
                  {compartilhada && item.adicionadoPor && (
                    <Text style={styles.autor}>por {item.adicionadoPor}</Text>
                  )}
                  {!item.marcado &&
                    (melhor ? (
                      <>
                        <Text style={styles.itemPreco} numberOfLines={1}>
                          {brl(melhor.valor)} · {melhor.lojaNome}
                          {porUnidade && mostrarPorUnidade(melhor.conteudo, melhor.unidade)
                            ? ` · ${formatarPrecoUnitario(porUnidade)}`
                            : ''}
                        </Text>
                        {selo && (
                          <Text style={styles.itemOferta} numberOfLines={1}>
                            {selo}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.itemSemPreco}>
                        {item.ean ? 'Sem preço registrado ainda' : 'Sem código: escaneie para comparar'}
                      </Text>
                    ))}
                </View>
              </Pressable>

              {!item.marcado && (
                <View style={styles.quantidade}>
                  <Pressable
                    style={styles.qtdBotao}
                    hitSlop={6}
                    onPress={() => (item.quantidade > 1 ? alterar(item, { quantidade: item.quantidade - 1 }) : remover(item))}
                    accessibilityLabel={item.quantidade > 1 ? 'Diminuir quantidade' : 'Remover item'}
                  >
                    <Text style={styles.qtdTexto}>{item.quantidade > 1 ? '−' : '×'}</Text>
                  </Pressable>
                  <Text style={styles.qtdValor}>{item.quantidade}</Text>
                  <Pressable
                    style={styles.qtdBotao}
                    hitSlop={6}
                    onPress={() => alterar(item, { quantidade: Math.min(999, item.quantidade + 1) })}
                    accessibilityLabel="Aumentar quantidade"
                  >
                    <Text style={styles.qtdTexto}>+</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          marcados > 0 ? (
            <Pressable style={styles.limpar} onPress={limparMarcados}>
              <Text style={styles.limparTexto}>Limpar marcados ({marcados})</Text>
            </Pressable>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 16 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo },
  cabecalho: { paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  botaoCompartilhar: { backgroundColor: cores.cinzaClaro, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  botaoCompartilharTexto: { color: cores.texto, fontWeight: '700', fontSize: 13 },
  seletor: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: cores.cinzaClaro, maxWidth: 180 },
  chipAtivo: { backgroundColor: cores.verde },
  chipTexto: { fontSize: 13, color: cores.texto },
  chipTextoAtivo: { color: '#fff', fontWeight: '700' },
  autor: { fontSize: 11, color: cores.cinza, marginTop: 1 },
  titulo: { fontSize: 24, fontWeight: '800', color: cores.texto },
  contagem: { fontSize: 13, color: cores.cinza },
  adicionar: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d5da',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  botaoAdd: { backgroundColor: cores.verde, borderRadius: 10, width: 46, alignItems: 'center', justifyContent: 'center' },
  botaoAddTexto: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: -2 },
  desativado: { opacity: 0.4 },
  sugestoes: { borderWidth: 1, borderColor: '#e2e5e8', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  sugestao: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  sugestaoTexto: { flex: 1, fontSize: 14, color: cores.texto },
  sugestaoDica: { fontSize: 11, color: cores.verde, fontWeight: '700' },
  erro: { color: '#c62828', fontSize: 13, marginTop: 6 },
  resumo: { backgroundColor: cores.verde, borderRadius: 12, padding: 12, marginTop: 10 },
  resumoRotulo: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  resumoLoja: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  resumoValor: { color: '#fff', fontSize: 20, fontWeight: '800' },
  resumoDetalhe: { color: '#e6ffe9', fontSize: 12, fontWeight: '400' },
  resumoOutra: { color: '#e6ffe9', fontSize: 12, marginTop: 2 },
  vazio: { color: cores.cinza, fontSize: 14, textAlign: 'center', marginTop: 32, paddingHorizontal: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e5e8',
  },
  itemMarcado: { opacity: 0.55 },
  toque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  caixa: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: cores.verde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaMarcada: { backgroundColor: cores.verde },
  check: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: -1 },
  itemNome: { fontSize: 16, color: cores.texto },
  riscado: { textDecorationLine: 'line-through', color: cores.cinza },
  itemPreco: { fontSize: 12, color: cores.verde, fontWeight: '700', marginTop: 2 },
  itemSemPreco: { fontSize: 12, color: cores.cinza, marginTop: 2 },
  itemOferta: { fontSize: 12, color: '#b45309', fontWeight: '700' },
  quantidade: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtdBotao: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: cores.cinzaClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtdTexto: { fontSize: 18, color: cores.texto, fontWeight: '700', marginTop: -2 },
  qtdValor: { minWidth: 20, textAlign: 'center', fontSize: 15, fontWeight: '700', color: cores.texto },
  limpar: { alignItems: 'center', paddingVertical: 14 },
  limparTexto: { color: '#c62828', fontWeight: '700' },
});
