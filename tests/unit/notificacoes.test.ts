import { describe, expect, it } from 'vitest'
import { avisosDevidos, dentroDoHorarioSync, horarioSilencioso, textoBomDia, type EstadoAvisos } from '../../src/main/regras-notificacao'
import type { Conta, DadosPainel } from '../../src/shared/types'

function conta(situacao: Conta['situacao'], valor: number | null = 10, beneficiario = 'Luz'): Conta {
  return {
    chave: Math.random().toString(),
    fonte: 'Boletos',
    vencimento: '2026-10-20',
    beneficiario,
    valor,
    conta: 'PJ',
    origem: '',
    situacao,
    comoPagar: '',
    observacao: '',
    contaEmail: '',
    idMensagem: '',
    linhaDigitavel: null,
    pix: null,
    linhaPlanilha: 2
  }
}

function dados(p: { contas?: Conta[]; contatos?: number; atualizado?: string | null }): DadosPainel {
  return {
    resumo: {
      atualizadoEm: '',
      atualizadoEmISO: p.atualizado === undefined ? '2026-10-20T11:40:00.000Z' : p.atualizado,
      fraseDoDia: '',
      emailsRelevantes: null,
      boletosHoje: null,
      boletosAtrasados: null,
      boletosValorConhecido: null,
      contatosHoje: null,
      rascunhosProspeccao: null,
      detalhes: {}
    },
    prioridades: [],
    emails: [],
    contas: p.contas ?? [],
    contatos: Array.from({ length: p.contatos ?? 0 }, (_, i) => ({
      cliente: `C${i}`,
      cidade: '',
      contato: '',
      telefone: '',
      ultimaCompra: '',
      diasSemComprar: null,
      motivo: '',
      mensagemSugerida: ''
    })),
    prospects: []
  }
}

const vazio = (): EstadoAvisos => ({ bomDia: null, bomDiaPendente: null, lembrete14: null })
// 20/10/2026 em Brasília (UTC-3)
const as = (h: number, m: number): Date => new Date(Date.UTC(2026, 9, 20, h + 3, m))

describe('texto do bom dia', () => {
  it('só com números maiores que zero', () => {
    expect(textoBomDia('Tulio', dados({ contas: [conta('Vence hoje'), conta('Vence hoje'), conta('Atrasado')], contatos: 8 }))).toBe(
      'Bom dia, Tulio! 2 contas vencem hoje, 1 atrasada e 8 clientes para ligar.'
    )
    expect(textoBomDia('Tulio', dados({ contas: [conta('Vence hoje')] }))).toBe('Bom dia, Tulio! 1 conta vence hoje.')
    expect(textoBomDia('Tulio', dados({}))).toMatch(/Nada vencendo hoje/)
  })
})

describe('agenda de avisos', () => {
  it('nada antes das 9h05 e nada em horário silencioso', () => {
    expect(avisosDevidos(as(9, 4), vazio(), dados({}), 'Tulio')).toEqual([])
    expect(horarioSilencioso(22)).toBe(true)
    expect(horarioSilencioso(6)).toBe(true)
    expect(horarioSilencioso(7)).toBe(false)
  })

  it('bom dia uma vez por dia', () => {
    const e = vazio()
    expect(avisosDevidos(as(9, 5), e, dados({ contatos: 2 }), 'Tulio').map((a) => a.tipo)).toEqual(['bomDia'])
    expect(avisosDevidos(as(9, 10), e, dados({ contatos: 2 }), 'Tulio')).toEqual([])
  })

  it('resumo atrasado: avisa às 9h05 e tenta de novo às 9h35', () => {
    const e = vazio()
    const velho = dados({ atualizado: '2026-10-19T11:40:00.000Z' })
    expect(avisosDevidos(as(9, 5), e, velho, 'Tulio')[0]?.corpo).toMatch(/ainda não chegou/)
    expect(avisosDevidos(as(9, 20), e, velho, 'Tulio')).toEqual([])
    const novo = dados({ contatos: 3 })
    expect(avisosDevidos(as(9, 35), e, novo, 'Tulio')[0]?.corpo).toBe('Bom dia, Tulio! 3 clientes para ligar.')
    expect(avisosDevidos(as(9, 50), e, novo, 'Tulio')).toEqual([])
  })

  it('lembrete das 14h só se houver conta vencendo hoje', () => {
    const e: EstadoAvisos = { bomDia: '2026-10-20', bomDiaPendente: null, lembrete14: null }
    const a = avisosDevidos(as(14, 0), e, dados({ contas: [conta('Vence hoje', 99.9, 'Celesc')] }), 'Tulio')
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({ tela: 'contas' })
    expect(a[0]!.corpo).toContain('Celesc vence hoje')
    expect(a[0]!.corpo).toContain('R$ 99,90')
    const e2: EstadoAvisos = { bomDia: '2026-10-20', bomDiaPendente: null, lembrete14: null }
    expect(avisosDevidos(as(14, 1), e2, dados({ contas: [conta('Atrasado')] }), 'Tulio')).toEqual([])
  })

  it('janela de sincronização', () => {
    expect(dentroDoHorarioSync(as(5, 59), 6, 23)).toBe(false)
    expect(dentroDoHorarioSync(as(6, 0), 6, 23)).toBe(true)
    expect(dentroDoHorarioSync(as(23, 0), 6, 23)).toBe(false)
  })
})
