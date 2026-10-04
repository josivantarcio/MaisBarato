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
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ProdutoPainel } from './src/components/ProdutoPainel';
import { RegistrarPreco } from './src/components/RegistrarPreco';
import { buscarProduto, cadastrarProduto, historicoPrecos, registrarPreco } from './src/data/repo';
import { cores } from './src/tema';
import { Preco, Produto } from './src/types';

type Leitura = {
  ean: string;
  produto?: Produto;
  historico: Preco[];
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Scanner />
    </SafeAreaProvider>
  );
}

function Scanner() {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [leitura, setLeitura] = useState<Leitura>();
  const [carregando, setCarregando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [digitado, setDigitado] = useState('');
  // Evita processar o mesmo código várias vezes enquanto a câmera continua vendo.
  const travado = useRef(false);

  async function abrirProduto(ean: string) {
    if (travado.current) return;
    travado.current = true;
    setCarregando(true);
    setRegistrando(false);
    const produto = await buscarProduto(ean);
    setLeitura({ ean, produto, historico: historicoPrecos(ean) });
    setCarregando(false);
  }

  function aoLerCodigo({ data }: BarcodeScanningResult) {
    abrirProduto(data);
  }

  function escanearOutro() {
    setLeitura(undefined);
    setRegistrando(false);
    travado.current = false;
  }

  function salvarPreco(dados: { lojaId: string; valor: number; descricao?: string }) {
    if (!leitura) return;
    let produto = leitura.produto;
    if (!produto && dados.descricao) {
      produto = { ean: leitura.ean, descricao: dados.descricao };
      cadastrarProduto(produto);
    }
    registrarPreco(leitura.ean, dados.lojaId, dados.valor);
    setLeitura({ ean: leitura.ean, produto, historico: historicoPrecos(leitura.ean) });
    setRegistrando(false);
  }

  if (!permissao) return <View style={styles.centro} />;

  if (!permissao.granted) {
    return (
      <SafeAreaView style={styles.centro}>
        <Text style={styles.marca}>MaisBarato</Text>
        <Text style={styles.textoPermissao}>
          Precisamos da câmera para ler o código de barras dos produtos.
        </Text>
        <Pressable style={styles.botao} onPress={pedirPermissao}>
          <Text style={styles.botaoTexto}>Permitir câmera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.cameraArea}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={leitura || carregando ? undefined : aoLerCodigo}
        />
        <View style={styles.mira} pointerEvents="none" />
        <Text style={styles.marcaCamera}>MaisBarato</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.painel}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {carregando ? (
          <ActivityIndicator size="large" color={cores.verde} style={{ marginTop: 24 }} />
        ) : leitura ? (
          <>
            {registrando ? (
              <RegistrarPreco
                pedirDescricao={!leitura.produto}
                onSalvar={salvarPreco}
                onCancelar={() => setRegistrando(false)}
              />
            ) : (
              <>
                <ProdutoPainel ean={leitura.ean} produto={leitura.produto} historico={leitura.historico} />
                <View style={styles.acoes}>
                  <Pressable style={[styles.botao, styles.botaoSecundario]} onPress={escanearOutro}>
                    <Text style={styles.botaoSecundarioTexto}>Escanear outro</Text>
                  </Pressable>
                  <Pressable style={[styles.botao, { flex: 1 }]} onPress={() => setRegistrando(true)}>
                    <Text style={styles.botaoTexto}>+ Registrar preço</Text>
                  </Pressable>
                </View>
              </>
            )}
          </>
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
  mira: {
    width: '75%',
    height: 120,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
  },
  marcaCamera: {
    position: 'absolute',
    top: 12,
    left: 16,
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  painel: {
    flex: 1.3,
    backgroundColor: cores.fundo,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    marginTop: -18,
    padding: 16,
  },
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
