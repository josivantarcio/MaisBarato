import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ItemNota, NotaImportada } from '../data/nfce';
import { brl, dataHora } from '../format';
import { cores } from '../tema';

type Props = {
  nota: NotaImportada;
  onVincular: (item: ItemNota) => void;
  onFechar: () => void;
};

export function NotaPainel({ nota, onVincular, onFechar }: Props) {
  const registrados = nota.itens.filter((i) => i.precoRegistrado).length;
  const pendentes = nota.itens.length - registrados;
  // Pendentes primeiro: são os que pedem ação
  const itens = [...nota.itens].sort((a, b) => Number(a.precoRegistrado) - Number(b.precoRegistrado) || a.ordem - b.ordem);

  return (
    <View style={styles.raiz}>
      <View style={styles.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={styles.selo}>CUPOM FISCAL IMPORTADO</Text>
          <Text style={styles.loja} numberOfLines={1}>
            {nota.loja.nome}
          </Text>
          <Text style={styles.detalhe}>
            {dataHora(nota.emitidaEm)}
            {nota.valorTotal !== null ? ` · ${brl(nota.valorTotal)}` : ''}
          </Text>
        </View>
        <Pressable onPress={onFechar} hitSlop={8}>
          <Text style={styles.fechar}>Fechar</Text>
        </Pressable>
      </View>

      <Text style={styles.resumo}>
        {registrados} de {nota.itens.length} preços registrados
        {pendentes > 0 ? ` · toque em "Vincular" e escaneie o produto para registrar os outros` : ' ✓'}
      </Text>

      <FlatList
        data={itens}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemNome} numberOfLines={2}>
                {item.descricao}
              </Text>
              <Text style={styles.itemPreco}>
                {brl(item.valorUnitario)}
                {item.unidade && item.unidade.toUpperCase() !== 'UN' ? ` / ${item.unidade.toLowerCase()}` : ''}
              </Text>
            </View>
            {item.precoRegistrado ? (
              <Text style={styles.ok}>✓ registrado</Text>
            ) : (
              <Pressable style={styles.vincular} onPress={() => onVincular(item)}>
                <Text style={styles.vincularTexto}>Vincular</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  selo: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: cores.verde },
  loja: { fontSize: 16, fontWeight: '800', color: cores.texto },
  detalhe: { fontSize: 12, color: cores.cinza },
  fechar: { color: cores.verde, fontWeight: '700' },
  resumo: { fontSize: 12, color: cores.texto, marginVertical: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e5e8',
  },
  itemNome: { fontSize: 14, color: cores.texto },
  itemPreco: { fontSize: 12, color: cores.cinza, marginTop: 1 },
  ok: { fontSize: 12, color: cores.verde, fontWeight: '700' },
  vincular: { backgroundColor: cores.verde, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  vincularTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
