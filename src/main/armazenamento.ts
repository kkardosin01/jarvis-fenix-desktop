// Arquivos locais na pasta de dados do app. Segredos SEMPRE criptografados com safeStorage
// (DPAPI no Windows, Keychain no macOS). Nada disso vai para o repositório.

import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLANILHA_PADRAO } from '../shared/esquemas'
import type { Configuracoes, ContaPFPJ, DadosPainel, TipoContaEmail } from '../shared/types'
import { MODELO_IA_PADRAO } from './mail/ia'
import type { EstadoContaSync } from './mail/sync'
import type { PagosLocais } from './painel'

export function pastaDados(): string {
  return app.getPath('userData')
}

function caminho(nome: string): string {
  return join(pastaDados(), nome)
}

export function lerJson<T>(nome: string, padrao: T): T {
  try {
    const p = caminho(nome)
    if (!existsSync(p)) return padrao
    return { ...padrao, ...(JSON.parse(readFileSync(p, 'utf8')) as T) }
  } catch {
    return padrao
  }
}

/** Grava de forma atômica (arquivo temporário + rename), para não corromper se a luz cair. */
export function gravarJson(nome: string, dados: unknown): void {
  mkdirSync(pastaDados(), { recursive: true })
  const p = caminho(nome)
  const tmp = `${p}.tmp`
  writeFileSync(tmp, JSON.stringify(dados, null, 2), 'utf8')
  renameSync(tmp, p)
}

// ------------------------------------------------------------ configurações

export const CONFIG_PADRAO: Configuracoes = {
  planilhaId: PLANILHA_PADRAO,
  iniciarComWindows: true,
  manterTelaLigada: true,
  syncInicio: 6,
  syncFim: 23,
  notificacoes: true,
  tema: 'sistema',
  tamanhoFonte: 'grande',
  iaAtiva: false,
  iaModelo: MODELO_IA_PADRAO,
  nome: 'Tulio'
}

export function lerConfig(): Configuracoes {
  return lerJson('configuracoes.json', CONFIG_PADRAO)
}

export function gravarConfig(c: Configuracoes): void {
  gravarJson('configuracoes.json', c)
}

// ------------------------------------------------------------ segredos

export interface Segredos {
  contaServico?: string
  chaveIA?: string
  tokenAtualizacao?: string
  /** contaId → senha de app */
  senhas: Record<string, string>
}

const ARQ_SEGREDOS = 'segredos.bin'

export function criptografiaDisponivel(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function lerSegredos(): Segredos {
  const p = caminho(ARQ_SEGREDOS)
  if (!existsSync(p) || !criptografiaDisponivel()) return { senhas: {} }
  try {
    const json = safeStorage.decryptString(readFileSync(p))
    const s = JSON.parse(json) as Segredos
    return { ...s, senhas: s.senhas ?? {} }
  } catch {
    return { senhas: {} }
  }
}

export function gravarSegredos(s: Segredos): void {
  if (!criptografiaDisponivel()) {
    throw new Error('A criptografia do sistema não está disponível; não é seguro guardar senhas neste computador.')
  }
  mkdirSync(pastaDados(), { recursive: true })
  const p = caminho(ARQ_SEGREDOS)
  writeFileSync(`${p}.tmp`, safeStorage.encryptString(JSON.stringify(s)))
  renameSync(`${p}.tmp`, p)
}

export function alterarSegredos(f: (s: Segredos) => void): Segredos {
  const s = lerSegredos()
  f(s)
  gravarSegredos(s)
  return s
}

// ------------------------------------------------------------ contas de e-mail

export interface ContaArmazenada {
  id: string
  tipo: TipoContaEmail
  email: string
  apelido: string
  servidor: string
  porta: number
  contaBoleto: ContaPFPJ
  pausada: boolean
  soConferencia: boolean
  ultimaSincronizacao: number | null
  boletosAchados: number
  erro: string | null
}

export function lerContas(): ContaArmazenada[] {
  return lerJson<{ contas: ContaArmazenada[] }>('contas.json', { contas: [] }).contas
}

export function gravarContas(contas: ContaArmazenada[]): void {
  gravarJson('contas.json', { contas })
}

// ------------------------------------------------------------ estado de sincronização, pagos, cache

export function lerEstadoSync(): Record<string, EstadoContaSync> {
  return lerJson<Record<string, EstadoContaSync>>('sync-estado.json', {})
}

export function gravarEstadoSync(e: Record<string, EstadoContaSync>): void {
  gravarJson('sync-estado.json', e)
}

export function lerPagos(): PagosLocais {
  return lerJson<PagosLocais>('pagos.json', { nuvem: [], outras: [] })
}

export function gravarPagos(p: PagosLocais): void {
  // Mantém só os últimos 2.000 de cada para o arquivo não crescer para sempre
  gravarJson('pagos.json', { nuvem: p.nuvem.slice(-2000), outras: p.outras.slice(-2000) })
}

export interface CachePainel {
  dados: DadosPainel | null
  lidoEm: number | null
}

export function lerCache(): CachePainel {
  return lerJson<CachePainel>('cache-painel.json', { dados: null, lidoEm: null })
}

export function gravarCache(c: CachePainel): void {
  gravarJson('cache-painel.json', c)
}

export interface EstadoNotificacoes {
  bomDia: string | null
  bomDiaPendente: string | null
  lembrete14: string | null
}

export function lerEstadoNotificacoes(): EstadoNotificacoes {
  return lerJson<EstadoNotificacoes>('notificacoes.json', { bomDia: null, bomDiaPendente: null, lembrete14: null })
}

export function gravarEstadoNotificacoes(e: EstadoNotificacoes): void {
  gravarJson('notificacoes.json', e)
}
