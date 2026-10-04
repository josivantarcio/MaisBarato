import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProdutoPainel } from '../components/ProdutoPainel';
import { RegistrarPreco } from '../components/RegistrarPreco';
import { adicionarNaListaAtual } from '../data/lista';
import { buscarProduto, historicoPrecos, registrarPreco, salvarProduto } from '../data/repo';
import { supabase } from '../lib/supabase';
import { cores } from '../tema';
import { Preco, Produto } from '../types';

type Leitura = {
  ean: string;
  produto?: Produto;
  historico: Preco[];
};

const mensagemDeErro = (e: unknown) =>
  e instanceof Error && /network|fetch/i.test(e.message)
    ? 'Sem conexão com o servidor. Tente de novo.'
    : 'Algo deu errado. Tente de novo.';

export function Scanner({ nomeUsuario }: { nomeUsuario: string }) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [leitura, setLeitura] = useState<Leitura>();
  const [carregando, setCarregando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [digitado, setDigitado] = useState('');
  const [naLista, setNaLista] = useState<'adicionando' | 'ok'>();
  // Evita processar o mesmo código várias vezes enquanto a câmera continua vendo.
  const travado = useRef(false);

  async function abrirProduto(ean: string) {
    if (travado.current) return;
    travado.current = true;
    setCarregando(true);
    setRegistrando(false);
    setErro(undefined);
    try {
      const [produto, historico] = await Promise.all([buscarProduto(ean), historicoPrecos(ean)]);
      setLeitura({ ean, produto, historico });
    } catch (e) {
      setErro(mensagemDeErro(e));
      travado.current = false;
    } finally {
      setCarregando(false);
    }
  }

  function aoLerCodigo({ data }: BarcodeScanningResult) {
    abrirProduto(data);
  }

  function escanearOutro() {
    setLeitura(undefined);
    setRegistrando(false);
    setErro(undefined);
    setNaLista(undefined);
    travado.current = false;
  }

  async function colocarNaLista() {
    if (!leitura) return;
    setNaLista('adicionando');
    setErro(undefined);
    try {
      // O item da lista aponta para o produto; garante que ele exista no banco.
      let produto = leitura.produto;
      if (!produto?.salvo) {
        produto = await salvarProduto({
          ean: leitura.ean,
          descricao: produto?.descricao ?? `Produto ${leitura.ean}`,
          imagemUrl: produto?.imagemUrl,
        });
        setLeitura({ ...leitura, produto });
      }
      await adicionarNaListaAtual({ ean: leitura.ean, descricao: produto.descricao });
      setNaLista('ok');
    } catch (e) {
      setErro(mensagemDeErro(e));
      setNaLista(undefined);
    }
  }

  async function salvarPreco(dados: { lojaId: string; valor: number; descricao?: string }) {
    if (!leitura) return;
    setSalvando(true);
    setErro(undefined);
    try {
      let produto = leitura.produto;
      if (!produto?.salvo) {
        produto = await salvarProduto({
          ean: leitura.ean,
          descricao: produto?.descricao ?? dados.descricao ?? `Produto ${leitura.ean}`,
          imagemUrl: produto?.imagemUrl,
        });
      }
      await registrarPreco(leitura.ean, dados.lojaId, dados.valor);
      setLeitura({ ean: leitura.ean, produto, historico: await historicoPrecos(leitura.ean) });
      setRegistrando(false);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  if (!permissao) return <View style={styles.centro} />;

  if (!permissao.granted) {
    return (
      <SafeAreaView style={styles.centro}>
        <Text style={styles.marca}>MaisBarato</Text>
        <Text style={styles.textoPermissao}>Precisamos da câmera para ler o código de barras dos produtos.</Text>
        <Pressable style={styles.botao} onPress={pedirPermissao}>
          <Text style={styles.botaoTexto}>Permitir câmera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top']}>
      <StatusBar style="light" />
      <View style={[styles.cameraArea, registrando && styles.cameraCompacta]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={leitura || carregando ? undefined : aoLerCodigo}
        />
        <View style={styles.mira} pointerEvents="none" />
        <View style={styles.topo}>
          <Text style={styles.marcaCamera}>MaisBarato</Text>
          <Pressable onPress={() => supabase.auth.signOut()} hitSlop={8}>
            <Text style={styles.usuario}>
              Olá, {nomeUsuario} · <Text style={styles.sair}>Sair</Text>
            </Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.painel} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {erro && <Text style={styles.erro}>{erro}</Text>}
        {carregando ? (
          <ActivityIndicator size="large" color={cores.verde} style={{ marginTop: 24 }} />
        ) : leitura ? (
          registrando ? (
            <RegistrarPreco
              pedirDescricao={!leitura.produto}
              salvando={salvando}
              onSalvar={salvarPreco}
              onCancelar={() => setRegistrando(false)}
            />
          ) : (
            <>
              <ProdutoPainel ean={leitura.ean} produto={leitura.produto} historico={leitura.historico} />
              <View style={styles.acoes}>
                <Pressable style={[styles.botao, styles.botaoSecundario]} onPress={escanearOutro}>
                  <Text style={styles.botaoSecundarioTexto}>Outro</Text>
                </Pressable>
                <Pressable
                  style={[styles.botao, styles.botaoSecundario]}
                  disabled={!!naLista}
                  onPress={colocarNaLista}
                >
                  {naLista === 'adicionando' ? (
                    <ActivityIndicator color={cores.verde} />
                  ) : (
                    <Text style={styles.botaoSecundarioTexto}>{naLista === 'ok' ? '✓ Na lista' : '+ Lista'}</Text>
                  )}
                </Pressable>
                <Pressable style={[styles.botao, { flex: 1 }]} onPress={() => setRegistrando(true)}>
                  <Text style={styles.botaoTexto}>+ Preço</Text>
                </Pressable>
              </View>
            </>
          )
        ) : (
          <View>
            <Text style={styles.dica}>Aponte a câmera para o código de barras do produto.</Text>
            <Text style={styles.dicaPequena}>Ou digite o código:</Text>
            <View style={styles.acoes}>
              <TextInput
                style={styles.input}
                placeholder="7890000000011"
                keyboardType="number-pad"
                value={digitado}
                onChangeText={setDigitado}
              />
              <Pressable
                style={[styles.botao, digitado.length < 8 && { opacity: 0.4 }]}
                disabled={digitado.length < 8}
                onPress={() => abrirProduto(digitado)}
              >
                <Text style={styles.botaoTexto}>Buscar</Text>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#000' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: cores.fundo },
  marca: { fontSize: 28, fontWeight: '800', color: cores.verde, marginBottom: 12 },
  textoPermissao: { fontSize: 16, textAlign: 'center', color: cores.texto, marginBottom: 20 },
  cameraArea: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  // Com o formulário aberto, a câmera encolhe para sobrar espaço para a lista de lojas.
  cameraCompacta: { flex: 0, minHeight: 0, height: 110 },
  mira: {
    width: '75%',
    height: 120,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
  },
  topo: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marcaCamera: { color: '#fff', fontSize: 18, fontWeight: '800' },
  usuario: { color: '#fff', fontSize: 13 },
  sair: { fontWeight: '700', textDecorationLine: 'underline' },
  painel: {
    flex: 1.3,
    backgroundColor: cores.fundo,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    marginTop: -18,
    padding: 16,
  },
  erro: { color: '#c62828', fontSize: 14, marginBottom: 8 },
  dica: { fontSize: 16, fontWeight: '600', color: cores.texto, marginBottom: 12 },
  dicaPequena: { fontSize: 13, color: cores.cinza, marginBottom: 6 },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d5da',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  botao: {
    backgroundColor: cores.verde,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  botaoSecundario: { backgroundColor: cores.cinzaClaro },
  botaoSecundarioTexto: { color: cores.texto, fontWeight: '600', fontSize: 15 },
});
