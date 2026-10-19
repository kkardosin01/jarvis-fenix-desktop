import { describe, expect, it } from 'vitest'
import {
  encontrarLinhasDigitaveis,
  encontrarPix,
  formatarLinhaDigitavel,
  validarLinhaDigitavel,
  validarPix,
  vencimentoPorFator
} from '../../src/shared/boleto-codigo'
import { formatarComPontos, gerarLinhaArrecadacao, gerarLinhaBancaria, gerarPix } from '../fixtures/gerador'

const HOJE = '2026-10-19'

describe('fator de vencimento', () => {
  it('fator 1000 após a virada de 2025 = 22/02/2025', () => {
    expect(vencimentoPorFator(1000, '2025-03-01')).toBe('2025-02-22')
  })
  it('usa a base antiga quando é a mais próxima', () => {
    expect(vencimentoPorFator(9999, '2025-02-01')).toBe('2025-02-21')
  })
  it('fator para 20/10/2026', () => {
    expect(vencimentoPorFator(1605, HOJE)).toBe('2026-10-20')
  })
})

describe('linha digitável bancária', () => {
  const linha = gerarLinhaBancaria({ vencimento: '2026-10-20', centavos: 158990 })

  it('valida DV, calcula vencimento e valor', () => {
    const info = validarLinhaDigitavel(linha, HOJE)
    expect(info).not.toBeNull()
    expect(info?.tipo).toBe('bancario')
    expect(info?.vencimento).toBe('2026-10-20')
    expect(info?.valor).toBe(1589.9)
    expect(info?.codigoBarras).toHaveLength(44)
  })

  it('aceita pontos e espaços', () => {
    expect(validarLinhaDigitavel(formatarComPontos(linha), HOJE)?.linha).toBe(linha)
    expect(formatarLinhaDigitavel(linha)).toBe(formatarComPontos(linha))
  })

  it('rejeita DV de campo errado', () => {
    const errada = linha.slice(0, 9) + ((Number(linha[9]) + 1) % 10) + linha.slice(10)
    expect(validarLinhaDigitavel(errada, HOJE)).toBeNull()
  })

  it('rejeita DV geral errado', () => {
    const errada = linha.slice(0, 32) + ((Number(linha[32]) + 1) % 10) + linha.slice(33)
    expect(validarLinhaDigitavel(errada, HOJE)).toBeNull()
  })

  it('sem valor e sem vencimento quando zerados', () => {
    const info = validarLinhaDigitavel(gerarLinhaBancaria({}), HOJE)
    expect(info?.valor).toBeNull()
    expect(info?.vencimento).toBeNull()
  })
})

describe('linha de arrecadação (48 dígitos)', () => {
  it.each(['6', '8'] as const)('identificador %s', (id) => {
    const linha = gerarLinhaArrecadacao(23456, id)
    const info = validarLinhaDigitavel(linha, HOJE)
    expect(info?.tipo).toBe('arrecadacao')
    expect(info?.valor).toBe(234.56)
  })

  it('rejeita bloco adulterado', () => {
    const linha = gerarLinhaArrecadacao(23456)
    const errada = linha.slice(0, 5) + ((Number(linha[5]) + 1) % 10) + linha.slice(6)
    expect(validarLinhaDigitavel(errada, HOJE)).toBeNull()
  })
})

describe('busca em texto', () => {
  it('encontra linha no meio de texto com quebras', () => {
    const linha = gerarLinhaBancaria({ vencimento: '2026-10-25', centavos: 9900 })
    const fmt = formatarComPontos(linha)
    const texto = `Olá!\nSegue seu boleto.\nLinha digitável:\n${fmt.slice(0, 24)}\n${fmt.slice(24)}\nObrigado`
    const achadas = encontrarLinhasDigitaveis(texto, HOJE)
    expect(achadas.map((a) => a.linha)).toEqual([linha])
  })

  it('ignora números que não são boleto', () => {
    expect(encontrarLinhasDigitaveis('CNPJ 12.345.678/0001-90 pedido 1234567890', HOJE)).toEqual([])
  })
})

describe('PIX copia-e-cola', () => {
  const pix = gerarPix()
  it('valida CRC', () => {
    expect(validarPix(pix)).toBe(true)
    expect(validarPix(pix.slice(0, -1) + (pix.endsWith('A') ? 'B' : 'A'))).toBe(false)
  })
  it('encontra no texto, mesmo quebrado em linhas', () => {
    const texto = `Pague com PIX:\n${pix.slice(0, 40)}\n${pix.slice(40)}\nVálido até amanhã`
    expect(encontrarPix(texto)).toEqual([pix])
  })
})
