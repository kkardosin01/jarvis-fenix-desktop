// Tipos compartilhados entre processo principal, preload e interface.

export type Linha = Record<string, string>

export type ContaPFPJ = 'PF' | 'PJ'

export type Situacao = 'Atrasado' | 'Vence hoje' | 'Próximos dias' | 'Futuro' | 'Vencido há mais de 30 dias'

export type FonteBoleto = 'Boletos' | 'Boletos_Outras_Contas' | 'Boletos_Manual'

/** Boleto unificado das três abas, já convertido. */
export interface Conta {
  /** Identificador estável para a interface e para "marcar como pago". */
  chave: string
  fonte: FonteBoleto
  vencimento: string | null
  beneficiario: string
  valor: number | null
  conta: ContaPFPJ | ''
  origem: string
  situacao: Situacao | null
  comoPagar: string
  observacao: string
  contaEmail: string
  idMensagem: string
  linhaDigitavel: string | null
  pix: string | null
  /** Número da linha na planilha (1 = cabeçalho). */
  linhaPlanilha: number
}

export interface Prioridade {
  ordem: number
  prioridade: string
  porQue: string
}

export interface EmailResumo {
  recebidoEm: string
  remetente: string
  assunto: string
  resumo: string
  categoria: string
  acao: string
  urgencia: string
}

export interface Contato {
  cliente: string
  cidade: string
  contato: string
  telefone: string
  ultimaCompra: string
  diasSemComprar: number | null
  motivo: string
  mensagemSugerida: string
}

export interface Prospect {
  data: string
  empresa: string
  segmento: string
  cidade: string
  email: string
  situacao: string
  proximoPasso: string
  dataProximoPasso: string
}

export interface Resumo {
  atualizadoEm: string
  atualizadoEmISO: string | null
  fraseDoDia: string
  emailsRelevantes: number | null
  boletosHoje: number | null
  boletosAtrasados: number | null
  boletosValorConhecido: number | null
  contatosHoje: number | null
  rascunhosProspeccao: number | null
  detalhes: Record<string, string>
}

export interface DadosPainel {
  resumo: Resumo
  prioridades: Prioridade[]
  emails: EmailResumo[]
  contas: Conta[]
  contatos: Contato[]
  prospects: Prospect[]
}

export interface EstadoPainel {
  dados: DadosPainel | null
  /** Quando os dados exibidos foram lidos da planilha (ms). */
  lidoEm: number | null
  ultimaTentativa: number | null
  erro: string | null
  online: boolean
  carregando: boolean
  configurado: boolean
}

export type TipoContaEmail = 'gmail' | 'outlook' | 'outro'

export interface ContaEmailPublica {
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
  sincronizando: boolean
}

export type Tema = 'sistema' | 'claro' | 'escuro'
export type TamanhoFonte = 'normal' | 'grande' | 'muito-grande'

export interface Configuracoes {
  planilhaId: string
  iniciarComWindows: boolean
  manterTelaLigada: boolean
  syncInicio: number
  syncFim: number
  notificacoes: boolean
  tema: Tema
  tamanhoFonte: TamanhoFonte
  iaAtiva: boolean
  iaModelo: string
  nome: string
}

export interface StatusSegredos {
  contaServico: string | null
  chaveIA: boolean
  criptografiaDisponivel: boolean
}

export type Tela = 'hoje' | 'contas' | 'clientes' | 'emails' | 'prospeccao' | 'configuracoes'

export interface ResultadoSync {
  contaId: string
  novos: number
  ignorados: number
  semVencimento: number
  erro: string | null
}
