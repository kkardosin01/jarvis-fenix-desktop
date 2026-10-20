// Acesso à planilha Jarvis_Fenix. Só roda no processo principal.
// Leitura sempre por nome de coluna; escrita SOMENTE em Boletos_Manual e Boletos_Outras_Contas.

import { normalizarTexto } from 'jarvis-fenix-core/ptbr'
import type { Linha } from 'jarvis-fenix-core/types'

export const ABAS_ESCRITA = ['Boletos_Manual', 'Boletos_Outras_Contas'] as const
export type AbaEscrita = (typeof ABAS_ESCRITA)[number]

export const ABAS_LEITURA = [
  'Resumo',
  'Prioridades',
  'Emails',
  'Boletos',
  'Boletos_Manual',
  'Boletos_Outras_Contas',
  'Contatos',
  'Prospects'
] as const
export type Aba = (typeof ABAS_LEITURA)[number]

/** Operações mínimas da API do Google Sheets (injetável para testes). */
export interface SheetsApi {
  lerValores(ranges: string[]): Promise<string[][][]>
  acrescentar(range: string, valores: (string | number)[][]): Promise<void>
  atualizar(range: string, valores: (string | number)[][]): Promise<void>
  idDaAba(aba: string): Promise<number>
  removerLinhas(sheetId: number, numerosLinha: number[]): Promise<void>
}

export interface LinhaPlanilha {
  /** Número da linha na planilha (a linha 1 é o cabeçalho). */
  numero: number
  dados: Linha
}

export interface AbaLida {
  cabecalho: string[]
  linhas: LinhaPlanilha[]
}

export function letraColuna(indice: number): string {
  let n = indice + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Encontra a coluna pelo nome, tolerando acentos e explicações entre parênteses. */
export function indiceColuna(cabecalho: string[], nome: string): number {
  const exato = cabecalho.indexOf(nome)
  if (exato >= 0) return exato
  const alvo = normalizarTexto(nome.replace(/\(.*\)/, ''))
  return cabecalho.findIndex((h) => normalizarTexto(h.replace(/\(.*\)/, '')) === alvo)
}

/** Converte a matriz crua (linha 1 = cabeçalho) em objetos por nome de coluna. */
export function matrizParaLinhas(matriz: string[][]): AbaLida {
  const cabecalho = (matriz[0] ?? []).map((h) => String(h ?? '').trim())
  const linhas: LinhaPlanilha[] = []
  for (let i = 1; i < matriz.length; i++) {
    const bruta = matriz[i] ?? []
    if (bruta.every((c) => String(c ?? '').trim() === '')) continue
    const dados: Linha = {}
    cabecalho.forEach((h, j) => {
      if (h) dados[h] = String(bruta[j] ?? '')
    })
    linhas.push({ numero: i + 1, dados })
  }
  return { cabecalho, linhas }
}

/** Monta a linha a gravar respeitando a ordem das colunas do cabeçalho atual. */
export function registroParaLinha(cabecalho: string[], registro: Record<string, string | number | null>): (string | number)[] {
  const linha: (string | number)[] = cabecalho.map(() => '')
  for (const [nome, valor] of Object.entries(registro)) {
    const i = indiceColuna(cabecalho, nome)
    if (i < 0) throw new Error(`Coluna "${nome}" não existe na aba`)
    linha[i] = valor ?? ''
  }
  return linha
}

function garantirEscrita(aba: string): asserts aba is AbaEscrita {
  if (!(ABAS_ESCRITA as readonly string[]).includes(aba)) {
    throw new Error(`Escrita bloqueada: o Jarvis só grava em ${ABAS_ESCRITA.join(' e ')}`)
  }
}

export class Planilha {
  private cabecalhos = new Map<string, string[]>()

  constructor(private readonly api: SheetsApi) {}

  /** Lê várias abas numa única chamada. */
  async lerAbas<T extends Aba>(abas: readonly T[]): Promise<Record<T, AbaLida>> {
    const matrizes = await this.api.lerValores(abas.map((a) => `'${a}'`))
    const saida = {} as Record<T, AbaLida>
    abas.forEach((aba, i) => {
      const lida = matrizParaLinhas(matrizes[i] ?? [])
      this.cabecalhos.set(aba, lida.cabecalho)
      saida[aba] = lida
    })
    return saida
  }

  async lerAba(aba: Aba): Promise<AbaLida> {
    return (await this.lerAbas([aba]))[aba]
  }

  private async cabecalho(aba: string): Promise<string[]> {
    const c = this.cabecalhos.get(aba)
    if (c && c.length) return c
    const [m] = await this.api.lerValores([`'${aba}'!1:1`])
    const cab = (m?.[0] ?? []).map((h) => String(h).trim())
    if (!cab.length) throw new Error(`A aba ${aba} está sem cabeçalho`)
    this.cabecalhos.set(aba, cab)
    return cab
  }

  async acrescentar(aba: string, registro: Record<string, string | number | null>): Promise<void> {
    garantirEscrita(aba)
    const cab = await this.cabecalho(aba)
    await this.api.acrescentar(`'${aba}'!A1`, [registroParaLinha(cab, registro)])
  }

  async atualizarCelula(aba: string, numeroLinha: number, nomeColuna: string, valor: string | number): Promise<void> {
    garantirEscrita(aba)
    if (numeroLinha < 2) throw new Error('Não é permitido alterar o cabeçalho')
    const cab = await this.cabecalho(aba)
    const i = indiceColuna(cab, nomeColuna)
    if (i < 0) throw new Error(`Coluna "${nomeColuna}" não existe na aba ${aba}`)
    await this.api.atualizar(`'${aba}'!${letraColuna(i)}${numeroLinha}`, [[valor]])
  }

  async removerLinhas(aba: string, numeros: number[]): Promise<void> {
    garantirEscrita(aba)
    const validos = [...new Set(numeros)].filter((n) => n >= 2)
    if (!validos.length) return
    const sheetId = await this.api.idDaAba(aba)
    await this.api.removerLinhas(sheetId, validos)
  }

  /** Remove as linhas cujo valor na coluna bate (ex.: id_mensagem). Relê a aba antes para não apagar a linha errada. */
  async removerPorChave(aba: string, nomeColuna: string, valores: string[]): Promise<number> {
    garantirEscrita(aba)
    const alvo = new Set(valores.filter(Boolean))
    if (!alvo.size) return 0
    const lida = await this.lerAba(aba as Aba)
    const i = indiceColuna(lida.cabecalho, nomeColuna)
    if (i < 0) throw new Error(`Coluna "${nomeColuna}" não existe na aba ${aba}`)
    const nome = lida.cabecalho[i]!
    const numeros = lida.linhas.filter((l) => alvo.has((l.dados[nome] ?? '').trim())).map((l) => l.numero)
    await this.removerLinhas(aba, numeros)
    return numeros.length
  }
}

// ------------------------------------------------------------ Google

export interface ChaveContaServico {
  client_email: string
  private_key: string
  project_id?: string
}

export function validarChaveContaServico(json: string): ChaveContaServico {
  let obj: unknown
  try {
    obj = JSON.parse(json)
  } catch {
    throw new Error('O arquivo não é um JSON válido')
  }
  const o = obj as Record<string, unknown>
  if (o.type !== 'service_account' || typeof o.client_email !== 'string' || typeof o.private_key !== 'string') {
    throw new Error('Este arquivo não é a chave de uma conta de serviço do Google')
  }
  return { client_email: o.client_email, private_key: o.private_key, project_id: o.project_id as string | undefined }
}

/** Implementação real com @googleapis/sheets (carregada sob demanda). */
export async function criarApiGoogle(chave: ChaveContaServico, planilhaId: string): Promise<SheetsApi> {
  const { sheets } = await import('@googleapis/sheets')
  const { JWT } = await import('google-auth-library')
  const auth = new JWT({
    email: chave.client_email,
    key: chave.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })
  const cliente = sheets({ version: 'v4', auth })
  const ids = new Map<string, number>()

  return {
    async lerValores(ranges) {
      const r = await cliente.spreadsheets.values.batchGet({
        spreadsheetId: planilhaId,
        ranges,
        valueRenderOption: 'FORMATTED_VALUE',
        majorDimension: 'ROWS'
      })
      return (r.data.valueRanges ?? []).map((v) => (v.values ?? []) as string[][])
    },
    async acrescentar(range, valores) {
      await cliente.spreadsheets.values.append({
        spreadsheetId: planilhaId,
        range,
        // RAW: a linha digitável continua texto e a data AAAA-MM-DD não vira número
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: valores }
      })
    },
    async atualizar(range, valores) {
      await cliente.spreadsheets.values.update({
        spreadsheetId: planilhaId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: valores }
      })
    },
    async idDaAba(aba) {
      const conhecido = ids.get(aba)
      if (conhecido !== undefined) return conhecido
      const r = await cliente.spreadsheets.get({
        spreadsheetId: planilhaId,
        fields: 'sheets.properties(sheetId,title)'
      })
      for (const s of r.data.sheets ?? []) {
        if (s.properties?.title && s.properties.sheetId != null) ids.set(s.properties.title, s.properties.sheetId)
      }
      const id = ids.get(aba)
      if (id === undefined) throw new Error(`Aba ${aba} não encontrada`)
      return id
    },
    async removerLinhas(sheetId, numeros) {
      // De baixo para cima, para os índices não mudarem durante a remoção
      const ordenados = [...numeros].sort((a, b) => b - a)
      await cliente.spreadsheets.batchUpdate({
        spreadsheetId: planilhaId,
        requestBody: {
          requests: ordenados.map((n) => ({
            deleteDimension: {
              range: { sheetId, dimension: 'ROWS', startIndex: n - 1, endIndex: n }
            }
          }))
        }
      })
    }
  }
}
