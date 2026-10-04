import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  entrarComCodigo,
  gerarCodigoConvite,
  InfoLista,
  Membro,
  removerMembro,
  sairDaLista,
} from '../data/lista';
import { dataCurta, jaPassou } from '../format';
import { cores } from '../tema';

type Props = {
  lista: InfoLista;
  membros: Membro[];
  onVoltar: () => void;
  /** algo mudou; se vier um id, abrir essa lista */
  onMudou: (abrirListaId?: string) => void;
};

export function Compartilhar({ lista, membros, onVoltar, onMudou }: Props) {
  const [codigo, setCodigo] = useState(
    lista.codigoConvite && lista.codigoExpiraEm && !jaPassou(lista.codigoExpiraEm)
      ? { valor: lista.codigoConvite, expira: lista.codigoExpiraEm }
      : undefined,
  );
  const [ocupado, setOcupado] = useState<string>();
  const [erro, setErro] = useState<string>();
  const [codigoDigitado, setCodigoDigitado] = useState('');

  async function executar(chave: string, acao: () => Promise<void>, mensagemErro: string) {
    setOcupado(chave);
    setErro(undefined);
    try {
      await acao();
    } catch {
      setErro(mensagemErro);
    } finally {
      setOcupado(undefined);
    }
  }

  const gerar = () =>
    executar(
      'gerar',
      async () => {
        const valor = await gerarCodigoConvite(lista.id);
        setCodigo({ valor, expira: new Date(Date.now() + 7 * 24 * 3600_000).toISOString() });
        onMudou();
      },
      'Não foi possível gerar o código.',
    );

  const enviar = () => {
    if (!codigo) return;
    Share.share({
      message:
        `Vamos fazer as compras juntos no MaisBarato! Abra o app, vá em Lista → Compartilhar ` +
        `e digite o código ${codigo.valor} para entrar na lista "${lista.nome}".`,
    });
  };

  const entrar = () =>
    executar(
      'entrar',
      async () => {
        const id = await entrarComCodigo(codigoDigitado);
        if (!id) {
          setErro('Código inválido ou expirado. Peça um código novo.');
          return;
        }
        setCodigoDigitado('');
        onMudou(id);
      },
      'Não foi possível entrar na lista.',
    );

  const confirmar = (titulo: string, mensagem: string, rotulo: string, acao: () => void) =>
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel' },
      { text: rotulo, style: 'destructive', onPress: acao },
    ]);

  const remover = (m: Membro) =>
    confirmar(`Remover ${m.nome}?`, `${m.nome} deixa de ver e editar esta lista.`, 'Remover', () =>
      executar(m.usuarioId, async () => {
        await removerMembro(lista.id, m.usuarioId);
        onMudou();
      }, 'Não foi possível remover.'),
    );

  const sair = () =>
    confirmar('Sair da lista?', `Você deixa de ver a lista de ${lista.donoNome}.`, 'Sair', () =>
      executar('sair', async () => {
        await sairDaLista(lista.id);
        onMudou(''); // volta para a lista própria
      }, 'Não foi possível sair da lista.'),
    );

  const codigoValido = codigoDigitado.trim().length === 6 && !ocupado;

  return (
    <View style={styles.raiz}>
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>Compartilhar</Text>
        <Pressable onPress={onVoltar} hitSlop={8}>
          <Text style={styles.voltar}>Voltar à lista</Text>
        </Pressable>
      </View>
      {erro && <Text style={styles.erro}>{erro}</Text>}

      <ScrollView keyboardShouldPersistTaps="handled">
        {lista.souDono ? (
          <View style={styles.cartao}>
            <Text style={styles.secao}>Convidar para &quot;{lista.nome}&quot;</Text>
            <Text style={styles.dica}>
              Quem entrar com o código vê a lista, adiciona itens e marca o que já pegou, tudo em tempo real.
            </Text>
            {codigo ? (
              <>
                <Text style={styles.codigo} selectable accessibilityLabel={`Código ${codigo.valor.split('').join(' ')}`}>
                  {codigo.valor}
                </Text>
                <Text style={styles.validade}>Vale até {dataCurta(codigo.expira)}</Text>
                <Pressable style={styles.botao} onPress={enviar}>
                  <Text style={styles.botaoTexto}>Enviar convite</Text>
                </Pressable>
                <Pressable style={styles.link} onPress={gerar} disabled={!!ocupado}>
                  {ocupado === 'gerar' ? (
                    <ActivityIndicator color={cores.verde} />
                  ) : (
                    <Text style={styles.linkTexto}>Gerar outro código (o atual deixa de valer)</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.botao} onPress={gerar} disabled={!!ocupado}>
                {ocupado === 'gerar' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botaoTexto}>Gerar código de convite</Text>
                )}
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.cartao}>
            <Text style={styles.secao}>Lista de {lista.donoNome}</Text>
            <Text style={styles.dica}>Você participa desta lista. Só {lista.donoNome} pode convidar mais pessoas.</Text>
          </View>
        )}

        <View style={styles.cartao}>
          <Text style={styles.secao}>Quem participa</Text>
          <View style={styles.membro}>
            <Text style={styles.membroNome}>{lista.souDono ? 'Você' : lista.donoNome}</Text>
            <Text style={styles.papel}>dono</Text>
          </View>
          {membros.map((m) => (
            <View key={m.usuarioId} style={styles.membro}>
              <Text style={styles.membroNome}>{m.nome}</Text>
              {lista.souDono &&
                (ocupado === m.usuarioId ? (
                  <ActivityIndicator color={cores.verde} />
                ) : (
                  <Pressable onPress={() => remover(m)} hitSlop={8}>
                    <Text style={styles.remover}>Remover</Text>
                  </Pressable>
                ))}
            </View>
          ))}
          {membros.length === 0 && <Text style={styles.dica}>Ninguém mais nesta lista ainda.</Text>}
          {!lista.souDono && (
            <Pressable style={styles.link} onPress={sair} disabled={!!ocupado}>
              <Text style={styles.remover}>Sair desta lista</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.cartao}>
          <Text style={styles.secao}>Entrar na lista de alguém</Text>
          <View style={styles.linha}>
            <TextInput
              style={styles.input}
              placeholder="Código de 6 letras"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              value={codigoDigitado}
              onChangeText={(t) => setCodigoDigitado(t.toUpperCase())}
              onSubmitEditing={() => codigoValido && entrar()}
            />
            <Pressable
              style={[styles.botaoPequeno, !codigoValido && styles.desativado]}
              disabled={!codigoValido}
              onPress={entrar}
            >
              {ocupado === 'entrar' ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Entrar</Text>}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  titulo: { fontSize: 24, fontWeight: '800', color: cores.texto },
  voltar: { color: cores.verde, fontWeight: '700' },
  erro: { color: '#c62828', fontSize: 13, marginBottom: 8 },
  cartao: { backgroundColor: cores.cinzaClaro, borderRadius: 12, padding: 14, marginBottom: 12 },
  secao: { fontSize: 15, fontWeight: '700', color: cores.texto, marginBottom: 4 },
  dica: { fontSize: 13, color: cores.cinza, marginBottom: 8 },
  codigo: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    color: cores.texto,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  validade: { textAlign: 'center', color: cores.cinza, fontSize: 12, marginBottom: 10 },
  botao: { backgroundColor: cores.verde, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  botaoPequeno: { backgroundColor: cores.verde, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  desativado: { opacity: 0.4 },
  link: { alignItems: 'center', paddingVertical: 10 },
  linkTexto: { color: cores.verde, fontWeight: '600', fontSize: 13 },
  membro: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d0d5da',
  },
  membroNome: { fontSize: 15, color: cores.texto },
  papel: { fontSize: 12, color: cores.cinza },
  remover: { color: '#c62828', fontWeight: '700' },
  linha: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5da',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    letterSpacing: 4,
    fontWeight: '700',
  },
});
