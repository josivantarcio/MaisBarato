// Formatação manual para não depender do suporte a Intl de cada aparelho.

export function brl(valor: number): string {
  const [inteiro, centavos] = valor.toFixed(2).split('.');
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
}

const dois = (n: number) => String(n).padStart(2, '0');

export function dataHora(iso: string): string {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

export function haQuantoTempo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

/** Aceita "12,99", "12.99" ou "1.234,56". */
export function lerValor(texto: string): number | undefined {
  const limpo = texto.replace(/[^\d,.]/g, '');
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const SETE_DIAS = 7 * 24 * 3600_000;

/** Preço visto há mais de 7 dias: aparece esmaecido no histórico. */
export function ehAntigo(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > SETE_DIAS;
}

export function jaPassou(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

/** "12/10" */
export function dataCurta(iso: string): string {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
}

/** 500 g, 1 kg, 1,5 L, 350 ml, 12 un */
export function formatarConteudo(conteudo: number, unidade: string): string {
  const numero = String(Number(conteudo.toFixed(3))).replace('.', ',');
  return `${numero} ${unidade === 'l' ? 'L' : unidade}`;
}
