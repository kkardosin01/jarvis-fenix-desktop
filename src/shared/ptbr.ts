// Conversões pt-BR usadas pelo processo principal e pela interface.
// A planilha Jarvis_Fenix está em locale pt_BR e fuso America/Sao_Paulo.

export const FUSO = 'America/Sao_Paulo'

/** "1.234,56", "R$ 1.234,56", "589,99", "1234.56", 12.5 → número. Vazio/ inválido → null. */
export function parseNumeroBR(entrada: unknown): number | null {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : null
  if (typeof entrada !== 'string') return null
  let s = entrada.replace(/R\$|\s|\u00a0/g, '').trim()
  if (!s) return null
  const negativo = /^-|^\(.*\)$/.test(s)
  s = s.replace(/[()\-+]/g, '')
  if (s.includes(',')) {
    // Formato brasileiro: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes('.')) {
    const partes = s.split('.')
    const ultima = partes[partes.length - 1] ?? ''
    // "1.234" ou "1.234.567" → milhar; "12.5" / "12.50" → decimal
    if (partes.length > 2 || ultima.length === 3) s = partes.join('')
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return negativo ? -n : n
}

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** 1234.56 → "R$ 1.234,56" (com espaço comum, não o espaço fino do Intl). */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—'
  return fmtMoeda.format(valor).replace(/[\u00a0\u202f]/g, ' ')
}

/** Data ISO (AAAA-MM-DD) válida? */
function isoValida(a: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 1900 || a > 2200) return null
  const dt = new Date(Date.UTC(a, m - 1, d))
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "20/10/2026", "20/10/26", "20/10/2026 08:40", "2026-10-20", "20.10.2026" → "2026-10-20". */
export function parseDataBR(entrada: unknown): string | null {
  if (typeof entrada !== 'string') return null
  const s = entrada.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return isoValida(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(s)
  if (m) {
    let ano = Number(m[3])
    if (ano < 100) ano += 2000
    return isoValida(ano, Number(m[2]), Number(m[1]))
  }
  return null
}

/** "19/10/2026 20:10" → Date (horário de Brasília). */
export function parseDataHoraBR(entrada: unknown): Date | null {
  if (typeof entrada !== 'string') return null
  const iso = parseDataBR(entrada)
  if (!iso) return null
  const h = /(\d{1,2}):(\d{2})/.exec(entrada.slice(8))
  const hh = h ? h[1]!.padStart(2, '0') : '00'
  const mm = h ? h[2]! : '00'
  // Brasília não tem horário de verão desde 2019: UTC-3 fixo
  return new Date(`${iso}T${hh}:${mm}:00-03:00`)
}

/** Partes da data/hora atual no fuso de Brasília. */
export function agoraSP(agora: Date = new Date()): {
  iso: string
  hora: number
  minuto: number
  diaSemana: number
} {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short'
  }).formatToParts(agora)
  const p = (t: string): string => partes.find((x) => x.type === t)?.value ?? ''
  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    iso: `${p('year')}-${p('month')}-${p('day')}`,
    hora: Number(p('hour')),
    minuto: Number(p('minute')),
    diaSemana: dias.indexOf(p('weekday'))
  }
}

export function hojeISO(agora: Date = new Date()): string {
  return agoraSP(agora).iso
}

/** Diferença em dias entre duas datas ISO (b - a). */
export function diferencaDias(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  return Math.round((db - da) / 86_400_000)
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000)
  return d.toISOString().slice(0, 10)
}

/** "2026-10-20" → "20/10". */
export function formatarDiaMes(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}` : iso
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
]

/** "segunda-feira, 19 de outubro de 2026". */
export function dataPorExtenso(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(agora)
}

/** "20 de outubro de 2026" ou "20 de out. de 2026" → ISO. */
export function parseDataExtenso(texto: string): string | null {
  const m = /(\d{1,2})\s+de\s+([a-zç]+)\.?\s+de\s+(\d{4})/i.exec(texto)
  if (!m) return null
  const nome = m[2]!.toLowerCase()
  const idx = MESES.findIndex((mes) => mes.startsWith(nome.slice(0, 3)))
  if (idx < 0) return null
  return isoValida(Number(m[3]), idx + 1, Number(m[1]))
}

export function saudacao(agora: Date = new Date()): string {
  const { hora } = agoraSP(agora)
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** "há 3 min", "há 2 h", "agora". */
export function tempoDesde(desde: number | null | undefined, agora: number = Date.now()): string {
  if (!desde) return 'nunca'
  const min = Math.floor((agora - desde) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

export function horaMinuto(ms: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(ms))
}

/** Normaliza texto para comparações: minúsculas, sem acento, espaços simples. */
export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
