// Processo principal do Jarvis Fênix.

import {
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  app,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  nativeTheme,
  powerSaveBlocker,
  session,
  shell
} from 'electron'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  esquemaAtualizarConta,
  esquemaChaveConta,
  esquemaChaveIA,
  esquemaConfigParcial,
  esquemaId,
  esquemaLancarBoleto,
  esquemaNovaConta,
  esquemaTexto,
  esquemaWhatsApp,
  urlExternaPermitida
} from '../shared/esquemas'
import { agoraSP, formatarDiaMes, formatarMoeda } from 'jarvis-fenix-core/ptbr'
import { linksWhatsApp } from 'jarvis-fenix-core/whatsapp'
import type { Configuracoes, ResultadoSync, Tela } from 'jarvis-fenix-core/types'
import {
  alterarSegredos,
  gravarConfig,
  gravarEstadoNotificacoes,
  lerConfig,
  lerEstadoNotificacoes,
  lerSegredos
} from './armazenamento'
import { iniciarLog, pastaLogs, registro } from './log'
import { avisosDevidos, dentroDoHorarioSync, horarioSilencioso } from './regras-notificacao'
import { Servico } from './servico'
import { validarChaveContaServico } from './sheets'
import { configurarAtualizacao } from './atualizacao'

const E2E = process.env.JARVIS_E2E === '1'
if (process.env.JARVIS_USER_DATA) app.setPath('userData', process.env.JARVIS_USER_DATA)

const INTERVALO_PLANILHA = 5 * 60_000
const INTERVALO_EMAIL = 15 * 60_000

let janela: BrowserWindow | null = null
let bandeja: Tray | null = null
let saindo = false
let bloqueioTela: number | null = null
let servico: Servico
let ultimaLeitura = 0
let ultimaSyncEmail = 0

function recurso(nome: string): string {
  return app.isPackaged ? join(process.resourcesPath, 'resources', nome) : join(__dirname, '../../resources', nome)
}

function enviar(canal: string, ...args: unknown[]): void {
  if (janela && !janela.isDestroyed()) janela.webContents.send(canal, ...args)
}

function mostrarJanela(tela?: Tela): void {
  if (!janela) return
  if (janela.isMinimized()) janela.restore()
  janela.show()
  janela.focus()
  if (tela) enviar('navegar', tela)
}

function aplicarTema(c: Configuracoes): void {
  nativeTheme.themeSource = c.tema === 'claro' ? 'light' : c.tema === 'escuro' ? 'dark' : 'system'
}

function aplicarTelaLigada(c: Configuracoes): void {
  if (c.manterTelaLigada && bloqueioTela === null) bloqueioTela = powerSaveBlocker.start('prevent-display-sleep')
  if (!c.manterTelaLigada && bloqueioTela !== null) {
    powerSaveBlocker.stop(bloqueioTela)
    bloqueioTela = null
  }
}

function aplicarInicioComSistema(c: Configuracoes): void {
  // Em desenvolvimento não registramos o executável do Electron no login
  if (!app.isPackaged || E2E) return
  // Ao ligar o PC, abre direto na central de comando em tela cheia
  app.setLoginItemSettings({ openAtLogin: c.iniciarComWindows, args: ['--tela-cheia'] })
}

function notificar(titulo: string, corpo: string, tela: Tela): void {
  const c = lerConfig()
  if (!c.notificacoes || E2E || !Notification.isSupported()) return
  if (horarioSilencioso(agoraSP().hora)) return
  const n = new Notification({ title: titulo, body: corpo, icon: recurso('icon.png') })
  n.on('click', () => mostrarJanela(tela))
  n.show()
}

function alternarTelaCheia(forcar?: boolean): void {
  if (!janela) return
  const valor = forcar ?? !janela.isFullScreen()
  janela.setFullScreen(valor)
}

function criarJanela(): void {
  janela = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    title: 'Jarvis Fênix',
    icon: recurso('icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b1416' : '#f4f7f7',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })
  janela.setMenu(null)

  janela.once('ready-to-show', () => {
    if (!process.argv.includes('--oculto')) janela?.show()
    if (process.argv.includes('--tela-cheia')) alternarTelaCheia(true)
  })

  // Fechar só esconde: o app continua na bandeja
  janela.on('close', (e) => {
    if (!saindo) {
      e.preventDefault()
      janela?.hide()
    }
  })

  janela.on('focus', () => {
    // Relê a planilha ao ganhar foco (no máximo a cada 1 min)
    if (Date.now() - ultimaLeitura > 60_000) void lerPlanilha()
  })

  janela.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      e.preventDefault()
      alternarTelaCheia()
    }
    if (input.type === 'keyDown' && input.key === 'Escape' && janela?.isFullScreen()) alternarTelaCheia(false)
  })
  janela.on('enter-full-screen', () => enviar('tela-cheia', true))
  janela.on('leave-full-screen', () => enviar('tela-cheia', false))

  // Nenhuma navegação nem janela nova dentro do app
  janela.webContents.on('will-navigate', (e) => e.preventDefault())
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (urlExternaPermitida(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void janela.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void janela.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function criarBandeja(): void {
  const icone = nativeImage.createFromPath(recurso('tray.png'))
  const retina = nativeImage.createFromPath(recurso('tray@2x.png'))
  if (!retina.isEmpty()) icone.addRepresentation({ scaleFactor: 2, buffer: retina.toPNG() })
  bandeja = new Tray(icone)
  bandeja.setToolTip('Jarvis Fênix')
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir', click: () => mostrarJanela() },
      { label: 'Atualizar agora', click: () => void lerPlanilha() },
      { label: 'Sincronizar e-mails agora', click: () => void sincronizarEmails() },
      {
        label: 'Modo tela cheia',
        click: () => {
          mostrarJanela()
          alternarTelaCheia()
        }
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          saindo = true
          app.quit()
        }
      }
    ])
  )
  bandeja.on('click', () => mostrarJanela())
  bandeja.on('double-click', () => mostrarJanela())
}

async function lerPlanilha(): Promise<void> {
  ultimaLeitura = Date.now()
  await servico.atualizarPainel()
}

async function sincronizarEmails(): Promise<ResultadoSync[]> {
  ultimaSyncEmail = Date.now()
  return servico.sincronizar()
}

function verificarAvisos(): void {
  const estado = lerEstadoNotificacoes()
  const antes = JSON.stringify(estado)
  const c = lerConfig()
  const avisos = avisosDevidos(new Date(), estado, servico.estadoPainel().dados, c.nome)
  if (JSON.stringify(estado) !== antes) gravarEstadoNotificacoes(estado)
  for (const a of avisos) notificar(a.titulo, a.corpo, a.tela)
}

function iniciarAgendador(): void {
  setInterval(() => {
    const agora = Date.now()
    if (agora - ultimaLeitura >= INTERVALO_PLANILHA) void lerPlanilha()
    const c = lerConfig()
    if (agora - ultimaSyncEmail >= INTERVALO_EMAIL && dentroDoHorarioSync(new Date(), c.syncInicio, c.syncFim)) {
      void sincronizarEmails()
    }
    verificarAvisos()
  }, 30_000)
}

// ---------------------------------------------------------------- IPC

function registrarIpc(): void {
  const tratar = <T>(canal: string, f: (...args: unknown[]) => Promise<T> | T): void => {
    ipcMain.handle(canal, async (evento, ...args) => {
      // Só aceita chamadas da nossa própria janela
      if (!janela || evento.sender.id !== janela.webContents.id) throw new Error('Origem não autorizada')
      return f(...args)
    })
  }

  tratar('painel:estado', () => servico.estadoPainel())
  tratar('painel:atualizar', () => lerPlanilha().then(() => servico.estadoPainel()))

  tratar('config:obter', () => ({
    config: lerConfig(),
    segredos: servico.statusSegredos(),
    versao: app.getVersion(),
    pastaDados: app.getPath('userData'),
    telaCheia: janela?.isFullScreen() ?? false
  }))
  tratar('config:salvar', (dados) => {
    const parcial = esquemaConfigParcial.parse(dados)
    const nova = { ...lerConfig(), ...parcial }
    if (nova.syncFim <= nova.syncInicio) throw new Error('O horário final precisa ser depois do inicial.')
    gravarConfig(nova)
    aplicarTema(nova)
    aplicarTelaLigada(nova)
    aplicarInicioComSistema(nova)
    if (parcial.planilhaId) void lerPlanilha()
    return nova
  })

  tratar('segredos:escolherContaServico', async () => {
    const r = await dialog.showOpenDialog(janela!, {
      title: 'Escolha o arquivo JSON da conta de serviço do Google',
      filters: [{ name: 'Chave JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (r.canceled || !r.filePaths[0]) return servico.statusSegredos()
    if (statSync(r.filePaths[0]).size > 100_000) throw new Error('Arquivo grande demais para ser uma chave.')
    const json = readFileSync(r.filePaths[0], 'utf8')
    validarChaveContaServico(json)
    alterarSegredos((s) => {
      s.contaServico = json
    })
    registro.info('Chave da conta de serviço configurada')
    void lerPlanilha()
    return servico.statusSegredos()
  })
  tratar('segredos:chaveIA', (chave) => {
    const valor = esquemaChaveIA.parse(chave)
    alterarSegredos((s) => {
      if (valor) s.chaveIA = valor
      else delete s.chaveIA
    })
    return servico.statusSegredos()
  })
  tratar('segredos:tokenAtualizacao', (token) => {
    const valor = esquemaTexto.parse(token).trim()
    alterarSegredos((s) => {
      if (valor) s.tokenAtualizacao = valor
      else delete s.tokenAtualizacao
    })
    return true
  })

  tratar('contas:listar', () => servico.contasPublicas())
  tratar('contas:testar', (dados) => servico.testarConta(esquemaNovaConta.parse(dados)))
  tratar('contas:adicionar', (dados) => servico.adicionarConta(esquemaNovaConta.parse(dados)))
  tratar('contas:atualizar', (id, dados) => servico.atualizarConta(esquemaId.parse(id), esquemaAtualizarConta.parse(dados)))
  tratar('contas:remover', (id) => servico.removerConta(esquemaId.parse(id)))
  tratar('contas:sincronizar', (id) => (id === undefined ? sincronizarEmails() : servico.sincronizar(esquemaId.parse(id))))

  tratar('boleto:marcarPago', (chave) => servico.marcarPago(esquemaChaveConta.parse(chave)))
  tratar('boleto:lancar', (dados) => servico.lancarBoleto(esquemaLancarBoleto.parse(dados)))

  tratar('abrir:externo', async (url) => {
    const u = esquemaTexto.parse(url)
    if (!urlExternaPermitida(u)) throw new Error('Endereço não permitido')
    await shell.openExternal(u)
  })
  tratar('abrir:whatsapp', async (dados) => {
    const { telefone, mensagem, web } = esquemaWhatsApp.parse(dados)
    const links = linksWhatsApp(telefone, mensagem)
    if (!links) throw new Error('Telefone inválido')
    if (!web) {
      try {
        await shell.openExternal(links.app)
        return 'app'
      } catch {
        // WhatsApp Desktop não instalado: abre no navegador
      }
    }
    await shell.openExternal(links.web)
    return 'web'
  })
  tratar('copiar', (texto) => {
    clipboard.writeText(esquemaTexto.parse(texto))
    return true
  })
  tratar('app:abrirLogs', () => shell.openPath(pastaLogs()))
  tratar('janela:telaCheia', () => {
    alternarTelaCheia()
    return janela?.isFullScreen() ?? false
  })
}

// ---------------------------------------------------------------- início

if (!app.requestSingleInstanceLock() && !E2E) {
  app.quit()
} else {
  app.on('second-instance', () => mostrarJanela())

  app.whenReady().then(() => {
    app.setAppUserModelId('br.com.comercialfenix.jarvis')
    iniciarLog()
    registro.info(`Jarvis Fênix ${app.getVersion()} iniciado`)

    // Renderer não pede câmera, microfone, localização etc.
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
    session.defaultSession.webRequest.onHeadersReceived((d, cb) => {
      cb({
        responseHeaders: {
          ...d.responseHeaders,
          'Content-Security-Policy': [
            app.isPackaged
              ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
              : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws:; object-src 'none'"
          ]
        }
      })
    })

    const c = lerConfig()
    aplicarTema(c)
    aplicarTelaLigada(c)
    aplicarInicioComSistema(c)

    servico = new Servico()
    servico.aoMudarPainel(() => enviar('painel:mudou', servico.estadoPainel()))
    servico.aoMudarContas(() => enviar('contas:mudou', servico.contasPublicas()))
    servico.aoNovoBoleto = (b, apelido) => {
      const valor = b.valor !== null ? ` — ${formatarMoeda(b.valor)}` : ''
      notificar(`Novo boleto (${apelido})`, `Novo boleto: ${b.beneficiario} — vence ${formatarDiaMes(b.vencimento)}${valor}`, 'contas')
    }

    registrarIpc()
    criarJanela()
    if (!E2E) criarBandeja()

    void lerPlanilha()
    // Primeira sincronização de e-mails um pouco depois de abrir
    if (!E2E) {
      setTimeout(() => {
        const cfg = lerConfig()
        if (dentroDoHorarioSync(new Date(), cfg.syncInicio, cfg.syncFim)) void sincronizarEmails()
      }, 20_000)
      iniciarAgendador()
      configurarAtualizacao(() => lerSegredos().tokenAtualizacao, registro)
    }
  })

  app.on('before-quit', () => {
    saindo = true
  })
  app.on('window-all-closed', () => {
    // Continua rodando na bandeja
  })
  app.on('activate', () => mostrarJanela())
}
