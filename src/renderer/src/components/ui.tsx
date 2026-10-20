import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, RefreshCw, X } from 'lucide-react'
import type { Situacao } from 'jarvis-fenix-core/types'

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ')
}

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'

export function Botao({
  variante = 'secundario',
  grande,
  carregando,
  icone,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  grande?: boolean
  carregando?: boolean
  icone?: ReactNode
}) {
  const estilos: Record<Variante, string> = {
    primario: 'bg-marca text-white hover:bg-marca-forte dark:text-fundo border-transparent',
    secundario: 'bg-superficie text-texto border-borda hover:bg-superficie-2',
    perigo: 'bg-superficie text-perigo border-perigo/50 hover:bg-perigo-suave',
    fantasma: 'bg-transparent text-texto border-transparent hover:bg-superficie-2'
  }
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || carregando}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer select-none whitespace-nowrap',
        grande ? 'min-h-14 px-6 text-lg' : 'min-h-11 px-4 text-base',
        estilos[variante],
        className
      )}
    >
      {carregando ? <Loader2 className="size-5 animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  )
}

export function Painel({ titulo, acao, children, className }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('flex min-h-0 flex-col rounded-2xl border border-borda bg-superficie', className)}>
      {titulo && (
        <header className="flex items-center justify-between gap-3 border-b border-borda px-5 py-3.5">
          <h2 className="text-lg font-bold">{titulo}</h2>
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}

const CORES_SITUACAO: Record<string, string> = {
  Atrasado: 'bg-perigo-suave text-perigo border-perigo/40',
  'Vence hoje': 'bg-alerta-suave text-alerta border-alerta/40',
  'Próximos dias': 'bg-info-suave text-info border-info/30',
  Futuro: 'bg-superficie-2 text-suave border-borda',
  'Vencido há mais de 30 dias': 'bg-perigo-suave text-perigo border-perigo/40'
}

export function Etiqueta({ situacao }: { situacao: Situacao | null }) {
  if (!situacao) return <span className="text-suave">—</span>
  return (
    <span className={cx('inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-bold whitespace-nowrap', CORES_SITUACAO[situacao])}>
      {situacao === 'Vencido há mais de 30 dias' ? 'Vencido +30 dias' : situacao}
    </span>
  )
}

export function Chip({ ativo, children, onClick }: { ativo: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cx(
        'min-h-10 cursor-pointer rounded-full border px-4 text-base font-semibold transition-colors',
        ativo ? 'border-marca bg-marca-suave text-marca-forte' : 'border-borda bg-superficie text-suave hover:bg-superficie-2'
      )}
    >
      {children}
    </button>
  )
}

export function Vazio({ texto, icone }: { texto: string; icone?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-suave">
      {icone ?? <Inbox className="size-10 opacity-60" aria-hidden />}
      <p className="max-w-md text-lg">{texto}</p>
    </div>
  )
}

export function Erro({ texto, aoTentar }: { texto: string; aoTentar?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-4 rounded-xl border border-perigo/40 bg-perigo-suave px-5 py-4 text-perigo">
      <AlertTriangle className="size-6 shrink-0" aria-hidden />
      <p className="flex-1 text-base font-semibold">{texto}</p>
      {aoTentar && (
        <Botao onClick={aoTentar} icone={<RefreshCw className="size-5" aria-hidden />}>
          Tentar de novo
        </Botao>
      )}
    </div>
  )
}

export function Esqueleto({ linhas = 4, altura = 'h-12' }: { linhas?: number; altura?: string }) {
  return (
    <div className="flex flex-col gap-3 p-5" aria-label="Carregando" aria-busy>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={cx('esqueleto', altura)} />
      ))}
    </div>
  )
}

export function Modal({ titulo, aoFechar, children, largura = 'max-w-2xl' }: { titulo: string; aoFechar: () => void; children: ReactNode; largura?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" role="dialog" aria-modal aria-label={titulo}>
      <div className={cx('flex max-h-[92vh] w-full flex-col rounded-2xl border border-borda bg-superficie shadow-2xl', largura)}>
        <header className="flex items-center justify-between border-b border-borda px-6 py-4">
          <h2 className="text-xl font-bold">{titulo}</h2>
          <Botao variante="fantasma" onClick={aoFechar} aria-label="Fechar" icone={<X className="size-6" aria-hidden />} />
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-semibold">{rotulo}</span>
      {children}
      {dica && <span className="text-sm text-suave">{dica}</span>}
    </label>
  )
}

export const classeEntrada =
  'min-h-12 w-full rounded-xl border border-borda bg-fundo px-4 text-base text-texto placeholder:text-suave/70 focus:border-marca'

export function Interruptor({ ligado, aoMudar, rotulo, dica }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string; dica?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div>
        <p className="text-base font-semibold">{rotulo}</p>
        {dica && <p className="text-sm text-suave">{dica}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={rotulo}
        onClick={() => aoMudar(!ligado)}
        className={cx(
          'relative h-8 w-14 shrink-0 cursor-pointer rounded-full border transition-colors',
          ligado ? 'border-marca bg-marca' : 'border-borda bg-superficie-2'
        )}
      >
        <span className={cx('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', ligado ? 'left-7' : 'left-0.5')} />
      </button>
    </div>
  )
}
