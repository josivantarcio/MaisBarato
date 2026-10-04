// Importa uma NFC-e a partir do conteúdo do QR Code do cupom.
// Consulta a SEFAZ, registra a nota, a loja (pelo CNPJ) e os preços com origem "nfce".
// Itens cujo código não é um GTIN e que ninguém vinculou ainda ficam pendentes de vínculo.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { gtinValido, hostOficial, lerHtmlNfce, lerQrNfce, NotaNfce, QrNfce } from '../_shared/nfce.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

class ErroUsuario extends Error {}

function chaveSecreta(): string {
  const legado = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legado) return legado;
  const chaves = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  const chave = chaves.default ?? Object.values(chaves)[0];
  if (!chave) throw new Error('Chave secreta do Supabase não configurada');
  return chave;
}

function chavePublica(): string {
  const legado = Deno.env.get('SUPABASE_ANON_KEY');
  if (legado) return legado;
  const chaves = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>;
  return chaves.default ?? Object.values(chaves)[0] ?? '';
}

async function buscar(url: string, init?: RequestInit): Promise<Response> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), 20_000);
  try {
    return await fetch(url, {
      ...init,
      signal: controle.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (MaisBarato)', ...(init?.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Ceará: a página do QR chama uma API que devolve o HTML da nota dentro de JSON. */
async function consultarCeara(qr: QrNfce): Promise<string> {
  let caminho: string;
  let corpo: Record<string, string>;
  if (qr.versao === '3') {
    caminho = 'qrcodev3';
    corpo = { chave_acesso: qr.chave, versao_qrcode: qr.versao, tipo_ambiente: qr.ambiente };
  } else if (qr.chave[34] === '9') {
    // emissão em contingência offline: o QR traz mais campos
    const [dia, valor, digVal, csc, hash] = qr.extras;
    caminho = 'qrcodev2';
    corpo = {
      chave_acesso: qr.chave, versao_qrcode: qr.versao, tipo_ambiente: qr.ambiente,
      dia_data_emissao: dia, valor_total_nfce: valor, digVal, identificador_csc: csc, codigo_hash: hash,
    };
  } else {
    const [csc, hash] = qr.extras;
    caminho = 'qrcodev2';
    corpo = {
      chave_acesso: qr.chave, versao_qrcode: qr.versao, tipo_ambiente: qr.ambiente,
      identificador_csc: csc, codigo_hash: hash,
    };
  }

  // O HTTPS da SEFAZ-CE recusa alguns clientes TLS; o próprio portal também atende por HTTP.
  let ultimoErro: unknown;
  for (const esquema of ['https', 'http']) {
    try {
      const r = await buscar(`${esquema}://nfce.sefaz.ce.gov.br/nfce/api/notasFiscal/${caminho}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        body: JSON.stringify(corpo),
      });
      const json = (await r.json()) as { xml?: string; erro?: string };
      if (json.xml) return json.xml;
      throw new ErroUsuario(`A SEFAZ-CE respondeu: ${json.erro ?? `HTTP ${r.status}`}`);
    } catch (e) {
      if (e instanceof ErroUsuario) throw e;
      ultimoErro = e;
    }
  }
  throw new Error(`Não foi possível acessar a SEFAZ-CE: ${ultimoErro}`);
}

/** Demais estados: muitos portais devolvem o HTML da nota direto na URL do QR. */
async function consultarPortal(qr: QrNfce): Promise<string> {
  if (!hostOficial(qr.url)) throw new ErroUsuario('O QR Code não aponta para um portal oficial da SEFAZ.');
  const r = await buscar(qr.url);
  return await r.text();
}

async function importar(qr: QrNfce, usuarioId: string) {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta(), { auth: { persistSession: false } });

  const { data: jaExiste } = await admin.from('notas_fiscais').select('chave, usuario_id').eq('chave', qr.chave).maybeSingle();
  if (jaExiste) {
    throw new ErroUsuario(
      jaExiste.usuario_id === usuarioId ? 'Você já importou este cupom.' : 'Este cupom já foi importado por outra pessoa.',
    );
  }

  // Só no ambiente local de testes (NFCE_TESTE=1): usa um cupom fictício em vez de consultar a SEFAZ.
  const html = Deno.env.get('NFCE_TESTE') === '1'
    ? (await import('../_shared/teste/nota-exemplo.ts')).default
    : qr.uf === 'CE'
      ? await consultarCeara(qr)
      : await consultarPortal(qr);
  const nota: NotaNfce = lerHtmlNfce(html);
  if (nota.itens.length === 0) {
    throw new ErroUsuario(
      qr.uf === 'CE'
        ? 'Não consegui ler os itens deste cupom.'
        : `Ainda não sei ler cupons de ${qr.uf}. Por enquanto o app lê cupons do Ceará.`,
    );
  }

  // Loja pelo CNPJ (o da chave de acesso é a fonte mais confiável)
  const cnpj = qr.cnpj;
  let { data: loja } = await admin.from('lojas').select('id, nome').eq('cnpj', cnpj).maybeSingle();
  if (!loja) {
    const nova = await admin
      .from('lojas')
      .insert({
        nome: nota.emitente.nome || `Loja ${cnpj}`,
        cnpj,
        endereco: nota.emitente.endereco?.slice(0, 200) ?? null,
        criado_por: usuarioId,
      })
      .select('id, nome')
      .single();
    if (nova.error) throw nova.error;
    loja = nova.data;
  }

  const emitidaEm = nota.emitidaEm ?? new Date().toISOString();
  const insNota = await admin.from('notas_fiscais').insert({
    chave: qr.chave,
    loja_id: loja.id,
    usuario_id: usuarioId,
    emitida_em: emitidaEm,
    valor_total: nota.valorTotal,
  });
  if (insNota.error) {
    if (insNota.error.code === '23505') throw new ErroUsuario('Este cupom já foi importado.');
    throw insNota.error;
  }

  // Se algo falhar daqui em diante, desfaz a nota e os preços para o cupom poder ser importado de novo.
  const precosCriados: string[] = [];
  try {
    return await registrarItens(admin, qr, nota, loja, emitidaEm, usuarioId, precosCriados);
  } catch (e) {
    if (precosCriados.length) await admin.from('precos').delete().in('id', precosCriados);
    await admin.from('notas_fiscais').delete().eq('chave', qr.chave);
    throw e;
  }
}

async function registrarItens(
  admin: ReturnType<typeof createClient>,
  qr: QrNfce,
  nota: NotaNfce,
  loja: { id: string; nome: string },
  emitidaEm: string,
  usuarioId: string,
  precosCriados: string[],
) {
  // Códigos internos que a comunidade já vinculou a um EAN neste mercado
  const codigos = [...new Set(nota.itens.map((i) => i.codigo).filter((c): c is string => !!c))];
  const { data: vinculos } = await admin
    .from('codigos_loja')
    .select('codigo, ean')
    .eq('loja_id', loja.id)
    .in('codigo', codigos.length ? codigos : ['-']);
  const eanPorCodigo = new Map((vinculos ?? []).map((v) => [v.codigo, v.ean]));

  const resultado = [];
  for (const item of nota.itens) {
    const ean = item.codigo && gtinValido(item.codigo) ? item.codigo : (item.codigo && eanPorCodigo.get(item.codigo)) || null;
    let precoId: string | null = null;

    if (ean) {
      await admin
        .from('produtos')
        .upsert({ ean, descricao: item.descricao.slice(0, 200), criado_por: usuarioId }, { onConflict: 'ean', ignoreDuplicates: true });
      const preco = await admin
        .from('precos')
        .insert({ ean, loja_id: loja.id, usuario_id: usuarioId, valor: item.valorUnitario, data_hora: emitidaEm, origem: 'nfce' })
        .select('id')
        .single();
      if (preco.error) throw preco.error;
      precoId = preco.data.id;
      precosCriados.push(preco.data.id);
    }

    const ins = await admin
      .from('itens_nota')
      .insert({
        chave: qr.chave,
        ordem: item.ordem,
        descricao: item.descricao,
        codigo: item.codigo,
        quantidade: item.quantidade,
        unidade: item.unidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.valorTotal,
        ean,
        preco_id: precoId,
      })
      .select('id')
      .single();
    if (ins.error) throw ins.error;
    resultado.push({ id: ins.data.id, ...item, ean, precoRegistrado: !!precoId });
  }

  return {
    chave: qr.chave,
    loja: { id: loja.id, nome: loja.nome },
    emitidaEm,
    valorTotal: nota.valorTotal,
    itens: resultado,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta(405, { erro: 'Use POST' });

  // Identifica o usuário pelo token da sessão do app
  const auth = req.headers.get('Authorization') ?? '';
  const cliente = createClient(Deno.env.get('SUPABASE_URL')!, chavePublica(), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: sessao } = await cliente.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!sessao.user) return resposta(401, { erro: 'Faça login para importar cupons.' });

  let qrTexto = '';
  try {
    qrTexto = String((await req.json()).qr ?? '');
  } catch {
    return resposta(400, { erro: 'Corpo inválido' });
  }
  const qr = lerQrNfce(qrTexto);
  if (!qr) return resposta(400, { erro: 'Este QR Code não é de um cupom fiscal (NFC-e).' });
  if (qr.ambiente !== '1') return resposta(400, { erro: 'Este cupom é de teste (homologação), não tem valor fiscal.' });

  try {
    return resposta(200, await importar(qr, sessao.user.id));
  } catch (e) {
    if (e instanceof ErroUsuario) return resposta(422, { erro: e.message });
    console.error('importar-nfce', qr.chave, e);
    return resposta(502, { erro: 'Não foi possível consultar a SEFAZ agora. Tente de novo em instantes.' });
  }
});
