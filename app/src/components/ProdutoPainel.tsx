import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { maisBarato } from '../data/repo';
import { brl, dataHora, ehAntigo, haQuantoTempo } from '../format';
import { cores } from '../tema';
import { Preco, Produto } from '../types';

type Props = {
  ean: string;
  produto?: Produto;
  historico: Preco[];
};

export function ProdutoPainel({ ean, produto, historico }: Props) {
  const melhor = maisBarato(historico);

  return (
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

        {melhor ? (
          <View style={styles.destaque}>
            <Text style={styles.destaqueRotulo}>MAIS BARATO</Text>
            <Text style={styles.destaquePreco}>{brl(melhor.valor)}</Text>
            <Text style={styles.destaqueLoja} numberOfLines={2}>
              {melhor.lojaNome}
            </Text>
            <Text style={styles.destaqueTempo}>{haQuantoTempo(melhor.dataHora)}</Text>
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
            const antigo = ehAntigo(p.dataHora);
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
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 12, flex: 1 },
  colunaProduto: { width: '42%' },
  colunaHistorico: { flex: 1 },
  imagem: { width: '100%', height: 90, borderRadius: 8, backgroundColor: '#fff' },
  semImagem: { alignItems: 'center', justifyContent: 'center', backgroundColor: cores.cinzaClaro },
  semImagemTexto: { color: cores.cinza, fontSize: 12 },
  descricao: { fontSize: 14, fontWeight: '600', color: cores.texto, marginTop: 6 },
  ean: { fontSize: 11, color: cores.cinza, marginTop: 2 },
  destaque: {
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: cores.verde,
  },
  destaqueRotulo: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  destaquePreco: { color: '#fff', fontSize: 22, fontWeight: '800' },
  destaqueLoja: { color: '#fff', fontSize: 12, fontWeight: '600' },
  destaqueTempo: { color: '#e6ffe9', fontSize: 11 },
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
});
