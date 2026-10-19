// Regras de quando e o que notificar (sem dependência do Electron, para testar).

import { agoraSP, formatarMoeda, hojeISO } from '../shared/ptbr'
import type { DadosPainel, Tela } from '../shared/types'

export interface Aviso {
  tipo: 'bomDia' | 'bomDiaPendente' | 'lembrete14'
  titulo: string
  corpo: string
  tela: Tela
}

export interface EstadoAvisos {
  bomDia: string | null
  bomDiaPendente: string | null
  lembrete14: string | null
}

/** Sem notificação entre 22h e 7h. */
export function horarioSilencioso(hora: number): boolean {
  return hora >= 22 || hora < 7
}

function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

export function contagens(dados: DadosPainel): { hoje: number; atrasados: number; clientes: number } {
  return {
    hoje: dados.contas.filter((c) => c.situacao === 'Vence hoje').length,
    atrasados: dados.contas.filter((c) => c.situacao === 'Atrasado').length,
    clientes: dados.contatos.length
  }
}

export function textoBomDia(nome: string, dados: DadosPainel): string {
  const { hoje, atrasados, clientes } = contagens(dados)
  const partes: string[] = []
  if (hoje > 0) partes.push(hoje === 1 ? '1 conta vence hoje' : `${hoje} contas vencem hoje`)
  if (atrasados > 0) partes.push(atrasados === 1 ? '1 atrasada' : `${atrasados} atrasadas`)
  if (clientes > 0) partes.push(clientes === 1 ? '1 cliente para ligar' : `${clientes} clientes para ligar`)
  if (!partes.length) return `Bom dia, ${nome}! Nada vencendo hoje e nenhum cliente na fila. Bom trabalho!`
  return `Bom dia, ${nome}! ${juntar(partes)}.`
}

/** O Resumo da planilha foi atualizado hoje? */
export function resumoDeHoje(dados: DadosPainel, agora: Date): boolean {
  const iso = dados.resumo.atualizadoEmISO
  return !!iso && hojeISO(new Date(iso)) === hojeISO(agora)
}

/** Decide quais avisos disparar agora. Muta `estado` para marcar o que já foi enviado. */
export function avisosDevidos(agora: Date, estado: EstadoAvisos, dados: DadosPainel | null, nome: string): Aviso[] {
  const { iso, hora, minuto } = agoraSP(agora)
  if (horarioSilencioso(hora) || !dados) return []
  const min = hora * 60 + minuto
  const avisos: Aviso[] = []

  if (min >= 9 * 60 + 5 && estado.bomDia !== iso && estado.bomDiaPendente !== iso) {
    if (resumoDeHoje(dados, agora)) {
      avisos.push({ tipo: 'bomDia', titulo: 'Jarvis Fênix', corpo: textoBomDia(nome, dados), tela: 'hoje' })
      estado.bomDia = iso
    } else {
      avisos.push({
        tipo: 'bomDiaPendente',
        titulo: 'Jarvis Fênix',
        corpo: `Bom dia, ${nome}! O resumo de hoje ainda não chegou na planilha. Confiro de novo às 9h35.`,
        tela: 'hoje'
      })
      estado.bomDiaPendente = iso
    }
  } else if (min >= 9 * 60 + 35 && estado.bomDiaPendente === iso && estado.bomDia !== iso) {
    estado.bomDia = iso
    avisos.push({
      tipo: 'bomDia',
      titulo: 'Jarvis Fênix',
      corpo: resumoDeHoje(dados, agora)
        ? textoBomDia(nome, dados)
        : 'O resumo de hoje ainda não foi atualizado. Os números na tela são de ontem.',
      tela: 'hoje'
    })
  }

  if (min >= 14 * 60 && estado.lembrete14 !== iso) {
    const hoje = dados.contas.filter((c) => c.situacao === 'Vence hoje')
    estado.lembrete14 = iso
    if (hoje.length) {
      const total = hoje.reduce((s, c) => s + (c.valor ?? 0), 0)
      const valor = total > 0 ? ` (${formatarMoeda(total)} com valor conhecido)` : ''
      avisos.push({
        tipo: 'lembrete14',
        titulo: 'Contas vencendo hoje',
        corpo:
          hoje.length === 1
            ? `Lembrete: ${hoje[0]!.beneficiario || '1 conta'} vence hoje e ainda não foi marcada como paga${valor}.`
            : `Lembrete: ${hoje.length} contas vencem hoje e ainda não foram marcadas como pagas${valor}.`,
        tela: 'contas'
      })
    }
  }
  return avisos
}

/** Sincronização de e-mails só dentro da janela de horário configurada (padrão 6h–23h). */
export function dentroDoHorarioSync(agora: Date, inicio: number, fim: number): boolean {
  const { hora } = agoraSP(agora)
  return hora >= inicio && hora < fim
}
