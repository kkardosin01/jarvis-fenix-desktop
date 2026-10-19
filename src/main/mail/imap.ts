// Leitura IMAP SOMENTE LEITURA: caixa aberta com EXAMINE (readOnly), download com BODY.PEEK.
// Nunca envia, apaga, move nem marca e-mails como lidos.

import type { TipoContaEmail } from '../../shared/types'
import { normalizarTexto } from '../../shared/ptbr'
import { PALAVRAS_CHAVE, type AnexoTexto, type MensagemCandidata } from './extrair'
import { textoDoPdf } from './pdf'

export interface ConfigImap {
  tipo: TipoContaEmail
  email: string
  senha: string
  servidor: string
  porta: number
}

export const PROVEDORES: Record<Exclude<TipoContaEmail, 'outro'>, { servidor: string; porta: number }> = {
  gmail: { servidor: 'imap.gmail.com', porta: 993 },
  outlook: { servidor: 'outlook.office365.com', porta: 993 }
}

const TAMANHO_MAXIMO = 20 * 1024 * 1024
const MAX_MENSAGENS_POR_CAIXA = 400

async function conectar(cfg: ConfigImap) {
  const { ImapFlow } = await import('imapflow')
  const cliente = new ImapFlow({
    host: cfg.servidor,
    port: cfg.porta,
    secure: cfg.porta === 993,
    auth: { user: cfg.email, pass: cfg.senha },
    logger: false,
    // Não queremos que o servidor registre o app como "cliente de e-mail" ativo
    disableAutoIdle: true,
    connectionTimeout: 30_000,
    greetingTimeout: 20_000,
    socketTimeout: 120_000
  })
  await cliente.connect()
  return cliente
}

/** Traduz erros comuns de IMAP para algo que o Tulio entenda. */
export function mensagemErroImap(e: unknown): string {
  const err = e as { authenticationFailed?: boolean; responseText?: string; code?: string; message?: string }
  const texto = `${err.responseText ?? ''} ${err.message ?? ''}`
  if (err.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed|authentication failed/i.test(texto)) {
    return 'E-mail ou senha de app incorretos. Gere uma nova senha de app e tente de novo.'
  }
  if (/Application-specific password required|WEBALERT|Web login required/i.test(texto)) {
    return 'Este e-mail exige uma senha de app (veja as instruções ao lado).'
  }
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') return 'Sem internet ou servidor não encontrado.'
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') return 'O servidor de e-mail não respondeu. Confira servidor e porta.'
  if (/IMAP.*disabled|IMAP access/i.test(texto)) return 'O acesso IMAP está desligado nesta conta.'
  return 'Não foi possível conectar ao e-mail.'
}

export async function testarConexao(cfg: ConfigImap): Promise<{ ok: true; caixas: number } | { ok: false; erro: string }> {
  try {
    const cliente = await conectar(cfg)
    try {
      const caixas = await cliente.list()
      return { ok: true, caixas: caixas.length }
    } finally {
      await cliente.logout().catch(() => undefined)
    }
  } catch (e) {
    return { ok: false, erro: mensagemErroImap(e) }
  }
}

function dataGmail(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export function consultaGmail(desde: Date): string {
  const termos = PALAVRAS_CHAVE.map((p) => (p.includes(' ') ? `"${p}"` : p))
  return `after:${dataGmail(desde)} -in:sent -in:drafts -in:chats (${termos.join(' OR ')} OR filename:pdf)`
}

function htmlParaTexto(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
}

/** Converte o e-mail cru (RFC 822) em MensagemCandidata, lendo os PDFs anexos. */
export async function analisarMensagem(fonte: Buffer, messageIdReserva: string): Promise<MensagemCandidata> {
  const { simpleParser } = await import('mailparser')
  const m = await simpleParser(fonte, { skipImageLinks: true, skipTextToHtml: true })
  const de = m.from?.value?.[0]
  const anexos: AnexoTexto[] = []
  for (const a of m.attachments ?? []) {
    const ePdf = a.contentType === 'application/pdf' || /\.pdf$/i.test(a.filename ?? '')
    if (!ePdf || a.size > TAMANHO_MAXIMO) continue
    const pdf = await textoDoPdf(a.content)
    anexos.push({ nome: a.filename ?? 'anexo.pdf', texto: pdf.texto, ilegivel: pdf.ilegivel })
  }
  const texto = m.text?.trim() ? m.text : typeof m.html === 'string' ? htmlParaTexto(m.html) : ''
  return {
    messageId: (m.messageId ?? messageIdReserva).trim(),
    deEmail: (de?.address ?? '').toLowerCase(),
    deNome: de?.name ?? '',
    assunto: m.subject ?? '',
    data: m.date ?? new Date(),
    texto,
    anexos
  }
}

export interface OpcoesBusca {
  desde: Date
  /** Message-IDs já processados: não baixamos de novo. */
  jaProcessados: Set<string>
  aoEncontrar: (msg: MensagemCandidata) => Promise<void>
}

/** Busca e entrega, uma a uma, as mensagens candidatas da conta. */
export async function buscarCandidatas(cfg: ConfigImap, opcoes: OpcoesBusca): Promise<{ lidas: number }> {
  const cliente = await conectar(cfg)
  const vistos = new Set<string>()
  let lidas = 0
  try {
    const caixas = ['INBOX']
    if (cfg.tipo === 'gmail') {
      // "[Gmail]/Todos os e-mails" (o nome muda com o idioma; usamos a marca \All)
      const lista = await cliente.list()
      const todos = lista.find((c) => c.specialUse === '\\All')
      if (todos) caixas.push(todos.path)
    }
    for (const caixa of caixas) {
      const trava = await cliente.getMailboxLock(caixa, { readOnly: true })
      try {
        const consulta =
          cfg.tipo === 'gmail'
            ? { gmailraw: consultaGmail(opcoes.desde) }
            : {
                since: opcoes.desde,
                or: PALAVRAS_CHAVE.flatMap((p) => [{ subject: p }, { body: p }])
              }
        const uids = (await cliente.search(consulta, { uid: true })) || []
        const recentes = uids.slice(-MAX_MENSAGENS_POR_CAIXA)
        if (!recentes.length) continue

        // 1ª passada: só envelope e tamanho, para pular o que já vimos
        const baixar: number[] = []
        for await (const msg of cliente.fetch(recentes, { envelope: true, size: true }, { uid: true })) {
          const id = msg.envelope?.messageId?.trim() ?? `uid:${caixa}:${msg.uid}`
          if (vistos.has(id) || opcoes.jaProcessados.has(id)) continue
          vistos.add(id)
          if ((msg.size ?? 0) > TAMANHO_MAXIMO) continue
          const remetente = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? ''
          if (remetente === cfg.email.toLowerCase()) continue
          baixar.push(msg.uid)
        }

        // 2ª passada: conteúdo completo (BODY.PEEK, não marca como lido)
        for (const uid of baixar) {
          const msg = await cliente.fetchOne(String(uid), { source: true, envelope: true }, { uid: true })
          if (!msg || !msg.source) continue
          const reserva = msg.envelope?.messageId ?? `uid:${caixa}:${uid}`
          const candidata = await analisarMensagem(msg.source, reserva)
          lidas++
          await opcoes.aoEncontrar(candidata)
        }
      } finally {
        trava.release()
      }
    }
  } finally {
    await cliente.logout().catch(() => undefined)
  }
  return { lidas }
}

/** E-mail é da conta da empresa (já lida pelo briefing da nuvem)? */
export function eContaDaEmpresa(email: string): boolean {
  return normalizarTexto(email) === normalizarTexto('fenix.hospitalares@gmail.com')
}
