import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { enviarFotoProduto, FotoTirada, tirarFoto } from '../data/fotos';
import { cadastrarProdutoCompleto, editarProduto, montarDescricao } from '../data/repo';
import { lerValor } from '../format';
import { cores } from '../tema';
import { Produto, UnidadeConteudo } from '../types';

const UNIDADES: { id: UnidadeConteudo; rotulo: string }[] = [
  { id: 'g', rotulo: 'g' },
  { id: 'kg', rotulo: 'kg' },
  { id: 'ml', rotulo: 'ml' },
  { id: 'l', rotulo: 'L' },
  { id: 'un', rotulo: 'un' },
];

type Props = {
  ean: string;
  /** produto existente (editar) ou sugestão do Open Food Facts/cupom (pré-preenche) */
  inicial?: Produto;
  modo: 'novo' | 'editar';
  onSalvo: (produto: Produto) => void;
  onCancelar: () => void;
};

export function CadastroProduto({ ean, inicial, modo, onSalvo, onCancelar }: Props) {
  const [nome, setNome] = useState(inicial?.nome ?? inicial?.descricao ?? '');
  const [marca, setMarca] = useState(inicial?.marca ?? '');
  const [conteudoTexto, setConteudoTexto] = useState(
    inicial?.conteudo ? String(inicial.conteudo).replace('.', ',') : '',
  );
  const [unidade, setUnidade] = useState<UnidadeConteudo | undefined>(inicial?.unidade);
  const [foto, setFoto] = useState<FotoTirada>();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();

  const conteudo = lerValor(conteudoTexto);
  const conteudoIncompleto = !!conteudoTexto.trim() !== !!unidade || (!!conteudoTexto.trim() && !conteudo);
  const podeSalvar = nome.trim().length >= 2 && !conteudoIncompleto && !salvando;
  const previa = nome.trim() ? montarDescricao({ nome, marca, conteudo, unidade: conteudo ? unidade : undefined }) : '';
  const imagemAtual = foto?.uri ?? inicial?.imagemUrl;

  async function fotografar() {
    setErro(undefined);
    try {
      const r = await tirarFoto();
      if (r === 'sem-permissao') setErro('Permita o uso da câmera para tirar a foto.');
      else if (r) setFoto(r);
    } catch {
      setErro('Não foi possível tirar a foto.');
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro(undefined);
    try {
      const imagemUrl = foto ? await enviarFotoProduto(ean, foto) : inicial?.imagemUrl;
      const dados = {
        ean,
        nome,
        marca: marca || undefined,
        conteudo: conteudo ?? undefined,
        unidade: conteudo ? unidade : undefined,
        imagemUrl,
      };
      onSalvo(modo === 'editar' ? await editarProduto(dados) : await cadastrarProdutoCompleto(dados));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setErro(
        /duplicate|23505/i.test(msg)
          ? 'Alguém acabou de cadastrar este produto. Escaneie de novo para ver.'
          : /permiss/i.test(msg)
            ? 'Só quem cadastrou pode editar este produto.'
            : 'Não foi possível salvar. Verifique a internet e tente de novo.',
      );
      setSalvando(false);
    }
  }

  return (
    <View style={styles.raiz}>
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>{modo === 'editar' ? 'Editar produto' : 'Cadastrar produto'}</Text>
        <Pressable onPress={onCancelar} hitSlop={8} disabled={salvando}>
          <Text style={styles.cancelar}>Cancelar</Text>
        </Pressable>
      </View>
      {erro && <Text style={styles.erro}>{erro}</Text>}

      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.linhaFoto}>
          <Pressable style={styles.foto} onPress={fotografar} accessibilityLabel="Tirar foto do produto">
            {imagemAtual ? (
              <Image source={{ uri: imagemAtual }} style={styles.fotoImagem} resizeMode="cover" />
            ) : (
              <Text style={styles.fotoTexto}>📷{'\n'}Tirar foto</Text>
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.rotulo}>Código de barras</Text>
            <Text style={styles.ean}>{ean}</Text>
            {imagemAtual && (
              <Pressable onPress={fotografar} hitSlop={6}>
                <Text style={styles.link}>Trocar foto</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Text style={styles.rotulo}>Nome do produto *</Text>
        <TextInput style={styles.input} placeholder="Ex.: Feijão Carioca" value={nome} onChangeText={setNome} maxLength={120} />

        <Text style={styles.rotulo}>Marca</Text>
        <TextInput style={styles.input} placeholder="Ex.: Kicaldo" value={marca} onChangeText={setMarca} maxLength={60} />

        <Text style={styles.rotulo}>Conteúdo da embalagem</Text>
        <View style={styles.linha}>
          <TextInput
            style={[styles.input, styles.conteudo]}
            placeholder="Ex.: 1"
            keyboardType="decimal-pad"
            value={conteudoTexto}
            onChangeText={setConteudoTexto}
          />
          <View style={styles.unidades}>
            {UNIDADES.map((u) => (
              <Pressable
                key={u.id}
                style={[styles.chip, unidade === u.id && styles.chipAtivo]}
                onPress={() => setUnidade(unidade === u.id ? undefined : u.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: unidade === u.id }}
              >
                <Text style={[styles.chipTexto, unidade === u.id && styles.chipTextoAtivo]}>{u.rotulo}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {conteudoIncompleto && <Text style={styles.dica}>Informe o número e a unidade (ou deixe os dois em branco).</Text>}

        {previa ? (
          <Text style={styles.previa}>
            Vai aparecer como: <Text style={styles.previaNome}>{previa}</Text>
          </Text>
        ) : null}

        <Pressable style={[styles.botao, !podeSalvar && styles.desativado]} disabled={!podeSalvar} onPress={salvar}>
          {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Salvar produto</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  titulo: { fontSize: 16, fontWeight: '800', color: cores.texto },
  cancelar: { color: cores.verde, fontWeight: '700' },
  erro: { color: '#c62828', fontSize: 13, marginBottom: 6 },
  linhaFoto: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 },
  foto: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: cores.cinzaClaro,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d0d5da',
    borderStyle: 'dashed',
  },
  fotoImagem: { width: '100%', height: '100%' },
  fotoTexto: { textAlign: 'center', color: cores.cinza, fontSize: 12 },
  rotulo: { fontSize: 12, fontWeight: '700', color: cores.cinza, marginBottom: 3 },
  ean: { fontSize: 15, color: cores.texto, fontVariant: ['tabular-nums'] },
  link: { color: cores.verde, fontWeight: '700', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5da',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    marginBottom: 8,
  },
  linha: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  conteudo: { width: 80 },
  unidades: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: cores.cinzaClaro },
  chipAtivo: { backgroundColor: cores.verde },
  chipTexto: { fontSize: 14, color: cores.texto },
  chipTextoAtivo: { color: '#fff', fontWeight: '700' },
  dica: { fontSize: 12, color: '#b26a00', marginBottom: 6 },
  previa: { fontSize: 13, color: cores.cinza, marginVertical: 6 },
  previaNome: { color: cores.texto, fontWeight: '700' },
  botao: { backgroundColor: cores.verde, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 6, marginBottom: 12 },
  desativado: { opacity: 0.4 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
