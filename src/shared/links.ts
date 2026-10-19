// Links para abrir o e-mail certo no navegador.

import type { Conta } from './types'

export const EMAIL_EMPRESA = 'fenix.hospitalares@gmail.com'
export const GMAIL_EMPRESA = `https://mail.google.com/mail/u/?authuser=${EMAIL_EMPRESA}`
export const RASCUNHOS_EMPRESA = `https://mail.google.com/mail/u/?authuser=${EMAIL_EMPRESA}#drafts`

function eGmail(email: string): boolean {
  return /@(gmail|googlemail)\.com$/i.test(email)
}

function eOutlook(email: string): boolean {
  return /@(outlook|hotmail|live|msn)\.[a-z.]+$/i.test(email)
}

/** Link para o e-mail de origem da conta, quando dá para saber. */
export function linkEmailDaConta(c: Pick<Conta, 'fonte' | 'contaEmail' | 'idMensagem' | 'beneficiario'>): string | null {
  if (c.fonte === 'Boletos') {
    // Veio do Gmail da empresa (briefing da nuvem): busca pelo beneficiário
    const termo = c.beneficiario.split(/[–—-]/)[0]!.trim()
    return termo ? `${GMAIL_EMPRESA}#search/${encodeURIComponent(termo)}` : GMAIL_EMPRESA
  }
  if (c.fonte !== 'Boletos_Outras_Contas' || !c.contaEmail) return null
  if (eGmail(c.contaEmail)) {
    const id = c.idMensagem.split('#')[0]!.replace(/^<|>$/g, '')
    const base = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(c.contaEmail)}`
    return id ? `${base}#search/${encodeURIComponent(`rfc822msgid:${id}`)}` : base
  }
  if (eOutlook(c.contaEmail)) return 'https://outlook.live.com/mail/0/'
  return null
}
