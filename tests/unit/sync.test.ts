import { describe, expect, it, vi } from 'vitest'
import { Planilha, type SheetsApi } from '../../src/main/sheets'
import { analisarMensagem } from '../../src/main/mail/imap'
import { estadoVazio, prepararPanorama, sincronizarConta, type ContaSync } from '../../src/main/mail/sync'
import { formatarLinhaDigitavel } from '../../src/shared/boleto-codigo'
import { emailCartao, emailCondominio, emailEscola, emailFuturo, emailLuz, emailPropaganda, linhaCondominio } from '../fixtures/emails'

const CAB_OUTRAS = ['vencimento', 'beneficiario', 'valor', 'conta', 'origem', 'situacao', 'como_pagar', 'observacao', 'conta_email', 'id_mensagem']
const CAB_BOLETOS = ['vencimento', 'beneficiario', 'valor', 'conta', 'origem', 'situacao', 'como_pagar', 'observacao']
const CAB_MANUAL = ['vencimento (AAAA-MM-DD)', 'beneficiario', 'valor', 'conta (PJ ou PF)', 'pago? (sim/não)', 'observacao']

function api(abas: Record<string, string[][]>): SheetsApi {
  const nome = (r: string): string => r.replace(/^'/, '').replace(/'.*$/, '')
  return {
    async lerValores(ranges) {
      return ranges.map((r) => (r.includes('!1:1') ? abas[nome(r)]!.slice(0, 1) : abas[nome(r)]!.map((l) => [...l])))
    },
    async acrescentar(r, v) {
      abas[nome(r)]!.push(...v.map((l) => l.map(String)))
    },
    async atualizar(r, v) {
      const m = /!([A-Z]+)(\d+)$/.exec(r)!
      abas[nome(r)]![Number(m[2]) - 1]![m[1]!.charCodeAt(0) - 65] = String(v[0]![0])
    },
    async idDaAba(a) {
      return Object.keys(abas).indexOf(a)
    },
    async removerLinhas(id, ns) {
      const a = Object.keys(abas)[id]!
      for (const n of [...ns].sort((x, y) => y - x)) abas[a]!.splice(n - 1, 1)
    }
  }
}

const CONTA: ContaSync = { id: 'c1', email: 'pessoa.teste@exemplo.com', apelido: 'Pessoal do Tulio', contaBoleto: 'PF', soConferencia: false }

async function fonte(...emails: Buffer[]) {
  const msgs = await Promise.all(emails.map((e) => analisarMensagem(e, 'r')))
  return async (_d: Date, ja: Set<string>, cb: (m: (typeof msgs)[number]) => Promise<void>) => {
    for (const m of msgs) if (!ja.has(m.messageId)) await cb(m)
  }
}

describe('sincronização', () => {
  it('grava os boletos na janela, sem duplicar, e guarda os futuros', async () => {
    const abas = {
      Boletos: [CAB_BOLETOS, ['2026-10-25', 'Escola Fictícia', '450,00', 'PF', 'E-mail', '', '', '']],
      Boletos_Manual: [CAB_MANUAL],
      Boletos_Outras_Contas: [CAB_OUTRAS]
    }
    const planilha = new Planilha(api(abas))
    const novos = vi.fn()
    const deps = {
      planilha,
      hoje: '2026-10-19',
      agora: Date.parse('2026-10-19T15:00:00Z'),
      pagosOutras: new Set<string>(),
      buscar: await fonte(emailCondominio, emailLuz, emailEscola, emailPropaganda, emailFuturo, emailCartao),
      aoNovoBoleto: novos
    }
    const estado = estadoVazio()
    const panorama = await prepararPanorama(planilha, deps.hoje, deps.pagosOutras)
    const r = await sincronizarConta(CONTA, estado, panorama, deps)

    // Condomínio, luz e cartão gravados; escola já estava na aba Boletos (duplicado); propaganda ignorada; seguro guardado
    expect(r.novos).toBe(3)
    expect(novos).toHaveBeenCalledTimes(3)
    const linhas = abas.Boletos_Outras_Contas.slice(1)
    expect(linhas.map((l) => l[1])).toEqual(['Condominio Residencial Exemplo', 'Energia Fictícia', 'Cartão Fictício'])
    expect(linhas[0]).toEqual([
      '2026-10-22',
      'Condominio Residencial Exemplo',
      '850',
      'PF',
      'E-mail Pessoal do Tulio',
      'Próximos dias',
      formatarLinhaDigitavel(linhaCondominio),
      '',
      'pessoa.teste@exemplo.com',
      '<condominio-001@exemplo>'
    ])
    expect(linhas[1]![5]).toBe('Vence hoje')
    expect(linhas[2]!.slice(2, 8)).toEqual(['', 'PF', 'E-mail Pessoal do Tulio', 'Próximos dias', 'PDF anexo no e-mail de Cartão Fictício (19/10)', 'Valor no PDF'])
    expect(estado.futuros.map((f) => f.vencimento)).toEqual(['2026-11-30'])

    // Segunda rodada: nada novo (processados + deduplicação)
    const p2 = await prepararPanorama(planilha, deps.hoje, deps.pagosOutras)
    const r2 = await sincronizarConta(CONTA, estado, p2, deps)
    expect(r2.novos).toBe(0)
    expect(abas.Boletos_Outras_Contas).toHaveLength(4)
  })

  it('futuro entra na planilha quando chega a 7 dias do vencimento', async () => {
    const abas = { Boletos: [CAB_BOLETOS], Boletos_Manual: [CAB_MANUAL], Boletos_Outras_Contas: [CAB_OUTRAS] }
    const planilha = new Planilha(api(abas))
    const estado = estadoVazio()
    const base = { planilha, pagosOutras: new Set<string>(), buscar: await fonte(emailFuturo) }
    await sincronizarConta(CONTA, estado, await prepararPanorama(planilha, '2026-10-19', base.pagosOutras), {
      ...base,
      hoje: '2026-10-19',
      agora: Date.parse('2026-10-19T15:00:00Z')
    })
    expect(abas.Boletos_Outras_Contas).toHaveLength(1)
    const r = await sincronizarConta(CONTA, estado, await prepararPanorama(planilha, '2026-11-24', base.pagosOutras), {
      ...base,
      hoje: '2026-11-24',
      agora: Date.parse('2026-11-24T15:00:00Z')
    })
    expect(r.novos).toBe(1)
    expect(abas.Boletos_Outras_Contas[1]![5]).toBe('Próximos dias')
    expect(estado.futuros).toEqual([])
  })

  it('limpeza: remove pagos e vencidos há mais de 30 dias, recalcula situação', async () => {
    const abas = {
      Boletos: [CAB_BOLETOS],
      Boletos_Manual: [CAB_MANUAL],
      Boletos_Outras_Contas: [
        CAB_OUTRAS,
        ['2026-09-01', 'Antigo', '10', 'PF', 'E-mail X', 'Atrasado', '', '', 'a@x', '<antigo@x>'],
        ['2026-10-18', 'Ontem', '10', 'PF', 'E-mail X', 'Vence hoje', '', '', 'a@x', '<ontem@x>'],
        ['2026-10-20', 'Pago', '10', 'PF', 'E-mail X', 'Próximos dias', '', '', 'a@x', '<pago@x>']
      ]
    }
    const planilha = new Planilha(api(abas))
    const p = await prepararPanorama(planilha, '2026-10-19', new Set(['<pago@x>']))
    expect(abas.Boletos_Outras_Contas.map((l) => l[1])).toEqual(['beneficiario', 'Ontem'])
    expect(abas.Boletos_Outras_Contas[1]![5]).toBe('Atrasado')
    // O pago continua nas chaves, para não ser regravado
    expect(p.existentes.ids.has('<pago@x>')).toBe(true)
  })

  it('modo conferência não grava nada', async () => {
    const abas = { Boletos: [CAB_BOLETOS], Boletos_Manual: [CAB_MANUAL], Boletos_Outras_Contas: [CAB_OUTRAS] }
    const planilha = new Planilha(api(abas))
    const deps = { planilha, hoje: '2026-10-19', agora: Date.now(), pagosOutras: new Set<string>(), buscar: await fonte(emailLuz) }
    const r = await sincronizarConta({ ...CONTA, soConferencia: true }, estadoVazio(), await prepararPanorama(planilha, deps.hoje, deps.pagosOutras), deps)
    expect(r.novos).toBe(1)
    expect(abas.Boletos_Outras_Contas).toHaveLength(1)
  })

  it('usa a IA só quando faltou vencimento', async () => {
    const abas = { Boletos: [CAB_BOLETOS], Boletos_Manual: [CAB_MANUAL], Boletos_Outras_Contas: [CAB_OUTRAS] }
    const planilha = new Planilha(api(abas))
    const ia = vi.fn().mockResolvedValue({
      vencimento: '2026-10-21',
      valor: 77.5,
      beneficiario: 'Clube Fictício',
      linha_digitavel: null,
      pix: null,
      e_conta_a_pagar: true
    })
    const buscar = async (_d: Date, _j: Set<string>, cb: (m: import('../../src/main/mail/extrair').MensagemCandidata) => Promise<void>) => {
      await cb({ messageId: '<ia@x>', deEmail: 'c@clube.com', deNome: 'Clube', assunto: 'Sua fatura', data: new Date(), texto: 'A fatura do mês está no app.', anexos: [] })
      await cb({ messageId: '<ok@x>', deEmail: 'c@x.com', deNome: 'X', assunto: 'Boleto', data: new Date(), texto: 'Vencimento: 20/10/2026 Valor: R$ 10,00', anexos: [] })
    }
    const r = await sincronizarConta(CONTA, estadoVazio(), await prepararPanorama(planilha, '2026-10-19', new Set()), {
      planilha,
      hoje: '2026-10-19',
      agora: Date.now(),
      pagosOutras: new Set(),
      buscar,
      ia
    })
    expect(ia).toHaveBeenCalledTimes(1)
    expect(r.novos).toBe(2)
    expect(abas.Boletos_Outras_Contas[1]!.slice(0, 3)).toEqual(['2026-10-21', 'Clube', '77.5'])
  })
})
