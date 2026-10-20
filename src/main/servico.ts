// Orquestra planilha, e-mails, estado local e avisos. Roda só no processo principal.

import { randomUUID } from 'node:crypto'
import { net } from 'electron'
import { hojeISO } from 'jarvis-fenix-core/ptbr'
import type { NovaConta, LancarBoleto } from '../shared/esquemas'
import type { ContaEmailPublica, EstadoPainel, ResultadoSync, StatusSegredos } from 'jarvis-fenix-core/types'
import {
  alterarSegredos,
  criptografiaDisponivel,
  gravarCache,
  gravarContas,
  gravarEstadoSync,
  gravarPagos,
  lerCache,
  lerConfig,
  lerContas,
  lerEstadoSync,
  lerPagos,
  lerSegredos,
  type ContaArmazenada
} from './armazenamento'
import { registro } from './log'
import { buscarCandidatas, mensagemErroImap, testarConexao, type ConfigImap } from './mail/imap'
import { extrairComIA } from './mail/ia'
import { estadoVazio, prepararPanorama, sincronizarConta, type BoletoNovo } from './mail/sync'
import { ABAS_LEITURA, Planilha, criarApiGoogle, validarChaveContaServico } from './sheets'
import { montarDados } from './painel'

type Ouvinte = () => void

export class Servico {
  private planilha: Planilha | null = null
  private chavePlanilha = ''
  private estado: EstadoPainel
  private sincronizando = new Set<string>()
  private sincronizacaoGeral: Promise<ResultadoSync[]> | null = null
  private ouvintesPainel: Ouvinte[] = []
  private ouvintesContas: Ouvinte[] = []
  aoNovoBoleto: ((b: BoletoNovo, apelido: string) => void) | null = null

  constructor() {
    const cache = lerCache()
    this.estado = {
      dados: cache.dados,
      lidoEm: cache.lidoEm,
      ultimaTentativa: null,
      erro: null,
      online: true,
      carregando: false,
      configurado: !!lerSegredos().contaServico
    }
  }

  aoMudarPainel(f: Ouvinte): void {
    this.ouvintesPainel.push(f)
  }

  aoMudarContas(f: Ouvinte): void {
    this.ouvintesContas.push(f)
  }

  private avisarPainel(): void {
    for (const f of this.ouvintesPainel) f()
  }

  private avisarContas(): void {
    for (const f of this.ouvintesContas) f()
  }

  estadoPainel(): EstadoPainel {
    return this.estado
  }

  /** Cria (ou recria, se a chave/ID mudou) o cliente da planilha. */
  private async obterPlanilha(): Promise<Planilha> {
    const segredos = lerSegredos()
    const config = lerConfig()
    if (!segredos.contaServico) throw new Error('Configure a chave da conta de serviço em Configurações.')
    const chave = `${config.planilhaId}|${segredos.contaServico.length}|${segredos.contaServico.slice(-40)}`
    if (!this.planilha || chave !== this.chavePlanilha) {
      const credencial = validarChaveContaServico(segredos.contaServico)
      this.planilha = new Planilha(await criarApiGoogle(credencial, config.planilhaId))
      this.chavePlanilha = chave
    }
    return this.planilha
  }

  // ---------------------------------------------------------------- painel

  async atualizarPainel(): Promise<EstadoPainel> {
    this.estado = { ...this.estado, carregando: true, configurado: !!lerSegredos().contaServico }
    this.avisarPainel()
    const agora = Date.now()
    try {
      if (!this.estado.configurado) throw new Error('Configure a chave da conta de serviço em Configurações.')
      const planilha = await this.obterPlanilha()
      const abas = await planilha.lerAbas(ABAS_LEITURA)
      const dados = montarDados(abas, hojeISO(), lerPagos())
      this.estado = { ...this.estado, dados, lidoEm: agora, ultimaTentativa: agora, erro: null, online: true, carregando: false }
      gravarCache({ dados, lidoEm: agora })
    } catch (e) {
      const online = net.isOnline()
      const erro = traduzirErroPlanilha(e, online)
      registro.erro('Falha ao ler a planilha', e)
      // Mantém os últimos dados (modo sem conexão)
      this.estado = { ...this.estado, ultimaTentativa: agora, erro, online, carregando: false }
    }
    this.avisarPainel()
    return this.estado
  }

  async marcarPago(chave: string): Promise<EstadoPainel> {
    const conta = this.estado.dados?.contas.find((c) => c.chave === chave)
    if (!conta) throw new Error('Conta não encontrada. Atualize a tela e tente de novo.')
    const pagos = lerPagos()
    if (conta.fonte === 'Boletos') {
      // Aba da nuvem é só leitura: guardamos aqui e escondemos
      pagos.nuvem.push(conta.chave)
      gravarPagos(pagos)
    } else if (conta.fonte === 'Boletos_Outras_Contas') {
      pagos.outras.push(conta.idMensagem)
      gravarPagos(pagos)
      const planilha = await this.obterPlanilha()
      await planilha.removerPorChave('Boletos_Outras_Contas', 'id_mensagem', [conta.idMensagem])
    } else {
      const planilha = await this.obterPlanilha()
      // Confere que a linha ainda é a mesma antes de escrever
      const aba = await planilha.lerAba('Boletos_Manual')
      const linha = aba.linhas.find((l) => l.numero === conta.linhaPlanilha)
      const benef = Object.entries(linha?.dados ?? {}).find(([k]) => k.startsWith('beneficiario'))?.[1]?.trim()
      if (!linha || benef !== conta.beneficiario) throw new Error('A planilha mudou. Atualize a tela e tente de novo.')
      await planilha.atualizarCelula('Boletos_Manual', conta.linhaPlanilha, 'pago?', 'sim')
    }
    registro.info(`Conta marcada como paga (${conta.fonte})`)
    if (this.estado.dados) {
      this.estado = { ...this.estado, dados: { ...this.estado.dados, contas: this.estado.dados.contas.filter((c) => c.chave !== chave) } }
      this.avisarPainel()
    }
    return this.atualizarPainel()
  }

  async lancarBoleto(b: LancarBoleto): Promise<EstadoPainel> {
    const planilha = await this.obterPlanilha()
    await planilha.acrescentar('Boletos_Manual', {
      vencimento: b.vencimento,
      beneficiario: b.beneficiario,
      valor: b.valor ?? '',
      conta: b.conta,
      'pago?': 'não',
      observacao: b.observacao
    })
    registro.info('Boleto lançado à mão')
    return this.atualizarPainel()
  }

  // ---------------------------------------------------------------- contas de e-mail

  contasPublicas(): ContaEmailPublica[] {
    return lerContas().map((c) => ({ ...c, sincronizando: this.sincronizando.has(c.id) }))
  }

  statusSegredos(): StatusSegredos {
    const s = lerSegredos()
    let contaServico: string | null = null
    if (s.contaServico) {
      try {
        contaServico = validarChaveContaServico(s.contaServico).client_email
      } catch {
        contaServico = null
      }
    }
    return { contaServico, chaveIA: !!s.chaveIA, criptografiaDisponivel: criptografiaDisponivel() }
  }

  async testarConta(n: NovaConta): Promise<{ ok: boolean; erro?: string }> {
    const r = await testarConexao(n)
    return r.ok ? { ok: true } : { ok: false, erro: r.erro }
  }

  async adicionarConta(n: NovaConta): Promise<ContaEmailPublica[]> {
    const contas = lerContas()
    if (contas.some((c) => c.email === n.email)) throw new Error('Esta conta já foi adicionada.')
    const teste = await testarConexao(n)
    if (!teste.ok) throw new Error(teste.erro)
    const id = randomUUID()
    alterarSegredos((s) => {
      s.senhas[id] = n.senha
    })
    contas.push({
      id,
      tipo: n.tipo,
      email: n.email,
      apelido: n.apelido,
      servidor: n.servidor,
      porta: n.porta,
      contaBoleto: n.contaBoleto,
      pausada: false,
      soConferencia: n.soConferencia,
      ultimaSincronizacao: null,
      boletosAchados: 0,
      erro: null
    })
    gravarContas(contas)
    registro.info(`Conta de e-mail adicionada (${n.tipo})`)
    this.avisarContas()
    void this.sincronizar(id)
    return this.contasPublicas()
  }

  atualizarConta(id: string, mudancas: Partial<Pick<ContaArmazenada, 'pausada' | 'soConferencia' | 'apelido' | 'contaBoleto'>>): ContaEmailPublica[] {
    const contas = lerContas().map((c) => (c.id === id ? { ...c, ...mudancas } : c))
    gravarContas(contas)
    this.avisarContas()
    return this.contasPublicas()
  }

  removerConta(id: string): ContaEmailPublica[] {
    gravarContas(lerContas().filter((c) => c.id !== id))
    alterarSegredos((s) => {
      delete s.senhas[id]
    })
    const estados = lerEstadoSync()
    delete estados[id]
    gravarEstadoSync(estados)
    registro.info('Conta de e-mail removida')
    this.avisarContas()
    return this.contasPublicas()
  }

  /** Sincroniza uma conta (id) ou todas as ativas. Chamadas simultâneas são reaproveitadas. */
  async sincronizar(id?: string): Promise<ResultadoSync[]> {
    if (!id) {
      if (!this.sincronizacaoGeral) {
        this.sincronizacaoGeral = this.executarSync(undefined).finally(() => {
          this.sincronizacaoGeral = null
        })
      }
      return this.sincronizacaoGeral
    }
    if (this.sincronizacaoGeral) await this.sincronizacaoGeral.catch(() => undefined)
    return this.executarSync(id)
  }

  private async executarSync(id: string | undefined): Promise<ResultadoSync[]> {
    const todas = lerContas()
    const alvo = todas.filter((c) => (id ? c.id === id : !c.pausada)).filter((c) => !this.sincronizando.has(c.id))
    if (!alvo.length) return []
    const segredos = lerSegredos()
    const config = lerConfig()
    for (const c of alvo) this.sincronizando.add(c.id)
    this.avisarContas()
    const resultados: ResultadoSync[] = []
    try {
      const planilha = await this.obterPlanilha()
      const hoje = hojeISO()
      const pagos = lerPagos()
      const pagosOutras = new Set(pagos.outras)
      const panorama = await prepararPanorama(planilha, hoje, pagosOutras)
      const estados = lerEstadoSync()
      const ia =
        config.iaAtiva && segredos.chaveIA
          ? (texto: string) => extrairComIA(texto, { chave: segredos.chaveIA!, modelo: config.iaModelo })
          : null

      for (const conta of alvo) {
        const senha = segredos.senhas[conta.id]
        const estado = estados[conta.id] ?? estadoVazio()
        let r: ResultadoSync
        if (!senha) {
          r = { contaId: conta.id, novos: 0, ignorados: 0, semVencimento: 0, erro: 'Senha não encontrada. Remova e adicione a conta de novo.' }
        } else {
          const cfg: ConfigImap = { tipo: conta.tipo, email: conta.email, senha, servidor: conta.servidor, porta: conta.porta }
          try {
            r = await sincronizarConta(
              { id: conta.id, email: conta.email, apelido: conta.apelido, contaBoleto: conta.contaBoleto, soConferencia: conta.soConferencia },
              estado,
              panorama,
              {
                planilha,
                hoje,
                agora: Date.now(),
                pagosOutras,
                ia,
                buscar: (desde, ja, cb) => buscarCandidatas(cfg, { desde, jaProcessados: ja, aoEncontrar: cb }),
                aoNovoBoleto: (b) => this.aoNovoBoleto?.(b, conta.apelido),
                log: (m) => registro.info(m)
              }
            )
            estados[conta.id] = estado
          } catch (e) {
            registro.erro(`Falha na sincronização da conta ${conta.id.slice(0, 8)}`, e)
            r = { contaId: conta.id, novos: 0, ignorados: 0, semVencimento: 0, erro: mensagemErroImap(e) }
          }
        }
        registro.info(`Sync ${conta.id.slice(0, 8)}: ${r.novos} novos, ${r.ignorados} ignorados, ${r.semVencimento} sem vencimento`)
        resultados.push(r)
        const atuais = lerContas().map((c) =>
          c.id === conta.id
            ? {
                ...c,
                ultimaSincronizacao: r.erro ? c.ultimaSincronizacao : Date.now(),
                boletosAchados: c.boletosAchados + r.novos,
                erro: r.erro
              }
            : c
        )
        gravarContas(atuais)
      }
      gravarEstadoSync(estados)
    } catch (e) {
      // Falhou antes de começar (planilha/configuração)
      const erro = e instanceof Error ? e.message : 'Erro ao sincronizar'
      registro.erro('Sincronização não iniciou', e)
      gravarContas(lerContas().map((c) => (alvo.some((a) => a.id === c.id) ? { ...c, erro: traduzirErroPlanilha(e, net.isOnline()) || erro } : c)))
    } finally {
      for (const c of alvo) this.sincronizando.delete(c.id)
      this.avisarContas()
    }
    if (resultados.some((r) => r.novos > 0)) void this.atualizarPainel()
    return resultados
  }
}

export function traduzirErroPlanilha(e: unknown, online: boolean): string {
  if (!online) return 'Sem conexão com a internet.'
  const err = e as { code?: number | string; status?: number; message?: string }
  const status = Number(err.status ?? err.code)
  if (status === 403) return 'A conta de serviço não tem acesso à planilha. Compartilhe a planilha com o e-mail da conta de serviço como Editor.'
  if (status === 404) return 'Planilha não encontrada. Confira o ID em Configurações.'
  if (status === 429) return 'O Google pediu para esperar um pouco. Tento de novo em instantes.'
  if (err.message?.includes('Configure')) return err.message
  if (/invalid_grant|private key|DECODER/i.test(err.message ?? '')) return 'A chave da conta de serviço é inválida. Escolha o arquivo de novo.'
  return 'Não foi possível ler a planilha.'
}
