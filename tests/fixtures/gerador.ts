// Gera códigos FICTÍCIOS (mas com DV correto) para os testes. Nada aqui é dado real.

import { crc16Pix, modulo10, modulo11Arrecadacao, modulo11Bancario } from 'jarvis-fenix-core/boleto-codigo'
import { diferencaDias } from 'jarvis-fenix-core/ptbr'

export function fatorDe(vencimento: string): number {
  return 1000 + diferencaDias('2025-02-22', vencimento)
}

/** Linha digitável bancária fictícia com DVs válidos. */
export function gerarLinhaBancaria(opts: {
  banco?: string
  vencimento?: string | null
  centavos?: number
  campoLivre?: string
}): string {
  const banco = opts.banco ?? '999'
  const fator = opts.vencimento ? String(fatorDe(opts.vencimento)).padStart(4, '0') : '0000'
  const valor = String(opts.centavos ?? 0).padStart(10, '0')
  const livre = (opts.campoLivre ?? '1234567890123456789012345').padEnd(25, '0').slice(0, 25)
  const semDV = banco + '9' + fator + valor + livre
  const dv = modulo11Bancario(semDV)
  const barras = semDV.slice(0, 4) + dv + semDV.slice(4)
  const c1 = barras.slice(0, 4) + barras.slice(19, 24)
  const c2 = barras.slice(24, 34)
  const c3 = barras.slice(34, 44)
  return c1 + modulo10(c1) + c2 + modulo10(c2) + c3 + modulo10(c3) + barras[4] + barras.slice(5, 19)
}

/** Linha de arrecadação (conta de luz/água) fictícia, identificador de valor 6 (módulo 10) ou 8 (módulo 11). */
export function gerarLinhaArrecadacao(centavos: number, idValor: '6' | '8' = '6'): string {
  const mod = idValor === '6' ? modulo10 : modulo11Arrecadacao
  const corpo = '8' + '3' + idValor + String(centavos).padStart(11, '0') + '0001' + '9'.repeat(25)
  const semDV = corpo.slice(0, 43)
  const dv = mod(semDV)
  const barras = semDV.slice(0, 3) + dv + semDV.slice(3)
  let linha = ''
  for (let b = 0; b < 4; b++) {
    const bloco = barras.slice(b * 11, b * 11 + 11)
    linha += bloco + mod(bloco)
  }
  return linha
}

function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, '0') + valor
}

/** PIX copia-e-cola fictício com CRC válido. */
export function gerarPix(chave = 'cobranca@exemplo-ficticio.com.br', valor = '150.00'): string {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave)
  const corpo =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', valor) +
    campo('58', 'BR') +
    campo('59', 'EMPRESA FICTICIA') +
    campo('60', 'FLORIANOPOLIS') +
    campo('62', campo('05', 'TESTE123')) +
    '6304'
  return corpo + crc16Pix(corpo)
}

export function formatarComPontos(l: string): string {
  return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`
}

/** PDF mínimo (texto simples, Helvetica) gerado à mão para testar a extração. */
export function gerarPdf(linhas: string[]): Buffer {
  const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const conteudo =
    'BT /F1 11 Tf 40 800 Td 14 TL\n' + linhas.map((l) => `(${esc(l)}) Tj T*`).join('\n') + '\nET'
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(conteudo, 'latin1')} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
