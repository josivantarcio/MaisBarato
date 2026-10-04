import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores } from '../tema';

export type Aba = 'scanner' | 'lista';

const ABAS: { id: Aba; icone: string; rotulo: string }[] = [
  { id: 'scanner', icone: '▦', rotulo: 'Escanear' },
  { id: 'lista', icone: '☑', rotulo: 'Lista' },
];

export function BarraAbas({ ativa, onTrocar }: { ativa: Aba; onTrocar: (aba: Aba) => void }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.barra, { paddingBottom: Math.max(bottom, 8) }]} accessibilityRole="tablist">
      {ABAS.map((a) => {
        const selecionada = a.id === ativa;
        return (
          <Pressable
            key={a.id}
            style={styles.aba}
            onPress={() => onTrocar(a.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: selecionada }}
          >
            <Text style={[styles.icone, selecionada && styles.ativa]}>{a.icone}</Text>
            <Text style={[styles.rotulo, selecionada && styles.ativa]}>{a.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    backgroundColor: cores.fundo,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d0d5da',
    paddingTop: 6,
  },
  aba: { flex: 1, alignItems: 'center', gap: 1 },
  icone: { fontSize: 20, color: cores.cinza },
  rotulo: { fontSize: 12, color: cores.cinza, fontWeight: '600' },
  ativa: { color: cores.verde },
});
