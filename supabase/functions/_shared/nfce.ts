// Leitura de NFC-e: QR Code, chave de acesso, GTIN e HTML da consulta pública da SEFAZ.
// Sem dependências de runtime, para poder testar fora do Deno.

export type QrNfce = {
  url: string;
  chave: string;
  versao: string;
  ambiente: string;
  /** demais campos do parâmetro p, na ordem do QR (v2: csc e hash; v2 offline: dia, valor, digVal, csc, hash) */
  extras: string[];
  uf: string;
  cnpj: string;
};

export type ItemNfce = {
  ordem: number;
  descricao: string;
  codigo: string | null;
  quantidade: number | null;
  unidade: string | null;
  valorUnitario: number;
  valorTotal: number | null;
};

export type NotaNfce = {
  emitente: { nome: string; cnpj: string | null; endereco: string | null };
  emitidaEm: string | null; // ISO 8601 com fuso de Brasília
  valorTotal: number | null;
  itens: ItemNfce[];
};

export const UF_POR_CODIGO: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI',
  '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES',
  '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

/** Dígito verificador da chave de acesso (módulo 11, pesos 2 a 9 da direita para a esquerda). */
export function chaveValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(chave[43]);
}

/** GTIN-8/12/13/14 com dígito verificador correto (e que não seja só zeros). */
export function gtinValido(codigo: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(codigo) || /^0+$/.test(codigo)) return false;
  const digitos = codigo.split('').map(Number);
  const dv = digitos.pop()!;
  const soma = digitos.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === dv;
}

/** Interpreta o conteúdo do QR Code do cupom. Devolve undefined se não for uma NFC-e válida. */
export function lerQrNfce(conteudo: string): QrNfce | undefined {
  const texto = conteudo.trim();
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return undefined;
  }
  if (!/^https?:$/.test(url.protocol)) return undefined;

  let chave: string | undefined;
  let versao = '';
  let ambiente = '';
  let extras: string[] = [];

  // A barra vertical às vezes vem codificada (%7C) e o URL não decodifica dentro de query sem "="
  const p = url.searchParams.get('p') ?? decodeURIComponent(texto.split(/[?&]p=/)[1] ?? '');
  if (p) {
    const partes = p.split('|').map((s) => s.trim());
    [chave, versao, ambiente] = partes;
    extras = partes.slice(3);
  } else if (url.searchParams.get('chNFe')) {
    // QR Code versão 1 (nVersao=100)
    chave = url.searchParams.get('chNFe') ?? undefined;
    versao = url.searchParams.get('nVersao') ?? '100';
    ambiente = url.searchParams.get('tpAmb') ?? '';
  }

  if (!chave || !chaveValida(chave) || chave.slice(20, 22) !== '65') return undefined;
  const uf = UF_POR_CODIGO[chave.slice(0, 2)];
  if (!uf) return undefined;
  return { url: texto, chave, versao, ambiente, extras, uf, cnpj: chave.slice(6, 20) };
}

/** A consulta só é feita em portais oficiais (evita usar a função para acessar sites quaisquer). */
export function hostOficial(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    return /^https?:$/.test(protocol) && /(^|\.)gov\.br$/i.test(hostname);
  } catch {
    return false;
  }
}

// --- HTML ---

const ENTIDADES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  acirc: 'â', ecirc: 'ê', ocirc: 'ô', Acirc: 'Â', Ecirc: 'Ê', Ocirc: 'Ô',
  atilde: 'ã', otilde: 'õ', Atilde: 'Ã', Otilde: 'Õ',
  agrave: 'à', Agrave: 'À', ccedil: 'ç', Ccedil: 'Ç', uuml: 'ü', Uuml: 'Ü',
  ordm: 'º', ordf: 'ª', deg: '°',
};

export function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteiro, nome: string) => {
    if (nome[0] === '#') {
      const n = nome[1].toLowerCase() === 'x' ? parseInt(nome.slice(2), 16) : parseInt(nome.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : inteiro;
    }
    return ENTIDADES[nome] ?? inteiro;
  });
}

/** Remove tags e normaliza espaços. */
export function textoPuro(html: string): string {
  return decodificarEntidades(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1.234,56" → 1234.56; "25,9" → 25.9 */
export function numeroBr(s: string | undefined | null): number | null {
  if (!s) return null;
  const limpo = s.replace(/[^\d,.-]/g, '');
  if (!limpo) return null;
  const n = Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
  return Number.isFinite(n) ? n : null;
}

/** Conteúdo do primeiro <span class="classe">…</span> (classe exata entre as classes do elemento). */
function span(html: string, classe: string): string | null {
  const re = new RegExp(`<span[^>]*class="(?:[^"]*\\s)?${classe}(?:\\s[^"]*)?"[^>]*>([\\s\\S]*?)</span>`, 'i');
  const m = html.match(re);
  return m ? textoPuro(m[1]) : null;
}

/** Valor depois do rótulo em negrito: "<strong>Qtde.:</strong>1,115" → "1,115" */
function depoisDoRotulo(texto: string | null): string | null {
  if (!texto) return null;
  const i = texto.indexOf(':');
  return (i >= 0 ? texto.slice(i + 1) : texto).trim() || null;
}

/** Lê o HTML da consulta pública (modelo nacional do DANFE NFC-e: tabela #tabResult). */
export function lerHtmlNfce(html: string): NotaNfce {
  const itens: ItemNfce[] = [];
  const linhas = html.match(/<tr[^>]*id="Item\s*\+\s*\d+"[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  linhas.forEach((linha, i) => {
    const descricao = span(linha, 'txtTit');
    const valorUnitario = numeroBr(depoisDoRotulo(span(linha, 'RvlUnit')));
    if (!descricao || !valorUnitario) return;
    const codigo = span(linha, 'RCod')?.match(/C[oó]digo:\s*([^)\s]+)/i)?.[1] ?? null;
    itens.push({
      ordem: i + 1,
      descricao,
      codigo,
      quantidade: numeroBr(depoisDoRotulo(span(linha, 'Rqtd'))),
      unidade: depoisDoRotulo(span(linha, 'RUN')),
      valorUnitario,
      valorTotal: numeroBr(span(linha, 'valor')),
    });
  });

  const nomeBruto = html.match(/id="u20"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  // Alguns mercados prefixam o número da filial: "(38)CEMA ..."
  const nome = nomeBruto ? textoPuro(nomeBruto).replace(/^\(\d+\)\s*/, '') : '';

  const blocosTexto = [...html.matchAll(/<div[^>]*class="text"[^>]*>([\s\S]*?)<\/div>/gi)].map((m) => textoPuro(m[1]));
  const indiceCnpj = blocosTexto.findIndex((t) => /CNPJ/i.test(t));
  const cnpj = indiceCnpj >= 0 ? blocosTexto[indiceCnpj].replace(/\D/g, '').slice(0, 14) || null : null;
  const endereco = indiceCnpj >= 0 ? (blocosTexto[indiceCnpj + 1] ?? null) : null;

  const texto = textoPuro(html);
  const e = texto.match(/Emiss[aã]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/i);
  const emitidaEm = e ? `${e[3]}-${e[2]}-${e[1]}T${e[4]}:${e[5]}:${e[6] ?? '00'}-03:00` : null;

  const total = texto.match(/Valor a pagar R\$:?\s*([\d.,]+)/i)?.[1];

  return {
    emitente: { nome, cnpj: cnpj && cnpj.length === 14 ? cnpj : null, endereco },
    emitidaEm,
    valorTotal: numeroBr(total),
    itens,
  };
}
