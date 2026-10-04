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
import { CadastroProduto } from '../components/CadastroProduto';
import { NotaPainel } from '../components/NotaPainel';
import { ProdutoPainel } from '../components/ProdutoPainel';
import { RegistrarPreco } from '../components/RegistrarPreco';
import { adicionarNaListaAtual } from '../data/lista';
import { ErroNfce, importarNfce, ItemNota, NotaImportada, pareceQrNfce, vincularItemNota } from '../data/nfce';
import {
  Alternativa,
  alternativasPorUnidade,
  buscarProduto,
  historicoPrecos,
  registrarPreco,
  salvarProduto,
} from '../data/repo';
import { Oferta } from '../lib/oferta';
import { supabase } from '../lib/supabase';
import { cores } from '../tema';
import { Preco, Produto } from '../types';

type Leitura = {
  ean: string;
  produto?: Produto;
  historico: Preco[];
  alternativas: Alternativa[];
};

/** A dica de outro tamanho é um extra: se falhar, o produto abre do mesmo jeito. */
const buscarAlternativas = (ean: string) => alternativasPorUnidade(ean).catch(() => []);

const mensagemDeErro = (e: unknown) =>
  e instanceof Error && /network|fetch/i.test(e.message)
    ? 'Sem conexão com o servidor. Tente de novo.'
    : 'Algo deu errado. Tente de novo.';

export function Scanner({ nomeUsuario, usuarioId }: { nomeUsuario: string; usuarioId: string }) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [leitura, setLeitura] = useState<Leitura>();
  const [carregando, setCarregando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [digitado, setDigitado] = useState('');
  const [naLista, setNaLista] = useState<'adicionando' | 'ok'>();
  const [nota, setNota] = useState<NotaImportada>();
  const [vinculando, setVinculando] = useState<ItemNota>();
  const [mensagemCarregando, setMensagemCarregando] = useState<string>();
  // Formulário de produto aberto; "depois" = o que o usuário queria fazer antes de cadastrar
  const [cadastro, setCadastro] = useState<{ modo: 'novo' | 'editar'; depois?: 'preco' | 'lista' }>();
  // Evita processar o mesmo código várias vezes enquanto a câmera continua vendo.
  const travado = useRef(false);

  async function abrirProduto(ean: string) {
    if (travado.current) return;
    travado.current = true;
    setCarregando(true);
    setRegistrando(false);
    setErro(undefined);
    try {
      const [produto, historico, alternativas] = await Promise.all([
        buscarProduto(ean),
        historicoPrecos(ean),
        buscarAlternativas(ean),
      ]);
      setLeitura({ ean, produto, historico, alternativas });
    } catch (e) {
      setErro(mensagemDeErro(e));
      travado.current = false;
    } finally {
      setCarregando(false);
    }
  }

  /** Libera a câmera depois de um tempo, para o mesmo código não disparar de novo na hora. */
  function liberarDepois(ms = 2500) {
    setTimeout(() => {
      travado.current = false;
    }, ms);
  }

  async function importarNota(qr: string) {
    travado.current = true;
    setCarregando(true);
    setMensagemCarregando('Consultando o cupom na SEFAZ…');
    setErro(undefined);
    try {
      setNota(await importarNfce(qr));
      travado.current = false;
    } catch (e) {
      setErro(e instanceof ErroNfce ? e.message : mensagemDeErro(e));
      liberarDepois();
    } finally {
      setCarregando(false);
      setMensagemCarregando(undefined);
    }
  }

  async function vincular(item: ItemNota, ean: string) {
    travado.current = true;
    setCarregando(true);
    setMensagemCarregando('Registrando o preço do cupom…');
    setErro(undefined);
    try {
      // Usa a descrição do produto (banco ou Open Food Facts), que costuma ser melhor que a do cupom
      const produto = await buscarProduto(ean).catch(() => undefined);
      await vincularItemNota(item.id, ean, produto?.descricao);
      setNota((atual) =>
        atual && {
          ...atual,
          itens: atual.itens.map((i) => (i.id === item.id ? { ...i, ean, precoRegistrado: true } : i)),
        },
      );
      setVinculando(undefined);
      travado.current = false;
    } catch (e) {
      setErro(e instanceof ErroNfce ? e.message : mensagemDeErro(e));
      liberarDepois();
    } finally {
      setCarregando(false);
      setMensagemCarregando(undefined);
    }
  }

  function aoLerCodigo({ data }: BarcodeScanningResult) {
    if (travado.current) return;
    if (vinculando) {
      if (/^\d{8,14}$/.test(data)) vincular(vinculando, data);
      return;
    }
    if (pareceQrNfce(data)) {
      importarNota(data);
      return;
    }
    if (!/^\d{8,14}$/.test(data)) {
      travado.current = true;
      setErro('Este QR Code não é de um cupom fiscal (NFC-e).');
      liberarDepois();
      return;
    }
    abrirProduto(data);
  }

  function fecharNota() {
    setNota(undefined);
    setVinculando(undefined);
    setErro(undefined);
    travado.current = false;
  }

  /** Toque na dica de outro tamanho: troca o produto aberto. */
  function abrirOutroProduto(ean: string) {
    setNaLista(undefined);
    travado.current = false;
    abrirProduto(ean);
  }

  function escanearOutro() {
    setLeitura(undefined);
    setRegistrando(false);
    setErro(undefined);
    setNaLista(undefined);
    setCadastro(undefined);
    travado.current = false;
  }

  async function colocarNaLista(produtoAtual = leitura?.produto) {
    if (!leitura) return;
    // Produto desconhecido: primeiro o cadastro, depois a lista
    if (!produtoAtual) {
      setCadastro({ modo: 'novo', depois: 'lista' });
      return;
    }
    setNaLista('adicionando');
    setErro(undefined);
    try {
      // O item da lista aponta para o produto; garante que ele exista no banco.
      let produto = produtoAtual;
      if (!produto.salvo) {
        produto = await salvarProduto({ ean: leitura.ean, descricao: produto.descricao, imagemUrl: produto.imagemUrl });
        setLeitura({ ...leitura, produto });
      }
      await adicionarNaListaAtual({ ean: leitura.ean, descricao: produto.descricao });
      setNaLista('ok');
    } catch (e) {
      setErro(mensagemDeErro(e));
      setNaLista(undefined);
    }
  }

  function produtoSalvo(produto: Produto) {
    if (!leitura) return;
    const depois = cadastro?.depois;
    setLeitura({ ...leitura, produto });
    setCadastro(undefined);
    // o conteúdo pode ter mudado: atualiza a dica de outro tamanho
    buscarAlternativas(leitura.ean).then((alternativas) =>
      setLeitura((atual) => (atual?.ean === leitura.ean ? { ...atual, alternativas } : atual)),
    );
    if (depois === 'preco') setRegistrando(true);
    if (depois === 'lista') colocarNaLista(produto);
  }

  async function salvarPreco(dados: { lojaId: string; valor: number; oferta?: Oferta }) {
    if (!leitura?.produto) return;
    setSalvando(true);
    setErro(undefined);
    try {
      let produto = leitura.produto;
      if (!produto.salvo) {
        // veio do Open Food Facts: entra no banco junto com o primeiro preço
        produto = await salvarProduto({ ean: leitura.ean, descricao: produto.descricao, imagemUrl: produto.imagemUrl });
      }
      await registrarPreco(leitura.ean, dados.lojaId, dados.valor, dados.oferta);
      const [historico, alternativas] = await Promise.all([
        historicoPrecos(leitura.ean),
        buscarAlternativas(leitura.ean),
      ]);
      setLeitura({ ean: leitura.ean, produto, historico, alternativas });
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
      <View style={[styles.cameraArea, (registrando || !!cadastro || (nota && !vinculando)) && styles.cameraCompacta]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: vinculando ? ['ean13', 'ean8', 'upc_a', 'upc_e'] : ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
          }}
          onBarcodeScanned={leitura || carregando || (nota && !vinculando) ? undefined : aoLerCodigo}
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
          <View style={{ alignItems: 'center', marginTop: 24, gap: 8 }}>
            <ActivityIndicator size="large" color={cores.verde} />
            {mensagemCarregando && <Text style={styles.dicaPequena}>{mensagemCarregando}</Text>}
          </View>
        ) : vinculando ? (
          <View>
            <Text style={styles.dica}>Escaneie o código de barras de:</Text>
            <Text style={styles.vinculandoNome}>{vinculando.descricao}</Text>
            <Text style={styles.dicaPequena}>
              Assim o preço do cupom fica registrado, e as próximas notas deste mercado já reconhecem o produto.
            </Text>
            <Pressable style={[styles.botao, styles.botaoSecundario, { marginTop: 10 }]} onPress={() => setVinculando(undefined)}>
              <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
            </Pressable>
          </View>
        ) : nota ? (
          <NotaPainel nota={nota} onVincular={setVinculando} onFechar={fecharNota} />
        ) : leitura ? (
          cadastro ? (
            <CadastroProduto
              ean={leitura.ean}
              inicial={leitura.produto}
              modo={cadastro.modo}
              onSalvo={produtoSalvo}
              onCancelar={() => setCadastro(undefined)}
            />
          ) : registrando ? (
            <RegistrarPreco
              salvando={salvando}
              onSalvar={salvarPreco}
              onCancelar={() => setRegistrando(false)}
            />
          ) : (
            <>
              <ProdutoPainel
                ean={leitura.ean}
                produto={leitura.produto}
                historico={leitura.historico}
                alternativas={leitura.alternativas}
                onAbrirProduto={abrirOutroProduto}
                onCadastrar={!leitura.produto ? () => setCadastro({ modo: 'novo' }) : undefined}
                onEditar={
                  leitura.produto?.salvo && leitura.produto.criadoPor === usuarioId
                    ? () => setCadastro({ modo: 'editar' })
                    : undefined
                }
              />
              <View style={styles.acoes}>
                <Pressable style={[styles.botao, styles.botaoSecundario]} onPress={escanearOutro}>
                  <Text style={styles.botaoSecundarioTexto}>Outro</Text>
                </Pressable>
                <Pressable
                  style={[styles.botao, styles.botaoSecundario]}
                  disabled={!!naLista}
                  onPress={() => colocarNaLista()}
                >
                  {naLista === 'adicionando' ? (
                    <ActivityIndicator color={cores.verde} />
                  ) : (
                    <Text style={styles.botaoSecundarioTexto}>{naLista === 'ok' ? '✓ Na lista' : '+ Lista'}</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.botao, { flex: 1 }]}
                  onPress={() => (leitura.produto ? setRegistrando(true) : setCadastro({ modo: 'novo', depois: 'preco' }))}
                >
                  <Text style={styles.botaoTexto}>+ Preço</Text>
                </Pressable>
              </View>
            </>
          )
        ) : (
          <View>
            <Text style={styles.dica}>Aponte a câmera para o código de barras do produto.</Text>
            <Text style={styles.dicaPequena}>
              Tem um cupom fiscal? Escaneie o QR Code dele para registrar todos os preços da compra de uma vez.
            </Text>
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
  vinculandoNome: { fontSize: 17, fontWeight: '800', color: cores.texto, marginBottom: 6 },
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
