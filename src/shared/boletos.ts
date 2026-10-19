// Regras de boletos: situação, conversão das abas e chaves de duplicidade.

import { apenasDigitos, encontrarPix, validarLinhaDigitavel } from './boleto-codigo'
import { diferencaDias, normalizarTexto, parseDataBR, parseNumeroBR } from './ptbr'
import type { Conta, ContaPFPJ, FonteBoleto, Linha, Situacao } from './types'

/**
 * Situação de um boleto em relação a hoje.
 * Atrasado = até 30 dias vencido; Próximos dias = até 7 dias à frente.
 */
export function calcularSituacao(vencimento: string | null, hoje: string): Situacao | null {
  if (!vencimento) return null
  const d = diferencaDias(hoje, vencimento)
  if (d === 0) return 'Vence hoje'
  if (d < -30) return 'Vencido há mais de 30 dias'
  if (d < 0) return 'Atrasado'
  if (d <= 7) return 'Próximos dias'
  return 'Futuro'
}

/** Só gravamos em Boletos_Outras_Contas o que está dentro da janela de -30 a +7 dias. */
export function dentroDaJanela(s: Situacao | null): s is 'Atrasado' | 'Vence hoje' | 'Próximos dias' {
  return s === 'Atrasado' || s === 'Vence hoje' || s === 'Próximos dias'
}

/** Lê uma coluna tolerando cabeçalhos com explicações, ex.: "vencimento (AAAA-MM-DD)". */
export function coluna(linha: Linha, nome: string): string {
  if (nome in linha) return (linha[nome] ?? '').trim()
  const alvo = normalizarTexto(nome)
  for (const [k, v] of Object.entries(linha)) {
    const base = normalizarTexto(k.replace(/\(.*\)/, ''))
    if (base === alvo) return (v ?? '').trim()
  }
  return ''
}

function contaPFPJ(s: string): ContaPFPJ | '' {
  const u = s.trim().toUpperCase()
  return u === 'PF' || u === 'PJ' ? u : ''
}

export function chaveBeneficiario(beneficiario: string, vencimento: string | null, valor: number | null): string {
  return `${normalizarTexto(beneficiario)}|${vencimento ?? ''}|${valor === null ? '' : Math.round(valor * 100)}`
}

/** Extrai linha digitável válida (47/48 dígitos) de um texto como "como_pagar". */
export function linhaDoTexto(texto: string, hoje: string): string | null {
  const d = apenasDigitos(texto)
  if (d.length !== 47 && d.length !== 48) return null
  return validarLinhaDigitavel(d, hoje) ? d : null
}

export function paraConta(fonte: FonteBoleto, linha: Linha, numeroLinha: number, hoje: string): Conta {
  const vencimento = parseDataBR(coluna(linha, 'vencimento'))
  const beneficiario = coluna(linha, 'beneficiario')
  const valor = parseNumeroBR(coluna(linha, 'valor'))
  const comoPagar = coluna(linha, 'como_pagar')
  const idMensagem = coluna(linha, 'id_mensagem')
  const pix = encontrarPix(comoPagar)[0] ?? null
  const linhaDigitavel = linhaDoTexto(comoPagar, hoje)
  let chave: string
  if (fonte === 'Boletos_Outras_Contas' && idMensagem) chave = `outras:${idMensagem}`
  else if (fonte === 'Boletos_Manual') chave = `manual:${numeroLinha}:${chaveBeneficiario(beneficiario, vencimento, valor)}`
  else chave = `nuvem:${chaveBeneficiario(beneficiario, vencimento, valor)}`
  return {
    chave,
    fonte,
    vencimento,
    beneficiario,
    valor,
    conta: contaPFPJ(coluna(linha, 'conta')),
    origem: fonte === 'Boletos_Manual' ? 'Lançado à mão' : coluna(linha, 'origem'),
    // Recalculamos sempre: a aba da nuvem pode trazer "Vence amanhã" de ontem
    situacao: calcularSituacao(vencimento, hoje),
    comoPagar,
    observacao: coluna(linha, 'observacao'),
    contaEmail: coluna(linha, 'conta_email'),
    idMensagem,
    linhaDigitavel,
    pix,
    linhaPlanilha: numeroLinha
  }
}

export function manualPago(linha: Linha): boolean {
  const v = normalizarTexto(coluna(linha, 'pago?') || coluna(linha, 'pago'))
  return v === 'sim' || v === 's' || v === 'pago' || v === 'x'
}

/** Linha de Boletos_Manual vazia (ex.: só com a observação de instrução)? */
export function manualVazia(linha: Linha): boolean {
  return !coluna(linha, 'vencimento') && !coluna(linha, 'beneficiario') && !coluna(linha, 'valor')
}

const PESO: Record<string, number> = {
  Atrasado: 0,
  'Vence hoje': 1,
  'Próximos dias': 2,
  Futuro: 3,
  'Vencido há mais de 30 dias': 4
}

/** Ordena por urgência: atrasados, hoje, próximos; dentro do grupo, por vencimento. */
export function ordenarContas(contas: Conta[]): Conta[] {
  return [...contas].sort((a, b) => {
    const pa = a.situacao ? (PESO[a.situacao] ?? 5) : 5
    const pb = b.situacao ? (PESO[b.situacao] ?? 5) : 5
    if (pa !== pb) return pa - pb
    return (a.vencimento ?? '9999').localeCompare(b.vencimento ?? '9999')
  })
}

export interface ChavesExistentes {
  ids: Set<string>
  linhas: Set<string>
  combos: Set<string>
}

/** Monta os conjuntos usados para evitar duplicidade entre as três abas. */
export function chavesExistentes(contas: Conta[]): ChavesExistentes {
  const ids = new Set<string>()
  const linhas = new Set<string>()
  const combos = new Set<string>()
  for (const c of contas) {
    if (c.idMensagem) ids.add(c.idMensagem.split('#')[0]!)
    if (c.linhaDigitavel) linhas.add(c.linhaDigitavel)
    if (c.beneficiario && c.vencimento) combos.add(chaveBeneficiario(c.beneficiario, c.vencimento, c.valor))
  }
  return { ids, linhas, combos }
}

export function eDuplicado(
  existentes: ChavesExistentes,
  b: { idMensagem: string; linhaDigitavel: string | null; beneficiario: string; vencimento: string | null; valor: number | null }
): boolean {
  if (existentes.ids.has(b.idMensagem)) return true
  if (b.linhaDigitavel && existentes.linhas.has(b.linhaDigitavel)) return true
  if (b.vencimento && existentes.combos.has(chaveBeneficiario(b.beneficiario, b.vencimento, b.valor))) return true
  return false
}

export function registrarChaves(
  existentes: ChavesExistentes,
  b: { idMensagem: string; linhaDigitavel: string | null; beneficiario: string; vencimento: string | null; valor: number | null }
): void {
  existentes.ids.add(b.idMensagem)
  if (b.linhaDigitavel) existentes.linhas.add(b.linhaDigitavel)
  if (b.vencimento) existentes.combos.add(chaveBeneficiario(b.beneficiario, b.vencimento, b.valor))
}
