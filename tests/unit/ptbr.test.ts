import { describe, expect, it } from 'vitest'
import {
  agoraSP,
  diferencaDias,
  formatarDiaMes,
  formatarMoeda,
  parseDataBR,
  parseDataExtenso,
  parseDataHoraBR,
  parseNumeroBR,
  tempoDesde
} from '../../src/shared/ptbr'
import { normalizarTelefone, linksWhatsApp } from '../../src/shared/whatsapp'

describe('parseNumeroBR', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['R$ 1.234,56', 1234.56],
    ['589,99', 589.99],
    ['1.234', 1234],
    ['12.5', 12.5],
    ['1234.56', 1234.56],
    ['  8 ', 8],
    ['1.234.567,8', 1234567.8],
    ['-10,00', -10]
  ])('%s → %s', (e, s) => expect(parseNumeroBR(e)).toBe(s))

  it.each(['', 'abc', 'Valor no PDF', null, undefined])('%s → null', (e) => expect(parseNumeroBR(e)).toBeNull())

  it('aceita número', () => expect(parseNumeroBR(3.5)).toBe(3.5))
})

describe('datas', () => {
  it.each([
    ['20/10/2026', '2026-10-20'],
    ['2026-10-20', '2026-10-20'],
    ['20/10/26', '2026-10-20'],
    ['19/10/2026 20:10', '2026-10-19'],
    ['5.1.2027', '2027-01-05'],
    ['31/02/2026', null],
    ['', null]
  ])('parseDataBR(%s) = %s', (e, s) => expect(parseDataBR(e)).toBe(s))

  it('data e hora em Brasília', () => {
    expect(parseDataHoraBR('19/10/2026 20:10')?.toISOString()).toBe('2026-10-19T23:10:00.000Z')
  })

  it('data por extenso', () => {
    expect(parseDataExtenso('vence em 20 de outubro de 2026')).toBe('2026-10-20')
    expect(parseDataExtenso('5 de mar. de 2027')).toBe('2027-03-05')
  })

  it('hoje em São Paulo mesmo perto da meia-noite UTC', () => {
    expect(agoraSP(new Date('2026-10-20T02:30:00Z')).iso).toBe('2026-10-19')
    expect(agoraSP(new Date('2026-10-20T02:30:00Z')).hora).toBe(23)
  })

  it('diferença de dias e formatação', () => {
    expect(diferencaDias('2026-10-19', '2026-10-20')).toBe(1)
    expect(diferencaDias('2026-10-19', '2026-09-19')).toBe(-30)
    expect(formatarDiaMes('2026-10-20')).toBe('20/10')
  })

  it('tempo desde', () => {
    const agora = 1_000_000_000
    expect(tempoDesde(agora - 30_000, agora)).toBe('agora')
    expect(tempoDesde(agora - 5 * 60_000, agora)).toBe('há 5 min')
    expect(tempoDesde(agora - 3 * 3_600_000, agora)).toBe('há 3 h')
  })
})

describe('moeda', () => {
  it('formata em reais', () => {
    expect(formatarMoeda(1234.56)).toBe('R$ 1.234,56')
    expect(formatarMoeda(null)).toBe('—')
  })
})

describe('WhatsApp', () => {
  it.each([
    ['(048) 3283-2293', '554832832293'],
    ['(48) 99915-2015', '5548999152015'],
    ['+55 48 99915-2015', '5548999152015'],
    ['0 21 48 99915-2015', '5548999152015'],
    ['123', null]
  ])('%s → %s', (e, s) => expect(normalizarTelefone(e)).toBe(s))

  it('monta os links do app e da web', () => {
    const l = linksWhatsApp('(48) 99915-2015', 'Oi, tudo bem?')
    expect(l?.app).toBe('whatsapp://send?phone=5548999152015&text=Oi%2C%20tudo%20bem%3F')
    expect(l?.web).toBe('https://wa.me/5548999152015?text=Oi%2C%20tudo%20bem%3F')
  })
})
