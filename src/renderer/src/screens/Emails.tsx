import { ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GMAIL_EMPRESA } from 'jarvis-fenix-core/links'
import { normalizarTexto } from 'jarvis-fenix-core/ptbr'
import { Botao, Chip, Erro, Esqueleto, Painel, Vazio, cx } from '../components/ui'
import { useJarvis } from '../lib/estado'

function peso(urgencia: string): number {
  const u = normalizarTexto(urgencia)
  if (/alta|urgente/.test(u)) return 0
  if (/media/.test(u)) return 1
  return 2
}

function corUrgencia(urgencia: string): string {
  const p = peso(urgencia)
  if (p === 0) return 'bg-perigo-suave text-perigo border-perigo/40'
  if (p === 1) return 'bg-alerta-suave text-alerta border-alerta/40'
  return 'bg-superficie-2 text-suave border-borda'
}

export function TelaEmails() {
  const { painel, atualizar } = useJarvis()
  const [categoria, setCategoria] = useState('todas')
  const emails = useMemo(() => [...(painel?.dados?.emails ?? [])].sort((a, b) => peso(a.urgencia) - peso(b.urgencia)), [painel])
  const categorias = useMemo(() => [...new Set(emails.map((e) => e.categoria).filter(Boolean))].sort(), [emails])
  if (!painel) return <Esqueleto />
  const filtrados = emails.filter((e) => categoria === 'todas' || e.categoria === categoria)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl">E-mails importantes</h2>
        <Botao grande variante="primario" onClick={() => void window.jarvis.abrirExterno(GMAIL_EMPRESA)} icone={<ExternalLink className="size-5" aria-hidden />}>
          Abrir Gmail da empresa
        </Botao>
      </div>
      {categorias.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Chip ativo={categoria === 'todas'} onClick={() => setCategoria('todas')}>
            Todas
          </Chip>
          {categorias.map((c) => (
            <Chip key={c} ativo={categoria === c} onClick={() => setCategoria(c)}>
              {c}
            </Chip>
          ))}
        </div>
      )}
      {painel.erro && !painel.dados && <Erro texto={painel.erro} aoTentar={() => void atualizar()} />}
      {filtrados.length === 0 ? (
        <Painel>
          <Vazio texto="Nenhum e-mail importante por aqui. A caixa está tranquila." />
        </Painel>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtrados.map((e, i) => (
            <Painel key={i} className="gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-suave">
                    {e.remetente} · {e.recebidoEm}
                  </p>
                  <h3 className="mt-1 text-lg leading-snug font-bold">{e.assunto}</h3>
                </div>
                {e.urgencia && <span className={cx('shrink-0 rounded-full border px-3 py-0.5 text-sm font-bold', corUrgencia(e.urgencia))}>{e.urgencia}</span>}
              </div>
              <p className="text-base">{e.resumo}</p>
              {e.acao && (
                <p className="rounded-xl bg-marca-suave px-4 py-2.5 text-base font-semibold text-marca-forte">
                  <span className="font-bold">O que fazer:</span> {e.acao}
                </p>
              )}
              {e.categoria && <p className="text-sm text-suave">{e.categoria}</p>}
            </Painel>
          ))}
        </div>
      )}
    </div>
  )
}
