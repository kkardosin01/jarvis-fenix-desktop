// Extração determinística de boletos a partir do texto do e-mail e dos PDFs anexos.
// Nada aqui faz rede: recebe texto, devolve campos do boleto.

import { encontrarLinhasDigitaveis, encontrarPix, formatarLinhaDigitavel } from '../../shared/boleto-codigo'
import { formatarDiaMes, hojeISO, normalizarTexto, parseDataBR, parseDataExtenso, parseNumeroBR } from '../../shared/ptbr'

/** Palavras usadas para achar e-mails candidatos (busca IMAP e conferência local). */
export const PALAVRAS_CHAVE = [
  'boleto',
  'fatura',
  'vencimento',
  'linha digitável',
  'código de barras',
  '2ª via',
  'segunda via',
  'cobrança',
  'DAS',
  'guia',
  'IPTU',
  'IPVA',
  'condomínio',
  'mensalidade',
  'conta de luz',
  'conta de água',
  'Celesc',
  'Casan',
  'cartão'
]

export interface AnexoTexto {
  nome: string
  texto: string
  /** PDF protegido por senha ou ilegível. */
  ilegivel?: boolean
}

export interface MensagemCandidata {
  messageId: string
  deEmail: string
  deNome: string
  assunto: string
  data: Date
  texto: string
  anexos: AnexoTexto[]
}

export interface BoletoExtraido {
  vencimento: string | null
  valor: number | null
  beneficiario: string
  linhaDigitavel: string | null
  pix: string | null
  comoPagar: string
}

export type ResultadoExtracao =
  | { tipo: 'boletos'; boletos: BoletoExtraido[] }
  | { tipo: 'descartado'; motivo: string }
  /** Parece cobrança mas faltou dado essencial: candidato à IA, se ligada. */
  | { tipo: 'incompleto'; parcial: BoletoExtraido }

const RE_PROPAGANDA_ASSUNTO =
  /\b(oferta|ofertas|promo[cç][aã]o|promo[cç][oõ]es|desconto exclusivo|black friday|cupom|liquida[cç][aã]o|imperd[ií]vel|frete gr[aá]tis|aproveite)\b/i
const RE_PROPAGANDA_REMETENTE = /(marketing|newsletter|news@|promo|ofertas|novidades@|mkt@)/i
const RE_COMPROVANTE =
  /(comprovante de pagamento|pagamento (confirmado|recebido|aprovado|realizado|efetuado)|recebemos (o )?seu pagamento|fatura paga|boleto pago|confirma[cç][aã]o de pagamento)/i
const RE_NOTA_FISCAL = /(nota fiscal|nf-?e|danfe|nfs-?e)/i
const RE_COBRANCA = /(boleto|fatura|vencimento|vence em|linha digit[aá]vel|c[oó]digo de barras|2[ªa] via|segunda via|cobran[cç]a|guia|DAS\b|IPTU|IPVA|pague at[eé])/i

const RE_ROTULO_VENCIMENTO =
  /(data\s+de\s+vencimento|vencimento|vence\s+em|vence\s+dia|vencto\.?|venc\.|pagar\s+at[eé]|pague\s+at[eé]|pagamento\s+at[eé])/gi
const RE_DATA = /\b(\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2}))\b/
const RE_ROTULO_VALOR =
  /(valor\s+do\s+documento|valor\s+cobrado|total\s+a\s+pagar|valor\s+a\s+pagar|valor\s+total|total\s+da\s+fatura|valor\s+da\s+fatura|valor|total)/gi
const RE_MOEDA = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/

/** Primeira data que aparece logo depois de um rótulo de vencimento. */
export function encontrarVencimento(texto: string): string | null {
  RE_ROTULO_VENCIMENTO.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RE_ROTULO_VENCIMENTO.exec(texto))) {
    const trecho = texto.slice(m.index + m[0].length, m.index + m[0].length + 120)
    const d = RE_DATA.exec(trecho)
    const ext = parseDataExtenso(trecho)
    // Usa a que aparecer primeiro no trecho
    const posD = d ? d.index : Infinity
    const posExt = ext ? trecho.search(/\d{1,2}\s+de\s+[a-zç]+/i) : Infinity
    if (posExt < posD && ext) return ext
    if (d) {
      const iso = parseDataBR(d[1]!)
      if (iso) return iso
    }
  }
  return null
}

/** Valor em reais próximo de "valor", "total a pagar" etc.; ou o único valor em R$ do texto. */
export function encontrarValor(texto: string): number | null {
  RE_ROTULO_VALOR.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RE_ROTULO_VALOR.exec(texto))) {
    const trecho = texto.slice(m.index + m[0].length, m.index + m[0].length + 60)
    const v = RE_MOEDA.exec(trecho)
    if (v) {
      const n = parseNumeroBR(v[1]!)
      if (n !== null && n > 0) return n
    }
  }
  const todos = new Set<number>()
  for (const x of texto.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g)) {
    const n = parseNumeroBR(x[1]!)
    if (n !== null && n > 0) todos.add(n)
  }
  return todos.size === 1 ? [...todos][0]! : null
}

/** Valor do campo 54 do PIX copia-e-cola (EMV). */
export function valorDoPix(pix: string): number | null {
  let i = 0
  while (i + 4 <= pix.length) {
    const id = pix.slice(i, i + 2)
    const tam = Number(pix.slice(i + 2, i + 4))
    if (!Number.isFinite(tam)) return null
    const valor = pix.slice(i + 4, i + 4 + tam)
    if (id === '54') {
      const n = Number(valor)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    i += 4 + tam
  }
  return null
}

function limparNome(s: string): string {
  return s
    .replace(/["'<>]/g, '')
    .replace(/\b(no-?reply|nao-?responda|naoresponder|do-?not-?reply)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–:|]+|[\s\-–:|]+$/g, '')
    .trim()
}

/** Nome do beneficiário escrito no boleto ("Beneficiário: X", "Cedente: X"). */
export function beneficiarioDoTexto(texto: string): string | null {
  const m = /(benefici[aá]rio(?:\s+final)?|cedente)\s*[:\-–]?\s*([^\n]{3,120})/i.exec(texto)
  if (!m) return null
  let nome = m[2]!
    .split(/\b(CNPJ|CPF|CNPJ\/CPF|Ag[eê]ncia|C[oó]digo|Nosso\s+n[uú]mero|Endere[cç]o)\b/i)[0]!
    .replace(/[\d./-]{8,}.*$/, '')
  nome = limparNome(nome)
  if (nome.length < 3 || /^(data|valor|vencimento|sacado|pagador)\b/i.test(nome)) return null
  return nome.slice(0, 80)
}

export function beneficiarioDoRemetente(deNome: string, deEmail: string): string {
  const nome = limparNome(deNome)
  if (nome && !nome.includes('@')) return nome
  const dominio = (deEmail.split('@')[1] ?? '').split('.')[0] ?? ''
  if (!dominio) return deEmail
  return dominio.charAt(0).toUpperCase() + dominio.slice(1)
}

export function eFenix(nome: string): boolean {
  const n = normalizarTexto(nome)
  return /\bcomercial fenix\b/.test(n) || /\bfenix (sc|hospitalares)\b/.test(n)
}

export function ePropaganda(msg: Pick<MensagemCandidata, 'assunto' | 'deEmail' | 'deNome'>): boolean {
  return RE_PROPAGANDA_ASSUNTO.test(msg.assunto) || RE_PROPAGANDA_REMETENTE.test(msg.deEmail)
}

/** Texto juntado de assunto, corpo e anexos. */
export function textoCompleto(msg: MensagemCandidata): string {
  return [msg.assunto, msg.texto, ...msg.anexos.map((a) => a.texto)].join('\n')
}

export function temPalavraChave(texto: string): boolean {
  const n = normalizarTexto(texto)
  return PALAVRAS_CHAVE.some((p) => {
    const k = normalizarTexto(p)
    return k.length <= 3 ? new RegExp(`\\b${k}\\b`).test(n) : n.includes(k)
  })
}

export interface ContextoExtracao {
  contaEmail: string
  hoje?: string
}

export function extrairBoletos(msg: MensagemCandidata, ctx: ContextoExtracao): ResultadoExtracao {
  const hoje = ctx.hoje ?? hojeISO()
  if (msg.deEmail.toLowerCase() === ctx.contaEmail.toLowerCase()) {
    return { tipo: 'descartado', motivo: 'enviado pela própria conta' }
  }
  const texto = textoCompleto(msg)
  const linhas = encontrarLinhasDigitaveis(texto, hoje)
  const pixs = encontrarPix(texto)
  const temCodigo = linhas.length > 0 || pixs.length > 0

  if (!temCodigo && ePropaganda(msg)) return { tipo: 'descartado', motivo: 'propaganda' }
  if (RE_COMPROVANTE.test(msg.assunto) || (RE_COMPROVANTE.test(msg.texto) && !temCodigo)) {
    return { tipo: 'descartado', motivo: 'comprovante de pagamento' }
  }

  const beneficiarioEscrito = beneficiarioDoTexto(texto)
  const beneficiario = beneficiarioEscrito ?? beneficiarioDoRemetente(msg.deNome, msg.deEmail)
  if (eFenix(beneficiario)) return { tipo: 'descartado', motivo: 'boleto emitido pela Fênix para cliente' }

  const vencimentoTexto = encontrarVencimento(texto)
  const valorTexto = encontrarValor(texto)
  const temPdf = msg.anexos.length > 0
  const remetente = beneficiarioDoRemetente(msg.deNome, msg.deEmail)
  const dataEmail = formatarDiaMes(hojeISO(msg.data))
  const viaPdf = `PDF anexo no e-mail de ${remetente} (${dataEmail})`

  if (linhas.length) {
    const boletos = linhas.map((l, i) => ({
      vencimento: l.vencimento ?? vencimentoTexto,
      valor: l.valor ?? (linhas.length === 1 ? valorTexto : null),
      beneficiario,
      linhaDigitavel: l.linha,
      pix: i === 0 ? (pixs[0] ?? null) : null,
      comoPagar: formatarLinhaDigitavel(l.linha)
    }))
    return { tipo: 'boletos', boletos }
  }

  if (pixs.length) {
    const pix = pixs[0]!
    return {
      tipo: 'boletos',
      boletos: [
        {
          vencimento: vencimentoTexto,
          valor: valorDoPix(pix) ?? valorTexto,
          beneficiario,
          linhaDigitavel: null,
          pix,
          comoPagar: pix
        }
      ]
    }
  }

  if (RE_NOTA_FISCAL.test(msg.assunto) && !vencimentoTexto) {
    return { tipo: 'descartado', motivo: 'nota fiscal sem cobrança' }
  }
  if (!RE_COBRANCA.test(texto)) return { tipo: 'descartado', motivo: 'sem sinal de cobrança' }

  const parcial: BoletoExtraido = {
    vencimento: vencimentoTexto,
    valor: valorTexto,
    beneficiario,
    linhaDigitavel: null,
    pix: null,
    comoPagar: viaPdf
  }
  // Sem código, mas com vencimento e PDF (ou valor) já dá para lembrar o Tulio
  if (vencimentoTexto && (temPdf || valorTexto !== null)) return { tipo: 'boletos', boletos: [parcial] }
  return { tipo: 'incompleto', parcial }
}
