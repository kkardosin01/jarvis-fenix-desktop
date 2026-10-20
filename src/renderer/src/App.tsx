import { CalendarCheck, Maximize2, Minimize2, Phone, RefreshCw, Receipt, Mail, Settings, Target, WifiOff, Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { dataPorExtenso, horaMinuto, saudacao, tempoDesde } from 'jarvis-fenix-core/ptbr'
import type { Tela } from 'jarvis-fenix-core/types'
import { Botao, cx } from './components/ui'
import { useAgora, useJarvis } from './lib/estado'
import { TelaClientes } from './screens/Clientes'
import { TelaConfiguracoes } from './screens/Configuracoes'
import { TelaContas } from './screens/Contas'
import { TelaEmails } from './screens/Emails'
import { TelaHoje } from './screens/Hoje'
import { TelaProspeccao } from './screens/Prospeccao'

const MENU: { tela: Tela; rotulo: string; icone: ReactNode }[] = [
  { tela: 'hoje', rotulo: 'Hoje', icone: <CalendarCheck className="size-6" aria-hidden /> },
  { tela: 'contas', rotulo: 'Contas a pagar', icone: <Receipt className="size-6" aria-hidden /> },
  { tela: 'clientes', rotulo: 'Clientes', icone: <Phone className="size-6" aria-hidden /> },
  { tela: 'emails', rotulo: 'E-mails', icone: <Mail className="size-6" aria-hidden /> },
  { tela: 'prospeccao', rotulo: 'Prospecção', icone: <Target className="size-6" aria-hidden /> },
  { tela: 'configuracoes', rotulo: 'Configurações', icone: <Settings className="size-6" aria-hidden /> }
]

function Marca() {
  return (
    <div className="flex items-center gap-3 px-3 pb-6">
      <div className="relative flex size-11 items-center justify-center rounded-xl bg-marca text-2xl font-black text-white dark:text-fundo">
        F
        <span className="absolute bottom-1.5 left-2.5 right-2.5 h-1 rounded bg-amber-500" />
      </div>
      <div>
        <p className="text-lg font-extrabold leading-tight">Jarvis Fênix</p>
        <p className="text-sm text-suave">Comercial Fênix</p>
      </div>
    </div>
  )
}

function Avisos() {
  const { painel, atualizar } = useJarvis()
  const agora = useAgora()
  if (!painel) return null
  if (!painel.online && painel.lidoEm) {
    return (
      <div role="status" className="flex items-center gap-3 border-b border-alerta/40 bg-alerta-suave px-8 py-2.5 text-alerta">
        <WifiOff className="size-5" aria-hidden />
        <span className="font-semibold">Sem conexão — mostrando dados de {horaMinuto(painel.lidoEm)}</span>
      </div>
    )
  }
  const semAtualizar = painel.lidoEm && agora - painel.lidoEm > 30 * 60_000
  if (painel.erro && painel.configurado && (semAtualizar || !painel.dados)) {
    return (
      <div role="status" className="flex items-center gap-3 border-b border-alerta/40 bg-alerta-suave px-8 py-2.5 text-alerta">
        <Clock className="size-5" aria-hidden />
        <span className="flex-1 font-semibold">
          {painel.lidoEm ? `Não consigo atualizar há ${tempoDesde(painel.lidoEm, agora).replace('há ', '')}. ` : ''}
          {painel.erro}
        </span>
        <button type="button" className="cursor-pointer font-bold underline" onClick={() => void atualizar()}>
          Tentar de novo
        </button>
      </div>
    )
  }
  return null
}

function Topo() {
  const { painel, info, atualizar, telaCheia } = useJarvis()
  const agora = useAgora()
  const nome = info?.config.nome ?? 'Tulio'
  return (
    <header className="flex items-center justify-between gap-6 border-b border-borda bg-superficie px-8 py-4">
      <div>
        <h1 className="text-2xl font-bold">
          {saudacao(new Date(agora))}, {nome}
        </h1>
        <p className="text-base text-suave first-letter:uppercase">{dataPorExtenso(new Date(agora))}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="numeros text-base text-suave" aria-live="polite">
          {painel?.carregando ? 'Atualizando…' : painel?.lidoEm ? `Atualizado ${tempoDesde(painel.lidoEm, agora)}` : 'Ainda não atualizado'}
        </span>
        <Botao
          onClick={() => void atualizar()}
          carregando={painel?.carregando}
          icone={<RefreshCw className="size-5" aria-hidden />}
          variante="primario"
        >
          Atualizar
        </Botao>
        <Botao
          variante="fantasma"
          onClick={() => void window.jarvis.alternarTelaCheia()}
          aria-label={telaCheia ? 'Sair da tela cheia (F11)' : 'Tela cheia (F11)'}
          title={telaCheia ? 'Sair da tela cheia (F11)' : 'Tela cheia (F11)'}
          icone={telaCheia ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
        />
      </div>
    </header>
  )
}

export function App() {
  const { tela, irPara, aviso } = useJarvis()
  return (
    <div className="flex h-screen">
      <nav aria-label="Menu principal" className="flex w-64 shrink-0 flex-col border-r border-borda bg-superficie px-3 py-6">
        <Marca />
        <ul className="flex flex-col gap-1">
          {MENU.map((m) => (
            <li key={m.tela}>
              <button
                type="button"
                onClick={() => irPara(m.tela)}
                aria-current={tela === m.tela ? 'page' : undefined}
                className={cx(
                  'flex min-h-13 w-full cursor-pointer items-center gap-3 rounded-xl px-4 text-left text-lg font-semibold transition-colors',
                  tela === m.tela ? 'bg-marca-suave text-marca-forte' : 'text-suave hover:bg-superficie-2 hover:text-texto'
                )}
              >
                {m.icone}
                {m.rotulo}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topo />
        <Avisos />
        <main className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          {tela === 'hoje' && <TelaHoje />}
          {tela === 'contas' && <TelaContas />}
          {tela === 'clientes' && <TelaClientes />}
          {tela === 'emails' && <TelaEmails />}
          {tela === 'prospeccao' && <TelaProspeccao />}
          {tela === 'configuracoes' && <TelaConfiguracoes />}
        </main>
      </div>
      {aviso && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-texto px-6 py-3 text-lg font-semibold text-fundo shadow-xl">
          {aviso}
        </div>
      )}
    </div>
  )
}
