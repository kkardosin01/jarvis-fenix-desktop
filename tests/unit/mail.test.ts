import { describe, expect, it } from 'vitest'
import {
  beneficiarioDoRemetente,
  beneficiarioDoTexto,
  encontrarValor,
  encontrarVencimento,
  extrairBoletos,
  temPalavraChave,
  valorDoPix,
  type MensagemCandidata
} from '../../src/main/mail/extrair'
import { analisarMensagem, consultaGmail, mensagemErroImap } from '../../src/main/mail/imap'
import { textoDoPdf } from '../../src/main/mail/pdf'
import { validarRespostaIA } from '../../src/main/mail/ia'
import { gerarLinhaBancaria, gerarPdf } from '../fixtures/gerador'
import {
  emailCartao,
  emailComprovante,
  emailCondominio,
  emailEscola,
  emailFenixCliente,
  emailFuturo,
  emailLuz,
  emailPropaganda,
  linhaCondominio,
  linhaLuz,
  pixEscola
} from '../fixtures/emails'

const HOJE = '2026-10-19'
const CTX = { contaEmail: 'pessoa.teste@exemplo.com', hoje: HOJE }

function msg(p: Partial<MensagemCandidata>): MensagemCandidata {
  return {
    messageId: '<x@y>',
    deEmail: 'cobranca@empresa-ficticia.com.br',
    deNome: 'Empresa Fictícia',
    assunto: '',
    data: new Date('2026-10-19T13:00:00Z'),
    texto: '',
    anexos: [],
    ...p
  }
}

describe('extratores de campos', () => {
  it('vencimento próximo do rótulo', () => {
    expect(encontrarVencimento('Emissão 01/10/2026 ... Data de vencimento: 25/10/2026')).toBe('2026-10-25')
    expect(encontrarVencimento('Vence em 3 de novembro de 2026')).toBe('2026-11-03')
    expect(encontrarVencimento('Vencto.\n05/11/26')).toBe('2026-11-05')
    expect(encontrarVencimento('Emitido em 01/10/2026')).toBeNull()
  })

  it('valor próximo do rótulo ou único R$ do texto', () => {
    expect(encontrarValor('Desconto R$ 5,00\nTotal a pagar: R$ 1.234,56')).toBe(1234.56)
    expect(encontrarValor('A fatura de R$ 99,90 está disponível')).toBe(99.9)
    expect(encontrarValor('R$ 10,00 e R$ 20,00')).toBeNull()
  })

  it('beneficiário do boleto e do remetente', () => {
    expect(beneficiarioDoTexto('Beneficiário: Condomínio Exemplo CNPJ 00.000.000/0001-00')).toBe('Condomínio Exemplo')
    expect(beneficiarioDoTexto('Beneficiário: 12.345.678/0001-90')).toBeNull()
    expect(beneficiarioDoRemetente('"Energia Fictícia"', 'x@y.com')).toBe('Energia Fictícia')
    expect(beneficiarioDoRemetente('', 'fatura@celesc.com.br')).toBe('Celesc')
  })

  it('valor do PIX (campo 54)', () => expect(valorDoPix(pixEscola)).toBe(450))

  it('palavras-chave', () => {
    expect(temPalavraChave('Sua 2ª via chegou')).toBe(true)
    expect(temPalavraChave('Guia do DAS de setembro')).toBe(true)
    expect(temPalavraChave('Reunião amanhã')).toBe(false)
  })
})

describe('classificação', () => {
  it('descarta e-mail enviado pela própria conta', () => {
    const r = extrairBoletos(msg({ deEmail: CTX.contaEmail, texto: 'boleto vencimento 20/10/2026' }), CTX)
    expect(r).toMatchObject({ tipo: 'descartado', motivo: 'enviado pela própria conta' })
  })
  it('descarta nota fiscal sem cobrança', () => {
    const r = extrairBoletos(msg({ assunto: 'Nota fiscal eletrônica', texto: 'Segue a NF-e da sua compra.' }), CTX)
    expect(r).toMatchObject({ tipo: 'descartado', motivo: 'nota fiscal sem cobrança' })
  })
  it('incompleto quando parece cobrança mas não tem vencimento', () => {
    const r = extrairBoletos(msg({ assunto: 'Sua fatura', texto: 'A fatura está disponível no app.' }), CTX)
    expect(r.tipo).toBe('incompleto')
  })
})

describe('e-mails fictícios completos (MIME + PDF)', () => {
  it('lê texto de PDF', async () => {
    const r = await textoDoPdf(gerarPdf(['Linha um', 'Vencimento: 22/10/2026']))
    expect(r.ilegivel).toBe(false)
    expect(r.texto).toContain('Vencimento: 22/10/2026')
  })

  it('PDF inválido vira "ilegível" sem quebrar', async () => {
    expect((await textoDoPdf(Buffer.from('lixo'))).ilegivel).toBe(true)
  })

  it('condomínio: linha digitável no PDF, beneficiário do boleto', async () => {
    const m = await analisarMensagem(emailCondominio, 'reserva')
    expect(m.messageId).toBe('<condominio-001@exemplo>')
    expect(m.anexos).toHaveLength(1)
    const r = extrairBoletos(m, CTX)
    expect(r.tipo).toBe('boletos')
    if (r.tipo !== 'boletos') return
    expect(r.boletos[0]).toMatchObject({
      vencimento: '2026-10-22',
      valor: 850,
      beneficiario: 'Condominio Residencial Exemplo',
      linhaDigitavel: linhaCondominio
    })
  })

  it('conta de luz (48 dígitos): vencimento do texto, valor do código', async () => {
    const r = extrairBoletos(await analisarMensagem(emailLuz, 'r'), CTX)
    expect(r).toMatchObject({
      tipo: 'boletos',
      boletos: [{ vencimento: '2026-10-19', valor: 230.1, beneficiario: 'Energia Fictícia', linhaDigitavel: linhaLuz }]
    })
  })

  it('mensalidade com PIX', async () => {
    const r = extrairBoletos(await analisarMensagem(emailEscola, 'r'), CTX)
    expect(r).toMatchObject({ tipo: 'boletos', boletos: [{ vencimento: '2026-10-25', valor: 450, pix: pixEscola, comoPagar: pixEscola }] })
  })

  it('propaganda e comprovante são descartados', async () => {
    expect(extrairBoletos(await analisarMensagem(emailPropaganda, 'r'), CTX)).toMatchObject({ tipo: 'descartado', motivo: 'propaganda' })
    expect(extrairBoletos(await analisarMensagem(emailComprovante, 'r'), CTX)).toMatchObject({ tipo: 'descartado', motivo: 'comprovante de pagamento' })
  })

  it('boleto emitido pela Fênix para cliente é descartado', async () => {
    expect(extrairBoletos(await analisarMensagem(emailFenixCliente, 'r'), CTX)).toMatchObject({
      tipo: 'descartado',
      motivo: 'boleto emitido pela Fênix para cliente'
    })
  })

  it('cartão com PDF protegido: aponta para o PDF no e-mail', async () => {
    const m = await analisarMensagem(emailCartao, 'r')
    expect(m.anexos[0]?.ilegivel).toBe(true)
    const r = extrairBoletos(m, CTX)
    expect(r).toMatchObject({
      tipo: 'boletos',
      boletos: [{ vencimento: '2026-10-26', valor: null, comoPagar: 'PDF anexo no e-mail de Cartão Fictício (19/10)' }]
    })
  })

  it('boleto futuro mantém vencimento calculado pelo fator', async () => {
    const r = extrairBoletos(await analisarMensagem(emailFuturo, 'r'), CTX)
    expect(r).toMatchObject({ tipo: 'boletos', boletos: [{ vencimento: '2026-11-30', valor: 120 }] })
  })
})

describe('IMAP utilitários', () => {
  it('consulta do Gmail', () => {
    const q = consultaGmail(new Date(2026, 8, 4))
    expect(q).toContain('after:2026/09/04')
    expect(q).toContain('"linha digitável"')
    expect(q).toContain('-in:sent')
  })
  it('erros traduzidos', () => {
    expect(mensagemErroImap({ authenticationFailed: true })).toMatch(/senha de app/)
    expect(mensagemErroImap({ code: 'ENOTFOUND' })).toMatch(/internet/)
  })
})

describe('validação da resposta da IA', () => {
  const linha = gerarLinhaBancaria({ vencimento: '2026-10-23', centavos: 5000 })
  it('aceita e confere com DV', () => {
    const b = validarRespostaIA(
      { vencimento: null, valor: null, beneficiario: 'X', linha_digitavel: linha, pix: null, e_conta_a_pagar: true },
      HOJE,
      'PDF'
    )
    expect(b).toMatchObject({ vencimento: '2026-10-23', valor: 50, linhaDigitavel: linha })
  })
  it('descarta linha inventada e respostas que não são conta a pagar', () => {
    const b = validarRespostaIA(
      { vencimento: '2026-10-23', valor: 10, beneficiario: 'X', linha_digitavel: '1'.repeat(47), pix: 'abc', e_conta_a_pagar: true },
      HOJE,
      'PDF'
    )
    expect(b).toMatchObject({ linhaDigitavel: null, pix: null, comoPagar: 'PDF' })
    expect(
      validarRespostaIA({ vencimento: null, valor: null, beneficiario: null, linha_digitavel: null, pix: null, e_conta_a_pagar: false }, HOJE, 'PDF')
    ).toBeNull()
  })
})

describe('formato estruturado da IA', () => {
  it('o esquema zod vira formato de saída do SDK sem erro', async () => {
    const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod')
    const { RespostaIA } = await import('../../src/main/mail/ia')
    const f = zodOutputFormat(RespostaIA) as unknown as { type: string; schema: { properties: Record<string, unknown> } }
    expect(f.type).toBe('json_schema')
    expect(Object.keys(f.schema.properties)).toEqual(['vencimento', 'valor', 'beneficiario', 'linha_digitavel', 'pix', 'e_conta_a_pagar'])
  })
})
