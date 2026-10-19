// Linha digitável de boletos (padrão Febraban) e PIX copia-e-cola.
//
// Bancário (47 dígitos):   AAABC.CCCCX DDDDD.DDDDDY EEEEE.EEEEEZ K UUUUVVVVVVVVVV
//   AAA banco, B moeda, C campo livre, X/Y/Z DV módulo 10 de cada campo,
//   K DV geral (módulo 11 do código de barras), UUUU fator de vencimento,
//   V valor em centavos (10 dígitos).
// Arrecadação/concessionárias (48 dígitos, começa com 8): 4 blocos de 11 + DV.

import { diferencaDias, somarDias } from './ptbr'

export function apenasDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

export function modulo10(numero: string): number {
  let soma = 0
  let peso = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    let p = Number(numero[i]) * peso
    if (p > 9) p = Math.floor(p / 10) + (p % 10)
    soma += p
    peso = peso === 2 ? 1 : 2
  }
  return (10 - (soma % 10)) % 10
}

/** Módulo 11 do código de barras bancário (pesos 2 a 9). Resultado 0, 10 ou 11 vira 1. */
export function modulo11Bancario(numero: string): number {
  let soma = 0
  let peso = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const dv = 11 - (soma % 11)
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv
}

/** Módulo 11 da arrecadação: resto 0 ou 1 vira DV 0. */
export function modulo11Arrecadacao(numero: string): number {
  let soma = 0
  let peso = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  return resto <= 1 ? 0 : 11 - resto
}

export interface LinhaDigitavelInfo {
  tipo: 'bancario' | 'arrecadacao'
  linha: string
  codigoBarras: string
  valor: number | null
  vencimento: string | null
}

/** Base do fator de vencimento: 07/10/1997 (fator 0). Em 22/02/2025 o fator voltou a 1000. */
const BASE_ANTIGA = '1997-10-07'
const BASE_NOVA = '2025-02-22'

/**
 * Converte o fator de vencimento em data. Como o fator "deu a volta" em 2025,
 * o mesmo número vale para duas datas; escolhemos a mais próxima de `referencia`.
 */
export function vencimentoPorFator(fator: number, referencia: string): string | null {
  if (!Number.isInteger(fator) || fator < 1000 || fator > 9999) return null
  const antiga = somarDias(BASE_ANTIGA, fator)
  const nova = somarDias(BASE_NOVA, fator - 1000)
  const da = Math.abs(diferencaDias(referencia, antiga))
  const dn = Math.abs(diferencaDias(referencia, nova))
  return dn <= da ? nova : antiga
}

function validarBancario(l: string, referencia: string): LinhaDigitavelInfo | null {
  const c1 = l.slice(0, 9)
  const c2 = l.slice(10, 20)
  const c3 = l.slice(21, 31)
  if (modulo10(c1) !== Number(l[9])) return null
  if (modulo10(c2) !== Number(l[20])) return null
  if (modulo10(c3) !== Number(l[31])) return null
  const codigoBarras = l.slice(0, 4) + l[32] + l.slice(33, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31)
  const semDV = codigoBarras.slice(0, 4) + codigoBarras.slice(5)
  if (modulo11Bancario(semDV) !== Number(codigoBarras[4])) return null
  const fator = Number(l.slice(33, 37))
  const centavos = Number(l.slice(37, 47))
  return {
    tipo: 'bancario',
    linha: l,
    codigoBarras,
    valor: centavos > 0 ? centavos / 100 : null,
    vencimento: fator === 0 ? null : vencimentoPorFator(fator, referencia)
  }
}

function validarArrecadacao(l: string): LinhaDigitavelInfo | null {
  if (l[0] !== '8') return null
  const idValor = l[2]
  const mod =
    idValor === '6' || idValor === '7'
      ? modulo10
      : idValor === '8' || idValor === '9'
        ? modulo11Arrecadacao
        : null
  if (!mod) return null
  let codigoBarras = ''
  for (let b = 0; b < 4; b++) {
    const bloco = l.slice(b * 12, b * 12 + 11)
    if (mod(bloco) !== Number(l[b * 12 + 11])) return null
    codigoBarras += bloco
  }
  const semDV = codigoBarras.slice(0, 3) + codigoBarras.slice(4)
  if (mod(semDV) !== Number(codigoBarras[3])) return null
  // Valor "efetivo" só quando o identificador é 6 ou 8; 7/9 = valor de referência
  const centavos = Number(codigoBarras.slice(4, 15))
  const efetivo = idValor === '6' || idValor === '8'
  return {
    tipo: 'arrecadacao',
    linha: l,
    codigoBarras,
    valor: efetivo && centavos > 0 ? centavos / 100 : null,
    vencimento: null
  }
}

/** Valida uma linha digitável (com ou sem pontuação). Retorna null se o DV não bater. */
export function validarLinhaDigitavel(entrada: string, referencia: string): LinhaDigitavelInfo | null {
  const l = apenasDigitos(entrada)
  if (l.length === 47) return validarBancario(l, referencia)
  if (l.length === 48) return validarArrecadacao(l)
  return null
}

/** Procura linhas digitáveis válidas num texto qualquer. */
export function encontrarLinhasDigitaveis(texto: string, referencia: string): LinhaDigitavelInfo[] {
  const achadas = new Map<string, LinhaDigitavelInfo>()
  // Sequências de dígitos separadas por pontos, espaços, hífens ou quebras de linha
  const candidatos = texto.match(/\d[\d.\s-]{45,80}\d/g) ?? []
  for (const c of candidatos) {
    const digitos = apenasDigitos(c)
    // Tenta janelas de 47/48 dígitos dentro do trecho (pode vir colado com outros números)
    for (const tam of [48, 47]) {
      for (let i = 0; i + tam <= digitos.length; i++) {
        const info = validarLinhaDigitavel(digitos.slice(i, i + tam), referencia)
        if (info && !achadas.has(info.linha)) {
          achadas.set(info.linha, info)
          break
        }
      }
    }
  }
  return [...achadas.values()]
}

/** Formata a linha digitável bancária no padrão visual "00000.00000 00000.000000 ...". */
export function formatarLinhaDigitavel(linha: string): string {
  const l = apenasDigitos(linha)
  if (l.length === 47) {
    return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`
  }
  if (l.length === 48) {
    return [0, 1, 2, 3].map((b) => `${l.slice(b * 12, b * 12 + 11)}-${l[b * 12 + 11]}`).join(' ')
  }
  return linha
}

// ---------------------------------------------------------------- PIX

export function crc16Pix(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function validarPix(codigo: string): boolean {
  if (!codigo.startsWith('000201') || !/br\.gov\.bcb\.pix/i.test(codigo)) return false
  const m = /6304([0-9A-Fa-f]{4})$/.exec(codigo)
  if (!m) return false
  return crc16Pix(codigo.slice(0, -4)) === m[1]!.toUpperCase()
}

/** Procura códigos PIX copia-e-cola válidos (CRC confere). Tolera quebras de linha no meio. */
export function encontrarPix(texto: string): string[] {
  const achados = new Set<string>()
  for (const variante of [texto, texto.replace(/[\r\n]+/g, '')]) {
    let inicio = variante.indexOf('000201')
    while (inicio >= 0) {
      const resto = variante.slice(inicio, inicio + 600)
      const re = /6304[0-9A-Fa-f]{4}/g
      let m: RegExpExecArray | null
      while ((m = re.exec(resto))) {
        const cand = resto.slice(0, m.index + 8)
        if (validarPix(cand)) {
          achados.add(cand)
          break
        }
      }
      inicio = variante.indexOf('000201', inicio + 6)
    }
  }
  return [...achados]
}
