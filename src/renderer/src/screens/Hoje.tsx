import { AlertTriangle, CalendarClock, FileText, Mail, Phone, Settings, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatarDiaMes, formatarMoeda } from 'jarvis-fenix-core/ptbr'
import type { Tela } from 'jarvis-fenix-core/types'
import { BotaoWhatsApp } from '../components/whatsapp'
import { Botao, Erro, Esqueleto, Etiqueta, Painel, Vazio, cx } from '../components/ui'
import { useJarvis } from '../lib/estado'

function Cartao({
  rotulo,
  valor,
  detalhe,
  icone,
  tom,
  tela
}: {
  rotulo: string
  valor: number | null
  detalhe?: string
  icone: ReactNode
  tom: 'perigo' | 'alerta' | 'marca' | 'neutro'
  tela: Tela
}) {
  const { irPara } = useJarvis()
  const destaque = (valor ?? 0) > 0
  const cores = {
    perigo: 'text-perigo',
    alerta: 'text-alerta',
    marca: 'text-marca',
    neutro: 'text-texto'
  }
  return (
    <button
      type="button"
      onClick={() => irPara(tela)}
      className={cx(
        'flex cursor-pointer flex-col justify-between gap-2 rounded-2xl border bg-superficie p-5 text-left transition-colors hover:bg-superficie-2',
        destaque && tom === 'perigo' ? 'border-perigo/50' : destaque && tom === 'alerta' ? 'border-alerta/50' : 'border-borda'
      )}
    >
      <span className="flex min-h-[3.2rem] items-start gap-2 text-lg leading-tight font-semibold text-suave">
        <span className="mt-0.5 shrink-0">{icone}</span>
        {rotulo}
      </span>
      <span className={cx('numeros text-[3.25rem] leading-none font-extrabold', destaque ? cores[tom] : 'text-texto')}>{valor ?? '—'}</span>
      <span className="min-h-5 text-sm text-suave">{detalhe ?? ''}</span>
    </button>
  )
}

function Configurar() {
  const { irPara } = useJarvis()
  return (
    <Painel className="mx-auto mt-10 max-w-2xl p-10 text-center">
      <Settings className="mx-auto size-14 text-marca" aria-hidden />
      <h2 className="mt-4 text-2xl">Vamos conectar o Jarvis à planilha</h2>
      <p className="mt-2 text-lg text-suave">
        Escolha a chave da conta de serviço do Google em Configurações. É só uma vez; depois o painel se atualiza sozinho.
      </p>
      <Botao grande variante="primario" className="mt-6" onClick={() => irPara('configuracoes')}>
        Abrir Configurações
      </Botao>
    </Painel>
  )
}

export function TelaHoje() {
  const { painel, atualizar, irPara } = useJarvis()
  if (!painel) return <Esqueleto linhas={6} altura="h-24" />
  if (!painel.configurado && !painel.dados) return <Configurar />
  if (!painel.dados) {
    return painel.carregando ? <Esqueleto linhas={6} altura="h-24" /> : <Erro texto={painel.erro ?? 'Sem dados ainda.'} aoTentar={() => void atualizar()} />
  }
  const d = painel.dados
  const hoje = d.contas.filter((c) => c.situacao === 'Vence hoje')
  const atrasados = d.contas.filter((c) => c.situacao === 'Atrasado')
  const somaHoje = hoje.reduce((s, c) => s + (c.valor ?? 0), 0)
  const importantes = d.emails.filter((e) => /alta|urgente/i.test(e.urgencia)).length
  const proximas = d.contas.slice(0, 6)

  return (
    <div className="flex h-full min-h-[44rem] flex-col gap-5">
      <section className="flex items-start gap-4 rounded-2xl bg-marca px-7 py-5 text-white dark:text-fundo">
        <Sparkles className="mt-1 size-7 shrink-0" aria-hidden />
        <p className="text-[1.45rem] leading-snug font-semibold">{d.resumo.fraseDoDia || 'Bom trabalho hoje!'}</p>
      </section>

      <div className="grid grid-cols-5 gap-4">
        <Cartao
          rotulo="Vencem hoje"
          valor={hoje.length}
          detalhe={somaHoje > 0 ? `${formatarMoeda(somaHoje)} com valor conhecido` : undefined}
          icone={<CalendarClock className="size-5" aria-hidden />}
          tom="alerta"
          tela="contas"
        />
        <Cartao
          rotulo="Atrasados"
          valor={atrasados.length}
          detalhe={atrasados.length ? 'Confira se já foram pagos' : 'Nada atrasado'}
          icone={<AlertTriangle className="size-5" aria-hidden />}
          tom="perigo"
          tela="contas"
        />
        <Cartao
          rotulo="Clientes para ligar"
          valor={d.contatos.length}
          detalhe={d.contatos[0] ? `Comece por ${d.contatos[0].cliente}` : undefined}
          icone={<Phone className="size-5" aria-hidden />}
          tom="marca"
          tela="clientes"
        />
        <Cartao
          rotulo="E-mails importantes"
          valor={d.resumo.emailsRelevantes ?? d.emails.length}
          detalhe={importantes ? `${importantes} com urgência alta` : 'Sem propaganda'}
          icone={<Mail className="size-5" aria-hidden />}
          tom="neutro"
          tela="emails"
        />
        <Cartao
          rotulo="Rascunhos de prospecção"
          valor={d.resumo.rascunhosProspeccao}
          detalhe={d.resumo.detalhes.rascunhos_prospeccao || 'Revise e envie no Gmail'}
          icone={<FileText className="size-5" aria-hidden />}
          tom="neutro"
          tela="prospeccao"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
        <Painel titulo="Prioridades do dia">
          {d.prioridades.length === 0 ? (
            <Vazio texto="Sem prioridades na planilha hoje." />
          ) : (
            <ol className="flex flex-col gap-1 overflow-hidden p-3">
              {d.prioridades.slice(0, 3).map((p, i) => (
                <li key={i} className="flex gap-4 rounded-xl p-3">
                  <span className="numeros flex size-10 shrink-0 items-center justify-center rounded-full bg-marca-suave text-xl font-extrabold text-marca-forte">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg leading-snug font-semibold">{p.prioridade}</p>
                    {p.porQue && <p className="mt-1 line-clamp-3 text-base text-suave">{p.porQue}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Painel>

        <Painel
          titulo="Próximas contas"
          acao={
            <button type="button" className="cursor-pointer text-base font-semibold text-marca underline" onClick={() => irPara('contas')}>
              Ver todas
            </button>
          }
        >
          {proximas.length === 0 ? (
            <Vazio texto="Nenhuma conta a pagar nos próximos dias. 🎉" />
          ) : (
            <ul className="flex flex-col divide-y divide-borda overflow-hidden">
              {proximas.map((c) => (
                <li key={c.chave} className="flex items-center gap-3 px-5 py-3">
                  <span className="numeros w-14 shrink-0 text-lg font-bold">{formatarDiaMes(c.vencimento)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold" title={c.beneficiario}>
                      {c.beneficiario || 'Sem nome'}
                    </p>
                    <p className="numeros text-base text-suave">
                      {c.valor !== null ? formatarMoeda(c.valor) : 'Valor no PDF'} · {c.conta || '—'}
                    </p>
                  </div>
                  <Etiqueta situacao={c.situacao} />
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel
          titulo="Ligar hoje"
          acao={
            <button type="button" className="cursor-pointer text-base font-semibold text-marca underline" onClick={() => irPara('clientes')}>
              Ver todos
            </button>
          }
        >
          {d.contatos.length === 0 ? (
            <Vazio texto="Nenhum cliente na fila de ligações hoje." />
          ) : (
            <ul className="flex flex-col divide-y divide-borda overflow-hidden">
              {d.contatos.slice(0, 5).map((c) => (
                <li key={c.cliente} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{c.cliente}</p>
                    <p className="truncate text-base text-suave">
                      {[c.contato, c.diasSemComprar !== null ? `${c.diasSemComprar} dias sem comprar` : ''].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <BotaoWhatsApp telefone={c.telefone} mensagem={c.mensagemSugerida} compacto />
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>
    </div>
  )
}
