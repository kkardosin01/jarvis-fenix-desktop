import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { InfoConfig } from '../../../preload/api'
import type { ContaEmailPublica, EstadoPainel, Tela } from '../../../shared/types'

interface Contexto {
  painel: EstadoPainel | null
  info: InfoConfig | null
  contas: ContaEmailPublica[]
  tela: Tela
  telaCheia: boolean
  irPara: (t: Tela) => void
  atualizar: () => Promise<void>
  recarregarInfo: () => Promise<void>
  setPainel: (p: EstadoPainel) => void
  setContas: (c: ContaEmailPublica[]) => void
  aviso: string | null
  mostrarAviso: (texto: string) => void
}

const Ctx = createContext<Contexto | null>(null)

/** Mensagem de erro amigável vinda do IPC ("Error invoking remote method ...: Error: X" → "X"). */
export function mensagemErro(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  const limpo = m.replace(/^Error invoking remote method '[^']+': /, '').replace(/^(Zod)?Error: /, '')
  if (limpo.startsWith('[')) {
    try {
      const lista = JSON.parse(limpo) as { message?: string }[]
      return lista.map((x) => x.message).filter(Boolean).join(' · ') || 'Dados inválidos'
    } catch {
      return 'Dados inválidos'
    }
  }
  return limpo
}

export function ProvedorEstado({ children }: { children: ReactNode }) {
  const [painel, setPainel] = useState<EstadoPainel | null>(null)
  const [info, setInfo] = useState<InfoConfig | null>(null)
  const [contas, setContas] = useState<ContaEmailPublica[]>([])
  const [tela, setTela] = useState<Tela>('hoje')
  const [telaCheia, setTelaCheia] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const recarregarInfo = useCallback(async () => {
    const i = await window.jarvis.config.obter()
    setInfo(i)
    setTelaCheia(i.telaCheia)
    document.documentElement.dataset.fonte = i.config.tamanhoFonte
  }, [])

  useEffect(() => {
    void window.jarvis.painel.estado().then(setPainel)
    void window.jarvis.contas.listar().then(setContas)
    void recarregarInfo()
    const fora = [
      window.jarvis.painel.aoMudar(setPainel),
      window.jarvis.contas.aoMudar(setContas),
      window.jarvis.aoNavegar(setTela),
      window.jarvis.aoTelaCheia(setTelaCheia)
    ]
    return () => fora.forEach((f) => f())
  }, [recarregarInfo])

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto)
    window.setTimeout(() => setAviso((a) => (a === texto ? null : a)), 3500)
  }, [])

  const valor = useMemo<Contexto>(
    () => ({
      painel,
      info,
      contas,
      tela,
      telaCheia,
      irPara: setTela,
      atualizar: async () => {
        setPainel(await window.jarvis.painel.atualizar())
      },
      recarregarInfo,
      setPainel,
      setContas,
      aviso,
      mostrarAviso
    }),
    [painel, info, contas, tela, telaCheia, recarregarInfo, aviso, mostrarAviso]
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useJarvis(): Contexto {
  const c = useContext(Ctx)
  if (!c) throw new Error('ProvedorEstado ausente')
  return c
}

/** Relógio que atualiza a cada 30 s (para "há X min" e saudação). */
export function useAgora(intervalo = 30_000): number {
  const [agora, setAgora] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), intervalo)
    return () => window.clearInterval(t)
  }, [intervalo])
  return agora
}

/** Executa uma ação mostrando "carregando" e erro amigável. */
export function useAcao<A extends unknown[]>(f: (...a: A) => Promise<unknown>) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const executar = useCallback(
    async (...a: A) => {
      setOcupado(true)
      setErro(null)
      try {
        await f(...a)
        return true
      } catch (e) {
        setErro(mensagemErro(e))
        return false
      } finally {
        setOcupado(false)
      }
    },
    [f]
  )
  return { executar, ocupado, erro, setErro }
}
