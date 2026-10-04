import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { listarLojas } from '../data/repo';
import { lerValor } from '../format';
import { cores } from '../tema';
import { Loja } from '../types';

type Props = {
  pedirDescricao: boolean;
  salvando: boolean;
  onSalvar: (dados: { lojaId: string; valor: number; descricao?: string }) => void;
  onCancelar: () => void;
};

export function RegistrarPreco({ pedirDescricao, salvando, onSalvar, onCancelar }: Props) {
  const [lojas, setLojas] = useState<Loja[]>();
  const [erroLojas, setErroLojas] = useState<string>();
  const [lojaId, setLojaId] = useState<string>();
  const [valorTexto, setValorTexto] = useState('');
  const [descricao, setDescricao] = useState('');

  const valor = lerValor(valorTexto);
  const podeSalvar = !!lojaId && !!valor && (!pedirDescricao || descricao.trim().length > 2) && !salvando;

  useEffect(() => {
    listarLojas()
      .then(setLojas)
      .catch(() => setErroLojas('Não foi possível carregar as lojas.'));
  }, []);

  return (
    <View>
      <Text style={styles.titulo}>Registrar preço</Text>

      {pedirDescricao && (
        <TextInput
          style={styles.input}
          placeholder="Descrição (ex.: Feijão Carioca 1kg)"
          value={descricao}
          onChangeText={setDescricao}
        />
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lojas}>
        {!lojas && !erroLojas && <ActivityIndicator color={cores.verde} />}
        {erroLojas && <Text style={styles.erro}>{erroLojas}</Text>}
        {lojas?.map((l) => (
          <Pressable
            key={l.id}
            onPress={() => setLojaId(l.id)}
            style={[styles.chip, lojaId === l.id && styles.chipAtivo]}
          >
            <Text style={[styles.chipTexto, lojaId === l.id && styles.chipTextoAtivo]}>{l.nome}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.linha}>
        <TextInput
          style={[styles.input, styles.valor]}
          placeholder="R$ 0,00"
          keyboardType="decimal-pad"
          value={valorTexto}
          onChangeText={setValorTexto}
        />
        <Pressable onPress={onCancelar} style={[styles.botao, styles.botaoSecundario]}>
          <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
        </Pressable>
        <Pressable
          disabled={!podeSalvar}
          onPress={() => lojaId && valor && onSalvar({ lojaId, valor, descricao: descricao.trim() || undefined })}
          style={[styles.botao, !podeSalvar && styles.botaoDesativado]}
        >
          {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Salvar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 15, fontWeight: '700', color: cores.texto, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5da',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    marginBottom: 8,
  },
  lojas: { marginBottom: 8, flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: cores.cinzaClaro,
    marginRight: 6,
  },
  chipAtivo: { backgroundColor: cores.verde },
  chipTexto: { fontSize: 13, color: cores.texto },
  chipTextoAtivo: { color: '#fff', fontWeight: '600' },
  linha: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  erro: { color: '#c62828', fontSize: 13 },
  valor: { flex: 1, fontSize: 18, fontWeight: '700' },
  botao: { backgroundColor: cores.verde, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  botaoDesativado: { opacity: 0.4 },
  botaoTexto: { color: '#fff', fontWeight: '700' },
  botaoSecundario: { backgroundColor: cores.cinzaClaro },
  botaoSecundarioTexto: { color: cores.texto, fontWeight: '600' },
});
