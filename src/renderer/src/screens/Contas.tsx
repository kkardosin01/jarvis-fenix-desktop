import { CheckCircle2, ExternalLink, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatarLinhaDigitavel } from 'jarvis-fenix-core/boleto-codigo'
import { linkEmailDaConta } from 'jarvis-fenix-core/links'
import { formatarDiaMes, formatarMoeda, hojeISO, parseNumeroBR } from 'jarvis-fenix-core/ptbr'
import type { Conta } from 'jarvis-fenix-core/types'
import { BotaoCopiar } from '../components/whatsapp'
import { Botao, Campo, Chip, Erro, Esqueleto, Etiqueta, Modal, Painel, Vazio, classeEntrada, cx } from '../components/ui'
import { mensagemErro, useAcao, useJarvis } from '../lib/estado'

function rotuloOrigem(c: Conta): string {
  return c.origem || (c.fonte === 'Boletos' ? 'Gmail da empresa' : 'Planilha')
}

function LancarBoleto({ aoFechar }: { aoFechar: () => void }) {
  const { setPainel, mostrarAviso } = useJarvis()
  const [vencimento, setVencimento] = useState(hojeISO())
  const [beneficiario, setBeneficiario] = useState('')
  const [valor, setValor] = useState('')
  const [conta, setConta] = useState<'PJ' | 'PF'>('PJ')
  const [observacao, setObservacao] = useState('')
  const { executar, ocupado, erro } = useAcao(async () => {
    const v = valor.trim() ? parseNumeroBR(valor) : null
    if (valor.trim() && v === null) throw new Error('Valor inválido. Use o formato 1.234,56')
    setPainel(await window.jarvis.boletos.lancar({ vencimento, beneficiario, valor: v, conta, observacao }))
  })
  return (
    <Modal titulo="Lançar boleto" aoFechar={aoFechar}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void executar().then((ok) => {
            if (ok) {
              mostrarAviso('Boleto lançado na planilha')
              aoFechar()
            }
          })
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Vencimento">
            <input type="date" required className={classeEntrada} value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </Campo>
          <Campo rotulo="Valor (R$)" dica="Deixe vazio se não souber">
            <input inputMode="decimal" className={cx(classeEntrada, 'numeros')} placeholder="1.234,56" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Quem vai receber (beneficiário)">
          <input required className={classeEntrada} placeholder="Ex.: Celesc, Contador, Aluguel" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} />
        </Campo>
        <div className="flex flex-col gap-1.5">
          <span className="text-base font-semibold">Conta</span>
          <div className="flex gap-2">
            <Chip ativo={conta === 'PJ'} onClick={() => setConta('PJ')}>
              Empresa (PJ)
            </Chip>
            <Chip ativo={conta === 'PF'} onClick={() => setConta('PF')}>
              Pessoal (PF)
            </Chip>
          </div>
        </div>
        <Campo rotulo="Observação (opcional)">
          <input className={classeEntrada} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </Campo>
        {erro && <Erro texto={erro} />}
        <div className="flex justify-end gap-3 pt-2">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="primario" carregando={ocupado}>
            Lançar boleto
          </Botao>
        </div>
      </form>
    </Modal>
  )
}

function LinhaConta({ c }: { c: Conta }) {
  const { setPainel, mostrarAviso } = useJarvis()
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const link = linkEmailDaConta(c)
  const pagar = async (): Promise<void> => {
    setOcupado(true)
    try {
      setPainel(await window.jarvis.boletos.marcarPago(c.chave))
      mostrarAviso(`${c.beneficiario || 'Conta'} marcada como paga`)
    } catch (e) {
      mostrarAviso(mensagemErro(e))
    } finally {
      setOcupado(false)
      setConfirmando(false)
    }
  }
  return (
    <tr className={cx('border-b border-borda align-middle', c.situacao === 'Atrasado' && 'bg-perigo-suave/40')}>
      <td className="numeros px-4 py-3 text-lg font-bold whitespace-nowrap">{formatarDiaMes(c.vencimento)}</td>
      <td className="px-4 py-3">
        <p className="text-lg font-semibold">{c.beneficiario || 'Sem nome'}</p>
        <p className="text-sm text-suave">
          {rotuloOrigem(c)}
          {c.observacao ? ` · ${c.observacao}` : ''}
        </p>
        {!c.linhaDigitavel && !c.pix && c.comoPagar && (
          <p className="mt-0.5 line-clamp-2 text-sm text-suave" title={c.comoPagar}>
            {c.comoPagar}
          </p>
        )}
      </td>
      <td className="numeros px-4 py-3 text-right text-lg font-semibold whitespace-nowrap">
        {c.valor !== null ? formatarMoeda(c.valor) : <span className="text-base font-normal text-suave">Valor no PDF</span>}
      </td>
      <td className="px-4 py-3 text-center font-semibold">{c.conta || '—'}</td>
      <td className="px-4 py-3">
        <Etiqueta situacao={c.situacao} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-2">
          {c.linhaDigitavel && <BotaoCopiar texto={c.linhaDigitavel} rotulo="Copiar linha digitável" aviso={`Copiado: ${formatarLinhaDigitavel(c.linhaDigitavel).slice(0, 23)}…`} />}
          {c.pix && <BotaoCopiar texto={c.pix} rotulo="Copiar PIX" aviso="PIX copia-e-cola copiado" />}
          {link && (
            <Botao onClick={() => void window.jarvis.abrirExterno(link)} icone={<ExternalLink className="size-5" aria-hidden />}>
              Abrir e-mail
            </Botao>
          )}
          {confirmando ? (
            <>
              <Botao variante="primario" carregando={ocupado} onClick={() => void pagar()}>
                Sim, já paguei
              </Botao>
              <Botao variante="fantasma" onClick={() => setConfirmando(false)}>
                Não
              </Botao>
            </>
          ) : (
            <Botao onClick={() => setConfirmando(true)} icone={<CheckCircle2 className="size-5" aria-hidden />}>
              Marcar como pago
            </Botao>
          )}
        </div>
      </td>
    </tr>
  )
}

export function TelaContas() {
  const { painel, atualizar } = useJarvis()
  const [filtroConta, setFiltroConta] = useState<'todas' | 'PJ' | 'PF'>('todas')
  const [origem, setOrigem] = useState('todas')
  const [lancando, setLancando] = useState(false)
  const contas = useMemo(() => painel?.dados?.contas ?? [], [painel])
  const origens = useMemo(() => [...new Set(contas.map(rotuloOrigem))].sort(), [contas])
  const filtradas = contas.filter((c) => (filtroConta === 'todas' || c.conta === filtroConta) && (origem === 'todas' || rotuloOrigem(c) === origem))

  const totais = useMemo(() => {
    const porDia = new Map<string, number>()
    let pf = 0
    let pj = 0
    let semValor = 0
    for (const c of filtradas) {
      if (c.valor === null) {
        semValor++
        continue
      }
      const dia = c.vencimento ?? ''
      porDia.set(dia, (porDia.get(dia) ?? 0) + c.valor)
      if (c.conta === 'PF') pf += c.valor
      else if (c.conta === 'PJ') pj += c.valor
    }
    return { porDia: [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)), pf, pj, semValor }
  }, [filtradas])

  if (!painel) return <Esqueleto />
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl">Contas a pagar</h2>
        <Botao grande variante="primario" onClick={() => setLancando(true)} icone={<Plus className="size-6" aria-hidden />}>
          Lançar boleto
        </Botao>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip ativo={filtroConta === 'todas'} onClick={() => setFiltroConta('todas')}>
          Todas
        </Chip>
        <Chip ativo={filtroConta === 'PJ'} onClick={() => setFiltroConta('PJ')}>
          Empresa (PJ)
        </Chip>
        <Chip ativo={filtroConta === 'PF'} onClick={() => setFiltroConta('PF')}>
          Pessoal (PF)
        </Chip>
        <label className="ml-4 flex items-center gap-2 text-base text-suave">
          Origem
          <select className={cx(classeEntrada, 'min-h-10 w-auto py-0')} value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="todas">Todas</option>
            {origens.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      {painel.erro && !painel.dados && <Erro texto={painel.erro} aoTentar={() => void atualizar()} />}

      <Painel>
        {!painel.dados && painel.carregando ? (
          <Esqueleto />
        ) : filtradas.length === 0 ? (
          <Vazio texto={contas.length ? 'Nenhuma conta com esses filtros.' : 'Nenhuma conta a pagar por enquanto. Tudo em dia!'} />
        ) : (
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-24" />
              <col />
              <col className="w-40" />
              <col className="w-20" />
              <col className="w-44" />
              <col className="w-[30rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-borda text-left text-sm font-bold tracking-wide text-suave uppercase">
                <th className="px-4 py-3">Vence</th>
                <th className="px-4 py-3">Beneficiário</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Conta</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <LinhaConta key={c.chave} c={c} />
              ))}
            </tbody>
          </table>
        )}
        {filtradas.length > 0 && (
          <footer className="flex flex-wrap items-start justify-between gap-6 border-t border-borda bg-superficie-2 px-5 py-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {totais.porDia.map(([dia, v]) => (
                <span key={dia} className="numeros text-base">
                  <span className="text-suave">{formatarDiaMes(dia)}:</span> <strong>{formatarMoeda(v)}</strong>
                </span>
              ))}
            </div>
            <div className="numeros flex gap-6 text-lg">
              <span>
                PJ <strong>{formatarMoeda(totais.pj)}</strong>
              </span>
              <span>
                PF <strong>{formatarMoeda(totais.pf)}</strong>
              </span>
              {totais.semValor > 0 && <span className="text-base text-suave">+ {totais.semValor} com valor no PDF</span>}
            </div>
          </footer>
        )}
      </Painel>
      {lancando && <LancarBoleto aoFechar={() => setLancando(false)} />}
    </div>
  )
}
