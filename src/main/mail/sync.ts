// Sincronização: e-mails → Boletos_Outras_Contas, sem duplicidade, com limpeza.
// Grava SÓ os campos do boleto; o conteúdo do e-mail nunca vai para a planilha nem para o log.

import {
  calcularSituacao,
  chavesExistentes,
  dentroDaJanela,
  eDuplicado,
  manualVazia,
  paraConta,
  registrarChaves,
  type ChavesExistentes
} from '../../shared/boletos'
import { formatarLinhaDigitavel } from '../../shared/boleto-codigo'
import type { Conta, ContaPFPJ, ResultadoSync } from '../../shared/types'
import type { Planilha } from '../sheets'
import { extrairBoletos, textoCompleto, type BoletoExtraido, type MensagemCandidata } from './extrair'
import { validarRespostaIA, type RespostaIA } from './ia'

export const ABA_DESTINO = 'Boletos_Outras_Contas'
const DIAS_PRIMEIRA_SYNC = 45
const DIAS_GUARDAR_PROCESSADOS = 90

export interface ContaSync {
  id: string
  email: string
  apelido: string
  contaBoleto: ContaPFPJ
  soConferencia: boolean
}

/** Boleto achado com vencimento a mais de 7 dias: guardamos só os campos e gravamos quando entrar na janela. */
export interface BoletoFuturo {
  idMensagem: string
  vencimento: string
  valor: number | null
  beneficiario: string
  linhaDigitavel: string | null
  comoPagar: string
}

export interface EstadoContaSync {
  ultimaSync: number | null
  /** Message-ID → quando foi processado (ms). */
  processados: Record<string, number>
  futuros: BoletoFuturo[]
}

export function estadoVazio(): EstadoContaSync {
  return { ultimaSync: null, processados: {}, futuros: [] }
}

export interface BoletoNovo {
  vencimento: string
  valor: number | null
  beneficiario: string
}

export interface DepsSync {
  planilha: Planilha
  hoje: string
  agora: number
  /** id_mensagem já marcados como pagos neste computador. */
  pagosOutras: Set<string>
  buscar: (desde: Date, jaProcessados: Set<string>, aoEncontrar: (m: MensagemCandidata) => Promise<void>) => Promise<unknown>
  ia?: ((texto: string) => Promise<RespostaIA | null>) | null
  aoNovoBoleto?: (b: BoletoNovo) => void
  log?: (msg: string) => void
}

export type RegistroLinha = Record<string, string | number>

export function montarRegistro(
  b: { vencimento: string; valor: number | null; beneficiario: string; comoPagar: string },
  idMensagem: string,
  conta: ContaSync,
  hoje: string
): RegistroLinha {
  return {
    vencimento: b.vencimento,
    beneficiario: b.beneficiario,
    valor: b.valor ?? '',
    conta: conta.contaBoleto,
    origem: `E-mail ${conta.apelido}`,
    situacao: calcularSituacao(b.vencimento, hoje) ?? '',
    como_pagar: b.comoPagar,
    observacao: b.valor === null ? 'Valor no PDF' : '',
    conta_email: conta.email,
    id_mensagem: idMensagem
  }
}

export interface Panorama {
  contas: Conta[]
  existentes: ChavesExistentes
}

/**
 * Lê as três abas de boletos, faz a limpeza de Boletos_Outras_Contas
 * (pagos e vencidos há mais de 30 dias saem; situação é recalculada) e devolve as chaves para deduplicar.
 */
export async function prepararPanorama(planilha: Planilha, hoje: string, pagosOutras: Set<string>): Promise<Panorama> {
  const abas = await planilha.lerAbas(['Boletos', 'Boletos_Manual', 'Boletos_Outras_Contas'] as const)
  const remover: number[] = []
  const contas: Conta[] = []
  for (const l of abas.Boletos_Outras_Contas.linhas) {
    const c = paraConta('Boletos_Outras_Contas', l.dados, l.numero, hoje)
    if ((c.idMensagem && pagosOutras.has(c.idMensagem)) || c.situacao === 'Vencido há mais de 30 dias') {
      remover.push(l.numero)
      continue
    }
    const atual = (l.dados.situacao ?? '').trim()
    if (c.situacao && dentroDaJanela(c.situacao) && atual !== c.situacao) {
      await planilha.atualizarCelula(ABA_DESTINO, l.numero, 'situacao', c.situacao)
    }
    contas.push(c)
  }
  if (remover.length) await planilha.removerLinhas(ABA_DESTINO, remover)

  for (const l of abas.Boletos.linhas) contas.push(paraConta('Boletos', l.dados, l.numero, hoje))
  for (const l of abas.Boletos_Manual.linhas) {
    if (manualVazia(l.dados)) continue
    // Mesmo os pagos entram na deduplicação: não queremos regravar um boleto que o Tulio já pagou
    contas.push(paraConta('Boletos_Manual', l.dados, l.numero, hoje))
  }
  const existentes = chavesExistentes(contas)
  for (const id of pagosOutras) existentes.ids.add(id.split('#')[0]!)
  return { contas, existentes }
}

async function completarComIA(
  msg: MensagemCandidata,
  parcial: BoletoExtraido,
  deps: DepsSync
): Promise<BoletoExtraido | null> {
  if (!deps.ia) return null
  try {
    const r = await deps.ia(textoCompleto(msg))
    if (!r) return null
    const b = validarRespostaIA(r, deps.hoje, parcial.comoPagar)
    if (!b) return null
    return {
      ...b,
      vencimento: b.vencimento ?? parcial.vencimento,
      valor: b.valor ?? parcial.valor,
      beneficiario: parcial.beneficiario || b.beneficiario
    }
  } catch {
    deps.log?.('IA: falha ao extrair (seguindo sem IA)')
    return null
  }
}

/** Sincroniza uma conta. Muta `estado` e `panorama.existentes`. */
export async function sincronizarConta(
  conta: ContaSync,
  estado: EstadoContaSync,
  panorama: Panorama,
  deps: DepsSync
): Promise<ResultadoSync> {
  const resultado: ResultadoSync = { contaId: conta.id, novos: 0, ignorados: 0, semVencimento: 0, erro: null }
  const desde = estado.ultimaSync
    ? new Date(estado.ultimaSync - 2 * 86_400_000)
    : new Date(deps.agora - DIAS_PRIMEIRA_SYNC * 86_400_000)

  const gravar = async (b: BoletoFuturo): Promise<'gravado' | 'duplicado' | 'fora' | 'futuro'> => {
    const situacao = calcularSituacao(b.vencimento, deps.hoje)
    if (situacao === 'Futuro') return 'futuro'
    if (!dentroDaJanela(situacao)) return 'fora'
    if (eDuplicado(panorama.existentes, b)) return 'duplicado'
    if (!conta.soConferencia) {
      await deps.planilha.acrescentar(ABA_DESTINO, montarRegistro(b, b.idMensagem, conta, deps.hoje))
      deps.aoNovoBoleto?.({ vencimento: b.vencimento, valor: b.valor, beneficiario: b.beneficiario })
    }
    registrarChaves(panorama.existentes, b)
    resultado.novos++
    return 'gravado'
  }

  // Boletos guardados que agora entraram na janela de 7 dias
  const aindaFuturos: BoletoFuturo[] = []
  for (const f of estado.futuros) {
    if ((await gravar(f)) === 'futuro') aindaFuturos.push(f)
  }
  estado.futuros = aindaFuturos

  const jaProcessados = new Set(Object.keys(estado.processados))
  await deps.buscar(desde, jaProcessados, async (msg) => {
    estado.processados[msg.messageId] = deps.agora
    const r = extrairBoletos(msg, { contaEmail: conta.email, hoje: deps.hoje })
    let boletos: BoletoExtraido[] = []
    if (r.tipo === 'descartado') {
      resultado.ignorados++
      return
    }
    if (r.tipo === 'incompleto') {
      const ia = await completarComIA(msg, r.parcial, deps)
      if (ia) boletos = [ia]
      else {
        resultado.semVencimento++
        return
      }
    } else boletos = r.boletos

    for (let i = 0; i < boletos.length; i++) {
      let b = boletos[i]!
      if (!b.vencimento) {
        const ia = await completarComIA(msg, b, deps)
        if (ia?.vencimento) b = ia
      }
      if (!b.vencimento) {
        resultado.semVencimento++
        continue
      }
      const idMensagem = i === 0 ? msg.messageId : `${msg.messageId}#${i + 1}`
      const comoPagar = b.linhaDigitavel ? formatarLinhaDigitavel(b.linhaDigitavel) : b.comoPagar
      const item: BoletoFuturo = {
        idMensagem,
        vencimento: b.vencimento,
        valor: b.valor,
        beneficiario: b.beneficiario,
        linhaDigitavel: b.linhaDigitavel,
        comoPagar
      }
      const s = await gravar(item)
      if (s === 'futuro') estado.futuros.push(item)
      else if (s !== 'gravado') resultado.ignorados++
    }
  })

  // Esquece processados antigos para o arquivo não crescer sem limite
  const limite = deps.agora - DIAS_GUARDAR_PROCESSADOS * 86_400_000
  for (const [id, quando] of Object.entries(estado.processados)) if (quando < limite) delete estado.processados[id]
  estado.ultimaSync = deps.agora
  return resultado
}
