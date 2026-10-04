import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { listarLojas, lojasProximas } from '../data/repo';
import { lerValor } from '../format';
import { formatarDistancia } from '../lib/geo';
import { Oferta, OFERTAS_COMUNS, OpcaoValidade, OPCOES_VALIDADE, validadeEm } from '../lib/oferta';
import { obterPosicao, Posicao } from '../lib/localizacao';
import { cores } from '../tema';
import { Loja } from '../types';
import { CadastrarLoja } from './CadastrarLoja';

/** Até essa distância consideramos que o usuário está dentro da loja. */
const RAIO_NA_LOJA_M = 150;

type Props = {
  salvando: boolean;
  onSalvar: (dados: { lojaId: string; valor: number; oferta?: Oferta }) => void;
  onCancelar: () => void;
};

type EstadoGps = 'buscando' | 'ok' | 'negado' | 'indisponivel';

/** 'normal', 'promocao' ou o índice de uma oferta comum (leve 3 pague 2 etc.) */
type Tipo = 'normal' | 'promocao' | number;

/** Chip de escolha única. */
function Chip({ rotulo, ativo, onPress }: { rotulo: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, ativo && styles.chipAtivo]}
      accessibilityRole="radio"
      accessibilityState={{ selected: ativo }}
    >
      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{rotulo}</Text>
    </Pressable>
  );
}

export function RegistrarPreco({ salvando, onSalvar, onCancelar }: Props) {
  const [gps, setGps] = useState<EstadoGps>('buscando');
  const [posicao, setPosicao] = useState<Posicao>();
  const [lojas, setLojas] = useState<Loja[]>();
  const [erroLojas, setErroLojas] = useState<string>();
  const [lojaId, setLojaId] = useState<string>();
  const [cadastrandoLoja, setCadastrandoLoja] = useState(false);
  const [valorTexto, setValorTexto] = useState('');
  const [tipo, setTipo] = useState<Tipo>('normal');
  // promoção exige validade; oferta por quantidade pode ficar "sem data"
  const [validade, setValidade] = useState<OpcaoValidade | 'sem'>();

  const valor = lerValor(valorTexto);
  const validadeOk = tipo === 'normal' || (tipo === 'promocao' ? !!validade && validade !== 'sem' : !!validade);
  const podeSalvar = !!lojaId && !!valor && validadeOk && !salvando;

  function escolherTipo(novo: Tipo) {
    setTipo(novo);
    setValidade(typeof novo === 'number' ? 'sem' : undefined);
  }

  function montarOferta(): Oferta | undefined {
    if (tipo === 'normal') return undefined;
    const validoAte = validade && validade !== 'sem' ? validadeEm(validade) : undefined;
    if (tipo === 'promocao') return { promocional: true, validoAte };
    const { leve, pague } = OFERTAS_COMUNS[tipo];
    return { promocional: false, validoAte, leve, pague };
  }

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await obterPosicao();
        if (!ativo) return;
        if (r.ok) {
          setPosicao(r.posicao);
          setGps('ok');
          const proximas = await lojasProximas(r.posicao);
          if (!ativo) return;
          setLojas(proximas);
          // Já seleciona a loja onde o usuário provavelmente está.
          const maisPerto = proximas[0];
          if (maisPerto?.distanciaM !== undefined && maisPerto.distanciaM <= RAIO_NA_LOJA_M) setLojaId(maisPerto.id);
        } else {
          setGps(r.motivo === 'negada' ? 'negado' : 'indisponivel');
          const todas = await listarLojas();
          if (ativo) setLojas(todas);
        }
      } catch {
        if (ativo) setErroLojas('Não foi possível carregar as lojas.');
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  function lojaCriada(loja: Loja) {
    setLojas((atual) => [{ ...loja, distanciaM: 0 }, ...(atual ?? []).filter((l) => l.id !== loja.id)]);
    setLojaId(loja.id);
    setCadastrandoLoja(false);
  }

  if (cadastrandoLoja && posicao) {
    return <CadastrarLoja posicao={posicao} onCriada={lojaCriada} onVoltar={() => setCadastrandoLoja(false)} />;
  }

  const lojaSelecionada = lojas?.find((l) => l.id === lojaId);
  const naLoja =
    lojaSelecionada?.distanciaM !== undefined && lojaSelecionada.distanciaM <= RAIO_NA_LOJA_M ? lojaSelecionada : undefined;

  return (
    <View style={styles.raiz}>
      <Text style={styles.titulo}>Registrar preço</Text>

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
          onPress={() => lojaId && valor && onSalvar({ lojaId, valor, oferta: montarOferta() })}
          style={[styles.botao, !podeSalvar && styles.botaoDesativado]}
        >
          {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>Salvar</Text>}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={styles.chipsConteudo}
      >
        <Chip rotulo="Preço normal" ativo={tipo === 'normal'} onPress={() => escolherTipo('normal')} />
        <Chip rotulo="🏷️ Promoção" ativo={tipo === 'promocao'} onPress={() => escolherTipo('promocao')} />
        {OFERTAS_COMUNS.map((o, i) => (
          <Chip key={o.rotulo} rotulo={o.rotulo} ativo={tipo === i} onPress={() => escolherTipo(i)} />
        ))}
      </ScrollView>
      {tipo !== 'normal' && (
        <>
          <Text style={styles.dica}>
            {tipo === 'promocao'
              ? 'Até quando vale a promoção?'
              : 'Digite o preço de 1 unidade. Até quando vale a oferta?'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chips}
            contentContainerStyle={styles.chipsConteudo}
          >
            {typeof tipo === 'number' && (
              <Chip rotulo="Sem data" ativo={validade === 'sem'} onPress={() => setValidade('sem')} />
            )}
            {OPCOES_VALIDADE.map((v) => (
              <Chip key={v.rotulo} rotulo={v.rotulo} ativo={validade === v.opcao} onPress={() => setValidade(v.opcao)} />
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.secao}>
        {naLoja ? `Você está em ${naLoja.nome}?` : gps === 'ok' ? 'Em qual loja você está?' : 'Escolha a loja'}
      </Text>
      {gps === 'buscando' && <Text style={styles.dica}>Buscando sua localização…</Text>}
      {gps === 'negado' && (
        <Text style={styles.dica}>Sem permissão de localização: mostrando todas as lojas por nome.</Text>
      )}
      {gps === 'indisponivel' && <Text style={styles.dica}>GPS indisponível: mostrando todas as lojas.</Text>}
      {erroLojas && <Text style={styles.erro}>{erroLojas}</Text>}

      <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled">
        {!lojas && !erroLojas && <ActivityIndicator color={cores.verde} />}
        {lojas?.length === 0 && <Text style={styles.dica}>Nenhuma loja cadastrada perto de você ainda.</Text>}
        {lojas?.map((l) => {
          const ativa = l.id === lojaId;
          return (
            <Pressable key={l.id} onPress={() => setLojaId(l.id)} style={[styles.item, ativa && styles.itemAtivo]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemNome, ativa && styles.itemTextoAtivo]} numberOfLines={1}>
                  {l.nome}
                </Text>
                {(l.endereco || l.bairro) && (
                  <Text style={[styles.itemEndereco, ativa && styles.itemTextoAtivo]} numberOfLines={1}>
                    {[l.endereco, l.bairro].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              {l.distanciaM !== undefined && (
                <Text style={[styles.distancia, ativa && styles.itemTextoAtivo]}>{formatarDistancia(l.distanciaM)}</Text>
              )}
            </Pressable>
          );
        })}
        {gps === 'ok' && (
          <Pressable style={styles.novaLoja} onPress={() => setCadastrandoLoja(true)}>
            <Text style={styles.novaLojaTexto}>+ A loja não está na lista</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
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
  linha: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  valor: { flex: 1, fontSize: 18, fontWeight: '700' },
  secao: { fontSize: 13, fontWeight: '700', color: cores.texto, marginBottom: 4 },
  dica: { fontSize: 12, color: cores.cinza, marginBottom: 4 },
  erro: { color: '#c62828', fontSize: 13 },
  lista: { flex: 1 },
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
  itemAtivo: { backgroundColor: cores.verde },
  itemNome: { fontSize: 14, fontWeight: '600', color: cores.texto },
  itemEndereco: { fontSize: 12, color: cores.cinza },
  itemTextoAtivo: { color: '#fff' },
  distancia: { fontSize: 12, color: cores.cinza, fontWeight: '600' },
  novaLoja: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: cores.verde,
    alignItems: 'center',
    marginBottom: 8,
  },
  novaLojaTexto: { color: cores.verde, fontWeight: '700' },
  chips: { flexGrow: 0, marginBottom: 8 },
  chipsConteudo: { gap: 6 },
  chip: { borderRadius: 16, borderWidth: 1, borderColor: '#d0d5da', paddingHorizontal: 12, paddingVertical: 6 },
  chipAtivo: { backgroundColor: cores.verde, borderColor: cores.verde },
  chipTexto: { fontSize: 13, color: cores.texto },
  chipTextoAtivo: { color: '#fff', fontWeight: '700' },
  botao: { backgroundColor: cores.verde, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  botaoDesativado: { opacity: 0.4 },
  botaoTexto: { color: '#fff', fontWeight: '700' },
  botaoSecundario: { backgroundColor: cores.cinzaClaro },
  botaoSecundarioTexto: { color: cores.texto, fontWeight: '600' },
});
