import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { buscarMercadosOSM, LojaOSM } from '../data/osm';
import { cadastrarLoja } from '../data/repo';
import { formatarDistancia } from '../lib/geo';
import { Posicao } from '../lib/localizacao';
import { cores } from '../tema';
import { Loja } from '../types';

type Props = {
  posicao: Posicao;
  onCriada: (loja: Loja) => void;
  onVoltar: () => void;
};

export function CadastrarLoja({ posicao, onCriada, onVoltar }: Props) {
  const [sugestoes, setSugestoes] = useState<LojaOSM[]>();
  const [erroSugestoes, setErroSugestoes] = useState(false);
  const [nome, setNome] = useState('');
  const [bairro, setBairro] = useState('');
  const [salvando, setSalvando] = useState<string>(); // id da sugestão ou 'manual'
  const [erro, setErro] = useState<string>();

  useEffect(() => {
    buscarMercadosOSM(posicao)
      .then(setSugestoes)
      .catch(() => setErroSugestoes(true));
  }, [posicao]);

  async function salvar(chave: string, dados: Parameters<typeof cadastrarLoja>[0]) {
    setSalvando(chave);
    setErro(undefined);
    try {
      onCriada(await cadastrarLoja(dados));
    } catch {
      setErro('Não foi possível cadastrar a loja. Tente de novo.');
      setSalvando(undefined);
    }
  }

  const podeSalvarManual = nome.trim().length >= 2 && !salvando;

  return (
    <View style={styles.raiz}>
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>Nova loja</Text>
        <Pressable onPress={onVoltar} hitSlop={8}>
          <Text style={styles.voltar}>Voltar</Text>
        </Pressable>
      </View>
      {erro && <Text style={styles.erro}>{erro}</Text>}

      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.secao}>Mercados perto de você (OpenStreetMap)</Text>
        {!sugestoes && !erroSugestoes && <ActivityIndicator color={cores.verde} style={{ marginVertical: 8 }} />}
        {erroSugestoes && <Text style={styles.dica}>Não foi possível buscar sugestões agora.</Text>}
        {sugestoes?.length === 0 && <Text style={styles.dica}>Nenhum mercado encontrado no mapa por aqui.</Text>}
        {sugestoes?.slice(0, 15).map((s) => (
          <Pressable
            key={s.osmId}
            style={styles.item}
            disabled={!!salvando}
            onPress={() =>
              salvar(s.osmId, {
                nome: s.nome,
                endereco: s.endereco,
                bairro: s.bairro,
                latitude: s.latitude,
                longitude: s.longitude,
                osmId: s.osmId,
              })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemNome} numberOfLines={1}>
                {s.nome}
              </Text>
              {s.endereco && (
                <Text style={styles.itemEndereco} numberOfLines={1}>
                  {s.endereco}
                </Text>
              )}
            </View>
            {salvando === s.osmId ? (
              <ActivityIndicator color={cores.verde} />
            ) : (
              <Text style={styles.distancia}>{formatarDistancia(s.distanciaM)}</Text>
            )}
          </Pressable>
        ))}

        <Text style={[styles.secao, { marginTop: 12 }]}>Não achou? Cadastre onde você está agora</Text>
        <TextInput style={styles.input} placeholder="Nome do mercado" value={nome} onChangeText={setNome} />
        <TextInput style={styles.input} placeholder="Bairro (opcional)" value={bairro} onChangeText={setBairro} />
        <Pressable
          style={[styles.botao, !podeSalvarManual && styles.botaoDesativado]}
          disabled={!podeSalvarManual}
          onPress={() =>
            salvar('manual', {
              nome: nome.trim(),
              bairro: bairro.trim() || undefined,
              latitude: posicao.latitude,
              longitude: posicao.longitude,
            })
          }
        >
          {salvando === 'manual' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botaoTexto}>Cadastrar nesta localização</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  titulo: { fontSize: 15, fontWeight: '700', color: cores.texto },
  voltar: { color: cores.verde, fontWeight: '700' },
  secao: { fontSize: 12, fontWeight: '700', color: cores.cinza, marginBottom: 4, textTransform: 'uppercase' },
  dica: { fontSize: 13, color: cores.cinza, marginBottom: 6 },
  erro: { color: '#c62828', fontSize: 13, marginBottom: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: cores.cinzaClaro,
    marginBottom: 4,
  },
  itemNome: { fontSize: 14, fontWeight: '600', color: cores.texto },
  itemEndereco: { fontSize: 12, color: cores.cinza },
  distancia: { fontSize: 12, color: cores.cinza, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5da',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    marginBottom: 8,
  },
  botao: { backgroundColor: cores.verde, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  botaoDesativado: { opacity: 0.4 },
  botaoTexto: { color: '#fff', fontWeight: '700' },
});
