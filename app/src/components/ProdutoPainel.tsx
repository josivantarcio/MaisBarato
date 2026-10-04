import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alternativa, maisBarato } from '../data/repo';
import { brl, dataHora, ehAntigo, haQuantoTempo } from '../format';
import { seloOferta, vigente } from '../lib/oferta';
import { compensa, formatarPrecoUnitario, mostrarPorUnidade, precoUnitario } from '../lib/precoUnitario';
import { cores } from '../tema';
import { Preco, Produto } from '../types';

type Props = {
  ean: string;
  produto?: Produto;
  historico: Preco[];
  /** produto desconhecido: mostra o botão de cadastrar */
  onCadastrar?: () => void;
  /** quem cadastrou pode editar */
  onEditar?: () => void;
  /** embalagens parecidas de outros tamanhos (preço por kg/L) */
  alternativas?: Alternativa[];
  onAbrirProduto?: (ean: string) => void;
};

export function ProdutoPainel({
  ean,
  produto,
  historico,
  onCadastrar,
  onEditar,
  alternativas = [],
  onAbrirProduto,
}: Props) {
  const melhor = maisBarato(historico);
  const seloMelhor = melhor && seloOferta(melhor.valor, melhor);
  const porUnidade = melhor ? precoUnitario(melhor.valor, produto?.conteudo, produto?.unidade) : undefined;
  // a lista vem ordenada por preço por unidade: a primeira de outro código é a melhor alternativa
  const outra = alternativas.find((a) => a.ean !== ean);
  const dica = outra && compensa(outra.precoUnitario, porUnidade) ? outra : undefined;

  return (
    <View style={styles.painel}>
      <View style={styles.linha}>
        {/* Coluna esquerda: imagem, descrição e o mais barato */}
        <View style={styles.colunaProduto}>
          {produto?.imagemUrl ? (
            <Image source={{ uri: produto.imagemUrl }} style={styles.imagem} resizeMode="contain" />
          ) : (
            <View style={[styles.imagem, styles.semImagem]}>
              <Text style={styles.semImagemTexto}>sem foto</Text>
            </View>
          )}
          <Text style={styles.descricao} numberOfLines={3}>
            {produto?.descricao ?? 'Produto não cadastrado'}
          </Text>
          <Text style={styles.ean}>{ean}</Text>
          {onCadastrar && (
            <Pressable style={styles.cadastrar} onPress={onCadastrar}>
              <Text style={styles.cadastrarTexto}>Cadastrar produto</Text>
            </Pressable>
          )}
          {onEditar && (
            <Pressable onPress={onEditar} hitSlop={6}>
              <Text style={styles.editar}>Editar produto</Text>
            </Pressable>
          )}

          {melhor ? (
            <View style={styles.destaque}>
              <Text style={styles.destaqueRotulo}>MAIS BARATO</Text>
              <Text style={styles.destaquePreco}>{brl(melhor.valor)}</Text>
              {porUnidade && mostrarPorUnidade(produto?.conteudo, produto?.unidade) && (
                <Text style={styles.destaqueUnidade}>{formatarPrecoUnitario(porUnidade)}</Text>
              )}
              <Text style={styles.destaqueLoja} numberOfLines={2}>
                {melhor.lojaNome}
              </Text>
              <Text style={styles.destaqueTempo}>{haQuantoTempo(melhor.dataHora)}</Text>
            {seloMelhor && <Text style={styles.destaqueOferta}>{seloMelhor}</Text>}
            </View>
          ) : (
            <Text style={styles.vazio}>Nenhum preço ainda. Seja o primeiro!</Text>
          )}
        </View>

        {/* Coluna direita: histórico local | preço | data e hora */}
        <View style={styles.colunaHistorico}>
          <Text style={styles.titulo}>Histórico</Text>
          <ScrollView>
            {historico.map((p) => {
              const ehMelhor = p.id === melhor?.id;
              // promoção vencida aparece apagada, como preço antigo
              const antigo = ehAntigo(p.dataHora) || !vigente(p);
              const selo = seloOferta(p.valor, p);
              return (
                <View key={p.id} style={[styles.item, ehMelhor && styles.itemMelhor, antigo && styles.itemAntigo]}>
                  <View style={styles.itemTopo}>
                    <Text style={styles.itemLoja} numberOfLines={1}>
                      {p.lojaNome}
                    </Text>
                    <Text style={[styles.itemPreco, ehMelhor && styles.itemPrecoMelhor]}>{brl(p.valor)}</Text>
                  </View>
                  <Text style={styles.itemData}>
                    {dataHora(p.dataHora)}
                    {p.origem === 'nfce' ? '  · cupom fiscal' : ''}
                  </Text>
                  {selo && <Text style={styles.itemOferta}>{selo}</Text>}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {dica && (
        <Pressable
          style={styles.dica}
          onPress={onAbrirProduto ? () => onAbrirProduto(dica.ean) : undefined}
          accessibilityRole="button"
          accessibilityHint="Abre este produto"
        >
          <Text style={styles.dicaTitulo}>
            💡 {porUnidade ? `Mais barato por ${dica.precoUnitario.base}` : 'Preço de outro tamanho'}:{' '}
            {formatarPrecoUnitario(dica.precoUnitario)}
          </Text>
          <Text style={styles.dicaTexto} numberOfLines={2}>
            {dica.descricao} · {brl(dica.valor)} · {dica.lojaNome}
            {porUnidade ? ` (aqui: ${formatarPrecoUnitario(porUnidade)})` : ''}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  painel: { flex: 1, gap: 8 },
  linha: { flexDirection: 'row', gap: 12, flex: 1 },
  colunaProduto: { width: '42%' },
  colunaHistorico: { flex: 1 },
  imagem: { width: '100%', height: 90, borderRadius: 8, backgroundColor: '#fff' },
  semImagem: { alignItems: 'center', justifyContent: 'center', backgroundColor: cores.cinzaClaro },
  semImagemTexto: { color: cores.cinza, fontSize: 12 },
  descricao: { fontSize: 14, fontWeight: '600', color: cores.texto, marginTop: 6 },
  ean: { fontSize: 11, color: cores.cinza, marginTop: 2 },
  cadastrar: { backgroundColor: cores.verde, borderRadius: 8, paddingVertical: 7, alignItems: 'center', marginTop: 6 },
  cadastrarTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  editar: { color: cores.verde, fontWeight: '700', fontSize: 12, marginTop: 4 },
  destaque: {
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: cores.verde,
  },
  destaqueRotulo: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  destaquePreco: { color: '#fff', fontSize: 22, fontWeight: '800' },
  destaqueUnidade: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: -2 },
  destaqueLoja: { color: '#fff', fontSize: 12, fontWeight: '600' },
  destaqueTempo: { color: '#e6ffe9', fontSize: 11 },
  destaqueOferta: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 4 },
  vazio: { marginTop: 8, color: cores.cinza, fontSize: 13 },
  titulo: { fontSize: 13, fontWeight: '700', color: cores.texto, marginBottom: 4 },
  item: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: cores.cinzaClaro,
  },
  itemMelhor: { backgroundColor: '#dff5e3', borderWidth: 1, borderColor: cores.verde },
  itemAntigo: { opacity: 0.55 },
  itemTopo: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  itemLoja: { flex: 1, fontSize: 12, color: cores.texto },
  itemPreco: { fontSize: 13, fontWeight: '700', color: cores.texto },
  itemPrecoMelhor: { color: cores.verde },
  itemData: { fontSize: 11, color: cores.cinza },
  itemOferta: { fontSize: 11, color: '#b45309', fontWeight: '700' },
  dica: { backgroundColor: '#fff8e1', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#ffe082' },
  dicaTitulo: { fontSize: 13, fontWeight: '700', color: cores.texto },
  dicaTexto: { fontSize: 12, color: cores.texto, marginTop: 2 },
});
