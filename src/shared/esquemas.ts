// Validação (zod) de tudo que chega do renderer pelo IPC.

import { z } from 'zod'

export const PLANILHA_PADRAO = '1krSssMZcSLsD7mmCOOGQp_foJMEJqhAS2t4ExjHZAVE'

export const esquemaConfiguracoes = z.object({
  planilhaId: z.string().regex(/^[A-Za-z0-9_-]{20,80}$/, 'ID de planilha inválido'),
  iniciarComWindows: z.boolean(),
  manterTelaLigada: z.boolean(),
  syncInicio: z.number().int().min(0).max(23),
  syncFim: z.number().int().min(1).max(24),
  notificacoes: z.boolean(),
  tema: z.enum(['sistema', 'claro', 'escuro']),
  tamanhoFonte: z.enum(['normal', 'grande', 'muito-grande']),
  iaAtiva: z.boolean(),
  iaModelo: z.string().regex(/^[a-z0-9.-]{3,60}$/, 'Nome de modelo inválido'),
  nome: z.string().min(1).max(40)
})

export const esquemaConfigParcial = esquemaConfiguracoes.partial()

export const esquemaNovaConta = z
  .object({
    tipo: z.enum(['gmail', 'outlook', 'outro']),
    email: z.string().trim().toLowerCase().email('E-mail inválido'),
    senha: z.string().min(4, 'Informe a senha de app').max(200),
    servidor: z.string().trim().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Servidor inválido'),
    porta: z.number().int().min(1).max(65535),
    apelido: z.string().trim().min(1, 'Dê um apelido para a conta').max(40),
    contaBoleto: z.enum(['PF', 'PJ']),
    soConferencia: z.boolean().default(false)
  })
  .strict()
export type NovaConta = z.infer<typeof esquemaNovaConta>

export const esquemaAtualizarConta = z
  .object({
    pausada: z.boolean().optional(),
    soConferencia: z.boolean().optional(),
    apelido: z.string().trim().min(1).max(40).optional(),
    contaBoleto: z.enum(['PF', 'PJ']).optional()
  })
  .strict()

export const esquemaId = z.string().regex(/^[a-z0-9-]{6,64}$/)

export const esquemaChaveConta = z.string().min(3).max(600)

export const esquemaLancarBoleto = z
  .object({
    vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    beneficiario: z.string().trim().min(2, 'Informe quem vai receber').max(80),
    valor: z.number().positive().max(10_000_000).nullable(),
    conta: z.enum(['PF', 'PJ']),
    observacao: z.string().trim().max(200).default('')
  })
  .strict()
export type LancarBoleto = z.infer<typeof esquemaLancarBoleto>

export const esquemaTexto = z.string().max(5000)

export const esquemaWhatsApp = z.object({ telefone: z.string().max(40), mensagem: z.string().max(4000), web: z.boolean().default(false) })

export const esquemaChaveIA = z.string().trim().regex(/^sk-ant-[A-Za-z0-9_-]{10,300}$/, 'Chave da Anthropic inválida').nullable()

export const esquemaTela = z.enum(['hoje', 'contas', 'clientes', 'emails', 'prospeccao', 'configuracoes'])

/** Destinos externos permitidos (o renderer não abre qualquer URL). */
export function urlExternaPermitida(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol === 'whatsapp:') return true
    if (u.protocol !== 'https:') return false
    return [
      'mail.google.com',
      'outlook.live.com',
      'outlook.office.com',
      'wa.me',
      'myaccount.google.com',
      'account.live.com',
      'account.microsoft.com',
      'support.google.com',
      'console.cloud.google.com',
      'console.anthropic.com',
      'docs.google.com'
    ].includes(u.hostname)
  } catch {
    return false
  }
}
