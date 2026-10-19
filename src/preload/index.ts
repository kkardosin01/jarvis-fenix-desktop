// Ponte segura entre a interface e o processo principal. Nada de Node no renderer.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { JarvisApi } from './api'

function ouvir<T>(canal: string, f: (v: T) => void): () => void {
  const h = (_e: IpcRendererEvent, v: T): void => f(v)
  ipcRenderer.on(canal, h)
  return () => ipcRenderer.removeListener(canal, h)
}

const api: JarvisApi = {
  painel: {
    estado: () => ipcRenderer.invoke('painel:estado'),
    atualizar: () => ipcRenderer.invoke('painel:atualizar'),
    aoMudar: (f) => ouvir('painel:mudou', f)
  },
  config: {
    obter: () => ipcRenderer.invoke('config:obter'),
    salvar: (c) => ipcRenderer.invoke('config:salvar', c),
    escolherContaServico: () => ipcRenderer.invoke('segredos:escolherContaServico'),
    salvarChaveIA: (chave) => ipcRenderer.invoke('segredos:chaveIA', chave),
    salvarTokenAtualizacao: (t) => ipcRenderer.invoke('segredos:tokenAtualizacao', t)
  },
  contas: {
    listar: () => ipcRenderer.invoke('contas:listar'),
    testar: (d) => ipcRenderer.invoke('contas:testar', d),
    adicionar: (d) => ipcRenderer.invoke('contas:adicionar', d),
    atualizar: (id, d) => ipcRenderer.invoke('contas:atualizar', id, d),
    remover: (id) => ipcRenderer.invoke('contas:remover', id),
    sincronizar: (id) => ipcRenderer.invoke('contas:sincronizar', id),
    aoMudar: (f) => ouvir('contas:mudou', f)
  },
  boletos: {
    marcarPago: (chave) => ipcRenderer.invoke('boleto:marcarPago', chave),
    lancar: (b) => ipcRenderer.invoke('boleto:lancar', b)
  },
  abrirExterno: (url) => ipcRenderer.invoke('abrir:externo', url),
  abrirWhatsApp: (telefone, mensagem, web) => ipcRenderer.invoke('abrir:whatsapp', { telefone, mensagem, web: !!web }),
  copiar: (texto) => ipcRenderer.invoke('copiar', texto),
  abrirLogs: () => ipcRenderer.invoke('app:abrirLogs'),
  alternarTelaCheia: () => ipcRenderer.invoke('janela:telaCheia'),
  aoNavegar: (f) => ouvir('navegar', f),
  aoTelaCheia: (f) => ouvir('tela-cheia', f)
}

contextBridge.exposeInMainWorld('jarvis', api)
