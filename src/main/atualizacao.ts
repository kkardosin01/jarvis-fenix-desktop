// Atualização automática via GitHub Releases (electron-updater).
// Repositório privado: o token (somente leitura) é configurado em Configurações e fica criptografado.

import { app } from 'electron'

interface Registro {
  info: (m: string) => void
  erro: (m: string, e?: unknown) => void
}

const SEIS_HORAS = 6 * 3_600_000

export function configurarAtualizacao(token: () => string | undefined, registro: Registro): void {
  if (!app.isPackaged) return
  void (async () => {
    const { autoUpdater } = await import('electron-updater')
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = null
    autoUpdater.on('update-downloaded', (i) => registro.info(`Atualização ${i.version} baixada; instala ao reiniciar`))
    autoUpdater.on('error', (e) => registro.erro('Falha ao verificar atualização', e))
    const verificar = (): void => {
      const t = token()
      if (t) {
        // O provedor de repositório privado lê o token desta variável (só na memória do processo)
        process.env.GH_TOKEN = t
        autoUpdater.requestHeaders = { Authorization: `token ${t}` }
      }
      autoUpdater.checkForUpdatesAndNotify().catch((e: unknown) => registro.erro('Falha ao verificar atualização', e))
    }
    setTimeout(verificar, 60_000)
    setInterval(verificar, SEIS_HORAS)
  })()
}
