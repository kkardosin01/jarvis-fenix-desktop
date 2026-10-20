import { useState } from 'react'
import { BotaoCopiar, BotaoWhatsApp } from '../components/whatsapp'
import { Erro, Esqueleto, Painel, Vazio, cx } from '../components/ui'
import { useJarvis } from '../lib/estado'

export function TelaClientes() {
  const { painel, atualizar } = useJarvis()
  const [aberto, setAberto] = useState<string | null>(null)
  if (!painel) return <Esqueleto />
  const contatos = painel.dados?.contatos ?? []
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-2xl">Clientes para ligar</h2>
      {painel.erro && !painel.dados && <Erro texto={painel.erro} aoTentar={() => void atualizar()} />}
      <Painel>
        {contatos.length === 0 ? (
          <Vazio texto="Nenhum cliente na lista de hoje. A lista é atualizada todo dia às 8h40." />
        ) : (
          <ul className="divide-y divide-borda">
            {contatos.map((c) => {
              const expandido = aberto === c.cliente
              return (
                <li key={c.cliente} className="grid grid-cols-[minmax(14rem,1.1fr)_7rem_minmax(16rem,2fr)_auto] items-start gap-5 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">{c.cliente}</p>
                    <p className="text-base text-suave">{[c.contato, c.cidade].filter(Boolean).join(' · ')}</p>
                    <p className="numeros text-base text-suave">{c.telefone}</p>
                  </div>
                  <div className="text-center">
                    <p
                      className={cx(
                        'numeros text-3xl font-extrabold',
                        (c.diasSemComprar ?? 0) >= 60 ? 'text-perigo' : (c.diasSemComprar ?? 0) >= 30 ? 'text-alerta' : 'text-texto'
                      )}
                    >
                      {c.diasSemComprar ?? '—'}
                    </p>
                    <p className="text-sm text-suave">dias sem comprar</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base">{c.motivo}</p>
                    {c.mensagemSugerida && (
                      <button
                        type="button"
                        onClick={() => setAberto(expandido ? null : c.cliente)}
                        className={cx(
                          'mt-2 w-full cursor-pointer rounded-xl border border-borda bg-superficie-2 px-4 py-2 text-left text-base text-suave',
                          !expandido && 'line-clamp-2'
                        )}
                        title="Clique para ver a mensagem inteira"
                      >
                        “{c.mensagemSugerida}”
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <BotaoWhatsApp telefone={c.telefone} mensagem={c.mensagemSugerida} />
                    {c.mensagemSugerida && <BotaoCopiar texto={c.mensagemSugerida} rotulo="Copiar mensagem" aviso="Mensagem copiada" />}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Painel>
    </div>
  )
}
