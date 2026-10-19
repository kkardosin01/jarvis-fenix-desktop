import { describe, expect, it } from 'vitest'
import {
  Planilha,
  indiceColuna,
  letraColuna,
  matrizParaLinhas,
  registroParaLinha,
  validarChaveContaServico,
  type SheetsApi
} from '../../src/main/sheets'
import { montarDados } from '../../src/main/painel'

/** Planilha em memória que imita a API do Google. */
function planilhaFalsa(abas: Record<string, string[][]>): SheetsApi & { abas: Record<string, string[][]> } {
  const nomeDe = (range: string): string => range.replace(/^'/, '').replace(/'.*$/, '')
  return {
    abas,
    async lerValores(ranges) {
      return ranges.map((r) => {
        const m = abas[nomeDe(r)] ?? []
        return r.includes('!1:1') ? m.slice(0, 1) : m.map((l) => [...l])
      })
    },
    async acrescentar(range, valores) {
      abas[nomeDe(range)]!.push(...valores.map((l) => l.map(String)))
    },
    async atualizar(range, valores) {
      const m = /!([A-Z]+)(\d+)$/.exec(range)!
      const col = m[1]!.charCodeAt(0) - 65
      const lin = Number(m[2]) - 1
      abas[nomeDe(range)]![lin]![col] = String(valores[0]![0])
    },
    async idDaAba(aba) {
      return Object.keys(abas).indexOf(aba)
    },
    async removerLinhas(sheetId, numeros) {
      const aba = Object.keys(abas)[sheetId]!
      for (const n of [...numeros].sort((a, b) => b - a)) abas[aba]!.splice(n - 1, 1)
    }
  }
}

const CAB_OUTRAS = ['vencimento', 'beneficiario', 'valor', 'conta', 'origem', 'situacao', 'como_pagar', 'observacao', 'conta_email', 'id_mensagem']
const CAB_MANUAL = ['vencimento (AAAA-MM-DD)', 'beneficiario', 'valor', 'conta (PJ ou PF)', 'pago? (sim/não)', 'observacao']

describe('utilitários', () => {
  it('letra da coluna', () => {
    expect(letraColuna(0)).toBe('A')
    expect(letraColuna(25)).toBe('Z')
    expect(letraColuna(26)).toBe('AA')
  })
  it('coluna por nome, ignorando explicação entre parênteses e acento', () => {
    expect(indiceColuna(CAB_MANUAL, 'vencimento')).toBe(0)
    expect(indiceColuna(CAB_MANUAL, 'pago?')).toBe(4)
    expect(indiceColuna(CAB_MANUAL, 'conta')).toBe(3)
    expect(indiceColuna(['Beneficiário'], 'beneficiario')).toBe(0)
  })
  it('lê por nome mesmo com colunas em outra ordem e pula linhas vazias', () => {
    const lida = matrizParaLinhas([['b', 'a'], ['2', '1'], ['', ''], ['4']])
    expect(lida.linhas).toEqual([
      { numero: 2, dados: { b: '2', a: '1' } },
      { numero: 4, dados: { b: '4', a: '' } }
    ])
  })
  it('monta a linha na ordem do cabeçalho', () => {
    expect(registroParaLinha(['x', 'y', 'z'], { z: 3, x: 'a' })).toEqual(['a', '', 3])
    expect(() => registroParaLinha(['x'], { w: 1 })).toThrow(/não existe/)
  })
  it('valida a chave da conta de serviço', () => {
    expect(() => validarChaveContaServico('{"type":"user"}')).toThrow()
    expect(validarChaveContaServico('{"type":"service_account","client_email":"a@b.iam.gserviceaccount.com","private_key":"x"}').client_email).toContain('@')
  })
})

describe('Planilha', () => {
  it('acrescenta, atualiza e remove por id_mensagem', async () => {
    const api = planilhaFalsa({ Resumo: [['chave', 'valor']], Boletos_Outras_Contas: [CAB_OUTRAS] })
    const p = new Planilha(api)
    await p.acrescentar('Boletos_Outras_Contas', { vencimento: '2026-10-20', beneficiario: 'Luz', valor: 10.5, id_mensagem: '<a@x>' })
    await p.acrescentar('Boletos_Outras_Contas', { vencimento: '2026-10-21', beneficiario: 'Água', id_mensagem: '<b@x>' })
    expect(api.abas.Boletos_Outras_Contas).toHaveLength(3)
    expect(api.abas.Boletos_Outras_Contas![1]![2]).toBe('10.5')

    await p.atualizarCelula('Boletos_Outras_Contas', 3, 'situacao', 'Atrasado')
    expect(api.abas.Boletos_Outras_Contas![2]![5]).toBe('Atrasado')

    expect(await p.removerPorChave('Boletos_Outras_Contas', 'id_mensagem', ['<a@x>'])).toBe(1)
    expect(api.abas.Boletos_Outras_Contas!.map((l) => l[1])).toEqual(['beneficiario', 'Água'])
  })

  it('bloqueia escrita fora de Boletos_Manual e Boletos_Outras_Contas', async () => {
    const p = new Planilha(planilhaFalsa({ Resumo: [['chave', 'valor']], Boletos: [['vencimento']] }))
    await expect(p.acrescentar('Resumo', { chave: 'x' })).rejects.toThrow(/bloqueada/)
    await expect(p.atualizarCelula('Boletos', 2, 'vencimento', 'x')).rejects.toThrow(/bloqueada/)
    await expect(p.removerLinhas('Contatos', [2])).rejects.toThrow(/bloqueada/)
  })

  it('não deixa alterar o cabeçalho', async () => {
    const p = new Planilha(planilhaFalsa({ Boletos_Manual: [CAB_MANUAL] }))
    await expect(p.atualizarCelula('Boletos_Manual', 1, 'beneficiario', 'x')).rejects.toThrow(/cabeçalho/)
  })
})

describe('montarDados', () => {
  it('junta as três abas de boletos, recalcula situação e esconde pagos', async () => {
    const api = planilhaFalsa({
      Resumo: [['chave', 'valor', 'detalhe'], ['frase_do_dia', 'Bom trabalho', ''], ['boletos_valor_conhecido', '589,99', ''], ['atualizado_em', '19/10/2026 08:40', '']],
      Prioridades: [['ordem', 'prioridade', 'por_que'], ['2', 'B', ''], ['1', 'A', '']],
      Emails: [['recebido_em', 'remetente', 'assunto', 'resumo', 'categoria', 'acao', 'urgencia']],
      Boletos: [
        ['vencimento', 'beneficiario', 'valor', 'conta', 'origem', 'situacao', 'como_pagar', 'observacao'],
        ['2026-10-20', 'DAS', '', 'PJ', 'E-mail do contador', 'Vence amanhã', 'PDF', 'Valor no PDF'],
        ['2026-10-10', 'Contador', '1.200,00', 'PJ', 'E-mail', 'Atrasado', '', '']
      ],
      Boletos_Manual: [CAB_MANUAL, ['', '', '', '', '', 'Lance aqui'], ['19/10/2026', 'Aluguel', '2.500,00', 'PF', 'não', ''], ['2026-10-18', 'Pago já', '10', 'PF', 'sim', '']],
      Boletos_Outras_Contas: [CAB_OUTRAS, ['2026-10-22', 'Celesc', '230,10', 'PF', 'E-mail Pessoal', 'Próximos dias', '', '', 'p@x.com', '<m1@x>']],
      Contatos: [['cliente', 'cidade', 'contato', 'telefone', 'ultima_compra', 'dias_sem_comprar', 'motivo', 'mensagem_sugerida'], ['Clínica Fictícia', 'Floripa', 'Ana', '(48) 3000-0000', '14/08/2026', '66', 'parou', 'Oi']],
      Prospects: [['data', 'empresa', 'segmento', 'cidade', 'email', 'situacao', 'proximo_passo', 'data_proximo_passo']]
    })
    const abas = await new Planilha(api).lerAbas(['Resumo', 'Prioridades', 'Emails', 'Boletos', 'Boletos_Manual', 'Boletos_Outras_Contas', 'Contatos', 'Prospects'] as const)
    const contadorChave = 'nuvem:contador|2026-10-10|120000'
    const d = montarDados(abas, '2026-10-19', { nuvem: [contadorChave], outras: [] })
    expect(d.resumo.fraseDoDia).toBe('Bom trabalho')
    expect(d.resumo.boletosValorConhecido).toBe(589.99)
    expect(d.resumo.atualizadoEmISO).toBe('2026-10-19T11:40:00.000Z')
    expect(d.prioridades.map((p) => p.prioridade)).toEqual(['A', 'B'])
    expect(d.contas.map((c) => [c.beneficiario, c.situacao])).toEqual([
      ['Aluguel', 'Vence hoje'],
      ['DAS', 'Próximos dias'],
      ['Celesc', 'Próximos dias']
    ])
    expect(d.contatos[0]?.diasSemComprar).toBe(66)
  })
})
