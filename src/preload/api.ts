// Contrato da API exposta em window.jarvis.

import type { LancarBoleto, NovaConta } from '../shared/esquemas'
import type {
  Configuracoes,
  ContaEmailPublica,
  ContaPFPJ,
  EstadoPainel,
  ResultadoSync,
  StatusSegredos,
  Tela
} from 'jarvis-fenix-core/types'

export interface InfoConfig {
  config: Configuracoes
  segredos: StatusSegredos
  versao: string
  pastaDados: string
  telaCheia: boolean
}

export interface JarvisApi {
  painel: {
    estado(): Promise<EstadoPainel>
    atualizar(): Promise<EstadoPainel>
    aoMudar(f: (e: EstadoPainel) => void): () => void
  }
  config: {
    obter(): Promise<InfoConfig>
    salvar(c: Partial<Configuracoes>): Promise<Configuracoes>
    escolherContaServico(): Promise<StatusSegredos>
    salvarChaveIA(chave: string | null): Promise<StatusSegredos>
    salvarTokenAtualizacao(token: string): Promise<boolean>
  }
  contas: {
    listar(): Promise<ContaEmailPublica[]>
    testar(d: NovaConta): Promise<{ ok: boolean; erro?: string }>
    adicionar(d: NovaConta): Promise<ContaEmailPublica[]>
    atualizar(
      id: string,
      d: { pausada?: boolean; soConferencia?: boolean; apelido?: string; contaBoleto?: ContaPFPJ }
    ): Promise<ContaEmailPublica[]>
    remover(id: string): Promise<ContaEmailPublica[]>
    sincronizar(id?: string): Promise<ResultadoSync[]>
    aoMudar(f: (c: ContaEmailPublica[]) => void): () => void
  }
  boletos: {
    marcarPago(chave: string): Promise<EstadoPainel>
    lancar(b: LancarBoleto): Promise<EstadoPainel>
  }
  abrirExterno(url: string): Promise<void>
  abrirWhatsApp(telefone: string, mensagem: string, web?: boolean): Promise<'app' | 'web'>
  copiar(texto: string): Promise<boolean>
  abrirLogs(): Promise<string>
  alternarTelaCheia(): Promise<boolean>
  aoNavegar(f: (t: Tela) => void): () => void
  aoTelaCheia(f: (v: boolean) => void): () => void
}
