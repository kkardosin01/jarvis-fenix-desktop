// Teste de fumaça: abre o app empacotado em out/ com uma pasta de dados temporária
// e dados FICTÍCIOS em cache (sem planilha, sem e-mail, sem segredos).

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hojeISO, somarDias } from '../../src/shared/ptbr'
import type { DadosPainel } from '../../src/shared/types'

const hoje = hojeISO()

function dadosFicticios(): DadosPainel {
  const conta = (dias: number, beneficiario: string, valor: number | null, situacao: 'Atrasado' | 'Vence hoje' | 'Próximos dias', i: number) => ({
    chave: `ficticia:${i}`,
    fonte: 'Boletos' as const,
    vencimento: somarDias(hoje, dias),
    beneficiario,
    valor,
    conta: (i % 2 ? 'PF' : 'PJ') as 'PF' | 'PJ',
    origem: i % 2 ? 'E-mail Pessoal (fictício)' : 'E-mail do contador',
    situacao,
    comoPagar: '',
    observacao: valor === null ? 'Valor no PDF' : '',
    contaEmail: '',
    idMensagem: '',
    linhaDigitavel: null,
    pix: null,
    linhaPlanilha: i + 2
  })
  return {
    resumo: {
      atualizadoEm: '',
      atualizadoEmISO: new Date().toISOString(),
      fraseDoDia: 'Dia de exemplo: duas contas vencem hoje e há três clientes fictícios para ligar.',
      emailsRelevantes: 4,
      boletosHoje: 2,
      boletosAtrasados: 1,
      boletosValorConhecido: 1080.1,
      contatosHoje: 3,
      rascunhosProspeccao: 5,
      detalhes: {}
    },
    prioridades: [
      { ordem: 1, prioridade: 'Pagar a guia de impostos de exemplo', porQue: 'Vence hoje.' },
      { ordem: 2, prioridade: 'Ligar para a Clínica Exemplo', porQue: 'Sem comprar há 60 dias.' },
      { ordem: 3, prioridade: 'Revisar os rascunhos de prospecção', porQue: '5 e-mails prontos no Gmail.' }
    ],
    emails: [
      { recebidoEm: '19/10', remetente: 'Contabilidade Exemplo', assunto: 'Guias do mês', resumo: 'Guias anexas.', categoria: 'Financeiro', acao: 'Pagar até amanhã', urgencia: 'Alta' }
    ],
    contas: [
      conta(-3, 'Fornecedor Fictício', 450, 'Atrasado', 0),
      conta(0, 'Energia Fictícia', 230.1, 'Vence hoje', 1),
      conta(0, 'Guia de Impostos (exemplo)', null, 'Vence hoje', 2),
      conta(3, 'Condomínio Exemplo', 850, 'Próximos dias', 3)
    ],
    contatos: [
      { cliente: 'Clínica Exemplo', cidade: 'Florianópolis/SC', contato: 'Ana', telefone: '(48) 3000-0000', ultimaCompra: '', diasSemComprar: 60, motivo: 'Compra parada.', mensagemSugerida: 'Oi Ana, tudo bem?' },
      { cliente: 'Hospital Fictício', cidade: 'São José/SC', contato: 'Bruno', telefone: '(48) 99999-0000', ultimaCompra: '', diasSemComprar: 35, motivo: 'Queda de volume.', mensagemSugerida: 'Oi Bruno!' },
      { cliente: 'Veterinária Teste', cidade: 'Palhoça/SC', contato: 'Carla', telefone: '(48) 98888-0000', ultimaCompra: '', diasSemComprar: 20, motivo: 'Reativar.', mensagemSugerida: 'Oi Carla!' }
    ],
    prospects: []
  }
}

let app: ElectronApplication
let janela: Page
let pasta: string

test.beforeAll(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'jarvis-e2e-'))
  writeFileSync(join(pasta, 'cache-painel.json'), JSON.stringify({ dados: dadosFicticios(), lidoEm: Date.now() }))
  app = await electron.launch({
    args: ['.'],
    env: { ...process.env, JARVIS_E2E: '1', JARVIS_USER_DATA: pasta, NODE_ENV: 'production' }
  })
  janela = await app.firstWindow()
  await janela.setViewportSize({ width: 1920, height: 1080 })
})

test.afterAll(async () => {
  await app?.close()
  rmSync(pasta, { recursive: true, force: true })
})

test('abre a janela com o título e o menu', async () => {
  await expect(janela).toHaveTitle('Jarvis Fênix')
  for (const item of ['Hoje', 'Contas a pagar', 'Clientes', 'E-mails', 'Prospecção', 'Configurações']) {
    await expect(janela.getByRole('button', { name: item, exact: true })).toBeVisible()
  }
})

test('renderer isolado: sem Node e com a ponte do preload', async () => {
  const r = await janela.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process,
    jarvis: typeof window.jarvis
  }))
  expect(r).toEqual({ require: 'undefined', process: 'undefined', jarvis: 'object' })
})

test('central de comando cabe em 1920×1080 sem rolar', async () => {
  await expect(janela.getByText('Dia de exemplo')).toBeVisible()
  await expect(janela.getByRole('button', { name: /Vencem hoje/ })).toContainText('2')
  const rola = await janela.evaluate(() => {
    const main = document.querySelector('main')!
    return main.scrollHeight > main.clientHeight + 1 || document.documentElement.scrollWidth > window.innerWidth
  })
  expect(rola).toBe(false)
  await janela.screenshot({ path: 'test-results/hoje.png' })
})

test('contas a pagar lista e totaliza', async () => {
  await janela.getByRole('button', { name: 'Contas a pagar', exact: true }).click()
  await expect(janela.getByRole('heading', { name: 'Contas a pagar' })).toBeVisible()
  await expect(janela.getByRole('button', { name: 'Contas a pagar', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(janela.getByRole('cell', { name: /Condomínio Exemplo/ })).toBeVisible()
  await expect(janela.getByText('+ 1 com valor no PDF')).toBeVisible()
  await janela.screenshot({ path: 'test-results/contas.png' })
})

test('configurações abre o cadastro de conta com instruções', async () => {
  await janela.getByRole('button', { name: 'Configurações', exact: true }).click()
  await janela.getByRole('button', { name: 'Adicionar conta' }).click()
  await expect(janela.getByText('Como gerar a senha de app do Gmail')).toBeVisible()
  await expect(janela.getByRole('button', { name: 'Salvar conta' })).toBeDisabled()
  await janela.screenshot({ path: 'test-results/nova-conta.png' })
  await janela.getByRole('button', { name: 'Fechar' }).click()
})

test('tema escuro legível', async () => {
  await janela.getByRole('button', { name: 'Hoje', exact: true }).click()
  await janela.emulateMedia({ colorScheme: 'dark' })
  const fundo = await janela.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(fundo).toBe('rgb(10, 19, 21)')
  await janela.waitForTimeout(400)
  await janela.screenshot({ path: 'test-results/hoje-escuro.png' })
  await janela.emulateMedia({ colorScheme: 'light' })
})
