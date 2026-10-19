import { ExternalLink, Info } from 'lucide-react'
import { RASCUNHOS_EMPRESA } from '../../../shared/links'
import { Botao, Erro, Esqueleto, Painel, Vazio } from '../components/ui'
import { useJarvis } from '../lib/estado'

export function TelaProspeccao() {
  const { painel, atualizar } = useJarvis()
  if (!painel) return <Esqueleto />
  const prospects = painel.dados?.prospects ?? []
  const rascunhos = painel.dados?.resumo.rascunhosProspeccao
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Prospecção</h2>
          <p className="text-base text-suave">
            {rascunhos ? `${rascunhos} rascunhos esperando sua revisão no Gmail.` : 'Novos prospects chegam nos dias úteis às 8h13.'}
          </p>
        </div>
        <Botao grande variante="primario" onClick={() => void window.jarvis.abrirExterno(RASCUNHOS_EMPRESA)} icone={<ExternalLink className="size-5" aria-hidden />}>
          Ver rascunhos no Gmail
        </Botao>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-info/30 bg-info-suave px-5 py-3 text-info">
        <Info className="size-6 shrink-0" aria-hidden />
        <p className="text-base font-semibold">Os e-mails só saem depois que você revisar e enviar.</p>
      </div>
      {painel.erro && !painel.dados && <Erro texto={painel.erro} aoTentar={() => void atualizar()} />}
      <Painel>
        {prospects.length === 0 ? (
          <Vazio texto="Ainda não há prospects na planilha. O primeiro lote chega no próximo dia útil." />
        ) : (
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-28" />
              <col />
              <col className="w-48" />
              <col className="w-44" />
              <col className="w-40" />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-borda text-left text-sm font-bold tracking-wide text-suave uppercase">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Segmento</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Próximo passo</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p, i) => (
                <tr key={i} className="border-b border-borda align-top">
                  <td className="numeros px-4 py-3">{p.data}</td>
                  <td className="px-4 py-3">
                    <p className="text-lg font-semibold">{p.empresa}</p>
                    <p className="truncate text-sm text-suave">{p.email}</p>
                  </td>
                  <td className="px-4 py-3">{p.segmento}</td>
                  <td className="px-4 py-3">{p.cidade}</td>
                  <td className="px-4 py-3 font-semibold">{p.situacao}</td>
                  <td className="px-4 py-3">
                    {p.proximoPasso}
                    {p.dataProximoPasso && <span className="numeros block text-sm text-suave">até {p.dataProximoPasso}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Painel>
    </div>
  )
}
