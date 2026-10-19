// Log em arquivo rotativo (1 MB, guarda o anterior). Só metadados e erros: NUNCA conteúdo de e-mail.

import log from 'electron-log/main'
import { join } from 'node:path'
import { pastaDados } from './armazenamento'

let iniciado = false

export function iniciarLog(): void {
  if (iniciado) return
  iniciado = true
  log.transports.file.resolvePathFn = () => join(pastaLogs(), 'jarvis.log')
  log.transports.file.maxSize = 1024 * 1024
  log.transports.file.level = 'info'
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : false
  log.errorHandler.startCatching({ showDialog: false })
}

export function pastaLogs(): string {
  return join(pastaDados(), 'logs')
}

/** Remove e-mails e números longos (linha digitável, telefone) antes de gravar. */
export function higienizar(texto: string): string {
  return texto
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>')
    .replace(/\d[\d.\s-]{9,}\d/g, '<número>')
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, '<chave>')
}

export const registro = {
  info: (m: string): void => log.info(higienizar(m)),
  aviso: (m: string): void => log.warn(higienizar(m)),
  erro: (m: string, e?: unknown): void => {
    const detalhe = e instanceof Error ? `${e.name}: ${e.message}` : e ? String(e) : ''
    log.error(higienizar(detalhe ? `${m} — ${detalhe}` : m))
  }
}
