// Promoções e ofertas por quantidade. Sem dependências, para poder testar fora do app.

import { brl } from '../format';

export type Oferta = {
  promocional: boolean;
  /** último dia da promoção/oferta, "AAAA-MM-DD" (data local) */
  validoAte?: string;
  /** leve 3 pague 2 → leve 3, pague 2; "2ª com 50%" → leve 2, pague 1,5 */
  leve?: number;
  pague?: number;
};

/** Ofertas mais comuns no mercado, para escolher com um toque. */
export const OFERTAS_COMUNS = [
  { rotulo: 'Leve 3 pague 2', leve: 3, pague: 2 },
  { rotulo: '2ª com 50%', leve: 2, pague: 1.5 },
  { rotulo: 'Leve 4 pague 3', leve: 4, pague: 3 },
] as const;

export type OpcaoValidade = 'hoje' | 'domingo' | 7 | 15 | 30;

export const OPCOES_VALIDADE: { opcao: OpcaoValidade; rotulo: string }[] = [
  { opcao: 'hoje', rotulo: 'Só hoje' },
  { opcao: 'domingo', rotulo: 'Até domingo' },
  { opcao: 7, rotulo: '7 dias' },
  { opcao: 15, rotulo: '15 dias' },
  { opcao: 30, rotulo: '30 dias' },
];

const dois = (n: number) => String(n).padStart(2, '0');
const paraTexto = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const deTexto = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
};

/** Data local de hoje, "AAAA-MM-DD". */
export function hoje(agora = new Date()): string {
  return paraTexto(agora);
}

/** Último dia da oferta para a opção escolhida ("7 dias" = hoje + 6, incluindo hoje). */
export function validadeEm(opcao: OpcaoValidade, agora = new Date()): string {
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (opcao === 'domingo') d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  else if (opcao !== 'hoje') d.setDate(d.getDate() + opcao - 1);
  return paraTexto(d);
}

/** Preço sem validade, ou com validade até hoje ou depois. */
export function vigente(o: Pick<Oferta, 'validoAte'>, dia = hoje()): boolean {
  return !o.validoAte || o.validoAte >= dia;
}

/** "até hoje", "até amanhã", "até 12/10" ou "encerrada em 12/10". */
export function textoValidade(validoAte: string, dia = hoje()): string {
  const fim = deTexto(validoAte);
  const curta = `${dois(fim.getDate())}/${dois(fim.getMonth() + 1)}`;
  if (validoAte < dia) return `encerrada em ${curta}`;
  if (validoAte === dia) return 'até hoje';
  const amanha = deTexto(dia);
  amanha.setDate(amanha.getDate() + 1);
  if (validoAte === paraTexto(amanha)) return 'até amanhã';
  return `até ${curta}`;
}

const numero = (n: number) => String(Number(n.toFixed(2))).replace('.', ',');

/** "leve 3 pague 2" ou "2ª unidade com 50%". */
export function descreverOferta(leve: number, pague: number): string {
  if (leve === 2 && pague > 1 && pague < 2) return `2ª unidade com ${Math.round((2 - pague) * 100)}%`;
  return `leve ${leve} pague ${numero(pague)}`;
}

/** Quanto sai cada unidade levando a quantidade da oferta. */
export function precoEfetivo(valor: number, leve: number, pague: number): number {
  return (valor * pague) / leve;
}

/** Selo curto para o histórico e a lista: "🏷️ promoção até 12/10", "🏷️ leve 3 pague 2 (R$ 6,67 cada)". */
export function seloOferta(valor: number, o: Oferta, dia = hoje()): string | undefined {
  const partes: string[] = [];
  if (o.promocional) partes.push('promoção');
  if (o.leve && o.pague) partes.push(`${descreverOferta(o.leve, o.pague)} (${brl(precoEfetivo(valor, o.leve, o.pague))} cada)`);
  if (partes.length === 0) return undefined;
  const validade = o.validoAte ? ` ${textoValidade(o.validoAte, dia)}` : '';
  return `🏷️ ${partes.join(', ')}${validade}`;
}
