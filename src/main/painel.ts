// Converte as abas lidas da planilha nos dados do painel.

import { coluna, manualPago, manualVazia, ordenarContas, paraConta } from '../shared/boletos'
import { parseDataHoraBR, parseNumeroBR } from '../shared/ptbr'
import type { Conta, Contato, DadosPainel, EmailResumo, Prioridade, Prospect, Resumo } from '../shared/types'
import type { Aba, AbaLida } from './sheets'

export interface PagosLocais {
  /** Chaves de linhas da aba Boletos (nuvem) marcadas como pagas aqui. */
  nuvem: string[]
  /** id_mensagem removidos de Boletos_Outras_Contas por estarem pagos. */
  outras: string[]
}

function numero(s: string): number | null {
  return parseNumeroBR(s)
}

export function montarResumo(aba: AbaLida | undefined): Resumo {
  const mapa: Record<string, { valor: string; detalhe: string }> = {}
  for (const l of aba?.linhas ?? []) {
    const k = coluna(l.dados, 'chave')
    if (k) mapa[k] = { valor: coluna(l.dados, 'valor'), detalhe: coluna(l.dados, 'detalhe') }
  }
  const v = (k: string): string => mapa[k]?.valor ?? ''
  const atualizado = parseDataHoraBR(v('atualizado_em'))
  return {
    atualizadoEm: v('atualizado_em'),
    atualizadoEmISO: atualizado ? atualizado.toISOString() : null,
    fraseDoDia: v('frase_do_dia'),
    emailsRelevantes: numero(v('emails_relevantes')),
    boletosHoje: numero(v('boletos_hoje')),
    boletosAtrasados: numero(v('boletos_atrasados')),
    boletosValorConhecido: numero(v('boletos_valor_conhecido')),
    contatosHoje: numero(v('contatos_hoje')),
    rascunhosProspeccao: numero(v('rascunhos_prospeccao')),
    detalhes: Object.fromEntries(Object.entries(mapa).map(([k, x]) => [k, x.detalhe]))
  }
}

export function montarContas(abas: Partial<Record<Aba, AbaLida>>, hoje: string, pagos: PagosLocais): Conta[] {
  const nuvemPagos = new Set(pagos.nuvem)
  const outrasPagos = new Set(pagos.outras)
  const contas: Conta[] = []
  for (const l of abas.Boletos?.linhas ?? []) {
    const c = paraConta('Boletos', l.dados, l.numero, hoje)
    if (!c.beneficiario && !c.vencimento) continue
    if (!nuvemPagos.has(c.chave)) contas.push(c)
  }
  for (const l of abas.Boletos_Outras_Contas?.linhas ?? []) {
    const c = paraConta('Boletos_Outras_Contas', l.dados, l.numero, hoje)
    if (!c.beneficiario && !c.vencimento) continue
    if (!outrasPagos.has(c.idMensagem)) contas.push(c)
  }
  for (const l of abas.Boletos_Manual?.linhas ?? []) {
    if (manualVazia(l.dados) || manualPago(l.dados)) continue
    contas.push(paraConta('Boletos_Manual', l.dados, l.numero, hoje))
  }
  return ordenarContas(contas)
}

export function montarDados(abas: Partial<Record<Aba, AbaLida>>, hoje: string, pagos: PagosLocais): DadosPainel {
  const prioridades: Prioridade[] = (abas.Prioridades?.linhas ?? [])
    .map((l) => ({
      ordem: numero(coluna(l.dados, 'ordem')) ?? 99,
      prioridade: coluna(l.dados, 'prioridade'),
      porQue: coluna(l.dados, 'por_que')
    }))
    .filter((p) => p.prioridade)
    .sort((a, b) => a.ordem - b.ordem)

  const emails: EmailResumo[] = (abas.Emails?.linhas ?? []).map((l) => ({
    recebidoEm: coluna(l.dados, 'recebido_em'),
    remetente: coluna(l.dados, 'remetente'),
    assunto: coluna(l.dados, 'assunto'),
    resumo: coluna(l.dados, 'resumo'),
    categoria: coluna(l.dados, 'categoria'),
    acao: coluna(l.dados, 'acao'),
    urgencia: coluna(l.dados, 'urgencia')
  }))

  const contatos: Contato[] = (abas.Contatos?.linhas ?? [])
    .map((l) => ({
      cliente: coluna(l.dados, 'cliente'),
      cidade: coluna(l.dados, 'cidade'),
      contato: coluna(l.dados, 'contato'),
      telefone: coluna(l.dados, 'telefone'),
      ultimaCompra: coluna(l.dados, 'ultima_compra'),
      diasSemComprar: numero(coluna(l.dados, 'dias_sem_comprar')),
      motivo: coluna(l.dados, 'motivo'),
      mensagemSugerida: coluna(l.dados, 'mensagem_sugerida')
    }))
    .filter((c) => c.cliente)

  const prospects: Prospect[] = (abas.Prospects?.linhas ?? [])
    .map((l) => ({
      data: coluna(l.dados, 'data'),
      empresa: coluna(l.dados, 'empresa'),
      segmento: coluna(l.dados, 'segmento'),
      cidade: coluna(l.dados, 'cidade'),
      email: coluna(l.dados, 'email'),
      situacao: coluna(l.dados, 'situacao'),
      proximoPasso: coluna(l.dados, 'proximo_passo'),
      dataProximoPasso: coluna(l.dados, 'data_proximo_passo')
    }))
    .filter((p) => p.empresa)

  return {
    resumo: montarResumo(abas.Resumo),
    prioridades,
    emails,
    contas: montarContas(abas, hoje, pagos),
    contatos,
    prospects
  }
}
