// Extração opcional com a API da Anthropic (desligada por padrão).
// Envia SÓ o texto do e-mail/PDF candidato, nunca a caixa inteira.

import { z } from 'zod'
import { validarLinhaDigitavel, validarPix } from '../../shared/boleto-codigo'
import { parseDataBR } from '../../shared/ptbr'
import type { BoletoExtraido } from './extrair'

export const MODELO_IA_PADRAO = 'claude-haiku-5-5'

/** Limite de texto enviado por e-mail (boletos cabem com folga; evita custo com anexos enormes). */
const MAX_CARACTERES = 30_000

export const RespostaIA = z.object({
  vencimento: z.string().nullable().describe('Data de vencimento no formato AAAA-MM-DD, ou null'),
  valor: z.number().nullable().describe('Valor a pagar em reais, ou null'),
  beneficiario: z.string().nullable().describe('Quem recebe o pagamento (empresa emissora)'),
  linha_digitavel: z.string().nullable().describe('Linha digitável só com dígitos, ou null'),
  pix: z.string().nullable().describe('Código PIX copia-e-cola completo, ou null'),
  e_conta_a_pagar: z
    .boolean()
    .describe('true só se for uma cobrança que o destinatário ainda precisa pagar')
})
export type RespostaIA = z.infer<typeof RespostaIA>

const INSTRUCOES = `Você lê e-mails e PDFs de cobrança recebidos por uma pessoa no Brasil e extrai os dados do boleto.
Responda com os campos pedidos. Use null quando o dado não estiver no texto; não invente.
e_conta_a_pagar = false para comprovantes de pagamento, notas fiscais sem cobrança, propaganda
e boletos emitidos pela Comercial Fênix para os clientes dela.`

/** Confere a resposta da IA com as mesmas regras determinísticas (DV, CRC, data). */
export function validarRespostaIA(r: RespostaIA, hoje: string, comoPagarPadrao: string): BoletoExtraido | null {
  if (!r.e_conta_a_pagar) return null
  const linha = r.linha_digitavel ? validarLinhaDigitavel(r.linha_digitavel, hoje) : null
  const pix = r.pix && validarPix(r.pix.replace(/\s+/g, '')) ? r.pix.replace(/\s+/g, '') : null
  const vencimento = (r.vencimento && parseDataBR(r.vencimento)) || linha?.vencimento || null
  const valor = r.valor !== null && r.valor > 0 && r.valor < 1_000_000 ? Math.round(r.valor * 100) / 100 : (linha?.valor ?? null)
  return {
    vencimento,
    valor,
    beneficiario: (r.beneficiario ?? '').trim().slice(0, 80),
    linhaDigitavel: linha?.linha ?? null,
    pix,
    comoPagar: linha?.linha ?? pix ?? comoPagarPadrao
  }
}

export async function extrairComIA(
  texto: string,
  opcoes: { chave: string; modelo: string }
): Promise<RespostaIA | null> {
  const [{ default: Anthropic }, { zodOutputFormat }] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('@anthropic-ai/sdk/helpers/zod')
  ])
  const cliente = new Anthropic({ apiKey: opcoes.chave, maxRetries: 2, timeout: 60_000 })
  const resposta = await cliente.messages.parse({
    model: opcoes.modelo || MODELO_IA_PADRAO,
    max_tokens: 2000,
    system: INSTRUCOES,
    output_config: { effort: 'low', format: zodOutputFormat(RespostaIA) },
    messages: [{ role: 'user', content: texto.slice(0, MAX_CARACTERES) }]
  })
  if (resposta.stop_reason === 'refusal') return null
  const saida = resposta.parsed_output
  if (!saida) return null
  // Validação extra com zod (defesa em profundidade)
  const ok = RespostaIA.safeParse(saida)
  return ok.success ? ok.data : null
}
